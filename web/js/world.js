// The whole simulation of a run. Knows nothing about drawing, the DOM or
// input: main.js feeds it a movement vector and a dash flag, the renderer
// reads the fields below. Runs in Node for the balance bot.
//
// Positions are local to the current room (centre = 0,0). The renderer adds
// the room's position on the floor grid.

import { Cfg } from './config.js';
import { generateFloor, OPPOSITE, tileIndex, toTileI, toTileJ, tileX, tileZ, DOOR_TILE } from './dungeon.js';
import { ENEMIES } from './enemies.js';
import { ITEMS, ITEM_IDS, PERKS, buildStats, activeTransforms } from './items.js';

const W = Cfg.ROOM_W, D = Cfg.ROOM_D, HW = W / 2, HD = D / 2;
const TAU = Math.PI * 2;
const DIR_VEC = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] };
const XP_VALUE = { fly: 1, grub: 2, eye: 3, ram: 4, slime: 3, bloat: 40 };

let nextId = 1;

export class World {
  constructor(rand = Math.random) {
    this.rand = rand;
    this.time = 0;
    this.state = 'play';     // play | transition | levelup | dead | won
    this.events = [];
    this.shake = 0;
    this.kills = 0;
    this.items = [];
    this.perks = [];
    this.pool = ITEM_IDS.slice();
    this.stats = buildStats([], []);
    this.player = {
      x: 0, z: 0, r: Cfg.PLAYER_R, hp: Cfg.PLAYER_HP, coins: 0,
      xp: 0, level: 1, xpNext: Cfg.XP_FIRST,
      vx: 0, vz: 0, fireCd: 0, dashT: 0, dashCd: 0, dashX: 0, dashZ: 1, iframes: 0,
      faceX: 0, faceZ: -1, aimX: 0, aimZ: -1, moving: false, leechCount: 0, dashHit: new Set(),
    };
    this.enemies = [];
    this.shots = [];
    this.eshots = [];
    this.orbs = [];
    this.clouds = [];
    this.choices = null;
    this.flow = new Int16Array(W * D);
    this.flowTimer = 0;
    this.transition = null;
    this.newFloor(0);
  }

  // ======================================================================
  // Floors and rooms
  // ======================================================================
  newFloor(f) {
    this.floor = f;
    this.dungeon = generateFloor(f, this.rand);
    for (const r of this.dungeon.rooms.values()) {
      if (r.type === 'treasure') r.pickups.push({ kind: 'item', id: this.drawItem(), x: 0, z: 0 });
      if (r.type === 'shop') {
        r.pickups.push({ kind: 'item', id: this.drawItem(), x: -2, z: 1, price: Cfg.ITEM_PRICE });
        r.pickups.push({ kind: 'item', id: this.drawItem(), x: 2, z: 1, price: Cfg.ITEM_PRICE });
        r.pickups.push({ kind: 'heart', x: 0, z: -1, price: Cfg.HEART_PRICE });
      }
    }
    this.enterRoom(this.dungeon.start, null);
    this.player.x = 0;
    this.player.z = 0;
    this.events.push({ type: 'floor', floor: f });
  }

  drawItem() {
    if (!this.pool.length) this.pool = ITEM_IDS.filter((id) => !this.items.includes(id));
    if (!this.pool.length) return 'nail';
    const k = Math.floor(this.rand() * this.pool.length);
    return this.pool.splice(k, 1)[0];
  }

  get room() { return this.dungeon.rooms.get(this.roomKey); }

  neighbourKey(room, dir) {
    const [dx, dy] = DIR_VEC[dir];
    return this.dungeon.key(room.gx + dx, room.gy + dy);
  }

