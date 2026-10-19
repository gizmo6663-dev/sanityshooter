// Balance test without graphics:  node tools/balance.mjs [runs] [--verbose]
// A bot plays run after run: it aims at the best gate, dodges catapult
// rocks, takes a random item after each win, shops (repair first, then the
// cheapest item) and spends its gems in the workshop when a run ends.
// Prints how far each run got and how long the rounds took.

import { World } from '../web/js/sim.js';
import { Progress, ORDER } from '../web/js/progress.js';
import { afterWin, pickItem, buyItem, heal, itemPrice } from '../web/js/run.js';
import { ITEMS, activeTransforms } from '../web/js/items.js';

const DT = 1 / 30;
const MAX_TIME = 240;
const RUNS = Number(process.argv[2] || 12);
const VERBOSE = process.argv.includes('--verbose');

function aim(w) {
  let best = 0, bestV = -1;
  for (const g of w.gates) {
    if (g.used) continue;
    if (g.kind === 'div') continue;
    const v = (g.kind === 'mul' ? g.value : 1.5) - g.z * 0.01;
    if (v > bestV) { bestV = v; best = g.x; }
  }
  for (const r of w.rocks) {
    if (r.t > r.dur * 0.25 && Math.abs(r.tx - w.cannonX) < 1.8) return r.tx + (r.tx > 0 ? -2.6 : 2.6);
  }
  return best;
}

function play(meta, run) {
  const w = new World(meta, run);
  while (w.state === 'playing' && w.time < MAX_TIME) {
    w.update(DT, aim(w), true, w.giantReady());
    w.events.length = 0;
  }
  if (w.state === 'playing') w.finish(false);
  return w;
}

function shop(meta, run) {
  while (run.castleHp < meta.castleHp() * 0.6 && heal(meta, run));
  for (;;) {
    const stock = (run.stock || []).slice().sort((a, b) => itemPrice(a, run.level) - itemPrice(b, run.level));
    if (!stock.length || !buyItem(meta, run, stock[0])) return;
  }
}

function workshop(meta) {
  for (;;) {
    let pick = null;
    for (const id of ORDER) if (meta.canBuy(id) && (!pick || meta.cost(id) < meta.cost(pick))) pick = id;
    if (!pick) return;
    meta.buy(pick);
  }
}

const meta = new Progress();
meta.autosave = false;
let totalTime = 0;
for (let n = 1; n <= RUNS; n++) {
  meta.startRun();
  const run = meta.run;
  const times = [];
  let w;
  for (;;) {
    w = play(meta, run);
    totalTime += w.time;
    times.push(Math.round(w.time));
    if (VERBOSE) {
      console.log(`  niva ${run.level} ${w.state} t=${Math.round(w.time)}s borg=${Math.max(0, w.castleHp)}/${w.castleMax} base=${Math.max(0, Math.round(w.baseHp))}/${w.baseMax} +${w.reward}`);
    }
    if (w.state !== 'won') break;
    afterWin(meta, run, w);
    pickItem(meta, run, run.choices[Math.floor(Math.random() * run.choices.length)]);
    shop(meta, run);
  }
  const items = run.items.map((id) => ITEMS[id].icon).join('');
  const tf = activeTransforms(run.items).join(',');
  const reached = run.level;
  const gems = meta.endRun();
  workshop(meta);
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  console.log(`run ${String(n).padStart(2)}: ${w.time >= MAX_TIME ? 'TID ' : 'død '}nådde nivå ${String(reached).padStart(2)}  snitt ${avg}s/runde  [${times.join(' ')}]  +${gems} edelsteiner  ${items} ${tf ? '[' + tf + ']' : ''}`);
}
console.log(`spilletid ${Math.round(totalTime / 60)} min, beste nivå ${meta.bestLevel}`);
console.log(ORDER.map((id) => `${id}=${meta.lvl(id)}`).join(' '));
