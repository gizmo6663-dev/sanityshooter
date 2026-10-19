// The whole simulation for one round. Knows nothing about three.js, the DOM
// or input: main.js feeds it a target x, a fire flag and a giant flag, then
// the renderer reads the fields below to draw. Runs in Node for balancing.
//
// Items only change numbers in `mods` (see items.js). The interesting
// combinations come from a few shared rules:
//  - every mob may carry an element (fire / ice / poison), gold, a shield,
//    ghosting; gates copy all of it onto the clones,
//  - every explosion, stomp and turret shot carries an element and applies
//    it like a hit would,
//  - deaths trigger follow-ups (split, explode, cloud, pyro, shatter...),
//    which can kill more enemies and trigger more follow-ups.

import { Cfg } from './config.js';
import { buildMods } from './items.js';

export const EL = { NONE: 0, FIRE: 1, ICE: 2, POISON: 3 };

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
const dist2 = (a, x, z) => (a.x - x) * (a.x - x) + (a.z - z) * (a.z - z);

let nextId = 1;

class Mob {
  constructor(team, x, z, hp) {
    this.id = nextId++;
    this.team = team;        // 0 blue (player), 1 red (enemy)
    this.kind = 'unit';      // blue: unit | giant;  red: unit | runner | shield | bomber | brute | boss
    this.x = x;
    this.z = z;
    this.vx = 0;
    this.hp = hp;
    this.maxHp = hp;
    this.r = Cfg.UNIT_R;
    this.alive = true;
    this.phase = Math.random() * Math.PI * 2;
    this.gates = 0;          // bitmask of gates already passed
    // player mob properties
    this.el = EL.NONE;
    this.gold = false;
    this.shield = false;
    this.ghost = false;
    this.small = false;
    // enemy state
    this.armor = 0;
    this.burn = 0;
    this.slow = 0;
    this.poisoned = 0;
    this.speed = 1;
  }
  get giant() { return this.kind === 'giant' || this.kind === 'brute' || this.kind === 'boss'; }
}

