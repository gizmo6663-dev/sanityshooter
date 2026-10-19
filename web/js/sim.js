// The whole simulation for one round. Knows nothing about three.js, the DOM
// or input: main.js feeds it a target x, a fire flag and a giant flag, then
// the renderer reads the fields below to draw. Runs in Node for balancing.

import { Cfg } from './config.js';

// Small seeded PRNG so a level always gets the same gate layout.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

let nextId = 1;

class Mob {
  constructor(team, x, z, hp, giant) {
    this.id = nextId++;
    this.team = team;        // 0 blue (player), 1 red (enemy)
    this.x = x;
    this.z = z;
    this.vx = 0;
    this.hp = hp;
    this.maxHp = hp;
    this.giant = giant;
    this.r = giant ? Cfg.GIANT_R : Cfg.UNIT_R;
    this.gates = 0;          // bitmask of gates already passed
    this.alive = true;
    this.phase = Math.random() * Math.PI * 2;
  }
}

export class World {
  constructor(prog) {
    this.prog = prog;
    this.level = prog.level;
    this.state = 'playing';  // playing | won | lost
    this.time = 0;
    this.endTime = 0;

    this.blue = [];
    this.red = [];
    this.gates = [];

    this.baseMax = Math.round(Cfg.BASE_HP * Math.pow(Cfg.BASE_HP_GROWTH, this.level - 1));
    this.baseHp = this.baseMax;
    this.castleMax = prog.castleHp();
    this.castleHp = this.castleMax;

    this.cannonX = 0;
    this.fireCd = 0;
    this.charge = 0;
    this.recoil = 0;

    this.coins = 0;
    this.reward = 0;         // final coins, set when the round ends
    this.kills = 0;

    this.redAcc = 0;
    this.bruteTimer = Cfg.BRUTE_INTERVAL * 0.6;

    // Effects, consumed by the renderer each frame
    this.events = [];        // {type:'pop'|'text'|'gate', ...}
    this.shake = 0;
    this.baseFlash = 0;
    this.castleFlash = 0;

    this.buildGates();
  }

  // ======================================================================
  // Level layout
  // ======================================================================
  buildGates() {
    const r = mulberry32(this.level * 7919 + 13);
    const rr = (a, b) => a + r() * (b - a);
    if (this.level === 1) {
      this.addGate(15, -1.6, 2.2, 'mul', 2);
      this.addGate(28, 1.4, 1.8, 'mul', 3);
      return;
    }
    const rows = 2 + Math.min(3, Math.floor(this.level / 3));
    const span = Cfg.GATE_ZONE_END - Cfg.GATE_ZONE_START;
    for (let i = 0; i < rows; i++) {
      const z = Cfg.GATE_ZONE_START + span * (i + 0.5) / rows + rr(-1.2, 1.2);
      const pattern = Math.floor(r() * 4);
      if (pattern === 0) {
        // Two side-by-side gates: a wide safe one and a narrow greedy one.
        const a = this.rollMul(r);
        const b = Math.min(a + 1 + Math.floor(r() * 2), 6);
        const leftBig = r() < 0.5;
        this.addGate(z, -2.3, leftBig ? 1.3 : 2.0, 'mul', leftBig ? b : a);
        this.addGate(z, 2.3, leftBig ? 2.0 : 1.3, 'mul', leftBig ? a : b);
      } else if (pattern === 1) {
        // One moving gate sweeping the lane.
        const hw = rr(1.3, 2.0);
        this.addGate(z, 0, hw, 'mul', this.rollMul(r) + 1,
          Cfg.LANE_HALF - hw, rr(0.5, 1.1), r() * Math.PI * 2);
      } else if (pattern === 2 && this.level >= 3) {
        // One-shot bonus gate plus a small multiplier.
        const bx = rr(-2.5, 2.5);
        this.addGate(z, bx, 1.1, 'add', 10 + this.level * 4);
        this.addGate(z, -Math.sign(bx || 1) * 2.8, 1.5, 'mul', 2);
      } else {
        const hw = rr(1.6, 2.6);
        this.addGate(z, rr(-Cfg.LANE_HALF + hw, Cfg.LANE_HALF - hw), hw, 'mul', this.rollMul(r));
      }
    }
  }

