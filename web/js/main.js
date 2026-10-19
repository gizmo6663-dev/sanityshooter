// Entry point: screens, input (floating joystick + dash) and the main loop.
// The game itself lives in world.js, the drawing in render.js.

import { Cfg } from './config.js';
import { World } from './world.js';
import { Progress } from './progress.js';
import { Renderer } from './render.js';
import { ITEMS, PERKS, TRANSFORMS, activeTransforms } from './items.js';
import { ENEMIES } from './enemies.js';
import { sfx, unlockAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const FLOOR_NAMES = ['Kjelleren', 'Katakombene', 'Benhuset', 'Dypet'];

const prog = new Progress();
prog.load();
const renderer = new Renderer($('stage'));
let world = null;
let mode = 'title';          // title | play | levelup | pause | end

// --- Input -------------------------------------------------------------------
const input = { mx: 0, mz: 0, dash: false, stick: null, ox: 0, oy: 0, keys: {} };
const STICK_R = 50;
const canvas = renderer.renderer.domElement;

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (mode !== 'play' || input.stick !== null) return;
  input.stick = e.pointerId;
  input.ox = e.clientX; input.oy = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  const st = $('stick');
  st.style.left = `${e.clientX}px`;
  st.style.top = `${e.clientY}px`;
  st.classList.remove('hidden');
  $('knob').style.transform = 'translate(0,0)';
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== input.stick) return;
  let dx = e.clientX - input.ox, dy = e.clientY - input.oy;
  const d = Math.hypot(dx, dy);
  if (d > STICK_R) {
    // the stick follows the finger, so you never run out of room
    input.ox += (dx / d) * (d - STICK_R); input.oy += (dy / d) * (d - STICK_R);
    dx = e.clientX - input.ox; dy = e.clientY - input.oy;
    $('stick').style.left = `${input.ox}px`;
    $('stick').style.top = `${input.oy}px`;
  }
  input.mx = dx / STICK_R;
  input.mz = -dy / STICK_R;
  $('knob').style.transform = `translate(${dx}px,${dy}px)`;
});
const release = (e) => {
  if (e.pointerId !== input.stick) return;
  input.stick = null;
  input.mx = input.mz = 0;
  $('stick').classList.add('hidden');
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

$('btn-dash').addEventListener('pointerdown', (e) => { e.stopPropagation(); unlockAudio(); input.dash = true; });
window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'ShiftLeft') input.dash = true;
  if (e.code === 'Escape' && mode === 'play') openPause();
  unlockAudio();
});
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });

function moveVector() {
  const k = input.keys;
  let mx = input.mx, mz = input.mz;
  mx += (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  mz += (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
  const l = Math.hypot(mx, mz);
  if (l < 0.15) return [0, 0];
  return l > 1 ? [mx / l, mz / l] : [mx, mz];
}

// --- Screens -------------------------------------------------------------------
const SCREENS = ['title', 'levelup', 'pause', 'end'];
function show(id, on) { $(id).classList.toggle('hidden', !on); }
function setMode(m) {
  mode = m;
  show('hud', m === 'play' || m === 'levelup' || m === 'pause');
  for (const s of SCREENS) show(s, m === s);
  hideTip();
  if (m !== 'play') {
    input.stick = null; input.mx = input.mz = 0;
    $('stick').classList.add('hidden');
  }
}

function openTitle() {
  world = new World();
  renderer.setWorld(world);
  const s = [];
  if (prog.runs) s.push(`Forsøk: ${prog.runs} · Seire: ${prog.wins}`, `Dypeste etasje: ${prog.bestFloor}`, `Fiender drept: ${prog.kills}`);
  $('title-stats').innerHTML = s.join('<br>');
  setMode('title');
}

function startRun() {
  unlockAudio();
  world = new World();
  renderer.setWorld(world);
  lastFloor = -1;
  endTimer = 0;
  setMode('play');
}

$('btn-start').addEventListener('click', startRun);
$('btn-again').addEventListener('click', startRun);
$('btn-pause').addEventListener('click', openPause);
$('btn-resume').addEventListener('click', () => setMode('play'));
$('btn-giveup').addEventListener('click', () => { world.player.hp = 0; world.state = 'dead'; prog.recordRun(world); openEnd(); });
$('tip').addEventListener('click', hideTip);

function itemChips(el, items) {
  el.innerHTML = '';
  for (const id of items) {
    const b = document.createElement('button');
    b.className = 'item-chip';
    b.textContent = ITEMS[id].icon;
    b.addEventListener('click', () => showTip(`<b>${ITEMS[id].icon} ${ITEMS[id].name}</b>${ITEMS[id].desc}`));
    el.appendChild(b);
  }
  for (const t of activeTransforms(items)) {
    const b = document.createElement('button');
    b.className = 'item-chip tf';
    b.textContent = TRANSFORMS[t].icon;
    b.addEventListener('click', () => showTip(`<b>${TRANSFORMS[t].icon} ${TRANSFORMS[t].name}</b>${TRANSFORMS[t].desc}`));
    el.appendChild(b);
  }
}

function statsText() {
  const s = world.stats;
  return [
    `Skade ${(s.damage * s.damageMult).toFixed(1)} · Skuddtakt ${(s.fireRate * s.fireRateMult).toFixed(1)}/s`,
    `Fart ${(s.speed * s.speedMult).toFixed(1)} · Rekkevidde ${(s.range * s.rangeMult).toFixed(1)}`,
    `Nivå ${world.player.level} · Drap ${world.kills} · Tid ${fmtTime(world.time)}`,
  ].join('<br>');
}

function openPause() {
  if (mode !== 'play') return;
  itemChips($('pause-items'), world.items);
  $('pause-stats').innerHTML = statsText();
  setMode('pause');
}

function openLevelUp() {
  const box = $('perk-cards');
  box.innerHTML = '';
  for (const id of world.choices) {
    const p = PERKS[id];
    const c = document.createElement('button');
    c.className = 'card';
    c.innerHTML = `<div class="icon">${p.icon}</div><div><div class="name">${p.name}</div><div class="desc">${p.desc}</div></div>`;
    c.addEventListener('click', () => {
      world.choosePerk(id);
      sfx.levelup();
      setMode(world.state === 'levelup' ? 'levelup' : 'play');
      if (world.state === 'levelup') openLevelUp();
    });
    box.appendChild(c);
  }
  setMode('levelup');
}

function openEnd() {
  const won = world.state === 'won';
  $('end-title').textContent = won ? 'DU NÅDDE BUNNEN' : 'DU DØDE';
  $('end-sub').innerHTML = `${FLOOR_NAMES[world.floor]} · ${fmtTime(world.time)} · ${world.kills} drept · nivå ${world.player.level}` +
    (won ? '<br>Mørket slipper taket. Denne gangen.' : '');
  itemChips($('end-items'), world.items);
  setMode('end');
}

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

let tipTimer = 0;
function showTip(html) {
  $('tip').innerHTML = html;
  $('tip').classList.remove('hidden');
  clearTimeout(tipTimer);
  tipTimer = setTimeout(hideTip, 3500);
}
function hideTip() { $('tip').classList.add('hidden'); }

let announceTimer = 0;
function announce(title, sub, secs = 2.6) {
  $('announce-title').textContent = title;
  $('announce-sub').textContent = sub || '';
  $('announce').classList.add('show');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => $('announce').classList.remove('show'), secs * 1000);
}

window.handleBack = () => {
  if (!$('tip').classList.contains('hidden')) { hideTip(); return true; }
  if (mode === 'play') { openPause(); return true; }
  if (mode === 'pause') { setMode('play'); return true; }
  if (mode === 'end') { openTitle(); return true; }
  return false;
};
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') openPause(); });

// --- HUD ------------------------------------------------------------------------
const HEART_PATH = 'M10 17 C4 12 1 9 1 5.5 C1 3 3 1 5.5 1 C7.5 1 9 2.2 10 4 C11 2.2 12.5 1 14.5 1 C17 1 19 3 19 5.5 C19 9 16 12 10 17Z';
function heartSvg(kind) {
  const fill = kind === 'full' ? '#a8141c' : kind === 'half' ? 'url(#half)' : 'rgba(0,0,0,0.5)';
  return `<svg class="heart" viewBox="0 0 20 18"><defs><linearGradient id="half"><stop offset="50%" stop-color="#a8141c"/><stop offset="50%" stop-color="rgba(0,0,0,0.5)"/></linearGradient></defs>
    <path d="${HEART_PATH}" fill="${fill}" stroke="#2a0606" stroke-width="1.4"/></svg>`;
}

let shown = {};
function updateHud() {
  const p = world.player, s = world.stats;
  const hk = `${p.hp}/${s.maxHp}`;
  if (shown.hearts !== hk) {
    shown.hearts = hk;
    let h = '';
    for (let i = 0; i < s.maxHp / 2; i++) {
      const v = p.hp - i * 2;
      h += heartSvg(v >= 2 ? 'full' : v === 1 ? 'half' : 'empty');
    }
    $('hearts').innerHTML = h;
  }
  if (shown.coins !== p.coins) { shown.coins = p.coins; $('hud-coins').textContent = p.coins; }
  const fn = `${FLOOR_NAMES[world.floor]} ${['I', 'II', 'III', 'IV'][world.floor]}`;
  if (shown.floor !== fn) { shown.floor = fn; $('hud-floor').textContent = fn; }
  $('xp-fill').style.width = `${Math.min(100, (100 * p.xp) / p.xpNext)}%`;
  if (shown.level !== p.level) { shown.level = p.level; $('xp-level').textContent = `nivå ${p.level}`; }
  if (shown.items !== world.items.length) {
    shown.items = world.items.length;
    $('hud-items').innerHTML = world.items.map((id) => `<span>${ITEMS[id].icon}</span>`).join('');
  }
  const cd = p.dashCd / (Cfg.DASH_COOLDOWN * s.dashCooldownMult);
  $('btn-dash').classList.toggle('cooling', cd > 0);
  $('dash-ring').style.background = cd > 0 ? `conic-gradient(rgba(216,207,188,0.5) ${(1 - cd) * 360}deg, transparent 0deg)` : 'none';
  $('dash-ring').style.webkitMask = 'radial-gradient(circle, transparent 60%, #000 62%)';
  const boss = world.enemies.find((e) => e.boss);
  show('boss-bar', !!boss);
  if (boss) $('boss-fill').style.width = `${Math.max(0, (100 * boss.hp) / boss.maxHp)}%`;
  if (world.roomKey !== shown.room || world.room.cleared !== shown.cleared) {
    shown.room = world.roomKey; shown.cleared = world.room.cleared;
    drawMinimap();
  }
}

function drawMinimap() {
  const c = $('minimap'), g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  const cur = world.room;
  const cell = 26, cw = 22, ch = 16;
  const cx = c.width / 2, cy = c.height / 2;
  for (const r of world.dungeon.rooms.values()) {
    if (!r.visited && !r.seen) continue;
    const x = cx + (r.gx - cur.gx) * cell - cw / 2;
    const y = cy - (r.gy - cur.gy) * (ch + 6) - ch / 2;
    if (x < -cw || y < -ch || x > c.width || y > c.height) continue;
    g.fillStyle = r === cur ? '#e8e0d0' : r.visited ? '#6a6258' : 'rgba(40,36,32,0.9)';
    g.strokeStyle = 'rgba(0,0,0,0.9)';
    g.lineWidth = 2;
    g.fillRect(x, y, cw, ch);
    g.strokeRect(x, y, cw, ch);
    const icon = { boss: '☠', treasure: '♛', shop: '¢' }[r.type];
    if (icon) {
      g.font = 'bold 13px Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = r.type === 'boss' ? '#c4262c' : '#d8b25a';
      g.fillText(icon, x + cw / 2, y + ch / 2 + 1);
    }
  }
}

// --- Events from the world -----------------------------------------------------------
let lastFloor = -1, endTimer = 0;
function handleEvents() {
  for (const e of world.events) {
    switch (e.type) {
      case 'shoot': sfx.shoot(); break;
      case 'hit': sfx.hit(); break;
      case 'kill': sfx.kill(); break;
      case 'hurt':
        sfx.hurt();
        $('hurt-flash').classList.add('on');
        setTimeout(() => $('hurt-flash').classList.remove('on'), 60);
        if (navigator.vibrate) navigator.vibrate(60);
        break;
      case 'dash': sfx.dash(); break;
      case 'door': sfx.door(); break;
      case 'clear': sfx.clear(); break;
      case 'coin': sfx.coin(); break;
      case 'xp': sfx.xp(); break;
      case 'heal': sfx.heal(); break;
      case 'explode': sfx.explode(); break;
      case 'slam': sfx.slam(); break;
      case 'item': {
        const it = ITEMS[e.id];
        sfx.item();
        announce(`${it.icon} ${it.name}`, it.text);
        break;
      }
      case 'transform': {
        const t = TRANSFORMS[e.id];
        setTimeout(() => announce(`${t.icon} ${t.name}!`, t.desc, 3.2), 2700);
        break;
      }
      case 'boss':
        sfx.boss();
        $('boss-name').textContent = e.name.toUpperCase();
        announce(e.name, 'Den har ventet på deg.');
        break;
      case 'bossdead': announce('Seier', world.floor + 1 < Cfg.FLOORS ? 'En luke åpner seg i gulvet …' : ''); break;
      case 'floor':
        if (world.floor !== lastFloor) {
          lastFloor = world.floor;
          announce(`${FLOOR_NAMES[world.floor]}`, ['Det lukter fukt og forråtnelse.', 'De døde ligger ikke stille her.', 'Bein på bein på bein.', 'Herfra kommer ingen opp igjen.'][world.floor], 3);
        }
        break;
      case 'levelup': sfx.levelup(); break;
      case 'dead': sfx.dead(); break;
      case 'won': sfx.win(); break;
    }
  }
}

// --- Main loop ---------------------------------------------------------------------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (mode === 'play' && world) {
    const [mx, mz] = moveVector();
    world.update(dt / 2, mx, mz, input.dash);
    world.update(dt / 2, mx, mz, false);
    input.dash = false;
    handleEvents();
    updateHud();
    if (world.state === 'levelup') openLevelUp();
    if (world.state === 'dead' || world.state === 'won') {
      endTimer += dt;
      if (endTimer > 1.6) { prog.recordRun(world); openEnd(); }
    }
  } else if (world && mode !== 'pause' && mode !== 'levelup') {
    world.time += dt;
  }
  renderer.render(dt);
  if (world) world.events.length = 0;
}

openTitle();
requestAnimationFrame(frame);

// Console/test access
window.dypet = { get world() { return world; }, renderer, prog, ENEMIES };