export class World {
  constructor(meta, run) {
    this.meta = meta;
    this.run = run;
    this.mods = buildMods(meta, run.items);
    this.level = run.level;
    this.boss = this.level % 5 === 0;
    this.state = 'playing';  // playing | won | lost
    this.time = 0;
    this.endTime = 0;

    this.blue = [];
    this.red = [];
    this.gates = [];
    this.clouds = [];        // poison clouds {x, z, r, t, life, tick}
    this.rocks = [];         // catapult shots {tx, tz, t, dur}
    this.shots = [];         // turret shots {x, z, target, el}

    const ups = this.level - 1;
    const early = Math.min(ups, Cfg.BASE_EARLY_LEVELS);
    this.baseMax = Math.round(Cfg.BASE_HP * Math.pow(Cfg.BASE_EARLY_GROWTH, early) *
      Math.pow(Cfg.BASE_HP_GROWTH, ups - early) * (this.boss ? 0.8 : 1));
    this.baseHp = this.baseMax;
    this.redScale = Math.pow(Cfg.RED_HP_GROWTH, this.level - 1);
    this.castleMax = meta.castleHp();
    this.castleHp = Math.min(this.castleMax, run.castleHp);

    this.cannonX = 0;
    this.fireCd = 0;
    this.charge = 0;
    this.recoil = 0;
    this.volleys = 0;
    this.stun = 0;
    this.rage = 0;

    this.coins = 0;
    this.reward = 0;
    this.kills = 0;
    this.regenCount = 0;

    this.redAcc = 0;
    this.bruteTimer = Cfg.BRUTE_INTERVAL * 0.6;
    this.rockTimer = Cfg.ROCK_FIRST;
    this.bossSpawned = false;
    this.autoGiantTimer = this.mods.autoGiant;
    this.wallRegenTimer = this.mods.wallRegen;
    this.auraTimer = 0;
    this.turretCd = [];
    for (let i = 0; i < this.mods.turrets; i++) this.turretCd.push(i * 0.3);

    // Effects, consumed by the renderer each frame
    this.events = [];
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
    const rows = 2 + Math.min(2, Math.floor(this.level / 4));
    const span = Cfg.GATE_ZONE_END - Cfg.GATE_ZONE_START;
    for (let i = 0; i < rows; i++) {
      const z = Cfg.GATE_ZONE_START + span * (i + 0.5) / rows + rr(-1, 1);
      const pattern = this.level === 1 ? 3 : Math.floor(r() * 4);
      if (pattern === 0) {
        const a = this.rollMul(r);
        const b = Math.min(a + 1 + Math.floor(r() * 2), 6);
        const leftBig = r() < 0.5;
        this.addGate(z, -2.3, leftBig ? 1.3 : 2.0, 'mul', leftBig ? b : a);
        this.addGate(z, 2.3, leftBig ? 2.0 : 1.3, 'mul', leftBig ? a : b);
      } else if (pattern === 1) {
        const hw = rr(1.3, 2.0);
        this.addGate(z, 0, hw, 'mul', this.rollMul(r) + 1, Cfg.LANE_HALF - hw, rr(0.5, 1.1), r() * Math.PI * 2);
      } else if (pattern === 2 && this.level >= 3) {
        const bx = rr(-2.5, 2.5);
        this.addGate(z, bx, 1.1, 'add', 8 + this.level * 3);
        this.addGate(z, -Math.sign(bx || 1) * 2.8, 1.5, 'mul', 2);
      } else {
        const hw = rr(1.6, 2.6);
        this.addGate(z, rr(-Cfg.LANE_HALF + hw, Cfg.LANE_HALF - hw), hw, 'mul', this.rollMul(r));
      }
      // Trap gates: red ÷2 gates that sweep across the lane
      if (this.level >= Cfg.TRAP_LEVEL && r() < Math.min(0.75, 0.3 + this.level * 0.03)) {
        const hw = rr(1.0, 1.6);
        this.addGate(z + rr(2.2, 3.2), rr(-2, 2), hw, 'div', 2, Cfg.LANE_HALF - hw, rr(0.6, 1.3), r() * 6);
      }
    }
    // Mirror gates from items, in the gaps near the cannon and the base
    for (let k = 0; k < this.mods.extraGates; k++) {
      const z = k % 2 === 0 ? Cfg.GATE_ZONE_START - 3.5 : Cfg.GATE_ZONE_END + 3;
      this.addGate(z, rr(-2, 2), 1.6, 'mul', 2, k > 1 ? 2.5 : 0, 0.8, r() * 6);
    }
  }

  rollMul(r) {
    const roll = r();
    if (this.level >= 8 && roll < 0.12) return 4;
    if (roll < 0.4) return 3;
    return 2;
  }

