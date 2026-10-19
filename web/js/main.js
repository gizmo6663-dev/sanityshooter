// Entry point: screens, input and the main loop. The round itself lives in
// sim.js, the drawing in render.js.

import { Cfg } from './config.js';
import { World } from './sim.js';
import { Progress, UPGRADES, ORDER } from './progress.js';
import { ITEMS, TAGS, TRANSFORMS, tagCounts, activeTransforms } from './items.js';
import { afterWin, pickItem, buyItem, reroll, heal, itemPrice, rerollPrice, healPrice } from './run.js';
import { Renderer } from './render.js';
import { sfx, unlockAudio } from './audio.js';

const $ = (id) => document.getElementById(id);

const prog = new Progress();
prog.load();

const renderer = new Renderer($('stage'));
let world = null;
let mode = 'hub';            // hub | pick | runshop | play | pause | result

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
const SCREENS = ['hub', 'pick', 'runshop', 'result', 'pause'];
function show(id, on) { $(id).classList.toggle('hidden', !on); }

function setMode(m) {
  mode = m;
  show('hud', m === 'play' || m === 'pause');
  for (const id of SCREENS) show(id, m === id);
  hideTip();
  input.firing = false;
  input.pointer = null;
}

/** World for the current run, or a level-1 preview behind the hub. */
function newWorld() {
  const run = prog.run || { level: 1, items: [], castleHp: prog.castleHp() };
  world = new World(prog, run);
  renderer.setWorld(world);
  input.targetX = 0;
}

function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'k';
  return String(n);
}

function tagChips(item, owned) {
  const counts = tagCounts(owned);
  return item.tags.map((t) => {
    const n = Math.min(3, (counts[t] || 0) + (owned.includes(item.id) ? 0 : 1));
    return `<span class="tag ${n >= 3 ? 'done' : ''}" style="background:${TAGS[t].color}">${TAGS[t].name} ${n}/3</span>`;
  }).join('');
}

const RARITY_NAME = { 1: 'VANLIG', 2: 'SJELDEN', 3: 'LEGENDARISK' };

function showTip(html) {
  const tip = $('tip');
  tip.innerHTML = html;
  tip.classList.remove('hidden');
  clearTimeout(showTip.timer);
  showTip.timer = setTimeout(hideTip, 3500);
}
function hideTip() { $('tip').classList.add('hidden'); }

function itemTip(id) {
  const it = ITEMS[id];
  showTip(`<b>${it.icon} ${it.name}</b>${it.desc}`);
}

function itemChips(container, items, withTransforms = false) {
  container.innerHTML = '';
  for (const id of items) {
    const b = document.createElement('button');
    b.className = 'item-chip';
    b.textContent = ITEMS[id].icon;
    b.addEventListener('click', (e) => { e.stopPropagation(); itemTip(id); });
    container.appendChild(b);
  }
  if (withTransforms) {
    for (const t of activeTransforms(items)) {
      const b = document.createElement('button');
      b.className = 'item-chip';
      b.style.background = 'linear-gradient(180deg,#ffe07a,#ffc23d)';
      b.textContent = TRANSFORMS[t].icon;
      b.addEventListener('click', (e) => { e.stopPropagation(); showTip(`<b>${TRANSFORMS[t].icon} ${TRANSFORMS[t].name}</b>${TRANSFORMS[t].desc}`); });
      container.appendChild(b);
    }
  }
}

// --- Hub (workshop) ------------------------------------------------------------
function openHub() {
  newWorld();
  renderHub();
  setMode('hub');
}

