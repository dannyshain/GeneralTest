// src/ai.js
import { CONFIG } from './config.js';
import { getHostility } from './hostility.js';
import { SCIENCE_AREAS } from './science.js';

/**
 * Generate orders for one AI-controlled country.
 * Personality traits (all 0–1):
 *   aggression    – how willing to attack
 *   caution       – how willing to defend / hold back
 *   scienceFocus  – how much it prioritises research
 *   expansionism  – how much it prioritises territory and population cap
 */
export function generateAIOrders(state, countryId) {
  const country = state.countries[countryId];
  const p       = country.personality;
  const pop     = country.population;

  // ── Population allocation ─────────────────────────────────────
  const soldierRatio  = clamp(0.05 + p.aggression * 0.35, 0.05, 0.45);
  const scienceRatio  = clamp(0.05 + p.scienceFocus * 0.25, 0.05, 0.30);
  const farmerRatio   = Math.max(0.25, 1 - soldierRatio - scienceRatio);

  const soldiers   = Math.floor(pop * soldierRatio);
  const scientists = Math.floor(pop * scienceRatio);
  const farmers    = pop - soldiers - scientists;

  // ── Science allocation ────────────────────────────────────────
  const sciAlloc = {};
  for (const a of SCIENCE_AREAS) sciAlloc[a] = 0;

  if (scientists > 0) {
    const weights = {
      populationGrowth:     0.4 + p.expansionism * 0.4,
      populationDensity:    0.3 + p.expansionism * 0.3,
      militaryStrength:     0.3 + p.aggression   * 0.7,
      scientificEfficiency: 0.4 + p.scienceFocus * 0.7,
      grainProduction:      0.5,
      grainValue:           0.3 + p.scienceFocus * 0.3,
    };
    const totalW = SCIENCE_AREAS.reduce((s, a) => s + weights[a], 0);
    let rem = scientists;
    for (let i = 0; i < SCIENCE_AREAS.length - 1; i++) {
      const a = SCIENCE_AREAS[i];
      sciAlloc[a] = Math.floor(scientists * weights[a] / totalW);
      rem -= sciAlloc[a];
    }
    sciAlloc[SCIENCE_AREAS[SCIENCE_AREAS.length - 1]] = Math.max(0, rem);
  }

  // ── General recruitment ───────────────────────────────────────
  // No money check here — orders are generated before harvest/auto-sell,
  // so treasury is always low. The turnEngine checks affordability post-harvest.
  let recruitGeneral = null;
  if (country.generals.length === 0 && p.aggression > 0.25) {
    const age   = Math.floor(randBetween(28, 50));
    const skill = Math.floor(randBetween(8, 22));
    const speed = Math.floor(randBetween(25, 65));
    recruitGeneral = { age, skill, speed };
  }

  // ── General orders ────────────────────────────────────────────
  const generalOrders = [];

  for (const gen of country.generals) {
    // Rest if exhausted
    if (gen.energy < 15) {
      generalOrders.push({ generalId: gen.id, action: 'rest', targetCountryId: null, soldiers: 0 });
      continue;
    }

    // Occasionally study if skill is low and AI is science-focused
    if (gen.skill < 25 && p.scienceFocus > 0.5 && Math.random() < 0.25) {
      generalOrders.push({ generalId: gen.id, action: 'study', targetCountryId: null, soldiers: 0 });
      continue;
    }

    // Evaluate neighbours for attack
    const neighbours = Object.keys(country.borders)
      .map(nId => state.countries[nId])
      .filter(n => n && !n.isEliminated);

    // Score each neighbour by hostility and weakness
    const targets = neighbours.map(n => ({
      id:        n.id,
      hostility: getHostility(state, countryId, n.id),
      soldiers:  n.soldiers,
      territory: n.territory,
    })).sort((a, b) => b.hostility - a.hostility);

    const shouldAttack = p.aggression > 0.35
      && targets.length > 0
      && country.soldiers > 60
      && Math.random() < p.aggression;

    if (shouldAttack) {
      // Pick target: most hostile, preferring weaker foes
      const target = targets.find(t => t.soldiers < country.soldiers * 1.2) ?? targets[0];
      if (target) {
        const attackSoldiers = Math.floor(country.soldiers * clamp(0.4 + p.aggression * 0.4, 0.4, 0.85));
        generalOrders.push({
          generalId: gen.id,
          action: 'attack',
          targetCountryId: target.id,
          soldiers: attackSoldiers,
        });
        continue;
      }
    }

    // Default: defend
    generalOrders.push({ generalId: gen.id, action: 'defend', targetCountryId: null, soldiers: 0 });
  }

  return {
    farmers,
    scientists,
    soldiers,
    scienceAllocation: sciAlloc,
    generalOrders,
    recruitGeneral,
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function randBetween(a, b) { return a + Math.random() * (b - a); }
