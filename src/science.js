// src/science.js
import { CONFIG } from './config.js';

export const SCIENCE_AREAS = [
  'populationGrowth',
  'populationDensity',
  'militaryStrength',
  'scientificEfficiency',
  'grainProduction',
  'grainValue',
];

export const SCIENCE_LABELS = {
  populationGrowth:     'Population Growth',
  populationDensity:    'Population Density',
  militaryStrength:     'Military Strength',
  scientificEfficiency: 'Scientific Efficiency',
  grainProduction:      'Grain Production',
  grainValue:           'Grain Value',
};

// Research points required to advance from (level) to (level + 1).
// threshold(2) = BASE, threshold(3) = BASE * SCALING, etc.
export function thresholdForNextLevel(currentLevel) {
  if (currentLevel >= CONFIG.SCIENCE_MAX_LEVEL) return Infinity;
  return Math.floor(
    CONFIG.SCIENCE_BASE_THRESHOLD
    * Math.pow(CONFIG.SCIENCE_LEVEL_SCALING, currentLevel - 1)
  );
}

// Research points produced per scientist per turn (boosted by Sci Efficiency).
export function researchPerScientist(country) {
  return CONFIG.BASE_RESEARCH_PER_SCIENTIST
    * (1 + (country.science.scientificEfficiency - 1) * CONFIG.SCI_EFFICIENCY_MULT);
}

// Validate that science allocation sums ≤ available scientists.
// Trims proportionally if over-allocated.
export function validateScienceAllocation(country) {
  const alloc = country.scienceAllocation;
  const total = SCIENCE_AREAS.reduce((s, a) => s + (alloc[a] || 0), 0);
  if (total > country.scientists && total > 0) {
    const scale = country.scientists / total;
    for (const area of SCIENCE_AREAS) {
      alloc[area] = Math.floor((alloc[area] || 0) * scale);
    }
  }
}

// Apply science allocation orders.
export function applyScienceOrders(country) {
  if (country.orders.scienceAllocation) {
    country.scienceAllocation = { ...country.orders.scienceAllocation };
  }
  validateScienceAllocation(country);
}

// Process research for one turn; returns array of level-up events.
export function processResearch(country) {
  const output = researchPerScientist(country);
  const levelUps = [];

  for (const area of SCIENCE_AREAS) {
    const assigned = country.scienceAllocation[area] || 0;
    if (assigned === 0) continue;
    if (country.science[area] >= CONFIG.SCIENCE_MAX_LEVEL) continue;

    country.scienceProgress[area] += assigned * output;

    // Check for one or more level-ups (rare but possible)
    let needed = thresholdForNextLevel(country.science[area]);
    while (
      country.scienceProgress[area] >= needed
      && country.science[area] < CONFIG.SCIENCE_MAX_LEVEL
    ) {
      country.science[area]++;
      country.scienceProgress[area] -= needed;
      levelUps.push({ area, newLevel: country.science[area] });
      needed = thresholdForNextLevel(country.science[area]);
    }
  }

  return levelUps;
}

// Sum of all science levels (used for scoring).
export function totalScienceScore(country) {
  return SCIENCE_AREAS.reduce((s, a) => s + country.science[a], 0);
}
