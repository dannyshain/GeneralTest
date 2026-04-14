// src/landCapture.js
import { CONFIG } from './config.js';
import { angleTo } from './mapGen.js';

// ── Land capture formula ───────────────────────────────────────────
// Uses logarithmic scaling for diminishing returns.
// 100 survivors at speed 50 → ~10 territory (≈10% of starting 100).
// 500 survivors at speed 50 → ~20 territory (not 50).
// Formula: floor(SCALE * ln(1 + survivors / DIVISOR) * speedMult)
// Capped at LAND_CAPTURE_MAX_FRACTION of the defender's current territory.

export function calcLandCaptured(survivingSoldiers, speed, defenderTerritory) {
  if (survivingSoldiers <= 0) return 0;
  const logTerm    = Math.log(1 + survivingSoldiers / CONFIG.LAND_CAPTURE_DIVISOR);
  const speedMult  = 1 + CONFIG.LAND_SPEED_FACTOR * speed;
  const raw        = Math.floor(CONFIG.LAND_CAPTURE_SCALE * logTerm * speedMult);
  const cap        = Math.floor(defenderTerritory * CONFIG.LAND_CAPTURE_MAX_FRACTION);
  return Math.min(raw, cap);
}

/**
 * Transfer territory after an attacker victory and update border weights.
 *
 * Mechanics (unchanged from v1 — angular proximity border redistribution):
 *  1. Move `capturedAmount` territory from defender to attacker.
 *  2. For each of the defender's OTHER neighbours, reduce border[def][C] by
 *     fractionLost × angularProximity (cos of angle diff).
 *  3. Transfer BORDER_TRANSFER_RATE of that shrinkage to border[att][C].
 *  4. border[def][C] < BORDER_THRESHOLD → adjacency lost.
 *  5. border[att][C] rises above 0 → potential new adjacency.
 *  6. defender.territory reaches 0 → eliminated; attacker inherits all borders.
 *
 * @returns {{ actual: number, events: Event[] }}
 */
export function applyLandCapture(state, attackerCountryId, defenderCountryId, capturedAmount) {
  const att = state.countries[attackerCountryId];
  const def = state.countries[defenderCountryId];

  const actual = Math.min(capturedAmount, def.territory);
  const preCaptureTerritory = def.territory;

  def.territory -= actual;
  att.territory += actual;

  const events = [];

  // ── Elimination ────────────────────────────────────────────────
  if (def.territory <= 0) {
    def.territory = 0;
    def.isEliminated = true;
    events.push({ type: 'elimination', eliminated: defenderCountryId, by: attackerCountryId });

    for (const [neighborId, borderData] of Object.entries(def.borders)) {
      if (neighborId === attackerCountryId) continue;
      const neighbor = state.countries[neighborId];
      if (!neighbor || neighbor.isEliminated) continue;

      if (att.borders[neighborId]) {
        att.borders[neighborId].weight += borderData.weight;
      } else {
        const angle = angleTo(att, neighbor);
        att.borders[neighborId] = { weight: borderData.weight, angle };
        neighbor.borders[attackerCountryId] = { weight: borderData.weight, angle: angleTo(neighbor, att) };
        events.push({ type: 'newAdjacency', a: attackerCountryId, b: neighborId });
      }

      delete neighbor.borders[defenderCountryId];
    }

    delete att.borders[defenderCountryId];
    def.borders = {};

    return { actual, events };
  }

  // ── Partial capture ────────────────────────────────────────────
  const fractionLost = actual / preCaptureTerritory;
  const attAngleFromDef = def.borders[attackerCountryId]?.angle ?? 0;

  for (const [neighborId, borderData] of Object.entries(def.borders)) {
    if (neighborId === attackerCountryId) continue;
    const neighbor = state.countries[neighborId];
    if (!neighbor || neighbor.isEliminated) continue;

    // Angular proximity: only borders in the direction of the attack are affected
    let angDiff = Math.abs(attAngleFromDef - borderData.angle);
    if (angDiff > 180) angDiff = 360 - angDiff;
    const proximityFactor = Math.max(0, Math.cos(angDiff * Math.PI / 180));
    if (proximityFactor === 0) continue;

    const borderLoss  = borderData.weight * fractionLost * proximityFactor;
    const transferred = borderLoss * CONFIG.BORDER_TRANSFER_RATE;

    def.borders[neighborId].weight -= borderLoss;

    if (transferred > 0) {
      if (att.borders[neighborId]) {
        att.borders[neighborId].weight += transferred;
      } else {
        const angle = angleTo(att, neighbor);
        att.borders[neighborId] = { weight: transferred, angle };
        neighbor.borders[attackerCountryId] = { weight: transferred, angle: angleTo(neighbor, att) };
        events.push({ type: 'newAdjacency', a: attackerCountryId, b: neighborId });
      }
    }

    if (def.borders[neighborId].weight < CONFIG.BORDER_THRESHOLD) {
      delete def.borders[neighborId];
      delete neighbor.borders[defenderCountryId];
      events.push({ type: 'lostAdjacency', a: defenderCountryId, b: neighborId });
    }
  }

  return { actual, events };
}
