// src/ui/main.js
// Entry point: game setup, main loop, UI wiring.

import { createInitialState } from '../gameState.js';
import { generateMap } from '../mapGen.js';
import { processTurn } from '../turnEngine.js';
import { renderMap, highlightCountry } from './map.js';
import { renderHUD } from './hud.js';
import { renderBattleLogs, renderEventLog, renderPostgame } from './battleLog.js';

// ── State ──────────────────────────────────────────────────────────
let gameState         = null;
let pendingOrders     = {};
let selectedCountryId = null;

// ── DOM refs ───────────────────────────────────────────────────────
const setupScreen     = document.getElementById('setup-screen');
const gameScreen      = document.getElementById('game-screen');
const svgEl           = document.getElementById('map-svg');
const hudContainer    = document.getElementById('hud-container');
const logContainer    = document.getElementById('log-container');
const battleContainer = document.getElementById('battle-container');
const countryInfoEl   = document.getElementById('country-info');
const setupForm       = document.getElementById('setup-form');

// ── Setup ──────────────────────────────────────────────────────────
setupForm.addEventListener('submit', e => {
  e.preventDefault();
  const countryCount = parseInt(document.getElementById('country-count').value);
  const humanIndex   = 0;

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
  renderCountryInfo(selectedCountryId ?? gameState.humanCountryId);

  pendingOrders = {};

  renderHUD(
    gameState,
    hudContainer,
    (changes) => {
      // Deferred orders (science allocation, general orders)
      Object.assign(pendingOrders, changes);
    },
    handleImmediateAction,
    handleEndTurn,
    pendingOrders,
  );

  renderBattleLogs(gameState, battleContainer);
  renderEventLog(gameState, logContainer);
}

// ── Country click ──────────────────────────────────────────────────
function handleCountryClick(countryId) {
  selectedCountryId = countryId;
  highlightCountry(gameState, svgEl, countryId);
  renderCountryInfo(countryId);
}

function renderCountryInfo(countryId) {
  const c = gameState?.countries[countryId];
  if (!c) { countryInfoEl.innerHTML = ''; return; }

  const neighbors = Object.keys(c.borders)
    .map(id => {
      const n = gameState.countries[id];
      return n ? `${n.name} (${n.soldiers} sol)` : id;
    }).join(', ') || 'none';

  const genInfo = c.generals.length > 0
    ? c.generals.map(g =>
        `${g.name} | age ${g.age} sk ${g.skill} sp ${g.speed} en ${g.energy} mo ${g.morale}`
      ).join(' &nbsp;·&nbsp; ')
    : 'No generals';

  const hostilityInfo = Object.entries(gameState.hostility[countryId] ?? {})
    .filter(([id]) => !gameState.countries[id]?.isEliminated)
    .map(([id, h]) => `${gameState.countries[id]?.name ?? id}: ${Math.round(h)}`)
    .join(' | ') || '—';

  countryInfoEl.innerHTML =
    `<strong style="color:${c.color}">${c.name}</strong>`
    + (c.isHuman ? ' <em>(You)</em>' : '')
    + (c.isEliminated ? ' <em>[Eliminated]</em>' : '')
    + ` &nbsp; Pop: ${c.population} | Farmers: ${c.farmers} | Scientists: ${c.scientists} | Soldiers: ${c.soldiers}`
    + ` | Territory: ${Math.round(c.territory)} | Money: ${Math.floor(c.money)} | Grain: ${c.grain}`
    + `<br>Neighbours: ${neighbors}`
    + `<br>Hostility toward: ${hostilityInfo}`
    + `<br>${genInfo}`;
}

// ── Immediate action handler ───────────────────────────────────────
// Called after any in-turn action (harvest, sell, train, recruit).
// Re-renders the HUD and map without advancing the turn.
function handleImmediateAction() {
  renderHUD(
    gameState,
    hudContainer,
    (changes) => { Object.assign(pendingOrders, changes); },
    handleImmediateAction,
    handleEndTurn,
    pendingOrders,
  );
  renderMap(gameState, svgEl, handleCountryClick);
  renderCountryInfo(selectedCountryId ?? gameState.humanCountryId);
}

// ── End turn ──────────────────────────────────────────────────────
function handleEndTurn() {
  if (!gameState || gameState.phase !== 'orders') return;

  const human = gameState.countries[gameState.humanCountryId];

  if (pendingOrders.scienceAllocation) {
    human.orders.scienceAllocation = { ...pendingOrders.scienceAllocation };
  }
  if (pendingOrders.generalOrders) {
    human.orders.generalOrders = pendingOrders.generalOrders;
  }

  processTurn(gameState);
  selectedCountryId = null;
  render();

  logContainer.scrollTop    = 0;
  battleContainer.scrollTop = 0;
}

// ── Postgame ───────────────────────────────────────────────────────
function renderPostgameScreen() {
  hudContainer.innerHTML    = '';
  battleContainer.innerHTML = '';
  logContainer.innerHTML    = '';
  svgEl.innerHTML           = '';

  const pg = document.getElementById('postgame-container');
  pg.style.display = 'block';
  renderPostgame(gameState, pg);
  document.getElementById('new-game-btn').style.display = 'inline-block';
}

document.getElementById('new-game-btn')?.addEventListener('click', () => {
  location.reload();
});
