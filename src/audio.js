// All sound is synthesized with WebAudio: no assets.

const BPM = 132;
const STEP = 60 / BPM / 4; // one 16th note
// Fmaj7 Em7 Dm7 Cmaj7: smooth enough for an elevator, and its roots chug fine as power chords.
const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
// Boss: Dm Bb Gm A — the board meeting is in harmonic minor.
const BOSS_CHORDS = [[50, 53, 57, 62], [46, 50, 53, 58], [43, 46, 50, 55], [45, 49, 52, 57]];
// Chord-tone index per 16th (+4 = up an octave), A for the first half of the 8-bar phrase, B for the answer.
const MELODY_A = [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, -1, -1, 0, -1, -1, -1];
const MELODY_B = [3, -1, 2, -1, 1, -1, 2, 4, -1, -1, 3, -1, 2, -1, 1, -1];
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const tone = (ch, i) => (i >= 4 ? ch[i - 4] + 12 : ch[i]);

const VOICE = { intern: ['square', 260], manager: ['sawtooth', 190], brute: ['sawtooth', 70], printer: ['square', 620] };

const SOUNDS = {
  shotgun(a, t, o) { a.noise(t, 0.35, 1, o, 'lowpass', 3500, 200); a.osc('sine', 120, 40, t, 0.22, 1, o); },
  pump(a, t, o) { a.noise(t, 0.05, 0.5, o, 'bandpass', 1800, 1800, 3); a.noise(t + 0.13, 0.07, 0.6, o, 'bandpass', 1100, 1100, 3); a.osc('square', 90, 60, t + 0.13, 0.05, 0.2, o); },
  dry(a, t, o) { a.noise(t, 0.04, 0.3, o, 'bandpass', 2500, 2500, 4); },
  axe(a, t, o) { a.noise(t, 0.2, 0.35, o, 'bandpass', 400, 2200, 2); },
  axehit(a, t, o) { a.osc('square', 150, 50, t, 0.12, 0.5, o); a.noise(t, 0.12, 0.7, o, 'lowpass', 1800, 300); },
  launcher(a, t, o) { a.osc('sine', 200, 50, t, 0.25, 0.9, o); a.noise(t, 0.15, 0.5, o, 'lowpass', 1400, 300); },
  explode(a, t, o) { a.noise(t, 1, 1.2, o, 'lowpass', 1800, 60); a.osc('sine', 80, 30, t, 0.6, 1, o); },
  pistol(a, t, o) { a.noise(t, 0.12, 0.6, o, 'highpass', 1500, 700); a.osc('square', 320, 80, t, 0.05, 0.25, o); },
  stapler(a, t, o) { a.noise(t, 0.3, 0.4, o, 'bandpass', 500, 2600, 4); },
  ink(a, t, o) { a.noise(t, 0.4, 0.6, o, 'lowpass', 900, 150); a.osc('sine', 220, 70, t, 0.25, 0.4, o); },
  splat(a, t, o) { a.noise(t, 0.15, 0.4, o, 'lowpass', 1200, 200); },
  punch(a, t, o) { a.osc('sine', 100, 40, t, 0.2, 1, o); a.noise(t, 0.15, 0.8, o, 'lowpass', 1000, 100); },
  gib(a, t, o) { a.noise(t, 0.4, 0.9, o, 'lowpass', 1500, 120); a.noise(t + 0.08, 0.2, 0.5, o, 'bandpass', 600, 300, 2); },
  hurt(a, t, o) { a.osc('sawtooth', 170, 90, t, 0.22, 0.45, o); },
  death(a, t, o) { a.osc('sawtooth', 220, 40, t, 1.4, 0.6, o); a.noise(t, 0.6, 0.4, o, 'lowpass', 800, 100); },
  // Pickups: a little pitch jitter so a row of shells doesn't machine-gun the same blip.
  pickup(a, t, o) { const k = 1 + (Math.random() - 0.5) * 0.08; a.osc('square', 660 * k, 660 * k, t, 0.06, 0.15, o); a.osc('square', 990 * k, 990 * k, t + 0.06, 0.09, 0.15, o); },
  pickup_health(a, t, o) { [523, 659, 784].forEach((f, i) => a.osc('triangle', f, f * 1.01, t + i * 0.045, 0.12, 0.22, o)); },
  pickup_armor(a, t, o) { a.osc('square', 330, 330, t, 0.07, 0.15, o); a.osc('square', 494, 494, t + 0.06, 0.12, 0.15, o); a.noise(t, 0.08, 0.2, o, 'bandpass', 3000, 3000, 6); },
  pickup_ammo(a, t, o) { a.noise(t, 0.04, 0.4, o, 'bandpass', 2200, 2200, 5); a.noise(t + 0.07, 0.05, 0.4, o, 'bandpass', 1500, 1500, 5); a.osc('square', 880, 880, t + 0.07, 0.05, 0.1, o); },
  weapon(a, t, o) { [440, 554, 659, 880].forEach((f, i) => a.osc('square', f, f, t + i * 0.06, 0.12, 0.15, o)); a.osc('sawtooth', 110, 110, t + 0.24, 0.4, 0.15, o); },
  key(a, t, o) { a.osc('sine', 880, 880, t, 0.5, 0.35, o); a.osc('sine', 1320, 1320, t + 0.12, 0.6, 0.3, o); },
  secret(a, t, o) { [523, 659, 784, 1047, 1319].forEach((f, i) => a.osc('triangle', f, f, t + i * 0.08, 0.3, 0.3, o)); },
  door(a, t, o) { a.noise(t, 0.6, 0.35, o, 'lowpass', 500, 150); a.osc('sine', 60, 50, t, 0.6, 0.25, o); },
  locked(a, t, o) { a.osc('square', 120, 120, t, 0.12, 0.25, o); a.osc('square', 100, 100, t + 0.15, 0.15, 0.25, o); },
  lift(a, t, o) { a.osc('sawtooth', 55, 70, t, 6, 0.15, o); },
  spawn(a, t, o) { a.osc('sawtooth', 100, 900, t, 0.5, 0.25, o); a.noise(t, 0.5, 0.4, o, 'bandpass', 300, 3000, 2); },
  // Climbs with the rank you just reached (a.rank is still the old one when this plays).
  rankup(a, t, o) {
    const base = 60 + Math.min(5, a.rank + 1) * 2;
    [0, 4, 7, 12, 16].forEach((n, i) => a.osc('sawtooth', hz(base + n), hz(base + n), t + i * 0.05, 0.25, 0.16, o));
    a.osc('square', hz(base + 24), hz(base + 24), t + 0.25, 0.4, 0.1, o);
    a.noise(t, 0.6, 0.15, o, 'highpass', 6000);
  },
  rankdown(a, t, o) { a.osc('sawtooth', 300, 120, t, 0.35, 0.15, o); },
  // An enemy is on its last legs: a wobbly "uh-oh" with a crunch.
  stagger(a, t, o) { a.osc('square', 620, 520, t, 0.07, 0.2, o); a.osc('square', 470, 330, t + 0.08, 0.14, 0.2, o); a.noise(t, 0.1, 0.3, o, 'bandpass', 1200, 600, 3); },
  // Termination: rubber stamp slam, bone crunch, cash-register ding.
  terminate(a, t, o) {
    a.osc('sine', 110, 35, t, 0.4, 1, o);
    a.noise(t, 0.3, 1, o, 'lowpass', 2500, 150);
    a.noise(t + 0.02, 0.12, 0.6, o, 'bandpass', 900, 400, 2);
    [1568, 2093].forEach((f, i) => { a.osc('sine', f, f, t + 0.12 + i * 0.08, 0.6, 0.18, o); a.osc('sine', f * 2.76, f * 2.76, t + 0.12 + i * 0.08, 0.2, 0.05, o); });
  },
  // Arena seals: two-tone klaxon, three times, over a door slam.
  lockdown(a, t, o) {
    a.osc('sine', 70, 40, t, 0.5, 0.8, o);
    a.noise(t, 0.4, 0.6, o, 'lowpass', 900, 100);
    for (let i = 0; i < 3; i++) { a.osc('square', 440, 440, t + i * 0.42, 0.2, 0.2, o); a.osc('square', 330, 330, t + i * 0.42 + 0.2, 0.2, 0.2, o); }
  },
  // Area clear: bright major fanfare.
  clear(a, t, o) {
    [523, 659, 784].forEach((f, i) => a.osc('triangle', f, f, t + i * 0.09, 0.25, 0.3, o));
    [523, 659, 784, 1047].forEach((f) => a.osc('square', f, f, t + 0.3, 0.7, 0.07, o));
  },
  // New wave: impact + rising swell + gong.
  wave(a, t, o) {
    a.osc('sine', 90, 30, t, 0.5, 0.9, o);
    a.noise(t, 0.6, 0.6, o, 'bandpass', 200, 3000, 1.5);
    a.osc('sawtooth', hz(50), hz(62), t, 0.5, 0.2, o);
    a.osc('sawtooth', hz(57), hz(69), t, 0.5, 0.15, o);
    a.osc('sine', 98, 96, t + 0.5, 2, 0.4, o); a.osc('sine', 98 * 2.4, 98 * 2.4, t + 0.5, 1.2, 0.12, o);
  },
  // Score screen: typewriter clack per row, stamp for the grade.
  tick(a, t, o) { a.noise(t, 0.03, 0.5, o, 'bandpass', 3000, 3000, 4); a.osc('square', 1200, 900, t, 0.02, 0.08, o); },
  stamp(a, t, o) { a.osc('sine', 120, 40, t, 0.3, 1, o); a.noise(t, 0.2, 0.9, o, 'lowpass', 1600, 120); },
};

