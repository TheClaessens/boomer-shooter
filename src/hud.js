import LOGO from './brand/faktion-logo.svg';
import { RANKS, rankOf, grade } from './style.js';
import { WEAPONS, ORDER, AMMO_MAX } from './weapons.js';
import { DASH_CHARGES } from './player.js';

const $ = (id) => document.getElementById(id);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const DASH_RECHARGE = 1.1;
const POOLS = [['shells', 'SHL'], ['staples', 'STP'], ['toner', 'TNR'], ['cells', 'CEL']];
// Fixed blood splatter spots on the ID photo, revealed as health drops.
const SPLATS = [[9, 14, 3], [27, 20, 2], [15, 31, 3], [24, 9, 2], [7, 25, 2], [30, 30, 3], [18, 22, 2], [12, 8, 2], [28, 14, 2], [20, 36, 3]];
const FIRED_REASONS = ['Insufficient synergy.', 'Failure to circle back.', 'Not a culture fit.', 'Excessive bleeding on company carpet.', 'Missed the all-hands (was eaten).', 'Restructuring.', 'Did not leverage core competencies.'];
const COMMENTS = { S: 'Exceeds all expectations. Corner office pending.', A: 'Strong performer. Eligible for a pizza party.', B: 'Meets expectations. Keep grinding.', C: 'Needs improvement. See attached PIP.', D: 'Concerning. HR would like a word.', F: 'Please clear out your desk.' };

