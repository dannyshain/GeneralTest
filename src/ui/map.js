// src/ui/map.js
// Renders the SVG map: country nodes, adjacency lines, territory size indicators.

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// Radius of a country circle, scaled by territory.
function countryRadius(territory) {
  return Math.max(14, Math.min(38, 14 + territory * 0.12));
}

export function renderMap(state, svgEl, onCountryClick) {
  svgEl.innerHTML = '';

  const countries = Object.values(state.countries);

  // ── Adjacency lines ──────────────────────────────────────────
  const drawnEdges = new Set();
  for (const c of countries) {
    if (c.isEliminated) continue;
    for (const [nId] of Object.entries(c.borders)) {
      const n = state.countries[nId];
      if (!n || n.isEliminated) continue;
      const edgeKey = [c.id, nId].sort().join('|');
      if (drawnEdges.has(edgeKey)) continue;
      drawnEdges.add(edgeKey);

      const line = el('line', {
        x1: c.x, y1: c.y, x2: n.x, y2: n.y,
        stroke: '#555', 'stroke-width': '1.5', opacity: '0.5',
      });
      svgEl.appendChild(line);
    }
  }

  // ── Country circles ──────────────────────────────────────────
  for (const c of countries) {
    const r = countryRadius(c.territory);
    const opacity = c.isEliminated ? '0.25' : '1';

    const g = el('g', {
      transform: `translate(${c.x},${c.y})`,
      style: c.isEliminated ? 'pointer-events:none' : 'cursor:pointer',
    });

    // Outer ring for human player
    if (c.isHuman && !c.isEliminated) {
      g.appendChild(el('circle', {
        r: r + 5, fill: 'none', stroke: '#fff', 'stroke-width': '2.5',
      }));
    }

    // Main circle
    const circle = el('circle', {
      r,
      fill: c.color,
      stroke: c.isEliminated ? '#444' : '#111',
      'stroke-width': '1.5',
      opacity,
    });
    g.appendChild(circle);

    // Country initial letter
    const label = el('text', {
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      fill: '#fff',
      'font-size': '11',
      'font-weight': 'bold',
      'font-family': 'monospace',
      'pointer-events': 'none',
    });
    label.textContent = c.name[0];
    g.appendChild(label);

    // Territory value beneath the circle
    const tLabel = el('text', {
      'text-anchor': 'middle',
      y: r + 13,
      fill: '#ccc',
      'font-size': '9',
      'font-family': 'monospace',
      'pointer-events': 'none',
    });
    tLabel.textContent = `T:${Math.round(c.territory)}`;
    g.appendChild(tLabel);

    // Name label above circle
    const nLabel = el('text', {
      'text-anchor': 'middle',
      y: -(r + 7),
      fill: c.isEliminated ? '#555' : '#eee',
      'font-size': '10',
      'font-family': 'monospace',
      'pointer-events': 'none',
    });
    nLabel.textContent = c.isEliminated ? `${c.name} ✕` : c.name;
    g.appendChild(nLabel);

    if (!c.isEliminated) {
      g.addEventListener('click', () => onCountryClick(c.id));
    }

    svgEl.appendChild(g);
  }
}

// Highlight the selected country and its neighbours.
export function highlightCountry(state, svgEl, selectedId) {
  // Reset all circles
  const circles = svgEl.querySelectorAll('circle[r]');
  circles.forEach(c => c.setAttribute('stroke', '#111'));

  if (!selectedId) return;
  const sel = state.countries[selectedId];
  if (!sel) return;

  // Find the g element for selected country by position (cheap hack for prototype)
  const groups = svgEl.querySelectorAll('g');
  for (const g of groups) {
    const transform = g.getAttribute('transform') ?? '';
    const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
    if (!match) continue;
    const gx = parseFloat(match[1]);
    const gy = parseFloat(match[2]);

    for (const c of Object.values(state.countries)) {
      if (Math.abs(c.x - gx) < 1 && Math.abs(c.y - gy) < 1) {
        const mainCircle = g.querySelector('circle');
        if (!mainCircle) break;

        if (c.id === selectedId) {
          mainCircle.setAttribute('stroke', '#fff');
          mainCircle.setAttribute('stroke-width', '3');
        } else if (sel.borders[c.id]) {
          mainCircle.setAttribute('stroke', '#ff0');
          mainCircle.setAttribute('stroke-width', '2');
        }
        break;
      }
    }
  }
}