// Other modules add their own sounds (weapons, enemy types, boss). Same signature as SOUNDS; they win over the defaults.
const EXTRA = {};
export const registerSounds = (table) => Object.assign(EXTRA, table);

// Per-enemy sight sound, attack tell, pain and death: same voice, different gesture.
function enemySound(a, kind, type, t, o) {
  const [w, f] = VOICE[type] ?? ['square', 300];
  if (kind === 'sight') {
    if (type === 'intern') { a.osc(w, f, f * 0.7, t, 0.5, 0.25, o); a.osc(w, f * 0.75, f * 0.6, t + 0.35, 0.5, 0.2, o); }
    else if (type === 'manager') { a.osc(w, f, f, t, 0.15, 0.3, o); a.osc(w, f * 1.25, f * 0.9, t + 0.18, 0.35, 0.3, o); }
    else if (type === 'brute') { a.osc(w, f, f * 0.8, t, 1, 0.6, o); a.noise(t, 1, 0.3, o, 'lowpass', 400, 200); }
    else { [1, 1.5, 1, 2].forEach((m, i) => a.osc(w, f * m, f * m, t + i * 0.09, 0.08, 0.15, o)); a.noise(t, 0.4, 0.2, o, 'bandpass', 3000, 3000, 3); }
  } else if (kind === 'tell') {
    if (type === 'intern') { a.noise(t, 0.03, 0.4, o, 'bandpass', 3000, 3000, 5); a.noise(t + 0.12, 0.03, 0.4, o, 'bandpass', 3500, 3500, 5); }
    else if (type === 'manager') a.noise(t, 0.45, 0.35, o, 'bandpass', 300, 2000, 3);
    else if (type === 'brute') { a.osc(w, 120, 60, t, 0.6, 0.6, o); a.noise(t, 0.6, 0.4, o, 'lowpass', 600, 200); }
    else a.osc(w, 200, 900, t, 0.5, 0.2, o);
  } else if (kind === 'pain') a.osc(w, f * 1.3, f * 0.8, t, 0.15, 0.3, o);
  else { a.osc(w, f, f * 0.3, t, 0.6, 0.35, o); a.noise(t, 0.3, 0.3, o, 'lowpass', 1200, 200); }
}

