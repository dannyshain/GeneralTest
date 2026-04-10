// src/hostility.js
import { CONFIG } from './config.js';

export function getHostility(state, fromId, towardId) {
  return state.hostility[fromId]?.[towardId] ?? 0;
}

function addHostility(state, fromId, towardId, amount) {
  if (!state.hostility[fromId]) state.hostility[fromId] = {};
  state.hostility[fromId][towardId] = Math.min(
    CONFIG.HOSTILITY_MAX,
    (state.hostility[fromId][towardId] ?? CONFIG.HOSTILITY_STARTING) + amount
  );
}

// Called when attackerCountryId attacks defenderCountryId.
export function recordAttack(state, attackerCountryId, defenderCountryId) {
  // Defender becomes more hostile toward attacker
  addHostility(state, defenderCountryId, attackerCountryId, CONFIG.HOSTILITY_ON_ATTACK);
  // Slight mutual increase (reputational effect)
  addHostility(state, attackerCountryId, defenderCountryId, CONFIG.HOSTILITY_ON_ATTACK * 0.3);
}

// Called when eliminatorId eliminates eliminatedId.
// All surviving countries grow more hostile toward the eliminator.
export function recordElimination(state, eliminatorId, eliminatedId) {
  for (const [id, country] of Object.entries(state.countries)) {
    if (id === eliminatorId || id === eliminatedId) continue;
    if (country.isEliminated) continue;
    addHostility(state, id, eliminatorId, CONFIG.HOSTILITY_ON_ELIMINATION);
  }
}

// Natural hostility decay each turn.
export function decayHostility(state) {
  for (const fromId of Object.keys(state.hostility)) {
    for (const towardId of Object.keys(state.hostility[fromId])) {
      state.hostility[fromId][towardId] = Math.max(
        CONFIG.HOSTILITY_MIN,
        state.hostility[fromId][towardId] - CONFIG.HOSTILITY_DECAY_PER_TURN
      );
    }
  }
}
