// src/combat.js
import { CONFIG } from './config.js';
import { battleOpener, roundSummary, battleOutcomeText } from './flavorText.js';
import { grantBattleSkillGain } from './generals.js';

// ── Power formula ──────────────────────────────────────────────────

function combatPower(soldiers, country, gen, digIn) {
  if (soldiers <= 0) return 0;

  const milSciMult = CONFIG.MIL_SCIENCE_BASE
    + (country.science.militaryStrength - 1) * CONFIG.MIL_SCIENCE_MULT;

  const skillMult = gen
    ? 1 + gen.skill * CONFIG.SKILL_COMBAT_MULT
    : 1.0;

  const moraleMult = gen
    ? CONFIG.MORALE_POWER_MIN
      + (gen.morale / CONFIG.GENERAL_MAX_MORALE)
      * (CONFIG.MORALE_POWER_MAX - CONFIG.MORALE_POWER_MIN)
    : 1.0;

  const energyMult = gen
    ? CONFIG.ENERGY_POWER_MIN
      + (gen.energy / CONFIG.GENERAL_MAX_ENERGY)
      * (CONFIG.ENERGY_POWER_MAX - CONFIG.ENERGY_POWER_MIN)
    : 0.8;

  const defBonus = digIn ? CONFIG.DEFENSE_DIG_IN_BONUS : 1.0;

  return soldiers * milSciMult * skillMult * moraleMult * energyMult * defBonus;
}

function calcDamage(power) {
  return Math.max(1, Math.floor(power * CONFIG.DAMAGE_FACTOR));
}

// ── Morale ────────────────────────────────────────────────────────

function shiftMorale(loserGen, winnerGen) {
  if (loserGen) loserGen.morale  = Math.max(0,                          loserGen.morale  - CONFIG.MORALE_SHIFT_AMOUNT);
  if (winnerGen) winnerGen.morale = Math.min(CONFIG.GENERAL_MAX_MORALE, winnerGen.morale + CONFIG.MORALE_SHIFT_AMOUNT);
}

// ── Main battle resolver ───────────────────────────────────────────

export function resolveBattle(state, attCountryId, defCountryId, attGenId, attSoldiers, isOpenField) {
  const attCountry = state.countries[attCountryId];
  const defCountry = state.countries[defCountryId];

  const attGen = attGenId
    ? attCountry.generals.find(g => g.id === attGenId) ?? null
    : null;

  const defGen = defCountry.generals.find(g => g.action === 'defend')
    ?? defCountry.generals[0]
    ?? null;

  const digIn = !isOpenField && defGen?.action === 'defend';

  let att = Math.min(attSoldiers, attCountry.soldiers);
  let def = defCountry.soldiers;

  // Record opening troop counts for the battle log
  const attStart = att;
  const defStart = def;

  const log = [battleOpener(attCountry, defCountry, attGen, defGen, digIn)];
  log.push(
    `Forces: ${attCountry.name} ${att} soldiers vs ${defCountry.name} ${def} soldiers.`
    + (digIn ? ` ${defCountry.name} is dug in (+${Math.round((CONFIG.DEFENSE_DIG_IN_BONUS - 1) * 100)}% defense).` : '')
  );

  let round = 0;
  let result = 'stalemate';

  for (round = 1; round <= CONFIG.MAX_BATTLE_ROUNDS; round++) {
    if (att <= 0 || def <= 0) break;

    const attPow  = combatPower(att, attCountry, attGen, false);
    const defPow  = combatPower(def, defCountry, defGen, digIn);

    const attDeals = calcDamage(attPow);   // damage dealt TO defender
    const defDeals = calcDamage(defPow);   // damage dealt TO attacker

    const attBefore = att;
    const defBefore = def;

    def = Math.max(0, def - attDeals);
    att = Math.max(0, att - defDeals);

    const attActualLoss = attBefore - att;
    const defActualLoss = defBefore - def;

    // Morale: shift on decisive rounds
    const attRatio = attBefore > 0 ? defDeals / attBefore : 0;
    const defRatio = defBefore > 0 ? attDeals / defBefore : 0;

    let roundOutcome = 'even';
    if (defRatio > CONFIG.MORALE_SHIFT_THRESHOLD && defRatio > attRatio + 0.05) {
      shiftMorale(defGen, attGen);
      roundOutcome = 'attacker';
    } else if (attRatio > CONFIG.MORALE_SHIFT_THRESHOLD && attRatio > defRatio + 0.05) {
      shiftMorale(attGen, defGen);
      roundOutcome = 'defender';
    }

    // Append round narrative + casualties on the same line
    const narrative = roundSummary(attCountry, defCountry, roundOutcome, round);
    const casualties = ` (${attCountry.name} −${attActualLoss}, ${defCountry.name} −${defActualLoss})`;
    log.push(narrative + casualties);
  }

  const actualRounds = round - 1;

  if (def <= 0 && att > 0)  result = 'attackerVictory';
  else if (att <= 0)         result = 'defenderVictory';
  else                       result = 'stalemate';

  log.push(battleOutcomeText(attCountry, defCountry, result, actualRounds));
  log.push(
    `Final: ${attCountry.name} ${att} survivors (lost ${attStart - att}),`
    + ` ${defCountry.name} ${def} survivors (lost ${defStart - def}).`
  );

  // Skill gains
  if (attGen) grantBattleSkillGain(attGen, actualRounds);
  if (defGen) {
    grantBattleSkillGain(defGen, actualRounds);
    defGen.battlesThisTurn = (defGen.battlesThisTurn || 0) + 1;
    defGen.energy = Math.max(0, defGen.energy - CONFIG.GENERAL_DEFEND_BATTLE_COST);
  }

  // Apply casualties to countries
  const attLosses = attStart - att;
  const defLosses = defStart - def;

  attCountry.soldiers = Math.max(0, attCountry.soldiers - attLosses);
  defCountry.soldiers = Math.max(0, defCountry.soldiers - defLosses);

  return {
    attackerCountryId: attCountryId,
    defenderCountryId: defCountryId,
    result,
    attackerSurvivors: att,
    defenderSurvivors: def,
    attackerStartSoldiers: attStart,
    defenderStartSoldiers: defStart,
    attackerLosses: attLosses,
    defenderLosses: defLosses,
    rounds: actualRounds,
    log,
    attackerGenId: attGen?.id ?? null,
    defenderGenId: defGen?.id ?? null,
    attackerSpeed: attGen?.speed ?? 1,
    territoryCaptured: 0,   // filled in by turnEngine after land capture
  };
}