  enterRoom(key, fromDir) {
    const prev = this.roomKey;
    // Anything left behind is collected on the way out.
    for (const o of this.orbs) this.gainXp(o.value);
    this.orbs = [];
    this.shots = [];
    this.eshots = [];
    this.clouds = [];
    this.enemies = [];
    this.roomKey = key;
    const room = this.room;
    room.visited = true;
    for (const d of ['n', 's', 'e', 'w']) {
      if (room.doors[d]) this.dungeon.rooms.get(this.neighbourKey(room, d)).seen = true;
    }
    const p = this.player;
    if (fromDir) {
      // Arrive just inside the door on the opposite side.
      const side = OPPOSITE[fromDir];
      const [ti, tj] = DOOR_TILE[side];
      p.x = tileX(ti) * 0.92;
      p.z = tileZ(tj) * 0.92;
      this.transition = { from: prev, to: key, t: 0 };
      this.state = 'transition';
    }
    if (!room.cleared) {
      if (room.type === 'boss') {
        const b = this.spawnEnemy('bloat', 0, 3, false);
        b.spawnT = 1.2;
        this.events.push({ type: 'boss', name: ENEMIES.bloat.name });
      }
      for (const s of room.spawns) {
        const e = this.spawnEnemy(s.type, tileX(s.i) + (this.rand() - 0.5) * 0.4, tileZ(s.j) + (this.rand() - 0.5) * 0.4, false);
        // never right on top of the player
        if (Math.hypot(e.x - p.x, e.z - p.z) < 2.5) e.z = -e.z;
      }
    }
    this.flowTimer = 0;
  }

  spawnEnemy(type, x, z, instant) {
    const d = ENEMIES[type];
    const scale = 1 + Cfg.ENEMY_HP_PER_FLOOR * this.floor;
    const e = {
      id: nextId++, type, x, z, vx: 0, vz: 0, r: d.r, flying: !!d.flying, boss: !!d.boss,
      hp: d.hp * scale * (d.boss ? 1 + 0.3 * this.floor : 1), maxHp: 0,
      t: 0, phase: this.rand() * TAU, face: -Math.PI / 2, alive: true,
      spawnT: instant ? 0 : Cfg.SPAWN_DELAY, flash: 0,
      burn: 0, chill: 0, frozen: 0, poison: 0, lift: 0, hitCd: new Map(),
    };
    e.maxHp = e.hp;
    if (d.init) d.init(e);
    this.enemies.push(e);
    return e;
  }

