// src/turnEngine.js
// Master turn pipeline — 15 steps as specified in the design.

import { getActiveCountries } from './gameState.js';
import { applyPopulationGrowth } from './population.js';
import {
  harvestGrain,
  processFoodUpkeep,
  processUpkeep,
  calcMilitaryUpkeep,
  calcScienceUpkeep,
  grainSellPrice,
  trainSoldiers,
  trainScientists,
  generalRecruitCost,
} from './economy.js';
import { applyScienceOrders, processResearch } from './science.js';
import { recruitGeneral, processGeneralAction, ageGenerals } from './generals.js';
import { resolveBattle } from './combat.js';
import { calcLandCaptured, applyLandCapture } from './landCapture.js';
import { recordAttack, recordElimination, decayHostility } from './hostility.js';
import { generateAIOrders } from './ai.js';
import { snapshotYear, checkVictory } from './scoring.js';

export function processTurn(state) {
  const log = [];
  state.battleLogs = [];

  // ── Step 1: Generate AI orders ─────────────────────────────────
  for (const country of getActiveCountries(state)) {
    if (!country.isHuman || country.isSurrendered) {
      country.orders = generateAIOrders(state, country.id);
    }
  }

  // ── Step 2: Population growth ──────────────────────────────────
  for (const country of getActiveCountries(state)) {
    const growth = applyPopulationGrowth(country);
    if (growth > 0) {
      log.push(`${country.name}: population grew by ${growth} (now ${country.population}).`);
    }
  }

  // ── Step 3: Harvest grain ──────────────────────────────────────
  // Auto-harvest for any country that hasn't manually harvested yet this turn
  // (human player may have already harvested via the HUD button).
  for (const country of getActiveCountries(state)) {
    if (!country.harvestedThisTurn) {
      const harvested = harvestGrain(country);
      if (!country.isHuman) {
        // AI sells enough grain to cover food + upkeep costs, keeping a small buffer
        const price        = grainSellPrice(country);
        const upkeepNeeded = calcMilitaryUpkeep(country) + calcScienceUpkeep(country);
        const needToSell   = Math.max(0, upkeepNeeded - country.money);
        const grainToSell  = Math.min(country.grain, Math.ceil(needToSell / price) + 200);
        if (grainToSell > 0) {
          country.money += grainToSell * price;
          country.grain -= grainToSell;
          log.push(`${country.name} sold ${grainToSell} grain to cover upkeep.`);
        }
      }
    }
  }

  // ── Step 4: Food upkeep + starvation ──────────────────────────
  for (const country of getActiveCountries(state)) {
    const { starved } = processFoodUpkeep(country);
    if (starved > 0) {
      log.push(`⚠ ${country.name}: ${starved} people starved due to food shortage!`);
    }
  }

  // ── Step 5: Military and science upkeep ───────────────────────
  for (const country of getActiveCountries(state)) {
    const { soldierDesertions, scientistDesertions } = processUpkeep(country);
    if (soldierDesertions > 0) {
      log.push(`${country.name}: ${soldierDesertions} soldiers deserted (upkeep not met).`);
    }
    if (scientistDesertions > 0) {
      log.push(`${country.name}: ${scientistDesertions} scientists quit (upkeep not met).`);
    }
  }

  // ── Step 5b: AI training and general recruitment ──────────────
  // Human players train via immediate UI actions; AI does it here each turn.
  for (const country of getActiveCountries(state)) {
    if (country.isHuman && !country.isSurrendered) continue;
    const o = country.orders;

    // Train soldiers
    if (o.soldiers != null && o.soldiers > country.soldiers) {
      const want = o.soldiers - country.soldiers;
      trainSoldiers(country, want);
    }

    // Train scientists
    if (o.scientists != null && o.scientists > country.scientists) {
      const want = o.scientists - country.scientists;
      trainScientists(country, want);
    }

    // Recruit general
    if (o.recruitGeneral && country.generals.length === 0) {
      const { age, skill, speed } = o.recruitGeneral;
      const cost = generalRecruitCost(age, skill, speed);
      if (country.money >= cost) {
        const gen = recruitGeneral(country, age, skill, speed);
        if (gen) log.push(`${country.name} recruited General ${gen.name} (age ${gen.age}, skill ${gen.skill}, speed ${gen.speed}).`);
      }
    }
  }

  // ── Step 6: Apply science allocation and research ─────────────
  for (const country of getActiveCountries(state)) {
    applyScienceOrders(country);
    const levelUps = processResearch(country);
    for (const { area, newLevel } of levelUps) {
      log.push(`${country.name} reached ${area} level ${newLevel}!`);
    }
  }

  // ── Step 7: Collect and sort attacks by general speed ──────────
  const attacks = [];

  for (const country of getActiveCountries(state)) {
    for (const order of (country.orders.generalOrders ?? [])) {
      const gen = country.generals.find(g => g.id === order.generalId);
      if (!gen) continue;

      gen.action          = order.action;
      gen.targetCountryId = order.targetCountryId ?? null;

      if (order.action !== 'attack') continue;
      if (!order.targetCountryId)    continue;

      if (!country.borders[order.targetCountryId]) {
        log.push(`${country.name}: attack canceled — not adjacent to target.`);
        gen.action = 'defend';
        continue;
      }

      attacks.push({
        attackerCountryId: country.id,
        defenderCountryId: order.targetCountryId,
        generalId:         gen.id,
        soldiers:          Math.max(1, order.soldiers ?? Math.floor(country.soldiers * 0.5)),
        speed:             gen.speed,
      });
    }
  }

  attacks.sort((a, b) => b.speed - a.speed);

  // ── Steps 8 + 9: Resolve battles and transfer territory ────────
  const mutualPairs = new Set();
  for (const a of attacks) {
    if (attacks.some(b =>
      b.attackerCountryId === a.defenderCountryId &&
      b.defenderCountryId === a.attackerCountryId
    )) {
      mutualPairs.add(`${a.attackerCountryId}→${a.defenderCountryId}`);
    }
  }

  for (const attack of attacks) {
    const attacker = state.countries[attack.attackerCountryId];
    const defender = state.countries[attack.defenderCountryId];

    if (attacker.isEliminated || defender.isEliminated) continue;

    if (!attacker.borders[attack.defenderCountryId]) {
      log.push(`${attacker.name}'s attack on ${defender.name} canceled — no longer adjacent.`);
      continue;
    }

    const isOpenField = mutualPairs.has(`${attack.attackerCountryId}→${attack.defenderCountryId}`);

    const result = resolveBattle(
      state,
      attack.attackerCountryId,
      attack.defenderCountryId,
      attack.generalId,
      attack.soldiers,
      isOpenField,
    );

    recordAttack(state, attack.attackerCountryId, attack.defenderCountryId);

    if (result.result === 'attackerVictory') {
      const attGen    = attacker.generals.find(g => g.id === attack.generalId);
      const speed     = attGen?.speed ?? 1;
      const captured  = calcLandCaptured(result.attackerSurvivors, speed, defender.territory);

      const { actual, events } = applyLandCapture(
        state,
        attack.attackerCountryId,
        attack.defenderCountryId,
        captured,
      );

      result.territoryCaptured = actual;
      log.push(`${attacker.name} captured ${actual} territory from ${defender.name}.`);

      for (const event of events) {
        if (event.type === 'elimination') {
          log.push(`⚔ ${defender.name} has been eliminated by ${attacker.name}!`);
          state.eliminations[attack.attackerCountryId] =
            (state.eliminations[attack.attackerCountryId] ?? 0) + 1;
          recordElimination(state, attack.attackerCountryId, attack.defenderCountryId);
        } else if (event.type === 'newAdjacency') {
          const a = state.countries[event.a]?.name;
          const b = state.countries[event.b]?.name;
          log.push(`${a} and ${b} are now adjacent.`);
        } else if (event.type === 'lostAdjacency') {
          const a = state.countries[event.a]?.name;
          const b = state.countries[event.b]?.name;
          log.push(`${a} and ${b} are no longer adjacent.`);
        }
      }
    }

    state.battleLogs.push(result);
  }

  // ── Step 10: Non-battle general actions ────────────────────────
  for (const country of getActiveCountries(state)) {
    for (const gen of country.generals) {
      if (gen.action !== 'attack') {
        processGeneralAction(gen);
      }
    }
  }

  // ── Step 11: Hostility decay ───────────────────────────────────
  decayHostility(state);

  // ── Step 12: General aging / death ────────────────────────────
  for (const country of getActiveCountries(state)) {
    const msgs = ageGenerals(country);
    log.push(...msgs);
  }

  // ── Step 13: Snapshot yearly stats ────────────────────────────
  snapshotYear(state);

  // ── Step 14: Reset for next turn ──────────────────────────────
  for (const country of getActiveCountries(state)) {
    // Reset harvest flag so farmers can harvest again next turn
    country.harvestedThisTurn = false;

    country.orders = {
      scienceAllocation: null,
      generalOrders:     [],
    };
    for (const gen of country.generals) {
      gen.action          = null;
      gen.targetCountryId = null;
      gen.battlesThisTurn = 0;
    }
  }

  state.eventLog = log;
  state.turn++;

  // ── Step 15: Check victory ─────────────────────────────────────
  checkVictory(state);

  return state;
}
