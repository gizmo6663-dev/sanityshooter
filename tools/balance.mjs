// Balance test without graphics:  node tools/balance.mjs [runs] [--verbose]
// A bot plays whole runs: it fights (keeps its distance, dodges shots),
// collects pickups, explores the floor room by room, beats the boss and
// takes the trapdoor. Prints how far each run got and how long it took.

import { World } from '../web/js/world.js';
import { Cfg } from '../web/js/config.js';
import { toTileI, toTileJ, tileX, tileZ, DOOR_TILE } from '../web/js/dungeon.js';
import { ITEMS } from '../web/js/items.js';

const DT = 1 / 30;
const RUNS = Number(process.argv[2] || 10);
const VERBOSE = process.argv.includes('--verbose');
const W = Cfg.ROOM_W, D = Cfg.ROOM_D;
const DIRS = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] };

const norm = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };

/** Line of sight wide enough for the player's body. */
function wideLOS(w, p, tx, tz) {
  const [nx, nz] = norm(tx - p.x, tz - p.z);
  const r = p.r + 0.05;
  for (const s of [-1, 0, 1]) {
    const ox = -nz * r * s, oz = nx * r * s;
    if (!w.hasLOS({ x: p.x + ox, z: p.z + oz }, { x: tx + ox, z: tz + oz })) return false;
  }
  return true;
}

/** Direction along a BFS field towards a target point inside the room. */
function pathTo(w, tx, tz) {
  const p = w.player;
  const field = new Int16Array(W * D).fill(-1);
  const ti = Math.max(0, Math.min(W - 1, toTileI(tx))), tj = Math.max(0, Math.min(D - 1, toTileJ(tz)));
  const q = [ti + tj * W];
  field[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % W, j = (k - i) / W;
    for (const [di, dj] of Object.values(DIRS)) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= D) continue;
      const nk = ni + nj * W;
      if (field[nk] >= 0 || w.room.tiles[nk]) continue;
      field[nk] = field[k] + 1;
      q.push(nk);
    }
  }
  const pi = toTileI(p.x), pj = toTileJ(p.z);
  if ((pi === ti && pj === tj) || wideLOS(w, p, tx, tz)) return norm(tx - p.x, tz - p.z);
  let best = null, bv = 1e9;
  for (const [di, dj] of Object.values(DIRS)) {
    const ni = pi + di, nj = pj + dj;
    if (ni < 0 || nj < 0 || ni >= W || nj >= D) continue;
    const v = field[ni + nj * W];
    if (v >= 0 && v < bv) { bv = v; best = [ni, nj]; }
  }
  if (!best) return norm(tx - p.x, tz - p.z);
  return norm(tileX(best[0]) - p.x, tileZ(best[1]) - p.z);
}

/** Next door to take: towards the nearest unvisited room, then the boss. */
function nextDoor(w) {
  const rooms = w.dungeon.rooms;
  const start = w.room;
  const prev = new Map([[start.key, null]]);
  const q = [start];
  let goal = null;
  const bossTime = [...rooms.values()].every((r) => r.visited || r.type === 'boss');
  for (let h = 0; h < q.length; h++) {
    const r = q[h];
    if (r !== start && ((!r.visited && r.type !== 'boss') || (bossTime && r.type === 'boss'))) { goal = r; break; }
    for (const d of Object.keys(DIRS)) {
      if (!r.doors[d]) continue;
      const n = rooms.get(w.neighbourKey(r, d));
      if (prev.has(n.key)) continue;
      prev.set(n.key, [r, d]);
      q.push(n);
    }
  }
  if (!goal) return null;
  let cur = goal, dir = null;
  while (prev.get(cur.key)) { const [r, d] = prev.get(cur.key); dir = d; cur = r; }
  return dir;
}