function renderHub() {
  $('hub-gems').textContent = fmt(prog.gems);
  $('hub-best').textContent = prog.bestLevel;
  $('btn-run').textContent = prog.run ? `FORTSETT RUN (NIVÅ ${prog.run.level}) ▶` : 'NY RUN ▶';
  show('btn-abandon', !!prog.run);
  const cards = $('hub-cards');
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
      <button class="buy ${maxed ? 'max' : prog.canBuy(id) ? '' : 'off'}">${maxed ? 'MAKS' : '💎 ' + fmt(prog.cost(id))}</button>`;
    card.querySelector('.buy').addEventListener('click', () => {
      unlockAudio();
      if (prog.buy(id)) {
        sfx.buy();
        renderHub();
        const again = cards.querySelector(`[data-id="${id}"]`);
        if (again) again.classList.add('bought');
      }
    });
    cards.appendChild(card);
  }
}

$('btn-run').addEventListener('click', () => {
  unlockAudio();
  if (!prog.run) prog.startRun();
  const run = prog.run;
  if (run.choices) openPick();
  else if (run.stock) openRunShop();
  else startRound();
});
$('btn-abandon').addEventListener('click', () => {
  if (!prog.run) return;
  const level = prog.run.level;
  const gems = prog.endRun();
  showRunOver(level, gems, 'Du avsluttet runen.');
});

// --- Item pick -------------------------------------------------------------------
function openPick() {
  const run = prog.run;
  $('pick-title').textContent = (run.level - 1) % 5 === 0 ? 'BOSSBELØNNING!' : 'VELG EN GJENSTAND';
  const box = $('pick-cards');
  box.innerHTML = '';
  for (const id of run.choices) {
    const it = { ...ITEMS[id], id };
    const card = document.createElement('button');
    card.className = `pick-card r${it.rarity}`;
    card.innerHTML = `
      <div class="big-icon">${it.icon}</div>
      <div>
        <div class="rarity r${it.rarity}t">${RARITY_NAME[it.rarity]}</div>
        <div class="name">${it.name}</div>
        <div class="desc">${it.desc}</div>
        <div class="tags">${tagChips(it, run.items)}</div>
      </div>`;
    card.addEventListener('click', () => {
      unlockAudio();
      const before = activeTransforms(run.items);
      if (!pickItem(prog, run, id)) return;
      sfx.buy();
      const gained = activeTransforms(run.items).filter((t) => !before.includes(t));
      openRunShop();
      if (gained.length) {
        const t = TRANSFORMS[gained[0]];
        sfx.win();
        showTip(`<b>${t.icon} FORVANDLING: ${t.name}!</b>${t.desc}`);
      }
    });
    box.appendChild(card);
  }
  setMode('pick');
}

// --- Run shop ----------------------------------------------------------------------
function openRunShop() {
  renderRunShop();
  setMode('runshop');
}

function renderRunShop() {
  const run = prog.run;
  $('rs-level').textContent = run.level;
  $('next-level').textContent = run.level;
  $('rs-coins').textContent = fmt(run.coins);
  const max = prog.castleHp();
  $('rs-castle').textContent = `${run.castleHp}/${max}`;
  $('rs-castle-fill').style.width = `${(100 * run.castleHp) / max}%`;

  const stock = $('rs-stock');
  stock.innerHTML = '';
  for (const id of run.stock || []) {
    const it = { ...ITEMS[id], id };
    const price = itemPrice(id, run.level);
    const card = document.createElement('div');
    card.className = `card item r${it.rarity}`;
    card.style.border = '3px solid';
    card.innerHTML = `
      <div class="row"><div class="icon">${it.icon}</div>
        <div><div class="name">${it.name}</div><div class="rarity r${it.rarity}t">${RARITY_NAME[it.rarity]}</div></div></div>
      <div class="desc">${it.desc}</div>
      <div class="tags">${tagChips(it, run.items)}</div>
      <button class="buy ${run.coins >= price ? '' : 'off'}">🪙 ${price}</button>`;
    card.querySelector('.buy').addEventListener('click', () => {
      const before = activeTransforms(run.items);
      if (!buyItem(prog, run, id)) return;
      sfx.buy();
      renderRunShop();
      const gained = activeTransforms(run.items).filter((t) => !before.includes(t));
      if (gained.length) {
        const t = TRANSFORMS[gained[0]];
        sfx.win();
        showTip(`<b>${t.icon} FORVANDLING: ${t.name}!</b>${t.desc}`);
      }
    });
    stock.appendChild(card);
  }
  if (!(run.stock || []).length) stock.innerHTML = '<div class="screen-sub">Utsolgt!</div>';

  const rp = rerollPrice(run), hp = healPrice(run);
  $('reroll-price').textContent = `🪙${rp}`;
  $('heal-price').textContent = `🪙${hp}`;
  $('btn-reroll').classList.toggle('off', run.coins < rp);
  $('btn-heal').classList.toggle('off', run.coins < hp || run.castleHp >= max);

  // Synergy progress: tags close to a transformation
  const counts = tagCounts(run.items);
  const active = activeTransforms(run.items);
  const syn = $('rs-synergy');
  syn.innerHTML = '';
  for (const t of Object.keys(TAGS)) {
    const n = counts[t] || 0;
    if (!n) continue;
    const el = document.createElement('span');
    if (active.includes(t)) {
      el.className = 'tf';
      el.textContent = `${TRANSFORMS[t].icon} ${TRANSFORMS[t].name}`;
      el.addEventListener('click', () => showTip(`<b>${TRANSFORMS[t].icon} ${TRANSFORMS[t].name}</b>${TRANSFORMS[t].desc}`));
    } else {
      el.className = 'tag';
      el.style.background = TAGS[t].color;
      el.textContent = `${TAGS[t].name} ${n}/3`;
    }
    syn.appendChild(el);
  }
  itemChips($('rs-items'), run.items);
}

$('btn-reroll').addEventListener('click', () => { if (reroll(prog, prog.run)) { sfx.buy(); renderRunShop(); } });
$('btn-heal').addEventListener('click', () => { if (heal(prog, prog.run)) { sfx.buy(); renderRunShop(); } });
$('btn-next').addEventListener('click', () => startRound());

// --- Rounds ------------------------------------------------------------------------
function startRound() {
  unlockAudio();
  const run = prog.run;
  run.stock = null;
  run.choices = null;
  prog.save();
  newWorld();
  $('hud-level').textContent = run.level + (world.boss ? ' 👹' : '');
  $('hint').style.opacity = 1;
  const hudItems = $('hud-items');
  hudItems.innerHTML = run.items.map((id) => `<span>${ITEMS[id].icon}</span>`).join('') +
    activeTransforms(run.items).map((t) => `<span class="tf">${TRANSFORMS[t].icon}</span>`).join('');
  shownCastle = -1;
  setMode('play');
  if (world.boss) flashBanner('BOSSNIVÅ!', 2.5);
}

let bannerTimer = 0;
function flashBanner(text, secs) {
  const b = $('banner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), secs * 1000);
}

function showResult() {
  const run = prog.run;
  const won = world.state === 'won';
  const title = $('result-title');
  title.classList.toggle('lose', !won);
  show('result-reward', won);
  if (won) {
    const { interest } = afterWin(prog, run, world);
    title.textContent = world.boss ? 'BOSS KNUST!' : 'SEIER!';
    $('result-sub').textContent = `Nivå ${world.level} klart! ${world.kills} fiender beseiret.` +
      (interest ? ` Renter: +${interest} 🪙` : '');
    countUp($('result-coins'), world.reward + interest);
    $('btn-continue').textContent = 'VELG GJENSTAND';
    resultNext = openPick;
    setMode('result');
  } else {
    run.kills += world.kills;
    const level = run.level;
    const gems = prog.endRun();
    showRunOver(level, gems, `Fiendebasen hadde ${fmt(Math.ceil(world.baseHp))} liv igjen.`);
  }
}

function showRunOver(level, gems, why) {
  const title = $('result-title');
  title.textContent = 'BORGEN FALT';
  title.classList.add('lose');
  show('result-reward', true);
  $('result-reward').innerHTML = `💎 +<b id="result-coins">0</b>`;
  $('result-sub').textContent = `${why} Runen endte på nivå ${level}. Bruk edelsteinene i verkstedet!`;
  countUp($('result-coins'), gems);
  $('btn-continue').textContent = 'TIL VERKSTEDET';
  resultNext = () => {
    $('result-reward').innerHTML = `🪙 +<b id="result-coins">0</b>`;
    openHub();
  };
  setMode('result');
}

let resultNext = openHub;

function countUp(el, value) {
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / 700);
    el.textContent = fmt(Math.round(value * k));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

$('btn-continue').addEventListener('click', () => resultNext());
$('btn-pause').addEventListener('click', () => { itemChips($('pause-items'), prog.run.items, true); setMode('pause'); });
$('btn-resume').addEventListener('click', () => setMode('play'));
$('btn-quit').addEventListener('click', () => { world.finish(false); showResult(); });
$('tip').addEventListener('click', hideTip);

// Android back button (called from MainActivity). Returns true if handled.
window.handleBack = () => {
  if (!$('tip').classList.contains('hidden')) { hideTip(); return true; }
  if (mode === 'play') { itemChips($('pause-items'), prog.run.items, true); setMode('pause'); return true; }
  if (mode === 'pause') { setMode('play'); return true; }
  if (mode === 'result') { resultNext(); return true; }
  if (mode === 'runshop' || mode === 'pick') { openHub(); return true; }
  return false;
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play') { itemChips($('pause-items'), prog.run.items, true); setMode('pause'); }
});

// --- HUD -----------------------------------------------------------------------
let shownCoins = -1, shownCastle = -1, shownEnrage = false;
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
  if (!!world.enraged !== shownEnrage) {
    shownEnrage = !!world.enraged;
    if (shownEnrage) flashBanner('RASERI! 😡', 2.5);
  }
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
    // Two half steps keep fast units from skipping through gates on slow frames.
    world.update(dt / 2, input.targetX, firing, input.giant);
    world.update(dt / 2, input.targetX, firing, false);
    input.giant = false;

    if (world.recoil > 0.9 && firing) sfx.shoot();
    for (const e of world.events) {
      if (e.type === 'pop') sfx.pop();
      else if (e.type === 'text') sfx.gate();
      else if (e.type === 'giant') sfx.giant();
      else if (e.type === 'ring') sfx.boom();
      else if (e.type === 'boss') flashBanner('BOSSEN KOMMER! 👹', 2.5);
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

openHub();
requestAnimationFrame(frame);

// Console/test access: mob.world is the running round.
window.mob = { get world() { return world; }, prog, renderer };
