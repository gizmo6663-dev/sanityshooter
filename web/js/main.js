// Entry point: screens, input (anchored joystick + dash) and the main loop.
// The game itself lives in world.js, the drawing in render2d.js.

import { Cfg } from './config.js';
import { World } from './world.js';
import { Progress } from './progress.js';
import { Renderer } from './render2d.js';
import { ITEMS, TRANSFORMS, activeTransforms } from './items.js';
import { ENEMIES } from './enemies.js';
import { sfx, unlockAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const FLOOR_NAMES = ['Kjelleren', 'Katakombene', 'Benhuset', 'Dypet'];

const prog = new Progress();
prog.load();
const renderer = new Renderer($('stage'));
let world = null;
let mode = 'title';          // title | play | pause | end

// --- Input -------------------------------------------------------------------
const input = { mx: 0, mz: 0, dash: false, stick: null, ox: 0, oy: 0, keys: {} };
const STICK_R = 50;
const canvas = renderer.canvas;

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
  // The stick stays where the finger first landed; the knob stops at the
  // rim, but the direction keeps following the finger.
  let dx = e.clientX - input.ox, dy = e.clientY - input.oy;
  const d = Math.hypot(dx, dy);
  if (d > STICK_R) { dx = (dx / d) * STICK_R; dy = (dy / d) * STICK_R; }
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

$('btn-dash').addEventListener('pointerdown', (e) => {
  e.stopPropagation(); unlockAudio(); input.dash = true;
  $('btn-dash').classList.remove('pressed'); void $('btn-dash').offsetWidth; $('btn-dash').classList.add('pressed');
});

// Which side the dash button sits on (the other hand steers anywhere).
const DASH_KEY = 'dypet.dashSide';
let dashSide = 'left';
try { dashSide = localStorage.getItem(DASH_KEY) || 'left'; } catch (e) { /* storage unavailable */ }
function applyDashSide() {
  $('btn-dash').classList.toggle('right', dashSide === 'right');
  $('btn-dashside').textContent = `DASH-KNAPP: ${dashSide === 'right' ? 'HØYRE' : 'VENSTRE'}`;
}
$('btn-dashside').addEventListener('click', () => {
  dashSide = dashSide === 'right' ? 'left' : 'right';
  try { localStorage.setItem(DASH_KEY, dashSide); } catch (e) { /* storage unavailable */ }
  applyDashSide();
});
applyDashSide();
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
const SCREENS = ['title', 'pause', 'end'];
function show(id, on) { $(id).classList.toggle('hidden', !on); }
function setMode(m) {
  mode = m;
  show('hud', m === 'play' || m === 'pause');
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
  // embers drifting up behind the logo
  const em = $('embers');
  if (!em.children.length) {
    for (let k = 0; k < 22; k++) {
      const i = document.createElement('i');
      i.style.left = `${Math.random() * 100}%`;
      i.style.animationDuration = `${5 + Math.random() * 6}s`;
      i.style.animationDelay = `${-Math.random() * 10}s`;
      i.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
      if (Math.random() < 0.4) { i.style.width = i.style.height = '2px'; }
      em.appendChild(i);
    }
  }
  setMode('title');
}

function startRun() {
  unlockAudio();
  world = new World();
  renderer.setWorld(world);
  lastFloor = -1;
  endTimer = 0;
  freeze = slow = 0;
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
    `Drap ${world.kills} · Tid ${fmtTime(world.time)}`,
  ].join('<br>');
}

function openPause() {
  if (mode !== 'play') return;
  itemChips($('pause-items'), world.items);
  $('pause-stats').innerHTML = statsText();
  setMode('pause');
}

function openEnd() {
  const won = world.state === 'won';
  $('end-title').textContent = won ? 'DU NÅDDE BUNNEN' : 'DU DØDE';
  $('end-sub').innerHTML = `${FLOOR_NAMES[world.floor]} · ${fmtTime(world.time)} · ${world.kills} drept` +
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
function updateHud() {
  // Hearts, coins, xp, minimap and the boss bar are drawn in pixels by the
  // renderer; only the dash button's cooldown ring lives in HTML.
  const p = world.player, s = world.stats;
  const cd = p.dashCd / (Cfg.DASH_COOLDOWN * s.dashCooldownMult);
  const btn = $('btn-dash');
  if (btn.classList.contains('cooling') && cd <= 0) {
    // flash when it is ready again
    btn.classList.remove('ready'); void btn.offsetWidth; btn.classList.add('ready');
  }
  btn.classList.toggle('cooling', cd > 0);
  $('dash-ring').style.background = cd > 0 ? `conic-gradient(rgba(216,207,188,0.5) ${(1 - cd) * 360}deg, transparent 0deg)` : 'none';
  $('dash-ring').style.webkitMask = 'radial-gradient(circle, transparent 60%, #000 62%)';
}

function placeButtons() {
  $('btn-pause').style.top = `${renderer.hudBottomCss + 4}px`;
}
window.addEventListener('resize', placeButtons);
placeButtons();


// --- Events from the world -----------------------------------------------------------
let lastFloor = -1, endTimer = 0;
let freeze = 0, slow = 0;      // hit-stop and slow motion, in real seconds
function handleEvents() {
  for (const e of world.events) {
    switch (e.type) {
      case 'shoot': sfx.shoot(); break;
      case 'hit': sfx.hit(); break;
      case 'kill': sfx.kill(); break;
      case 'hurt':
        freeze = 0.07;
        sfx.hurt();
        $('hurt-flash').classList.add('on');
        setTimeout(() => $('hurt-flash').classList.remove('on'), 60);
        if (navigator.vibrate) navigator.vibrate(60);
        break;
      case 'dash': sfx.dash(); break;
      case 'door': sfx.door(); break;
      case 'clear': sfx.clear(); break;
      case 'coin': sfx.coin(); break;
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
        break;
      case 'bossdead': slow = 1.3; announce('Seier', world.floor + 1 < Cfg.FLOORS ? 'En luke åpner seg i gulvet …' : ''); break;
      case 'floor':
        if (world.floor !== lastFloor) {
          lastFloor = world.floor;
          announce(`${FLOOR_NAMES[world.floor]}`, ['Det lukter fukt og forråtnelse.', 'De døde ligger ikke stille her.', 'Bein på bein på bein.', 'Herfra kommer ingen opp igjen.'][world.floor], 3);
        }
        break;
      case 'block': sfx.hit(); break;
      case 'zap': sfx.zap(); break;
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
    if (renderer.bossIntro) {
      // the world waits while the boss is introduced
    } else if (freeze > 0) {
      freeze -= dt;
    } else {
      const k = slow > 0 ? 0.35 : 1;
      slow = Math.max(0, slow - dt);
      world.update((dt * k) / 2, mx, mz, input.dash);
      world.update((dt * k) / 2, mx, mz, false);
      input.dash = false;
    }
    handleEvents();
    updateHud();
    if (world.state === 'dead' || world.state === 'won') {
      endTimer += dt;
      if (endTimer > 1.6) { prog.recordRun(world); openEnd(); }
    }
  } else if (world && mode !== 'pause') {
    world.time += dt;
  }
  renderer.render(dt);
  if (world) world.events.length = 0;
}

openTitle();
requestAnimationFrame(frame);

// Console/test access
window.dypet = { get world() { return world; }, renderer, prog, ENEMIES };
