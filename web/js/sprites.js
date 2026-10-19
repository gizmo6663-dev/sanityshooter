// Hand-drawn style sprites, painted with Canvas 2D. Thick ink outlines with
// varying weight, volume from soft gradients, a rim of light, and small
// details (folds, stitches, veins, cracks) so things read as drawn rather
// than as flat shapes. Every function draws at (x, y) = the point on the
// floor under the figure, with `s` pixels per world unit and `t` the
// animation time in seconds.

export const INK = '#1a0e09';

// --- Helpers -----------------------------------------------------------------
export function rng(seed) {
  let a = (seed * 9301 + 49297) % 233280 || 1;
  return () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
}

function ink(ctx, s, w = 0.06) {
  ctx.lineWidth = Math.max(1.4, s * w);
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

/** Gradient that makes a shape look round: lit top-left, dark bottom-right. */
function volume(ctx, cx, cy, r, light, base, dark) {
  const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.05, cx, cy, r * 1.25);
  g.addColorStop(0, light);
  g.addColorStop(0.45, base);
  g.addColorStop(1, dark);
  return g;
}

function ellipsePath(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

/** Organic wobbly outline around (cx, cy). */
function blobPath(ctx, cx, cy, rx, ry, wobble, seed, n = 16) {
  const r = rng(seed);
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const w = 1 + (r() - 0.5) * wobble;
    pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
  }
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const [x0, y0] = pts[k], [x1, y1] = pts[(k + 1) % n];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (k === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(x0, y0, mx, my);
  }
  const [x0, y0] = pts[0], [x1, y1] = pts[1];
  ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  ctx.closePath();
}

/** Fill + ink, plus a darker inner stroke on the shadow side for weight. */
function paint(ctx, s, fill, w = 0.06) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.lineWidth = s * w * 1.6;
  ctx.strokeStyle = 'rgba(20,8,4,0.28)';
  ctx.translate(-s * 0.02, -s * 0.025);
  ctx.stroke();
  ctx.restore();
  ink(ctx, s, w);
  ctx.stroke();
}

function speckle(ctx, x, y, rx, ry, n, color, size, seed) {
  const r = rng(seed);
  ctx.fillStyle = color;
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, size * (0.5 + r()), 0, Math.PI * 2);
    ctx.fill();
  }
}

function glint(ctx, x, y, r, a = 0.85) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

