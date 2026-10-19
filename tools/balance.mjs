// Balance test without graphics:  node tools/balance.mjs [levels]
// A bot plays level after level, buys the cheapest upgrade between rounds
// and retries on a loss. Prints how long each level took and how many tries.

import { World } from '../web/js/sim.js';
import { Progress, ORDER } from '../web/js/progress.js';

const DT = 1 / 60;
const MAX_TIME = 150;
const LEVELS = Number(process.argv[2] || 30);

function aim(w) {
  // Track the most valuable gate that is still in play.
  let best = 0, bestV = -1;
  for (const g of w.gates) {
    if (g.used) continue;
    const v = (g.kind === 'mul' ? g.value : 1.5) - g.z * 0.01;
    if (v > bestV) { bestV = v; best = g.x; }
  }
  return best;
}

function play(p) {
  const w = new World(p);
  while (w.state === 'playing' && w.time < MAX_TIME) {
    w.update(DT, aim(w), true, w.giantReady());
    w.events.length = 0;
  }
  if (w.state === 'playing') w.finish(false);
  return w;
}

function shop(p) {
  for (;;) {
    let pick = null;
    for (const id of ORDER) if (p.canBuy(id) && (!pick || p.cost(id) < p.cost(pick))) pick = id;
    if (!pick) return;
    p.buy(pick);
  }
}

const p = new Progress();
p.autosave = false;
let rounds = 0, tries = 0, totalTime = 0;
while (p.level <= LEVELS && rounds < 250) {
  rounds++; tries++;
  const w = play(p);
  totalTime += w.time;
  p.coins += w.reward;
  const tag = w.state === 'won' ? 'VUNNET' : '  tapt';
  console.log(`niva ${String(p.level).padStart(2)} ${tag} forsok=${tries} t=${Math.round(w.time)}s +${w.reward} base=${Math.max(0, Math.round(w.baseHp))}/${w.baseMax} borg=${Math.max(0, w.castleHp)}/${w.castleMax}`);
  if (w.state === 'won') { p.level++; tries = 0; }
  shop(p);
}
console.log(`runder=${rounds} spilletid=${Math.round(totalTime / 60)}min niva=${p.level}`);
console.log(ORDER.map((id) => `${id}=${p.lvl(id)}`).join(' '));
