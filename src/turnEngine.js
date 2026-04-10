// src/turnEngine.js
// Master turn pipeline — 15 steps as specified in the design.

import { getActiveCountries } from './gameState.js';
import { applyPopulationGrowth, applyPopulationOrders } from './population.js';
import { processEconomy } from './economy.js';
import { applyScienceOrders, processResearch } from './science.js';
import { recruitGeneral, processGeneralAction, ageGenerals } from './generals.js';
import { resolveBattle } from './combat.js';
import { calcLandCaptured, applyLandCapture } from './landCapture.js';
import { recordAttack, recordElimination, decayHostility } from './hostility.js';
import { generateAIOrders } from './ai.js';
import { snapshotYear, checkVictory } from './scoring.js';

/**
 * Run one full game turn.
 * Mutates state in-place; returns state for convenience.
 */
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

  // ── Step 3: Economic production ────────────────────────────────
  for (const country of getActiveCountries(state)) {
    const { grain, income } = processEconomy(country);
    log.push(`${country.name}: ${grain} grain → +${income} money (treasury: ${country.money}).`);
  }

  // ── Step 4: Apply population allocation orders ─────────────────
  for (const country of getActiveCountries(state)) {
    applyPopulationOrders(country);
  }

  // ── Step 5: Recruit generals ───────────────────────────────────
  for (const country of getActiveCountries(state)) {
    const o = country.orders.recruitGeneral;
    if (o) {
      const gen = recruitGeneral(country, o.age, o.skill, o.speed);
      if (gen) {
        log.push(`${country.name} recruited General ${gen.name} (age ${gen.age}, skill ${gen.skill}, speed ${gen.speed}).`);
      } else {
        log.push(`${country.name} could not afford to recruit a general.`);
      }
    }
  }

  // ── Step 6: Research ───────────────────────────────────────────
  for (const country of getActiveCountries(state)) {
    applyScienceOrders(country);
    const levelUps = processResearch(country);
    for (const { area, newLevel } of levelUps) {
      log.push(`${country.name} reached ${area} level ${newLevel}!`);
    }
  }

  // ── Step 7: Collect and sort attacks by speed ──────────────────
  const attacks = [];

  for (const country of getActiveCountries(state)) {
    for (const order of (country.orders.generalOrders ?? [])) {
      const gen = country.generals.find(g => g.id === order.generalId);
      if (!gen) continue;

      gen.action          = order.action;
      gen.targetCountryId = order.targetCountryId ?? null;

      if (order.action !== 'attack') continue;
      if (!order.targetCountryId)    continue;

      // Verify adjacency at order time
      if (!country.borders[order.targetCountryId]) {
        log.push(`${country.name}: attack on ${state.countries[order.targetCountryId]?.name ?? order.targetCountryId} canceled — not adjacent.`);
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

  // Fastest generals attack first
  attacks.sort((a, b) => b.speed - a.speed);

  // ── Step 8 + 9: Resolve battles and transfer territory ─────────
  // Track which (attacker,defender) pairs are mutual attacks (open field)
  const mutualPairs = new Set();
  for (const a of attacks) {
    const reverse = attacks.find(
      b => b.attackerCountryId === a.defenderCountryId
        && b.defenderCountryId === a.attackerCountryId
    );
    if (reverse) {
      mutualPairs.add(`${a.attackerCountryId}→${a.defenderCountryId}`);
    }
  }

  for (const attack of attacks) {
    const attacker = state.countries[attack.attackerCountryId];
    const defender = state.countries[attack.defenderCountryId];

    if (attacker.isEliminated || defender.isEliminated) continue;

    // Re-check adjacency (earlier battles may have changed the map)
    if (!attacker.borders[attack.defenderCountryId]) {
      log.push(`${attacker.name}'s attack on ${defender.name} canceled — no longer adjacent after earlier fighting.`);
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

    state.battleLogs.push(result);
    recordAttack(state, attack.attackerCountryId, attack.defenderCountryId);

    if (result.result === 'attackerVictory') {
      const attGen = attacker.generals.find(g => g.id === attack.generalId);
      const speed  = attGen?.speed ?? 1;
      const captured = calcLandCaptured(result.attackerSurvivors, speed);

      const { actual, events } = applyLandCapture(
        state,
        attack.attackerCountryId,
        attack.defenderCountryId,
        captured,
      );

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

  // ── Step 14: Clear orders for next turn ───────────────────────
  for (const country of getActiveCountries(state)) {
    country.orders = {
      farmers:           null,
      scientists:        null,
      soldiers:          null,
      scienceAllocation: null,
      generalOrders:     [],
      recruitGeneral:    null,
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
