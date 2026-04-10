// src/scoring.js
import { CONFIG } from './config.js';
import { totalScienceScore } from './science.js';
import { getActiveCountries } from './gameState.js';

// Raw score for a single country (0–1000 scale).
export function calcScore(country, state) {
  const elimCount = state.eliminations[country.id] ?? 0;

  const territoryScore = Math.min(1, country.territory / CONFIG.SCORE_TERRITORY_BASE);
  const popScore       = Math.min(1, country.population / CONFIG.SCORE_POPULATION_BASE);
  const sciScore       = Math.min(1, totalScienceScore(country) / CONFIG.SCORE_SCIENCE_MAX);

  const base =
    CONFIG.SCORE_TERRITORY_WEIGHT * territoryScore
    + CONFIG.SCORE_POPULATION_WEIGHT * popScore
    + CONFIG.SCORE_SCIENCE_WEIGHT * sciScore;

  const elimBonus = 1 + elimCount * CONFIG.SCORE_ELIMINATION_BONUS;

  return Math.round(base * elimBonus * 1000);
}

// Compute final scores for all surviving countries.
export function calcFinalScores(state) {
  const scores = {};
  for (const country of getActiveCountries(state)) {
    scores[country.id] = calcScore(country, state);
  }
  return scores;
}

// Snapshot per-country stats for the postgame history viewer.
export function snapshotYear(state) {
  const snapshot = { turn: state.turn, countries: {} };
  for (const [id, c] of Object.entries(state.countries)) {
    snapshot.countries[id] = {
      population: c.population,
      territory:  c.territory,
      soldiers:   c.soldiers,
      farmers:    c.farmers,
      scientists: c.scientists,
      money:      c.money,
      science:    { ...c.science },
      generals:   c.generals.length,
      isEliminated: c.isEliminated,
    };
  }
  state.yearlyHistory.push(snapshot);
}

// Check win conditions; mutates state.phase / state.winner / state.finalScores if game over.
// Returns true if the game has ended.
export function checkVictory(state) {
  const active = getActiveCountries(state);

  if (active.length === 1) {
    state.winner      = active[0].id;
    state.phase       = 'postgame';
    state.finalScores = calcFinalScores(state);
    return true;
  }

  if (state.turn > state.maxTurns) {
    state.finalScores = calcFinalScores(state);
    const sorted = Object.entries(state.finalScores).sort((a, b) => b[1] - a[1]);
    state.winner = sorted[0][0];
    state.phase  = 'postgame';
    return true;
  }

  return false;
}
