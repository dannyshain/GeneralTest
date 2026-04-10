// src/ui/main.js
// Entry point: game setup, main loop, UI wiring.

import { createInitialState } from '../gameState.js';
import { generateMap } from '../mapGen.js';
import { processTurn } from '../turnEngine.js';
import { renderMap, highlightCountry } from './map.js';
import { renderHUD } from './hud.js';
import { renderBattleLogs, renderEventLog, renderPostgame } from './battleLog.js';

// ── State ──────────────────────────────────────────────────────────
let gameState  = null;
let pendingOrders = {};      // orders being built by the HUD before end-turn
let selectedCountryId = null;

// ── DOM refs ───────────────────────────────────────────────────────
const setupScreen  = document.getElementById('setup-screen');
const gameScreen   = document.getElementById('game-screen');
const svgEl        = document.getElementById('map-svg');
const hudContainer = document.getElementById('hud-container');
const logContainer = document.getElementById('log-container');
const battleContainer = document.getElementById('battle-container');
const countryInfoEl   = document.getElementById('country-info');
const setupForm    = document.getElementById('setup-form');

// ── Setup ──────────────────────────────────────────────────────────
setupForm.addEventListener('submit', e => {
  e.preventDefault();
  const countryCount  = parseInt(document.getElementById('country-count').value);
  const humanIndex    = 0; // player is always country_0

  gameState = createInitialState(humanIndex, countryCount);
  generateMap(gameState, countryCount, humanIndex);

  setupScreen.style.display = 'none';
  gameScreen.style.display  = 'flex';

  render();
});

// ── Main render ────────────────────────────────────────────────────
function render() {
  if (!gameState) return;

  if (gameState.phase === 'postgame') {
    renderPostgameScreen();
    return;
  }

  renderMap(gameState, svgEl, handleCountryClick);
  highlightCountry(gameState, svgEl, selectedCountryId ?? gameState.humanCountryId);

  pendingOrders = {};
  renderHUD(
    gameState,
    hudContainer,
    (changes) => {
      Object.assign(pendingOrders, changes);
    },
    handleEndTurn,
  );

  renderBattleLogs(gameState, battleContainer);
  renderEventLog(gameState, logContainer);
  renderCountryInfo(selectedCountryId ?? gameState.humanCountryId);
}

// ── Country click ──────────────────────────────────────────────────
function handleCountryClick(countryId) {
  selectedCountryId = countryId;
  highlightCountry(gameState, svgEl, countryId);
  renderCountryInfo(countryId);
}

function renderCountryInfo(countryId) {
  const c = gameState.countries[countryId];
  if (!c) { countryInfoEl.innerHTML = ''; return; }

  const neighbors = Object.keys(c.borders)
    .map(id => gameState.countries[id]?.name ?? id)
    .join(', ') || 'none';

  const hostRow = Object.entries(gameState.hostility[countryId] ?? {})
    .map(([id, h]) => `${gameState.countries[id]?.name ?? id}: ${Math.round(h)}`)
    .join(' | ') || '—';

  const genInfo = c.generals.length > 0
    ? c.generals.map(g =>
        `${g.name} (age ${g.age}, sk ${g.skill}, sp ${g.speed}, en ${g.energy}, mo ${g.morale})`
      ).join('<br>')
    : 'No generals';

  countryInfoEl.innerHTML =
    `<strong style="color:${c.color}">${c.name}</strong>`
    + (c.isHuman ? ' <em>(You)</em>' : '')
    + (c.isEliminated ? ' <em>[Eliminated]</em>' : '')
    + `<br>Pop: ${c.population} | Farmers: ${c.farmers} | Scientists: ${c.scientists} | Soldiers: ${c.soldiers}`
    + `<br>Territory: ${Math.round(c.territory)} | Money: ${c.money}`
    + `<br>Neighbours: ${neighbors}`
    + `<br>Hostility: ${hostRow}`
    + `<br>Generals:<br>${genInfo}`;
}

// ── End turn ──────────────────────────────────────────────────────
function handleEndTurn() {
  if (!gameState || gameState.phase !== 'orders') return;

  // Apply pending orders to human country
  const human = gameState.countries[gameState.humanCountryId];
  if (pendingOrders.populationOrders) {
    human.orders.farmers    = pendingOrders.populationOrders.farmers    ?? null;
    human.orders.scientists = pendingOrders.populationOrders.scientists ?? null;
    human.orders.soldiers   = pendingOrders.populationOrders.soldiers   ?? null;
  }
  if (pendingOrders.scienceAllocation) {
    human.orders.scienceAllocation = { ...pendingOrders.scienceAllocation };
  }
  if (pendingOrders.generalOrders) {
    human.orders.generalOrders = pendingOrders.generalOrders;
  }
  if (pendingOrders.doRecruit && pendingOrders.recruitGeneral) {
    human.orders.recruitGeneral = { ...pendingOrders.recruitGeneral };
  }

  // Run the turn
  processTurn(gameState);

  // Re-render
  render();

  // Scroll log into view after turn
  logContainer.scrollTop = 0;
}

// ── Postgame ───────────────────────────────────────────────────────
function renderPostgameScreen() {
  hudContainer.innerHTML  = '';
  battleContainer.innerHTML = '';
  logContainer.innerHTML  = '';
  svgEl.innerHTML         = '';

  const postgameContainer = document.getElementById('postgame-container');
  postgameContainer.style.display = 'block';
  renderPostgame(gameState, postgameContainer);

  document.getElementById('new-game-btn').style.display = 'inline-block';
}

document.getElementById('new-game-btn')?.addEventListener('click', () => {
  location.reload();
});
