// Enemy types and their behaviour. Each type has stats plus an update
// function that steers it using helpers on the world (flow field, line of
// sight, enemy shots). Floor scaling of hp happens in the world.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

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

  // --- Boss --------------------------------------------------------------
  bloat: {
    name: 'Den oppsvulmede', hp: 170, r: 1.15, speed: 1.0, boss: true, cost: 0, floor: 99, weight: 0,
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
        if (e.step === 0) { e.step = 1; e.t = 0.9; e.tx = p.x; e.tz = p.z; e.sx = e.x; e.sz = e.z; e.air = true; }
        else if (e.t > 0) {
          const k = 1 - e.t / 0.9;
          e.x = e.sx + (e.tx - e.sx) * k;
          e.z = e.sz + (e.tz - e.sz) * k;
          e.lift = Math.sin(k * Math.PI) * 3.5;
        } else {
          e.air = false;
          e.lift = 0;
          w.clampToRoom(e);
          w.shake = Math.max(w.shake, 6);
          w.events.push({ type: 'slam', x: e.x, z: e.z, r: 2.4 });
          if (Math.hypot(p.x - e.x, p.z - e.z) < 2.0) w.hurtPlayer(2);
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
};

function endAttack(e, angry) {
  e.state = 'idle';
  e.t = angry ? 0.9 : 1.6;
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