  // ======================================================================
  // Update
  // ======================================================================
  update(dt, mx, mz, dash) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 18);
    if (this.state === 'transition') {
      this.transition.t += dt;
      if (this.transition.t >= Cfg.TRANSITION) { this.transition = null; this.state = this.choices ? 'levelup' : 'play'; }
      return;
    }
    if (this.state !== 'play') return;
    if (this.winAt && this.time >= this.winAt) {
      this.state = 'won';
      this.events.push({ type: 'won' });
      return;
    }

    this.updatePlayer(dt, mx, mz, dash);
    if (this.state !== 'play') return;   // walked through a door
    this.updateFlow(dt);
    this.updateEnemies(dt);
    this.updateShots(dt);
    this.updateEnemyShots(dt);
    this.updateOrbitals(dt);
    this.updateClouds(dt);
    this.updatePickups(dt);
    this.enemies = this.enemies.filter((e) => e.alive);
    this.checkClear();
    if (this.player.hp <= 0 && this.state === 'play') {
      this.state = 'dead';
      this.events.push({ type: 'dead' });
    }
  }

  // --- Player ----------------------------------------------------------------
  updatePlayer(dt, mx, mz, dash) {
    const p = this.player, s = this.stats;
    p.iframes = Math.max(0, p.iframes - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    p.moving = len > 0.1;
    if (p.moving) { p.faceX = mx; p.faceZ = mz; }

    if (dash && p.dashCd <= 0 && p.dashT <= 0) {
      const l = Math.hypot(p.faceX, p.faceZ) || 1;
      p.dashX = p.faceX / l; p.dashZ = p.faceZ / l;
      p.dashT = Cfg.DASH_TIME;
      p.dashCd = Cfg.DASH_COOLDOWN * s.dashCooldownMult;
      p.dashHit.clear();
      this.events.push({ type: 'dash' });
    }
    let vx, vz;
    if (p.dashT > 0) {
      p.dashT -= dt;
      vx = p.dashX * Cfg.DASH_SPEED; vz = p.dashZ * Cfg.DASH_SPEED;
      if (s.dashDamage) {
        for (const e of this.enemies) {
          if (!this.active(e) || p.dashHit.has(e.id)) continue;
          if (Math.hypot(e.x - p.x, e.z - p.z) < e.r + p.r + 0.3) {
            p.dashHit.add(e.id);
            this.damageEnemy(e, s.dashDamage * s.damageMult, this.shotEffects());
          }
        }
      }
    } else {
      // Ease into and out of motion instead of snapping to full speed.
      const sp = s.speed * s.speedMult;
      const k = Math.min(1, dt * (p.moving ? 16 : 20));
      p.vx += (mx * sp - p.vx) * k;
      p.vz += (mz * sp - p.vz) * k;
      vx = p.vx; vz = p.vz;
    }
    this.moveCircle(p, vx * dt, vz * dt, true);
    if (this.checkDoors()) return;

    // Auto-fire at the nearest enemy, preferring ones in sight.
    p.fireCd -= dt;
    const target = this.pickTarget();
    if (target) {
      const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz) || 1;
      p.aimX = dx / d; p.aimZ = dz / d;
      if (p.fireCd <= 0) {
        p.fireCd = 1 / (s.fireRate * s.fireRateMult);
        this.firePlayer(Math.atan2(dz, dx));
      }
    } else {
      p.aimX = p.faceX; p.aimZ = p.faceZ;
    }
  }

  active(e) { return e.alive && e.spawnT <= 0; }

  pickTarget() {
    const p = this.player;
    let best = null, bd = 1e9;
    for (const e of this.enemies) {
      if (!this.active(e)) continue;
      let d = Math.hypot(e.x - p.x, e.z - p.z);
      if (!this.hasLOS(p, e)) d += 6;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  shotEffects() {
    const s = this.stats;
    return { fire: s.fire, ice: s.ice, poison: s.poison };
  }

  firePlayer(angle) {
    const p = this.player, s = this.stats;
    const n = s.shots;
    const dmg = s.damage * s.damageMult;
    const speed = s.shotSpeed * s.shotSpeedMult;
    for (let k = 0; k < n; k++) {
      const a = angle + (k - (n - 1) / 2) * s.spread;
      this.shots.push({
        x: p.x + Math.cos(a) * 0.3, z: p.z + Math.sin(a) * 0.3,
        vx: Math.cos(a) * speed, vz: Math.sin(a) * speed,
        dmg, r: Cfg.SHOT_R * s.shotSize, left: s.range * s.rangeMult,
        pierce: s.pierce, hit: new Set(), child: false, t: Math.random() * 6,
        fx: this.shotEffects(),
      });
    }
    this.events.push({ type: 'shoot' });
  }

  hurtPlayer(n) {
    const p = this.player;
    if (p.iframes > 0 || p.dashT > 0 || this.state !== 'play') return;
    p.hp -= n;
    p.iframes = Cfg.IFRAMES;
    this.shake = Math.max(this.shake, 5);
    this.events.push({ type: 'hurt' });
    if (this.stats.thorns) {
      const k = this.stats.thorns;
      for (let i = 0; i < k; i++) {
        const a = (i / k) * TAU;
        const sp = this.stats.shotSpeed;
        this.shots.push({
          x: p.x, z: p.z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, dmg: this.stats.damage * this.stats.damageMult,
          r: Cfg.SHOT_R, left: 5, pierce: 1, hit: new Set(), child: true, t: 0, fx: this.shotEffects(),
        });
      }
    }
  }

  healPlayer(n) {
    const p = this.player;
    p.hp = Math.min(this.stats.maxHp, p.hp + n);
  }

  gainXp(v) {
    const p = this.player;
    p.xp += v;
    if (p.xp >= p.xpNext && !this.choices) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.round(Cfg.XP_FIRST * Math.pow(Cfg.XP_GROWTH, p.level - 1));
      this.choices = this.rollPerks(3);
      this.state = this.state === 'play' ? 'levelup' : this.state;
      this.events.push({ type: 'levelup' });
    }
  }

  rollPerks(n) {
    const pool = Object.keys(PERKS);
    const out = [];
    while (out.length < n && pool.length) {
      let total = 0;
      for (const id of pool) total += PERKS[id].weight;
      let r = this.rand() * total, k = 0;
      for (; k < pool.length - 1; k++) { r -= PERKS[pool[k]].weight; if (r <= 0) break; }
      out.push(pool.splice(k, 1)[0]);
    }
    return out;
  }

  choosePerk(id) {
    if (!this.choices || !this.choices.includes(id)) return;
    this.perks.push(id);
    this.choices = null;
    this.refreshStats();
    if (PERKS[id].instant) PERKS[id].instant(this);
    this.state = 'play';
    // Several level-ups can queue up.
    if (this.player.xp >= this.player.xpNext) this.gainXp(0);
  }

  addItem(id) {
    const before = activeTransforms(this.items);
    this.items.push(id);
    const oldMax = this.stats.maxHp;
    this.refreshStats();
    if (this.stats.maxHp > oldMax) this.player.hp += this.stats.maxHp - oldMax;
    if (ITEMS[id].onPickup) ITEMS[id].onPickup(this);
    this.events.push({ type: 'item', id });
    for (const t of activeTransforms(this.items)) if (!before.includes(t)) this.events.push({ type: 'transform', id: t });
  }

  refreshStats() {
    this.stats = buildStats(this.items, this.perks);
    this.player.hp = Math.min(this.player.hp, this.stats.maxHp);
  }

  // --- Movement and collision ----------------------------------------------------
  solid(i, j) {
    if (i < 0 || j < 0 || i >= W || j >= D) return false;
    return this.room.tiles[tileIndex(i, j)] === 1;
  }

  /** Moves a circle, sliding along rocks and walls. Returns false if blocked. */
  moveCircle(ent, dx, dz, isPlayer = false) {
    const ox = ent.x, oz = ent.z;
    ent.x += dx;
    ent.z += dz;
    if (!ent.flying) this.collideTiles(ent);
    this.clampToRoom(ent, isPlayer);
    const want = Math.hypot(dx, dz), got = Math.hypot(ent.x - ox, ent.z - oz);
    return want < 1e-5 || got > want * 0.5;
  }

  collideTiles(ent) {
    const r = ent.r;
    const ci = toTileI(ent.x), cj = toTileJ(ent.z);
    for (let j = cj - 1; j <= cj + 1; j++) {
      for (let i = ci - 1; i <= ci + 1; i++) {
        if (!this.solid(i, j)) continue;
        const x0 = tileX(i) - 0.5, x1 = x0 + 1, z0 = tileZ(j) - 0.5, z1 = z0 + 1;
        const cx = Math.max(x0, Math.min(ent.x, x1)), cz = Math.max(z0, Math.min(ent.z, z1));
        const ddx = ent.x - cx, ddz = ent.z - cz, d2 = ddx * ddx + ddz * ddz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = r - d;
          ent.x += (ddx / d) * push; ent.z += (ddz / d) * push;
        } else {
          // centre inside the tile: push out the shortest way
          const opts = [[ent.x - x0 + r, -1, 0], [x1 - ent.x + r, 1, 0], [ent.z - z0 + r, 0, -1], [z1 - ent.z + r, 0, 1]];
          opts.sort((a, b) => a[0] - b[0]);
          ent.x += opts[0][1] * opts[0][0]; ent.z += opts[0][2] * opts[0][0];
        }
      }
    }
  }

  clampToRoom(ent, isPlayer = false) {
    const r = ent.r, room = this.room;
    const open = (d) => isPlayer && room.cleared && room.doors[d];
    const inGapX = Math.abs(ent.x) < Cfg.DOOR_HALF - r * 0.3;
    const inGapZ = Math.abs(ent.z) < Cfg.DOOR_HALF - r * 0.3;
    if (!(open('n') && inGapX)) ent.z = Math.min(ent.z, HD - r);
    if (!(open('s') && inGapX)) ent.z = Math.max(ent.z, -HD + r);
    if (!(open('e') && inGapZ)) ent.x = Math.min(ent.x, HW - r);
    if (!(open('w') && inGapZ)) ent.x = Math.max(ent.x, -HW + r);
    // Inside a doorway: stay within its frame.
    if (ent.z > HD - r || ent.z < -HD + r) ent.x = Math.max(-Cfg.DOOR_HALF + r, Math.min(Cfg.DOOR_HALF - r, ent.x));
    if (ent.x > HW - r || ent.x < -HW + r) ent.z = Math.max(-Cfg.DOOR_HALF + r, Math.min(Cfg.DOOR_HALF - r, ent.z));
  }

  checkDoors() {
    const p = this.player, room = this.room;
    let dir = null;
    if (p.z > HD + 0.15) dir = 'n';
    else if (p.z < -HD - 0.15) dir = 's';
    else if (p.x > HW + 0.15) dir = 'e';
    else if (p.x < -HW - 0.15) dir = 'w';
    if (!dir || !room.doors[dir]) return false;
    this.enterRoom(this.neighbourKey(room, dir), dir);
    this.events.push({ type: 'door' });
    return true;
  }

  /** Nearest walkable point to (x, z), so drops never land inside a rock. */
  freeSpot(x, z) {
    x = Math.max(-HW + 0.4, Math.min(HW - 0.4, x));
    z = Math.max(-HD + 0.4, Math.min(HD - 0.4, z));
    const i0 = toTileI(x), j0 = toTileJ(z);
    if (!this.solid(i0, j0)) return [x, z];
    for (let r = 1; r < 6; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          const i = i0 + di, j = j0 + dj;
          if (i < 0 || j < 0 || i >= W || j >= D || this.solid(i, j)) continue;
          return [tileX(i), tileZ(j)];
        }
      }
    }
    return [0, 0];
  }

  hasLOS(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    const steps = Math.ceil(d / 0.3);
    for (let k = 1; k < steps; k++) {
      const x = a.x + (dx * k) / steps, z = a.z + (dz * k) / steps;
      if (this.solid(toTileI(x), toTileJ(z))) return false;
    }
    return true;
  }

  // Breadth-first distance field from the player's tile, for ground pathing.
  updateFlow(dt) {
    this.flowTimer -= dt;
    if (this.flowTimer > 0) return;
    this.flowTimer = 0.2;
    const f = this.flow;
    f.fill(-1);
    const pi = Math.max(0, Math.min(W - 1, toTileI(this.player.x)));
    const pj = Math.max(0, Math.min(D - 1, toTileJ(this.player.z)));
    const q = [pi + pj * W];
    f[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const k = q[h], i = k % W, j = (k - i) / W;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= D) continue;
        const nk = ni + nj * W;
        if (f[nk] >= 0 || this.room.tiles[nk]) continue;
        f[nk] = f[k] + 1;
        q.push(nk);
      }
    }
  }

  /** Unit direction for a ground enemy to walk towards the player. */
  flowDir(e) {
    const p = this.player;
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1;
    if (e.flying || d < 1.6 || this.hasLOS(e, p)) return [dx / d, dz / d];
    const i = toTileI(e.x), j = toTileJ(e.z);
    let best = null, bv = 1e9;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= D) continue;
      const v = this.flow[ni + nj * W];
      if (v < 0) continue;
      // no corner cutting
      if (di && dj && (this.room.tiles[i + di + j * W] || this.room.tiles[i + (j + dj) * W])) continue;
      if (v < bv) { bv = v; best = [ni, nj]; }
    }
    if (!best) return [dx / d, dz / d];
    const tx = tileX(best[0]) - e.x, tz = tileZ(best[1]) - e.z, td = Math.hypot(tx, tz) || 1;
    return [tx / td, tz / td];
  }

  moveEnemy(e, dx, dz) {
    const f = e.frozen > 0 ? 0 : 1 - Math.min(0.6, e.chill * 0.6);
    return this.moveCircle(e, dx * f, dz * f);
  }

  enemyShot(x, z, angle, speed, dmg = 1) {
    this.eshots.push({ x, z, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, r: 0.15, life: 5, dmg });
  }

  // --- Enemies --------------------------------------------------------------------
  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - dt * 6);
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      this.updateStatus(e, dt);
      if (!e.alive) continue;
      if (e.frozen <= 0) ENEMIES[e.type].update.call(ENEMIES[e.type], e, this, dt);
      // contact damage
      if (!e.air && Math.hypot(e.x - p.x, e.z - p.z) < e.r + p.r * 0.8) {
        this.hurtPlayer(e.boss && this.floor > 0 ? 2 : Cfg.CONTACT_DMG);
      }
    }
    // keep enemies from stacking
    const list = this.enemies;
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const A = list[a], B = list[b];
        if (A.air || B.air) continue;
        const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), m = A.r + B.r;
        if (d > 0.001 && d < m) {
          const push = (m - d) * 0.5;
          const wa = A.boss ? 0.1 : 1, wb = B.boss ? 0.1 : 1;
          A.x -= (dx / d) * push * wa; A.z -= (dz / d) * push * wa;
          B.x += (dx / d) * push * wb; B.z += (dz / d) * push * wb;
        }
      }
    }
  }

  updateStatus(e, dt) {
    const s = this.stats;
    const base = s.damage * s.damageMult;
    if (e.burn > 0) {
      e.burn -= dt;
      this.hurtEnemy(e, base * 0.55 * Math.max(1, s.fire) * dt, null, true);
    }
    if (e.poison > 0) {
      e.poison -= dt;
      this.hurtEnemy(e, base * 0.35 * Math.max(1, s.poison) * dt, null, true);
    }
    if (e.frozen > 0) e.frozen -= dt;
    e.chill = Math.max(0, e.chill - dt * 0.25);
  }

  /** Applies a hit with on-hit effects (elements). */
  damageEnemy(e, dmg, fx) {
    if (!e.alive || e.spawnT > 0) return;
    const s = this.stats;
    if (fx) {
      if (fx.fire && this.rand() < fx.fire) e.burn = 3;
      if (fx.poison && this.rand() < fx.poison) e.poison = 4;
      if (fx.ice && this.rand() < fx.ice) {
        e.chill += 0.34;
        if (e.chill >= 1 && !e.boss) { e.frozen = 1.6; e.chill = 0; }
      }
    }
    if (this.rand() < s.crit) dmg *= 2;
    this.hurtEnemy(e, dmg, fx, false);
  }

  hurtEnemy(e, dmg, fx, dot) {
    if (!e.alive) return;
    const s = this.stats;
    if (e.poison > 0) dmg *= 1 + s.poisonVuln;
    if (e.frozen > 0) dmg *= s.frozenMult;
    e.hp -= dmg;
    if (!dot) e.flash = 1;
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    const s = this.stats, p = this.player;
    this.kills++;
    this.events.push({ type: 'kill', x: e.x, z: e.z, enemy: e.type, boss: e.boss, small: !!e.small });
    const def = ENEMIES[e.type];
    if (def.onDeath) def.onDeath(e, this);
    const xp = (XP_VALUE[e.type] || 1) * (e.small ? 0.4 : 1);
    this.orbs.push({ x: e.x, z: e.z, value: Math.max(1, Math.round(xp)), t: 0 });
    if (this.rand() < Cfg.ENEMY_COIN) {
      const [cx, cz] = this.freeSpot(e.x, e.z);
      this.room.pickups.push({ kind: 'coin', x: cx, z: cz, value: 1 });
    }
    if (s.leech) {
      p.leechCount++;
      if (p.leechCount >= s.leech) { p.leechCount = 0; this.healPlayer(1); this.events.push({ type: 'heal' }); }
    }
    // chain reactions
    const base = s.damage * s.damageMult;
    if (e.burn > 0 && s.pyro) this.explode(e.x, e.z, 1.4, base * 1.5, { fire: 1 });
    if (e.frozen > 0 && s.shatter) this.explode(e.x, e.z, 1.4, base, { ice: 3 });
    if (e.poison > 0) {
      if (s.poison) this.clouds.push({ x: e.x, z: e.z, r: 1.1, t: 0, life: 3, tick: 0 });
      if (s.plague) for (const o of this.enemies) if (o.alive && Math.hypot(o.x - e.x, o.z - e.z) < 2) o.poison = 4;
    }
    if (e.boss) this.bossDefeated(e);
  }

  explode(x, z, r, dmg, fx) {
    this.events.push({ type: 'explode', x, z, r, fx });
    this.shake = Math.max(this.shake, 2.5);
    for (const e of this.enemies) {
      if (this.active(e) && Math.hypot(e.x - x, e.z - z) < r + e.r) this.damageEnemy(e, dmg, fx);
    }
  }

  // --- Shots ---------------------------------------------------------------------
  updateShots(dt) {
    const s = this.stats;
    for (const sh of this.shots) {
      sh.t += dt;
      if (s.homing > 0) {
        let best = null, bd = 4;
        for (const e of this.enemies) {
          if (!this.active(e) || sh.hit.has(e.id)) continue;
          const d = Math.hypot(e.x - sh.x, e.z - sh.z);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          const sp = Math.hypot(sh.vx, sh.vz);
          const want = Math.atan2(best.z - sh.z, best.x - sh.x);
          let cur = Math.atan2(sh.vz, sh.vx);
          const diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
          cur += Math.max(-s.homing * dt, Math.min(s.homing * dt, diff));
          sh.vx = Math.cos(cur) * sp; sh.vz = Math.sin(cur) * sp;
        }
      }
      let vx = sh.vx, vz = sh.vz;
      if (s.wobble) {
        const sp = Math.hypot(vx, vz) || 1, w = Math.sin(sh.t * 14) * 2.2 * s.wobble;
        vx += (-sh.vz / sp) * w; vz += (sh.vx / sp) * w;
      }
      sh.x += vx * dt; sh.z += vz * dt;
      sh.left -= Math.hypot(sh.vx, sh.vz) * dt;
      if (sh.left <= 0 || Math.abs(sh.x) > HW || Math.abs(sh.z) > HD || this.solid(toTileI(sh.x), toTileJ(sh.z))) {
        this.shotEnd(sh, null);
        continue;
      }
      for (const e of this.enemies) {
        if (!this.active(e) || sh.hit.has(e.id) || e.air) continue;
        if (Math.hypot(e.x - sh.x, e.z - sh.z) > e.r + sh.r) continue;
        sh.hit.add(e.id);
        this.damageEnemy(e, sh.dmg, sh.fx);
        this.events.push({ type: 'hit', x: sh.x, z: sh.z, fx: sh.fx });
        // knockback
        const sp = Math.hypot(sh.vx, sh.vz) || 1;
        if (!e.boss && e.alive) this.moveCircle(e, (sh.vx / sp) * 0.12, (sh.vz / sp) * 0.12);
        if (sh.pierce > 0) { sh.pierce--; this.shotSplit(sh); continue; }
        this.shotEnd(sh, e);
        break;
      }
    }
    this.shots = this.shots.filter((sh) => !sh.dead);
  }

  shotEnd(sh, target) {
    if (sh.dead) return;
    sh.dead = true;
    const s = this.stats;
    if (s.explode && !sh.child) this.explode(sh.x, sh.z, 0.9 * s.explode, sh.dmg * 0.6, sh.fx);
    if (target) this.shotSplit(sh);
    else this.events.push({ type: 'splat', x: sh.x, z: sh.z, fx: sh.fx });
  }

  shotSplit(sh) {
    const n = this.stats.split;
    if (!n || sh.child) return;
    const a0 = Math.atan2(sh.vz, sh.vx);
    const sp = Math.hypot(sh.vx, sh.vz);
    for (let k = 0; k < n; k++) {
      const a = a0 + (k - (n - 1) / 2) * 0.7;
      this.shots.push({
        x: sh.x, z: sh.z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, dmg: sh.dmg * 0.5,
        r: sh.r * 0.7, left: 2.6, pierce: 0, hit: new Set(sh.hit), child: true, t: 0, fx: sh.fx,
      });
    }
  }

  updateEnemyShots(dt) {
    const p = this.player;
    for (const b of this.eshots) {
      b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
      if (b.life <= 0 || Math.abs(b.x) > HW || Math.abs(b.z) > HD || this.solid(toTileI(b.x), toTileJ(b.z))) {
        b.dead = true;
        this.events.push({ type: 'esplat', x: b.x, z: b.z });
        continue;
      }
      if (Math.hypot(b.x - p.x, b.z - p.z) < b.r + p.r * 0.8 && p.iframes <= 0 && p.dashT <= 0) {
        b.dead = true;
        this.hurtPlayer(b.dmg);
      }
    }
    this.eshots = this.eshots.filter((b) => !b.dead);
  }

  orbitalPositions() {
    const n = this.stats.orbitals, p = this.player, out = [];
    for (let k = 0; k < n; k++) {
      const a = this.time * 2.6 + (k / n) * TAU;
      out.push([p.x + Math.cos(a) * 1.25, p.z + Math.sin(a) * 1.25]);
    }
    return out;
  }

  updateOrbitals(dt) {
    if (!this.stats.orbitals) return;
    const dmg = this.stats.damage * this.stats.damageMult * 0.6;
    for (const [ox, oz] of this.orbitalPositions()) {
      for (const e of this.enemies) {
        if (!this.active(e) || e.air) continue;
        if (Math.hypot(e.x - ox, e.z - oz) > e.r + 0.25) continue;
        const last = e.hitCd.get('orb') || 0;
        if (this.time - last < 0.3) continue;
        e.hitCd.set('orb', this.time);
        this.damageEnemy(e, dmg, this.shotEffects());
        this.events.push({ type: 'hit', x: ox, z: oz, fx: this.shotEffects() });
      }
      // wisps also block enemy shots
      for (const b of this.eshots) if (Math.hypot(b.x - ox, b.z - oz) < 0.35) b.dead = true;
    }
  }

  updateClouds(dt) {
    const base = this.stats.damage * this.stats.damageMult;
    for (const c of this.clouds) {
      c.t += dt;
      c.tick -= dt;
      if (c.tick > 0) continue;
      c.tick = 0.4;
      for (const e of this.enemies) {
        if (this.active(e) && Math.hypot(e.x - c.x, e.z - c.z) < c.r + e.r) {
          e.poison = 4;
          this.hurtEnemy(e, base * 0.25, null, true);
        }
      }
    }
    this.clouds = this.clouds.filter((c) => c.t < c.life);
  }

  // --- Pickups and room state ---------------------------------------------------
  updatePickups(dt) {
    const p = this.player, s = this.stats;
    const magnet = Cfg.MAGNET * s.magnetMult;
    for (const o of this.orbs) {
      o.t += dt;
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
      const cleared = this.room.cleared;
      if (d < magnet || (cleared && o.t > 0.5)) {
        const sp = cleared ? 12 : 7;
        o.x += (dx / (d || 1)) * sp * dt; o.z += (dz / (d || 1)) * sp * dt;
      }
      if (d < p.r + 0.2) { o.dead = true; this.gainXp(o.value); this.events.push({ type: 'xp' }); }
    }
    this.orbs = this.orbs.filter((o) => !o.dead);

    const room = this.room;
    for (const it of room.pickups) {
      const dx = p.x - it.x, dz = p.z - it.z, d = Math.hypot(dx, dz);
      if (it.kind === 'coin' && d < magnet) {
        it.x += (dx / (d || 1)) * 6 * dt; it.z += (dz / (d || 1)) * 6 * dt;
      }
      if (d > p.r + 0.45) continue;
      if (it.kind === 'coin') {
        it.taken = true;
        p.coins += Math.round(it.value * s.coinMult);
        this.events.push({ type: 'coin' });
      } else if (it.kind === 'heart') {
        if (p.hp >= s.maxHp) continue;
        if (it.price) { if (p.coins < it.price) continue; p.coins -= it.price; }
        it.taken = true;
        this.healPlayer(2);
        this.events.push({ type: 'heal' });
      } else if (it.kind === 'item') {
        if (it.price) { if (p.coins < it.price) continue; p.coins -= it.price; }
        it.taken = true;
        this.addItem(it.id);
      } else if (it.kind === 'trapdoor' && this.room.cleared) {
        it.taken = false;
        if (this.floor + 1 >= Cfg.FLOORS) continue;
        this.events.push({ type: 'descend' });
        this.newFloor(this.floor + 1);
        return;
      }
    }
    room.pickups = room.pickups.filter((it) => !it.taken);
  }

  checkClear() {
    const room = this.room;
    if (room.cleared || this.enemies.length) return;
    room.cleared = true;
    this.events.push({ type: 'clear' });
    if (room.type === 'boss') return;   // the boss handles its own rewards
    const r = this.rand();
    const [cx, cz] = this.freeSpot(0, 0);
    if (r < Cfg.HEART_DROP) room.pickups.push({ kind: 'heart', x: cx, z: cz });
    else if (r < Cfg.HEART_DROP + Cfg.COIN_DROP) {
      const n = 1 + Math.floor(this.rand() * 3);
      for (let k = 0; k < n; k++) room.pickups.push({ kind: 'coin', x: cx + (k - (n - 1) / 2) * 0.3, z: cz, value: 1 });
    }
  }

  bossDefeated(e) {
    const room = this.room;
    this.shake = 10;
    this.events.push({ type: 'bossdead' });
    room.pickups.push({ kind: 'item', id: this.drawItem(), x: 0, z: -1.5 });
    room.pickups.push({ kind: 'heart', x: -1.5, z: -1.5 });
    if (this.floor + 1 >= Cfg.FLOORS) {
      this.winAt = this.time + 2.5;
    } else {
      room.pickups.push({ kind: 'trapdoor', x: 0, z: 3 });
    }
    // remaining minions die with their master
    for (const o of this.enemies) if (o !== e && o.alive) this.killEnemy(o);
  }
}
