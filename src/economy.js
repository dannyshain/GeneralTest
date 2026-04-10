// src/economy.js
import { CONFIG } from './config.js';

export function grainProdMultiplier(country) {
  return 1 + (country.science.grainProduction - 1) * CONFIG.GRAIN_PROD_SCIENCE_MULT;
}

export function grainValueMultiplier(country) {
  return 1 + (country.science.grainValue - 1) * CONFIG.GRAIN_VALUE_SCIENCE_MULT;
}

// Grain harvested this turn
export function calcGrain(country) {
  return Math.floor(country.farmers * CONFIG.BASE_GRAIN_PER_FARMER * grainProdMultiplier(country));
}

// Money earned from grain
export function calcMoneyFromGrain(grain, country) {
  return Math.floor(grain * CONFIG.BASE_GRAIN_VALUE * grainValueMultiplier(country));
}

// Run the economic phase for one country; adds money to treasury.
export function processEconomy(country) {
  const grain = calcGrain(country);
  const income = calcMoneyFromGrain(grain, country);
  country.money += income;
  return { grain, income };
}

// Recruitment cost formula.
// Younger, more skilled, faster generals cost more.
export function generalRecruitCost(age, skill, speed) {
  return (
    CONFIG.GENERAL_RECRUIT_BASE_COST
    + (60 - age)  * CONFIG.GENERAL_RECRUIT_AGE_FACTOR
    + skill       * CONFIG.GENERAL_RECRUIT_SKILL_FACTOR
    + speed       * CONFIG.GENERAL_RECRUIT_SPEED_FACTOR
  );
}
