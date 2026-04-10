// src/ui/hud.js
// Renders the player control panel and collects orders.

import { CONFIG } from '../config.js';
import { SCIENCE_AREAS, SCIENCE_LABELS, thresholdForNextLevel } from '../science.js';
import { generalRecruitCost } from '../economy.js';
import { densityCap } from '../population.js';

// Called by main.js when orders change; main.js passes a callback to read them.
export function renderHUD(state, container, onOrdersChange, onEndTurn) {
  const humanId = state.humanCountryId;
  const country  = state.countries[humanId];
  if (!country) return;

  container.innerHTML = '';

  // ── Header ─────────────────────────────────────────────────────
  const header = div('hud-header');
  header.innerHTML =
    `<span class="hud-name" style="color:${country.color}">${country.name}</span>`
    + ` &nbsp; Year <strong>${state.turn}</strong> / ${state.maxTurns}`
    + ` &nbsp; <span class="muted">Money: <strong>${country.money}</strong></span>`;
  container.appendChild(header);

  // ── Country summary ────────────────────────────────────────────
  const cap  = densityCap(country);
  const summ = div('hud-summary');
  summ.innerHTML =
    `<span>Pop: <strong>${country.population}</strong> / ${cap}</span> &nbsp;`
    + `<span>Territory: <strong>${Math.round(country.territory)}</strong></span> &nbsp;`
    + `<span>Soldiers (garrison): <strong>${country.soldiers}</strong></span>`;
  container.appendChild(summ);

  // ── Population allocation ──────────────────────────────────────
  container.appendChild(sectionHeader('Population Allocation'));
  const popSection = div('hud-section');

  const popOrders = {
    farmers:    country.farmers,
    scientists: country.scientists,
    soldiers:   country.soldiers,
  };

  const popTable = document.createElement('table');
  popTable.className = 'alloc-table';
  popTable.innerHTML =
    '<tr><th>Role</th><th>Count</th><th>Actions</th></tr>';

  for (const role of ['farmers', 'scientists', 'soldiers']) {
    const tr = document.createElement('tr');
    const countCell = document.createElement('td');
    countCell.id    = `pop-count-${role}`;
    countCell.textContent = popOrders[role];

    const dec = btn('−', () => {
      if (popOrders[role] > 0) {
        popOrders[role]--;
        popOrders.farmers += (role !== 'farmers') ? 1 : 0;
        if (role === 'farmers') popOrders.farmers = Math.max(0, popOrders.farmers - 1);
        refreshPopDisplay(popOrders, country.population);
        onOrdersChange({ populationOrders: { ...popOrders } });
      }
    });
    const inc = btn('+', () => {
      const nonFarmer = popOrders.scientists + popOrders.soldiers;
      if (role !== 'farmers' && nonFarmer < country.population) {
        popOrders[role]++;
        popOrders.farmers = country.population - popOrders.scientists - popOrders.soldiers;
        refreshPopDisplay(popOrders, country.population);
        onOrdersChange({ populationOrders: { ...popOrders } });
      }
    });

    tr.innerHTML = `<td>${role[0].toUpperCase() + role.slice(1)}</td>`;
    tr.appendChild(countCell);
    const actCell = document.createElement('td');
    actCell.appendChild(dec);
    actCell.appendChild(inc);
    tr.appendChild(actCell);
    popTable.appendChild(tr);
  }
  popSection.appendChild(popTable);
  container.appendChild(popSection);

  function refreshPopDisplay(orders, pop) {
    orders.farmers = Math.max(0, pop - orders.scientists - orders.soldiers);
    for (const r of ['farmers', 'scientists', 'soldiers']) {
      const cell = container.querySelector(`#pop-count-${r}`);
      if (cell) cell.textContent = orders[r];
    }
  }

  // ── Science allocation ─────────────────────────────────────────
  container.appendChild(sectionHeader(`Science  (${country.scientists} scientists available)`));
  const sciSection = div('hud-section');

  const sciAlloc = { ...country.scienceAllocation };
  const sciTable = document.createElement('table');
  sciTable.className = 'alloc-table sci-table';
  sciTable.innerHTML = '<tr><th>Area</th><th>Lv</th><th>Progress</th><th>Scientists</th></tr>';

  for (const area of SCIENCE_AREAS) {
    const lv       = country.science[area];
    const progress = country.scienceProgress[area];
    const needed   = thresholdForNextLevel(lv);
    const pct      = needed < Infinity ? Math.round((progress / needed) * 100) : 100;

    const tr      = document.createElement('tr');
    const countId = `sci-count-${area}`;

    const decSci = btn('−', () => {
      if (sciAlloc[area] > 0) {
        sciAlloc[area]--;
        refreshSciDisplay(sciAlloc);
        onOrdersChange({ scienceAllocation: { ...sciAlloc } });
      }
    });
    const incSci = btn('+', () => {
      const total = SCIENCE_AREAS.reduce((s, a) => s + (sciAlloc[a] || 0), 0);
      if (total < country.scientists && lv < CONFIG.SCIENCE_MAX_LEVEL) {
        sciAlloc[area]++;
        refreshSciDisplay(sciAlloc);
        onOrdersChange({ scienceAllocation: { ...sciAlloc } });
      }
    });

    const actCell = document.createElement('td');
    actCell.appendChild(decSci);
    const countSpan = document.createElement('span');
    countSpan.id    = countId;
    countSpan.textContent = sciAlloc[area] || 0;
    actCell.appendChild(countSpan);
    actCell.appendChild(incSci);

    tr.innerHTML =
      `<td>${SCIENCE_LABELS[area]}</td>`
      + `<td>${lv}</td>`
      + `<td>${pct < 100 ? pct + '%' : '(max)' }</td>`;
    tr.appendChild(actCell);
    sciTable.appendChild(tr);
  }
  sciSection.appendChild(sciTable);
  container.appendChild(sciSection);

  function refreshSciDisplay(alloc) {
    const total = SCIENCE_AREAS.reduce((s, a) => s + (alloc[a] || 0), 0);
    container.querySelector('.sci-total').textContent = `Assigned: ${total} / ${country.scientists}`;
    for (const a of SCIENCE_AREAS) {
      const span = container.querySelector(`#sci-count-${a}`);
      if (span) span.textContent = alloc[a] || 0;
    }
  }

  const sciTotalEl = div('sci-total muted');
  sciTotalEl.className = 'sci-total muted';
  sciTotalEl.textContent = `Assigned: ${SCIENCE_AREAS.reduce((s, a) => s + (sciAlloc[a] || 0), 0)} / ${country.scientists}`;
  sciSection.appendChild(sciTotalEl);

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
      `<strong>${gen.name}</strong> &nbsp;`
      + `Age: ${gen.age} &nbsp; Skill: ${gen.skill} &nbsp; Speed: ${gen.speed}<br>`
      + `Energy: ${gen.energy} &nbsp; Morale: ${gen.morale}`;

    // Action selector
    const actionDiv = div('gen-actions');
    const order = { generalId: gen.id, action: 'defend', targetCountryId: null, soldiers: 0 };
    generalOrders.push(order);

    const actionSelect = document.createElement('select');
    actionSelect.className = 'gen-action-select';
    for (const action of ['attack', 'defend', 'rest', 'study']) {
      const opt = document.createElement('option');
      opt.value       = action;
      opt.textContent = action[0].toUpperCase() + action.slice(1);
      actionSelect.appendChild(opt);
    }
    actionSelect.value = 'defend';

    // Target + soldiers (shown only when attack is selected)
    const attackConfig = div('attack-config hidden');
    const targetSelect = document.createElement('select');
    targetSelect.className = 'target-select';
    const neighbours = Object.keys(country.borders)
      .map(id => state.countries[id])
      .filter(n => n && !n.isEliminated);
    for (const n of neighbours) {
      const opt = document.createElement('option');
      opt.value       = n.id;
      opt.textContent = n.name;
      targetSelect.appendChild(opt);
    }

    const soldierLabel = document.createElement('label');
    soldierLabel.textContent = ' Soldiers: ';
    const soldierInput = document.createElement('input');
    soldierInput.type  = 'number';
    soldierInput.min   = '1';
    soldierInput.max   = String(country.soldiers);
    soldierInput.value = String(Math.floor(country.soldiers * 0.5));
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
  onOrdersChange({ generalOrders: generalOrders.map(o => ({ ...o })) });

  // ── Recruit general ────────────────────────────────────────────
  container.appendChild(sectionHeader('Recruit General'));
  const recruitSection = div('hud-section');

  const recruitState = { age: 35, skill: 15, speed: 50 };

  function recruitCostDisplay() {
    return generalRecruitCost(recruitState.age, recruitState.skill, recruitState.speed);
  }

  const costDisplay = div('muted');
  function updateCost() {
    costDisplay.textContent = `Cost: ${recruitCostDisplay()} | Treasury: ${country.money}`;
  }

  const recruitTable = document.createElement('table');
  recruitTable.className = 'alloc-table';
  recruitTable.innerHTML = '<tr><th>Stat</th><th>Value</th><th>Range</th></tr>';

  const statDefs = [
    { key: 'age',   label: 'Age',   min: 20, max: 60 },
    { key: 'skill', label: 'Skill', min: 1,  max: 30 },
    { key: 'speed', label: 'Speed', min: 1,  max: 99 },
  ];
  const statInputs = {};

  for (const { key, label, min, max } of statDefs) {
    const tr  = document.createElement('tr');
    const inp = document.createElement('input');
    inp.type  = 'number';
    inp.min   = String(min);
    inp.max   = String(max);
    inp.value = String(recruitState[key]);
    inp.style.width = '60px';
    inp.addEventListener('input', () => {
      recruitState[key] = Math.max(min, Math.min(max, parseInt(inp.value) || min));
      updateCost();
      onOrdersChange({ recruitGeneral: { ...recruitState } });
    });
    statInputs[key] = inp;

    const td1 = document.createElement('td'); td1.textContent = label;
    const td2 = document.createElement('td'); td2.appendChild(inp);
    const td3 = document.createElement('td'); td3.textContent = `${min}–${max}`;
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
    recruitTable.appendChild(tr);
  }

  recruitSection.appendChild(recruitTable);
  updateCost();
  recruitSection.appendChild(costDisplay);

  const recruitBtn = btn('Recruit General', () => {
    onOrdersChange({ recruitGeneral: { ...recruitState }, doRecruit: true });
  });
  recruitBtn.className = 'recruit-btn';
  recruitSection.appendChild(recruitBtn);

  container.appendChild(recruitSection);

  // ── End Turn button ────────────────────────────────────────────
  const endTurnBtn = document.createElement('button');
  endTurnBtn.className = 'end-turn-btn';
  endTurnBtn.textContent = `End Turn (Year ${state.turn})`;
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

// ── Helpers ────────────────────────────────────────────────────────

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