export class Audio {
  ctx = null;
  listener = { x: 0, y: 0, z: 0, yaw: 0 };
  rank = 0;
  boss = false;
  fillFrom = -1; // rank-up drum fill: steps [fillFrom, fillTo), crash on fillTo
  fillTo = -1;

  init() {
    if (this.ctx) return void this.ctx.resume();
    const ctx = (this.ctx = new AudioContext());
    // Master bus → limiter-ish compressor, so a launcher volley over C-SUITE metal doesn't clip.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 6;
    comp.ratio.value = 16;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = this.gain(0.8, comp);
    this.sfx = this.gain(1, this.master);
    this.music = this.gain(0.3, this.master);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Music layers 0..5, one per rank: muzak, bass, light drums, guitar, heavy drums, full metal.
    this.layers = Array.from({ length: 6 }, (_, i) => this.gain(i === 0 ? 1 : 0, this.music));
    this.guitar = [3, 5].map((i) => {
      const shaper = ctx.createWaveShaper(), lp = ctx.createBiquadFilter();
      const curve = new Float32Array(1024);
      for (let k = 0; k < 1024; k++) { const x = (k / 512) - 1; curve[k] = ((3 + 60) * x * 20 * Math.PI / 180) / (Math.PI + 60 * Math.abs(x)); }
      shaper.curve = curve;
      lp.frequency.value = 2800;
      const input = ctx.createGain();
      input.connect(shaper).connect(lp).connect(this.layers[i]);
      return input;
    });
    // Boss bus: low drone + a "choir" (saw pads through two vowel formants).
    this.bossBus = this.gain(0, this.music);
    const lp = ctx.createBiquadFilter();
    lp.frequency.value = 320;
    lp.connect(this.bossBus);
    this.drone = this.gain(1, lp);
    this.choir = ctx.createGain();
    for (const [f, q] of [[650, 5], [1080, 6]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      this.choir.connect(bp).connect(this.bossBus);
    }
    this.step = 0;
    this.next = ctx.currentTime + 0.1;
    setInterval(() => this.tick(), 25);
  }

  suspend() { this.ctx?.suspend(); }
  resume() { this.ctx?.resume(); }

  gain(v, to) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(to);
    return g;
  }

