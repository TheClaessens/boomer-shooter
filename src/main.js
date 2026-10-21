import * as THREE from 'three';
import { createWorld, updateWorld, losClear } from './world.js';
import { EYE, loadoutOf } from './player.js';
import { Viewmodel, ORDER, WEAPONS } from './weapons.js';
import { LEVELS, CAMPAIGN } from './levels/index.js';
import { Audio } from './audio.js';
import { Hud } from './hud.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.autoClear = false;
const camera = new THREE.PerspectiveCamera(90, 1, 0.05, 200);
camera.rotation.order = 'YXZ';
const viewmodel = new Viewmodel();
const audio = new Audio();
const hud = new Hud();

// Pixel filter: render at ~320x200, then upscale with nearest sampling and crush to an 8-level-per-channel palette.
const rt = new THREE.WebGLRenderTarget(320, 200, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const post = new THREE.Scene();
post.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tex: { value: rt.texture }, res: { value: new THREE.Vector2(320, 200) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tex; uniform vec2 res; varying vec2 vUv;
    float bayer(vec2 p) {
      int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)), i = x + y * 4;
      int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
      return float(m[i]) / 16.0 - 0.5;
    }
    void main() {
      vec3 c = pow(texture2D(tex, vUv).rgb, vec3(1.0 / 2.2));
      c = floor(c * 7.0 + 0.5 + bayer(floor(vUv * res)) * 0.45) / 7.0;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
})));
let pixel = true;

function resize() {
  const w = innerWidth, h = innerHeight, aspect = w / h;
  renderer.setSize(w, h, false);
  camera.aspect = viewmodel.camera.aspect = aspect;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(1 / aspect)); // 90° horizontal
  camera.updateProjectionMatrix();
  viewmodel.camera.updateProjectionMatrix();
  const rw = Math.round(200 * aspect);
  rt.setSize(rw, 200);
  post.children[0].material.uniforms.res.value.set(rw, 200);
}
addEventListener('resize', resize);
resize();

// ── save: unlocked levels + best scores ──────────────────────────────────────────────
const SAVE_KEY = 'overtime.save';
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s?.unlocked && s?.best) return s;
  } catch {}
  return { unlocked: ['tower'], best: {} };
}
const save = loadSave();
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
}
function recordBest(g) {
  const prev = save.best[g.levelId] ?? 0, isNew = g.score > prev;
  if (isNew) save.best[g.levelId] = g.score;
  writeSave();
  return { best: Math.max(prev, g.score), isNew };
}

// ── state + input ─────────────────────────────────────────────────────────────────────
// run: the level being played and the loadout it started with (R restarts from exactly that).
let state = 'title', game = null, deadT = 0, run = null;
const input = { keys: {}, fire: false, switchTo: null, cycle: 0, dash: false };
const locked = () => document.pointerLockElement === canvas;
const lock = () => canvas.requestPointerLock()?.catch?.(() => {});

function dispose(scene) {
  scene.traverse((o) => {
    o.geometry?.dispose();
    if (!o.material?.userData?.shared) o.material?.dispose?.();
  });
}

function startLevel(levelId, loadout = null) {
  if (game) dispose(game.scene);
  run = { levelId, loadout };
  game = createWorld(audio, hud, levelId, loadout);
  if (import.meta.env.DEV) Object.assign(window, { game, input }); // console poking while developing
  if (!save.unlocked.includes(levelId)) save.unlocked.push(levelId), writeSave();
  state = 'playing';
  deadT = 0;
  input.fire = false;
  hud.screen(null);
  hud.intro?.(LEVELS[levelId].name);
  audio.resume();
}
const restart = () => startLevel(run.levelId, run.loadout);

function finishLevel() {
  state = 'score';
  document.exitPointerLock();
  const next = game.level.next;
  if (next && !save.unlocked.includes(next)) save.unlocked.push(next);
  hud.screen('score', game, { ...recordBest(game), next });
}

// Menu actions from HUD screens: 'start' (arg: level id), 'retry', 'next', 'menu', 'resume'.
hud.onAction = (action, arg) => {
  audio.init();
  if (action === 'start') startLevel(arg);
  else if (action === 'retry') restart();
  else if (action === 'next' && game?.level.next) startLevel(game.level.next, loadoutOf(game.player));
  else if (action === 'menu') {
    state = 'title';
    audio.setRank(0);
    audio.setBoss(false);
    hud.screen('title', null, { save, levels: LEVELS, campaign: CAMPAIGN });
    return;
  } else if (action === 'resume' && state === 'paused') unpause();
  if (!locked()) lock();
};

