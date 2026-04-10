// src/mapGen.js
import { CONFIG } from './config.js';
import { createCountry } from './gameState.js';

const COUNTRY_NAMES = [
  'Northmark', 'Solaria', 'Ironhold', 'Verdania', 'Ashenveil',
  'Crestholm', 'Duskport', 'Emberlyn', 'Frostmere', 'Galehaven',
  'Harrowgate', 'Idenmoor', 'Jadewatch', 'Keldrath', 'Lumenvast',
  'Mirefall', 'Nadirpeak', 'Ostergard', 'Pyrethis', 'Quelstad',
];

const COUNTRY_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#d35400', '#e91e63', '#00bcd4',
  '#8bc34a', '#ff5722', '#607d8b', '#795548', '#c0ca33',
  '#673ab7', '#4caf50', '#2196f3', '#ff9800', '#009688',
];

// ── Geometry helpers ───────────────────────────────────────────────

function dist2(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

// Angle in degrees from point `from` toward point `to`.
// 0 = north (up on screen), 90 = east, 180 = south, 270 = west.
export function angleTo(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;   // positive y = down on screen
  const rad = Math.atan2(dy, dx);
  // atan2 gives angle from east; shift so 0 = north
  return (rad * 180 / Math.PI + 90 + 360) % 360;
}

// ── Point generation ───────────────────────────────────────────────

// Place N centroids using a jittered grid so they're well-spaced.
function generateCentroids(n, width, height) {
  const margin = 90;
  const cols = Math.ceil(Math.sqrt(n * (width / height)));
  const rows = Math.ceil(n / cols);
  const cellW = (width - margin * 2) / cols;
  const cellH = (height - margin * 2) / rows;

  const points = [];
  let idx = 0;
  for (let r = 0; r < rows && idx < n; r++) {
    for (let c = 0; c < cols && idx < n; c++) {
      points.push({
        x: margin + c * cellW + cellW * 0.2 + Math.random() * cellW * 0.6,
        y: margin + r * cellH + cellH * 0.2 + Math.random() * cellH * 0.6,
      });
      idx++;
    }
  }
  return points;
}

// ── Gabriel graph adjacency ────────────────────────────────────────
// Two points A and B are adjacent if no other point C lies strictly
// inside the circle whose diameter is AB. This produces a planar graph
// that closely resembles Delaunay triangulation and gives 2–5 neighbors
// per node for typical country counts.

function buildGabrielGraph(points) {
  const n = points.length;
  const adj = Array.from({ length: n }, () => new Set());

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const mx = (points[i].x + points[j].x) / 2;
      const my = (points[i].y + points[j].y) / 2;
      const r2 = dist2(points[i], points[j]) / 4;

      let blocked = false;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        if ((points[k].x - mx) ** 2 + (points[k].y - my) ** 2 < r2 - 1e-9) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        adj[i].add(j);
        adj[j].add(i);
      }
    }
  }

  // Guarantee every country has at least 2 neighbours.
  for (let i = 0; i < n; i++) {
    if (adj[i].size < 2) {
      const sorted = points
        .map((p, j) => ({ j, d: dist2(points[i], p) }))
        .filter(({ j }) => j !== i && !adj[i].has(j))
        .sort((a, b) => a.d - b.d);
      for (const { j } of sorted) {
        if (adj[i].size >= 2) break;
        adj[i].add(j);
        adj[j].add(i);
      }
    }
  }

  return adj;
}

// ── Border weight ──────────────────────────────────────────────────
// Shorter distance → higher weight (they share more "border").
function initialBorderWeight(a, b) {
  const d = Math.sqrt(dist2(a, b));
  // Normalize by a reference distance and apply variance.
  const base = CONFIG.STARTING_BORDER_WEIGHT;
  return base + (Math.random() * 10 - 5); // ±5 variance
}

// ── Main export ────────────────────────────────────────────────────

export function generateMap(state, countryCount, humanPlayerIndex) {
  const points = generateCentroids(countryCount, state.mapWidth, state.mapHeight);
  const adj = buildGabrielGraph(points);

  // Create country objects
  for (let i = 0; i < countryCount; i++) {
    const isHuman = i === humanPlayerIndex;
    const territory = CONFIG.STARTING_TERRITORY + Math.floor(Math.random() * 21 - 10); // ±10

    const personality = isHuman ? null : {
      aggression:    randInRange(...CONFIG.AI_AGGRESSION_RANGE),
      caution:       randInRange(...CONFIG.AI_CAUTION_RANGE),
      scienceFocus:  randInRange(...CONFIG.AI_SCIENCE_FOCUS_RANGE),
      expansionism:  randInRange(...CONFIG.AI_EXPANSIONISM_RANGE),
    };

    state.countries[`country_${i}`] = createCountry(
      `country_${i}`,
      COUNTRY_NAMES[i % COUNTRY_NAMES.length],
      COUNTRY_COLORS[i % COUNTRY_COLORS.length],
      points[i].x,
      points[i].y,
      territory,
      isHuman,
      personality,
    );
  }

  // Wire up border weights and angles
  for (let i = 0; i < countryCount; i++) {
    for (const j of adj[i]) {
      if (j <= i) continue; // process each pair once
      const weight = initialBorderWeight(points[i], points[j]);
      const ci = state.countries[`country_${i}`];
      const cj = state.countries[`country_${j}`];

      ci.borders[`country_${j}`] = { weight, angle: angleTo(ci, cj) };
      cj.borders[`country_${i}`] = { weight, angle: angleTo(cj, ci) };
    }
  }

  // Initialise hostility matrix
  const ids = Object.keys(state.countries);
  for (const a of ids) {
    state.hostility[a] = {};
    for (const b of ids) {
      if (a !== b) state.hostility[a][b] = CONFIG.HOSTILITY_STARTING;
    }
  }

  return state;
}

function randInRange(min, max) {
  return min + Math.random() * (max - min);
}
