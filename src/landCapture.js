// src/landCapture.js
import { CONFIG } from './config.js';
import { angleTo } from './mapGen.js';

// Territory gained by the victor based on surviving strength and general speed.
export function calcLandCaptured(survivingSoldiers, speed) {
  const base = (survivingSoldiers / 100) * CONFIG.LAND_PER_100_SOLDIERS;
  const speedMult = 1 + CONFIG.LAND_SPEED_FACTOR * speed;
  return Math.floor(base * speedMult);
}

/**
 * Transfer territory after an attacker victory and update border weights.
 *
 * Mechanics:
 *  1. Move `capturedAmount` territory from defender to attacker.
 *  2. For each of the defender's OTHER neighbours, reduce border[def][C] by an
 *     amount proportional to (fractionLost × angularProximity).
 *  3. Transfer BORDER_TRANSFER_RATE of that shrinkage to border[att][C].
 *  4. If border[def][C] drops below BORDER_THRESHOLD → adjacency lost.
 *  5. If border[att][C] rises above BORDER_THRESHOLD → new adjacency gained.
 *  6. If defender.territory reaches 0 → eliminated; attacker inherits all borders.
 *
 * Angular proximity: cos(Δangle), where Δangle is the angular difference between
 *   (defender→attacker) and (defender→C). 0° apart = full effect; 90°+ = zero.
 *   This means only borders in the direction of the attack are affected.
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

    // Attacker inherits all of defender's former borders
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

  // Direction of attacker relative to defender
  const attAngleFromDef = def.borders[attackerCountryId]?.angle ?? 0;

  // Process each of defender's OTHER neighbours
  for (const [neighborId, borderData] of Object.entries(def.borders)) {
    if (neighborId === attackerCountryId) continue;
    const neighbor = state.countries[neighborId];
    if (!neighbor || neighbor.isEliminated) continue;

    // Angular proximity: how close is this neighbour's direction to the attacker's direction?
    const neighborAngle = borderData.angle;
    let angDiff = Math.abs(attAngleFromDef - neighborAngle);
    if (angDiff > 180) angDiff = 360 - angDiff; // normalise to 0–180
    const proximityFactor = Math.max(0, Math.cos(angDiff * Math.PI / 180));

    if (proximityFactor === 0) continue; // opposite side — not affected

    // How much border defender loses with this neighbour
    const borderLoss = borderData.weight * fractionLost * proximityFactor;

    // How much transfers to attacker
    const transferred = borderLoss * CONFIG.BORDER_TRANSFER_RATE;

    // Update defender's border weight
    def.borders[neighborId].weight -= borderLoss;

    if (transferred > 0) {
      if (att.borders[neighborId]) {
        // Already adjacent — just strengthen the border
        att.borders[neighborId].weight += transferred;
      } else {
        // Potential new adjacency forming
        const angle = angleTo(att, neighbor);
        att.borders[neighborId] = { weight: transferred, angle };
        neighbor.borders[attackerCountryId] = { weight: transferred, angle: angleTo(neighbor, att) };
        // Note: adjacency is tracked by border existence; we only fire the event if it's new
        events.push({ type: 'newAdjacency', a: attackerCountryId, b: neighborId });
      }
    }

    // Check if defender lost adjacency with this neighbour
    if (def.borders[neighborId].weight < CONFIG.BORDER_THRESHOLD) {
      delete def.borders[neighborId];
      delete neighbor.borders[defenderCountryId];
      events.push({ type: 'lostAdjacency', a: defenderCountryId, b: neighborId });
    }
  }

  return { actual, events };
}