// Resume without waiting for pointer lock: an embed that refuses lock must not leave the game stuck on the card.
function unpause() {
  state = 'playing';
  audio.resume();
  hud.screen(null);
}

// Clicking the screen backdrop: the obvious default for each screen.
function click() {
  if (state === 'title') return;
  audio.init(); // any click is a user gesture: make sure sound is up (a page that boots into a level skips the menu)
  if (state === 'dead' && deadT > 0.6) return hud.onAction('retry');
  if (state === 'score') return hud.onAction(game.level.next ? 'next' : 'menu');
  if (state === 'paused') return hud.onAction('resume');
  if (!locked()) lock();
}

// <html data-start="archives"> boots straight into that level, paused behind a "clock in" card (one-level builds).
const bootLevel = document.documentElement.dataset.start;
if (LEVELS[bootLevel]) {
  startLevel(bootLevel);
  state = 'paused';
  audio.suspend();
  hud.screen('paused', game, { start: LEVELS[bootLevel].name });
} else hud.screen('title', null, { save, levels: LEVELS, campaign: CAMPAIGN });
document.getElementById('screen').addEventListener('click', (e) => { if (e.target === e.currentTarget) click(); });
canvas.addEventListener('mousedown', (e) => {
  if (state === 'playing' && locked()) {
    if (e.button === 0) input.fire = true;
  } else click();
});
addEventListener('mouseup', (e) => { if (e.button === 0) input.fire = false; });
addEventListener('wheel', (e) => { if (state === 'playing') input.cycle = Math.sign(e.deltaY); }, { passive: true });
addEventListener('mousemove', (e) => {
  if (state !== 'playing' || !locked()) return;
  const p = game.player;
  p.yaw -= e.movementX * 0.0022;
  p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch - e.movementY * 0.0022));
});
document.addEventListener('pointerlockchange', () => {
  if (!locked() && state === 'playing') {
    state = 'paused';
    input.fire = false;
    input.keys = {};
    audio.suspend();
    hud.screen('paused');
  } else if (locked() && state === 'paused') unpause();
});
addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) input.dash = true;
  input.keys[e.code] = true;
  if (e.code === 'KeyP') pixel = !pixel;
  if (e.code === 'KeyR' && run && state !== 'title') {
    if (state === 'score' && game.level.next) hud.onAction('next');
    else hud.onAction('retry');
  }
  if (e.code === 'Enter' && state === 'score') hud.onAction(game.level.next ? 'next' : 'menu');
  const slot = /^Digit([1-9])$/.exec(e.code);
  if (slot && ORDER[slot[1] - 1]) input.switchTo = ORDER[slot[1] - 1];
});
addEventListener('keyup', (e) => { input.keys[e.code] = false; });
addEventListener('blur', () => { input.keys = {}; input.fire = false; });

