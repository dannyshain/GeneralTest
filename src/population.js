// src/population.js
import { CONFIG } from './config.js';

// Maximum population this country can support given territory and science.
export function densityCap(country) {
  const perUnit = CONFIG.BASE_DENSITY_CAP
    + (country.science.populationDensity - 1) * CONFIG.DENSITY_SCIENCE_MULTIPLIER;
  return Math.floor(country.territory * perUnit);
}

// Raw growth this turn (before density cap).
function rawGrowth(country) {
  const rate = CONFIG.BASE_GROWTH_RATE
    + (country.science.populationGrowth - 1) * CONFIG.GROWTH_SCIENCE_MULTIPLIER;
  return Math.floor(country.population * rate);
}

// Apply population growth; new people become farmers.
export function applyPopulationGrowth(country) {
  const cap = densityCap(country);
  const room = Math.max(0, cap - country.population);
  const growth = Math.min(rawGrowth(country), room);
  country.population += growth;
  country.farmers += growth;
  return growth;
}

// Ensure farmers + scientists + soldiers === population.
// Farmers absorb any rounding slack.
export function validateAllocation(country) {
  const nonFarmer = country.scientists + country.soldiers;
  country.farmers = Math.max(0, country.population - nonFarmer);
  if (country.farmers === 0 && nonFarmer > country.population) {
    // Over-allocated non-farmers: trim soldiers first, then scientists
    const excess = nonFarmer - country.population;
    const soldierCut = Math.min(excess, country.soldiers);
    country.soldiers -= soldierCut;
    const remaining = excess - soldierCut;
    country.scientists = Math.max(0, country.scientists - remaining);
    country.farmers = country.population - country.scientists - country.soldiers;
  }
}

// Apply the population reallocation orders for one country.
// Orders specify desired target counts; we clamp and validate.
export function applyPopulationOrders(country) {
  const o = country.orders;
  if (o.farmers === null && o.scientists === null && o.soldiers === null) return;

  const pop = country.population;

  // Accept whatever the player set; clamp negatives
  let soldiers  = Math.max(0, o.soldiers  ?? country.soldiers);
  let scientists = Math.max(0, o.scientists ?? country.scientists);
  let farmers   = Math.max(0, o.farmers   ?? country.farmers);

  // If they over-allocate, scale down non-farmer roles proportionally
  const nonFarmer = soldiers + scientists;
  if (nonFarmer > pop) {
    const scale = pop / nonFarmer;
    soldiers   = Math.floor(soldiers   * scale);
    scientists = Math.floor(scientists * scale);
  }

  country.soldiers   = soldiers;
  country.scientists = scientists;
  country.farmers    = pop - soldiers - scientists;
}
