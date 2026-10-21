// Style meter and Performance Review grading. Pure logic, no three.js, so it runs under node for tests.

export const RANKS = ['INTERN', 'ASSOCIATE', 'MANAGER', 'DIRECTOR', 'VP', 'C-SUITE'];
const MAX = RANKS.length * 100 - 1;
export const MANAGER = 2;
export const VP = 4;

export function createStyle() {
  return { points: 0, peak: 0, lastWeapon: null, repeat: 0, recent: [] };
}

export const rankOf = (s) => Math.min(RANKS.length - 1, Math.floor(s.points / 100));

function add(s, n) {
  s.points = Math.max(0, Math.min(MAX, s.points + n));
  s.peak = Math.max(s.peak, rankOf(s));
}

// weapon: a weapon id or 'infight'. extra: { terminated, dash }. Returns the bonus labels earned; s.lastGain holds the points.
export function styleKill(s, weapon, airborne, time, extra = {}) {
  const bonuses = [];
  let gain = 30;
  if (weapon === 'infight') {
    gain += 40;
    bonuses.push('SYNERGY');
  } else {
    s.repeat = weapon === s.lastWeapon ? s.repeat + 1 : 0;
    gain *= Math.max(0.25, 0.7 ** s.repeat);
    if (s.lastWeapon && weapon !== s.lastWeapon) {
      gain += 20;
      bonuses.push('VARIETY');
    }
    s.lastWeapon = weapon;
    if (extra.terminated) {
      gain += 60;
      bonuses.push('TERMINATED');
    } else if (weapon === 'axe') {
      gain += 50;
      bonuses.push('HANDS-ON');
    }
    if (extra.dash) {
      gain += 15;
      bonuses.push('DASH KILL');
    }
    if (airborne) {
      gain += 25;
      bonuses.push('AIRBORNE');
    }
  }
  s.recent = s.recent.filter((t) => time - t < 1);
  if (s.recent.length) {
    gain += 30 * s.recent.length;
    bonuses.push('MULTI-KILL');
  }
  s.recent.push(time);
  add(s, gain);
  s.lastGain = gain;
  return bonuses;
}

// Camping starves you: decay grows with rank.
export const styleDecay = (s, dt) => add(s, -(4 + 3 * rankOf(s)) * dt);
export const styleHurt = (s, dmg) => add(s, -(25 + dmg * 1.5));

export const PAR = 240;

export function grade({ kills, total, secrets, secretsTotal = 3, time, peak, par = PAR }) {
  const t = time <= par ? 1 : Math.max(0, 1 - (time - par) / par);
  const score = 0.35 * (total ? kills / total : 1) + 0.2 * (secretsTotal ? secrets / secretsTotal : 1) + 0.2 * t + 0.25 * (peak / (RANKS.length - 1));
  return score >= 0.9 ? 'S' : score >= 0.8 ? 'A' : score >= 0.65 ? 'B' : score >= 0.5 ? 'C' : score >= 0.35 ? 'D' : 'F';
}