function botInput(w) {
  const p = w.player;
  let mx = 0, mz = 0, dash = false;
  const active = w.enemies.filter((e) => e.spawnT <= 0);
  if (active.length) {
    // keep a comfortable distance from the nearest enemy, strafe around it
    let near = null, nd = 1e9;
    for (const e of active) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < nd) { nd = d; near = e; } }
    const [ax, az] = norm(near.x - p.x, near.z - p.z);
    const want = near.boss ? 4.5 : 3.2;
    if (!w.hasLOS(p, near)) { [mx, mz] = pathTo(w, near.x, near.z); return [mx, mz, false]; }
    if (nd < want - 0.6) { mx -= ax; mz -= az; } else if (nd > want + 1.5) { [mx, mz] = pathTo(w, near.x, near.z); }
    mx += -az * 0.6; mz += ax * 0.6;
    mx -= (p.x / (W / 2)) * 0.4; mz -= (p.z / (D / 2)) * 0.4;
    for (const b of w.eshots) {
      const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
      if (d > 2.5) continue;
      const toward = (b.vx * dx + b.vz * dz) / (Math.hypot(b.vx, b.vz) * d || 1);
      if (toward > 0.6) {
        mx += -b.vz * 0.4; mz += b.vx * 0.4;
        if (d < 1.0 && p.dashCd <= 0) dash = true;
      }
    }
    if (nd < 1.0 && p.dashCd <= 0) dash = true;
    return [mx, mz, dash];
  }
  // room clear: pick things up, then move on
  if (w.orbs.length) return [0, 0, false];
  const wanted = w.room.pickups.filter((it) => it.kind === 'coin' ||
    (it.kind === 'heart' && p.hp < w.stats.maxHp && (!it.price || p.coins >= it.price)) ||
    (it.kind === 'item' && (!it.price || p.coins >= it.price)));
  if (wanted.length) return [...pathTo(w, wanted[0].x, wanted[0].z), false];
  const trap = w.room.pickups.find((it) => it.kind === 'trapdoor');
  if (trap) return [...pathTo(w, trap.x, trap.z), false];
  const d = nextDoor(w);
  if (!d) return [0, 0, false];
  const [ti, tj] = DOOR_TILE[d];
  if (Math.hypot(tileX(ti) - p.x, tileZ(tj) - p.z) < 1.2) return [DIRS[d][0] + (0 - p.x) * (DIRS[d][1] ? 1 : 0), DIRS[d][1] + (0 - p.z) * (DIRS[d][0] ? 1 : 0), false];
  return [...pathTo(w, tileX(ti), tileZ(tj)), false];
}

let wins = 0;
for (let n = 1; n <= RUNS; n++) {
  const w = new World();
  const floorTimes = [];
  let floorStart = 0, lastFloor = 0, stuck = 0, lastRoom = w.roomKey;
  while ((w.state === 'play' || w.state === 'transition' || w.state === 'levelup') && w.time < 3600) {
    if (w.state === 'levelup') w.choosePerk(w.choices[Math.floor(Math.random() * w.choices.length)]);
    const [mx, mz, dash] = botInput(w);
    w.update(DT, mx, mz, dash);
    w.events.length = 0;
    if (w.floor !== lastFloor) { floorTimes.push(Math.round(w.time - floorStart)); floorStart = w.time; lastFloor = w.floor; }
    if (w.roomKey !== lastRoom) { lastRoom = w.roomKey; stuck = 0; } else if (++stuck > 30 * 150) break;
  }
  floorTimes.push(Math.round(w.time - floorStart));
  if (w.state === 'won') wins++;
  const items = w.items.map((id) => ITEMS[id].icon).join('');
  const how = w.state === 'won' ? 'VANT' : w.state === 'dead' ? 'død ' : 'fast';
  console.log(`run ${String(n).padStart(2)}: ${how} etasje ${w.floor + 1}  ${(w.time / 60).toFixed(1)} min [${floorTimes.join('s ')}s]  nivå ${w.player.level}  drap ${w.kills}  liv ${Math.max(0, w.player.hp)}/${w.stats.maxHp}  ${items}`);
  if (VERBOSE) console.log('   perks:', w.perks.join(','));
}
console.log(`vant ${wins}/${RUNS}`);
