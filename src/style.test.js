import assert from 'node:assert/strict';
import { createStyle, styleKill, styleHurt, styleDecay, rankOf, grade } from './style.js';

const s = createStyle();
assert.deepEqual(styleKill(s, 'shotgun', false, 0), []);
assert.equal(s.points, 30);
styleKill(s, 'shotgun', false, 5); // repeat weapon: diminishing
assert.equal(Math.round(s.points), 51);
const b = styleKill(s, 'axe', true, 5.5); // different weapon, axe, airborne, multi-kill
assert.deepEqual(b, ['VARIETY', 'HANDS-ON', 'AIRBORNE', 'MULTI-KILL']);
assert.equal(Math.round(s.points), 206);
assert.equal(Math.round(s.lastGain), 155);
assert.equal(rankOf(s), 2);
assert.deepEqual(styleKill(s, 'infight', false, 20), ['SYNERGY']);
styleHurt(s, 20);
assert.equal(rankOf(s), 2);
styleDecay(s, 1000);
assert.equal(s.points, 0);
assert.equal(s.peak, 2);

assert.equal(grade({ kills: 43, total: 43, secrets: 3, time: 200, peak: 5 }), 'S');
assert.equal(grade({ kills: 0, total: 43, secrets: 0, time: 900, peak: 0 }), 'F');
assert.equal(grade({ kills: 30, total: 43, secrets: 1, time: 300, peak: 3 }), 'C');
assert.equal(grade({ kills: 10, total: 10, secrets: 2, secretsTotal: 2, time: 100, par: 120, peak: 5 }), 'S');
const t = createStyle();
assert.deepEqual(styleKill(t, 'shotgun', false, 0), []);
assert.deepEqual(styleKill(t, 'axe', false, 3, { terminated: true, dash: true }), ['VARIETY', 'TERMINATED', 'DASH KILL']);
assert.equal(Math.round(t.points), 155);
console.log('style ok');
