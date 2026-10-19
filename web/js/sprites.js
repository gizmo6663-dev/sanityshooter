// Hand-drawn style sprites, painted with Canvas 2D: thick dark outlines,
// flat fills with one shadow tone and one highlight, big heads. Every
// function draws at (x, y) = the point on the floor under the figure, with
// `s` pixels per world unit and `t` the animation time in seconds.

const INK = '#1c100b';

function ink(ctx, s, w = 0.07) {
  ctx.lineWidth = Math.max(1.5, s * w);
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function ellipse(ctx, x, y, rx, ry, fill, stroke = true, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) ctx.stroke();
}

export function shadow(ctx, x, y, s, r = 0.35, a = 0.35) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, r * s, r * s * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

// --- Hero ------------------------------------------------------------------
/** facing: 'down' | 'up' | 'left' | 'right'. moving makes it walk. */
export function hero(ctx, x, y, s, t, { facing = 'down', moving = false } = {}) {
  ink(ctx, s);
  const step = moving ? Math.sin(t * 12) : 0;
  const bob = moving ? Math.abs(step) * 0.05 * s : Math.sin(t * 2) * 0.01 * s;
  shadow(ctx, x, y, s, 0.32);
  // feet
  ellipse(ctx, x - 0.12 * s, y - 0.03 * s + (step > 0 ? -0.05 * s : 0), 0.08 * s, 0.05 * s, '#2a1a12');
  ellipse(ctx, x + 0.12 * s, y - 0.03 * s + (step < 0 ? -0.05 * s : 0), 0.08 * s, 0.05 * s, '#2a1a12');
  const by = y - bob;
  // cloak with a ragged hem
  ctx.beginPath();
  ctx.moveTo(x - 0.18 * s, by - 0.52 * s);
  ctx.quadraticCurveTo(x - 0.3 * s, by - 0.25 * s, x - 0.3 * s, by - 0.08 * s);
  for (let k = 0; k <= 6; k++) {
    const hx = x - 0.3 * s + (k / 6) * 0.6 * s;
    ctx.lineTo(hx, by - (k % 2 ? 0.02 : 0.1) * s);
  }
  ctx.quadraticCurveTo(x + 0.3 * s, by - 0.25 * s, x + 0.18 * s, by - 0.52 * s);
  ctx.closePath();
  ctx.fillStyle = '#6b4c36';
  ctx.fill();
  ctx.stroke();
  // cloak shading
  ctx.fillStyle = 'rgba(40,20,10,0.35)';
  ctx.beginPath();
  ctx.moveTo(x + 0.05 * s, by - 0.5 * s);
  ctx.quadraticCurveTo(x + 0.28 * s, by - 0.25 * s, x + 0.26 * s, by - 0.1 * s);
  ctx.lineTo(x + 0.08 * s, by - 0.08 * s);
  ctx.closePath();
  ctx.fill();
  // rope belt
  ctx.strokeStyle = '#a07a48';
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  ctx.moveTo(x - 0.22 * s, by - 0.3 * s);
  ctx.quadraticCurveTo(x, by - 0.25 * s, x + 0.22 * s, by - 0.3 * s);
  ctx.stroke();
  ink(ctx, s);
  // lantern hand
  if (facing !== 'up') {
    const lx = x + (facing === 'left' ? -0.32 : 0.32) * s, ly = by - 0.25 * s + step * 0.02 * s;
    ctx.fillStyle = 'rgba(255,190,90,0.25)';
    ctx.beginPath(); ctx.arc(lx, ly, 0.22 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(lx - 0.06 * s, ly - 0.07 * s, 0.12 * s, 0.13 * s);
    ctx.strokeRect(lx - 0.06 * s, ly - 0.07 * s, 0.12 * s, 0.13 * s);
    ctx.beginPath(); ctx.moveTo(lx, ly - 0.07 * s); ctx.lineTo(lx, ly - 0.14 * s); ctx.stroke();
  }
  // head: big, inside a hood
  const hy = by - 0.82 * s;
  const hood = '#5a3e2b';
  // hood back + point
  ctx.beginPath();
  ctx.moveTo(x - 0.44 * s, hy + 0.12 * s);
  ctx.quadraticCurveTo(x - 0.5 * s, hy - 0.42 * s, x - 0.05 * s, hy - 0.48 * s);
  ctx.quadraticCurveTo(x + 0.25 * s, hy - 0.56 * s, x + 0.42 * s, hy - 0.62 * s);
  ctx.quadraticCurveTo(x + 0.38 * s, hy - 0.4 * s, x + 0.46 * s, hy - 0.1 * s);
  ctx.quadraticCurveTo(x + 0.44 * s, hy + 0.25 * s, x, hy + 0.3 * s);
  ctx.quadraticCurveTo(x - 0.42 * s, hy + 0.28 * s, x - 0.44 * s, hy + 0.12 * s);
  ctx.closePath();
  ctx.fillStyle = hood;
  ctx.fill();
  ctx.stroke();
  if (facing === 'up') {
    ctx.fillStyle = 'rgba(30,15,8,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, hy - 0.05 * s, 0.28 * s, 0.25 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const fx = facing === 'left' ? -0.07 * s : facing === 'right' ? 0.07 * s : 0;
  // face
  ellipse(ctx, x + fx, hy + 0.02 * s, 0.33 * s, 0.3 * s, '#f1dccb');
  ctx.fillStyle = 'rgba(200,150,130,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + fx, hy + 0.18 * s, 0.28 * s, 0.12 * s, 0, 0, Math.PI);
  ctx.fill();
  // eyes
  const eyes = facing === 'down' ? [-0.12, 0.12] : facing === 'left' ? [-0.18, 0.02] : [-0.02, 0.18];
  for (const ex of eyes) {
    ellipse(ctx, x + ex * s + fx * 0.5, hy, 0.085 * s, 0.11 * s, '#120a08', false);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + ex * s + fx * 0.5 + 0.03 * s, hy - 0.04 * s, 0.028 * s, 0, Math.PI * 2); ctx.fill();
  }
  // brows: a little worried
  ctx.lineWidth = s * 0.03;
  for (const ex of eyes) {
    const sx = Math.sign(ex) || 1;
    ctx.beginPath();
    ctx.moveTo(x + ex * s + fx * 0.5 - 0.07 * s, hy - 0.15 * s + (sx > 0 ? 0.03 : 0) * s);
    ctx.lineTo(x + ex * s + fx * 0.5 + 0.07 * s, hy - 0.15 * s + (sx > 0 ? 0 : 0.03) * s);
    ctx.stroke();
  }
  // mouth
  ctx.beginPath();
  ctx.arc(x + fx * 0.6, hy + 0.17 * s, 0.05 * s, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  // hood rim over the forehead
  ink(ctx, s);
  ctx.beginPath();
  ctx.moveTo(x - 0.36 * s + fx, hy - 0.05 * s);
  ctx.quadraticCurveTo(x + fx, hy - 0.42 * s, x + 0.36 * s + fx, hy - 0.05 * s);
  ctx.quadraticCurveTo(x + fx, hy - 0.3 * s, x - 0.36 * s + fx, hy - 0.05 * s);
  ctx.fillStyle = hood;
  ctx.fill();
  ctx.stroke();
}

// --- Enemies -------------------------------------------------------------------
export function fly(ctx, x, y, s, t) {
  ink(ctx, s, 0.05);
  const hy = y - 0.8 * s + Math.sin(t * 7) * 0.06 * s;
  shadow(ctx, x, y, s, 0.18, 0.25);
  const flap = Math.sin(t * 50) * 0.5;
  ctx.fillStyle = 'rgba(220,225,215,0.6)';
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(x + sx * 0.08 * s, hy - 0.08 * s);
    ctx.rotate(sx * (0.6 + flap));
    ctx.beginPath();
    ctx.ellipse(sx * 0.12 * s, -0.04 * s, 0.14 * s, 0.07 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ellipse(ctx, x, hy, 0.17 * s, 0.15 * s, '#2a2620');
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.arc(x - 0.06 * s, hy - 0.06 * s, 0.05 * s, 0, Math.PI * 2); ctx.fill();
  for (const sx of [-1, 1]) ellipse(ctx, x + sx * 0.07 * s, hy + 0.01 * s, 0.05 * s, 0.055 * s, '#c02020', false);
}

export function grub(ctx, x, y, s, t) {
  ink(ctx, s, 0.06);
  shadow(ctx, x, y, s, 0.4, 0.3);
  for (let k = 4; k >= 0; k--) {
    const w = 0.24 - k * 0.025;
    const sx = x + Math.sin(t * 5 - k) * 0.05 * s;
    const sy = y - 0.18 * s - k * 0.15 * s;
    ellipse(ctx, sx, sy, w * s, w * 0.8 * s, k % 2 ? '#d7c8a0' : '#e6d8b2');
    if (k === 0) {
      ellipse(ctx, sx, sy + 0.02 * s, 0.09 * s, 0.07 * s, '#4a1010');
      ctx.fillStyle = '#e8e0c8';
      for (const tx of [-0.04, 0, 0.04]) { ctx.beginPath(); ctx.moveTo(sx + tx * s - 0.015 * s, sy - 0.03 * s); ctx.lineTo(sx + tx * s + 0.015 * s, sy - 0.03 * s); ctx.lineTo(sx + tx * s, sy + 0.01 * s); ctx.fill(); }
    }
  }
}

export function eyeball(ctx, x, y, s, t, { look = [0, 1] } = {}) {
  ink(ctx, s, 0.06);
  const hy = y - 0.95 * s + Math.sin(t * 2.5) * 0.08 * s;
  shadow(ctx, x, y, s, 0.28, 0.25);
  // dangling nerve
  ctx.strokeStyle = '#7a1a1a';
  ctx.lineWidth = s * 0.06;
  ctx.beginPath();
  ctx.moveTo(x, hy + 0.25 * s);
  ctx.quadraticCurveTo(x + Math.sin(t * 3) * 0.12 * s, hy + 0.45 * s, x - 0.05 * s, hy + 0.6 * s);
  ctx.stroke();
  ink(ctx, s, 0.06);
  ellipse(ctx, x, hy, 0.3 * s, 0.3 * s, '#efe6d8');
  ctx.strokeStyle = 'rgba(180,30,30,0.7)';
  ctx.lineWidth = s * 0.015;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 0.28 * s, hy + Math.sin(a) * 0.28 * s);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.2) * 0.2 * s, hy + Math.sin(a + 0.2) * 0.2 * s, x + Math.cos(a) * 0.14 * s, hy + Math.sin(a) * 0.14 * s);
    ctx.stroke();
  }
  ink(ctx, s, 0.05);
  const ix = x + look[0] * 0.08 * s, iy = hy + look[1] * 0.08 * s;
  ellipse(ctx, ix, iy, 0.14 * s, 0.14 * s, '#b0662a');
  ellipse(ctx, ix, iy, 0.07 * s, 0.07 * s, '#100806', false);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(ix + 0.04 * s, iy - 0.05 * s, 0.03 * s, 0, Math.PI * 2); ctx.fill();
}

