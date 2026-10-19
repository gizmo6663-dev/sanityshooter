// Short-lived visual effects drawn on the low-resolution canvas: particles
// (sparks, smoke, gibs, trails, dust motes), rings, lightning, fireballs,
// tear splashes and floating text. Coordinates are low-res pixels; `z` is
// height above the floor for things that bounce.

const TAU = Math.PI * 2;
const MAX_PARTS = 700;

export class Effects {
  constructor() {
    this.clear();
  }

  clear() {
    this.parts = [];
    this.rings = [];
    this.zaps = [];
    this.fires = [];
    this.splashes = [];
    this.texts = [];
  }

  /** Generic particle. opts: z, vz, g (gravity), drag, life, size, fade, grow, bounce. */
  add(x, y, vx, vy, color, opts = {}) {
    if (this.parts.length >= MAX_PARTS) return;
    this.parts.push({
      x, y, vx, vy, color, z: opts.z || 0, vz: opts.vz || 0, g: opts.g || 0, drag: opts.drag || 0,
      t: 0, life: opts.life || 0.5, size: opts.size || 1, fade: !!opts.fade, grow: opts.grow || 0,
      bounce: opts.bounce !== undefined ? opts.bounce : 0.3,
    });
  }

  /** A spray of sparks/droplets that arc and land. */
  burst(x, y, color, n, power, z = 4, gravity = 220) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, sp = (10 + Math.random() * 40) * power;
      this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, color, {
        z, vz: 30 + Math.random() * 60 * power, g: gravity, life: 0.3 + Math.random() * 0.4, size: Math.random() < 0.3 ? 2 : 1,
      });
    }
  }

  /** Soft puffs that rise and fade (dust, smoke). */
  smoke(x, y, color, n, spread = 4, life = 0.6, rise = 14) {
    for (let k = 0; k < n; k++) {
      this.add(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread * 0.5,
        (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 4, color,
        { z: 1, vz: rise * (0.5 + Math.random()), life: life * (0.6 + Math.random() * 0.6), size: 2, fade: true, grow: 2, drag: 2 });
    }
  }

  /** Chunks of meat or bone that bounce on the floor. */
  gibs(x, y, colors, n, power = 1) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, sp = (20 + Math.random() * 50) * power;
      this.add(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, colors[k % colors.length], {
        z: 6, vz: 50 + Math.random() * 70 * power, g: 260, life: 0.7 + Math.random() * 0.6,
        size: 2 + (Math.random() < 0.35 ? 1 : 0), bounce: 0.45, drag: 1.5,
      });
    }
  }

  ring(x, y, r, color, life = 0.3, fill = false) { this.rings.push({ x, y, r, color, life, fill, t: 0 }); }
  zap(pts) { this.zaps.push({ pts, t: 0 }); }

  /** An explosion: white core, then a fireball, then rising smoke. */
  fireball(x, y, r, tint) {
    this.fires.push({ x, y, r, t: 0, life: 0.32, tint });
    this.smoke(x, y - 2, '#3a3028', Math.round(4 + r / 3), r * 0.8, 0.9, 22);
    this.burst(x, y - 4, tint || '#ffb040', Math.round(6 + r / 2), 1.4, 4);
  }

  /** Tear impact: a ring of droplets thrown outwards. */
  splash(x, y, color, big = false) { this.splashes.push({ x, y, color, t: 0, big }); }

  /** Floating pixel text (a canvas from textSprite). */
  text(canvas, x, y, life = 0.9) { this.texts.push({ c: canvas, x, y, t: 0, life }); }

  /** Things that sit on the floor or low: drawn before the depth-sorted figures. */
  drawUnder(g, dt) {
    this.splashes = this.splashes.filter((s) => {
      s.t += dt;
      const life = s.big ? 0.3 : 0.22;
      if (s.t >= life) return false;
      const k = s.t / life, n = s.big ? 8 : 6, rad = (s.big ? 3 : 2) + k * (s.big ? 9 : 6);
      g.fillStyle = s.color;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + 0.3;
        const sz = k < 0.5 ? 2 : 1;
        g.fillRect(Math.round(s.x + Math.cos(a) * rad), Math.round(s.y + Math.sin(a) * rad * 0.6 - Math.sin(k * Math.PI) * 4), sz, sz);
      }
      return true;
    });
  }

  /** Everything else, drawn over the figures. */
  draw(g, dt) {
    this.parts = this.parts.filter((p) => {
      p.t += dt;
      if (p.t >= p.life) return false;
      if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; }
      p.vz -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z < 0 && p.g) { p.z = 0; p.vz *= -p.bounce; p.vx *= 0.6; p.vy *= 0.6; }
      const k = p.t / p.life;
      if (p.fade) g.globalAlpha = Math.max(0, 1 - k) * 0.8;
      g.fillStyle = p.color;
      const sz = Math.max(1, Math.round(p.size + p.grow * k));
      g.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - p.z - sz / 2), sz, sz);
      if (p.fade) g.globalAlpha = 1;
      return true;
    });

    this.fires = this.fires.filter((f) => {
      f.t += dt;
      if (f.t >= f.life) return false;
      const k = f.t / f.life;
      const layers = k < 0.15 ? [['#fffbe8', 0.75]] : [[f.tint || '#d8501a', 1], ['#ffa030', 0.72], ['#fff0a0', 0.4 * (1 - k)]];
      for (const [col, m] of layers) {
        const rad = f.r * (0.45 + 0.55 * Math.sqrt(k)) * m * (k > 0.6 ? 1 - (k - 0.6) * 1.6 : 1);
        if (rad < 1) continue;
        g.fillStyle = col;
        g.beginPath(); g.ellipse(Math.round(f.x), Math.round(f.y - f.r * 0.3), rad, rad * 0.8, 0, 0, TAU); g.fill();
      }
      return true;
    });

    this.rings = this.rings.filter((r) => {
      r.t += dt;
      if (r.t >= r.life) return false;
      const k = r.t / r.life;
      const rad = r.r * (0.3 + 0.7 * Math.sqrt(k));
      g.fillStyle = r.color;
      const n = Math.max(12, Math.round(rad * 3));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        g.fillRect(Math.round(r.x + Math.cos(a) * rad), Math.round(r.y + Math.sin(a) * rad * 0.75), 1, 1);
      }
      return true;
    });

    this.zaps = this.zaps.filter((z) => {
      z.t += dt;
      if (z.t > 0.15) return false;
      g.fillStyle = Math.floor(z.t * 40) % 2 ? '#fff6b0' : '#a8e0ff';
      for (let i = 0; i + 1 < z.pts.length; i++) {
        const [x0, y0] = z.pts[i], [x1, y1] = z.pts[i + 1];
        const ya = y0 - 10, yb = y1 - 10;
        const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, yb - ya) / 6));
        let px = x0, py = ya;
        for (let k = 1; k <= n; k++) {
          const nx = x0 + ((x1 - x0) * k) / n + (k < n ? (Math.random() - 0.5) * 6 : 0);
          const ny = ya + ((yb - ya) * k) / n + (k < n ? (Math.random() - 0.5) * 6 : 0);
          const steps = Math.ceil(Math.hypot(nx - px, ny - py));
          for (let s = 0; s <= steps; s++) g.fillRect(Math.round(px + ((nx - px) * s) / steps), Math.round(py + ((ny - py) * s) / steps), 1, 1);
          px = nx; py = ny;
        }
      }
      return true;
    });

    this.texts = this.texts.filter((tx) => {
      tx.t += dt;
      if (tx.t >= tx.life) return false;
      const k = tx.t / tx.life;
      g.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      // pops up quickly, then drifts
      const rise = 14 * (1 - Math.pow(1 - Math.min(1, k * 2), 3)) + k * 4;
      g.drawImage(tx.c, Math.round(tx.x - tx.c.width / 2), Math.round(tx.y - rise));
      g.globalAlpha = 1;
      return true;
    });
  }
}
