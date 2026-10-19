// Entry point: screens, input and the main loop. The round itself lives in
// sim.js, the drawing in render.js.

import { Cfg } from './config.js';
import { World } from './sim.js';
import { Progress, UPGRADES, ORDER } from './progress.js';
import { Renderer } from './render.js';
import { sfx, unlockAudio } from './audio.js';

const $ = (id) => document.getElementById(id);

const prog = new Progress();
prog.load();

const renderer = new Renderer($('stage'));
let world = null;
let mode = 'shop';           // shop | play | pause | result

// --- Input -----------------------------------------------------------------
const input = { targetX: 0, firing: false, giant: false, pointer: null, lastX: 0, keys: {} };

const canvas = renderer.renderer.domElement;
canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (mode !== 'play') return;
  input.pointer = e.pointerId;
  input.lastX = e.clientX;
  input.firing = true;
  canvas.setPointerCapture(e.pointerId);
  $('hint').style.opacity = 0;
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== input.pointer) return;
  // Relative drag: a full screen-width swipe moves the cannon ~1.3 lanes.
  const dx = e.clientX - input.lastX;
  input.lastX = e.clientX;
  input.targetX += dx * (Cfg.LANE_HALF * 2 * 1.3) / window.innerWidth;
  input.targetX = Math.max(-Cfg.LANE_HALF, Math.min(Cfg.LANE_HALF, input.targetX));
});
const release = (e) => {
  if (e.pointerId !== input.pointer) return;
  input.pointer = null;
  input.firing = false;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (e.code === 'KeyG') input.giant = true;
  unlockAudio();
});
window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });

$('btn-giant').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  unlockAudio();
  input.giant = true;
});

// --- Screens -----------------------------------------------------------------
function show(id, on) { $(id).classList.toggle('hidden', !on); }

function setMode(m) {
  mode = m;
  show('hud', m === 'play' || m === 'pause');
  show('shop', m === 'shop');
  show('result', m === 'result');
  show('pause', m === 'pause');
  input.firing = false;
  input.pointer = null;
}

function newWorld() {
  world = new World(prog);
  renderer.setWorld(world);
  input.targetX = 0;
}

function openShop() {
  newWorld();
  renderShop();
  setMode('shop');
}

function renderShop() {
  $('shop-level').textContent = prog.level;
  $('play-level').textContent = prog.level;
  $('shop-coins').textContent = fmt(prog.coins);
  const cards = $('cards');
  cards.innerHTML = '';
  for (const id of ORDER) {
    const u = UPGRADES[id];
    const maxed = prog.isMaxed(id);
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = id;
    card.innerHTML = `
      <div class="row"><div class="icon">${u.icon}</div>
        <div><div class="name">${u.name}</div><div class="lvl">Nivå ${prog.lvl(id)}/${u.max}</div></div></div>
      <div class="desc">${u.desc}</div>
      <div class="stat">${prog.statText(id)}</div>
      <button class="buy ${maxed ? 'max' : prog.canBuy(id) ? '' : 'off'}">${maxed ? 'MAKS' : '🪙 ' + fmt(prog.cost(id))}</button>`;
    card.querySelector('.buy').addEventListener('click', () => {
      unlockAudio();
      if (prog.buy(id)) {
        sfx.buy();
        renderShop();
        const again = cards.querySelector(`[data-id="${id}"]`);
        if (again) again.classList.add('bought');
      }
    });
    cards.appendChild(card);
  }
}

function startRound() {
  unlockAudio();
  newWorld();
  $('hud-level').textContent = prog.level;
  $('hint').style.opacity = 1;
  setMode('play');
}

function showResult() {
  const won = world.state === 'won';
  prog.coins += world.reward;
  if (won) {
    prog.level += 1;
    prog.bestLevel = Math.max(prog.bestLevel, prog.level);
  }
  prog.save();
  const title = $('result-title');
  title.textContent = won ? 'SEIER!' : 'BORGEN FALT';
  title.classList.toggle('lose', !won);
  $('result-sub').textContent = won
    ? `Nivå ${world.level} knust! ${world.kills} fiender beseiret.`
    : `Fiendebasen hadde ${Math.ceil(world.baseHp)} liv igjen. Kjøp oppgraderinger og prøv igjen!`;
  countUp($('result-coins'), world.reward);
  setMode('result');
}

function countUp(el, value) {
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / 700);
    el.textContent = fmt(Math.round(value * k));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'k';
  return String(n);
}

$('btn-play').addEventListener('click', startRound);
$('btn-continue').addEventListener('click', openShop);
$('btn-pause').addEventListener('click', () => setMode('pause'));
$('btn-resume').addEventListener('click', () => setMode('play'));
$('btn-quit').addEventListener('click', () => { world.finish(false); showResult(); });

// Android back button (called from MainActivity). Returns true if handled.
window.handleBack = () => {
  if (mode === 'play') { setMode('pause'); return true; }
  if (mode === 'pause') { setMode('play'); return true; }
  if (mode === 'result') { openShop(); return true; }
  return false;
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play') setMode('pause');
});

// --- HUD -----------------------------------------------------------------------
let shownCoins = -1, shownCastle = -1;
function updateHud() {
  const c = Math.floor(world.coins);
  if (c !== shownCoins) { shownCoins = c; $('hud-coins').textContent = fmt(c); }
  const hp = Math.max(0, world.castleHp);
  if (hp !== shownCastle) {
    if (hp < shownCastle) { sfx.hurt(); if (navigator.vibrate) navigator.vibrate(40); }
    shownCastle = hp;
    $('hud-castle').textContent = hp;
    $('hud-castle').classList.toggle('hurt', hp / world.castleMax < 0.35);
    $('hud-castle-fill').style.width = `${(100 * hp) / world.castleMax}%`;
  }
  const frac = world.chargeFrac();
  $('giant-ring').style.background = `conic-gradient(var(--gold) ${frac * 360}deg, rgba(20,16,50,0.6) 0deg)`;
  $('btn-giant').classList.toggle('ready', world.giantReady());
}

// --- Main loop -------------------------------------------------------------------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (mode === 'play' && world) {
    const k = input.keys;
    const kx = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0);
    if (kx) input.targetX = Math.max(-Cfg.LANE_HALF, Math.min(Cfg.LANE_HALF, input.targetX + kx * 10 * dt));
    const firing = input.firing || !!k.Space;
    const wasPlaying = world.state === 'playing';
    const hadGiant = world.giantReady();
    // Two half steps keep fast units from skipping through gates on slow frames.
    world.update(dt / 2, input.targetX, firing, input.giant);
    world.update(dt / 2, input.targetX, firing, false);
    if (input.giant && hadGiant) sfx.giant();
    input.giant = false;

    if (world.recoil > 0.9 && firing) sfx.shoot();
    for (const e of world.events) {
      if (e.type === 'pop') sfx.pop();
      if (e.type === 'text') sfx.gate();
    }
    if (world.gates.some((g) => g.flash > 0.95)) sfx.gate();
    if (wasPlaying && world.state !== 'playing') {
      if (world.state === 'won') sfx.win(); else sfx.lose();
    }
    if (world.state !== 'playing' && world.endTime > 1.6) showResult();
    updateHud();
  } else if (world) {
    // Idle preview behind the menus: gates keep moving, the round is frozen.
    if (mode === 'result') {
      world.update(dt, world.cannonX, false, false);
    } else {
      world.time += dt;
      world.animateGates(dt);
    }
  }
  renderer.render(dt);
}

openShop();
requestAnimationFrame(frame);

// Console/test access: mob.world is the running round.
window.mob = { get world() { return world; }, prog };