  addGate(z, x, hw, kind, value, amp = 0, speed = 0, phase = 0) {
    if (this.gates.length >= 30) return;
    const bx = clamp(x, -Cfg.LANE_HALF + hw, Cfg.LANE_HALF - hw);
    this.gates.push({
      id: this.gates.length, z, x: bx, baseX: bx, halfW: hw, kind,
      value: value + (kind === 'mul' ? this.mods.gateBonus : 0),
      amp: Math.min(amp, Cfg.LANE_HALF - hw), speed, phase, flash: 0, used: false,
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
    this.stun = Math.max(0, this.stun - dt);
    this.rage = Math.max(0, this.rage - dt);

    this.fireCd -= dt;
    if (firing && this.fireCd <= 0 && this.stun <= 0) {
      this.fireCd = 1 / (this.mods.fireRate * (this.rage > 0 ? 2 : 1));
      this.fireVolley();
    }
    if (giantPressed && this.giantReady()) {
      this.charge = 0;
      this.fireGiant();
    }
    if (this.mods.autoGiant) {
      this.autoGiantTimer -= dt;
      if (this.autoGiantTimer <= 0) { this.autoGiantTimer = this.mods.autoGiant; this.fireGiant(); }
    }

    this.spawnRed(dt);
    this.updateRocks(dt);
    this.updateTurrets(dt);
    this.updateWall(dt);
    this.moveBlue(dt);
    this.moveRed(dt);
    this.updateStatuses(dt);
    this.updateClouds(dt);
    this.giantAbilities(dt);
    this.collide();
    this.cleanup();

    if (this.baseHp <= 0) this.finish(true);
    else if (this.castleHp <= 0) this.finish(false);
  }

  // Also used on its own for the idle preview behind the menus.
  animateGates(dt) {
    for (const g of this.gates) {
      g.flash = Math.max(0, g.flash - dt * 3);
      if (g.amp > 0) g.x = g.baseX + Math.sin(this.time * g.speed + g.phase) * g.amp;
    }
  }

  giantReady() { return this.charge >= this.mods.giantCharge; }
  chargeFrac() { return clamp(this.charge / this.mods.giantCharge, 0, 1); }

  // ======================================================================
  // Player side
  // ======================================================================
  rollElement() {
    const e = this.mods.el;
    const roll = Math.random();
    if (roll < e.fire) return EL.FIRE;
    if (roll < e.fire + e.ice) return EL.ICE;
    if (roll < e.fire + e.ice + e.poison) return EL.POISON;
    return EL.NONE;
  }

  /** The element the player owns most of (for giants and turrets). */
  mainElement() {
    const e = this.mods.el;
    const best = Math.max(e.fire, e.ice, e.poison);
    if (best <= 0) return EL.NONE;
    return best === e.fire ? EL.FIRE : best === e.ice ? EL.ICE : EL.POISON;
  }

  randomOwnedElement() {
    const e = this.mods.el;
    const sum = e.fire + e.ice + e.poison;
    if (sum <= 0) return EL.NONE;
    const r = Math.random() * sum;
    return r < e.fire ? EL.FIRE : r < e.fire + e.ice ? EL.ICE : EL.POISON;
  }

  makeGold(m) {
    if (m.gold) return;
    m.gold = true;
    m.hp *= this.mods.goldMult;
    m.maxHp = Math.max(m.maxHp, m.hp);
  }

  fireVolley() {
    const mods = this.mods;
    this.volleys++;
    let n = mods.shots;
    let spread = Cfg.MULTISHOT_SPREAD;
    if (mods.shotgun && this.volleys % 4 === 0) { n += mods.shotgun; spread = 0.4; }
    for (let i = 0; i < n && this.blue.length < Cfg.MAX_BLUE + mods.maxBlue; i++) {
      const off = (i - (n - 1) * 0.5) * spread;
      const m = this.newBlue(this.cannonX + off * 0.6, Cfg.CANNON_Z + 0.4, mods.unitHp);
      m.vx = off * 0.9 + rand(-0.25, 0.25);
      m.el = this.rollElement();
      if (Math.random() < mods.goldChance) this.makeGold(m);
      if (mods.shieldEvery && (this.volleys * 7 + i) % mods.shieldEvery === 0) m.shield = true;
      m.ghost = mods.ghost;
    }
    this.recoil = 1;
    if (!this.giantReady()) this.charge += 1;
  }

  fireGiant() {
    const pair = this.mods.giantPair;
    for (const off of pair ? [-1.1, 1.1] : [0]) {
      const m = this.newBlue(clamp(this.cannonX + off, -Cfg.LANE_HALF + 1, Cfg.LANE_HALF - 1), Cfg.CANNON_Z + 0.6, Math.round(this.mods.giantHp));
      m.kind = 'giant';
      m.r = Cfg.GIANT_R;
      m.el = this.mainElement();
      m.stompCd = 1;
    }
    this.recoil = 1.6;
    this.shake = Math.max(this.shake, 4);
    this.events.push({ type: 'giant' });
  }

  newBlue(x, z, hp) {
    const m = new Mob(0, x, z, hp);
    this.blue.push(m);
    return m;
  }

  moveBlue(dt) {
    const speed = Cfg.UNIT_SPEED * this.mods.unitSpeed;
    for (const m of this.blue) {
      if (!m.alive) continue;
      const pz = m.z;
      m.z += (m.kind === 'giant' ? Cfg.GIANT_SPEED : speed) * dt;
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
    const mods = this.mods;
    for (const g of this.gates) {
      if (g.used) continue;
      const bit = 2 ** g.id;
      if (Math.floor(m.gates / bit) % 2 === 1 || pz >= g.z || m.z < g.z) continue;
      if (Math.abs(m.x - g.x) > g.halfW + m.r * 0.5) continue;
      m.gates += bit;
      g.flash = 1;
      // Gate items act on the passing mob before it is copied.
      if (mods.gateElement && m.el === EL.NONE) m.el = 1 + Math.floor(Math.random() * 3);
      if (mods.gateGold && m.kind !== 'giant' && Math.random() < mods.gateGold) this.makeGold(m);
      if (mods.gateCharge && !this.giantReady()) this.charge += mods.gateCharge;
      if (mods.gateCoins) this.coins += mods.gateCoins * mods.coinMult;
      if (g.kind === 'div') {
        if (m.kind !== 'giant' && Math.random() < 1 - 1 / g.value) {
          this.killBlue(m);
          return;
        }
        continue;
      }
      if (g.kind === 'add') {
        g.used = true;
        this.spawnClones(m, g, g.value, true);
        this.events.push({ type: 'text', x: g.x, z: g.z, text: `+${g.value}`, color: '#5fe3ff' });
      } else if (m.kind === 'giant') {
        this.spawnClones(m, g, (g.value - 1) * Cfg.GIANT_GATE_SPAWN, true);
      } else {
        this.spawnClones(m, g, g.value - 1, false);
      }
    }
  }

  // Clones copy everything about the parent (element, gold, shield...).
  // `fresh` clones get the base unit hp instead of the parent's. The mob cap
  // is a hard ceiling: past it, clones are simply lost.
  spawnClones(m, g, count, fresh) {
    const cap = Cfg.MAX_BLUE + this.mods.maxBlue;
    const hp = fresh ? this.mods.unitHp : m.hp;
    for (let k = 0; k < count; k++) {
      if (this.blue.length >= cap) break;
      const c = this.newBlue(
        clamp(m.x + rand(-0.7, 0.7), g.x - g.halfW, g.x + g.halfW), g.z + rand(0, 0.6), hp);
      c.vx = rand(-1.2, 1.2);
      c.gates = m.gates;
      c.el = m.el;
      c.ghost = m.ghost;
      c.small = m.small;
      if (m.kind !== 'giant') { c.gold = m.gold; c.shield = m.shield; }
    }
  }

  hitBase(m) {
    m.alive = false;
    this.baseHp -= m.hp;
    this.baseFlash = 1;
    this.shake = Math.max(this.shake, m.kind === 'giant' ? 6 : 1.2);
    this.events.push({ type: 'pop', x: m.x, z: Cfg.LANE_LEN, team: 2, big: m.kind === 'giant' });
  }

  killBlue(b) {
    if (!b.alive) return;
    b.alive = false;
    const mods = this.mods;
    this.events.push({ type: 'pop', x: b.x, z: b.z, team: 0, big: b.kind === 'giant', el: b.el });
    if (mods.explode > 0) this.explosion(b.x, b.z, mods.explode * (b.kind === 'giant' ? 2.2 : 1), 1 + (b.gold ? 2 : 0), b.el);
    if (b.el === EL.POISON) this.addCloud(b.x, b.z, 0.9 * mods.cloudSize);
    if (b.kind === 'giant') {
      for (let k = 0; k < mods.brood; k++) {
        const c = this.newBlue(b.x + rand(-0.8, 0.8), b.z + rand(-0.5, 0.5), mods.unitHp);
        c.vx = rand(-2, 2);
        c.el = b.el;
        c.gates = b.gates;
      }
    } else if (!b.small && mods.split > 0 && Math.random() < mods.split) {
      for (const sx of [-1, 1]) {
        const c = this.newBlue(b.x + sx * 0.3, b.z, Math.max(1, Math.floor(b.maxHp / 2)));
        c.small = true;
        c.el = b.el;
        c.vx = sx * 1.5;
        c.gates = b.gates;
      }
    }
  }

  giantAbilities(dt) {
    const mods = this.mods;
    if (mods.giantAura) this.auraTimer -= dt;
    const aura = mods.giantAura && this.auraTimer <= 0;
    if (aura) this.auraTimer = 0.5;
    for (const g of this.blue) {
      if (!g.alive || g.kind !== 'giant') continue;
      if (mods.stomp) {
        g.stompCd -= dt;
        if (g.stompCd <= 0) {
          g.stompCd = 1;
          this.explosion(g.x, g.z + 0.5, 2.2, mods.stomp, g.el, true);
        }
      }
      if (aura) {
        for (const b of this.blue) if (b.kind !== 'giant' && dist2(b, g.x, g.z) < 4) b.shield = true;
      }
    }
  }

  updateTurrets(dt) {
    const n = this.turretCd.length;
    for (let i = 0; i < n; i++) {
      this.turretCd[i] -= dt;
      if (this.turretCd[i] > 0) continue;
      this.turretCd[i] = Cfg.TURRET_INTERVAL;
      const x = n === 1 ? 0 : -Cfg.LANE_HALF + 0.6 + (i / (n - 1)) * (Cfg.LANE_HALF * 2 - 1.2);
      let best = null, bd = 1e9;
      for (const r of this.red) {
        if (!r.alive || r.z > Cfg.TURRET_RANGE) continue;
        const d = dist2(r, x, 0);
        if (d < bd) { bd = d; best = r; }
      }
      if (best) this.shots.push({ x, z: 0.6, target: best, el: this.randomOwnedElement() });
    }
    for (const s of this.shots) {
      const t = s.target;
      const dx = t.x - s.x, dz = t.z - s.z, d = Math.hypot(dx, dz);
      const step = 26 * dt;
      if (!t.alive) { s.done = true; continue; }
      if (d <= step) {
        s.done = true;
        this.damageRed(t, Cfg.TURRET_DMG, s.el);
        this.events.push({ type: 'pop', x: t.x, z: t.z, team: 3, big: false, el: s.el });
      } else {
        s.x += (dx / d) * step;
        s.z += (dz / d) * step;
      }
    }
    if (this.shots.length) this.shots = this.shots.filter((s) => !s.done);
  }

  updateWall(dt) {
    const mods = this.mods;
    if (mods.wallRegen) {
      this.wallRegenTimer -= dt;
      if (this.wallRegenTimer <= 0) {
        this.wallRegenTimer = mods.wallRegen;
        this.healCastle(1);
      }
    }
  }

  healCastle(n) {
    if (this.castleHp >= this.castleMax) return;
    this.castleHp = Math.min(this.castleMax, this.castleHp + n);
    this.events.push({ type: 'heal' });
  }

  // ======================================================================
  // Enemy side
  // ======================================================================
  enemyHp(base) { return base * this.mods.enemyHp; }

  spawnRed(dt) {
    const L = this.level;
    let rate = Cfg.RED_RATE * (1 + Cfg.RED_RATE_PER_LEVEL * (L - 1));
    rate *= 1 + Cfg.RED_RAMP * this.time;
    rate *= 1 + Cfg.RED_PANIC * (1 - this.baseHp / this.baseMax);
    // Enrage: a round that drags on gets out of hand.
    let hp = this.redScale;
    if (this.time > Cfg.ENRAGE_TIME) {
      const k = Math.pow(2, (this.time - Cfg.ENRAGE_TIME) / Cfg.ENRAGE_DOUBLE);
      rate *= k;
      hp *= k;
      this.enraged = true;
    }
    this.redAcc += rate * dt;
    while (this.redAcc >= 1) {
      this.redAcc -= 1;
      if (this.red.length >= Cfg.MAX_RED) continue;
      const x = rand(-Cfg.LANE_HALF + 0.5, Cfg.LANE_HALF - 0.5);
      const roll = Math.random();
      if (L >= Cfg.BOMBER_LEVEL && roll < 0.08) {
        const m = this.newRed(x, hp * 1.5, 'bomber');
        m.speed = 0.85;
      } else if (L >= Cfg.SHIELD_LEVEL && roll < 0.2) {
        const m = this.newRed(x, hp, 'shield');
        m.armor = this.enemyHp(Cfg.SHIELD_ARMOR * hp);
        m.speed = 0.8;
      } else if (L >= Cfg.RUNNER_LEVEL && roll < 0.38) {
        const m = this.newRed(x, hp * 0.7, 'runner');
        m.speed = 1.8;
      } else {
        this.newRed(x, hp, 'unit');
      }
    }
    if (L >= Cfg.BRUTE_FIRST_LEVEL) {
      this.bruteTimer -= dt;
      if (this.bruteTimer <= 0) {
        this.bruteTimer = Cfg.BRUTE_INTERVAL * rand(0.8, 1.2);
        const m = this.newRed(rand(-2.5, 2.5), Cfg.BRUTE_HP * hp * (1 + 0.1 * (L - Cfg.BRUTE_FIRST_LEVEL)), 'brute');
        m.speed = 0.55;
      }
    }
    if (this.boss && !this.bossSpawned && this.time > 6) {
      this.bossSpawned = true;
      const m = this.newRed(0, Cfg.BOSS_HP * hp * Math.pow(Cfg.BOSS_HP_GROWTH, L / 5 - 1), 'boss');
      m.speed = 0.32;
      m.minionCd = 3;
      this.events.push({ type: 'boss' });
    }
  }

  newRed(x, hp, kind) {
    const m = new Mob(1, x, Cfg.LANE_LEN - 0.4, this.enemyHp(hp));
    m.kind = kind;
    m.vx = rand(-0.4, 0.4);
    if (kind === 'brute') m.r = Cfg.GIANT_R;
    if (kind === 'boss') m.r = Cfg.BOSS_R;
    if (kind === 'runner') m.r = Cfg.UNIT_R * 0.8;
    this.red.push(m);
    return m;
  }

  moveRed(dt) {
    const spd = Cfg.RED_SPEED + Cfg.RED_SPEED_PER_LEVEL * (this.level - 1);
    const mods = this.mods;
    for (const m of this.red) {
      if (!m.alive) continue;
      let s = spd * m.speed;
      if (m.slow > 0) s *= 0.4;
      if (mods.frostWall && m.z < Cfg.FROST_WALL_Z) s *= 0.4;
      if (this.state === 'won') s = -spd * 0.5;
      m.z -= s * dt;
      m.x += (m.vx + (this.cannonX - m.x) * Cfg.RED_HOMING * Math.min(1, (Cfg.LANE_LEN - m.z) / 20)) * dt;
      const lim = Cfg.LANE_HALF - m.r;
      if (Math.abs(m.x) > lim) { m.x = Math.sign(m.x) * lim; m.vx = -m.vx; }
      if (m.kind === 'boss' && this.state === 'playing') {
        m.minionCd -= dt;
        if (m.minionCd <= 0) {
          m.minionCd = 2.5;
          for (let k = 0; k < 4 && this.red.length < Cfg.MAX_RED; k++) {
            const c = this.newRed(m.x + rand(-1.5, 1.5), this.redScale, 'unit');
            c.z = m.z - 0.5;
          }
        }
      }
      if (this.state === 'playing' && m.z <= Cfg.CANNON_Z - 0.2) this.reachWall(m);
    }
  }

  reachWall(m) {
    m.alive = false;
    let dmg = m.kind === 'boss' ? Cfg.BOSS_WALL_DMG : m.kind === 'brute' ? 3 : 1;
    if (this.mods.spikes) {
      dmg = Math.ceil(dmg / 2);
      this.explosion(m.x, Cfg.CANNON_Z + 0.4, 1.6, 2, EL.NONE);
    }
    this.hurtCastle(dmg);
    this.events.push({ type: 'pop', x: m.x, z: m.z, team: 1, big: true });
  }

  hurtCastle(dmg) {
    this.castleHp -= dmg;
    this.castleFlash = 1;
    this.shake = Math.max(this.shake, 5);
    if (this.mods.rage) this.rage = 4;
  }

  updateRocks(dt) {
    if (this.level >= Cfg.ROCK_LEVEL) {
      this.rockTimer -= dt;
      if (this.rockTimer <= 0) {
        this.rockTimer = Math.max(Cfg.ROCK_MIN, Cfg.ROCK_INTERVAL - this.level * 0.25) * rand(0.8, 1.2);
        const n = this.level >= 12 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const tx = clamp(this.cannonX + (k ? rand(-2.5, 2.5) : rand(-0.4, 0.4)), -Cfg.LANE_HALF + 0.6, Cfg.LANE_HALF - 0.6);
          this.rocks.push({ tx, tz: Cfg.CANNON_Z, t: 0, dur: Cfg.ROCK_FLIGHT });
        }
      }
    }
    for (const r of this.rocks) {
      r.t += dt;
      if (r.t < r.dur) continue;
      r.done = true;
      this.shake = Math.max(this.shake, 4);
      this.events.push({ type: 'ring', x: r.tx, z: r.tz, r: Cfg.ROCK_RADIUS, color: 0xa0704a });
      this.events.push({ type: 'pop', x: r.tx, z: r.tz, team: 4, big: true });
      for (const b of this.blue) if (b.alive && dist2(b, r.tx, r.tz) < Cfg.ROCK_RADIUS ** 2 && b.kind !== 'giant') this.killBlue(b);
      if (Math.abs(this.cannonX - r.tx) < Cfg.ROCK_RADIUS) {
        this.hurtCastle(1 + Math.floor(this.level / 10));
        this.stun = 0.8;
        this.events.push({ type: 'text', x: this.cannonX, z: 2, text: 'AU!', color: '#ff5050' });
      }
    }
    if (this.rocks.length) this.rocks = this.rocks.filter((r) => !r.done);
  }

  // ======================================================================
  // Damage, statuses and chain reactions
  // ======================================================================
  applyElement(r, el) {
    const p = this.mods.elPower;
    if (el === EL.FIRE) r.burn = Math.max(r.burn, this.mods.burnTime * p);
    else if (el === EL.ICE) r.slow = Math.max(r.slow, this.mods.slowTime * p);
    else if (el === EL.POISON) r.poisoned = Math.max(r.poisoned, 3);
  }

  /** Deals damage to an enemy, armor first. Returns damage actually done. */
  damageRed(r, dmg, el = EL.NONE) {
    if (!r.alive) return 0;
    if (r.slow > 0) dmg *= this.mods.frozenDmgMult;
    let done = 0;
    if (r.armor > 0) {
      const a = Math.min(r.armor, dmg);
      r.armor -= a; dmg -= a; done += a;
    }
    const h = Math.min(r.hp, dmg);
    r.hp -= h;
    done += h;
    this.applyElement(r, el);
    if (r.hp <= 0.0001) this.killRed(r, el);
    return done;
  }

  killRed(r, el) {
    if (!r.alive) return;
    r.alive = false;
    const mods = this.mods;
    this.kills++;
    const value = { unit: 1, runner: 1, shield: 3, bomber: 2, brute: Cfg.BRUTE_COINS, boss: Cfg.BOSS_COINS }[r.kind] || 1;
    this.coins += value * Cfg.COIN_PER_KILL * mods.coinMult * (r.goldHit ? 2 : 1);
    this.events.push({ type: 'pop', x: r.x, z: r.z, team: 1, big: r.giant, el });
    if (r.kind === 'boss') {
      this.events.push({ type: 'text', x: r.x, z: r.z, text: 'BOSS!', color: '#ffd84a' });
      this.shake = 10;
    }
    if (mods.regenKills) {
      this.regenCount++;
      if (this.regenCount >= mods.regenKills) { this.regenCount = 0; this.healCastle(1); }
    }
    // Enemy bombers take blue mobs with them.
    if (r.kind === 'bomber') {
      this.events.push({ type: 'ring', x: r.x, z: r.z, r: 1.5, color: 0x333333 });
      for (const b of this.blue) if (b.alive && b.kind !== 'giant' && dist2(b, r.x, r.z) < 2.25) this.killBlue(b);
    }
    // Follow-ups that make items play together
    if (r.burn > 0) {
      if (mods.pyro) this.explosion(r.x, r.z, 1.2, 2, EL.FIRE);
      if (mods.burnSpread) {
        for (const o of this.red) if (o.alive && dist2(o, r.x, r.z) < 1.4) o.burn = Math.max(o.burn, mods.burnTime);
      }
    }
    if (r.slow > 0 && mods.shatter) this.explosion(r.x, r.z, 1.3, 1, EL.ICE);
    if (r.poisoned > 0 && mods.plagueConvert && this.blue.length < Cfg.MAX_BLUE + mods.maxBlue && r.kind !== 'boss') {
      const c = this.newBlue(r.x, r.z, mods.unitHp);
      c.el = EL.POISON;
      c.gates = 2 ** 30 - 1;   // converts skip the gates behind them
    }
  }

  explosion(x, z, radius, dmg, el, stomp = false) {
    const colors = { 0: 0xffb347, 1: 0xff6a1a, 2: 0x8fe8ff, 3: 0x6fe36a };
    this.events.push({ type: 'ring', x, z, r: radius, color: colors[el], stomp });
    const r2 = radius * radius;
    for (const r of this.red) {
      if (r.alive && dist2(r, x, z) < r2 + r.r * r.r) this.damageRed(r, dmg * (el ? this.mods.elPower : 1), el);
    }
    if (el === EL.POISON && !stomp) this.addCloud(x, z, radius * 0.8);
  }

  addCloud(x, z, r) {
    if (this.clouds.length >= Cfg.MAX_CLOUDS) this.clouds.shift();
    this.clouds.push({ x, z, r, t: 0, life: this.mods.cloudTime, tick: 0 });
  }

  updateClouds(dt) {
    for (const c of this.clouds) {
      c.t += dt;
      c.tick -= dt;
      if (c.tick > 0) continue;
      c.tick = 0.4;
      const r2 = c.r * c.r;
      for (const r of this.red) {
        if (r.alive && dist2(r, c.x, c.z) < r2) {
          r.poisoned = 3;
          this.damageRed(r, 0.6 * this.mods.elPower, EL.POISON);
        }
      }
    }
    if (this.clouds.length) this.clouds = this.clouds.filter((c) => c.t < c.life);
  }

  updateStatuses(dt) {
    const burn = this.mods.burnDps * this.mods.elPower;
    for (const r of this.red) {
      if (!r.alive) continue;
      if (r.slow > 0) r.slow -= dt;
      if (r.poisoned > 0) r.poisoned -= dt;
      if (r.burn > 0) {
        r.burn -= dt;
        r.hp -= burn * dt;
        if (r.hp <= 0) { r.burn = Math.max(r.burn, 0.01); this.killRed(r, EL.FIRE); }
      }
    }
  }

  collide() {
    // Spatial hash of the reds. Cell size 1 covers unit-unit contact;
    // big units search a wider ring.
    const grid = new Map();
    for (const r of this.red) {
      if (!r.alive) continue;
      const key = (Math.floor(r.x) + 64) * 4096 + Math.floor(r.z) + 64;
      const cell = grid.get(key);
      if (cell) cell.push(r); else grid.set(key, [r]);
    }
    const frozenMult = this.mods.frozenDmgMult;
    for (const b of this.blue) {
      if (!b.alive) continue;
      const ring = b.kind === 'giant' ? 2 : 1;
      const bcx = Math.floor(b.x), bcz = Math.floor(b.z);
      outer:
      for (let dx = -ring - 1; dx <= ring + 1; dx++) {
        for (let dz = -ring - 1; dz <= ring + 1; dz++) {
          const cell = grid.get((bcx + dx + 64) * 4096 + bcz + dz + 64);
          if (!cell) continue;
          for (const r of cell) {
            if (!r.alive) continue;
            const rr = b.r + r.r, ddx = b.x - r.x, ddz = b.z - r.z;
            if (ddx * ddx + ddz * ddz > rr * rr) continue;
            if (b.ghost && b.kind !== 'giant') { b.ghost = false; b.ghostedId = r.id; continue; }
            if (b.ghostedId === r.id) continue;
            // Mutual damage: the blue mob spends its hp to deal damage.
            const mult = r.slow > 0 ? frozenMult : 1;
            const pool = r.hp + r.armor;
            const spend = Math.min(b.hp, pool / mult);
            if (b.gold) r.goldHit = true;
            this.damageRed(r, spend, b.el);
            if (b.shield) b.shield = false;
            else b.hp -= spend;
            if (b.hp <= 0.0001) { this.killBlue(b); break outer; }
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
    return (Cfg.WIN_REWARD + Cfg.WIN_REWARD_PER_LEVEL * (this.level - 1)) * this.mods.coinMult * (this.boss ? 2 : 1);
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
      this.rocks = [];
    }
    this.reward = Math.round(total);
  }
}