export function ram(ctx, x, y, s, t) {
  ink(ctx, s, 0.06);
  shadow(ctx, x, y, s, 0.36, 0.3);
  const by = y - 0.05 * s + Math.abs(Math.sin(t * 8)) * 0.03 * s;
  // legs
  ctx.lineWidth = s * 0.06;
  for (const lx of [-0.18, -0.06, 0.06, 0.18]) {
    ctx.beginPath(); ctx.moveTo(x + lx * s, by - 0.25 * s); ctx.lineTo(x + lx * s * 1.1, by); ctx.stroke();
  }
  ink(ctx, s, 0.06);
  // ribcage
  ellipse(ctx, x, by - 0.35 * s, 0.28 * s, 0.17 * s, '#3a2a22');
  ctx.strokeStyle = '#e6dcc4';
  ctx.lineWidth = s * 0.045;
  for (const rx of [-0.16, -0.06, 0.04, 0.14]) {
    ctx.beginPath(); ctx.arc(x + rx * s, by - 0.36 * s, 0.13 * s, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  }
  ink(ctx, s, 0.06);
  // skull with curled horns
  const hy = by - 0.65 * s;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + sx * 0.24 * s, hy - 0.05 * s, 0.13 * s, sx > 0 ? -Math.PI * 0.6 : Math.PI * 1.6, sx > 0 ? Math.PI * 0.9 : Math.PI * 0.1, sx < 0);
    ctx.lineWidth = s * 0.09;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.lineWidth = s * 0.055;
    ctx.strokeStyle = '#8a7a62';
    ctx.stroke();
  }
  ink(ctx, s, 0.06);
  ctx.beginPath();
  ctx.moveTo(x - 0.2 * s, hy - 0.1 * s);
  ctx.quadraticCurveTo(x, hy - 0.32 * s, x + 0.2 * s, hy - 0.1 * s);
  ctx.quadraticCurveTo(x + 0.2 * s, hy + 0.12 * s, x + 0.09 * s, hy + 0.24 * s);
  ctx.lineTo(x - 0.09 * s, hy + 0.24 * s);
  ctx.quadraticCurveTo(x - 0.2 * s, hy + 0.12 * s, x - 0.2 * s, hy - 0.1 * s);
  ctx.fillStyle = '#ece2ca';
  ctx.fill();
  ctx.stroke();
  for (const sx of [-1, 1]) {
    ellipse(ctx, x + sx * 0.08 * s, hy - 0.02 * s, 0.06 * s, 0.07 * s, '#120806', false);
    ctx.fillStyle = '#ff4a20';
    ctx.beginPath(); ctx.arc(x + sx * 0.08 * s, hy - 0.01 * s, 0.022 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#120806';
  ctx.fillRect(x - 0.06 * s, hy + 0.14 * s, 0.12 * s, 0.03 * s);
}

export function slime(ctx, x, y, s, t, { small = false } = {}) {
  const k = small ? 0.62 : 1;
  ink(ctx, s, 0.06);
  shadow(ctx, x, y, s, 0.42 * k, 0.3);
  const sq = 1 + Math.sin(t * 6) * 0.06;
  const w = 0.42 * k * s / sq, h = 0.42 * k * s * sq;
  ctx.beginPath();
  ctx.moveTo(x - w, y - 0.03 * s);
  ctx.quadraticCurveTo(x - w * 1.05, y - h * 1.3, x, y - h * 1.45);
  ctx.quadraticCurveTo(x + w * 1.05, y - h * 1.3, x + w, y - 0.03 * s);
  ctx.quadraticCurveTo(x, y + 0.04 * s, x - w, y - 0.03 * s);
  ctx.fillStyle = 'rgba(110,150,50,0.92)';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(200,240,140,0.35)';
  ctx.beginPath(); ctx.ellipse(x - w * 0.4, y - h * 1.05, w * 0.22, h * 0.18, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(40,60,10,0.4)';
  ctx.beginPath(); ctx.arc(x + w * 0.35, y - h * 0.5, w * 0.12, 0, Math.PI * 2); ctx.fill();
  for (const sx of [-1, 1]) {
    ellipse(ctx, x + sx * w * 0.32, y - h * 0.82, 0.07 * k * s, 0.08 * k * s, '#f2ecd0');
    ellipse(ctx, x + sx * w * 0.32, y - h * 0.8, 0.035 * k * s, 0.04 * k * s, '#100a04', false);
  }
}

export function bloat(ctx, x, y, s, t) {
  ink(ctx, s, 0.08);
  shadow(ctx, x, y, s, 1.2, 0.4);
  const p = 1 + Math.sin(t * 3) * 0.03;
  const cx = x, cy = y - 1.05 * s;
  ellipse(ctx, cx, cy, 1.15 * s * p, 1.0 * s / p, '#a8706a');
  // shading
  ctx.fillStyle = 'rgba(80,30,30,0.3)';
  ctx.beginPath(); ctx.ellipse(cx + 0.3 * s, cy + 0.3 * s, 0.85 * s, 0.6 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,220,210,0.18)';
  ctx.beginPath(); ctx.ellipse(cx - 0.45 * s, cy - 0.5 * s, 0.35 * s, 0.22 * s, -0.4, 0, Math.PI * 2); ctx.fill();
  // veins
  ctx.strokeStyle = 'rgba(110,20,40,0.6)';
  ctx.lineWidth = s * 0.03;
  for (let k = 0; k < 6; k++) {
    const a = k * 1.1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 0.9 * s, cy + Math.sin(a) * 0.8 * s);
    ctx.quadraticCurveTo(cx + Math.cos(a + 0.4) * 0.6 * s, cy + Math.sin(a + 0.4) * 0.5 * s, cx + Math.cos(a + 0.2) * 0.4 * s, cy + Math.sin(a + 0.2) * 0.3 * s);
    ctx.stroke();
  }
  ink(ctx, s, 0.06);
  // lumps
  for (const [lx, ly, r] of [[-0.85, -0.55, 0.25], [0.9, -0.35, 0.22], [0.7, 0.55, 0.2], [-0.95, 0.3, 0.18]]) {
    ellipse(ctx, cx + lx * s, cy + ly * s, r * s, r * 0.9 * s, '#9a625c');
  }
  // eyes
  for (const [ex, ey, r] of [[-0.35, -0.35, 0.17], [0.3, -0.42, 0.14], [0.05, -0.65, 0.1], [0.62, -0.05, 0.1], [-0.65, -0.05, 0.09]]) {
    ellipse(ctx, cx + ex * s, cy + ey * s, r * s, r * s, '#efe4d4');
    ellipse(ctx, cx + ex * s, cy + ey * s + r * 0.15 * s, r * 0.55 * s, r * 0.55 * s, '#8a1818', false);
    ellipse(ctx, cx + ex * s, cy + ey * s + r * 0.15 * s, r * 0.25 * s, r * 0.25 * s, '#100606', false);
  }
  // mouth
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.3 * s, 0.55 * s, 0.28 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#2a0608';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#efe6d0';
  for (let k = 0; k < 7; k++) {
    const tx = cx - 0.42 * s + k * 0.14 * s;
    ctx.beginPath(); ctx.moveTo(tx - 0.05 * s, cy + 0.08 * s); ctx.lineTo(tx + 0.05 * s, cy + 0.08 * s); ctx.lineTo(tx, cy + 0.22 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 0.04 * s, cy + 0.52 * s); ctx.lineTo(tx + 0.04 * s, cy + 0.52 * s); ctx.lineTo(tx + 0.02 * s, cy + 0.4 * s); ctx.fill();
  }
  ctx.fillStyle = '#8a1a1a';
  ctx.beginPath(); ctx.ellipse(cx + 0.1 * s, cy + 0.42 * s, 0.2 * s, 0.07 * s, 0, 0, Math.PI * 2); ctx.fill();
}

// --- Things on the floor ----------------------------------------------------------
export function tear(ctx, x, y, s, { color = '#9fd2ff', size = 0.15, enemy = false } = {}) {
  ink(ctx, s, 0.04);
  const r = size * s;
  shadow(ctx, x, y + 0.5 * s, s, size * 0.9, 0.25);
  ellipse(ctx, x, y, r, r, enemy ? '#b0181c' : color);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
}

export function heart(ctx, x, y, s, { half = false } = {}) {
  ink(ctx, s, 0.05);
  const k = 0.32 * s;
  shadow(ctx, x, y, s, 0.22, 0.3);
  const hy = y - 0.3 * s;
  ctx.beginPath();
  ctx.moveTo(x, hy + k * 0.8);
  ctx.bezierCurveTo(x - k * 1.1, hy + k * 0.1, x - k * 0.9, hy - k * 0.8, x, hy - k * 0.35);
  ctx.bezierCurveTo(x + k * 0.9, hy - k * 0.8, x + k * 1.1, hy + k * 0.1, x, hy + k * 0.8);
  ctx.fillStyle = '#d0202a';
  ctx.fill();
  if (half) {
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#3a1416';
    ctx.fillRect(x, hy - k, k * 1.2, k * 2);
    ctx.restore();
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(x - k * 0.45, hy - k * 0.3, k * 0.18, k * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
}

export function coin(ctx, x, y, s, t) {
  ink(ctx, s, 0.05);
  shadow(ctx, x, y, s, 0.16, 0.3);
  const w = Math.abs(Math.cos(t * 3)) * 0.14 + 0.03;
  ellipse(ctx, x, y - 0.2 * s, w * s, 0.15 * s, '#e8b840');
  ctx.fillStyle = 'rgba(255,250,200,0.6)';
  ctx.fillRect(x - w * 0.3 * s, y - 0.3 * s, w * 0.25 * s, 0.12 * s);
}

export function rock(ctx, x, y, s, seed = 1) {
  ink(ctx, s, 0.06);
  const r = (n) => { const v = Math.sin(seed * 91.7 + n * 12.9) * 43758.5; return v - Math.floor(v); };
  const cy = y - 0.3 * s;
  shadow(ctx, x, y, s, 0.48, 0.35);
  const outline = () => {
    ctx.beginPath();
    const pts = 10;
    for (let k = 0; k <= pts; k++) {
      const a = (k / pts) * Math.PI * 2;
      const rr = (0.42 + r(k % pts) * 0.08) * s;
      const px = x + Math.cos(a) * rr * 1.05, py = cy + Math.sin(a) * rr * (Math.sin(a) > 0 ? 0.62 : 0.8);
      if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  outline();
  ctx.fillStyle = '#8a7e72';
  ctx.fill();
  ctx.save();
  outline();
  ctx.clip();
  ctx.fillStyle = 'rgba(30,20,15,0.38)';
  ctx.beginPath(); ctx.ellipse(x + 0.12 * s, cy + 0.3 * s, 0.55 * s, 0.32 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,245,230,0.25)';
  ctx.beginPath(); ctx.ellipse(x - 0.14 * s, cy - 0.16 * s, 0.2 * s, 0.11 * s, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  outline();
  ctx.stroke();
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(x + 0.1 * s, cy - 0.3 * s); ctx.lineTo(x + 0.15 * s, cy - 0.12 * s); ctx.lineTo(x + 0.08 * s, cy + 0.02 * s);
  ctx.stroke();
}

export function pedestal(ctx, x, y, s) {
  ink(ctx, s, 0.06);
  shadow(ctx, x, y, s, 0.42, 0.35);
  ctx.fillStyle = '#8a8076';
  ctx.beginPath();
  ctx.moveTo(x - 0.32 * s, y - 0.02 * s); ctx.lineTo(x - 0.26 * s, y - 0.5 * s); ctx.lineTo(x + 0.26 * s, y - 0.5 * s); ctx.lineTo(x + 0.32 * s, y - 0.02 * s);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ellipse(ctx, x, y - 0.5 * s, 0.32 * s, 0.1 * s, '#a49a8e');
}

export function bloodSplat(ctx, x, y, s, seed = 1, color = 'rgba(140,14,18,0.85)') {
  const r = (n) => { const v = Math.sin(seed * 51.3 + n * 7.7) * 43758.5; return v - Math.floor(v); };
  ctx.fillStyle = color;
  for (let k = 0; k < 7; k++) {
    ctx.beginPath();
    ctx.ellipse(x + (r(k) - 0.5) * 0.7 * s, y + (r(k + 9) - 0.5) * 0.4 * s, (0.08 + r(k + 3) * 0.16) * s, (0.05 + r(k + 5) * 0.08) * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
