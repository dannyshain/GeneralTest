// src/combat.js
import { CONFIG } from './config.js';
import { battleOpener, roundSummary, battleOutcomeText } from './flavorText.js';
import { grantBattleSkillGain } from './generals.js';

// ── Power formula ──────────────────────────────────────────────────
// power = soldiers × milSciMult × skillMult × moraleMult × energyMult × [defBonus]

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
    : 0.8;  // no general → tired garrison baseline

  const defBonus = digIn ? CONFIG.DEFENSE_DIG_IN_BONUS : 1.0;

  return soldiers * milSciMult * skillMult * moraleMult * energyMult * defBonus;
}

// Damage dealt this round (numeric, not percentage).
function calcDamage(attackerPower) {
  return Math.max(1, Math.floor(attackerPower * CONFIG.DAMAGE_FACTOR));
}

// ── Morale shifts ──────────────────────────────────────────────────

function shiftMorale(loserGen, winnerGen, damageTaken, loserSoldiersBefore) {
  if (loserSoldiersBefore <= 0) return;
  const ratio = damageTaken / loserSoldiersBefore;
  if (ratio > CONFIG.MORALE_SHIFT_THRESHOLD) {
    if (loserGen) {
      loserGen.morale = Math.max(CONFIG.HOSTILITY_MIN,
        loserGen.morale - CONFIG.MORALE_SHIFT_AMOUNT);
    }
    if (winnerGen) {
      winnerGen.morale = Math.min(CONFIG.GENERAL_MAX_MORALE,
        winnerGen.morale + CONFIG.MORALE_SHIFT_AMOUNT);
    }
  }
}

// ── Main battle resolver ───────────────────────────────────────────

/**
 * Resolve a single battle.
 *
 * @param {object} state        - full game state
 * @param {string} attCountryId
 * @param {string} defCountryId
 * @param {string|null} attGenId   - id of attacking general (null = no general)
 * @param {number} attSoldiers     - soldiers committed to this attack
 * @param {boolean} isOpenField    - true when both sides are attacking each other (no dig-in)
 * @returns {BattleResult}
 */
export function resolveBattle(state, attCountryId, defCountryId, attGenId, attSoldiers, isOpenField) {
  const attCountry = state.countries[attCountryId];
  const defCountry = state.countries[defCountryId];

  const attGen = attGenId
    ? attCountry.generals.find(g => g.id === attGenId) ?? null
    : null;

  // Defender uses whatever general is set to 'defend', else first available
  const defGen = defCountry.generals.find(g => g.action === 'defend')
    ?? defCountry.generals[0]
    ?? null;

  const digIn = !isOpenField && defGen?.action === 'defend';

  // Attacker commits their chosen soldiers; defender commits full garrison
  let att = Math.min(attSoldiers, attCountry.soldiers);
  let def = defCountry.soldiers;

  const log = [battleOpener(attCountry, defCountry, attGen, defGen, digIn)];

  let round = 0;
  let result = 'stalemate';

  for (round = 1; round <= CONFIG.MAX_BATTLE_ROUNDS; round++) {
    if (att <= 0 || def <= 0) break;

    const attPow = combatPower(att, attCountry, attGen, false);
    const defPow = combatPower(def, defCountry, defGen, digIn);

    const attDeals = calcDamage(attPow);
    const defDeals = calcDamage(defPow);

    const attBefore = att;
    const defBefore = def;

    def = Math.max(0, def - attDeals);
    att = Math.max(0, att - defDeals);

    // Determine round narrative outcome
    const attRatio = attBefore > 0 ? defDeals / attBefore : 0;
    const defRatio = defBefore > 0 ? attDeals / defBefore : 0;

    if (defRatio > CONFIG.MORALE_SHIFT_THRESHOLD && defRatio > attRatio + 0.05) {
      shiftMorale(defGen, attGen, attDeals, defBefore);
      log.push(roundSummary(attCountry, defCountry, 'attacker', round));
    } else if (attRatio > CONFIG.MORALE_SHIFT_THRESHOLD && attRatio > defRatio + 0.05) {
      shiftMorale(attGen, defGen, defDeals, attBefore);
      log.push(roundSummary(attCountry, defCountry, 'defender', round));
    } else {
      log.push(roundSummary(attCountry, defCountry, 'even', round));
    }
  }

  const actualRounds = round - 1;

  if (def <= 0 && att > 0)      result = 'attackerVictory';
  else if (att <= 0)             result = 'defenderVictory';
  else                           result = 'stalemate';

  log.push(battleOutcomeText(attCountry, defCountry, result, actualRounds));

  // ── Skill gains ────────────────────────────────────────────────
  if (attGen) grantBattleSkillGain(attGen, actualRounds);
  if (defGen) {
    grantBattleSkillGain(defGen, actualRounds);
    defGen.battlesThisTurn = (defGen.battlesThisTurn || 0) + 1;
    // Per-battle defend energy cost
    defGen.energy = Math.max(0, defGen.energy - CONFIG.GENERAL_DEFEND_BATTLE_COST);
  }

  // ── Apply soldier casualties to countries ──────────────────────
  const attLosses = Math.min(attSoldiers, attSoldiers - att);
  const defLosses = defCountry.soldiers - def;

  attCountry.soldiers = Math.max(0, attCountry.soldiers - attLosses);
  defCountry.soldiers = Math.max(0, defCountry.soldiers - defLosses);

  return {
    attackerCountryId: attCountryId,
    defenderCountryId: defCountryId,
    result,                       // 'attackerVictory' | 'defenderVictory' | 'stalemate'
    attackerSurvivors: att,
    defenderSurvivors: def,
    attackerLosses: attLosses,
    defenderLosses: defLosses,
    rounds: actualRounds,
    log,
    attackerGenId: attGen?.id ?? null,
    defenderGenId: defGen?.id ?? null,
    attackerSpeed: attGen?.speed ?? 1,
  };
}
