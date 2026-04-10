// src/flavorText.js
// Battle narrative templates. Edit these freely to adjust tone.
// Templates use {attacker}, {defender}, {generalName}, {defGenName}, {rounds} as placeholders.

function skillTier(skill) {
  if (skill <= 30) return 'low';
  if (skill <= 70) return 'mid';
  return 'high';
}

const ATTACK_OPENERS = {
  low: [
    '{attacker} charges forward with little coordination.',
    'The {attacker} forces advance in a disorganized rush.',
    '{attacker} troops press the attack with brute force.',
    'A ragged {attacker} advance crashes into the {defender} lines.',
  ],
  mid: [
    '{attacker} advances on a broad front toward {defender}.',
    'The {attacker} army moves in disciplined columns.',
    '{attacker} forces deploy methodically before engaging.',
    'General {generalName} leads the {attacker} advance in good order.',
  ],
  high: [
    '{attacker} executes a precisely timed assault on {defender}.',
    'General {generalName} coordinates a multi-pronged advance.',
    '{attacker} forces drive forward with textbook precision.',
    'A masterfully planned {attacker} offensive opens against {defender}.',
  ],
};

const DEFEND_OPENERS = {
  low: [
    '{defender} scrambles to hold its lines.',
    'The {defender} defenders dig in haphazardly.',
    '{defender} braces for the assault with little preparation.',
  ],
  mid: [
    '{defender} holds a prepared defensive position.',
    'The {defender} forces brace for the assault in good order.',
    '{defender} anchors its line and waits.',
  ],
  high: [
    '{defender} holds a fortified line with disciplined fire control.',
    'General {defGenName} anchors the defense along favorable ground.',
    'The {defender} line is well-prepared — {attacker} will pay for every yard.',
  ],
};

const HIGH_SKILL_FLAVOR = [
  'General {generalName} exploits a gap in the enemy line.',
  'A disciplined encirclement tightens around the {defender} flank.',
  '{generalName} orders a feint that draws the {defender} reserves out of position.',
  'Coordinated fire suppresses the {defender} line as {attacker} advances.',
  '{generalName} directs a textbook flanking maneuver.',
];

const ROUND_DECISIVE_ATTACKER = [
  '{attacker} presses hard — {defender} lines buckle under the assault.',
  'A flanking push by {attacker} catches {defender} off guard.',
  '{attacker} momentum builds as {defender} begins to give ground.',
  'Concentrated {attacker} force smashes through the {defender} center.',
  'The {attacker} charge strikes a weak point. {defender} reels.',
];

const ROUND_DECISIVE_DEFENDER = [
  '{defender} counterattacks sharply, driving {attacker} back.',
  'The {attacker} charge is repulsed with heavy losses.',
  'The {defender} line holds and punishes the {attacker} advance.',
  '{defender} launches a devastating counter-push.',
  '{attacker} overextends — {defender} exploits the gap mercilessly.',
];

const ROUND_EVEN = [
  'Both sides exchange heavy blows. Neither gains ground.',
  'The battle grinds on — no breakthrough for either side.',
  'Fierce fighting along the entire front. The line holds.',
  'Casualties mount on both sides with little movement.',
  'A brutal exchange of fire. The situation remains unclear.',
];

const BATTLE_OUTCOMES = {
  attackerVictory: [
    '{attacker} carries the field. The {defender} army is broken.',
    'The {defender} army collapses under sustained {attacker} pressure.',
    'Victory for {attacker} — {defender} retreats in disorder.',
    '{attacker} seizes the initiative. {defender} is routed.',
  ],
  defenderVictory: [
    '{defender} holds firm. {attacker} withdraws in defeat.',
    'The assault fails. {attacker} is driven back with heavy losses.',
    '{defender} repels the invasion. {attacker} retreats in disorder.',
    'The {defender} line does not break. {attacker} gives up the attack.',
  ],
  stalemate: [
    'Neither side achieves a breakthrough. Forces disengage after {rounds} rounds.',
    'The battle ends inconclusively. Both armies withdraw to regroup.',
    'After {rounds} grueling rounds, the front line remains unchanged.',
    'Exhaustion overtakes both sides. The engagement ends without resolution.',
  ],
};

// ── Helpers ────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fmt(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// ── Public API ─────────────────────────────────────────────────────

export function battleOpener(attackerCountry, defenderCountry, attackerGen, defenderGen, digIn) {
  const aTier = attackerGen ? skillTier(attackerGen.skill) : 'low';
  const dTier = defenderGen ? skillTier(defenderGen.skill) : 'low';
  const vars = {
    attacker:   attackerCountry.name,
    defender:   defenderCountry.name,
    generalName: attackerGen?.name  ?? 'the commander',
    defGenName:  defenderGen?.name ?? 'the garrison commander',
  };

  let text = fmt(pick(ATTACK_OPENERS[aTier]), vars)
           + ' '
           + fmt(pick(DEFEND_OPENERS[dTier]), vars);

  if (digIn) {
    text += ` ${defenderCountry.name} forces are dug in — defenders gain a combat bonus.`;
  }

  // High-skill attacker bonus flavor (~50% chance)
  if (attackerGen && attackerGen.skill > 70 && Math.random() < 0.5) {
    text += ' ' + fmt(pick(HIGH_SKILL_FLAVOR), vars);
  }

  return text;
}

export function roundSummary(attackerCountry, defenderCountry, outcome, round) {
  const vars = {
    attacker: attackerCountry.name,
    defender: defenderCountry.name,
    round,
  };
  if (outcome === 'attacker') return `Round ${round}: ` + fmt(pick(ROUND_DECISIVE_ATTACKER), vars);
  if (outcome === 'defender') return `Round ${round}: ` + fmt(pick(ROUND_DECISIVE_DEFENDER), vars);
  return `Round ${round}: ` + fmt(pick(ROUND_EVEN), vars);
}

export function battleOutcomeText(attackerCountry, defenderCountry, result, rounds) {
  const vars = {
    attacker: attackerCountry.name,
    defender: defenderCountry.name,
    rounds,
  };
  return fmt(pick(BATTLE_OUTCOMES[result]), vars);
}
