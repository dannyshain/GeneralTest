// src/ui/battleLog.js
// Renders battle results and event logs.

export function renderBattleLogs(state, containerEl) {
  containerEl.innerHTML = '';

  if (!state.battleLogs || state.battleLogs.length === 0) {
    containerEl.innerHTML = '<p class="muted">No battles this turn.</p>';
    return;
  }

  for (const battle of state.battleLogs) {
    const attacker = state.countries[battle.attackerCountryId];
    const defender = state.countries[battle.defenderCountryId];

    const section = document.createElement('div');
    section.className = 'battle-section';

    // ── Header ─────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'battle-header';
    header.innerHTML =
      `<span style="color:${attacker?.color ?? '#aaa'}">${attacker?.name ?? '?'}</span>`
      + ` ⚔ `
      + `<span style="color:${defender?.color ?? '#aaa'}">${defender?.name ?? '?'}</span>`
      + `  <span class="battle-result ${battle.result}">${labelResult(battle.result)}</span>`
      + `  <span class="muted">${battle.rounds} rounds</span>`;
    section.appendChild(header);

    // ── Opening troop counts ────────────────────────────────────
    const troops = document.createElement('div');
    troops.className = 'battle-troops';
    troops.innerHTML =
      `<span style="color:${attacker?.color ?? '#aaa'}">${attacker?.name ?? '?'}</span>`
      + ` started with <strong>${battle.attackerStartSoldiers ?? '?'}</strong> soldiers`
      + ` vs `
      + `<span style="color:${defender?.color ?? '#aaa'}">${defender?.name ?? '?'}</span>`
      + ` with <strong>${battle.defenderStartSoldiers ?? '?'}</strong> soldiers.`;
    section.appendChild(troops);

    // ── Losses summary ──────────────────────────────────────────
    const losses = document.createElement('div');
    losses.className = 'battle-losses';
    losses.innerHTML =
      `Losses — `
      + `<span style="color:${attacker?.color ?? '#aaa'}">${attacker?.name ?? '?'}</span>: `
      + `<strong>${battle.attackerLosses}</strong>`
      + ` &nbsp;|&nbsp; `
      + `<span style="color:${defender?.color ?? '#aaa'}">${defender?.name ?? '?'}</span>: `
      + `<strong>${battle.defenderLosses}</strong>`
      + ` &nbsp;|&nbsp; Survivors: ${battle.attackerSurvivors} / ${battle.defenderSurvivors}`;
    section.appendChild(losses);

    // ── Territory captured ──────────────────────────────────────
    if (battle.result === 'attackerVictory' && battle.territoryCaptured > 0) {
      const terr = document.createElement('div');
      terr.className = 'battle-territory';
      terr.innerHTML =
        `<span style="color:${attacker?.color ?? '#aaa'}">${attacker?.name ?? '?'}</span>`
        + ` captured <strong>${battle.territoryCaptured}</strong> territory from `
        + `<span style="color:${defender?.color ?? '#aaa'}">${defender?.name ?? '?'}</span>.`
        + (defender?.isEliminated ? ` <strong>${defender?.name} has been eliminated!</strong>` : '');
      section.appendChild(terr);
    }

    // ── Collapsible round-by-round log ──────────────────────────
    const toggle = document.createElement('button');
    toggle.className = 'log-toggle';
    toggle.textContent = '▶ Battle log';
    section.appendChild(toggle);

    const logDiv = document.createElement('div');
    logDiv.className = 'battle-log-lines hidden';
    for (const line of battle.log) {
      const p = document.createElement('p');
      p.textContent = line;
      // Highlight casualty lines slightly
      if (line.startsWith('Round') && line.includes('−')) p.className = 'round-line';
      logDiv.appendChild(p);
    }
    section.appendChild(logDiv);

    toggle.addEventListener('click', () => {
      const hidden = logDiv.classList.toggle('hidden');
      toggle.textContent = hidden ? '▶ Battle log' : '▼ Battle log';
    });

    containerEl.appendChild(section);
  }
}

export function renderEventLog(state, containerEl) {
  containerEl.innerHTML = '';
  if (!state.eventLog || state.eventLog.length === 0) {
    containerEl.innerHTML = '<p class="muted">No events.</p>';
    return;
  }
  for (const line of state.eventLog) {
    const p = document.createElement('p');
    p.textContent = line;
    if (line.includes('eliminated') || line.includes('starved') || line.includes('deserted') || line.includes('quit')) p.className = 'event-important';
    containerEl.appendChild(p);
  }
}

export function renderPostgame(state, containerEl) {
  containerEl.innerHTML = '';

  const winner = state.countries[state.winner];
  const h1 = document.createElement('h2');
  h1.textContent = winner
    ? `Game Over — ${winner.name} wins!`
    : 'Game Over';
  containerEl.appendChild(h1);

  if (state.finalScores) {
    const table = document.createElement('table');
    table.className = 'score-table';
    table.innerHTML =
      '<tr><th>Country</th><th>Score</th><th>Territory</th><th>Population</th><th>Elims</th></tr>';

    const sorted = Object.entries(state.finalScores).sort((a, b) => b[1] - a[1]);
    for (const [id, score] of sorted) {
      const c = state.countries[id];
      if (!c) continue;
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td style="color:${c.color}">${c.name}${c.isHuman ? ' (You)' : ''}</td>`
        + `<td>${score}</td>`
        + `<td>${Math.round(c.territory)}</td>`
        + `<td>${c.population}</td>`
        + `<td>${state.eliminations[id] ?? 0}</td>`;
      table.appendChild(tr);
    }
    containerEl.appendChild(table);
  }

  // Year-by-year history for human player
  const human = Object.values(state.countries).find(c => c.isHuman);
  if (human && state.yearlyHistory.length > 0) {
    const h2 = document.createElement('h3');
    h2.textContent = `Your history — ${human.name}`;
    h2.style.marginTop = '16px';
    containerEl.appendChild(h2);

    const chart = document.createElement('div');
    chart.className = 'history-chart';
    chart.innerHTML = '<p class="muted" style="font-size:10px">Year | Population | Territory | Soldiers | Money</p>';
    for (const snap of state.yearlyHistory) {
      const s = snap.countries[human.id];
      if (!s) continue;
      const row = document.createElement('p');
      row.textContent =
        `Year ${snap.turn}: pop ${s.population} | terr ${Math.round(s.territory)}`
        + ` | sol ${s.soldiers} | money ${Math.floor(s.money)}`;
      chart.appendChild(row);
    }
    containerEl.appendChild(chart);
  }
}

function labelResult(result) {
  if (result === 'attackerVictory') return '✓ Attacker wins';
  if (result === 'defenderVictory') return '✗ Defender holds';
  return '— Stalemate';
}