export function shadow(ctx, x, y, s, r = 0.35, a = 0.4) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * s);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(0.7, `rgba(0,0,0,${a * 0.6})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * s, r * s * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function glow(ctx, x, y, r, color = '255,180,90', a = 0.35) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color},${a})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// --- Hero --------------------------------------------------------------------
/**
 * The wanderer: a small figure in a dark pointed hood, face lost in shadow
 * except for two glowing eyes, a red scarf that streams behind, and a
 * lantern on a chain. facing: 'down' | 'up' | 'left' | 'right'.
 * eyes: glow colour. costume: list of extras from items
 * ('halo', 'horns', 'crown', 'mask', 'bones', 'flame').
 */
export function hero(ctx, x, y, s, t, { facing = 'down', moving = false, eyes = '#ffd27a', costume = [], blink = false } = {}) {
  const step = moving ? Math.sin(t * 12) : 0;
  const bob = moving ? Math.abs(step) * 0.05 * s : Math.sin(t * 2.2) * 0.012 * s;
  const side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  const has = (c) => costume.includes(c);
  const CL = '#626078', C = '#38364c', CD = '#16141f';
  const SC_L = '#e04a44', SC = '#a8222a', SC_D = '#4a080c';
  shadow(ctx, x, y, s, 0.34);
  const by = y - bob;
  const hy = by - 0.86 * s;

  // --- scarf streaming behind (drawn first when it is behind the body) ---
  const scarf = (front) => {
    const dir = side !== 0 ? -side : 0;
    if ((facing === 'up') !== front && side === 0) return;
    if (side !== 0 && front) return;
    const sx0 = x + side * 0.05 * s, sy0 = by - 0.6 * s;
    const len = (moving ? 0.55 : 0.4) * s;
    const wave = (k) => Math.sin(t * (moving ? 14 : 4) - k * 3) * (moving ? 0.06 : 0.03) * s;
    ctx.beginPath();
    if (side !== 0) {
      // trails sideways behind the shoulders
      ctx.moveTo(sx0, sy0 - 0.05 * s);
      for (let k = 1; k <= 4; k++) ctx.lineTo(sx0 + dir * len * (k / 4), sy0 - 0.06 * s + wave(k) + k * 0.02 * s);
      ctx.lineTo(sx0 + dir * len * 1.05, sy0 + 0.05 * s + wave(4));
      for (let k = 4; k >= 1; k--) ctx.lineTo(sx0 + dir * len * (k / 4), sy0 + 0.06 * s + wave(k) + k * 0.03 * s);
      ctx.lineTo(sx0, sy0 + 0.06 * s);
    } else {
      // hangs down the back in two tails
      for (const tx of [-0.07, 0.07]) {
        ctx.moveTo(x + tx * s - 0.05 * s, sy0);
        ctx.lineTo(x + tx * s + wave(1) - 0.05 * s, sy0 + len * 0.6);
        ctx.lineTo(x + tx * s + wave(2) * 1.5, sy0 + len * 0.75);
        ctx.lineTo(x + tx * s + wave(1) + 0.05 * s, sy0 + len * 0.6);
        ctx.lineTo(x + tx * s + 0.05 * s, sy0);
      }
    }
    ctx.closePath();
    paint(ctx, s, volume(ctx, sx0, sy0, 0.3 * s, SC_L, SC, SC_D), 0.045);
  };
  scarf(false);

  // --- lantern on a chain, swinging ---
  const lside = side === 0 ? 1 : side;
  const swing = Math.sin(t * (moving ? 12 : 2.2) + 0.6) * (moving ? 0.35 : 0.12);
  const hx = x + lside * 0.3 * s, hyy = by - 0.38 * s;        // hand
  const lx = hx + Math.sin(swing) * 0.16 * s, ly = hyy + Math.cos(swing) * 0.16 * s;
  glow(ctx, lx, ly, 0.6 * s, '255,175,80', 0.22);
  const lantern = () => {
    ink(ctx, s, 0.025);
    ctx.beginPath(); ctx.moveTo(hx, hyy); ctx.lineTo(lx, ly - 0.08 * s); ctx.stroke();
    ctx.strokeStyle = '#8a7a60'; ctx.lineWidth = s * 0.012; ctx.stroke();
    // cage
    ctx.beginPath();
    ctx.moveTo(lx - 0.08 * s, ly - 0.07 * s); ctx.lineTo(lx + 0.08 * s, ly - 0.07 * s);
    ctx.lineTo(lx + 0.09 * s, ly + 0.08 * s); ctx.lineTo(lx - 0.09 * s, ly + 0.08 * s); ctx.closePath();
    const gl = ctx.createLinearGradient(lx, ly - 0.06 * s, lx, ly + 0.07 * s);
    gl.addColorStop(0, '#fff2b8'); gl.addColorStop(1, '#ff8a2a');
    paint(ctx, s, gl, 0.03);
    ctx.fillStyle = '#b08a40';
    ctx.fillRect(lx - 0.09 * s, ly - 0.11 * s, 0.18 * s, 0.045 * s);
    ctx.fillRect(lx - 0.1 * s, ly + 0.07 * s, 0.2 * s, 0.04 * s);
    ink(ctx, s, 0.015);
    ctx.beginPath(); ctx.moveTo(lx, ly - 0.06 * s); ctx.lineTo(lx, ly + 0.07 * s); ctx.stroke();
    ctx.fillStyle = '#ffe890';
    ctx.fillRect(lx - 0.05 * s, ly - 0.04 * s, 0.1 * s, 0.1 * s);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(lx, ly + 0.01 * s, 0.03 * s, 0, Math.PI * 2); ctx.fill();
  };
  if (facing === 'up') lantern();

  // --- boots ---
  for (const [bx, lift] of [[-0.11, step > 0 ? 0.05 : 0], [0.11, step < 0 ? 0.05 : 0]]) {
    ctx.beginPath();
    ctx.roundRect(x + bx * s - 0.075 * s + side * 0.02 * s, y - 0.12 * s - lift * s, 0.15 * s, 0.11 * s, [0.03 * s, 0.03 * s, 0.02 * s, 0.02 * s]);
    paint(ctx, s, volume(ctx, x + bx * s, y - 0.08 * s, 0.1 * s, '#5a4038', '#2a1a16', '#0c0606'), 0.045);
  }

  // --- cloak: a dark bell with a jagged, torn hem ---
  const r = rng(11);
  ctx.beginPath();
  ctx.moveTo(x - 0.16 * s, by - 0.6 * s);
  ctx.bezierCurveTo(x - 0.26 * s, by - 0.48 * s, x - 0.34 * s, by - 0.22 * s, x - 0.35 * s, by - 0.1 * s);
  const hem = 7, flap = moving ? Math.sin(t * 12) * 0.03 : 0;
  for (let k = 0; k <= hem; k++) {
    const hxk = x - 0.35 * s + (k / hem) * 0.7 * s;
    ctx.lineTo(hxk, by - (k % 2 ? 0.02 + r() * 0.03 - flap * (k % 4 === 1 ? 1 : -1) : 0.13 + r() * 0.03) * s);
  }
  ctx.bezierCurveTo(x + 0.34 * s, by - 0.22 * s, x + 0.26 * s, by - 0.48 * s, x + 0.16 * s, by - 0.6 * s);
  ctx.closePath();
  paint(ctx, s, volume(ctx, x - 0.08 * s, by - 0.35 * s, 0.42 * s, CL, C, CD));
  ctx.save();
  ctx.clip();
  // folds and a pale trim along the hem
  ctx.strokeStyle = 'rgba(8,6,14,0.5)';
  ctx.lineWidth = s * 0.025;
  for (const fx of [-0.13, 0.13]) {
    ctx.beginPath(); ctx.moveTo(x + fx * 0.6 * s, by - 0.5 * s); ctx.quadraticCurveTo(x + fx * 1.2 * s, by - 0.25 * s, x + fx * s, by - 0.05 * s); ctx.stroke();
  }
  if (facing !== 'up') {
    // front opening with a strip of red lining
    ctx.fillStyle = '#5a0e12';
    ctx.beginPath(); ctx.moveTo(x + side * 0.12 * s - 0.02 * s, by - 0.42 * s); ctx.lineTo(x + side * 0.12 * s + 0.05 * s, by - 0.02 * s); ctx.lineTo(x + side * 0.12 * s - 0.06 * s, by - 0.02 * s); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // belt with a bone-white buckle
  ctx.strokeStyle = INK;
  ctx.lineWidth = s * 0.07;
  ctx.beginPath(); ctx.moveTo(x - 0.27 * s, by - 0.3 * s); ctx.quadraticCurveTo(x, by - 0.24 * s, x + 0.27 * s, by - 0.3 * s); ctx.stroke();
  ctx.strokeStyle = '#4a3020'; ctx.lineWidth = s * 0.04; ctx.stroke();
  if (facing !== 'up') {
    ctx.beginPath(); ctx.rect(x + side * 0.1 * s - 0.04 * s, by - 0.3 * s, 0.08 * s, 0.065 * s);
    paint(ctx, s, '#d8c8a0', 0.025);
  }
  // shoulder guard
  if (has('bones')) {
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        ellipsePath(ctx, x + sx * (0.2 + k * 0.03) * s, by - (0.57 - k * 0.06) * s, 0.09 * s, 0.045 * s, sx * 0.4);
        paint(ctx, s, volume(ctx, x + sx * 0.22 * s, by - 0.55 * s, 0.1 * s, '#fffbea', '#e0d4b4', '#9a8a6a'), 0.03);
      }
    }
  } else {
    ellipsePath(ctx, x + lside * 0.2 * s, by - 0.55 * s, 0.1 * s, 0.07 * s, lside * 0.3);
    paint(ctx, s, volume(ctx, x + lside * 0.2 * s, by - 0.56 * s, 0.1 * s, '#6a4a38', '#3a2418', '#140a06'), 0.035);
  }
  // the free hand, gloved, on the far side
  if (facing === 'down' || side !== 0) {
    const ox = side === 0 ? -0.3 : -side * 0.05;
    ellipsePath(ctx, x + ox * s, by - 0.3 * s + step * 0.02 * s, 0.05 * s, 0.045 * s);
    paint(ctx, s, '#3a2a24', 0.035);
  }
  scarf(true);
  if (facing !== 'up') {
    // the scarf wrapped round the neck, one end hanging down the chest
    ctx.beginPath();
    ctx.ellipse(x, by - 0.56 * s, 0.25 * s, 0.1 * s, 0, 0, Math.PI * 2);
    paint(ctx, s, volume(ctx, x - 0.05 * s, by - 0.58 * s, 0.25 * s, SC_L, SC, SC_D), 0.045);
    if (side === 0) {
      const w2 = Math.sin(t * (moving ? 12 : 3)) * 0.02 * s;
      ctx.beginPath();
      ctx.moveTo(x - 0.15 * s, by - 0.6 * s);
      ctx.lineTo(x - 0.18 * s + w2, by - 0.38 * s);
      ctx.lineTo(x - 0.14 * s + w2, by - 0.33 * s);
      ctx.lineTo(x - 0.08 * s + w2, by - 0.38 * s);
      ctx.lineTo(x - 0.05 * s, by - 0.6 * s);
      ctx.closePath();
      paint(ctx, s, volume(ctx, x - 0.12 * s, by - 0.5 * s, 0.15 * s, SC_L, SC, SC_D), 0.04);
    }
  }

  // --- the hood: tall, with a point that bends backwards ---
  const tip = side !== 0 ? -side : 0.6;            // where the point leans
  const sway = Math.sin(t * (moving ? 12 : 2.2)) * 0.03 * s;
  const hood = () => {
    ctx.beginPath();
    ctx.moveTo(x - 0.4 * s, hy + 0.2 * s);
    ctx.bezierCurveTo(x - 0.5 * s, hy - 0.15 * s, x - 0.3 * s, hy - 0.42 * s, x - 0.05 * s + tip * 0.05 * s, hy - 0.45 * s);
    ctx.quadraticCurveTo(x + tip * 0.3 * s, hy - 0.62 * s, x + tip * 0.52 * s + sway, hy - 0.72 * s);
    ctx.quadraticCurveTo(x + tip * 0.32 * s, hy - 0.42 * s, x + 0.36 * s * (tip < 0 ? 0.9 : 1), hy - 0.3 * s);
    ctx.bezierCurveTo(x + 0.5 * s, hy - 0.12 * s, x + 0.48 * s, hy + 0.12 * s, x + 0.4 * s, hy + 0.2 * s);
    ctx.quadraticCurveTo(x, hy + 0.36 * s, x - 0.4 * s, hy + 0.2 * s);
    ctx.closePath();
  };
  hood();
  paint(ctx, s, volume(ctx, x - 0.1 * s, hy - 0.15 * s, 0.55 * s, CL, C, CD), 0.065);
  ctx.save();
  hood();
  ctx.clip();
  ctx.strokeStyle = 'rgba(8,6,14,0.45)';
  ctx.lineWidth = s * 0.025;
  ctx.beginPath(); ctx.moveTo(x - 0.05 * s, hy - 0.42 * s); ctx.quadraticCurveTo(x - 0.35 * s, hy - 0.2 * s, x - 0.38 * s, hy + 0.12 * s); ctx.stroke();
  // light catching the top of the hood
  ctx.strokeStyle = 'rgba(200,200,230,0.25)';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath(); ctx.moveTo(x - 0.3 * s, hy - 0.25 * s); ctx.quadraticCurveTo(x - 0.1 * s, hy - 0.45 * s, x + tip * 0.3 * s, hy - 0.58 * s); ctx.stroke();
  ctx.restore();

  if (has('horns')) {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + sx * 0.25 * s, hy - 0.3 * s);
      ctx.quadraticCurveTo(x + sx * 0.5 * s, hy - 0.4 * s, x + sx * 0.46 * s, hy - 0.72 * s);
      ctx.quadraticCurveTo(x + sx * 0.4 * s, hy - 0.45 * s, x + sx * 0.17 * s, hy - 0.4 * s);
      ctx.closePath();
      paint(ctx, s, volume(ctx, x + sx * 0.35 * s, hy - 0.5 * s, 0.2 * s, '#5a4a4a', '#2a1a1a', '#0a0404'), 0.04);
    }
  }
  if (has('crown')) {
    ctx.beginPath();
    ctx.moveTo(x - 0.26 * s, hy - 0.36 * s);
    for (let k = 0; k <= 4; k++) {
      const cx = x - 0.26 * s + k * 0.13 * s;
      ctx.lineTo(cx, hy - (k % 2 ? 0.48 : 0.6) * s);
      if (k < 4) ctx.lineTo(cx + 0.065 * s, hy - 0.42 * s);
    }
    ctx.lineTo(x + 0.26 * s, hy - 0.34 * s);
    ctx.closePath();
    paint(ctx, s, volume(ctx, x, hy - 0.45 * s, 0.25 * s, '#fff0a0', '#d8a830', '#6a4a10'), 0.04);
    glow(ctx, x, hy - 0.5 * s, 0.25 * s, '255,240,150', 0.3);
  }
  if (has('halo')) {
    glow(ctx, x, hy - 0.86 * s, 0.4 * s, '180,120,255', 0.45);
    ctx.strokeStyle = INK; ctx.lineWidth = s * 0.07;
    ctx.beginPath(); ctx.ellipse(x, hy - 0.86 * s, 0.22 * s, 0.06 * s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#d8b8ff'; ctx.lineWidth = s * 0.035; ctx.stroke();
  }

  if (facing === 'up') {
    if (has('flame')) glow(ctx, x + tip * 0.52 * s, hy - 0.72 * s, 0.2 * s, '255,140,40', 0.7);
    return;
  }

  // --- the dark opening of the hood, with glowing eyes ---
  const fx = side * 0.12 * s;
  ellipsePath(ctx, x + fx, hy + 0.04 * s, side ? 0.24 * s : 0.3 * s, 0.27 * s);
  const dark = ctx.createRadialGradient(x + fx, hy + 0.08 * s, 0.02 * s, x + fx, hy + 0.02 * s, 0.32 * s);
  dark.addColorStop(0, '#000000'); dark.addColorStop(0.75, '#07050c'); dark.addColorStop(1, '#1c1a28');
  ctx.fillStyle = dark;
  ctx.fill();
  ink(ctx, s, 0.04);
  ctx.stroke();
  if (has('mask')) {
    // a cracked white mask fills the opening
    ellipsePath(ctx, x + fx, hy + 0.05 * s, side ? 0.19 * s : 0.24 * s, 0.22 * s);
    paint(ctx, s, volume(ctx, x + fx, hy, 0.24 * s, '#ffffff', '#e6e0d4', '#9a9488'), 0.03);
    ctx.strokeStyle = 'rgba(40,30,30,0.7)'; ctx.lineWidth = s * 0.012;
    ctx.beginPath(); ctx.moveTo(x + fx + 0.08 * s, hy - 0.14 * s); ctx.lineTo(x + fx + 0.04 * s, hy - 0.02 * s); ctx.lineTo(x + fx + 0.07 * s, hy + 0.06 * s); ctx.stroke();
  }
  const eyePos = side === 0 ? [-0.11, 0.11] : [side * 0.14];
  const ec = hexRgb(eyes);
  for (const ex of eyePos) {
    const exx = x + ex * s + (side ? fx * 0.5 : 0), eyy = hy + 0.04 * s;
    glow(ctx, exx, eyy, 0.2 * s, ec, 0.7);
    if (has('mask')) { ellipsePath(ctx, exx, eyy, 0.055 * s, 0.05 * s); ctx.fillStyle = '#000'; ctx.fill(); }
    ctx.fillStyle = eyes;
    if (blink) ctx.fillRect(exx - 0.05 * s, eyy - 0.008 * s, 0.1 * s, 0.025 * s);
    else {
      // slanted, narrow glowing eyes
      ctx.beginPath();
      const sl = side === 0 ? Math.sign(ex) : side;
      ctx.moveTo(exx - 0.075 * s, eyy - 0.035 * s * sl);
      ctx.quadraticCurveTo(exx, eyy - 0.08 * s, exx + 0.075 * s, eyy + 0.035 * s * sl);
      ctx.quadraticCurveTo(exx, eyy + 0.07 * s, exx - 0.075 * s, eyy - 0.035 * s * sl);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(exx, eyy, 0.016 * s, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (has('flame')) {
    // the hood's tip burns
    const fx2 = x + tip * 0.52 * s + sway, fy2 = hy - 0.72 * s;
    glow(ctx, fx2, fy2, 0.25 * s, '255,140,40', 0.6);
    ctx.fillStyle = '#ff8a2a';
    ctx.beginPath(); ctx.moveTo(fx2, fy2 - 0.22 * s); ctx.quadraticCurveTo(fx2 + 0.09 * s, fy2, fx2, fy2 + 0.03 * s); ctx.quadraticCurveTo(fx2 - 0.09 * s, fy2, fx2, fy2 - 0.22 * s); ctx.fill();
    ctx.fillStyle = '#fff0a0';
    ctx.beginPath(); ctx.moveTo(fx2, fy2 - 0.11 * s); ctx.quadraticCurveTo(fx2 + 0.04 * s, fy2, fx2, fy2 + 0.02 * s); ctx.quadraticCurveTo(fx2 - 0.04 * s, fy2, fx2, fy2 - 0.11 * s); ctx.fill();
  }
  lantern();
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

// --- Enemies -------------------------------------------------------------------
export function fly(ctx, x, y, s, t) {
  const hy = y - 0.8 * s + Math.sin(t * 7) * 0.06 * s;
  shadow(ctx, x, y, s, 0.2, 0.3);
  const flap = Math.sin(t * 50) * 0.5;
  // wings with veins
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(x + sx * 0.07 * s, hy - 0.09 * s);
    ctx.rotate(sx * (0.55 + flap));
    ellipsePath(ctx, sx * 0.14 * s, -0.03 * s, 0.17 * s, 0.075 * s);
    const gw = ctx.createLinearGradient(0, -0.1 * s, sx * 0.3 * s, 0.05 * s);
    gw.addColorStop(0, 'rgba(235,240,230,0.75)'); gw.addColorStop(1, 'rgba(170,190,200,0.35)');
    ctx.fillStyle = gw;
    ctx.fill();
    ink(ctx, s, 0.03);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,40,40,0.4)';
    ctx.lineWidth = s * 0.01;
    for (const v of [-0.02, 0.02]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sx * 0.12 * s, v * s - 0.03 * s, sx * 0.29 * s, v * s - 0.03 * s); ctx.stroke(); }
    ctx.restore();
  }
  // dangling legs
  ink(ctx, s, 0.02);
  for (const lx of [-0.07, 0, 0.07]) {
    ctx.beginPath(); ctx.moveTo(x + lx * s, hy + 0.1 * s); ctx.lineTo(x + lx * 1.4 * s, hy + 0.2 * s + Math.sin(t * 9 + lx * 30) * 0.02 * s); ctx.stroke();
  }
  // striped abdomen behind
  ellipsePath(ctx, x, hy + 0.08 * s, 0.13 * s, 0.11 * s);
  paint(ctx, s, volume(ctx, x, hy + 0.08 * s, 0.13 * s, '#6a6040', '#3a3420', '#18140a'), 0.045);
  ctx.strokeStyle = 'rgba(200,180,90,0.5)';
  ctx.lineWidth = s * 0.02;
  for (const k of [0.04, 0.1]) { ctx.beginPath(); ctx.arc(x, hy + k * s, 0.11 * s, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
  // fuzzy body
  ellipsePath(ctx, x, hy - 0.02 * s, 0.17 * s, 0.15 * s);
  paint(ctx, s, volume(ctx, x, hy - 0.02 * s, 0.17 * s, '#4a4438', '#26221a', '#0c0a06'), 0.05);
  ctx.strokeStyle = 'rgba(10,8,4,0.8)';
  ctx.lineWidth = s * 0.012;
  const r = rng(4);
  for (let k = 0; k < 18; k++) {
    const a = r() * Math.PI * 2;
    const px = x + Math.cos(a) * 0.16 * s, py = hy - 0.02 * s + Math.sin(a) * 0.14 * s;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * 0.04 * s, py + Math.sin(a) * 0.04 * s); ctx.stroke();
  }
  // compound eyes
  for (const sx of [-1, 1]) {
    ellipsePath(ctx, x + sx * 0.075 * s, hy - 0.01 * s, 0.06 * s, 0.065 * s);
    paint(ctx, s, volume(ctx, x + sx * 0.075 * s, hy - 0.01 * s, 0.06 * s, '#ff6a5a', '#b81818', '#4a0606'), 0.03);
    speckle(ctx, x + sx * 0.075 * s, hy - 0.01 * s, 0.04 * s, 0.045 * s, 8, 'rgba(60,0,0,0.5)', s * 0.006, 7 + sx);
    glint(ctx, x + sx * 0.075 * s - 0.015 * s, hy - 0.035 * s, 0.015 * s);
  }
}

export function grub(ctx, x, y, s, t) {
  shadow(ctx, x, y, s, 0.42, 0.32);
  // slime trail
  ctx.fillStyle = 'rgba(200,210,150,0.18)';
  ctx.beginPath(); ctx.ellipse(x, y - 0.55 * s, 0.13 * s, 0.5 * s, 0, 0, Math.PI * 2); ctx.fill();
  for (let k = 4; k >= 0; k--) {
    const w = 0.25 - k * 0.025;
    const sx = x + Math.sin(t * 5 - k) * 0.05 * s;
    const sy = y - 0.2 * s - k * 0.15 * s;
    ellipsePath(ctx, sx, sy, w * s, w * 0.82 * s);
    paint(ctx, s, volume(ctx, sx, sy, w * s, '#fff4d8', k % 2 ? '#d8c69a' : '#e6d4a8', '#8a7650'), 0.055);
    // wrinkles and a wet highlight
    ctx.strokeStyle = 'rgba(110,90,50,0.45)';
    ctx.lineWidth = s * 0.012;
    ctx.beginPath(); ctx.arc(sx, sy + w * 0.2 * s, w * 0.7 * s, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(sx - w * 0.35 * s, sy - w * 0.35 * s, w * 0.22 * s, w * 0.12 * s, -0.6, 0, Math.PI * 2); ctx.fill();
    // tiny legs
    ink(ctx, s, 0.02);
    for (const lx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx + lx * w * s, sy + 0.02 * s); ctx.lineTo(sx + lx * (w + 0.05) * s, sy + 0.06 * s); ctx.stroke(); }
    if (k === 0) {
      // round mouth full of teeth
      ellipsePath(ctx, sx, sy + 0.03 * s, 0.1 * s, 0.08 * s);
      paint(ctx, s, volume(ctx, sx, sy + 0.03 * s, 0.1 * s, '#8a2a2a', '#4a0e0e', '#1a0404'), 0.04);
      ctx.fillStyle = '#efe6cc';
      for (let tk = 0; tk < 7; tk++) {
        const a = (tk / 7) * Math.PI * 2;
        const tx = sx + Math.cos(a) * 0.075 * s, ty = sy + 0.03 * s + Math.sin(a) * 0.06 * s;
        ctx.beginPath();
        ctx.moveTo(tx + Math.cos(a + 1.6) * 0.015 * s, ty + Math.sin(a + 1.6) * 0.015 * s);
        ctx.lineTo(tx - Math.cos(a + 1.6) * 0.015 * s, ty - Math.sin(a + 1.6) * 0.015 * s);
        ctx.lineTo(tx - Math.cos(a) * 0.035 * s, ty - Math.sin(a) * 0.03 * s);
        ctx.fill();
      }
    }
  }
}

export function eyeball(ctx, x, y, s, t, { look = [0, 1], blink = 0 } = {}) {
  const hy = y - 0.95 * s + Math.sin(t * 2.5) * 0.08 * s;
  shadow(ctx, x, y, s, 0.3, 0.3);
  // dangling optic nerve with a drip
  for (const [w, c] of [[0.09, INK], [0.055, '#8a1e22'], [0.02, '#c8484a']]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = s * w;
    ctx.beginPath();
    ctx.moveTo(x, hy + 0.24 * s);
    ctx.bezierCurveTo(x + Math.sin(t * 3) * 0.15 * s, hy + 0.4 * s, x - 0.12 * s, hy + 0.5 * s, x - 0.04 * s + Math.sin(t * 2) * 0.05 * s, hy + 0.66 * s);
    ctx.stroke();
  }
  ellipsePath(ctx, x - 0.04 * s, hy + 0.72 * s + (t * 0.4 % 1) * 0.1 * s, 0.02 * s, 0.03 * s);
  ctx.fillStyle = '#9a1a1e'; ctx.fill();
  // eyeball
  ellipsePath(ctx, x, hy, 0.31 * s, 0.31 * s);
  ctx.fillStyle = volume(ctx, x, hy, 0.31 * s, '#ffffff', '#efe4d4', '#b89a8a');
  ctx.fill();
  ctx.save();
  ctx.clip();
  // branching veins
  const r = rng(21);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + r() * 0.3;
    let px = x + Math.cos(a) * 0.31 * s, py = hy + Math.sin(a) * 0.31 * s;
    ctx.strokeStyle = 'rgba(170,25,30,0.75)';
    for (let seg = 0; seg < 4; seg++) {
      ctx.lineWidth = s * (0.018 - seg * 0.004);
      const nx = px + (x - px) * 0.25 + (r() - 0.5) * 0.08 * s, ny = py + (hy - py) * 0.25 + (r() - 0.5) * 0.08 * s;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
      if (r() < 0.5) { ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + (r() - 0.5) * 0.08 * s, ny + (r() - 0.5) * 0.08 * s); ctx.stroke(); }
      px = nx; py = ny;
    }
  }
  ctx.restore();
  ink(ctx, s, 0.06);
  ellipsePath(ctx, x, hy, 0.31 * s, 0.31 * s);
  ctx.stroke();
  // iris with radial texture
  const ix = x + look[0] * 0.09 * s, iy = hy + look[1] * 0.09 * s;
  ellipsePath(ctx, ix, iy, 0.145 * s, 0.145 * s);
  const gi = ctx.createRadialGradient(ix, iy, 0.02 * s, ix, iy, 0.15 * s);
  gi.addColorStop(0, '#f0c050'); gi.addColorStop(0.5, '#c06a20'); gi.addColorStop(1, '#5a2008');
  ctx.fillStyle = gi;
  ctx.fill();
  ink(ctx, s, 0.035);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80,30,5,0.5)';
  ctx.lineWidth = s * 0.008;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * 0.06 * s, iy + Math.sin(a) * 0.06 * s); ctx.lineTo(ix + Math.cos(a) * 0.14 * s, iy + Math.sin(a) * 0.14 * s); ctx.stroke();
  }
  ellipsePath(ctx, ix, iy, 0.065 * s, 0.065 * s);
  ctx.fillStyle = '#080404'; ctx.fill();
  glint(ctx, ix + 0.045 * s, iy - 0.055 * s, 0.035 * s, 0.9);
  glint(ctx, x - 0.15 * s, hy - 0.16 * s, 0.05 * s, 0.35);
  // eyelid when blinking
  if (blink > 0) {
    ctx.save();
    ellipsePath(ctx, x, hy, 0.31 * s, 0.31 * s);
    ctx.clip();
    ctx.fillStyle = '#a86a5a';
    ctx.fillRect(x - 0.35 * s, hy - 0.35 * s, 0.7 * s, 0.7 * s * blink);
    ctx.restore();
  }
}

export function ram(ctx, x, y, s, t) {
  shadow(ctx, x, y, s, 0.38, 0.35);
  const by = y - 0.05 * s + Math.abs(Math.sin(t * 8)) * 0.03 * s;
  const BONE = '#ece0c4', BONE_D = '#a89878';
  // legs: bones with knobby joints
  for (const lx of [-0.2, -0.07, 0.07, 0.2]) {
    const sw = Math.sin(t * 8 + lx * 20) * 0.03 * s;
    ink(ctx, s, 0.075);
    ctx.beginPath(); ctx.moveTo(x + lx * s, by - 0.27 * s); ctx.lineTo(x + lx * 1.1 * s + sw, by); ctx.stroke();
    ctx.strokeStyle = BONE; ctx.lineWidth = s * 0.04; ctx.stroke();
    ellipsePath(ctx, x + lx * 1.05 * s + sw * 0.5, by - 0.13 * s, 0.03 * s, 0.025 * s);
    paint(ctx, s, BONE, 0.025);
  }
  // spine and ribcage
  ellipsePath(ctx, x, by - 0.37 * s, 0.3 * s, 0.17 * s);
  ctx.fillStyle = '#2a1a14'; ctx.fill();
  ink(ctx, s, 0.05); ctx.stroke();
  for (const rx of [-0.18, -0.08, 0.02, 0.12]) {
    ctx.beginPath(); ctx.arc(x + rx * s, by - 0.38 * s, 0.13 * s, Math.PI * 0.12, Math.PI * 0.88);
    ink(ctx, s, 0.07); ctx.stroke();
    ctx.strokeStyle = BONE; ctx.lineWidth = s * 0.038; ctx.stroke();
  }
  ink(ctx, s, 0.06);
  ctx.beginPath(); ctx.moveTo(x - 0.3 * s, by - 0.47 * s); ctx.lineTo(x + 0.28 * s, by - 0.47 * s); ctx.stroke();
  ctx.strokeStyle = BONE_D; ctx.lineWidth = s * 0.03; ctx.stroke();
  // skull
  const hy = by - 0.68 * s;
  // ridged, curled horns
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(x + sx * 0.25 * s, hy - 0.06 * s);
    ctx.scale(sx, 1);
    ctx.beginPath();
    ctx.arc(0, 0, 0.14 * s, -Math.PI * 0.7, Math.PI * 0.85);
    ctx.lineWidth = s * 0.11; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = s * 0.07; ctx.strokeStyle = '#8a7a5c'; ctx.stroke();
    ctx.strokeStyle = 'rgba(40,30,15,0.6)';
    ctx.lineWidth = s * 0.012;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI * 0.7 + (k / 6) * Math.PI * 1.55;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.105 * s, Math.sin(a) * 0.105 * s); ctx.lineTo(Math.cos(a) * 0.175 * s, Math.sin(a) * 0.175 * s); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(x - 0.21 * s, hy - 0.1 * s);
  ctx.bezierCurveTo(x - 0.2 * s, hy - 0.36 * s, x + 0.2 * s, hy - 0.36 * s, x + 0.21 * s, hy - 0.1 * s);
  ctx.bezierCurveTo(x + 0.21 * s, hy + 0.08 * s, x + 0.12 * s, hy + 0.14 * s, x + 0.1 * s, hy + 0.27 * s);
  ctx.lineTo(x - 0.1 * s, hy + 0.27 * s);
  ctx.bezierCurveTo(x - 0.12 * s, hy + 0.14 * s, x - 0.21 * s, hy + 0.08 * s, x - 0.21 * s, hy - 0.1 * s);
  paint(ctx, s, volume(ctx, x, hy - 0.05 * s, 0.25 * s, '#fffbea', BONE, BONE_D), 0.06);
  // crack
  ctx.strokeStyle = 'rgba(60,40,20,0.7)';
  ctx.lineWidth = s * 0.012;
  ctx.beginPath(); ctx.moveTo(x + 0.05 * s, hy - 0.3 * s); ctx.lineTo(x + 0.09 * s, hy - 0.2 * s); ctx.lineTo(x + 0.05 * s, hy - 0.14 * s); ctx.lineTo(x + 0.08 * s, hy - 0.08 * s); ctx.stroke();
  // glowing sockets
  for (const sx of [-1, 1]) {
    const ex = x + sx * 0.085 * s, ey = hy - 0.02 * s;
    ellipsePath(ctx, ex, ey, 0.065 * s, 0.075 * s);
    ctx.fillStyle = '#100604'; ctx.fill();
    glow(ctx, ex, ey, 0.09 * s, '255,90,30', 0.6);
    ctx.fillStyle = '#ffb060';
    ctx.beginPath(); ctx.arc(ex, ey + 0.005 * s, 0.02 * s, 0, Math.PI * 2); ctx.fill();
  }
  // nose and teeth
  ctx.fillStyle = '#100604';
  ctx.beginPath(); ctx.moveTo(x, hy + 0.07 * s); ctx.lineTo(x - 0.03 * s, hy + 0.12 * s); ctx.lineTo(x + 0.03 * s, hy + 0.12 * s); ctx.fill();
  ink(ctx, s, 0.015);
  for (let k = -2; k <= 2; k++) {
    ctx.fillStyle = BONE;
    ctx.fillRect(x + k * 0.033 * s - 0.014 * s, hy + 0.18 * s, 0.028 * s, 0.07 * s);
    ctx.strokeRect(x + k * 0.033 * s - 0.014 * s, hy + 0.18 * s, 0.028 * s, 0.07 * s);
  }
}

export function slime(ctx, x, y, s, t, { small = false } = {}) {
  const k = small ? 0.62 : 1;
  shadow(ctx, x, y, s, 0.45 * k, 0.32);
  const sq = 1 + Math.sin(t * 6) * 0.06;
  const w = 0.43 * k * s / sq, h = 0.43 * k * s * sq;
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(x - w, y - 0.03 * s);
    ctx.bezierCurveTo(x - w * 1.1, y - h * 1.0, x - w * 0.6, y - h * 1.5, x, y - h * 1.48);
    ctx.bezierCurveTo(x + w * 0.6, y - h * 1.5, x + w * 1.1, y - h * 1.0, x + w, y - 0.03 * s);
    // drippy bottom edge
    ctx.quadraticCurveTo(x + w * 0.6, y + 0.03 * s, x + w * 0.35, y);
    ctx.quadraticCurveTo(x + w * 0.25, y + 0.09 * s, x + w * 0.12, y + 0.01 * s);
    ctx.quadraticCurveTo(x - w * 0.4, y + 0.04 * s, x - w, y - 0.03 * s);
    ctx.closePath();
  };
  body();
  const gs = ctx.createRadialGradient(x - w * 0.35, y - h * 1.1, w * 0.1, x, y - h * 0.6, w * 1.3);
  gs.addColorStop(0, 'rgba(200,235,120,0.95)'); gs.addColorStop(0.5, 'rgba(110,150,45,0.92)'); gs.addColorStop(1, 'rgba(40,70,15,0.95)');
  ctx.fillStyle = gs;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // things floating inside: a bone, a coin, bubbles
  ctx.globalAlpha = 0.55;
  ink(ctx, s, 0.02);
  ctx.save();
  ctx.translate(x + w * 0.35, y - h * 0.45);
  ctx.rotate(0.7);
  ctx.fillStyle = '#e8dcc0';
  ctx.fillRect(-0.09 * k * s, -0.015 * k * s, 0.18 * k * s, 0.03 * k * s);
  for (const ex of [-0.09, 0.09]) { ctx.beginPath(); ctx.arc(ex * k * s, -0.015 * k * s, 0.022 * k * s, 0, Math.PI * 2); ctx.arc(ex * k * s, 0.015 * k * s, 0.022 * k * s, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.globalAlpha = 1;
  speckle(ctx, x, y - h * 0.7, w * 0.8, h * 0.7, 9, 'rgba(230,255,190,0.35)', s * 0.02 * k, 17);
  ctx.restore();
  ink(ctx, s, 0.06);
  body();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(x - w * 0.42, y - h * 1.12, w * 0.2, h * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
  // eyes
  for (const sx of [-1, 1]) {
    const ex = x + sx * w * 0.32, ey = y - h * 0.86;
    ellipsePath(ctx, ex, ey, 0.075 * k * s, 0.085 * k * s);
    paint(ctx, s, '#f6f0d8', 0.035);
    ellipsePath(ctx, ex + sx * 0.01 * s, ey + 0.015 * s, 0.035 * k * s, 0.045 * k * s);
    ctx.fillStyle = '#0c0804'; ctx.fill();
    glint(ctx, ex + 0.01 * s, ey - 0.02 * s, 0.012 * s);
  }
  // mouth
  ctx.strokeStyle = 'rgba(20,35,5,0.8)';
  ctx.lineWidth = s * 0.02 * k;
  ctx.beginPath(); ctx.arc(x, y - h * 0.6, 0.08 * k * s, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
}

export function bloat(ctx, x, y, s, t) {
  shadow(ctx, x, y, s, 1.25, 0.45);
  const p = 1 + Math.sin(t * 3) * 0.03;
  const cx = x, cy = y - 1.05 * s;
  const FLESH_L = '#e0a69a', FLESH = '#a8685e', FLESH_D = '#4a2020';
  // lumps behind
  for (const [lx, ly, r, sd] of [[-0.9, -0.5, 0.3, 1], [0.95, -0.3, 0.27, 2], [0.75, 0.55, 0.24, 3], [-1.0, 0.35, 0.22, 4]]) {
    blobPath(ctx, cx + lx * s, cy + ly * s, r * s, r * 0.9 * s, 0.2, sd, 10);
    paint(ctx, s, volume(ctx, cx + lx * s, cy + ly * s, r * s, FLESH_L, '#9a5a52', FLESH_D), 0.06);
  }
  blobPath(ctx, cx, cy, 1.15 * s * p, 1.0 * s / p, 0.08, 9, 20);
  ctx.fillStyle = volume(ctx, cx, cy, 1.15 * s, FLESH_L, FLESH, FLESH_D);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // veins and blotches
  speckle(ctx, cx, cy, 1.0 * s, 0.9 * s, 40, 'rgba(90,30,30,0.18)', s * 0.06, 33);
  const r = rng(41);
  ctx.strokeStyle = 'rgba(110,20,50,0.55)';
  for (let k = 0; k < 10; k++) {
    let px = cx + (r() - 0.5) * 2 * s, py = cy + (r() - 0.5) * 1.8 * s;
    ctx.lineWidth = s * 0.03;
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let seg = 0; seg < 5; seg++) { px += (r() - 0.5) * 0.35 * s; py += (r() - 0.5) * 0.35 * s; ctx.lineTo(px, py); }
    ctx.stroke();
  }
  // stitched scar
  ctx.strokeStyle = 'rgba(60,15,15,0.8)';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath(); ctx.moveTo(cx + 0.3 * s, cy - 0.9 * s); ctx.quadraticCurveTo(cx + 0.7 * s, cy - 0.6 * s, cx + 0.85 * s, cy - 0.15 * s); ctx.stroke();
  ctx.lineWidth = s * 0.018;
  for (let k = 0; k < 6; k++) {
    const u = k / 5;
    const sx = cx + (0.3 + 0.55 * u) * s, sy = cy + (-0.9 + 0.75 * u) * s;
    ctx.beginPath(); ctx.moveTo(sx - 0.06 * s, sy - 0.04 * s); ctx.lineTo(sx + 0.06 * s, sy + 0.04 * s); ctx.stroke();
  }
  ctx.restore();
  ink(ctx, s, 0.08);
  blobPath(ctx, cx, cy, 1.15 * s * p, 1.0 * s / p, 0.08, 9, 20);
  ctx.stroke();
  // pustules
  for (const [px, py, pr] of [[-0.55, 0.45, 0.1], [0.5, 0.3, 0.08], [-0.2, -0.85, 0.07], [0.85, -0.55, 0.09]]) {
    ellipsePath(ctx, cx + px * s, cy + py * s, pr * s, pr * s);
    paint(ctx, s, volume(ctx, cx + px * s, cy + py * s, pr * s, '#fff0b0', '#d8b050', '#8a6020'), 0.035);
  }
  // eyes of different sizes, all looking at you
  for (const [ex, ey, er] of [[-0.38, -0.35, 0.19], [0.32, -0.45, 0.15], [0.02, -0.7, 0.11], [0.66, -0.05, 0.11], [-0.7, -0.02, 0.1]]) {
    const exx = cx + ex * s, eyy = cy + ey * s;
    ellipsePath(ctx, exx, eyy, er * 1.15 * s, er * 1.05 * s);
    ctx.fillStyle = '#6a2a26'; ctx.fill();
    ellipsePath(ctx, exx, eyy, er * s, er * s);
    paint(ctx, s, volume(ctx, exx, eyy, er * s, '#ffffff', '#efe4d4', '#b89a8a'), 0.04);
    ellipsePath(ctx, exx, eyy + er * 0.2 * s, er * 0.55 * s, er * 0.55 * s);
    ctx.fillStyle = volume(ctx, exx, eyy + er * 0.2 * s, er * 0.55 * s, '#e05050', '#901818', '#400606'); ctx.fill();
    ellipsePath(ctx, exx, eyy + er * 0.25 * s, er * 0.25 * s, er * 0.25 * s);
    ctx.fillStyle = '#080202'; ctx.fill();
    glint(ctx, exx + er * 0.25 * s, eyy - er * 0.05 * s, er * 0.18 * s);
  }
  // mouth with gums, teeth and drool
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.32 * s, 0.6 * s, 0.3 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#c05060'; ctx.fill();
  ink(ctx, s, 0.06); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.33 * s, 0.5 * s, 0.22 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = volume(ctx, cx, cy + 0.33 * s, 0.5 * s, '#4a0a10', '#2a0408', '#0a0002'); ctx.fill();
  for (let k = 0; k < 8; k++) {
    const tx = cx - 0.43 * s + k * 0.123 * s;
    ctx.beginPath(); ctx.moveTo(tx - 0.05 * s, cy + 0.13 * s); ctx.lineTo(tx + 0.05 * s, cy + 0.13 * s); ctx.lineTo(tx + (k % 2 ? 0.01 : -0.01) * s, cy + 0.27 * s); ctx.closePath();
    paint(ctx, s, '#f2ead2', 0.02);
    ctx.beginPath(); ctx.moveTo(tx - 0.04 * s, cy + 0.53 * s); ctx.lineTo(tx + 0.04 * s, cy + 0.53 * s); ctx.lineTo(tx + 0.01 * s, cy + 0.41 * s); ctx.closePath();
    paint(ctx, s, '#e2d8bc', 0.02);
  }
  ctx.fillStyle = '#b02030';
  ctx.beginPath(); ctx.ellipse(cx + 0.12 * s, cy + 0.44 * s, 0.22 * s, 0.07 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(220,230,210,0.6)';
  ctx.lineWidth = s * 0.03;
  const drip = (t * 0.5) % 1;
  ctx.beginPath(); ctx.moveTo(cx - 0.25 * s, cy + 0.55 * s); ctx.lineTo(cx - 0.26 * s, cy + (0.6 + drip * 0.25) * s); ctx.stroke();
}

// --- Things on the floor ----------------------------------------------------------
export function tear(ctx, x, y, s, { color = '#9ad0ff', size = 0.15, enemy = false } = {}) {
  const r = size * s;
  shadow(ctx, x, y + 0.5 * s, s, size * 0.9, 0.3);
  ellipsePath(ctx, x, y, r, r);
  ctx.fillStyle = enemy ? volume(ctx, x, y, r, '#ff7070', '#b0181c', '#4a0406') : volume(ctx, x, y, r, '#ffffff', color, '#3a6a9a');
  ctx.fill();
  ink(ctx, s, 0.035);
  ctx.stroke();
  glint(ctx, x - r * 0.35, y - r * 0.38, r * 0.3, 0.9);
}

export function heart(ctx, x, y, s, { half = false, empty = false } = {}) {
  const k = 0.32 * s;
  shadow(ctx, x, y, s, 0.22, 0.32);
  const hy = y - 0.3 * s;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(x, hy + k * 0.8);
    ctx.bezierCurveTo(x - k * 1.15, hy + k * 0.05, x - k * 0.9, hy - k * 0.85, x, hy - k * 0.35);
    ctx.bezierCurveTo(x + k * 0.9, hy - k * 0.85, x + k * 1.15, hy + k * 0.05, x, hy + k * 0.8);
    ctx.closePath();
  };
  shape();
  ctx.fillStyle = empty ? '#2a1214' : volume(ctx, x, hy, k * 1.1, '#ff7a7a', '#d0202a', '#5a0408');
  ctx.fill();
  if (half) {
    ctx.save(); shape(); ctx.clip();
    ctx.fillStyle = '#2a1214';
    ctx.fillRect(x, hy - k, k * 1.3, k * 2);
    ctx.restore();
  }
  ink(ctx, s, 0.05);
  shape();
  ctx.stroke();
  if (!empty) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(x - k * 0.45, hy - k * 0.3, k * 0.2, k * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
  }
}

export function coin(ctx, x, y, s, t) {
  shadow(ctx, x, y, s, 0.17, 0.32);
  const w = Math.abs(Math.cos(t * 3)) * 0.15 + 0.03;
  ellipsePath(ctx, x, y - 0.22 * s, w * s, 0.16 * s);
  ctx.fillStyle = volume(ctx, x, y - 0.22 * s, 0.16 * s, '#fff2a0', '#e2b034', '#8a5a10');
  ctx.fill();
  ink(ctx, s, 0.045);
  ctx.stroke();
  if (w > 0.08) {
    ctx.strokeStyle = 'rgba(120,70,10,0.6)';
    ctx.lineWidth = s * 0.015;
    ellipsePath(ctx, x, y - 0.22 * s, w * 0.7 * s, 0.11 * s);
    ctx.stroke();
  }
  glint(ctx, x - w * 0.35 * s, y - 0.3 * s, 0.025 * s, 0.8);
}

export function rock(ctx, x, y, s, seed = 1) {
  const r = rng(seed);
  const cy = y - 0.3 * s;
  shadow(ctx, x, y, s, 0.5, 0.4);
  const outline = () => blobPath(ctx, x, cy, 0.46 * s, 0.33 * s, 0.25, seed, 9);
  outline();
  ctx.fillStyle = volume(ctx, x, cy, 0.46 * s, '#b4a898', '#7e7266', '#3a322c');
  ctx.fill();
  ctx.save();
  outline();
  ctx.clip();
  // facets
  ctx.fillStyle = 'rgba(30,22,18,0.25)';
  ctx.beginPath(); ctx.moveTo(x - 0.5 * s, cy + 0.05 * s); ctx.lineTo(x + 0.1 * s, cy - 0.02 * s); ctx.lineTo(x + 0.55 * s, cy + 0.12 * s); ctx.lineTo(x + 0.55 * s, cy + 0.5 * s); ctx.lineTo(x - 0.5 * s, cy + 0.5 * s); ctx.fill();
  ctx.fillStyle = 'rgba(255,245,230,0.18)';
  ctx.beginPath(); ctx.moveTo(x - 0.3 * s, cy - 0.3 * s); ctx.lineTo(x + 0.05 * s, cy - 0.35 * s); ctx.lineTo(x - 0.05 * s, cy - 0.1 * s); ctx.fill();
  speckle(ctx, x, cy, 0.4 * s, 0.3 * s, 14, 'rgba(20,15,10,0.35)', s * 0.012, seed + 5);
  // moss on top
  if (r() < 0.6) {
    ctx.fillStyle = 'rgba(80,110,40,0.75)';
    blobPath(ctx, x - 0.08 * s + r() * 0.15 * s, cy - 0.27 * s, 0.2 * s, 0.07 * s, 0.6, seed + 9, 10);
    ctx.fill();
  }
  ctx.restore();
  ink(ctx, s, 0.06);
  outline();
  ctx.stroke();
  ctx.lineWidth = s * 0.025;
  ctx.beginPath(); ctx.moveTo(x + 0.04 * s, cy - 0.3 * s); ctx.lineTo(x + 0.1 * s, cy - 0.14 * s); ctx.lineTo(x + 0.04 * s, cy - 0.02 * s); ctx.lineTo(x + 0.08 * s, cy + 0.06 * s); ctx.stroke();
  // pebbles at the foot
  for (let k = 0; k < 2; k++) {
    const px = x + (r() - 0.5) * 0.8 * s, py = y - 0.03 * s + r() * 0.04 * s;
    ellipsePath(ctx, px, py, 0.06 * s, 0.04 * s);
    paint(ctx, s, '#6e6458', 0.03);
  }
}

export function pedestal(ctx, x, y, s) {
  shadow(ctx, x, y, s, 0.45, 0.4);
  ctx.beginPath();
  ctx.moveTo(x - 0.34 * s, y - 0.02 * s); ctx.lineTo(x - 0.27 * s, y - 0.52 * s); ctx.lineTo(x + 0.27 * s, y - 0.52 * s); ctx.lineTo(x + 0.34 * s, y - 0.02 * s);
  ctx.closePath();
  const gp = ctx.createLinearGradient(x - 0.34 * s, 0, x + 0.34 * s, 0);
  gp.addColorStop(0, '#a49a8e'); gp.addColorStop(0.5, '#8a8076'); gp.addColorStop(1, '#4e4640');
  paint(ctx, s, gp, 0.06);
  ctx.strokeStyle = 'rgba(30,20,15,0.5)';
  ctx.lineWidth = s * 0.015;
  for (const ly of [0.18, 0.36]) { ctx.beginPath(); ctx.moveTo(x - 0.3 * s, y - ly * s); ctx.lineTo(x + 0.3 * s, y - ly * s); ctx.stroke(); }
  ellipsePath(ctx, x, y - 0.52 * s, 0.33 * s, 0.1 * s);
  paint(ctx, s, '#b8aea2', 0.05);
}

export function bloodSplat(ctx, x, y, s, seed = 1, color = [150, 14, 18]) {
  const r = rng(seed);
  const [cr, cg, cb] = color;
  ctx.fillStyle = `rgba(${cr * 0.6},${cg * 0.6},${cb * 0.6},0.85)`;
  blobPath(ctx, x, y, 0.32 * s, 0.18 * s, 0.7, seed, 12);
  ctx.fill();
  ctx.fillStyle = `rgba(${cr},${cg},${cb},0.85)`;
  blobPath(ctx, x - 0.03 * s, y - 0.02 * s, 0.24 * s, 0.13 * s, 0.6, seed + 1, 12);
  ctx.fill();
  for (let k = 0; k < 9; k++) {
    const a = r() * Math.PI * 2, d = 0.3 + r() * 0.3;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * d * s, y + Math.sin(a) * d * 0.5 * s, (0.02 + r() * 0.04) * s, (0.015 + r() * 0.03) * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,200,200,0.25)';
  ctx.beginPath(); ctx.ellipse(x - 0.08 * s, y - 0.06 * s, 0.07 * s, 0.03 * s, -0.3, 0, Math.PI * 2); ctx.fill();
}

// --- Props --------------------------------------------------------------------------
export function candle(ctx, x, y, s, t, seed = 1) {
  const r = rng(seed);
  const h = (0.22 + r() * 0.15) * s;
  glow(ctx, x, y - h - 0.05 * s, 1.1 * s, '255,170,80', 0.28);
  shadow(ctx, x, y, s, 0.12, 0.35);
  // wax puddle
  blobPath(ctx, x, y - 0.01 * s, 0.11 * s, 0.045 * s, 0.4, seed, 8);
  paint(ctx, s, '#e8dcb8', 0.03);
  ctx.beginPath();
  ctx.moveTo(x - 0.05 * s, y - 0.02 * s); ctx.lineTo(x - 0.05 * s, y - h); ctx.quadraticCurveTo(x, y - h - 0.02 * s, x + 0.05 * s, y - h); ctx.lineTo(x + 0.05 * s, y - 0.02 * s); ctx.closePath();
  const gc = ctx.createLinearGradient(x - 0.05 * s, 0, x + 0.05 * s, 0);
  gc.addColorStop(0, '#fff6dc'); gc.addColorStop(1, '#b8a47c');
  paint(ctx, s, gc, 0.03);
  // drips
  ctx.fillStyle = '#f2e8c8';
  ctx.beginPath(); ctx.ellipse(x - 0.035 * s, y - h + 0.06 * s, 0.015 * s, 0.04 * s, 0, 0, Math.PI * 2); ctx.fill();
  // wick and flame
  ink(ctx, s, 0.012);
  ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x, y - h - 0.03 * s); ctx.stroke();
  const fl = 1 + Math.sin(t * 15 + seed) * 0.15;
  ctx.fillStyle = '#ff9a2a';
  ctx.beginPath(); ctx.moveTo(x, y - h - 0.13 * s * fl); ctx.quadraticCurveTo(x + 0.04 * s, y - h - 0.04 * s, x, y - h - 0.02 * s); ctx.quadraticCurveTo(x - 0.04 * s, y - h - 0.04 * s, x, y - h - 0.13 * s * fl); ctx.fill();
  ctx.fillStyle = '#fff4c0';
  ctx.beginPath(); ctx.moveTo(x, y - h - 0.09 * s * fl); ctx.quadraticCurveTo(x + 0.02 * s, y - h - 0.04 * s, x, y - h - 0.03 * s); ctx.quadraticCurveTo(x - 0.02 * s, y - h - 0.04 * s, x, y - h - 0.09 * s * fl); ctx.fill();
}

export function skull(ctx, x, y, s, rot = 0) {
  ctx.save();
  ctx.translate(x, y - 0.1 * s);
  ctx.rotate(rot);
  shadow(ctx, 0, 0.08 * s, s, 0.16, 0.3);
  blobPath(ctx, 0, -0.02 * s, 0.13 * s, 0.11 * s, 0.1, 3, 10);
  paint(ctx, s, volume(ctx, 0, -0.02 * s, 0.13 * s, '#fff8e4', '#ddd0b2', '#8a7c60'), 0.04);
  ctx.fillStyle = '#ddd0b2';
  ctx.fillRect(-0.06 * s, 0.05 * s, 0.12 * s, 0.05 * s);
  ink(ctx, s, 0.03);
  ctx.strokeRect(-0.06 * s, 0.05 * s, 0.12 * s, 0.05 * s);
  ctx.fillStyle = '#140a06';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 0.045 * s, -0.01 * s, 0.032 * s, 0.036 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

export function bone(ctx, x, y, s, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ink(ctx, s, 0.03);
  ctx.fillStyle = '#d8cbaa';
  ctx.beginPath(); ctx.roundRect(-0.14 * s, -0.025 * s, 0.28 * s, 0.05 * s, s * 0.02); ctx.fill(); ctx.stroke();
  for (const ex of [-0.15, 0.15]) for (const ey of [-0.028, 0.028]) {
    ctx.beginPath(); ctx.arc(ex * s, ey * s, 0.032 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

export function urn(ctx, x, y, s, seed = 1) {
  shadow(ctx, x, y, s, 0.3, 0.4);
  ctx.beginPath();
  ctx.moveTo(x - 0.1 * s, y - 0.6 * s);
  ctx.bezierCurveTo(x - 0.3 * s, y - 0.5 * s, x - 0.32 * s, y - 0.1 * s, x - 0.15 * s, y - 0.02 * s);
  ctx.lineTo(x + 0.15 * s, y - 0.02 * s);
  ctx.bezierCurveTo(x + 0.32 * s, y - 0.1 * s, x + 0.3 * s, y - 0.5 * s, x + 0.1 * s, y - 0.6 * s);
  ctx.closePath();
  paint(ctx, s, volume(ctx, x, y - 0.3 * s, 0.3 * s, '#c87a50', '#8a4a2a', '#3a1a0c'), 0.055);
  ctx.strokeStyle = 'rgba(30,12,4,0.55)';
  ctx.lineWidth = s * 0.02;
  for (const ly of [0.2, 0.42]) { ctx.beginPath(); ctx.moveTo(x - 0.25 * s, y - ly * s); ctx.quadraticCurveTo(x, y - (ly - 0.04) * s, x + 0.25 * s, y - ly * s); ctx.stroke(); }
  ellipsePath(ctx, x, y - 0.6 * s, 0.12 * s, 0.04 * s);
  paint(ctx, s, '#2a1408', 0.04);
  if (seed % 2) {
    ctx.strokeStyle = INK; ctx.lineWidth = s * 0.015;
    ctx.beginPath(); ctx.moveTo(x + 0.12 * s, y - 0.5 * s); ctx.lineTo(x + 0.06 * s, y - 0.38 * s); ctx.lineTo(x + 0.13 * s, y - 0.28 * s); ctx.stroke();
  }
}

export function cobweb(ctx, x, y, s, flipX = 1, flipY = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipX, flipY);
  ctx.strokeStyle = 'rgba(230,230,220,0.45)';
  ctx.lineWidth = Math.max(1, s * 0.012);
  const R = 0.9 * s;
  for (let k = 0; k <= 5; k++) {
    const a = (k / 5) * Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke();
  }
  for (const f of [0.3, 0.55, 0.8]) {
    ctx.beginPath();
    for (let k = 0; k <= 5; k++) {
      const a = (k / 5) * Math.PI / 2;
      const px = Math.cos(a) * R * f, py = Math.sin(a) * R * f;
      if (k) {
        const pa = ((k - 0.5) / 5) * Math.PI / 2;
        ctx.quadraticCurveTo(Math.cos(pa) * R * f * 0.85, Math.sin(pa) * R * f * 0.85, px, py);
      } else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function chain(ctx, x, y, s, len = 1.2) {
  ink(ctx, s, 0.025);
  const n = Math.floor(len / 0.11);
  for (let k = 0; k < n; k++) {
    const cy = y + k * 0.11 * s;
    ctx.fillStyle = 'transparent';
    ctx.beginPath();
    if (k % 2) ctx.ellipse(x, cy, 0.025 * s, 0.07 * s, 0, 0, Math.PI * 2);
    else ctx.ellipse(x, cy, 0.05 * s, 0.07 * s, 0, 0, Math.PI * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = s * 0.045; ctx.stroke();
    ctx.strokeStyle = '#6a625a'; ctx.lineWidth = s * 0.022; ctx.stroke();
  }
}

export function puddle(ctx, x, y, s, seed = 1) {
  blobPath(ctx, x, y, 0.55 * s, 0.25 * s, 0.4, seed, 12);
  ctx.fillStyle = 'rgba(20,30,35,0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,8,6,0.5)';
  ctx.lineWidth = s * 0.02;
  ctx.stroke();
  ctx.fillStyle = 'rgba(200,220,230,0.18)';
  ctx.beginPath(); ctx.ellipse(x - 0.15 * s, y - 0.06 * s, 0.18 * s, 0.04 * s, -0.1, 0, Math.PI * 2); ctx.fill();
}

export function trapdoor(ctx, x, y, s) {
  const w = 0.7 * s, h = 0.55 * s, cy = y - 0.2 * s;
  ctx.fillStyle = '#3a2416';
  ctx.fillRect(x - w - 0.1 * s, cy - h - 0.1 * s, (w + 0.1 * s) * 2, (h + 0.1 * s) * 2);
  ink(ctx, s, 0.05);
  ctx.strokeRect(x - w - 0.1 * s, cy - h - 0.1 * s, (w + 0.1 * s) * 2, (h + 0.1 * s) * 2);
  const g = ctx.createLinearGradient(0, cy - h, 0, cy + h);
  g.addColorStop(0, '#000'); g.addColorStop(1, '#1a0e08');
  ctx.fillStyle = g;
  ctx.fillRect(x - w, cy - h, w * 2, h * 2);
  // ladder going down
  ctx.strokeStyle = '#6a4a30';
  ctx.lineWidth = s * 0.05;
  for (const sx of [-0.25, 0.25]) { ctx.beginPath(); ctx.moveTo(x + sx * s, cy - h); ctx.lineTo(x + sx * 0.7 * s, cy + h * 0.6); ctx.stroke(); }
  for (let k = 0; k < 3; k++) { const ly = cy - h * 0.6 + k * h * 0.5; ctx.beginPath(); ctx.moveTo(x - 0.24 * s, ly); ctx.lineTo(x + 0.24 * s, ly); ctx.stroke(); }
}

/** A wooden door closing a doorway. dir: n | s | e | w. */
export function closedDoor(ctx, x, y, s, dir, style = 'normal') {
  const wood = style === 'boss' ? ['#7a2a24', '#4a1410'] : style === 'treasure' ? ['#a07a30', '#5a4010'] : ['#7a5236', '#4e321f'];
  ink(ctx, s, 0.05);
  if (dir === 'n') {
    const w = 1.36 * s, h = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w / 2, y - h * 0.5);
    ctx.arc(x, y - h * 0.5, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, wood[0]); g.addColorStop(1, wood[1]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(20,10,5,0.6)';
    ctx.lineWidth = s * 0.03;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * w / 5, y - h); ctx.lineTo(x + k * w / 5, y); ctx.stroke(); }
    ctx.fillStyle = '#3a3a40';
    for (const by of [0.3, 0.75]) ctx.fillRect(x - w / 2, y - h * by - 0.04 * s, w, 0.08 * s);
    ctx.restore();
    ctx.fillStyle = '#d8b25a';
    ctx.beginPath(); ctx.arc(x + w * 0.3, y - h * 0.4, 0.05 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (dir === 's') {
    ctx.fillStyle = wood[1];
    ctx.fillRect(x - 0.7 * s, y, 1.4 * s, 0.25 * s);
    ctx.strokeRect(x - 0.7 * s, y, 1.4 * s, 0.25 * s);
  } else {
    ctx.fillStyle = wood[1];
    const xx = dir === 'w' ? x - 0.25 * s : x;
    ctx.fillRect(xx, y - 0.7 * s, 0.25 * s, 1.4 * s);
    ctx.strokeRect(xx, y - 0.7 * s, 0.25 * s, 1.4 * s);
  }
}

export function wisp(ctx, x, y, s, color = '#ffb060') {
  const cy = y - 0.6 * s;
  glow(ctx, x, cy, 0.35 * s, '255,180,90', 0.35);
  ctx.beginPath();
  ctx.moveTo(x, cy - 0.2 * s);
  ctx.quadraticCurveTo(x + 0.13 * s, cy, x, cy + 0.12 * s);
  ctx.quadraticCurveTo(x - 0.13 * s, cy, x, cy - 0.2 * s);
  ctx.fillStyle = color;
  ctx.fill();
  ink(ctx, s, 0.03);
  ctx.stroke();
  ctx.fillStyle = '#fff6d0';
  ctx.beginPath(); ctx.arc(x, cy + 0.02 * s, 0.04 * s, 0, Math.PI * 2); ctx.fill();
}

export function cloud(ctx, x, y, s, seed = 1) {
  ctx.fillStyle = 'rgba(110,150,50,0.9)';
  for (let k = 0; k < 7; k++) {
    const r = rng(seed + k);
    blobPath(ctx, x + (r() - 0.5) * 0.9 * s, y - 0.25 * s + (r() - 0.5) * 0.4 * s, (0.25 + r() * 0.2) * s, (0.18 + r() * 0.1) * s, 0.3, seed + k, 8);
    ctx.fill();
  }
}

// --- More enemies -----------------------------------------------------------------
export function spider(ctx, x, y, s, t, { run = false } = {}) {
  shadow(ctx, x, y, s, 0.3, 0.32);
  const by = y - 0.22 * s;
  // eight jointed legs
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const ph = Math.sin(t * (run ? 30 : 6) + k * 1.7 + (sx > 0 ? 1 : 0)) * 0.04 * s;
      const ax = x + sx * 0.08 * s, ay = by + (k - 1.5) * 0.05 * s;
      const kx = x + sx * (0.24 + k * 0.02) * s, ky = by - 0.14 * s + (k - 1.5) * 0.07 * s + ph;
      const fx = x + sx * (0.36 + Math.abs(k - 1.5) * 0.03) * s, fy = y - 0.02 * s + (k - 1.5) * 0.06 * s - ph;
      ink(ctx, s, 0.05);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.strokeStyle = '#3a2c26'; ctx.lineWidth = s * 0.022;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    }
  }
  // abdomen with a pale mark
  ellipsePath(ctx, x, by + 0.02 * s, 0.17 * s, 0.14 * s);
  paint(ctx, s, volume(ctx, x, by + 0.02 * s, 0.17 * s, '#5a4038', '#2a1a16', '#0c0604'), 0.05);
  ctx.fillStyle = 'rgba(220,200,170,0.55)';
  ctx.beginPath(); ctx.moveTo(x, by - 0.06 * s); ctx.lineTo(x + 0.05 * s, by + 0.03 * s); ctx.lineTo(x, by + 0.1 * s); ctx.lineTo(x - 0.05 * s, by + 0.03 * s); ctx.fill();
  // head with a cluster of red eyes
  ellipsePath(ctx, x, by - 0.13 * s, 0.1 * s, 0.08 * s);
  paint(ctx, s, volume(ctx, x, by - 0.13 * s, 0.1 * s, '#4a3430', '#24140f', '#0a0402'), 0.045);
  for (const [ex, ey, er] of [[-0.04, -0.15, 0.025], [0.04, -0.15, 0.025], [-0.015, -0.11, 0.015], [0.015, -0.11, 0.015]]) {
    ctx.fillStyle = '#ff4030';
    ctx.beginPath(); ctx.arc(x + ex * s, by + ey * s, er * s, 0, Math.PI * 2); ctx.fill();
  }
  // fangs
  ctx.fillStyle = '#e8dcc0';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sx * 0.03 * s, by - 0.07 * s); ctx.lineTo(x + sx * 0.015 * s, by - 0.02 * s); ctx.lineTo(x + sx * 0.005 * s, by - 0.07 * s); ctx.fill(); }
}

export function clot(ctx, x, y, s, t, { squish = 0 } = {}) {
  shadow(ctx, x, y, s, 0.42, 0.35);
  const sq = 1 + Math.sin(t * 4) * 0.05 + squish * 0.18;
  const w = 0.38 * s * sq, h = 0.36 * s / sq;
  const cy = y - h * 0.95;
  // drips running down
  for (const [dx, len] of [[-0.25, 0.18], [0.2, 0.12], [0.02, 0.22]]) {
    ctx.fillStyle = '#6a0a0e';
    ctx.beginPath(); ctx.ellipse(x + dx * s, y - 0.04 * s + len * 0.1 * s, 0.035 * s, (0.05 + len * 0.2) * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  blobPath(ctx, x, cy, w, h, 0.22, 13, 14);
  ctx.fillStyle = volume(ctx, x, cy, w, '#e0504a', '#9a1418', '#3a0204');
  ctx.fill();
  ctx.save(); ctx.clip();
  speckle(ctx, x, cy, w * 0.8, h * 0.8, 14, 'rgba(40,0,0,0.35)', s * 0.03, 8);
  ctx.strokeStyle = 'rgba(255,140,120,0.35)';
  ctx.lineWidth = s * 0.02;
  ctx.beginPath(); ctx.arc(x - w * 0.2, cy - h * 0.1, w * 0.6, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  ctx.restore();
  ink(ctx, s, 0.06);
  blobPath(ctx, x, cy, w, h, 0.22, 13, 14);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(x - w * 0.4, cy - h * 0.45, w * 0.16, h * 0.1, -0.6, 0, Math.PI * 2); ctx.fill();
  // small sunken eyes and a gaping mouth
  for (const sx of [-1, 1]) {
    ellipsePath(ctx, x + sx * w * 0.32, cy - h * 0.12, 0.05 * s, 0.06 * s);
    ctx.fillStyle = '#1a0202'; ctx.fill();
    ctx.fillStyle = '#ffd0a0';
    ctx.beginPath(); ctx.arc(x + sx * w * 0.32, cy - h * 0.14, 0.015 * s, 0, Math.PI * 2); ctx.fill();
  }
  ellipsePath(ctx, x, cy + h * 0.35, (0.1 + squish * 0.05) * s, (0.06 + squish * 0.06) * s);
  paint(ctx, s, '#1a0204', 0.03);
}

export function gaper(ctx, x, y, s, t, { angry = false } = {}) {
  shadow(ctx, x, y, s, 0.32, 0.38);
  const step = Math.sin(t * (angry ? 14 : 9));
  const SKIN_L = '#d8cbb8', SKIN = '#a89886', SKIN_D = '#5a4c40';
  // legs
  for (const sx of [-1, 1]) {
    const lift = Math.max(0, step * sx) * 0.06 * s;
    ctx.beginPath();
    ctx.roundRect(x + sx * 0.1 * s - 0.05 * s, y - 0.32 * s - lift, 0.1 * s, 0.3 * s, 0.03 * s);
    paint(ctx, s, '#4a3c34', 0.045);
  }
  // ragged body
  ctx.beginPath();
  ctx.moveTo(x - 0.2 * s, y - 0.72 * s);
  ctx.quadraticCurveTo(x - 0.25 * s, y - 0.4 * s, x - 0.18 * s, y - 0.28 * s);
  ctx.lineTo(x - 0.1 * s, y - 0.33 * s); ctx.lineTo(x - 0.02 * s, y - 0.26 * s); ctx.lineTo(x + 0.07 * s, y - 0.32 * s); ctx.lineTo(x + 0.18 * s, y - 0.27 * s);
  ctx.quadraticCurveTo(x + 0.25 * s, y - 0.4 * s, x + 0.2 * s, y - 0.72 * s);
  ctx.closePath();
  paint(ctx, s, volume(ctx, x, y - 0.5 * s, 0.25 * s, '#7a6a5a', '#4a3e34', '#1e1814'), 0.05);
  // arms reaching forward
  for (const sx of [-1, 1]) {
    const sw = step * sx * 0.03 * s;
    ink(ctx, s, 0.09);
    ctx.beginPath(); ctx.moveTo(x + sx * 0.18 * s, y - 0.66 * s); ctx.lineTo(x + sx * 0.25 * s, y - 0.48 * s + sw); ctx.stroke();
    ctx.strokeStyle = SKIN; ctx.lineWidth = s * 0.05; ctx.stroke();
    ctx.fillStyle = SKIN_L;
    ctx.beginPath(); ctx.arc(x + sx * 0.25 * s, y - 0.46 * s + sw, 0.035 * s, 0, Math.PI * 2); ctx.fill();
  }
  // bald head
  const hy = y - 0.92 * s + Math.abs(step) * 0.02 * s;
  ellipsePath(ctx, x, hy, 0.22 * s, 0.24 * s);
  paint(ctx, s, volume(ctx, x, hy, 0.22 * s, SKIN_L, SKIN, SKIN_D), 0.06);
  // veins on the scalp
  ctx.strokeStyle = 'rgba(90,60,90,0.4)';
  ctx.lineWidth = s * 0.01;
  ctx.beginPath(); ctx.moveTo(x - 0.1 * s, hy - 0.2 * s); ctx.lineTo(x - 0.06 * s, hy - 0.12 * s); ctx.lineTo(x - 0.09 * s, hy - 0.06 * s); ctx.stroke();
  // hollow eyes (they glow red when it runs)
  for (const sx of [-1, 1]) {
    ellipsePath(ctx, x + sx * 0.085 * s, hy - 0.01 * s, 0.055 * s, 0.07 * s);
    ctx.fillStyle = '#0a0404'; ctx.fill();
    if (angry) { ctx.fillStyle = '#ff3020'; ctx.beginPath(); ctx.arc(x + sx * 0.085 * s, hy, 0.018 * s, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(120,20,20,0.7)';
    ctx.fillRect(x + sx * 0.085 * s - 0.008 * s, hy + 0.05 * s, 0.016 * s, 0.08 * s);
  }
  // gaping mouth
  ellipsePath(ctx, x, hy + 0.13 * s, 0.07 * s, 0.07 * s);
  paint(ctx, s, '#1a0404', 0.03);
  ctx.fillStyle = '#8a1418';
  ctx.fillRect(x - 0.01 * s, hy + 0.18 * s, 0.02 * s, 0.07 * s);
}

export function host(ctx, x, y, s, t, { up = 0 } = {}) {
  shadow(ctx, x, y, s, 0.42, 0.35);
  // the skull rises out of the mound
  const sy = y - 0.22 * s - up * 0.32 * s;
  const BONE = '#ece0c4', BONE_D = '#a89878';
  ctx.save();
  ctx.beginPath(); ctx.rect(x - s, y - 2 * s, 2 * s, 2 * s - 0.2 * s); ctx.clip();
  ellipsePath(ctx, x, sy, 0.24 * s, 0.24 * s);
  paint(ctx, s, volume(ctx, x, sy, 0.24 * s, '#fffbea', BONE, BONE_D), 0.06);
  ctx.strokeStyle = 'rgba(60,40,20,0.7)';
  ctx.lineWidth = s * 0.012;
  ctx.beginPath(); ctx.moveTo(x - 0.06 * s, sy - 0.22 * s); ctx.lineTo(x - 0.1 * s, sy - 0.12 * s); ctx.lineTo(x - 0.06 * s, sy - 0.06 * s); ctx.stroke();
  for (const sx of [-1, 1]) {
    ellipsePath(ctx, x + sx * 0.09 * s, sy, 0.06 * s, 0.07 * s);
    ctx.fillStyle = '#100604'; ctx.fill();
    if (up > 0.5) { glow(ctx, x + sx * 0.09 * s, sy, 0.08 * s, '255,60,30', 0.7); ctx.fillStyle = '#ff6a3a'; ctx.beginPath(); ctx.arc(x + sx * 0.09 * s, sy, 0.02 * s, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.fillStyle = '#100604';
  ctx.beginPath(); ctx.moveTo(x, sy + 0.07 * s); ctx.lineTo(x - 0.025 * s, sy + 0.12 * s); ctx.lineTo(x + 0.025 * s, sy + 0.12 * s); ctx.fill();
  if (up > 0.5) { ellipsePath(ctx, x, sy + 0.18 * s, 0.07 * s, 0.04 * s); ctx.fillStyle = '#100604'; ctx.fill(); }
  ctx.restore();
  // mound of dirt and bones in front
  blobPath(ctx, x, y - 0.12 * s, 0.4 * s, 0.17 * s, 0.25, 31, 12);
  paint(ctx, s, volume(ctx, x, y - 0.12 * s, 0.4 * s, '#7a5a40', '#4a3020', '#1e120a'), 0.055);
  speckle(ctx, x, y - 0.12 * s, 0.32 * s, 0.1 * s, 10, 'rgba(20,10,4,0.5)', s * 0.02, 5);
  ctx.save();
  ctx.translate(x + 0.18 * s, y - 0.14 * s); ctx.rotate(-0.4);
  ctx.fillStyle = BONE; ctx.fillRect(-0.09 * s, -0.015 * s, 0.18 * s, 0.03 * s);
  ink(ctx, s, 0.02); ctx.strokeRect(-0.09 * s, -0.015 * s, 0.18 * s, 0.03 * s);
  ctx.restore();
}

export function leaper(ctx, x, y, s, t, { air = false } = {}) {
  const FL = '#c88a7a', F = '#8a4a40', FD = '#3a1612';
  const by = y - (air ? 0.5 : 0.28) * s;
  // legs: folded when sitting, stretched in the air
  for (const sx of [-1, 1]) {
    ink(ctx, s, 0.08);
    ctx.beginPath();
    if (air) { ctx.moveTo(x + sx * 0.15 * s, by + 0.05 * s); ctx.lineTo(x + sx * 0.25 * s, by + 0.25 * s); ctx.lineTo(x + sx * 0.2 * s, by + 0.42 * s); }
    else { ctx.moveTo(x + sx * 0.15 * s, by + 0.05 * s); ctx.lineTo(x + sx * 0.36 * s, by - 0.08 * s); ctx.lineTo(x + sx * 0.32 * s, y - 0.02 * s); }
    ctx.stroke();
    ctx.strokeStyle = F; ctx.lineWidth = s * 0.05; ctx.stroke();
  }
  // squat body
  blobPath(ctx, x, by, 0.25 * s, 0.2 * s, 0.15, 17, 12);
  paint(ctx, s, volume(ctx, x, by, 0.25 * s, FL, F, FD), 0.055);
  speckle(ctx, x, by, 0.2 * s, 0.14 * s, 8, 'rgba(60,10,10,0.35)', s * 0.02, 3);
  // wide frog mouth and bulging eyes
  ctx.strokeStyle = '#2a0806';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath(); ctx.arc(x, by - 0.02 * s, 0.15 * s, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  for (const sx of [-1, 1]) {
    ellipsePath(ctx, x + sx * 0.12 * s, by - 0.16 * s, 0.07 * s, 0.07 * s);
    paint(ctx, s, volume(ctx, x + sx * 0.12 * s, by - 0.16 * s, 0.07 * s, '#fff8d0', '#e8d890', '#8a7a40'), 0.035);
    ctx.fillStyle = '#0a0602';
    ctx.fillRect(x + sx * 0.12 * s - 0.04 * s, by - 0.17 * s, 0.08 * s, 0.022 * s);
  }
}

export function boomfly(ctx, x, y, s, t) {
  const hy = y - 0.85 * s + Math.sin(t * 6) * 0.06 * s;
  shadow(ctx, x, y, s, 0.28, 0.3);
  const flap = Math.sin(t * 48) * 0.5;
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(x + sx * 0.1 * s, hy - 0.15 * s);
    ctx.rotate(sx * (0.5 + flap));
    ellipsePath(ctx, sx * 0.16 * s, -0.03 * s, 0.19 * s, 0.08 * s);
    ctx.fillStyle = 'rgba(225,235,210,0.7)';
    ctx.fill();
    ink(ctx, s, 0.03); ctx.stroke();
    ctx.restore();
  }
  // swollen, pustule-covered body
  ellipsePath(ctx, x, hy + 0.02 * s, 0.27 * s, 0.25 * s);
  paint(ctx, s, volume(ctx, x, hy + 0.02 * s, 0.27 * s, '#d8d070', '#8a8a2a', '#3a3a08'), 0.055);
  for (const [px, py, pr] of [[-0.12, 0.08, 0.06], [0.1, 0.1, 0.05], [0.14, -0.06, 0.04], [-0.04, 0.16, 0.04]]) {
    ellipsePath(ctx, x + px * s, hy + py * s, pr * s, pr * s);
    paint(ctx, s, volume(ctx, x + px * s, hy + py * s, pr * s, '#fff8c0', '#e0c050', '#8a6010'), 0.025);
  }
  // red eyes
  for (const sx of [-1, 1]) {
    ellipsePath(ctx, x + sx * 0.09 * s, hy - 0.12 * s, 0.065 * s, 0.065 * s);
    paint(ctx, s, volume(ctx, x + sx * 0.09 * s, hy - 0.12 * s, 0.065 * s, '#ff6a5a', '#b81818', '#4a0606'), 0.03);
    glint(ctx, x + sx * 0.09 * s - 0.02 * s, hy - 0.14 * s, 0.015 * s);
  }
}

export function wraith(ctx, x, y, s, t) {
  const hy = y - 0.95 * s + Math.sin(t * 2) * 0.08 * s;
  shadow(ctx, x, y, s, 0.28, 0.22);
  // tattered robe tapering into a wisp
  ctx.beginPath();
  ctx.moveTo(x - 0.22 * s, hy - 0.05 * s);
  ctx.quadraticCurveTo(x - 0.3 * s, hy + 0.3 * s, x - 0.18 * s, hy + 0.5 * s);
  for (let k = 0; k <= 6; k++) {
    const u = k / 6;
    const px = x - 0.18 * s + u * 0.36 * s;
    const py = hy + (k % 2 ? 0.42 : 0.56) * s + Math.sin(t * 5 + k) * 0.04 * s;
    ctx.lineTo(px, py);
  }
  ctx.quadraticCurveTo(x + 0.3 * s, hy + 0.3 * s, x + 0.22 * s, hy - 0.05 * s);
  ctx.quadraticCurveTo(x + 0.22 * s, hy - 0.42 * s, x, hy - 0.44 * s);
  ctx.quadraticCurveTo(x - 0.22 * s, hy - 0.42 * s, x - 0.22 * s, hy - 0.05 * s);
  ctx.closePath();
  paint(ctx, s, volume(ctx, x, hy, 0.35 * s, '#a8b0b8', '#5a626e', '#1e222a'), 0.055);
  // hood opening, dark inside, with burning eyes
  ellipsePath(ctx, x, hy - 0.12 * s, 0.14 * s, 0.17 * s);
  ctx.fillStyle = '#06080a'; ctx.fill();
  for (const sx of [-1, 1]) {
    glow(ctx, x + sx * 0.055 * s, hy - 0.13 * s, 0.07 * s, '120,230,255', 0.8);
    ctx.fillStyle = '#c8f4ff';
    ctx.beginPath(); ctx.arc(x + sx * 0.055 * s, hy - 0.13 * s, 0.022 * s, 0, Math.PI * 2); ctx.fill();
  }
  // bony hands
  for (const sx of [-1, 1]) {
    ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = s * 0.02;
    for (let f = 0; f < 3; f++) { ctx.beginPath(); ctx.moveTo(x + sx * 0.24 * s, hy + 0.1 * s); ctx.lineTo(x + sx * (0.3 + f * 0.015) * s, hy + (0.16 + f * 0.03) * s); ctx.stroke(); }
  }
}

// --- More bosses ------------------------------------------------------------------
export function gorger(ctx, x, y, s, t, { mouth = 0 } = {}) {
  shadow(ctx, x, y, s, 1.1, 0.45);
  const cx = x, cy = y - 0.95 * s;
  const p = 1 + Math.sin(t * 3) * 0.025;
  const FL = '#9aa088', F = '#5e6a52', FD = '#20261a';
  // stubby legs
  for (const sx of [-1, 1]) {
    ellipsePath(ctx, x + sx * 0.6 * s, y - 0.12 * s, 0.22 * s, 0.14 * s);
    paint(ctx, s, volume(ctx, x + sx * 0.6 * s, y - 0.12 * s, 0.22 * s, FL, F, FD), 0.06);
  }
  // body
  blobPath(ctx, cx, cy, 1.05 * s * p, 0.92 * s / p, 0.1, 23, 18);
  ctx.fillStyle = volume(ctx, cx, cy, 1.05 * s, FL, F, FD);
  ctx.fill();
  ctx.save(); ctx.clip();
  speckle(ctx, cx, cy, 0.9 * s, 0.8 * s, 30, 'rgba(30,40,20,0.3)', s * 0.05, 19);
  speckle(ctx, cx, cy - 0.4 * s, 0.7 * s, 0.3 * s, 14, 'rgba(220,230,180,0.25)', s * 0.03, 29);
  ctx.restore();
  ink(ctx, s, 0.08);
  blobPath(ctx, cx, cy, 1.05 * s * p, 0.92 * s / p, 0.1, 23, 18);
  ctx.stroke();
  // little mean eyes on top
  for (const sx of [-1, 1]) {
    ellipsePath(ctx, cx + sx * 0.32 * s, cy - 0.58 * s, 0.11 * s, 0.09 * s);
    paint(ctx, s, '#f6eed0', 0.04);
    ellipsePath(ctx, cx + sx * 0.3 * s, cy - 0.56 * s, 0.05 * s, 0.05 * s);
    ctx.fillStyle = '#100404'; ctx.fill();
    ink(ctx, s, 0.05);
    ctx.beginPath(); ctx.moveTo(cx + sx * 0.46 * s, cy - 0.74 * s); ctx.lineTo(cx + sx * 0.18 * s, cy - 0.64 * s); ctx.stroke();
  }
  // the huge mouth
  const mh = (0.3 + mouth * 0.18) * s;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.12 * s, 0.82 * s, mh + 0.06 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#7a2a30'; ctx.fill();
  ink(ctx, s, 0.07); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.13 * s, 0.72 * s, mh, 0, 0, Math.PI * 2);
  ctx.fillStyle = volume(ctx, cx, cy + 0.13 * s, 0.72 * s, '#5a0a10', '#2a0408', '#080002'); ctx.fill();
  ctx.fillStyle = '#b03040';
  ctx.beginPath(); ctx.ellipse(cx + 0.1 * s, cy + 0.13 * s + mh * 0.55, 0.32 * s, mh * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 10; k++) {
    const u = (k + 0.5) / 10, tx = cx - 0.68 * s + u * 1.36 * s;
    const edge = Math.sqrt(1 - Math.pow((u - 0.5) * 2, 2));
    const top = cy + 0.13 * s - mh * edge, bot = cy + 0.13 * s + mh * edge;
    ctx.beginPath(); ctx.moveTo(tx - 0.06 * s, top); ctx.lineTo(tx + 0.06 * s, top); ctx.lineTo(tx, top + 0.15 * s); ctx.closePath();
    paint(ctx, s, '#efe6c8', 0.02);
    ctx.beginPath(); ctx.moveTo(tx - 0.05 * s, bot); ctx.lineTo(tx + 0.05 * s, bot); ctx.lineTo(tx, bot - 0.12 * s); ctx.closePath();
    paint(ctx, s, '#ddd2b0', 0.02);
  }
}

export function hive(ctx, x, y, s, t, { pulse = 0 } = {}) {
  shadow(ctx, x, y, s, 0.9, 0.35);
  const cy = y - 1.5 * s + Math.sin(t * 1.5) * 0.08 * s;
  const p = 1 + Math.sin(t * 4) * 0.03 + pulse * 0.08;
  // fleshy stalk hanging from above
  ctx.strokeStyle = INK; ctx.lineWidth = s * 0.2;
  ctx.beginPath(); ctx.moveTo(x, cy - 0.8 * s); ctx.lineTo(x + Math.sin(t) * 0.05 * s, cy - 1.6 * s); ctx.stroke();
  ctx.strokeStyle = '#6a3028'; ctx.lineWidth = s * 0.13; ctx.stroke();
  // the nest: stacked lumpy rings
  for (let k = 4; k >= 0; k--) {
    const ry = cy - 0.55 * s + k * 0.27 * s;
    const rw = (0.55 + Math.sin((k / 4) * Math.PI) * 0.4) * s * p;
    blobPath(ctx, x, ry, rw, 0.2 * s, 0.12, 50 + k, 14);
    paint(ctx, s, volume(ctx, x, ry, rw, '#d8a080', k % 2 ? '#9a5a40' : '#a8664a', '#3a1a10'), 0.06);
  }
  // holes, some with flies poking out
  for (const [hx, hy, r] of [[-0.45, -0.15, 0.1], [0.35, -0.3, 0.09], [0.1, 0.15, 0.12], [-0.2, 0.42, 0.08], [0.52, 0.25, 0.08], [-0.1, -0.5, 0.07]]) {
    ellipsePath(ctx, x + hx * s * p, cy + hy * s, r * s, r * 0.8 * s);
    ctx.fillStyle = '#1a0604'; ctx.fill();
    ink(ctx, s, 0.03); ctx.stroke();
    ctx.fillStyle = 'rgba(255,200,120,0.25)';
    ctx.beginPath(); ctx.arc(x + hx * s * p - r * 0.3 * s, cy + hy * s - r * 0.3 * s, r * 0.25 * s, 0, Math.PI * 2); ctx.fill();
  }
  // drips of honey-like ichor
  ctx.fillStyle = '#c89040';
  for (const dx of [-0.3, 0.15, 0.4]) {
    const d = ((t * 0.6 + dx * 3) % 1);
    ctx.beginPath(); ctx.ellipse(x + dx * s, cy + 0.75 * s + d * 0.3 * s, 0.03 * s, 0.05 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
}

export function bonelord(ctx, x, y, s, t, { windup = 0 } = {}) {
  // A giant version of the bone ram with a crown of horns.
  ram(ctx, x, y, s * 2.2, t * (windup ? 2 : 1));
  const hy = y - (0.05 + 0.68) * s * 2.2;
  for (let k = -2; k <= 2; k++) {
    const a = -Math.PI / 2 + k * 0.35;
    const bx = x + Math.cos(a) * 0.38 * s, by = hy - 0.45 * s + Math.sin(a) * 0.1 * s;
    ctx.beginPath();
    ctx.moveTo(bx - 0.06 * s, by + 0.05 * s);
    ctx.lineTo(bx + Math.cos(a) * 0.3 * s, by + Math.sin(a) * 0.3 * s - Math.abs(k) * 0.02 * s);
    ctx.lineTo(bx + 0.06 * s, by + 0.05 * s);
    ctx.closePath();
    paint(ctx, s, volume(ctx, bx, by, 0.2 * s, '#5a3a3a', '#2a1414', '#0a0404'), 0.05);
  }
  if (windup) {
    for (const sx of [-1, 1]) glow(ctx, x + sx * 0.19 * s, hy - 0.04 * s, 0.25 * s, '255,40,20', 0.7);
  }
}

export function deepEye(ctx, x, y, s, t, { look = [0, 1], stare = 0 } = {}) {
  shadow(ctx, x, y, s, 1.0, 0.35);
  const cy = y - 1.6 * s + Math.sin(t * 1.2) * 0.1 * s;
  // tentacles hanging below
  for (let k = 0; k < 7; k++) {
    const bx = x + (k - 3) * 0.24 * s;
    for (const [w, c] of [[0.17, INK], [0.11, '#4a1a3a'], [0.04, '#8a3a6a']]) {
      ctx.strokeStyle = c; ctx.lineWidth = s * w * (1 - Math.abs(k - 3) * 0.08);
      ctx.beginPath();
      ctx.moveTo(bx, cy + 0.6 * s);
      ctx.bezierCurveTo(bx + Math.sin(t * 2 + k) * 0.25 * s, cy + 1.0 * s, bx - Math.sin(t * 1.6 + k) * 0.25 * s, cy + 1.3 * s, bx + Math.sin(t * 2.4 + k * 2) * 0.15 * s, cy + 1.55 * s);
      ctx.stroke();
    }
  }
  // fleshy socket around the eye
  blobPath(ctx, x, cy, 1.15 * s, 1.0 * s, 0.14, 61, 18);
  paint(ctx, s, volume(ctx, x, cy, 1.15 * s, '#a85a7a', '#5a2440', '#1a0610'), 0.08);
  // eyelids
  ellipsePath(ctx, x, cy, 0.92 * s, 0.82 * s);
  ctx.fillStyle = '#3a0e22'; ctx.fill();
  // the eye itself
  ctx.save();
  ellipsePath(ctx, x, cy, 0.86 * s, 0.76 * s);
  ctx.clip();
  ctx.fillStyle = volume(ctx, x, cy, 0.86 * s, '#fff8f0', '#e8d0c0', '#8a5a50');
  ctx.fillRect(x - s, cy - s, 2 * s, 2 * s);
  const r = rng(71);
  ctx.strokeStyle = 'rgba(170,20,40,0.7)';
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    let px = x + Math.cos(a) * 0.86 * s, py = cy + Math.sin(a) * 0.76 * s;
    for (let seg = 0; seg < 4; seg++) {
      ctx.lineWidth = s * (0.035 - seg * 0.007);
      const nx = px + (x - px) * 0.22 + (r() - 0.5) * 0.18 * s, ny = py + (cy - py) * 0.22 + (r() - 0.5) * 0.18 * s;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
      px = nx; py = ny;
    }
  }
  const ix = x + look[0] * 0.28 * s, iy = cy + look[1] * 0.24 * s;
  ellipsePath(ctx, ix, iy, 0.42 * s, 0.42 * s);
  const gi = ctx.createRadialGradient(ix, iy, 0.05 * s, ix, iy, 0.42 * s);
  gi.addColorStop(0, stare ? '#ff6040' : '#e0d040'); gi.addColorStop(0.5, stare ? '#a01010' : '#8a3a10'); gi.addColorStop(1, '#2a0804');
  ctx.fillStyle = gi; ctx.fill();
  ink(ctx, s, 0.05); ctx.stroke();
  // slit pupil
  ctx.beginPath();
  ctx.ellipse(ix, iy, (stare ? 0.12 : 0.07) * s, 0.3 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#050102'; ctx.fill();
  glint(ctx, ix + 0.15 * s, iy - 0.18 * s, 0.07 * s, 0.85);
  ctx.restore();
  ink(ctx, s, 0.07);
  ellipsePath(ctx, x, cy, 0.86 * s, 0.76 * s);
  ctx.stroke();
  // teeth-like lashes around the lids
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const ex = x + Math.cos(a) * 0.9 * s, ey = cy + Math.sin(a) * 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(a + 1.57) * 0.05 * s, ey + Math.sin(a + 1.57) * 0.05 * s);
    ctx.lineTo(ex + Math.cos(a) * 0.16 * s, ey + Math.sin(a) * 0.16 * s);
    ctx.lineTo(ex - Math.cos(a + 1.57) * 0.05 * s, ey - Math.sin(a + 1.57) * 0.05 * s);
    ctx.closePath();
    paint(ctx, s, '#e8dcc0', 0.02);
  }
}

// --- Projectile looks ---------------------------------------------------------------
/**
 * A player shot in one of several looks. (x, y) is the centre of the shot;
 * its shadow falls 0.5 units lower. angle: flight direction on screen
 * (radians). spin: 0..1 for things that turn.
 */
export function projectile(ctx, x, y, s, { skin = 'tear', color = '#9ad0ff', size = 0.15, angle = 0, spin = 0 } = {}) {
  if (skin === 'tear') { tear(ctx, x, y, s, { color, size }); return; }
  // tiny sprites: fills only, the pixel outline does the inking
  const r = size * s * 1.25;
  const pf = (fill) => { ctx.fillStyle = fill; ctx.fill(); };
  shadow(ctx, x, y + 0.5 * s, s, size * 0.9, 0.3);
  ctx.save();
  ctx.translate(x, y);
  if (skin === 'flame') {
    ctx.rotate(angle);
    glow(ctx, 0, 0, r * 2.4, '255,140,40', 0.5);
    for (const [col, k] of [['#c8401a', 1], ['#ff8a2a', 0.72], ['#fff0a0', 0.4]]) {
      ctx.beginPath();
      ctx.moveTo(-r * 2.6 * k, Math.sin(spin * 6.28) * r * 0.3);
      ctx.quadraticCurveTo(-r * 0.6, -r * 1.1 * k, r * 0.9 * k, -r * 0.2 * k);
      ctx.arc(0, 0, r * k, -0.3, 0.3 + Math.PI * 0.6);
      ctx.quadraticCurveTo(-r * 0.6, r * 1.1 * k, -r * 2.6 * k, Math.sin(spin * 6.28) * r * 0.3);
      ctx.fillStyle = col;
      ctx.fill();
    }
  } else if (skin === 'shard') {
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(r * 1.8, 0); ctx.lineTo(0, -r * 0.7); ctx.lineTo(-r * 1.6, 0); ctx.lineTo(0, r * 0.7); ctx.closePath();
    pf(volume(ctx, 0, 0, r * 1.5, '#ffffff', '#8ad8f0', '#2a6a9a'));
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = s * 0.015;
    ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r * 1.2, 0); ctx.stroke();
  } else if (skin === 'bubble') {
    ellipsePath(ctx, 0, 0, r * 1.1, r * 1.1);
    ctx.fillStyle = 'rgba(120,200,60,0.75)';
    ctx.fill();
    ellipsePath(ctx, 0, 0, r * 0.8, r * 0.8);
    ctx.strokeStyle = 'rgba(30,70,10,0.6)'; ctx.lineWidth = s * 0.015; ctx.stroke();
    glint(ctx, -r * 0.4, -r * 0.45, r * 0.32, 0.95);
    glint(ctx, r * 0.35, r * 0.3, r * 0.14, 0.7);
    ctx.fillStyle = 'rgba(160,230,90,0.85)';
    ctx.beginPath(); ctx.arc(r * 1.2 * Math.cos(spin * 6.28), r * 1.2 * Math.sin(spin * 6.28), r * 0.22, 0, Math.PI * 2); ctx.fill();
  } else if (skin === 'blade') {
    ctx.rotate(spin * Math.PI * 2);
    // a crescent blade: the outer rim of one circle, the inner rim of a shifted one
    const R = r * 1.5, d = r * 1.0, h = Math.sqrt(R * R - (d * d) / 4);
    const to = Math.atan2(h, d / 2), ti = Math.atan2(h, -d / 2);
    ctx.beginPath();
    ctx.arc(0, 0, R, to, Math.PI * 2 - to);
    ctx.arc(d, 0, R, -ti, ti, true);
    ctx.closePath();
    pf(volume(ctx, 0, 0, R, '#ffffff', '#c8d0d8', '#5a6068'));
    ctx.fillStyle = '#6a4a2a';
    ctx.beginPath(); ctx.arc(r * 0.9, r * 0.9, r * 0.35, 0, Math.PI * 2); ctx.fill();
  } else if (skin === 'bone') {
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.roundRect(-r * 1.4, -r * 0.28, r * 2.8, r * 0.56, r * 0.2);
    pf('#ece0c4');
    for (const ex of [-1.4, 1.4]) for (const ey of [-0.35, 0.35]) {
      ellipsePath(ctx, ex * r, ey * r, r * 0.38, r * 0.38);
      pf(volume(ctx, ex * r, ey * r, r * 0.4, '#fffbea', '#ece0c4', '#a89878'));
    }
  } else if (skin === 'skull') {
    // a ghostly little skull with a wisp trailing behind
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.8);
    ctx.quadraticCurveTo(-r * 2, -r * 0.3 + Math.sin(spin * 6.28) * r * 0.4, -r * 2.8, Math.sin(spin * 6.28 + 1) * r * 0.5);
    ctx.quadraticCurveTo(-r * 2, r * 0.4, -r * 0.4, r * 0.8);
    ctx.fillStyle = 'rgba(150,220,255,0.55)';
    ctx.fill();
    ctx.restore();
    glow(ctx, 0, 0, r * 2.2, '140,220,255', 0.45);
    ellipsePath(ctx, 0, -r * 0.1, r * 0.95, r * 0.9);
    pf(volume(ctx, 0, 0, r, '#ffffff', '#cfeaff', '#6a9ab8'));
    ctx.fillStyle = '#1c2a3c';
    for (const sx of [-1, 1]) { ellipsePath(ctx, sx * r * 0.36, -r * 0.1, r * 0.25, r * 0.3); ctx.fill(); }
    ctx.fillRect(-r * 0.35, r * 0.45, r * 0.7, r * 0.18);
  } else if (skin === 'star') {
    ctx.rotate(spin * Math.PI * 2 / 5);
    glow(ctx, 0, 0, r * 2.4, '255,240,150', 0.5);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.6 : r * 1.5;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    pf(volume(ctx, 0, 0, r * 1.5, '#ffffff', '#ffe060', '#c08010'));
  } else if (skin === 'fly') {
    ctx.rotate(angle);
    const flap = Math.sin(spin * 6.28 * 3) * 0.5;
    for (const sy of [-1, 1]) {
      ctx.save();
      ctx.rotate(sy * (1.2 + flap));
      ellipsePath(ctx, r * 0.9, 0, r * 0.9, r * 0.4);
      ctx.fillStyle = 'rgba(230,240,230,0.75)'; ctx.fill();
      ctx.restore();
    }
    ellipsePath(ctx, 0, 0, r, r * 0.75);
    pf(volume(ctx, 0, 0, r, '#6a6a50', '#2a2a1a', '#0a0a04'));
    for (const sy of [-1, 1]) { ctx.fillStyle = '#e03030'; ctx.beginPath(); ctx.arc(r * 0.6, sy * r * 0.35, r * 0.28, 0, Math.PI * 2); ctx.fill(); }
  } else if (skin === 'tar') {
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.arc(0, 0, r * 1.05, Math.PI, 0);
    ctx.quadraticCurveTo(r * 0.9, r * 0.9, r * 0.1, r * 1.0);
    ctx.quadraticCurveTo(-r * 0.2, r * 1.6 + spin * r * 0.4, -r * 0.35, r * 0.95);
    ctx.quadraticCurveTo(-r * 1.0, r * 0.8, -r, 0);
    pf(volume(ctx, 0, 0, r * 1.1, '#5a4a6a', '#1a1420', '#000000'));
    glint(ctx, -r * 0.35, -r * 0.45, r * 0.28, 0.8);
    ctx.fillStyle = 'rgba(160,110,200,0.6)';
    ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.2, r * 0.14, 0, Math.PI * 2); ctx.fill();
  } else if (skin === 'bomb') {
    ellipsePath(ctx, 0, 0, r * 1.05, r * 1.05);
    pf(volume(ctx, 0, 0, r * 1.05, '#6a6a70', '#2a2a30', '#08080a'));
    ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = s * 0.02;
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.1); ctx.lineTo(-r * 0.1, r * 0.2); ctx.lineTo(r * 0.3, -r * 0.05); ctx.lineTo(r * 0.55, r * 0.35); ctx.stroke();
    ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath(); ctx.moveTo(r * 0.4, -r * 0.8); ctx.lineTo(r * 0.7, -r * 1.3); ctx.stroke();
    glow(ctx, r * 0.7, -r * 1.35, r * 0.9, '255,200,80', 0.8);
    ctx.fillStyle = spin < 0.5 ? '#fff0a0' : '#ff8a2a';
    ctx.beginPath(); ctx.arc(r * 0.7, -r * 1.35, r * 0.25, 0, Math.PI * 2); ctx.fill();
  } else if (skin === 'void') {
    glow(ctx, 0, 0, r * 2.2, '160,80,255', 0.55);
    ellipsePath(ctx, 0, 0, r * 1.1, r * 1.1);
    pf(volume(ctx, 0, 0, r * 1.1, '#5a3a7a', '#1a0a2a', '#000000'));
    ctx.strokeStyle = '#d8a0ff'; ctx.lineWidth = s * 0.025;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.45, r * 0.45, spin * Math.PI, 0, Math.PI * 2); ctx.stroke();
    glint(ctx, -r * 0.35, -r * 0.4, r * 0.2, 0.6);
  }
  ctx.restore();
}

/** A wall torch: iron bracket and a wrapped stick. The flame is drawn live. */
export function torch(ctx, x, y, s) {
  ink(ctx, s, 0.05);
  ctx.beginPath(); ctx.moveTo(x - 0.12 * s, y + 0.18 * s); ctx.lineTo(x, y + 0.05 * s); ctx.lineTo(x + 0.12 * s, y + 0.18 * s); ctx.stroke();
  ctx.strokeStyle = '#4a4648'; ctx.lineWidth = s * 0.03; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 0.05 * s, y - 0.12 * s); ctx.lineTo(x + 0.05 * s, y - 0.12 * s); ctx.lineTo(x + 0.03 * s, y + 0.12 * s); ctx.lineTo(x - 0.03 * s, y + 0.12 * s); ctx.closePath();
  paint(ctx, s, volume(ctx, x, y, 0.1 * s, '#8a6a48', '#5a3e28', '#2a1a10'), 0.035);
  ctx.fillStyle = '#3a3638';
  ctx.fillRect(x - 0.07 * s, y + 0.04 * s, 0.14 * s, 0.04 * s);
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(x - 0.06 * s, y - 0.16 * s, 0.12 * s, 0.05 * s);
}