  osc(type, f0, f1, t, dur, vol, out) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Slow-attack sustained note (pads, drones): osc() is percussive by design.
  pad(type, f, t, dur, vol, out, attack = 0.3, detune = 0) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + dur - 0.15);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(t, dur, vol, out, type = 'lowpass', f0 = 2000, f1 = f0, q = 1) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.9);
    s.stop(t + dur + 0.02);
  }

  // pos: world position for distance falloff + stereo pan, or null for the player's own sounds.
  play(name, pos = null, delay = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx, t = c.currentTime + delay, L = this.listener;
    let out = this.sfx;
    if (pos) {
      const dx = pos.x - L.x, dy = pos.y - L.y, dz = pos.z - L.z, dist = Math.hypot(dx, dy, dz);
      if (dist > 70) return;
      const g = c.createGain(), pan = c.createStereoPanner();
      g.gain.value = 1 / (1 + dist * 0.12);
      pan.pan.value = dist > 0.1 ? Math.max(-1, Math.min(1, (dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw)) / dist)) * 0.8 : 0;
      g.connect(pan).connect(this.sfx);
      out = g;
    }
    const fn = EXTRA[name] ?? SOUNDS[name];
    if (fn) return void fn(this, t, out);
    const [kind, type] = name.split('_');
    if (type && ['sight', 'tell', 'pain', 'die'].includes(kind)) enemySound(this, kind, type, t, out);
    else if (import.meta.env?.DEV) console.warn('no sound', name);
  }

  // The rank the music plays at: the boss forces the heavy layers.
  get level() { return this.boss ? Math.max(4, this.rank) : this.rank; }

  setRank(r) {
    if (r > this.rank && this.ctx) {
      // Rank up: drum fill into the next bar (at least 4 steps away, so it isn't clipped).
      let to = Math.ceil(this.step / 16) * 16;
      if (to - this.step < 4) to += 16;
      this.fillFrom = Math.max(this.step, to - 8);
      this.fillTo = to;
    }
    this.rank = r;
    this.mix();
  }

  // on: boss fight music (heavy layers + drone/choir + darker chords). Idempotent.
  setBoss(on) {
    on = !!on;
    if (on === this.boss) return;
    this.boss = on;
    if (on && this.ctx) { this.fillFrom = this.step; this.fillTo = Math.ceil((this.step + 4) / 16) * 16; }
    this.mix();
  }

  mix() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime, r = this.level;
    this.layers.forEach((g, i) => g.gain.setTargetAtTime(i === 0 ? (this.boss ? 0 : r >= 5 ? 0.3 : 1) : i <= r ? 1 : 0, now, 0.4));
    this.bossBus.gain.setTargetAtTime(this.boss ? 1 : 0, now, 0.8);
  }

  tick() {
    const c = this.ctx;
    if (c.state !== 'running') return;
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05; // tab was throttled: skip, don't burst
    while (this.next < c.currentTime + 0.15) {
      this.beat(this.step++, this.next);
      this.next += STEP;
    }
  }

  beat(step, t) {
    const phrase = Math.floor(step / 16) % 8, bar = phrase % 4, s = step % 16, answer = phrase >= 4;
    const ch = (this.boss ? BOSS_CHORDS : CHORDS)[bar], L = this.layers, r = this.level;
    const kick = (vol, out) => this.osc('sine', 150, 40, t, 0.15, vol, out);
    const snare = (vol, out) => { this.noise(t, 0.15, vol, out, 'bandpass', 1800, 1800, 0.8); this.osc('triangle', 190, 140, t, 0.1, vol * 0.6, out); };
    const chug = (out, dur, root = ch[0]) => { this.osc('sawtooth', hz(root - 12), hz(root - 12), t, dur, 0.12, out); this.osc('sawtooth', hz(root - 5), hz(root - 5), t, dur, 0.1, out); };
    const mel = (answer ? MELODY_B : MELODY_A)[s];

    // Rank-up / boss-entry fill: descending toms on 16ths, crash on the downbeat. Plays on the music bus, whatever layers are up.
    if (step >= this.fillFrom && step < this.fillTo) {
      const k = (step - this.fillFrom) / 8;
      this.osc('sine', 260 - k * 140, 70, t, 0.14, 0.5, this.music);
      this.noise(t, 0.06, 0.25, this.music, 'bandpass', 1500 - k * 600, 1500 - k * 600, 1);
    } else if (step === this.fillTo) {
      this.noise(t, 1.4, 0.45, this.music, 'highpass', 4500);
      kick(0.8, this.music);
    }

    // 0: elevator muzak (melody answers itself in the second half of the phrase)
    if (s === 0 || s === 10) for (const n of ch) this.osc('sine', hz(n), hz(n), t, STEP * 6, 0.05, L[0]);
    if (mel >= 0) this.osc('triangle', hz(tone(ch, mel) + 12), hz(tone(ch, mel) + 12), t, STEP * 3, 0.07, L[0]);
    // 1: bass, walking up to the octave in the answer half
    if (r >= 1) {
      if (s % 4 === 0) this.osc('triangle', hz(ch[0] - 24), hz(ch[0] - 24), t, STEP * 3, 0.3, L[1]);
      if (answer && (s === 6 || s === 14)) this.osc('triangle', hz(ch[0] - 12), hz(ch[0] - 12), t, STEP * 1.5, 0.22, L[1]);
      if (bar === 3 && s === 14) this.osc('triangle', hz(ch[2] - 24), hz(ch[2] - 24), t, STEP * 2, 0.25, L[1]);
    }
    // 2: light drums
    if (r >= 2) {
      if (s % 8 === 0 || (bar % 2 === 1 && s === 11)) kick(0.6, L[2]);
      if (s % 2 === 0) this.noise(t, s === 14 ? 0.18 : 0.04, 0.08, L[2], 'highpass', 7000);
      if (bar === 3 && !answer && s >= 14) snare(0.35, L[2]); // mini fill at the halfway point
    }
    // 3: distorted palm-muted guitar; syncopated fifth stabs in the answer half
    if (r >= 3) {
      if (s % 2 === 0) chug(this.guitar[0], STEP * 1.5);
      else if (answer && (s === 3 || s === 7)) chug(this.guitar[0], STEP, ch[0] + 7);
    }
    // 4: snare, crash, busier kick; full snare fill at the end of the phrase
    if (r >= 4) {
      if (phrase === 7 && s >= 8) { if (s % 2 === 0 || s >= 12) snare(0.4 + (s - 8) * 0.03, L[4]); }
      else if (s === 4 || s === 12) snare(0.5, L[4]);
      if (s === 10) kick(0.6, L[4]);
      if (s === 0 && bar === 0) this.noise(t, 1.2, 0.25, L[4], 'highpass', 5000);
    }
    // 5: C-SUITE: double kick, 16th chugs, and a lead guitar taking the melody in the answer half
    if (r >= 5) {
      kick(0.45, L[5]);
      if (s % 2 === 1) chug(this.guitar[1], STEP);
      if (answer && mel >= 0) this.osc('square', hz(tone(ch, mel) + 12), hz(tone(ch, mel) + 12), t, STEP * 2, 0.06, this.guitar[1]);
    }
    // Boss: drone + choir per bar, a funeral bell on the downbeats.
    if (this.boss) {
      if (s === 0) {
        const bd = STEP * 16 + 0.1;
        this.pad('sawtooth', hz(ch[0] - 24), t, bd, 0.35, this.drone, 0.05);
        this.pad('sawtooth', hz(ch[0] - 24), t, bd, 0.35, this.drone, 0.05, 12);
        for (let i = 0; i < 3; i++) for (const det of [-9, 9]) this.pad('sawtooth', hz(ch[i] + 12), t, bd, 0.05, this.choir, 0.35, det);
      }
      if (s === 0 && bar % 2 === 0) {
        this.osc('sine', hz(ch[0] + 12), hz(ch[0] + 12), t, 2.2, 0.12, this.music);
        this.osc('sine', hz(ch[0] + 12) * 2.76, hz(ch[0] + 12) * 2.76, t, 0.8, 0.04, this.music);
      }
    }
  }
}
