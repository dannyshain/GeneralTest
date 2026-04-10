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
  STARTING_MONEY: 60,           // [TUNABLE] seed money — enough to recruit one mid-tier general turn 1
  STARTING_TERRITORY: 100,      // base territory per country; slight variance applied in mapGen
  STARTING_BORDER_WEIGHT: 20,   // [TUNABLE] default border weight between adjacent countries

  // ── Population ────────────────────────────────────────────────
  // newPop = currentPop + floor(currentPop * growthRate * growthSciMult)
  // capped at floor(territory * densityCap * densitySciMult)
  BASE_GROWTH_RATE: 0.02,             // [TUNABLE] 2% per year base
  GROWTH_SCIENCE_MULTIPLIER: 0.015,   // [TUNABLE] each Pop Growth level adds 1.5% growth rate
  BASE_DENSITY_CAP: 12,               // [TUNABLE] people per territory unit at science level 1
  DENSITY_SCIENCE_MULTIPLIER: 2,      // [TUNABLE] each Pop Density level adds 2 people per territory unit

  // Cost to train civilians
  TRAIN_SOLDIER_COST: 5,    // [TUNABLE] money per civilian trained as soldier
  TRAIN_SCIENTIST_COST: 8,  // [TUNABLE] money per civilian trained as scientist

  // ── Economy ───────────────────────────────────────────────────
  // income = floor(farmers * BASE_GRAIN_PER_FARMER * grainProdMult * BASE_GRAIN_VALUE * grainValMult)
  BASE_GRAIN_PER_FARMER: 2,         // [TUNABLE]
  GRAIN_PROD_SCIENCE_MULT: 0.3,     // [TUNABLE] each Grain Production level adds 30%
  BASE_GRAIN_VALUE: 1,              // [TUNABLE] base money per grain unit
  GRAIN_VALUE_SCIENCE_MULT: 0.25,   // [TUNABLE] each Grain Value level adds 25%

  // ── Science ───────────────────────────────────────────────────
  BASE_RESEARCH_PER_SCIENTIST: 1,       // [TUNABLE] research points per scientist per turn (before efficiency bonus)
  SCI_EFFICIENCY_MULT: 0.2,             // [TUNABLE] each Sci Efficiency level adds 20% to research output
  SCIENCE_BASE_THRESHOLD: 50,           // [TUNABLE] points needed to reach level 2
  SCIENCE_LEVEL_SCALING: 2.0,           // [TUNABLE] each level requires this multiple more than the previous
  SCIENCE_MAX_LEVEL: 10,                // cap on any science level

  // ── Generals ──────────────────────────────────────────────────
  GENERAL_STARTING_ENERGY: 100,
  GENERAL_STARTING_MORALE: 60,
  GENERAL_MAX_ENERGY: 100,
  GENERAL_MAX_MORALE: 100,
  GENERAL_MAX_SKILL: 100,

  // Recruitment cost = BASE + (60 - age) * AGE_FACTOR + skill * SKILL_FACTOR + speed * SPEED_FACTOR
  GENERAL_RECRUIT_BASE_COST: 20,      // [TUNABLE]
  GENERAL_RECRUIT_AGE_FACTOR: 3,      // [TUNABLE] younger generals cost more
  GENERAL_RECRUIT_SKILL_FACTOR: 4,    // [TUNABLE]
  GENERAL_RECRUIT_SPEED_FACTOR: 2,    // [TUNABLE]

  // General action energy costs / gains
  GENERAL_ATTACK_ENERGY_COST: 10,
  GENERAL_DEFEND_STANCE_COST: 3,
  GENERAL_DEFEND_BATTLE_COST: 10,   // additional per battle defended
  GENERAL_REST_ENERGY_GAIN: 5,
  GENERAL_STUDY_SKILL_GAIN: 3,

  // Aging
  GENERAL_DEATH_AGE_THRESHOLD: 60,
  GENERAL_DEATH_RATE_PER_YEAR: 0.04, // [TUNABLE] each year over 60 adds 4% death chance

  // Skill gain from battle
  SKILL_GAIN_SHORT_BATTLE: 1,    // [TUNABLE] < 5 rounds
  SKILL_GAIN_MEDIUM_BATTLE: 3,   // [TUNABLE] 5–15 rounds
  SKILL_GAIN_LONG_BATTLE: 7,     // [TUNABLE] 16–25 rounds

  // ── Combat ────────────────────────────────────────────────────
  MAX_BATTLE_ROUNDS: 25,

  // power = soldiers * milSciMult * skillMult * moraleMult * energyMult * [defenseBonus]
  MIL_SCIENCE_BASE: 1.0,
  MIL_SCIENCE_MULT: 0.15,       // [TUNABLE] each Military Strength level adds 15%
  SKILL_COMBAT_MULT: 0.01,      // [TUNABLE] 1% per skill point (skill 70 → 1.7x)
  DEFENSE_DIG_IN_BONUS: 1.5,    // [TUNABLE] defender bonus when set to Defend stance

  // Morale effect: moraleMult = MIN + (morale/100) * (MAX - MIN)
  MORALE_POWER_MIN: 0.7,   // [TUNABLE]
  MORALE_POWER_MAX: 1.3,   // [TUNABLE]

  // Energy effect: energyMult = MIN + (energy/100) * (MAX - MIN)
  ENERGY_POWER_MIN: 0.5,   // [TUNABLE]
  ENERGY_POWER_MAX: 1.0,   // [TUNABLE]

  // Damage per round = floor(power * DAMAGE_FACTOR)
  DAMAGE_FACTOR: 0.3,      // [TUNABLE] scales lethality

  // Morale shifts: only when damage differential exceeds this fraction of loser's force
  MORALE_SHIFT_THRESHOLD: 0.15,  // [TUNABLE]
  MORALE_SHIFT_AMOUNT: 3,        // [TUNABLE] ±points per decisive round

  // ── Land Capture ──────────────────────────────────────────────
  // captured = floor((survivors / 100) * LAND_PER_100 * (1 + SPEED_FACTOR * speed))
  LAND_PER_100_SOLDIERS: 20,      // [TUNABLE]
  LAND_SPEED_FACTOR: 0.02,        // [TUNABLE] +2% per speed point

  // Border weight system
  BORDER_TRANSFER_RATE: 0.4,      // [TUNABLE] fraction of lost border that transfers to attacker
  BORDER_THRESHOLD: 2.0,          // [TUNABLE] minimum weight to maintain adjacency

  // ── Hostility ─────────────────────────────────────────────────
  HOSTILITY_STARTING: 5,
  HOSTILITY_ON_ATTACK: 15,           // [TUNABLE]
  HOSTILITY_ON_ELIMINATION: 25,      // [TUNABLE] world anger toward eliminator
  HOSTILITY_DECAY_PER_TURN: 2,       // [TUNABLE]
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
  SCORE_ELIMINATION_BONUS: 0.05,  // +5% total score per eliminated country

  // Reference values for score normalization (represents "high end" of expected range)
  SCORE_TERRITORY_BASE: 300,
  SCORE_POPULATION_BASE: 8000,
  SCORE_SCIENCE_MAX: 60,          // 6 areas × max level 10
};