// Restart a CSS animation on an element.
function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export class Hud {
  constructor() {
    this.last = {};
    this.msgT = 0;
    this.hurtA = 0;
    this.flashA = 0;
    this.hitT = 0;
    this.face = 'normal';
    this.faceT = 0;
    this.shownScore = 0;
    this.lastScore = 0;
    this.bossLag = 1;
    this.bannerText = '';
    this.bannerT = 0;
    this.badge = $('badge').getContext('2d');
    this.dashPips = [...$('dash').children].map((i) => i.firstChild);
  }

  set(id, value) {
    if (this.last[id] === value) return;
    this.last[id] = value;
    $(id).textContent = value;
  }

  // Only touch the DOM when a value changes.
  cls(id, value) {
    if (this.last['c' + id] === value) return;
    this.last['c' + id] = value;
    $(id).className = value;
  }

  show(on) { $('hud').hidden = !on; }

  msg(text, dur = 2) {
    if (this.bannerT > 0 && text === this.bannerText) return; // the banner already says it
    $('msg').textContent = text;
    this.msgT = dur;
  }

  // Bonus feed under the style meter: newest on top, each line fades on its own.
  bonus(list) {
    if (!list.length) return;
    const feed = $('feed'), line = document.createElement('div');
    line.innerHTML = list.map((b) => `<span class="${b === 'TERMINATED' ? 'term' : ''}">+${b}</span>`).join(' ');
    line.onanimationend = () => line.remove();
    feed.prepend(line);
    while (feed.children.length > 4) feed.lastChild.remove();
  }

  hurt(angle, dmg) {
    this.hurtA = Math.min(0.7, this.hurtA + 0.15 + dmg * 0.015);
    $('dir').style.background = `radial-gradient(circle at ${50 + Math.sin(angle) * 50}% ${50 - Math.cos(angle) * 50}%, rgba(255,0,0,0.85), transparent 45%)`;
    this.face = 'ouch';
    this.faceT = 0.5;
  }

  grin() {
    if (this.face !== 'ouch') { this.face = 'grin'; this.faceT = 0.8; }
  }

  pickupFlash() { this.flashA = Math.max(this.flashA, 0.25); $('flash').style.background = '#ffe080'; }

  rankUp(name) {
    this.flashA = 0.6;
    $('flash').style.background = '#ffd030';
    this.msg(`PROMOTED: ${name}`, 2);
    replay($('rank'), 'pop');
  }

  hitMarker(kill) {
    this.hitT = kill ? 0.3 : 0.12;
    this.cls('hit', kill ? 'kill' : 'on');
  }

  terminate() {
    this.flashA = 0.7;
    $('flash').style.background = '#ffd030';
    replay($('stamp'), 'go');
  }

  banner(text) {
    const el = $('banner');
    el.textContent = this.bannerText = text;
    this.bannerT = 2;
    replay(el, 'go');
  }

  intro(levelName) {
    const [kick, name] = levelName.includes(':') ? levelName.split(/:\s*/) : ['FAKTION HQ', levelName];
    $('introkick').textContent = kick;
    $('introname').textContent = name;
    replay($('intro'), 'go');
    $('feed').replaceChildren();
    // A new level starts clean: no hurt/flash/message carried over from the last one. One-shot CSS animations
    // restart whenever the HUD goes from hidden to shown, so strip them or the last stamp/banner replays.
    $('stamp').classList.remove('go');
    $('banner').classList.remove('go');
    $('msg').textContent = '';
    this.hurtA = this.flashA = this.msgT = this.bonusT = 0;
    this.shownScore = this.lastScore = 0;
    this.bossLag = 1;
  }

  update(g, dt) {
    const p = g.player, s = g.style, r = rankOf(s);
    // Status bar
    const hp = Math.ceil(p.health);
    this.set('hp', hp);
    this.cls('hp', hp <= 25 ? 'low' : hp > 100 ? 'over' : '');
    this.set('ar', Math.floor(p.armor));
    const W = WEAPONS[p.weapon];
    this.set('ammolabel', W.ammo ? W.ammo.toUpperCase() : 'AXE');
    const ammo = W.ammo ? p.ammo[W.ammo] : -1;
    this.set('ammo', ammo < 0 ? '--' : ammo);
    this.cls('ammo', ammo >= 0 && ammo < W.use ? 'empty' : ammo >= 0 && ammo <= AMMO_MAX[W.ammo] * 0.2 ? 'low' : '');
    let tab = '';
    for (const [pool, short] of POOLS) {
      if (!ORDER.some((w) => p.owned[w] && WEAPONS[w].ammo === pool)) continue;
      tab += `<tr class="${pool === W.ammo ? 'cur' : ''}"><td>${short}</td><td>${p.ammo[pool]}</td><td>/${AMMO_MAX[pool]}</td></tr>`;
    }
    if (this.last.tab !== tab) $('ammotab').innerHTML = this.last.tab = tab;
    let arms = '';
    for (let i = 0; i < ORDER.length; i++) {
      const w = ORDER[i], A = WEAPONS[w];
      const c = w === p.weapon ? 'on' : !p.owned[w] ? 'off' : A.ammo && p.ammo[A.ammo] < A.use ? 'dry' : '';
      arms += `<b class="${c}">${i + 1}</b>`;
    }
    if (this.last.arms !== arms) $('arms').innerHTML = this.last.arms = arms;
    $('key').hidden = !p.hasKey;
    // Dash pips: full per charge, the recharging one fills up.
    for (let i = 0; i < DASH_CHARGES; i++) {
      const f = i < p.dashCharges ? 100 : i === p.dashCharges ? Math.round((1 - p.dashRecharge / DASH_RECHARGE) * 20) * 5 : 0;
      const pip = this.dashPips[i];
      if (pip && pip._f !== f) { pip._f = f; pip.style.height = f + '%'; pip.parentNode.className = f === 100 ? 'full' : ''; }
    }

    // Style meter
    this.set('rank', RANKS[r]);
    if (this.last.r !== r) { this.last.r = r; $('rank').classList.remove('r0', 'r1', 'r2', 'r3', 'r4', 'r5'); $('rank').classList.add('r' + r); }
    $('fill').style.width = `${Math.min(100, s.points - r * 100)}%`;

    // Score: rolls up like an odometer; gains pop underneath.
    if (g.score < this.lastScore) this.shownScore = g.score;
    if (g.score > this.lastScore) {
      const add = $('scoreadd');
      add.textContent = '+' + (g.score - this.lastScore);
      replay(add, 'go');
    }
    this.lastScore = g.score;
    this.shownScore += Math.ceil((g.score - this.shownScore) * Math.min(1, dt * 8));
    this.set('score', String(this.shownScore).padStart(6, '0'));
    const endless = g.levelId === 'overtime';
    this.set('kills', `${endless ? `KILLS ${g.stats.kills}` : `KILLS ${g.stats.kills}/${g.stats.total}`}  ${fmt(g.stats.time)}`);
    $('wave').hidden = !g.wave;
    if (g.wave) this.set('wave', `WAVE ${g.wave}`);

    // Boss bar; the white chunk trails behind the real hp so big hits read.
    const B = g.boss, bossOn = !!(B && B.active && !B.dead && B.state !== 'sleep');
    $('boss').hidden = !bossOn;
    if (bossOn) {
      const f = Math.max(0, B.hp / B.def.hp);
      this.set('bossname', B.def.name ?? 'BOSS');
      this.bossLag = Math.max(f, this.bossLag - dt * 0.25);
      $('bossfill').style.width = f * 100 + '%';
      $('bosslag').style.width = this.bossLag * 100 + '%';
    } else this.bossLag = 1;
    if (g.audio?.boss && !bossOn) g.audio.setBoss(false); // safety net: never leave boss music on after the fight

    // Timers & overlays
    this.msgT -= dt;
    this.bannerT -= dt;
    $('msg').style.opacity = this.msgT > 0 ? 1 : 0;
    this.hurtA = Math.max(0, this.hurtA - dt * 1.5);
    $('hurt').style.opacity = this.hurtA * 0.6;
    $('dir').style.opacity = this.hurtA * 1.4;
    this.flashA = Math.max(0, this.flashA - dt * 2);
    $('flash').style.opacity = this.flashA;
    $('vig').style.opacity = !p.dead && p.health <= 25 ? 0.55 + 0.35 * Math.sin(g.time * (p.health <= 10 ? 10 : 6)) : 0;
    this.hitT -= dt;
    if (this.hitT <= 0) this.cls('hit', '');
    this.faceT -= dt;
    if (this.faceT <= 0) this.face = 'normal';
    const face = p.dead ? 'dead' : this.face;
    const key = `${Math.ceil(p.health / 15)}${face}`;
    if (this.last.badge !== key) {
      this.last.badge = key;
      this.drawBadge(p.health, face);
    }
  }

  // The ID-badge photo: Doom's face, but HR-approved. Bloodier as health drops.
  drawBadge(health, face) {
    const c = this.badge;
    c.fillStyle = '#d8e4f0'; c.fillRect(0, 0, 40, 48);
    c.fillStyle = '#2050a0'; c.fillRect(0, 0, 40, 6);
    c.fillStyle = '#7890a8'; c.fillRect(4, 8, 32, 32);
    c.fillStyle = '#3a2a1a'; c.fillRect(10, 11, 20, 6);
    c.fillStyle = '#e0b090'; c.fillRect(11, 15, 18, 20);
    c.fillStyle = '#2a4a8a'; c.fillRect(8, 35, 24, 5);
    c.fillStyle = '#202020';
    if (face === 'dead') {
      for (const x of [14, 23]) { c.fillRect(x, 20, 1, 1); c.fillRect(x + 2, 22, 1, 1); c.fillRect(x + 1, 21, 1, 1); c.fillRect(x + 2, 20, 1, 1); c.fillRect(x, 22, 1, 1); }
    } else {
      const squint = face === 'ouch' || health < 30 ? 1 : 2;
      c.fillRect(14, 21, 3, squint);
      c.fillRect(23, 21, 3, squint);
    }
    if (face === 'ouch' || face === 'dead') c.fillRect(17, 28, 6, 4);
    else if (face === 'grin') { c.fillRect(15, 28, 10, 2); c.fillStyle = '#fff'; c.fillRect(16, 28, 8, 1); }
    else c.fillRect(17, 29, 6, 1);
    c.fillStyle = '#a00';
    const n = Math.round((1 - Math.max(0, health) / 100) * SPLATS.length);
    for (const [x, y, s] of SPLATS.slice(0, n)) { c.fillRect(x, y, s, s); c.fillRect(x + 1, y + s, 1, 2); }
    c.fillStyle = '#203040'; c.fillRect(4, 42, 32, 2); c.fillRect(4, 45, 20, 1);
  }

  // kind: 'title' | 'paused' | 'dead' | 'score' | null. info: title {save, levels, campaign}; score/dead {best, isNew, next};
  // paused {start: level name} when the page boots straight into a level.
  // Buttons call this.onAction(action, arg) (set by main.js): 'start' <level id>, 'retry', 'next', 'menu', 'resume'.
  screen(kind, g, info = {}) {
    const el = $('screen');
    cancelAnimationFrame(this.countRaf);
    el.hidden = !kind;
    el.className = kind ?? '';
    this.show(kind !== 'title');
    if (kind === 'title') {
      const { save, levels, campaign } = info;
      const floor = (id, i) => {
        const L = levels[id], best = save.best[id];
        if (!save.unlocked.includes(id)) return `<button class="floor" disabled><span class="fl">${String(i + 1).padStart(2, '0')}</span><span class="nm"><s>CLASSIFIED</s></span><span class="lock">LOCKED</span></button>`;
        return `<button class="floor" data-action="start" data-arg="${id}"><span class="fl">${String(i + 1).padStart(2, '0')}</span><span class="nm">${L.name}</span><span class="best">${best ? `BEST ${best}` : L.par ? `PAR ${fmt(L.par)}` : ''}</span></button>`;
      };
      el.innerHTML = `<div class="logo"><img class="brand" src="${LOGO}" alt="Faktion"><h1>OVERTIME</h1><p class="tag">Demons came in through the server room. Your shift isn't over.</p></div>
        <div class="paper memo">
          <div class="clip"></div>
          <div class="head">INTEROFFICE MEMO</div>
          <table class="meta"><tr><td>TO:</td><td>All remaining Faktioneers</td></tr><tr><td>FROM:</td><td>Management (possessed)</td></tr><tr><td>RE:</td><td>Mandatory overtime</td></tr></table>
          <div class="menu">${campaign.map(floor).join('')}
            <button class="floor endless" data-action="start" data-arg="overtime"><span class="fl">&#8734;</span><span class="nm">OVERTIME <small>endless</small></span><span class="best">${save.best.overtime ? `BEST ${save.best.overtime}` : 'NO CAP'}</span></button>
          </div>
          <table class="keys">
            <tr><td>WASD</td><td>move</td><td>MOUSE</td><td>look</td></tr>
            <tr><td>SPACE</td><td>jump</td><td>SHIFT</td><td>dash</td></tr>
            <tr><td>CLICK</td><td>fire</td><td>1-6/WHEEL</td><td>weapons</td></tr>
            <tr><td>R</td><td>restart</td><td>P</td><td>pixel filter</td></tr>
          </table>
        </div>`;
    } else if (kind === 'paused') {
      el.innerHTML = `<div class="paper memo small">
          <div class="clip"></div>
          <div class="head">${info?.start ?? 'COFFEE BREAK'}</div>
          <p>${info?.start ? 'Your shift starts now.' : 'Mandatory 15 minutes. Demons are also on break.'}</p>
          <div class="menu row"><button data-action="resume">${info?.start ? 'CLOCK IN' : 'RESUME'}</button><button data-action="retry">RESTART [R]</button><button data-action="menu">QUIT</button></div>
        </div>
        <p class="blink">${info?.start ? 'CLICK TO CLOCK IN' : 'CLICK TO RESUME'}</p>`;
    } else if (kind === 'dead') {
      const endless = g?.levelId === 'overtime', reason = FIRED_REASONS[Math.floor(Math.random() * FIRED_REASONS.length)];
      el.innerHTML = `<h2 class="fired">YOU'RE FIRED</h2>
        <div class="paper slip">
          <div class="head">NOTICE OF TERMINATION</div>
          <table class="meta"><tr><td>REASON:</td><td>${reason}</td></tr>
            ${g ? `<tr><td>KILLS:</td><td>${g.stats.kills}</td></tr>` : ''}
            ${endless ? `${g.wave ? `<tr><td>WAVE:</td><td>${g.wave}</td></tr>` : ''}<tr><td>SCORE:</td><td><b>${g.score}</b>${info?.isNew ? ' <span class="new">NEW BEST!</span>' : ` <span class="dim">best ${info?.best ?? 0}</span>`}</td></tr>` : ''}
          </table>
          <div class="menu row"><button data-action="retry">REAPPLY [R]</button><button data-action="menu">MENU</button></div>
        </div>
        <p class="blink">PRESS R OR CLICK TO REAPPLY</p>`;
      g?.audio?.play('stamp');
    } else if (kind === 'score') {
      const st = g.stats, peak = g.style.peak;
      const gr = grade({ kills: st.kills, total: st.total, secrets: st.secrets, secretsTotal: st.secretsTotal, time: st.time, peak, par: g.level.par });
      const rows = [
        ['Kills', `<i data-n="${st.kills}">0</i> / ${st.total} <span class="dim">(${Math.round((st.kills / Math.max(1, st.total)) * 100)}%)</span>`],
        ['Secrets', `<i data-n="${st.secrets}">0</i> / ${st.secretsTotal}`],
        ['Time', `${fmt(st.time)} <span class="dim">(par ${fmt(g.level.par)})</span>`],
        ['Peak rank', RANKS[peak]],
        ['Score', `<b><i data-n="${g.score}">0</i></b>${info.isNew ? ' <span class="new">NEW BEST!</span>' : ` <span class="dim">best ${info.best}</span>`}`],
      ];
      const D = 0.35, gradeAt = 0.4 + rows.length * D;
      el.innerHTML = `<div class="paper review">
          <div class="clip"></div>
          <div class="head">PERFORMANCE REVIEW</div>
          <table class="meta"><tr><td>EMPLOYEE:</td><td>You</td></tr><tr><td>DEPT:</td><td>${g.level.name}</td></tr></table>
          <table class="rows">${rows.map(([k, v], i) => `<tr style="animation-delay:${0.4 + i * D}s"><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
          <div class="verdict" style="animation-delay:${gradeAt}s"><span class="comment">${COMMENTS[gr]}</span><div class="grade g${gr}">${gr}</div></div>
          <div class="menu row">${info.next ? '<button data-action="next">NEXT FLOOR [ENTER]</button>' : ''}<button data-action="retry">REPLAY [R]</button><button data-action="menu">MENU</button></div>
        </div>`;
      rows.forEach((_, i) => g.audio?.play('tick', null, 0.4 + i * D));
      g.audio?.play('stamp', null, gradeAt + 0.1);
      // Count the numbers up as each row lands.
      const nums = [...el.querySelectorAll('i[data-n]')], t0 = performance.now();
      const rowOf = (n) => [...el.querySelectorAll('.rows tr')].indexOf(n.closest('tr'));
      const starts = nums.map((n) => 0.4 + rowOf(n) * D);
      const count = (now) => {
        const t = (now - t0) / 1000;
        let done = true;
        nums.forEach((n, i) => {
          const k = Math.max(0, Math.min(1, (t - starts[i]) / 0.5));
          n.textContent = Math.round(+n.dataset.n * k);
          if (k < 1) done = false;
        });
        if (!done) this.countRaf = requestAnimationFrame(count);
      };
      this.countRaf = requestAnimationFrame(count);
    }
    for (const b of el.querySelectorAll('button[data-action]')) b.onclick = (e) => { e.stopPropagation(); this.onAction?.(b.dataset.action, b.dataset.arg); };
  }
}
