// Enemy types and their behaviour. Each type has stats plus an update
// function that steers it using helpers on the world (flow field, line of
// sight, enemy shots). Floor scaling of hp happens in the world.

import { Cfg } from './config.js';

const TAU = Math.PI * 2;
const HW = Cfg.ROOM_W / 2, HD = Cfg.ROOM_D / 2;
const rand = (a, b) => a + Math.random() * (b - a);
const angleTo = (e, p) => Math.atan2(p.z - e.z, p.x - e.x);

export const ENEMIES = {
  fly: {
    name: 'Flue', hp: 5, r: 0.22, speed: 2.3, flying: true, cost: 0.7, group: 3, floor: 0, weight: 3,
    update(e, w, dt) {
      // Erratic buzzing towards the player.
      e.t += dt;
      const p = w.player;
      const a = Math.atan2(p.z - e.z, p.x - e.x) + Math.sin(e.t * 5 + e.phase) * 1.1;
      e.vx += (Math.cos(a) * this.speed - e.vx) * dt * 4;
      e.vz += (Math.sin(a) * this.speed - e.vz) * dt * 4;
      w.moveEnemy(e, e.vx * dt, e.vz * dt);
    },
  },
  grub: {
    name: 'Larve', hp: 11, r: 0.33, speed: 0.95, cost: 1.4, floor: 0, weight: 3,
    update(e, w, dt) {
      e.t += dt;
      // Inches forward in pulses.
      const pulse = 0.4 + Math.max(0, Math.sin(e.t * 4 + e.phase)) * 1.2;
      const [dx, dz] = w.flowDir(e);
      w.moveEnemy(e, dx * this.speed * pulse * dt, dz * this.speed * pulse * dt);
      e.face = Math.atan2(dz, dx);
    },
  },
  eye: {
    name: 'Glaner', hp: 9, r: 0.3, speed: 1.3, hover: true, cost: 2.2, floor: 0, weight: 2,
    update(e, w, dt) {
      e.t += dt;
      const p = w.player;
      const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1;
      // Keep a wary distance and circle.
      const want = 4.5;
      const radial = d > want + 0.5 ? 1 : d < want - 0.5 ? -1 : 0;
      const tx = (dx / d) * radial - (dz / d) * 0.6, tz = (dz / d) * radial + (dx / d) * 0.6;
      w.moveEnemy(e, tx * this.speed * dt, tz * this.speed * dt);
      e.cd -= dt;
      if (e.cd <= 0 && w.hasLOS(e, p)) {
        e.cd = 2.2 - Math.min(0.8, w.floor * 0.25);
        const a = Math.atan2(dz, dx);
        const spread = w.floor >= 2 ? [-0.25, 0, 0.25] : [0];
        for (const s of spread) w.enemyShot(e.x, e.z, a + s, 5.5);
        e.blink = 0.25;
      }
      e.blink = Math.max(0, (e.blink || 0) - dt);
    },
    init(e) { e.cd = rand(1, 2); },
  },
  ram: {
    name: 'Beinvær', hp: 16, r: 0.38, speed: 1.4, cost: 2.6, floor: 1, weight: 2,
    update(e, w, dt) {
      const p = w.player;
      if (e.state === 'charge') {
        const moved = w.moveEnemy(e, e.dirx * 9 * dt, e.dirz * 9 * dt);
        if (!moved) { e.state = 'stun'; e.t = 0.7; w.shake = Math.max(w.shake, 2); }
        return;
      }
      if (e.state === 'stun') { e.t -= dt; if (e.t <= 0) e.state = 'walk'; return; }
      // Walk in straight lines, charge when lined up with the player.
      e.t -= dt;
      if (e.t <= 0 || !e.dirx && !e.dirz) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        [e.dirx, e.dirz] = dirs[Math.floor(Math.random() * 4)];
        e.t = rand(0.8, 1.8);
      }
      const ax = Math.abs(p.x - e.x) < 0.5, az = Math.abs(p.z - e.z) < 0.5;
      if ((ax || az) && w.hasLOS(e, p)) {
        e.state = 'charge';
        e.dirx = ax ? 0 : Math.sign(p.x - e.x);
        e.dirz = ax ? Math.sign(p.z - e.z) : 0;
        e.face = Math.atan2(e.dirz, e.dirx);
        return;
      }
      if (!w.moveEnemy(e, e.dirx * this.speed * dt, e.dirz * this.speed * dt)) e.t = 0;
      e.face = Math.atan2(e.dirz, e.dirx);
    },
    init(e) { e.state = 'walk'; e.t = 0; },
  },
  slime: {
    name: 'Slim', hp: 15, r: 0.4, speed: 3.2, cost: 2.4, floor: 0, weight: 2,
    update(e, w, dt) {
      e.t -= dt;
      if (e.t <= 0) {
        e.t = rand(1.0, 1.4);
        e.hop = 0.45;
        const [dx, dz] = w.flowDir(e);
        e.dirx = dx; e.dirz = dz;
      }
      if (e.hop > 0) {
        e.hop -= dt;
        w.moveEnemy(e, e.dirx * this.speed * (e.small ? 1.2 : 1) * dt, e.dirz * this.speed * (e.small ? 1.2 : 1) * dt);
      }
    },
    init(e) { e.t = rand(0.3, 1); e.hop = 0; },
    onDeath(e, w) {
      if (e.small) return;
      for (const s of [-1, 1]) {
        const c = w.spawnEnemy('slime', e.x + s * 0.3, e.z, true);
        c.small = true;
        c.r = 0.26;
        c.hp = c.maxHp = c.maxHp * 0.4;
        c.t = 0.3;
      }
    },
  },

  spider: {
    name: 'Edderkopp', hp: 6, r: 0.26, speed: 4.6, cost: 0.9, group: 2, floor: 0, weight: 2,
    init(e) { e.t = rand(0.2, 0.6); e.run = 0; },
    update(e, w, dt) {
      // Freezes, then skitters off in a burst, roughly towards you.
      if (e.run > 0) {
        e.run -= dt;
        if (!w.moveEnemy(e, e.dirx * this.speed * dt, e.dirz * this.speed * dt)) e.run = 0;
        return;
      }
      e.t -= dt;
      if (e.t <= 0) {
        const [dx, dz] = w.flowDir(e);
        const a = Math.atan2(dz, dx) + rand(-0.9, 0.9);
        e.dirx = Math.cos(a); e.dirz = Math.sin(a);
        e.run = rand(0.25, 0.45);
        e.t = rand(0.25, 0.7);
        e.face = a;
      }
    },
  },
  clot: {
    name: 'Blodklump', hp: 14, r: 0.36, speed: 0.7, cost: 2.0, floor: 0, weight: 2,
    init(e) { e.cd = rand(1.2, 2.4); e.cross = Math.random() < 0.5; e.squish = 0; },
    update(e, w, dt) {
      // Oozes slowly and spits blood in four directions, alternating + and x.
      e.t += dt;
      const [dx, dz] = w.flowDir(e);
      const wob = 0.5 + Math.max(0, Math.sin(e.t * 3 + e.phase));
      w.moveEnemy(e, dx * this.speed * wob * dt, dz * this.speed * wob * dt);
      e.squish = Math.max(0, e.squish - dt * 3);
      e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = rand(2.0, 2.6);
        e.squish = 1;
        const off = e.cross ? Math.PI / 4 : 0;
        e.cross = !e.cross;
        for (let k = 0; k < 4; k++) w.enemyShot(e.x, e.z, off + (k * Math.PI) / 2, 4.2);
        if (w.floor >= 2) for (let k = 0; k < 4; k++) w.enemyShot(e.x, e.z, off + Math.PI / 4 + (k * Math.PI) / 2, 3.2);
      }
    },
  },
  gaper: {
    name: 'Den tomme', hp: 15, r: 0.34, speed: 1.6, cost: 1.6, floor: 1, weight: 3,
    update(e, w, dt) {
      // Shambles straight at you, and starts running once it is hurt.
      e.t += dt;
      const sp = e.hp < e.maxHp * 0.5 ? this.speed * 1.6 : this.speed;
      const [dx, dz] = w.flowDir(e);
      w.moveEnemy(e, dx * sp * dt, dz * sp * dt);
      e.face = Math.atan2(dz, dx);
      e.angry = e.hp < e.maxHp * 0.5;
    },
  },
  host: {
    name: 'Skallevokter', hp: 12, r: 0.34, speed: 0, cost: 2.0, floor: 1, weight: 2, still: true,
    init(e) { e.state = 'hide'; e.t = rand(0.8, 1.8); e.up = 0; e.armor = true; },
    update(e, w, dt) {
      // Hides in its mound (shots glance off), pops up to fire, then hides.
      const p = w.player;
      e.t -= dt;
      if (e.state === 'hide') {
        e.up = Math.max(0, e.up - dt * 5);
        if (e.t <= 0 && w.hasLOS(e, p) && Math.hypot(p.x - e.x, p.z - e.z) < 8) { e.state = 'rise'; e.t = 0.3; }
      } else if (e.state === 'rise') {
        e.up = Math.min(1, e.up + dt * 4);
        e.armor = false;
        if (e.t <= 0) {
          const a = angleTo(e, p);
          const spread = w.floor >= 2 ? [-0.3, -0.1, 0.1, 0.3] : [-0.22, 0, 0.22];
          for (const s of spread) w.enemyShot(e.x, e.z, a + s, 5.0);
          e.state = 'up'; e.t = 1.1;
        }
      } else if (e.state === 'up') {
        if (e.t <= 0) { e.state = 'hide'; e.t = rand(1.4, 2.0); e.armor = true; }
      }
    },
  },
  leaper: {
    name: 'Hopper', hp: 13, r: 0.34, speed: 0.6, cost: 2.0, floor: 1, weight: 2,
    init(e) { e.state = 'sit'; e.t = rand(0.8, 1.6); e.lift = 0; },
    update(e, w, dt) {
      // Crouches, then leaps onto where you stand. Can't be hit in the air.
      const p = w.player;
      e.t -= dt;
      if (e.state === 'sit') {
        if (e.t <= 0) {
          e.state = 'jump'; e.t = e.dur = 0.75; e.air = true;
          e.sx = e.x; e.sz = e.z;
          e.tx = p.x + rand(-0.6, 0.6); e.tz = p.z + rand(-0.6, 0.6);
        }
      } else {
        const k = Math.min(1, 1 - e.t / e.dur);
        e.x = e.sx + (e.tx - e.sx) * k;
        e.z = e.sz + (e.tz - e.sz) * k;
        e.lift = Math.sin(k * Math.PI) * 2.2;
        if (e.t <= 0) {
          e.air = false; e.lift = 0; e.state = 'sit'; e.t = rand(1.0, 1.6);
          w.clampToRoom(e);
          w.collideTiles(e);
          w.events.push({ type: 'slam', x: e.x, z: e.z, r: 0.9 });
          if (w.floor >= 2) for (let k2 = 0; k2 < 4; k2++) w.enemyShot(e.x, e.z, Math.PI / 4 + (k2 * Math.PI) / 2, 4);
        }
      }
    },
  },
  boomfly: {
    name: 'Pestflue', hp: 10, r: 0.3, speed: 2.4, flying: true, cost: 2.0, floor: 2, weight: 2,
    init(e) { const a = Math.PI / 4 + Math.floor(Math.random() * 4) * (Math.PI / 2); e.vx = Math.cos(a); e.vz = Math.sin(a); },
    update(e, w, dt) {
      // Drifts diagonally and bounces off the walls. Bursts when it dies.
      e.t += dt;
      e.x += e.vx * this.speed * dt;
      e.z += e.vz * this.speed * dt;
      if (Math.abs(e.x) > HW - e.r) { e.x = Math.sign(e.x) * (HW - e.r); e.vx = -e.vx; }
      if (Math.abs(e.z) > HD - e.r) { e.z = Math.sign(e.z) * (HD - e.r); e.vz = -e.vz; }
    },
    onDeath(e, w) {
      for (let k = 0; k < 6; k++) w.enemyShot(e.x, e.z, (k / 6) * TAU + e.phase, 3.8);
      w.events.push({ type: 'explode', x: e.x, z: e.z, r: 0.9, fx: { poison: 1 } });
    },
  },
  wraith: {
    name: 'Gjenferd', hp: 13, r: 0.32, speed: 1.2, flying: true, cost: 2.4, floor: 2, weight: 2,
    init(e) { e.cd = rand(1.5, 2.5); e.fadeT = rand(3, 4); e.ghost = false; e.alpha = 1; },
    update(e, w, dt) {
      // Drifts after you, fires slow seeking shots, and turns
      // intangible now and then (shots pass straight through).
      e.t += dt;
      const p = w.player;
      const a = angleTo(e, p) + Math.sin(e.t * 1.3 + e.phase) * 0.7;
      w.moveEnemy(e, Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt);
      e.fadeT -= dt;
      if (e.fadeT <= 0) { e.ghost = !e.ghost; e.fadeT = e.ghost ? 1.3 : rand(2.8, 3.8); }
      e.alpha += ((e.ghost ? 0.25 : 1) - e.alpha) * Math.min(1, dt * 8);
      if (!e.ghost) {
        e.cd -= dt;
        if (e.cd <= 0) { e.cd = rand(2.2, 2.8); w.enemyShot(e.x, e.z, angleTo(e, p), 3.0, 1, { home: 1.6, life: 3.5 }); }
      }
    },
  },

  // --- Bosses -------------------------------------------------------------
  // `floors` lists the floors a boss can appear on.
  bloat: {
    name: 'Den oppsvulmede', hp: 140, r: 1.15, speed: 1.0, boss: true, floors: [0, 1], cost: 0, floor: 99, weight: 0,
    init(e) { e.state = 'idle'; e.t = 1.5; e.pattern = 0; },
    update(e, w, dt) {
      const p = w.player;
      const angry = e.hp < e.maxHp * 0.5;
      e.t -= dt;
      if (e.state === 'idle') {
        const [dx, dz] = w.flowDir(e);
        w.moveEnemy(e, dx * this.speed * dt, dz * this.speed * dt);
        if (e.t <= 0) {
          const patterns = ['ring', 'leap', 'flies', 'spray'];
          e.state = patterns[e.pattern++ % patterns.length];
          e.t = 0;
          e.step = 0;
        }
        return;
      }
      if (e.state === 'ring') {
        // Swells up, then bursts a ring of shots.
        if (e.step === 0) { e.t = 0.6; e.step = 1; e.swell = 1; }
        else if (e.t <= 0) {
          const n = (angry ? 12 : 8) + w.floor * 2, off = Math.random() * TAU;
          for (let k = 0; k < n; k++) w.enemyShot(e.x, e.z, off + (k / n) * TAU, 4.2, 1);
          w.shake = Math.max(w.shake, 3);
          e.swell = 0;
          endAttack(e, angry);
        }
      } else if (e.state === 'leap') {
        // Jumps at where the player stands; lands with a shockwave.
        if (e.step === 0) { e.step = 1; e.t = 1.1; e.tx = p.x; e.tz = p.z; e.sx = e.x; e.sz = e.z; e.air = true; }
        else if (e.t > 0) {
          const k = 1 - e.t / 1.1;
          e.x = e.sx + (e.tx - e.sx) * k;
          e.z = e.sz + (e.tz - e.sz) * k;
          e.lift = Math.sin(k * Math.PI) * 3.5;
        } else {
          e.air = false;
          e.lift = 0;
          w.clampToRoom(e);
          w.shake = Math.max(w.shake, 6);
          w.events.push({ type: 'slam', x: e.x, z: e.z, r: 2.4 });
          if (Math.hypot(p.x - e.x, p.z - e.z) < 1.7) w.hurtPlayer(w.floor ? 2 : 1);
          const n = (angry ? 8 : 5) + w.floor;
          for (let k = 0; k < n; k++) w.enemyShot(e.x, e.z, (k / n) * TAU, 3.6, 1);
          endAttack(e, angry);
        }
      } else if (e.state === 'flies') {
        if (e.step === 0) {
          e.step = 1;
          const n = Math.min(3 + (angry ? 2 : 0), 8 - w.enemies.length);
          for (let k = 0; k < n; k++) w.spawnEnemy('fly', e.x + rand(-1, 1), e.z + rand(-1, 1), true);
          e.t = 0.5;
        } else if (e.t <= 0) endAttack(e, angry);
      } else if (e.state === 'spray') {
        // Sprays a stream of shots that sweeps across the player.
        if (e.step === 0) { e.step = 1; e.t = angry ? 1.6 : 1.2; e.cd = 0; e.base = Math.atan2(p.z - e.z, p.x - e.x) - 0.6; }
        e.cd -= dt;
        if (e.cd <= 0 && e.t > 0) {
          e.cd = 0.09;
          const k = 1 - e.t / (angry ? 1.6 : 1.2);
          w.enemyShot(e.x, e.z, e.base + k * 1.2, 5.2, 1);
        }
        if (e.t <= 0) endAttack(e, angry);
      }
    },
  },
  gorger: {
    name: 'Glupskjeften', hp: 140, r: 1.15, speed: 1.3, boss: true, floors: [0, 2], cost: 0, floor: 99, weight: 0,
    init(e) { e.state = 'idle'; e.t = 1.2; e.pattern = 0; e.lift = 0; },
    update(e, w, dt) {
      // A huge mouth on legs: hops after you, leaps high and lands on you,
      // and spits a shotgun spray of blood.
      const p = w.player;
      const angry = e.hp < e.maxHp * 0.5;
      e.t -= dt;
      if (e.state === 'idle') {
        e.mouth = 0;
        if (e.t <= 0) { e.state = ['hops', 'spit', 'leap', 'spit'][e.pattern++ % 4]; e.step = 0; e.t = 0; }
        return;
      }
      if (e.state === 'hops') {
        // three short hops towards you
        if (e.step === 0 || (e.t <= 0 && e.step < (angry ? 5 : 4))) {
          if (e.step > 0) { e.air = false; e.lift = 0; w.shake = Math.max(w.shake, 2); w.clampToRoom(e); }
          if (e.step === (angry ? 4 : 3)) { endAttack(e, angry); return; }
          e.step++;
          e.t = e.dur = 0.45; e.sx = e.x; e.sz = e.z; e.air = true;
          const a = angleTo(e, p), d = Math.min(1.7, Math.max(0, Math.hypot(p.x - e.x, p.z - e.z) - 1.5));
          e.tx = e.x + Math.cos(a) * d; e.tz = e.z + Math.sin(a) * d;
        }
        const k = Math.min(1, 1 - e.t / e.dur);
        e.x = e.sx + (e.tx - e.sx) * k; e.z = e.sz + (e.tz - e.sz) * k;
        e.lift = Math.sin(k * Math.PI) * 0.9;
      } else if (e.state === 'spit') {
        if (e.step === 0) { e.step = 1; e.t = 0.5; e.mouth = 1; }
        else if (e.t <= 0) {
          const a = angleTo(e, p), n = (angry ? 11 : 8) + w.floor * 2;
          for (let k = 0; k < n; k++) w.enemyShot(e.x, e.z - 0.3, a + rand(-0.45, 0.45), rand(3.0, 5.6));
          w.shake = Math.max(w.shake, 3);
          e.mouth = 0;
          endAttack(e, angry);
        }
      } else if (e.state === 'leap') {
        if (e.step === 0) { e.step = 1; e.t = e.dur = 1.6; e.sx = e.x; e.sz = e.z; e.air = true; }
        const k = Math.min(1, 1 - e.t / e.dur);
        // follows you while high up, then drops
        if (k < 0.5) { e.tx = p.x; e.tz = p.z; }
        e.x = e.sx + (e.tx - e.sx) * k; e.z = e.sz + (e.tz - e.sz) * k;
        e.lift = Math.sin(k * Math.PI) * 7;
        if (e.t <= 0) {
          e.air = false; e.lift = 0;
          w.clampToRoom(e);
          w.shake = Math.max(w.shake, 7);
          w.events.push({ type: 'slam', x: e.x, z: e.z, r: 2.2 });
          if (Math.hypot(p.x - e.x, p.z - e.z) < 1.6) w.hurtPlayer(2);
          const n = (angry ? 10 : 7) + w.floor;
          for (let k2 = 0; k2 < n; k2++) w.enemyShot(e.x, e.z, (k2 / n) * TAU, 3.8);
          endAttack(e, angry);
        }
      }
    },
  },
  hive: {
    name: 'Svermmoren', hp: 160, r: 1.15, speed: 0.9, boss: true, flying: true, floors: [1, 2], cost: 0, floor: 99, weight: 0,
    init(e) { e.state = 'idle'; e.t = 1.4; e.pattern = 0; e.spin = 0; },
    update(e, w, dt) {
      // A hanging nest of flesh that drifts after you, births flies and
      // spins spirals of blood.
      const p = w.player;
      const angry = e.hp < e.maxHp * 0.5;
      e.t -= dt;
      const a = angleTo(e, p) + Math.sin(w.time * 0.7) * 1.2;
      const d = Math.hypot(p.x - e.x, p.z - e.z);
      if (d > 2.5) w.moveEnemy(e, Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt);
      if (e.state === 'idle') {
        if (e.t <= 0) { e.state = ['spawn', 'spiral', 'burst', 'spiral'][e.pattern++ % 4]; e.step = 0; e.t = 0; }
        return;
      }
      if (e.state === 'spawn') {
        if (e.step === 0) {
          e.step = 1; e.t = 0.6; e.pulse = 1;
          const room = 7 - w.enemies.length;
          const kinds = w.floor >= 2 ? ['fly', 'fly', 'boomfly'] : ['fly', 'fly', 'fly'];
          for (let k = 0; k < Math.min(angry ? 3 : 2, room); k++) w.spawnEnemy(kinds[k % kinds.length], e.x + rand(-0.8, 0.8), e.z + rand(-0.8, 0.8), true);
        } else if (e.t <= 0) { e.pulse = 0; endAttack(e, angry); }
      } else if (e.state === 'spiral') {
        if (e.step === 0) { e.step = 1; e.t = angry ? 2.2 : 1.6; e.cd = 0; }
        e.cd -= dt;
        e.spin += dt * (angry ? 4.2 : 3.2);
        if (e.cd <= 0 && e.t > 0) {
          e.cd = angry ? 0.14 : 0.17;
          const arms = angry ? 4 : 3;
          for (let k = 0; k < arms; k++) w.enemyShot(e.x, e.z, e.spin + (k / arms) * TAU, 3.8);
        }
        if (e.t <= 0) endAttack(e, angry);
      } else if (e.state === 'burst') {
        if (e.step === 0) { e.step = 1; e.t = 0; e.shots = angry ? 4 : 3; }
        if (e.t <= 0) {
          if (e.shots-- <= 0) { endAttack(e, angry); return; }
          e.t = 0.35;
          const b = angleTo(e, p);
          for (const s of [-0.3, -0.1, 0.1, 0.3]) w.enemyShot(e.x, e.z, b + s, 5.0);
        }
      }
    },
  },
  bonelord: {
    name: 'Beinherren', hp: 165, r: 1.1, speed: 1.0, boss: true, floors: [1, 2], cost: 0, floor: 99, weight: 0,
    init(e) { e.state = 'idle'; e.t = 1.4; e.pattern = 0; },
    update(e, w, dt) {
      // A giant horned skeleton: charges across the room and smashes into
      // the wall in a hail of bone, throws bones, calls its herd.
      const p = w.player;
      const angry = e.hp < e.maxHp * 0.5;
      e.t -= dt;
      if (e.state === 'idle') {
        const [dx, dz] = w.flowDir(e);
        w.moveEnemy(e, dx * this.speed * dt, dz * this.speed * dt);
        e.face = Math.atan2(dz, dx);
        if (e.t <= 0) { e.state = ['charge', 'bones', 'charge', 'herd'][e.pattern++ % 4]; e.step = 0; e.t = 0; e.runs = angry ? 3 : 2; }
        return;
      }
      if (e.state === 'charge') {
        if (e.step === 0) {
          // wind up, aiming at you
          e.step = 1; e.t = angry ? 0.45 : 0.6; e.windup = 1;
        } else if (e.step === 1) {
          const a = angleTo(e, p);
          e.dirx = Math.cos(a); e.dirz = Math.sin(a); e.face = a;
          if (e.t <= 0) { e.step = 2; e.windup = 0; e.t = 3; }
        } else if (e.step === 2) {
          const moved = w.moveEnemy(e, e.dirx * 10 * dt, e.dirz * 10 * dt);
          if (!moved || e.t <= 0) {
            w.shake = Math.max(w.shake, 6);
            w.events.push({ type: 'slam', x: e.x, z: e.z, r: 1.8 });
            const n = 8 + w.floor * 2, back = Math.atan2(-e.dirz, -e.dirx);
            for (let k = 0; k < n; k++) w.enemyShot(e.x, e.z, back + rand(-1.2, 1.2), rand(3, 5.5));
            e.step = 3; e.t = 0.6;
          }
        } else if (e.t <= 0) {
          if (--e.runs > 0) { e.step = 0; e.t = 0; } else endAttack(e, angry);
        }
      } else if (e.state === 'bones') {
        if (e.step === 0) { e.step = 1; e.t = 0; e.shots = angry ? 5 : 3; }
        if (e.t <= 0) {
          if (e.shots-- <= 0) { endAttack(e, angry); return; }
          e.t = 0.4;
          const b = angleTo(e, p) + rand(-0.15, 0.15);
          for (const s of [-0.25, 0, 0.25]) w.enemyShot(e.x, e.z, b + s, 6, 1);
        }
      } else if (e.state === 'herd') {
        if (e.step === 0) {
          e.step = 1; e.t = 0.8;
          const room = 6 - w.enemies.length;
          for (let k = 0; k < Math.min(angry ? 3 : 2, room); k++) w.spawnEnemy(k % 2 ? 'gaper' : 'ram', e.x + rand(-1.5, 1.5), e.z + rand(-1.5, 1.5), false);
        } else if (e.t <= 0) endAttack(e, angry);
      }
    },
  },
  deep: {
    name: 'Dypets øye', hp: 175, r: 1.35, speed: 0.8, boss: true, flying: true, floors: [3], cost: 0, floor: 99, weight: 0,
    init(e) { e.state = 'idle'; e.t = 1.6; e.pattern = 0; e.spin = 0; e.alpha = 1; },
    update(e, w, dt) {
      // The thing at the bottom. Spirals, a staring stream of shots,
      // rings, sends its eyes after you, and vanishes to reappear elsewhere.
      const p = w.player;
      const angry = e.hp < e.maxHp * 0.5;
      e.t -= dt;
      e.alpha += ((e.ghost ? 0 : 1) - e.alpha) * Math.min(1, dt * 6);
      if (e.state === 'idle') {
        const a = angleTo(e, p) + Math.PI / 2;
        w.moveEnemy(e, Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt);
        if (e.t <= 0) {
          const seq = angry ? ['spiral', 'stare', 'vanish', 'rings', 'eyes', 'spiral', 'vanish', 'stare'] : ['spiral', 'stare', 'rings', 'vanish', 'eyes'];
          e.state = seq[e.pattern++ % seq.length]; e.step = 0; e.t = 0;
        }
        return;
      }
      if (e.state === 'spiral') {
        if (e.step === 0) { e.step = 1; e.t = angry ? 2.6 : 2.0; e.cd = 0; }
        e.cd -= dt;
        e.spin += dt * 2.4;
        if (e.cd <= 0 && e.t > 0) {
          e.cd = angry ? 0.1 : 0.14;
          for (const dir of [1, -1]) for (let k = 0; k < 2; k++) w.enemyShot(e.x, e.z, dir * e.spin + k * Math.PI, 3.6);
        }
        if (e.t <= 0) endAttack(e, angry);
      } else if (e.state === 'stare') {
        // a stream of shots that slowly follows you
        if (e.step === 0) { e.step = 1; e.t = 2.0; e.cd = 0.4; e.aim = angleTo(e, p); e.stare = 1; }
        const want = angleTo(e, p);
        const diff = ((want - e.aim + Math.PI * 3) % TAU) - Math.PI;
        e.aim += Math.max(-0.9 * dt, Math.min(0.9 * dt, diff));
        e.cd -= dt;
        if (e.cd <= 0 && e.t > 0) { e.cd = 0.07; w.enemyShot(e.x, e.z, e.aim, 6.5); }
        if (e.t <= 0) { e.stare = 0; endAttack(e, angry); }
      } else if (e.state === 'rings') {
        if (e.step === 0) { e.step = 1; e.t = 0; e.shots = angry ? 4 : 3; }
        if (e.t <= 0) {
          if (e.shots-- <= 0) { endAttack(e, angry); return; }
          e.t = 0.55;
          const n = 16, off = e.shots % 2 ? Math.PI / n : 0;
          for (let k = 0; k < n; k++) w.enemyShot(e.x, e.z, off + (k / n) * TAU, 3.4);
        }
      } else if (e.state === 'eyes') {
        if (e.step === 0) {
          e.step = 1; e.t = 0.6;
          const room = 7 - w.enemies.length;
          for (let k = 0; k < Math.min(2, room); k++) w.spawnEnemy(k ? 'wraith' : 'eye', e.x + rand(-1.5, 1.5), e.z + rand(-1, 1), false);
        } else if (e.t <= 0) endAttack(e, angry);
      } else if (e.state === 'vanish') {
        if (e.step === 0) { e.step = 1; e.t = 0.7; e.ghost = true; }
        else if (e.step === 1 && e.t <= 0) {
          // reappear away from you
          let best = null, bd = -1;
          for (let k = 0; k < 8; k++) {
            const x = rand(-HW + 1.5, HW - 1.5), z = rand(-HD + 1.5, HD - 1.5);
            const d = Math.hypot(x - p.x, z - p.z);
            if (d > bd && d < 7) { bd = d; best = [x, z]; }
          }
          if (best) { e.x = best[0]; e.z = best[1]; }
          e.step = 2; e.t = 0.6; e.ghost = false;
        } else if (e.step === 2 && e.t <= 0) {
          const n = angry ? 12 : 8, a0 = angleTo(e, p);
          for (let k = 0; k < n; k++) w.enemyShot(e.x, e.z, a0 + (k / n) * TAU, 4.5);
          endAttack(e, angry);
        }
      }
    },
  },
};

function endAttack(e, angry) {
  e.state = 'idle';
  e.t = angry ? 0.9 : 1.6;
}

/** Picks the boss for a floor from the ones allowed there. */
export function pickBoss(floor, rand) {
  const pool = Object.keys(ENEMIES).filter((k) => ENEMIES[k].boss && ENEMIES[k].floors.includes(floor));
  return pool[Math.floor(rand() * pool.length)] || 'bloat';
}

/** Picks enemy types for a room worth `budget` points. */
export function pickSpawns(budget, floor, rand) {
  const pool = Object.entries(ENEMIES).filter(([, d]) => d.floor <= floor && d.weight > 0);
  const out = [];
  let left = budget;
  for (let guard = 0; guard < 40 && left > 0.6; guard++) {
    let total = 0;
    for (const [, d] of pool) total += d.weight;
    let r = rand() * total;
    let pick = pool[0];
    for (const entry of pool) { r -= entry[1].weight; if (r <= 0) { pick = entry; break; } }
    const [type, d] = pick;
    const n = d.group || 1;
    if (d.cost * n > left + 0.5) continue;
    for (let k = 0; k < n; k++) out.push(type);
    left -= d.cost * n;
  }
  return out;
}

