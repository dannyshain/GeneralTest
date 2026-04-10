// src/gameState.js
import { CONFIG } from './config.js';

export function createInitialState(humanPlayerIndex, countryCount) {
  return {
    turn: 1,
    maxTurns: CONFIG.MAX_TURNS,
    phase: 'orders',   // 'orders' | 'resolution' | 'postgame'
    humanCountryId: `country_${humanPlayerIndex}`,
    countryCount,

    countries: {},     // populated by mapGen
    hostility: {},     // hostility[idA][idB] = 0–100
    eliminations: {},  // eliminations[countryId] = count of countries eliminated

    mapWidth: CONFIG.MAP_WIDTH,
    mapHeight: CONFIG.MAP_HEIGHT,

    battleLogs: [],    // BattleResult[] from current turn
    eventLog: [],      // string[] of general turn events

    winner: null,
    finalScores: null,
    yearlyHistory: [], // snapshot per turn for postgame review
  };
}

export function createCountry(id, name, color, x, y, territory, isHuman, personality) {
  return {
    id,
    name,
    color,
    isHuman,
    isEliminated: false,
    isSurrendered: false,

    // Map centroid (used for rendering and angle calculations)
    x,
    y,
    territory,

    // borders[neighborId] = { weight: number, angle: number }
    // angle = degrees from THIS country toward that neighbor (0=N, 90=E, 180=S, 270=W)
    borders: {},

    // Population pools
    population: CONFIG.STARTING_POPULATION,
    farmers: CONFIG.STARTING_POPULATION,
    scientists: 0,
    soldiers: 0,         // unassigned garrison

    // Economy
    money: CONFIG.STARTING_MONEY,

    // Science levels (each starts at 1)
    science: {
      populationGrowth: 1,
      populationDensity: 1,
      militaryStrength: 1,
      scientificEfficiency: 1,
      grainProduction: 1,
      grainValue: 1,
    },

    // Accumulated research progress toward next level
    scienceProgress: {
      populationGrowth: 0,
      populationDensity: 0,
      militaryStrength: 0,
      scientificEfficiency: 0,
      grainProduction: 0,
      grainValue: 0,
    },

    // Scientist assignments this turn (number per area, must sum ≤ scientists)
    scienceAllocation: {
      populationGrowth: 0,
      populationDensity: 0,
      militaryStrength: 0,
      scientificEfficiency: 0,
      grainProduction: 0,
      grainValue: 0,
    },

    generals: [],  // General[]

    // AI personality (null for human player)
    personality,

    // Orders submitted this turn (set by player or AI before resolution)
    orders: {
      farmers: null,       // target farmer count
      scientists: null,    // target scientist count
      soldiers: null,      // target soldier count
      scienceAllocation: null,   // { area: numScientists }
      generalOrders: [],         // [{ generalId, action, targetCountryId, soldiers }]
      recruitGeneral: null,      // { age, skill, speed } or null
    },
  };
}

export function createGeneral(id, countryId, name, age, skill, speed) {
  return {
    id,
    countryId,
    name,
    age,
    skill: Math.min(CONFIG.GENERAL_MAX_SKILL, skill),
    speed,
    energy: CONFIG.GENERAL_STARTING_ENERGY,
    morale: CONFIG.GENERAL_STARTING_MORALE,
    action: null,           // 'attack' | 'defend' | 'rest' | 'study' | null
    targetCountryId: null,
    assignedSoldiers: 0,
    battlesThisTurn: 0,
  };
}

export function getActiveCountries(state) {
  return Object.values(state.countries).filter(c => !c.isEliminated);
}

export function getNeighborIds(country) {
  return Object.keys(country.borders);
}

export function areAdjacent(countryA, countryB) {
  return countryB.id in countryA.borders;
}
