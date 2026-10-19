// Floor generation. A floor is a set of rooms on a GRID x GRID map, grown
// outwards from the start room. Dead ends become the boss room (farthest),
// the treasure room and the shop. Every room gets a rock layout that never
// blocks a doorway, plus the enemies that will appear when you enter.

import { Cfg } from './config.js';
import { pickSpawns } from './enemies.js';

const W = Cfg.ROOM_W, D = Cfg.ROOM_D;
const DIRS = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] };
export const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' };

/** Tile index helpers. Tile (i, j): i 0..W-1 west->east, j 0..D-1 south->north. */
export const tileIndex = (i, j) => j * W + i;
export const tileX = (i) => i - (W - 1) / 2;
export const tileZ = (j) => j - (D - 1) / 2;
export const toTileI = (x) => Math.floor(x + W / 2);
export const toTileJ = (z) => Math.floor(z + D / 2);

/** The tile just inside each doorway. */
export const DOOR_TILE = {
  n: [(W - 1) / 2, D - 1], s: [(W - 1) / 2, 0],
  e: [W - 1, (D - 1) / 2], w: [0, (D - 1) / 2],
};

export function generateFloor(floor, rand) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const f = tryFloor(floor, rand);
    if (f) return f;
  }
  throw new Error('could not generate floor');
}

function tryFloor(floor, rand) {
  const G = Cfg.GRID;
  const target = Cfg.ROOMS_BASE + Cfg.ROOMS_PER_FLOOR * floor + Math.floor(rand() * 2);
  const cells = new Map();
  const key = (x, y) => x + y * G;
  const has = (x, y) => cells.has(key(x, y));
  const neighbours = (x, y) => Object.values(DIRS).filter(([dx, dy]) => has(x + dx, y + dy)).length;
  const sx = Math.floor(G / 2), sy = Math.floor(G / 2);
  cells.set(key(sx, sy), { gx: sx, gy: sy, dist: 0 });
  const queue = [[sx, sy]];
  while (queue.length && cells.size < target) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx, ny = y + dy;
      if (cells.size >= target) break;
      if (nx < 0 || ny < 0 || nx >= G || ny >= G || has(nx, ny)) continue;
      if (neighbours(nx, ny) > 1) continue;      // keep it a branching tree, no blobs
      if (rand() < 0.5) continue;
      cells.set(key(nx, ny), { gx: nx, gy: ny, dist: cells.get(key(x, y)).dist + 1 });
      queue.push([nx, ny]);
    }
    if (!queue.length && cells.size < target) {
      // restart growth from a random existing room
      const all = [...cells.values()];
      const c = all[Math.floor(rand() * all.length)];
      queue.push([c.gx, c.gy]);
    }
  }
  if (cells.size < target) return null;

  const deadEnds = [...cells.values()]
    .filter((c) => c.dist > 0 && neighbours(c.gx, c.gy) === 1)
    .sort((a, b) => b.dist - a.dist);
  if (deadEnds.length < 3) return null;

  const rooms = new Map();
  for (const c of cells.values()) {
    const doors = {};
    for (const [d, [dx, dy]] of Object.entries(DIRS)) doors[d] = has(c.gx + dx, c.gy + dy);
    rooms.set(key(c.gx, c.gy), {
      key: key(c.gx, c.gy), gx: c.gx, gy: c.gy, dist: c.dist, doors,
      type: c.dist === 0 ? 'start' : 'normal',
      tiles: null, spawns: [], cleared: c.dist === 0, visited: c.dist === 0, seen: false,
      pickups: [], decals: [],
    });
  }
  rooms.get(key(deadEnds[0].gx, deadEnds[0].gy)).type = 'boss';
  rooms.get(key(deadEnds[1].gx, deadEnds[1].gy)).type = 'treasure';
  rooms.get(key(deadEnds[2].gx, deadEnds[2].gy)).type = 'shop';

  for (const r of rooms.values()) {
    r.tiles = layoutRoom(r, rand);
    if (r.type === 'normal') r.spawns = placeSpawns(r, floor, rand);
    if (r.type !== 'normal' && r.type !== 'boss') r.cleared = true;
  }
  return { floor, rooms, start: key(sx, sy), key };
}

