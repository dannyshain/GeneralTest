// src/economy.js
import { CONFIG } from './config.js';

// ── Multipliers ────────────────────────────────────────────────────

export function grainProdMultiplier(country) {
  return 1 + (country.science.grainProduction - 1) * CONFIG.GRAIN_PROD_SCIENCE_MULT;
}

export function grainValueMultiplier(country) {
  return 1 + (country.science.grainValue - 1) * CONFIG.GRAIN_VALUE_SCIENCE_MULT;
}

// ── Harvest ────────────────────────────────────────────────────────

// How much grain this country's farmers would produce if harvested now.
export function calcHarvestAmount(country) {
  return Math.floor(country.farmers * CONFIG.BASE_GRAIN_PER_FARMER * grainProdMultiplier(country));
}

// Execute the harvest: add grain to store, mark farmers as harvested.
// Safe to call multiple times (no-op if already harvested this turn).
export function harvestGrain(country) {
  if (country.harvestedThisTurn) return 0;
  const amount = calcHarvestAmount(country);
  country.grain += amount;
  country.harvestedThisTurn = true;
  return amount;
}

// ── Sell ───────────────────────────────────────────────────────────

// Money received per grain unit sold.
export function grainSellPrice(country) {
  return CONFIG.BASE_GRAIN_VALUE * grainValueMultiplier(country);
}

// Sell up to `amount` grain from store; returns money earned.
export function sellGrain(country, amount) {
  const actual = Math.min(amount, country.grain);
  if (actual <= 0) return 0;
  const earned = actual * grainSellPrice(country);
  country.grain -= actual;
  country.money += earned;
  return earned;
}

// ── Food upkeep ────────────────────────────────────────────────────

// Grain consumed by the entire population this turn.
export function calcFoodUpkeep(country) {
  return Math.ceil(country.population * CONFIG.FOOD_PER_PERSON);
}

// Process food consumption. If grain store is insufficient:
//   1. Auto-sell grain to cover deficit (if grain available).
//   2. If still short: population starves proportionally to deficit.
// Returns { grainConsumed, starved, autoSold }.
export function processFoodUpkeep(country) {
  const needed = calcFoodUpkeep(country);
  let grainConsumed = 0;
  let starved = 0;
  let autoSold = 0;

  if (country.grain >= needed) {
    // Normal: consume grain directly from store
    country.grain -= needed;
    grainConsumed = needed;
  } else {
    // Deficit: use all remaining grain, then starvation
    grainConsumed = country.grain;
    const deficit = needed - country.grain;
    country.grain = 0;

    // Starvation: lose population proportional to deficit
    // Each missing grain unit starves one person (capped at 20% pop per turn)
    starved = Math.min(deficit, Math.floor(country.population * 0.20));
    if (starved > 0) {
      // Remove from farmers first (they're the most numerous)
      const farmerStarved = Math.min(starved, country.farmers);
      country.farmers -= farmerStarved;
      let remaining = starved - farmerStarved;
      if (remaining > 0) {
        const soldierStarved = Math.min(remaining, country.soldiers);
        country.soldiers -= soldierStarved;
        remaining -= soldierStarved;
      }
      if (remaining > 0) {
        country.scientists = Math.max(0, country.scientists - remaining);
      }
      country.population -= starved;
    }
  }

  return { grainConsumed, starved, autoSold };
}

// ── Military and science upkeep ────────────────────────────────────

// Money owed for soldiers and scientists this turn.
export function calcMilitaryUpkeep(country) {
  return country.soldiers * CONFIG.SOLDIER_UPKEEP;
}

export function calcScienceUpkeep(country) {
  return country.scientists * CONFIG.SCIENTIST_UPKEEP;
}

// Pay upkeep. If treasury can't cover it, as many desert as can't be paid.
// Deserters return to farmers.
// Returns { soldierDesertions, scientistDesertions, moneySpent }.
export function processUpkeep(country) {
  const totalOwed = calcMilitaryUpkeep(country) + calcScienceUpkeep(country);
  let moneySpent = 0;
  let soldierDesertions = 0;
  let scientistDesertions = 0;

  if (country.money >= totalOwed) {
    country.money -= totalOwed;
    moneySpent = totalOwed;
  } else {
    // Can't pay full upkeep — pay what we can, prorate desertions
    const available = Math.max(0, country.money);
    country.money = 0;
    moneySpent = available;

    const shortfall = totalOwed - available;
    // Soldiers and scientists desert in proportion to their upkeep share
    const soldierOwed    = calcMilitaryUpkeep(country);
    const scientistOwed  = calcScienceUpkeep(country);

    let soldierShortfall = 0;
    if (soldierOwed > 0) {
      soldierShortfall = Math.min(shortfall, soldierOwed);
      soldierDesertions = Math.ceil(soldierShortfall / CONFIG.SOLDIER_UPKEEP);
      soldierDesertions = Math.min(soldierDesertions, country.soldiers);
      country.soldiers -= soldierDesertions;
      country.farmers  += soldierDesertions;
    }

    const remainingShortfall = Math.max(0, shortfall - soldierShortfall);
    if (scientistOwed > 0 && remainingShortfall > 0) {
      scientistDesertions = Math.ceil(remainingShortfall / CONFIG.SCIENTIST_UPKEEP);
      scientistDesertions = Math.min(scientistDesertions, country.scientists);
      country.scientists -= scientistDesertions;
      country.farmers    += scientistDesertions;
    }
  }

  country.population = country.farmers + country.scientists + country.soldiers;
  return { soldierDesertions, scientistDesertions, moneySpent };
}

// ── Training (immediate, called from UI) ───────────────────────────

// Train `count` farmers into soldiers. Returns how many were actually trained.
export function trainSoldiers(country, count) {
  const affordable  = Math.floor(country.money / CONFIG.TRAIN_SOLDIER_COST);
  const available   = country.farmers;
  const actual      = Math.min(count, affordable, available);
  if (actual <= 0) return 0;
  country.money    -= actual * CONFIG.TRAIN_SOLDIER_COST;
  country.farmers  -= actual;
  country.soldiers += actual;
  return actual;
}

// Train `count` farmers into scientists. Returns how many were actually trained.
export function trainScientists(country, count) {
  const affordable   = Math.floor(country.money / CONFIG.TRAIN_SCIENTIST_COST);
  const available    = country.farmers;
  const actual       = Math.min(count, affordable, available);
  if (actual <= 0) return 0;
  country.money     -= actual * CONFIG.TRAIN_SCIENTIST_COST;
  country.farmers   -= actual;
  country.scientists += actual;
  return actual;
}

// ── General recruitment cost ───────────────────────────────────────

export function generalRecruitCost(age, skill, speed) {
  return (
    CONFIG.GENERAL_RECRUIT_BASE_COST
    + (60 - age)  * CONFIG.GENERAL_RECRUIT_AGE_FACTOR
    + skill       * CONFIG.GENERAL_RECRUIT_SKILL_FACTOR
    + speed       * CONFIG.GENERAL_RECRUIT_SPEED_FACTOR
  );
}
