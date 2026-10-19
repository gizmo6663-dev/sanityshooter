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
/** facing: 'down' | 'up' | 'left' | 'right'. moving makes it walk. */
export function hero(ctx, x, y, s, t, { facing = 'down', moving = false } = {}) {
  const step = moving ? Math.sin(t * 12) : 0;
  const bob = moving ? Math.abs(step) * 0.05 * s : Math.sin(t * 2.2) * 0.012 * s;
  const side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  shadow(ctx, x, y, s, 0.34);

  // boots
  for (const [bx, lift] of [[-0.12, step > 0 ? 0.05 : 0], [0.12, step < 0 ? 0.05 : 0]]) {
    ellipsePath(ctx, x + bx * s, y - 0.04 * s - lift * s, 0.09 * s, 0.06 * s);
    paint(ctx, s, volume(ctx, x + bx * s, y - 0.05 * s, 0.09 * s, '#5a3e2c', '#2e1d14', '#160c07'), 0.045);
  }
  const by = y - bob;

  // lantern glow behind everything on its side
  const lx = x + (side === 0 ? 0.33 : side * 0.36) * s, ly = by - 0.27 * s + step * 0.02 * s;
  if (facing !== 'up') glow(ctx, lx, ly, 0.75 * s, '255,175,80', 0.3);

  // cloak body with ragged hem
  const r = rng(11);
  ctx.beginPath();
  ctx.moveTo(x - 0.17 * s, by - 0.55 * s);
  ctx.bezierCurveTo(x - 0.27 * s, by - 0.45 * s, x - 0.34 * s, by - 0.2 * s, x - 0.32 * s, by - 0.1 * s);
  const hem = 9;
  for (let k = 0; k <= hem; k++) {
    const hx = x - 0.32 * s + (k / hem) * 0.64 * s;
    ctx.lineTo(hx, by - (k % 2 ? 0.015 + r() * 0.03 : 0.1 + r() * 0.03) * s);
  }
  ctx.bezierCurveTo(x + 0.34 * s, by - 0.2 * s, x + 0.27 * s, by - 0.45 * s, x + 0.17 * s, by - 0.55 * s);
  ctx.closePath();
  paint(ctx, s, volume(ctx, x - 0.05 * s, by - 0.32 * s, 0.4 * s, '#8a6548', '#654632', '#3a2618'));
  ctx.save();
  ctx.clip();
  // folds
  ctx.strokeStyle = 'rgba(30,14,6,0.45)';
  ctx.lineWidth = s * 0.022;
  for (const fx of [-0.14, 0.02, 0.15]) {
    ctx.beginPath();
    ctx.moveTo(x + fx * s, by - 0.45 * s);
    ctx.quadraticCurveTo(x + (fx + 0.04) * s, by - 0.25 * s, x + (fx - 0.02) * s, by - 0.06 * s);
    ctx.stroke();
  }
  // patch with stitches
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(x - 0.24 * s, by - 0.24 * s, 0.11 * s, 0.1 * s);
  ctx.strokeStyle = 'rgba(30,14,6,0.6)';
  ctx.lineWidth = s * 0.012;
  ctx.strokeRect(x - 0.24 * s, by - 0.24 * s, 0.11 * s, 0.1 * s);
  ctx.setLineDash([s * 0.015, s * 0.02]);
  ctx.strokeStyle = '#d8c090';
  ctx.strokeRect(x - 0.23 * s, by - 0.23 * s, 0.09 * s, 0.08 * s);
  ctx.setLineDash([]);
  // dirt at the hem
  speckle(ctx, x, by - 0.08 * s, 0.3 * s, 0.05 * s, 18, 'rgba(30,18,8,0.4)', s * 0.012, 3);
  ctx.restore();

  // rope belt with knot
  ctx.strokeStyle = INK;
  ctx.lineWidth = s * 0.06;
  ctx.beginPath(); ctx.moveTo(x - 0.24 * s, by - 0.31 * s); ctx.quadraticCurveTo(x, by - 0.25 * s, x + 0.24 * s, by - 0.31 * s); ctx.stroke();
  ctx.strokeStyle = '#b48a52';
  ctx.lineWidth = s * 0.035;
  ctx.stroke();
  ctx.setLineDash([s * 0.02, s * 0.025]);
  ctx.strokeStyle = '#7a5a30';
  ctx.lineWidth = s * 0.012;
  ctx.stroke();
  ctx.setLineDash([]);
  if (facing !== 'up') {
    ink(ctx, s, 0.03);
    ctx.fillStyle = '#b48a52';
    ellipsePath(ctx, x - 0.08 * s, by - 0.27 * s, 0.035 * s, 0.03 * s); ctx.fill(); ctx.stroke();
    ctx.lineWidth = s * 0.025;
    ctx.beginPath(); ctx.moveTo(x - 0.09 * s, by - 0.25 * s); ctx.lineTo(x - 0.11 * s, by - 0.15 * s); ctx.stroke();
  }

  // the lantern
  if (facing !== 'up') {
    ink(ctx, s, 0.035);
    ctx.beginPath(); ctx.arc(lx, ly - 0.1 * s, 0.05 * s, Math.PI, 0); ctx.stroke();
    // frame
    ctx.fillStyle = '#2a2420';
    ctx.beginPath(); ctx.roundRect(lx - 0.075 * s, ly - 0.1 * s, 0.15 * s, 0.03 * s, s * 0.01); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(lx - 0.075 * s, ly + 0.07 * s, 0.15 * s, 0.03 * s, s * 0.01); ctx.fill(); ctx.stroke();
    const gl = ctx.createLinearGradient(lx, ly - 0.07 * s, lx, ly + 0.07 * s);
    gl.addColorStop(0, '#ffe9a8'); gl.addColorStop(1, '#ff9a3a');
    ctx.fillStyle = gl;
    ctx.fillRect(lx - 0.06 * s, ly - 0.07 * s, 0.12 * s, 0.14 * s);
    ctx.strokeRect(lx - 0.06 * s, ly - 0.07 * s, 0.12 * s, 0.14 * s);
    ctx.beginPath(); ctx.moveTo(lx, ly - 0.07 * s); ctx.lineTo(lx, ly + 0.07 * s); ctx.stroke();
    // flame
    const fl = 1 + Math.sin(t * 17) * 0.12;
    ctx.fillStyle = '#fff6d0';
    ctx.beginPath();
    ctx.moveTo(lx, ly - 0.05 * s * fl);
    ctx.quadraticCurveTo(lx + 0.03 * s, ly + 0.01 * s, lx, ly + 0.03 * s);
    ctx.quadraticCurveTo(lx - 0.03 * s, ly + 0.01 * s, lx, ly - 0.05 * s * fl);
    ctx.fill();
    // hand holding it
    ellipsePath(ctx, lx, ly - 0.15 * s, 0.045 * s, 0.04 * s);
    paint(ctx, s, '#e9d2be', 0.035);
  }
  // the other hand peeking out of the sleeve
  if (facing === 'down') {
    ellipsePath(ctx, x - 0.29 * s, by - 0.24 * s, 0.045 * s, 0.04 * s);
    paint(ctx, s, '#e9d2be', 0.035);
  }

  // --- head in a hood ---
  const hy = by - 0.84 * s;
  const fx = side * 0.07 * s;
  const HOOD_L = '#7e5a40', HOOD = '#5c3f2c', HOOD_D = '#2e1c11';
  // hood shell with a floppy point
  ctx.beginPath();
  ctx.moveTo(x - 0.45 * s, hy + 0.14 * s);
  ctx.bezierCurveTo(x - 0.54 * s, hy - 0.3 * s, x - 0.24 * s, hy - 0.52 * s, x + 0.02 * s, hy - 0.5 * s);
  ctx.bezierCurveTo(x + 0.22 * s, hy - 0.5 * s, x + 0.36 * s, hy - 0.62 * s, x + 0.5 * s - side * 0.15 * s, hy - 0.66 * s);
  ctx.bezierCurveTo(x + 0.44 * s, hy - 0.5 * s, x + 0.5 * s, hy - 0.3 * s, x + 0.47 * s, hy - 0.05 * s);
  ctx.bezierCurveTo(x + 0.46 * s, hy + 0.26 * s, x + 0.2 * s, hy + 0.33 * s, x, hy + 0.33 * s);
  ctx.bezierCurveTo(x - 0.24 * s, hy + 0.33 * s, x - 0.44 * s, hy + 0.28 * s, x - 0.45 * s, hy + 0.14 * s);
  ctx.closePath();
  paint(ctx, s, volume(ctx, x - 0.05 * s, hy - 0.08 * s, 0.5 * s, HOOD_L, HOOD, HOOD_D), 0.065);
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(25,12,5,0.45)';
  ctx.lineWidth = s * 0.02;
  ctx.beginPath(); ctx.moveTo(x + 0.05 * s, hy - 0.48 * s); ctx.quadraticCurveTo(x + 0.3 * s, hy - 0.3 * s, x + 0.4 * s, hy + 0.05 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 0.1 * s, hy - 0.46 * s); ctx.quadraticCurveTo(x - 0.38 * s, hy - 0.25 * s, x - 0.4 * s, hy + 0.1 * s); ctx.stroke();
  // seam with stitches over the top
  ctx.setLineDash([s * 0.018, s * 0.022]);
  ctx.strokeStyle = 'rgba(220,190,140,0.55)';
  ctx.lineWidth = s * 0.012;
  ctx.beginPath(); ctx.moveTo(x - 0.05 * s, hy - 0.5 * s); ctx.quadraticCurveTo(x + 0.2 * s, hy - 0.52 * s, x + 0.45 * s - side * 0.15 * s, hy - 0.64 * s); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  if (facing === 'up') {
    // back of the hood: a deep fold down the middle
    ctx.strokeStyle = 'rgba(25,12,5,0.5)';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath(); ctx.moveTo(x, hy - 0.45 * s); ctx.quadraticCurveTo(x - 0.04 * s, hy - 0.05 * s, x, hy + 0.3 * s); ctx.stroke();
    glow(ctx, x + 0.35 * s, by - 0.3 * s, 0.5 * s, '255,175,80', 0.18);
    return;
  }
  // dark inside of the hood framing the face
  ellipsePath(ctx, x + fx, hy + 0.03 * s, 0.37 * s, 0.33 * s);
  ctx.fillStyle = '#140a05';
  ctx.fill();
  // face
  ellipsePath(ctx, x + fx * 1.1, hy + 0.05 * s, 0.32 * s, 0.29 * s);
  ctx.fillStyle = volume(ctx, x + fx, hy + 0.02 * s, 0.33 * s, '#fff2e4', '#f0dac6', '#c8a48c');
  ctx.fill();
  ink(ctx, s, 0.035);
  ctx.stroke();
  // hair strands under the hood rim
  ctx.fillStyle = '#2a1a10';
  for (let k = 0; k < 5; k++) {
    const hx = x + fx + (k - 2) * 0.1 * s;
    ctx.beginPath();
    ctx.moveTo(hx - 0.06 * s, hy - 0.2 * s);
    ctx.quadraticCurveTo(hx + 0.01 * s, hy - 0.08 * s + (k % 2) * 0.02 * s, hx + 0.05 * s, hy - 0.18 * s);
    ctx.fill();
  }
  // cheeks
  for (const sx of [-1, 1]) {
    const gc = ctx.createRadialGradient(x + fx + sx * 0.18 * s, hy + 0.13 * s, 0, x + fx + sx * 0.18 * s, hy + 0.13 * s, 0.08 * s);
    gc.addColorStop(0, 'rgba(220,120,110,0.5)'); gc.addColorStop(1, 'rgba(220,120,110,0)');
    ctx.fillStyle = gc;
    ctx.fillRect(x + fx + sx * 0.18 * s - 0.08 * s, hy + 0.05 * s, 0.16 * s, 0.16 * s);
  }
  // eyes: big, dark, wet
  const eyes = side === 0 ? [-0.12, 0.12] : side < 0 ? [-0.19, 0.02] : [-0.02, 0.19];
  for (const ex of eyes) {
    const exx = x + ex * s + fx * 0.6, eyy = hy + 0.03 * s;
    // tired rings
    ellipsePath(ctx, exx, eyy + 0.035 * s, 0.1 * s, 0.11 * s);
    ctx.fillStyle = 'rgba(120,70,90,0.22)';
    ctx.fill();
    ellipsePath(ctx, exx, eyy, 0.085 * s, 0.105 * s);
    const ge = ctx.createRadialGradient(exx - 0.02 * s, eyy - 0.03 * s, 0, exx, eyy, 0.1 * s);
    ge.addColorStop(0, '#3a2a30'); ge.addColorStop(1, '#0a0506');
    ctx.fillStyle = ge;
    ctx.fill();
    glint(ctx, exx + 0.03 * s, eyy - 0.04 * s, 0.028 * s);
    glint(ctx, exx - 0.025 * s, eyy + 0.04 * s, 0.012 * s, 0.6);
  }
  // worried brows
  ctx.strokeStyle = '#2a1810';
  ctx.lineWidth = s * 0.025;
  for (const ex of eyes) {
    const sx = Math.sign(ex) || 1;
    const bx = x + ex * s + fx * 0.6;
    ctx.beginPath();
    ctx.moveTo(bx - 0.07 * s, hy - 0.1 * s + (sx > 0 ? 0.025 : -0.005) * s);
    ctx.quadraticCurveTo(bx, hy - 0.13 * s, bx + 0.07 * s, hy - 0.1 * s + (sx > 0 ? -0.005 : 0.025) * s);
    ctx.stroke();
  }
  // small unhappy mouth
  ctx.strokeStyle = '#4a2018';
  ctx.lineWidth = s * 0.022;
  ctx.beginPath();
  ctx.arc(x + fx * 0.8, hy + 0.23 * s, 0.045 * s, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();
  // hood rim over the forehead, with a lit edge
  ctx.beginPath();
  ctx.moveTo(x - 0.39 * s + fx, hy + 0.0 * s);
  ctx.bezierCurveTo(x - 0.3 * s + fx, hy - 0.36 * s, x + 0.3 * s + fx, hy - 0.36 * s, x + 0.39 * s + fx, hy + 0.0 * s);
  ctx.bezierCurveTo(x + 0.28 * s + fx, hy - 0.22 * s, x - 0.28 * s + fx, hy - 0.22 * s, x - 0.39 * s + fx, hy + 0.0 * s);
  paint(ctx, s, volume(ctx, x + fx, hy - 0.2 * s, 0.35 * s, HOOD_L, HOOD, HOOD_D), 0.05);
  ctx.strokeStyle = 'rgba(255,220,170,0.25)';
  ctx.lineWidth = s * 0.015;
  ctx.beginPath(); ctx.moveTo(x - 0.25 * s + fx, hy - 0.24 * s); ctx.quadraticCurveTo(x + fx, hy - 0.33 * s, x + 0.2 * s + fx, hy - 0.25 * s); ctx.stroke();
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

export function xpGem(ctx, x, y, s) {
  const r = 0.09 * s, cy = y - 0.2 * s;
  ctx.beginPath();
  ctx.moveTo(x, cy - r * 1.4); ctx.lineTo(x + r, cy); ctx.lineTo(x, cy + r * 1.4); ctx.lineTo(x - r, cy); ctx.closePath();
  ctx.fillStyle = volume(ctx, x, cy, r * 1.4, '#e8fff4', '#5ae0a0', '#1a6a4a');
  ctx.fill();
  ink(ctx, s, 0.03);
  ctx.stroke();
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