// --- Rock layouts ------------------------------------------------------------
const PATTERNS = [
  () => [],
  () => [[2, 3], [6, 3], [2, 9], [6, 9]],
  () => { const t = []; for (let i = 3; i <= 5; i++) for (let j = 5; j <= 7; j++) t.push([i, j]); return t; },
  (rand) => { const t = []; const n = 6 + Math.floor(rand() * 6); for (let k = 0; k < n; k++) t.push([Math.floor(rand() * W), Math.floor(rand() * D)]); return t; },
  () => { const t = []; for (const j of [4, 8]) for (const i of [1, 2, 6, 7]) t.push([i, j]); return t; },
  () => { const t = []; for (let i = 2; i <= 6; i++) { if (i !== 4) { t.push([i, 3]); t.push([i, 9]); } } for (let j = 4; j <= 8; j++) { if (j !== 6) { t.push([2, j]); t.push([6, j]); } } return t; },
  () => [[1, 1], [2, 1], [1, 2], [7, 1], [6, 1], [7, 2], [1, 11], [2, 11], [1, 10], [7, 11], [6, 11], [7, 10]],
  () => { const t = []; for (let j = 2; j <= 10; j++) if (j !== 6) { t.push([2, j]); t.push([6, j]); } return t; },
  () => { const t = []; for (let k = 0; k < 4; k++) { t.push([1 + k, 4 + k]); t.push([7 - k, 8 - k]); } return t; },
];

function layoutRoom(room, rand) {
  const tiles = new Uint8Array(W * D);
  let pattern = 0;
  if (room.type === 'normal') pattern = Math.floor(rand() * PATTERNS.length);
  else if (room.type === 'boss' && rand() < 0.4) pattern = 1;
  for (const [i, j] of PATTERNS[pattern](rand)) {
    if (i >= 0 && j >= 0 && i < W && j < D) tiles[tileIndex(i, j)] = 1;
  }
  // Keep doorway approaches and the middle of the room clear.
  const clear = (i, j) => { if (i >= 0 && j >= 0 && i < W && j < D) tiles[tileIndex(i, j)] = 0; };
  for (const d of ['n', 's', 'e', 'w']) {
    const [di, dj] = DOOR_TILE[d];
    for (let a = -1; a <= 1; a++) {
      for (let b = 0; b <= 2; b++) {
        if (d === 'n') clear(di + a, dj - b);
        if (d === 's') clear(di + a, dj + b);
        if (d === 'e') clear(di - b, dj + a);
        if (d === 'w') clear(di + b, dj + a);
      }
    }
  }
  if (room.type !== 'normal') clear((W - 1) / 2, (D - 1) / 2);
  // Anything not reachable from the doors becomes rock, so nothing spawns
  // in a sealed pocket.
  const seen = new Uint8Array(W * D);
  const [si, sj] = DOOR_TILE.s;
  const stack = [[si, sj]];
  seen[tileIndex(si, sj)] = 1;
  while (stack.length) {
    const [i, j] = stack.pop();
    for (const [dx, dy] of Object.values(DIRS)) {
      const ni = i + dx, nj = j + dy;
      if (ni < 0 || nj < 0 || ni >= W || nj >= D) continue;
      const k = tileIndex(ni, nj);
      if (seen[k] || tiles[k]) continue;
      seen[k] = 1;
      stack.push([ni, nj]);
    }
  }
  for (let k = 0; k < W * D; k++) if (!seen[k]) tiles[k] = 1;
  return tiles;
}

function placeSpawns(room, floor, rand) {
  const free = [];
  for (let j = 2; j < D - 2; j++) {
    for (let i = 0; i < W; i++) if (!room.tiles[tileIndex(i, j)]) free.push([i, j]);
  }
  const budget = Cfg.ROOM_BUDGET + Cfg.ROOM_BUDGET_PER_FLOOR * floor + rand() * 2;
  return pickSpawns(budget, floor, rand).map((type) => {
    const [i, j] = free[Math.floor(rand() * free.length)];
    return { type, i, j };
  });
}
