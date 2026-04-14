// src/ui/hud.js
// Player control panel. Immediate actions (harvest, sell, train, recruit) mutate
// state directly and call onImmediateAction() to trigger a re-render.
// Deferred actions (science allocation, general orders) are collected and applied on End Turn.

import { CONFIG } from '../config.js';
import { SCIENCE_AREAS, SCIENCE_LABELS, thresholdForNextLevel } from '../science.js';
import { generalRecruitCost, harvestGrain, sellGrain, trainSoldiers, trainScientists, calcHarvestAmount, calcFoodUpkeep, calcMilitaryUpkeep, calcScienceUpkeep, grainSellPrice } from '../economy.js';
import { recruitGeneral } from '../generals.js';
import { densityCap } from '../population.js';

/**
 * Render the full HUD for the human player.
 *
 * @param {object}   state             - full game state (may be mutated by immediate actions)
 * @param {Element}  container         - DOM element to render into
 * @param {Function} onOrdersChange    - called with partial order object on deferred changes
 * @param {Function} onImmediateAction - called with no args after any immediate state mutation (triggers full re-render)
 * @param {Function} onEndTurn         - called when player clicks End Turn
 */
export function renderHUD(state, container, onOrdersChange, onImmediateAction, onEndTurn) {
  const humanId = state.humanCountryId;
  const country  = state.countries[humanId];
  if (!country) return;

  container.innerHTML = '';

  // ── Header ─────────────────────────────────────────────────────
  const header = div('hud-header');
  header.innerHTML =
    `<span class="hud-name" style="color:${country.color}">${country.name}</span>`
    + ` &nbsp; Year <strong>${state.turn}</strong> / ${state.maxTurns}`;
  container.appendChild(header);

  // ── Economy overview ───────────────────────────────────────────
  const cap          = densityCap(country);
  const harvestAmt   = calcHarvestAmount(country);
  const foodUpkeep   = calcFoodUpkeep(country);
  const milUpkeep    = calcMilitaryUpkeep(country);
  const sciUpkeep    = calcScienceUpkeep(country);
  const totalUpkeep  = milUpkeep + sciUpkeep;
  const sellPrice    = grainSellPrice(country).toFixed(3);

  const econ = div('hud-section econ-overview');
  econ.innerHTML =
    `<div class="econ-row"><span>Treasury</span><strong>${Math.floor(country.money)}</strong></div>`
  + `<div class="econ-row"><span>Grain stored</span><strong>${country.grain}</strong></div>`
  + `<div class="econ-row muted"><span>Harvest (if now)</span><span>${harvestAmt} grain</span></div>`
  + `<div class="econ-row muted"><span>Food consumed/turn</span><span>${foodUpkeep} grain</span></div>`
  + `<div class="econ-row muted"><span>Sell price</span><span>${sellPrice} /grain</span></div>`
  + `<div class="econ-row muted"><span>Upkeep (soldiers+sci)</span><span>${totalUpkeep.toFixed(1)}/turn</span></div>`;
  container.appendChild(econ);

  // ── Harvest button ─────────────────────────────────────────────
  container.appendChild(sectionHeader('Harvest & Sell'));
  const harvestSection = div('hud-section');

  if (country.harvestedThisTurn) {
    harvestSection.appendChild(muted('✓ Farmers have harvested this turn.'));
  } else {
    const harvestBtn = btn(`Harvest Grain (+${harvestAmt})`, () => {
      harvestGrain(country);
      onImmediateAction();
    });
    harvestBtn.className = 'action-btn harvest-btn';
    harvestSection.appendChild(harvestBtn);
    harvestSection.appendChild(muted('After harvesting, farmers cannot be retrained this turn.'));
  }

  // Sell grain controls
  const sellRow = div('sell-row');
  const sellInput = document.createElement('input');
  sellInput.type  = 'number';
  sellInput.min   = '0';
  sellInput.max   = String(country.grain);
  sellInput.value = '0';
  sellInput.style.width = '80px';
  sellInput.placeholder = '0';

  const sellBtn = btn('Sell', () => {
    const amount = Math.max(0, parseInt(sellInput.value) || 0);
    if (amount > 0) {
      sellGrain(country, amount);
      onImmediateAction();
    }
  });
  sellBtn.className = 'action-btn';

  const sellAllBtn = btn(`Sell All (${country.grain})`, () => {
    sellGrain(country, country.grain);
    onImmediateAction();
  });
  sellAllBtn.className = 'action-btn';

  sellRow.appendChild(elLabel('Sell: '));
  sellRow.appendChild(sellInput);
  sellRow.appendChild(sellBtn);
  sellRow.appendChild(sellAllBtn);
  harvestSection.appendChild(sellRow);
  container.appendChild(harvestSection);

  // ── Population summary ─────────────────────────────────────────
  container.appendChild(sectionHeader('Population'));
  const popSection = div('hud-section');
  popSection.innerHTML =
    `<div class="econ-row"><span>Total</span><strong>${country.population}</strong> / ${cap} cap</div>`
  + `<div class="econ-row"><span>Farmers</span><strong>${country.farmers}</strong></div>`
  + `<div class="econ-row"><span>Scientists</span><strong>${country.scientists}</strong></div>`
  + `<div class="econ-row"><span>Soldiers (garrison)</span><strong>${country.soldiers}</strong></div>`;
  container.appendChild(popSection);

  // ── Train soldiers ─────────────────────────────────────────────
  container.appendChild(sectionHeader('Train Soldiers'));
  const trainSolSection = div('hud-section');
  const maxSolAffordable = Math.floor(country.money / CONFIG.TRAIN_SOLDIER_COST);
  const maxSolFromFarmers = country.harvestedThisTurn ? 0 : country.farmers;

  trainSolSection.innerHTML =
    `<p class="muted">Cost: ${CONFIG.TRAIN_SOLDIER_COST} money each &nbsp;|&nbsp; `
  + `Can train: ${Math.min(maxSolAffordable, maxSolFromFarmers)}`
  + (country.harvestedThisTurn ? ' <em>(farmers already harvested)</em>' : '') + `</p>`;

  const trainSolRow = div('train-row');
  const trainSolInput = numInput(1, Math.max(1, Math.min(maxSolAffordable, maxSolFromFarmers)), 1);
  const trainSolBtn   = btn('Train', () => {
    const n = parseInt(trainSolInput.value) || 0;
    const trained = trainSoldiers(country, n);
    if (trained > 0) onImmediateAction();
  });
  trainSolBtn.className = 'action-btn';
  if (maxSolAffordable === 0 || maxSolFromFarmers === 0) trainSolBtn.disabled = true;

  trainSolRow.appendChild(trainSolInput);
  trainSolRow.appendChild(trainSolBtn);
  trainSolSection.appendChild(trainSolRow);
  container.appendChild(trainSolSection);

  // ── Train scientists ───────────────────────────────────────────
  container.appendChild(sectionHeader('Train Scientists'));
  const trainSciSection = div('hud-section');
  const maxSciAffordable  = Math.floor(country.money / CONFIG.TRAIN_SCIENTIST_COST);
  const maxSciFromFarmers = country.harvestedThisTurn ? 0 : country.farmers;

  trainSciSection.innerHTML =
    `<p class="muted">Cost: ${CONFIG.TRAIN_SCIENTIST_COST} money each &nbsp;|&nbsp; `
  + `Can train: ${Math.min(maxSciAffordable, maxSciFromFarmers)}`
  + (country.harvestedThisTurn ? ' <em>(farmers already harvested)</em>' : '') + `</p>`;

  const trainSciRow = div('train-row');
  const trainSciInput = numInput(1, Math.max(1, Math.min(maxSciAffordable, maxSciFromFarmers)), 1);
  const trainSciBtn   = btn('Train', () => {
    const n = parseInt(trainSciInput.value) || 0;
    const trained = trainScientists(country, n);
    if (trained > 0) onImmediateAction();
  });
  trainSciBtn.className = 'action-btn';
  if (maxSciAffordable === 0 || maxSciFromFarmers === 0) trainSciBtn.disabled = true;

  trainSciRow.appendChild(trainSciInput);
  trainSciRow.appendChild(trainSciBtn);
  trainSciSection.appendChild(trainSciRow);
  container.appendChild(trainSciSection);

  // ── Science allocation ─────────────────────────────────────────
  container.appendChild(sectionHeader(`Science  (${country.scientists} scientists)`));
  const sciSection = div('hud-section');

  const sciAlloc = { ...country.scienceAllocation };
  const sciTable = document.createElement('table');
  sciTable.className = 'alloc-table';
  sciTable.innerHTML = '<tr><th>Area</th><th>Lv</th><th>Next</th><th>Assigned</th></tr>';

  for (const area of SCIENCE_AREAS) {
    const lv       = country.science[area];
    const progress = country.scienceProgress[area];
    const needed   = thresholdForNextLevel(lv);
    const pct      = needed < Infinity ? Math.round((progress / needed) * 100) : 100;

    const tr      = document.createElement('tr');
    const inp     = numInput(0, country.scientists, sciAlloc[area] || 0);
    inp.style.width = '55px';
    inp.addEventListener('change', () => {
      sciAlloc[area] = Math.max(0, parseInt(inp.value) || 0);
      onOrdersChange({ scienceAllocation: { ...sciAlloc } });
    });

    tr.innerHTML =
      `<td>${SCIENCE_LABELS[area]}</td>`
    + `<td>${lv}</td>`
    + `<td>${lv >= CONFIG.SCIENCE_MAX_LEVEL ? 'max' : pct + '%'}</td>`;
    const td = document.createElement('td');
    td.appendChild(inp);
    tr.appendChild(td);
    sciTable.appendChild(tr);
  }

  sciSection.appendChild(sciTable);
  sciSection.appendChild(muted(`Upkeep: ${CONFIG.SCIENTIST_UPKEEP}/scientist/turn`));
  container.appendChild(sciSection);

  // ── Generals ───────────────────────────────────────────────────
  container.appendChild(sectionHeader('Generals'));
  const genSection = div('hud-section');

  const generalOrders = [];

  if (country.generals.length === 0) {
    genSection.appendChild(muted('No generals. Recruit one below.'));
  }

  for (const gen of country.generals) {
    const genDiv = div('gen-card');
    genDiv.style.borderLeft = `3px solid ${country.color}`;
    genDiv.innerHTML =
      `<strong>${gen.name}</strong> &nbsp; Age: ${gen.age} &nbsp; Skill: ${gen.skill} &nbsp; Speed: ${gen.speed}<br>`
    + `<span class="muted">Energy: ${gen.energy} &nbsp; Morale: ${gen.morale}</span>`;

    const order = { generalId: gen.id, action: 'defend', targetCountryId: null, soldiers: 0 };
    generalOrders.push(order);

    const actionDiv = div('gen-actions');

    const actionSelect = document.createElement('select');
    actionSelect.className = 'gen-action-select';
    for (const action of ['attack', 'defend', 'rest', 'study']) {
      const opt = document.createElement('option');
      opt.value = action;
      opt.textContent = action[0].toUpperCase() + action.slice(1);
      actionSelect.appendChild(opt);
    }
    actionSelect.value = 'defend';

    const attackConfig = div('attack-config hidden');

    const targetSelect = document.createElement('select');
    targetSelect.className = 'target-select';
    const neighbours = Object.keys(country.borders)
      .map(id => state.countries[id])
      .filter(n => n && !n.isEliminated);
    for (const n of neighbours) {
      const opt = document.createElement('option');
      opt.value       = n.id;
      opt.textContent = `${n.name} (${n.soldiers} soldiers)`;
      targetSelect.appendChild(opt);
    }

    const soldierLabel = elLabel(' Soldiers: ');
    const soldierInput = document.createElement('input');
    soldierInput.type  = 'number';
    soldierInput.min   = '1';
    soldierInput.max   = String(country.soldiers);
    soldierInput.value = String(Math.max(1, Math.floor(country.soldiers * 0.5)));
    soldierInput.style.width = '70px';

    attackConfig.appendChild(targetSelect);
    attackConfig.appendChild(soldierLabel);
    attackConfig.appendChild(soldierInput);

    targetSelect.addEventListener('change', () => {
      order.targetCountryId = targetSelect.value;
      onOrdersChange({ generalOrders: generalOrders.map(o => ({ ...o })) });
    });
    soldierInput.addEventListener('input', () => {
      order.soldiers = parseInt(soldierInput.value) || 0;
      onOrdersChange({ generalOrders: generalOrders.map(o => ({ ...o })) });
    });

    actionSelect.addEventListener('change', () => {
      order.action = actionSelect.value;
      if (order.action === 'attack') {
        attackConfig.classList.remove('hidden');
        order.targetCountryId = targetSelect.value || null;
        order.soldiers = parseInt(soldierInput.value) || 0;
      } else {
        attackConfig.classList.add('hidden');
        order.targetCountryId = null;
        order.soldiers = 0;
      }
      onOrdersChange({ generalOrders: generalOrders.map(o => ({ ...o })) });
    });

    actionDiv.appendChild(actionSelect);
    actionDiv.appendChild(attackConfig);
    genDiv.appendChild(actionDiv);
    genSection.appendChild(genDiv);
  }

  container.appendChild(genSection);
  // Emit initial general orders so they're registered even without interaction
  if (generalOrders.length > 0) {
    onOrdersChange({ generalOrders: generalOrders.map(o => ({ ...o })) });
  }

  // ── Recruit general (immediate) ────────────────────────────────
  container.appendChild(sectionHeader('Recruit General'));
  const recruitSection = div('hud-section');

  const rs = { age: 35, skill: 15, speed: 50 };

  const costDisplay = div('muted');
  const updateRecruitCost = () => {
    const cost = generalRecruitCost(rs.age, rs.skill, rs.speed);
    costDisplay.textContent = `Cost: ${Math.round(cost)} | Treasury: ${Math.floor(country.money)}`;
  };

  const recruitTable = document.createElement('table');
  recruitTable.className = 'alloc-table';
  recruitTable.innerHTML = '<tr><th>Stat</th><th>Value</th><th>Range</th></tr>';

  for (const { key, label, min, max } of [
    { key: 'age',   label: 'Age',   min: 20, max: 60 },
    { key: 'skill', label: 'Skill', min: 1,  max: 30 },
    { key: 'speed', label: 'Speed', min: 1,  max: 99 },
  ]) {
    const tr  = document.createElement('tr');
    const inp = document.createElement('input');
    inp.type  = 'number';
    inp.min   = String(min);
    inp.max   = String(max);
    inp.value = String(rs[key]);
    inp.style.width = '60px';
    inp.addEventListener('input', () => {
      rs[key] = Math.max(min, Math.min(max, parseInt(inp.value) || min));
      updateRecruitCost();
    });
    tr.innerHTML = `<td>${label}</td>`;
    const td2 = document.createElement('td'); td2.appendChild(inp);
    const td3 = document.createElement('td'); td3.textContent = `${min}–${max}`;
    tr.appendChild(td2); tr.appendChild(td3);
    recruitTable.appendChild(tr);
  }

  updateRecruitCost();
  recruitSection.appendChild(recruitTable);
  recruitSection.appendChild(costDisplay);

  const recruitBtn = btn('Recruit Now', () => {
    const gen = recruitGeneral(country, rs.age, rs.skill, rs.speed);
    if (gen) {
      onImmediateAction(); // re-render — general now appears in panel above
    } else {
      costDisplay.textContent = `Cannot afford! Need ${Math.round(generalRecruitCost(rs.age, rs.skill, rs.speed))}`;
    }
  });
  recruitBtn.className = 'action-btn recruit-btn';
  recruitSection.appendChild(recruitBtn);
  container.appendChild(recruitSection);

  // ── End Turn ───────────────────────────────────────────────────
  const endTurnBtn = document.createElement('button');
  endTurnBtn.className = 'end-turn-btn';
  endTurnBtn.textContent = `End Turn  (Year ${state.turn})`;
  endTurnBtn.addEventListener('click', onEndTurn);
  container.appendChild(endTurnBtn);

  // ── Science levels summary ─────────────────────────────────────
  container.appendChild(sectionHeader('Science Levels'));
  const sciLevSection = div('hud-section sci-levels');
  for (const area of SCIENCE_AREAS) {
    const p = document.createElement('p');
    p.textContent = `${SCIENCE_LABELS[area]}: ${country.science[area]}`;
    sciLevSection.appendChild(p);
  }
  container.appendChild(sciLevSection);
}

// ── DOM helpers ────────────────────────────────────────────────────

function div(cls) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  return d;
}

function btn(text, onClick) {
  const b = document.createElement('button');
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function numInput(min, max, value) {
  const inp = document.createElement('input');
  inp.type  = 'number';
  inp.min   = String(min);
  inp.max   = String(max);
  inp.value = String(value);
  return inp;
}

function sectionHeader(text) {
  const h = document.createElement('h3');
  h.className   = 'hud-section-header';
  h.textContent = text;
  return h;
}

function muted(text) {
  const p = document.createElement('p');
  p.className   = 'muted';
  p.textContent = text;
  return p;
}

function elLabel(text) {
  const s = document.createElement('span');
  s.textContent = text;
  return s;
}