  rollMul(r) {
    const roll = r();
    if (this.level >= 6 && roll < 0.15) return 4;
    if (roll < 0.45) return 3;
    return 2;
  }

  addGate(z, x, hw, kind, value, amp = 0, speed = 0, phase = 0) {
    const bx = clamp(x, -Cfg.LANE_HALF + hw, Cfg.LANE_HALF - hw);
    this.gates.push({
      id: this.gates.length, z, x: bx, baseX: bx, halfW: hw, kind,
      value: value + (kind === 'mul' ? this.prog.gateBonus() : 0),
      amp, speed, phase, flash: 0, used: false,
    });
  }

  // ======================================================================
  // Update
  // ======================================================================
  update(dt, targetX, firing, giantPressed) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 20);
    this.baseFlash = Math.max(0, this.baseFlash - dt * 4);
    this.castleFlash = Math.max(0, this.castleFlash - dt * 3);
    this.animateGates(dt);
    if (this.state !== 'playing') {
      this.endTime += dt;
      this.moveBlue(dt);
      this.moveRed(dt);
      this.cleanup();
      return;
    }

    const tx = clamp(targetX, -Cfg.LANE_HALF + 0.5, Cfg.LANE_HALF - 0.5);
    const step = Cfg.CANNON_SPEED * dt;
    this.cannonX += clamp(tx - this.cannonX, -step, step);
    this.recoil = Math.max(0, this.recoil - dt * 6);

    this.fireCd -= dt;
    if (firing && this.fireCd <= 0) {
      this.fireCd = this.prog.fireInterval();
      this.fireVolley();
    }
    if (giantPressed && this.giantReady()) this.fireGiant();

    this.spawnRed(dt);
    this.moveBlue(dt);
    this.moveRed(dt);
    this.collide();
    this.cleanup();

    if (this.baseHp <= 0) this.finish(true);
    else if (this.castleHp <= 0) this.finish(false);
  }

  // Also used on its own for the idle preview behind the shop.
  animateGates(dt) {
    for (const g of this.gates) {
      g.flash = Math.max(0, g.flash - dt * 3);
      if (g.amp > 0) g.x = g.baseX + Math.sin(this.time * g.speed + g.phase) * g.amp;
    }
  }

  giantReady() { return this.charge >= this.prog.giantCharge(); }
  chargeFrac() { return clamp(this.charge / this.prog.giantCharge(), 0, 1); }

  fireVolley() {
    const n = this.prog.shotsPerVolley();
    for (let i = 0; i < n && this.blue.length < Cfg.MAX_BLUE; i++) {
      const off = (i - (n - 1) * 0.5) * Cfg.MULTISHOT_SPREAD;
      const m = this.newBlue(this.cannonX + off, Cfg.CANNON_Z + 0.4, this.prog.unitHp(), false);
      m.vx = off * 0.3 + rand(-0.25, 0.25);
    }
    this.recoil = 1;
    if (!this.giantReady()) this.charge += 1;
  }

  fireGiant() {
    this.charge = 0;
    this.newBlue(this.cannonX, Cfg.CANNON_Z + 0.6, this.prog.giantHp(), true);
    this.recoil = 1.6;
    this.shake = Math.max(this.shake, 4);
  }

  newBlue(x, z, hp, giant) {
    const m = new Mob(0, x, z, hp, giant);
    this.blue.push(m);
    return m;
  }

  spawnRed(dt) {
    let rate = Cfg.RED_RATE + Cfg.RED_RATE_PER_LEVEL * (this.level - 1);
    rate *= 1 + Cfg.RED_RAMP * this.time;
    rate *= 1 + Cfg.RED_PANIC * (1 - this.baseHp / this.baseMax);
    this.redAcc += rate * dt;
    const hp = 1 + Math.floor((this.level - 1) / Cfg.RED_HP_EVERY);
    while (this.redAcc >= 1) {
      this.redAcc -= 1;
      if (this.red.length >= Cfg.MAX_RED) continue;
      this.newRed(rand(-Cfg.LANE_HALF + 0.5, Cfg.LANE_HALF - 0.5), Cfg.LANE_LEN - 0.3, hp, false);
    }
    if (this.level >= Cfg.BRUTE_FIRST_LEVEL) {
      this.bruteTimer -= dt;
      if (this.bruteTimer <= 0) {
        this.bruteTimer = Cfg.BRUTE_INTERVAL * rand(0.8, 1.2);
        const bhp = Cfg.BRUTE_HP + Cfg.BRUTE_HP_PER_LEVEL * (this.level - Cfg.BRUTE_FIRST_LEVEL);
        this.newRed(rand(-2.5, 2.5), Cfg.LANE_LEN - 0.5, bhp, true);
      }
    }
  }

  newRed(x, z, hp, giant) {
    const m = new Mob(1, x, z, hp, giant);
    m.vx = rand(-0.4, 0.4);
    this.red.push(m);
  }

  moveBlue(dt) {
    for (const m of this.blue) {
      if (!m.alive) continue;
      const pz = m.z;
      m.z += (m.giant ? Cfg.GIANT_SPEED : Cfg.UNIT_SPEED) * dt;
      m.x += m.vx * dt;
      m.vx *= 1 - dt * 0.8;
      const lim = Cfg.LANE_HALF - m.r;
      if (Math.abs(m.x) > lim) { m.x = Math.sign(m.x) * lim; m.vx = -m.vx * 0.5; }
      if (this.state === 'playing') {
        this.checkGates(m, pz);
        if (m.z >= Cfg.LANE_LEN) this.hitBase(m);
      } else if (m.z >= Cfg.LANE_LEN) {
        m.alive = false;
      }
    }
  }

  checkGates(m, pz) {
    for (const g of this.gates) {
      if (g.used) continue;
      const bit = 1 << g.id;
      if ((m.gates & bit) || pz >= g.z || m.z < g.z) continue;
      if (Math.abs(m.x - g.x) > g.halfW + m.r * 0.5) continue;
      m.gates |= bit;
      g.flash = 1;
      if (g.kind === 'add') {
        g.used = true;
        this.spawnClones(m, g, g.value, bit, true);
        this.events.push({ type: 'text', x: g.x, z: g.z, text: `+${g.value}`, color: '#5fe3ff' });
        this.events.push({ type: 'gate', gate: g });
      } else if (m.giant) {
        this.spawnClones(m, g, (g.value - 1) * Cfg.GIANT_GATE_SPAWN, bit, true);
      } else {
        this.spawnClones(m, g, g.value - 1, bit, false);
      }
    }
  }

  // Clones copy the parent's hp unless `fresh`, in which case they get the
  // base unit hp. Past MAX_BLUE the hp goes into the parent instead, so a
  // capped crowd still hits as hard.
  spawnClones(m, g, count, bit, fresh) {
    const hp = fresh ? this.prog.unitHp() : m.hp;
    for (let k = 0; k < count; k++) {
      if (this.blue.length >= Cfg.MAX_BLUE) {
        if (!m.giant) { m.hp += hp; m.maxHp = Math.max(m.maxHp, m.hp); }
        continue;
      }
      const c = this.newBlue(
        clamp(m.x + rand(-0.7, 0.7), g.x - g.halfW, g.x + g.halfW),
        g.z + rand(0, 0.6), hp, false);
      c.vx = rand(-1.2, 1.2);
      c.gates = m.gates | bit;
    }
  }

  hitBase(m) {
    m.alive = false;
    this.baseHp -= m.hp;
    this.baseFlash = 1;
    this.shake = Math.max(this.shake, m.giant ? 6 : 1.2);
    this.events.push({ type: 'pop', x: m.x, z: Cfg.LANE_LEN, team: 2, big: m.giant });
  }

  moveRed(dt) {
    const spd = Cfg.RED_SPEED + Cfg.RED_SPEED_PER_LEVEL * (this.level - 1);
    for (const m of this.red) {
      if (!m.alive) continue;
      let s = spd * (m.giant ? 0.55 : 1);
      if (this.state === 'won') s = -spd * 0.5;
      m.z -= s * dt;
      // Drift towards the cannon a little, so the crowd pressures the player.
      m.x += (m.vx + (this.cannonX - m.x) * 0.06) * dt;
      const lim = Cfg.LANE_HALF - m.r;
      if (Math.abs(m.x) > lim) { m.x = Math.sign(m.x) * lim; m.vx = -m.vx; }
      if (this.state === 'playing' && m.z <= Cfg.CANNON_Z - 0.2) {
        m.alive = false;
        this.castleHp -= m.hp;
        this.castleFlash = 1;
        this.shake = Math.max(this.shake, 5);
        this.events.push({ type: 'pop', x: m.x, z: m.z, team: 1, big: true });
      }
    }
  }

  collide() {
    // Spatial hash of the reds. Cell size 1 covers unit-unit contact;
    // giants search a wider ring.
    const grid = new Map();
    for (const r of this.red) {
      if (!r.alive) continue;
      const key = (Math.floor(r.x) + 64) * 4096 + Math.floor(r.z) + 64;
      const cell = grid.get(key);
      if (cell) cell.push(r); else grid.set(key, [r]);
    }
    const mult = Cfg.COIN_PER_KILL * this.prog.coinMult();
    for (const b of this.blue) {
      if (!b.alive) continue;
      const ring = b.giant ? 2 : 1;
      const bcx = Math.floor(b.x), bcz = Math.floor(b.z);
      outer:
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          const cell = grid.get((bcx + dx + 64) * 4096 + bcz + dz + 64);
          if (!cell) continue;
          for (const r of cell) {
            if (!r.alive) continue;
            const rr = b.r + r.r, ddx = b.x - r.x, ddz = b.z - r.z;
            if (ddx * ddx + ddz * ddz > rr * rr) continue;
            const dmg = Math.min(b.hp, r.hp);
            b.hp -= dmg;
            r.hp -= dmg;
            if (r.hp <= 0) {
              r.alive = false;
              this.kills++;
              this.coins += mult * (r.giant ? Cfg.BRUTE_COINS : 1);
              this.events.push({ type: 'pop', x: r.x, z: r.z, team: 1, big: r.giant });
            }
            if (b.hp <= 0) {
              b.alive = false;
              this.events.push({ type: 'pop', x: b.x, z: b.z, team: 0, big: b.giant });
              break outer;
            }
          }
        }
      }
    }
  }

  cleanup() {
    this.blue = this.blue.filter((m) => m.alive);
    this.red = this.red.filter((m) => m.alive);
  }

  winReward() {
    return (Cfg.WIN_REWARD + Cfg.WIN_REWARD_PER_LEVEL * (this.level - 1)) * this.prog.coinMult();
  }

  finish(won) {
    this.state = won ? 'won' : 'lost';
    this.endTime = 0;
    let total = this.coins;
    if (won) {
      total += this.winReward();
      this.baseHp = 0;
      this.shake = 10;
      for (const m of this.red) this.events.push({ type: 'pop', x: m.x, z: m.z, team: 1, big: false });
      this.red = [];
    } else {
      const dealt = 1 - Math.max(this.baseHp, 0) / this.baseMax;
      total += dealt * Cfg.LOSS_FRACTION * this.winReward();
    }
    this.reward = Math.round(total);
  }
}
