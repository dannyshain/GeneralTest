// src/config.js
// All TUNABLE constants live here. Adjust these to balance the game.
// Values marked [TUNABLE] are the primary balance levers.

export const CONFIG = {

  // ── Game Structure ─────────────────────────────────────────────
  MAX_TURNS: 120,
  MAP_WIDTH: 960,
  MAP_HEIGHT: 620,

  // ── Starting Conditions ────────────────────────────────────────
  STARTING_POPULATION: 1000,
  STARTING_MONEY: 30,           // [TUNABLE] modest seed money
  STARTING_TERRITORY: 100,
  STARTING_BORDER_WEIGHT: 20,
  STARTING_GRAIN: 50,           // [TUNABLE] small grain buffer on turn 1

  // ── Population ────────────────────────────────────────────────
  BASE_GROWTH_RATE: 0.02,
  GROWTH_SCIENCE_MULTIPLIER: 0.015,
  BASE_DENSITY_CAP: 12,
  DENSITY_SCIENCE_MULTIPLIER: 2,

  // ── Economy — Grain ───────────────────────────────────────────
  // Farmers harvest grain; population consumes grain; surplus sold for money.

  BASE_GRAIN_PER_FARMER: 3,           // [TUNABLE] grain produced per farmer per harvest
  GRAIN_PROD_SCIENCE_MULT: 0.3,       // [TUNABLE] each Grain Production level adds 30%
  FOOD_PER_PERSON: 1.0,               // [TUNABLE] grain consumed per person per turn (all roles)
  BASE_GRAIN_VALUE: 0.05,             // [TUNABLE] money per grain unit when sold
  GRAIN_VALUE_SCIENCE_MULT: 0.25,     // [TUNABLE] each Grain Value level adds 25%

  // Training costs (one-time, paid immediately from treasury)
  TRAIN_SOLDIER_COST: 10,             // [TUNABLE] money per farmer trained as soldier
  TRAIN_SCIENTIST_COST: 12,           // [TUNABLE] money per farmer trained as scientist

  // Upkeep (paid each turn from treasury; failure = desertion back to farmers)
  SOLDIER_UPKEEP: 0.5,                // [TUNABLE] money per soldier per turn
  SCIENTIST_UPKEEP: 0.5,              // [TUNABLE] money per scientist per turn

  // ── Science ───────────────────────────────────────────────────
  BASE_RESEARCH_PER_SCIENTIST: 1,
  SCI_EFFICIENCY_MULT: 0.2,
  SCIENCE_BASE_THRESHOLD: 50,
  SCIENCE_LEVEL_SCALING: 2.0,
  SCIENCE_MAX_LEVEL: 10,

  // ── Generals ──────────────────────────────────────────────────
  GENERAL_STARTING_ENERGY: 100,
  GENERAL_STARTING_MORALE: 60,
  GENERAL_MAX_ENERGY: 100,
  GENERAL_MAX_MORALE: 100,
  GENERAL_MAX_SKILL: 100,

  // Recruitment cost = BASE + (60 - age) * AGE_FACTOR + skill * SKILL_FACTOR + speed * SPEED_FACTOR
  GENERAL_RECRUIT_BASE_COST: 10,      // [TUNABLE]
  GENERAL_RECRUIT_AGE_FACTOR: 1.5,    // [TUNABLE]
  GENERAL_RECRUIT_SKILL_FACTOR: 2,    // [TUNABLE]
  GENERAL_RECRUIT_SPEED_FACTOR: 0.5,  // [TUNABLE]

  // General action energy
  GENERAL_ATTACK_ENERGY_COST: 10,
  GENERAL_DEFEND_STANCE_COST: 3,
  GENERAL_DEFEND_BATTLE_COST: 10,
  GENERAL_REST_ENERGY_GAIN: 5,
  GENERAL_STUDY_SKILL_GAIN: 3,

  // Aging
  GENERAL_DEATH_AGE_THRESHOLD: 60,
  GENERAL_DEATH_RATE_PER_YEAR: 0.04,

  // Skill gain from battle
  SKILL_GAIN_SHORT_BATTLE: 1,
  SKILL_GAIN_MEDIUM_BATTLE: 3,
  SKILL_GAIN_LONG_BATTLE: 7,

  // ── Combat ────────────────────────────────────────────────────
  MAX_BATTLE_ROUNDS: 25,

  MIL_SCIENCE_BASE: 1.0,
  MIL_SCIENCE_MULT: 0.15,
  SKILL_COMBAT_MULT: 0.01,
  DEFENSE_DIG_IN_BONUS: 1.5,

  MORALE_POWER_MIN: 0.7,
  MORALE_POWER_MAX: 1.3,
  ENERGY_POWER_MIN: 0.5,
  ENERGY_POWER_MAX: 1.0,

  DAMAGE_FACTOR: 0.3,

  MORALE_SHIFT_THRESHOLD: 0.15,
  MORALE_SHIFT_AMOUNT: 3,

  // ── Land Capture ──────────────────────────────────────────────
  // Formula: floor(SCALE * ln(1 + survivors / DIVISOR) * speedMult)
  // ~100 survivors at average speed → ~9–10 territory (≈10% of starting 100)
  // Diminishing returns: 500 survivors → ~20 territory, not 50.
  LAND_CAPTURE_SCALE: 12,             // [TUNABLE] overall capture magnitude
  LAND_CAPTURE_DIVISOR: 100,          // [TUNABLE] controls diminishing-returns curve
  LAND_SPEED_FACTOR: 0.003,           // [TUNABLE] speed bonus (+0.3% per speed point; speed 50 → +15%)
  LAND_CAPTURE_MAX_FRACTION: 0.35,    // [TUNABLE] max fraction of defender's territory per battle

  // Border weight system
  BORDER_TRANSFER_RATE: 0.4,
  BORDER_THRESHOLD: 2.0,

  // ── Hostility ─────────────────────────────────────────────────
  HOSTILITY_STARTING: 5,
  HOSTILITY_ON_ATTACK: 15,
  HOSTILITY_ON_ELIMINATION: 25,
  HOSTILITY_DECAY_PER_TURN: 2,
  HOSTILITY_MAX: 100,
  HOSTILITY_MIN: 0,

  // ── AI ────────────────────────────────────────────────────────
  AI_AGGRESSION_RANGE: [0.1, 0.9],
  AI_CAUTION_RANGE: [0.1, 0.9],
  AI_SCIENCE_FOCUS_RANGE: [0.1, 0.9],
  AI_EXPANSIONISM_RANGE: [0.1, 0.9],

  // ── Scoring ───────────────────────────────────────────────────
  SCORE_TERRITORY_WEIGHT: 0.50,
  SCORE_POPULATION_WEIGHT: 0.30,
  SCORE_SCIENCE_WEIGHT: 0.20,
  SCORE_ELIMINATION_BONUS: 0.05,

  SCORE_TERRITORY_BASE: 300,
  SCORE_POPULATION_BASE: 8000,
  SCORE_SCIENCE_MAX: 60,
};
