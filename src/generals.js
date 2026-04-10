// src/generals.js
import { CONFIG } from './config.js';
import { createGeneral } from './gameState.js';
import { generalRecruitCost } from './economy.js';

// ── Name pool ──────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Arthur','Bernard','Claude','Douglas','Edmund','Frederick','George',
  'Harold','Ivan','James','Karl','Leonard','Marcus','Nathan','Oliver',
  'Patrick','Roland','Stefan','Thomas','Ulric','Victor','Wilhelm',
  'Xavier','Yuri','Alaric','Brennan','Cassius','Dorian','Evander',
];
const LAST_NAMES = [
  'Stone','Vale','Cross','Hart','Marsh','Drake','Vance','Ward','Kent',
  'Hale','Fox','Grey','Reid','Shaw','Crane','Ash','Gore','Lowe','Penn',
  'Quinn','Stark','Mace','Byrne','Finch','Glover','Holt','Irwin','Judd',
];

let _counter = 0;

function randomName() {
  const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${f} ${l}`;
}

// ── Recruitment ────────────────────────────────────────────────────

// Attempt to recruit a general with chosen attributes.
// Returns the new General object on success, or null if country can't afford it.
export function recruitGeneral(country, age, skill, speed) {
  // Clamp inputs to legal ranges
  age   = Math.max(20, Math.min(60, age));
  skill = Math.max(1,  Math.min(30, skill));
  speed = Math.max(1,  Math.min(99, speed));

  const cost = generalRecruitCost(age, skill, speed);
  if (country.money < cost) return null;

  country.money -= cost;
  const id  = `gen_${country.id}_${_counter++}`;
  const gen = createGeneral(id, country.id, randomName(), age, skill, speed);
  country.generals.push(gen);
  return gen;
}

// ── Action resolution (non-battle) ────────────────────────────────

// Apply energy/skill changes for the action this general took,
// excluding the attack energy cost (handled in combat) and
// defend-battle costs (also handled in combat).
export function processGeneralAction(gen) {
  switch (gen.action) {
    case 'rest':
      gen.energy = Math.min(CONFIG.GENERAL_MAX_ENERGY,
        gen.energy + CONFIG.GENERAL_REST_ENERGY_GAIN);
      break;
    case 'study':
      gen.skill = Math.min(CONFIG.GENERAL_MAX_SKILL,
        gen.skill + CONFIG.GENERAL_STUDY_SKILL_GAIN);
      break;
    case 'defend':
      // Stance cost (battle costs applied separately per engagement)
      gen.energy = Math.max(0, gen.energy - CONFIG.GENERAL_DEFEND_STANCE_COST);
      break;
    case 'attack':
      gen.energy = Math.max(0, gen.energy - CONFIG.GENERAL_ATTACK_ENERGY_COST);
      break;
    default:
      break;
  }
}

// ── Skill gain from battle ─────────────────────────────────────────

export function grantBattleSkillGain(gen, rounds) {
  let gain;
  if (rounds < 5)       gain = CONFIG.SKILL_GAIN_SHORT_BATTLE;
  else if (rounds < 16) gain = CONFIG.SKILL_GAIN_MEDIUM_BATTLE;
  else                  gain = CONFIG.SKILL_GAIN_LONG_BATTLE;

  gen.skill = Math.min(CONFIG.GENERAL_MAX_SKILL, gen.skill + gain);
  return gain;
}

// ── Aging and death ────────────────────────────────────────────────

// Age all generals by one year; remove those who die. Returns log messages.
export function ageGenerals(country) {
  const messages = [];
  const survivors = [];

  for (const gen of country.generals) {
    gen.age++;
    if (gen.age >= CONFIG.GENERAL_DEATH_AGE_THRESHOLD) {
      const deathChance =
        (gen.age - CONFIG.GENERAL_DEATH_AGE_THRESHOLD) * CONFIG.GENERAL_DEATH_RATE_PER_YEAR;
      if (Math.random() < deathChance) {
        messages.push(
          `General ${gen.name} of ${country.name} has died at age ${gen.age}.`
        );
        continue; // do not add to survivors
      }
    }
    survivors.push(gen);
  }

  country.generals = survivors;
  return messages;
}

// ── Utility ───────────────────────────────────────────────────────

export function getGeneralById(country, id) {
  return country.generals.find(g => g.id === id) ?? null;
}