// ── dev harness: ?level=archives&god=1 skips the title; window.overtime.snap() for screenshots ──
if (import.meta.env.DEV) {
  const q = new URLSearchParams(location.search);
  const noInput = { keys: {}, fire: false, switchTo: null, cycle: 0, dash: false };
  // Start (or reuse) a level, place the player, simulate `seconds` synchronously, render one frame.
  // { level, x, y, z, yaw, pitch, seconds, god, hud, wake, weapon, fresh, freeze } — freeze (default) holds the frame until unfreeze().
  function snap({ level = run?.levelId ?? 'tower', x, y, z, yaw, pitch = 0, seconds = 0, god = true, hud: showHud = false, wake = false, weapon, fresh = false, freeze = true } = {}) {
    if (fresh || !game || run?.levelId !== level) startLevel(level);
    state = freeze ? 'frozen' : 'playing';
    const p = game.player;
    game.god = god;
    if (x !== undefined) p.pos.set(x, y ?? p.pos.y, z);
    if (yaw !== undefined) p.yaw = yaw;
    p.pitch = pitch;
    p.vel.set(0, 0, 0);
    if (weapon) { p.owned[weapon] = true; p.weapon = weapon; p.switchT = 0; }
    if (wake) for (const e of game.enemies) if (e.active && !e.dead) e.state = 'chase';
    for (let t = 0; t < seconds; t += 1 / 60) updateWorld(game, noInput, 1 / 60);
    updateWorld(game, noInput, 0);
    document.getElementById('hud').hidden = !showHud;
    document.getElementById('screen').hidden = true;
    hud.update(game, 0);
    render(0);
    return { pos: p.pos.toArray(), enemies: game.enemies.filter((e) => e.active && !e.dead).length };
  }
  // Combat bot for balance sims in the endless arena: aims at the nearest visible enemy, strafes, dashes, swaps weapons,
  // axes staggered enemies. runSim({ maxT }) → { wave, time, score, kills }. Not a level-walker (no pathfinding).
  function botInput(g, inp, t) {
    const p = g.player;
    let best = null, bd = 45;
    for (const e of g.enemies) {
      if (e.dead || !e.active || e.def.prop) continue;
      const d = e.pos.distanceTo(p.pos);
      if (d < bd && losClear(g, p.pos.clone().setY(p.pos.y + EYE), e.pos.clone().setY(e.pos.y + e.h * 0.5))) { bd = d; best = e; }
    }
    const k = (inp.keys = {});
    const phase = Math.floor(t / 1.3) % 2;
    k[phase ? 'KeyA' : 'KeyD'] = true;
    if (Math.random() < 0.004) inp.dash = true;
    if (Math.random() < 0.01) k.Space = true;
    inp.fire = false;
    if (!best) { k.KeyW = true; p.yaw += 0.02; return; }
    const dx = best.pos.x - p.pos.x, dy = best.pos.y + best.h * 0.5 - (p.pos.y + EYE), dz = best.pos.z - p.pos.z;
    p.yaw = Math.atan2(-dx, -dz);
    p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    if (bd > 12) k.KeyW = true; else if (bd < 5 && !best.staggerT) k.KeyS = true;
    if (best.staggerT > 0) { k.KeyW = true; inp.switchTo = bd < 3 ? 'axe' : null; }
    else {
      const has = (w) => p.owned[w] && (WEAPONS[w].ammo ? p.ammo[WEAPONS[w].ammo] >= WEAPONS[w].use : true);
      inp.switchTo = ['ssg', 'shotgun'].find((w) => bd < 7 && has(w)) ?? ['launcher'].find((w) => bd > 8 && has(w) && best.type !== 'burnout') ?? ['stapler', 'shotgun', 'ssg'].find(has) ?? 'axe';
    }
    inp.fire = p.weapon === 'laser' ? Math.random() < 0.9 : true;
  }
  function runSim({ level = 'overtime', maxT = 600, dt = 1 / 60 } = {}) {
    startLevel(level);
    state = 'frozen';
    const g = game, inp = { keys: {}, fire: false, switchTo: null, cycle: 0, dash: false };
    for (let t = 0; t < maxT && !g.player.dead; t += dt) {
      botInput(g, inp, t);
      updateWorld(g, inp, dt);
      inp.switchTo = null; inp.dash = false;
    }
    return { wave: g.wave ?? 0, time: +g.stats.time.toFixed(1), score: g.score, kills: g.stats.kills, dead: g.player.dead, peak: g.style.peak };
  }
  window.overtime = { snap, runSim, startLevel, unfreeze: () => { state = 'playing'; }, render: () => render(0), get game() { return game; }, input, save };
  if (q.get('level')) {
    audio.init();
    startLevel(q.get('level'));
    if (q.get('god')) game.god = true;
  }
}

// ── loop ──────────────────────────────────────────────────────────────────────────────
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!game) return;
  if (state === 'playing') {
    updateWorld(game, input, dt);
    input.switchTo = null;
    input.cycle = 0;
    input.dash = false;
    if (game.player.dead) {
      state = 'dead';
      game.deathBest = game.levelId === 'overtime' ? recordBest(game) : null; // endless mode is scored on death
    } else if (game.exited) finishLevel();
  } else if (state === 'dead') {
    deadT += dt; // brief freeze, then offer the restart
    if (deadT > 0.6 && document.getElementById('screen').hidden) hud.screen('dead', game, game.deathBest);
  }
  if (state === 'playing' || state === 'dead') hud.update(game, dt);
  render(dt);
}

function render(dt) {
  const p = game.player, s = game.shake;
  camera.position.set(p.pos.x + (Math.random() - 0.5) * s * 0.3, p.pos.y + (p.dead ? 0.3 : EYE) + (Math.random() - 0.5) * s * 0.3, p.pos.z);
  camera.rotation.set(p.pitch, p.yaw, p.dead ? 0.5 : 0);
  Object.assign(audio.listener, { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: p.yaw });
  viewmodel.update(p, state === 'playing' ? dt : 0);
  renderer.setRenderTarget(pixel ? rt : null);
  renderer.clear();
  renderer.render(game.scene, camera);
  renderer.clearDepth();
  renderer.render(viewmodel.scene, viewmodel.camera);
  if (pixel) {
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(post, postCam);
  }
}
requestAnimationFrame(frame);
