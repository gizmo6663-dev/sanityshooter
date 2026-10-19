// Paints a dungeon room in the drawn style: walls in perspective built from
// individually shaded stones, arched doorways, a flagstone floor with cracks,
// moss and grime, and shadow pooling along the walls. Pure Canvas 2D, so it
// can be baked into a texture once per room.

import { rng, INK, cobweb, chain } from './sprites.js';

function stone(ctx, x, y, rx, ry, r, tint, light) {
  const v = 0.8 + r() * 0.4;
  const [cr, cg, cb] = tint;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, (r() - 0.5) * 0.6, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.45, 1, x, y, Math.max(rx, ry) * 1.15);
  g.addColorStop(0, `rgb(${cr * v * 1.35 * light},${cg * v * 1.35 * light},${cb * v * 1.35 * light})`);
  g.addColorStop(0.55, `rgb(${cr * v * light},${cg * v * light},${cb * v * light})`);
  g.addColorStop(1, `rgb(${cr * v * 0.45},${cg * v * 0.45},${cb * v * 0.45})`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Fills a clipped polygon with rows of rounded stones. */
function stoneWall(ctx, poly, bounds, r, tint, size, light = 1) {
  ctx.save();
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  const [x0, y0, x1, y1] = bounds;
  ctx.fillStyle = '#140c08';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const rowH = size * 0.75;
  for (let y = y0; y < y1 + rowH; y += rowH) {
    let x = x0 - r() * size;
    while (x < x1 + size) {
      const w = size * (0.7 + r() * 0.6);
      stone(ctx, x + w / 2, y + (r() - 0.5) * 3, w / 2 - 1, rowH / 2 + 1, r, tint, light);
      x += w;
    }
  }
  ctx.restore();
}

/**
 * room: { s, ox, oy, w, d, doors: {n,s,e,w}, tiles (Uint8Array w*d), seed,
 *         doorStyle: {n,s,e,w} -> 'normal'|'boss'|'treasure', tint }
 * Draws the floor and walls; returns the wall thickness used.
 */
export function drawRoom(ctx, room) {
  const { s, ox, oy, w, d, doors, seed = 1 } = room;
  const tint = room.tint || [128, 96, 72];
  const r = rng(seed);
  const rw = w * s, rd = d * s;
  const top = 1.8 * s, side = 0.6 * s, bot = 0.9 * s;

  // --- floor ---
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, rw, rd);
  ctx.clip();
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(ox, oy, rw, rd);
  const fs = s * 1.5;
  for (let j = -1; j < rd / fs + 1; j++) {
    for (let i = -1; i < rw / fs + 1; i++) {
      const v = 0.78 + r() * 0.34;
      const gap = Math.max(1, fs * 0.04);
      const x = ox + i * fs + (j % 2 ? fs / 2 : 0) + gap + (r() - 0.5) * gap;
      const y = oy + j * fs + gap + (r() - 0.5) * gap;
      const sw = fs - gap * 2 - r() * gap * 1.5, sh = fs - gap * 2 - r() * gap * 1.5;
      const c = (k) => Math.round(tint[k] * v);
      ctx.beginPath();
      ctx.roundRect(x, y, sw, sh, fs * (0.06 + r() * 0.06));
      const g = ctx.createLinearGradient(x, y, x + sw * 0.3, y + sh);
      g.addColorStop(0, `rgb(${c(0) * 1.15},${c(1) * 1.15},${c(2) * 1.15})`);
      g.addColorStop(1, `rgb(${c(0) * 0.8},${c(1) * 0.8},${c(2) * 0.8})`);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(26,14,9,0.75)';
      ctx.lineWidth = Math.max(1, fs * 0.05);
      ctx.stroke();
      // worn bevel: light top edge, dark bottom edge
      ctx.strokeStyle = 'rgba(255,235,205,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 6, y + 3); ctx.lineTo(x + sw - 6, y + 3); ctx.stroke();
      ctx.strokeStyle = 'rgba(20,10,5,0.3)';
      ctx.beginPath(); ctx.moveTo(x + 6, y + sh - 2); ctx.lineTo(x + sw - 6, y + sh - 2); ctx.stroke();
      // cracks and chips
      if (r() < 0.35) {
        ctx.strokeStyle = 'rgba(25,12,6,0.65)';
        ctx.lineWidth = 1.6;
        let cx = x + r() * sw, cy = y + r() * sh;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        for (let k = 0; k < 4; k++) { cx += (r() - 0.5) * fs * 0.35; cy += (r() - 0.3) * fs * 0.3; ctx.lineTo(cx, cy); }
        ctx.stroke();
      }
      // grit
      for (let k = 0; k < 8; k++) {
        ctx.fillStyle = `rgba(20,10,5,${0.15 + r() * 0.2})`;
        ctx.fillRect(x + r() * sw, y + r() * sh, 1.5 + r() * 2, 1.5 + r() * 2);
      }
    }
  }
  // moss creeping in the mortar and corners
  for (let k = 0; k < 5; k++) {
    const mx = ox + r() * rw, my = oy + (r() < 0.5 ? r() * s * 1.5 : rd - r() * s * 1.5);
    for (let b = 0; b < 8; b++) {
      ctx.fillStyle = `rgba(${70 + r() * 30},${95 + r() * 30},${35 + r() * 15},${0.25 + r() * 0.25})`;
      ctx.beginPath();
      ctx.arc(mx + (r() - 0.5) * s * 0.8, my + (r() - 0.5) * s * 0.4, s * (0.04 + r() * 0.08), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // grime blotches
  for (let k = 0; k < 10; k++) {
    const gx = ox + r() * rw, gy = oy + r() * rd, gr = s * (0.5 + r() * 1.2);
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    g.addColorStop(0, 'rgba(20,10,4,0.28)'); g.addColorStop(1, 'rgba(20,10,4,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }
  // shadow pooling along the walls (stronger under the tall top wall)
  const edge = (x0, y0, x1, y1, x, y, ww, hh, a) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(10,5,2,${a})`); g.addColorStop(1, 'rgba(10,5,2,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, ww, hh);
  };
  edge(0, oy, 0, oy + 1.6 * s, ox, oy, rw, 1.6 * s, 0.7);
  edge(0, oy + rd, 0, oy + rd - s, ox, oy + rd - s, rw, s, 0.45);
  edge(ox, 0, ox + s, 0, ox, oy, s, rd, 0.5);
  edge(ox + rw, 0, ox + rw - s, 0, ox + rw - s, oy, s, rd, 0.5);
  ctx.restore();

  // --- walls (top shows its face; sides and bottom are seen from above) ---
  const L = ox - side, R = ox + rw + side, T = oy - top, B = oy + rd + bot;
  const wt = [tint[0] * 0.85, tint[1] * 0.78, tint[2] * 0.72];
  stoneWall(ctx, [[L, T], [R, T], [ox + rw, oy], [ox, oy]], [L, T, R, oy], r, wt, s * 0.55, 1.0);
  stoneWall(ctx, [[L, T], [ox, oy], [ox, oy + rd], [L, B]], [L, T, ox, B], r, wt, s * 0.4, 0.7);
  stoneWall(ctx, [[R, T], [R, B], [ox + rw, oy + rd], [ox + rw, oy]], [ox + rw, T, R, B], r, wt, s * 0.4, 0.8);
  stoneWall(ctx, [[ox, oy + rd], [ox + rw, oy + rd], [R, B], [L, B]], [L, oy + rd, R, B], r, wt, s * 0.45, 0.6);
  // the top wall darkens towards the ceiling
  ctx.save();
  ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(R, T); ctx.lineTo(ox + rw, oy); ctx.lineTo(ox, oy); ctx.closePath(); ctx.clip();
  const gt = ctx.createLinearGradient(0, T, 0, oy);
  gt.addColorStop(0, 'rgba(0,0,0,0.65)'); gt.addColorStop(1, 'rgba(0,0,0,0.05)');
  ctx.fillStyle = gt; ctx.fillRect(L, T, R - L, top);
  ctx.restore();
  // inner corners and the rim
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  for (const [ax, ay, bx, by] of [[L, T, ox, oy], [R, T, ox + rw, oy], [L, B, ox, oy + rd], [R, B, ox + rw, oy + rd]]) {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  }
  ctx.strokeRect(ox, oy, rw, rd);
  ctx.strokeRect(L, T, R - L, B - T);

  // wall dressing: hanging chains and cobwebs in the corners
  const rr = rng(seed + 3);
  if (rr() < 0.7) chain(ctx, ox + rw * (0.2 + rr() * 0.15), T + 0.1 * s, s, 1.2);
  if (rr() < 0.5) chain(ctx, ox + rw * (0.65 + rr() * 0.15), T + 0.1 * s, s, 0.9);
  cobweb(ctx, ox, oy, s, 1, 1);
  if (rr() < 0.6) cobweb(ctx, ox + rw, oy, s, -1, 1);
  if (rr() < 0.4) cobweb(ctx, ox, oy + rd, s * 0.8, 1, -1);

  // doorways
  const style = room.doorStyle || {};
  if (doors.n) doorway(ctx, ox + rw / 2, oy, s, 'n', style.n);
  if (doors.s) doorway(ctx, ox + rw / 2, oy + rd, s, 's', style.s);
  if (doors.w) doorway(ctx, ox, oy + rd / 2, s, 'w', style.w);
  if (doors.e) doorway(ctx, ox + rw, oy + rd / 2, s, 'e', style.e);
  return { top, side, bot };
}

/** An arched stone doorway. The opening is dark; doors drawn separately. */
export function doorway(ctx, x, y, s, dir, style = 'normal') {
  const frame = style === 'boss' ? [150, 50, 45] : style === 'treasure' ? [190, 150, 70] : [120, 95, 75];
  const r = rng(Math.round(x * 7 + y * 13));
  ctx.save();
  if (dir === 'n') {
    const w = 1.5 * s, h = 1.6 * s;
    // stone arch blocks
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + (k / 8) * Math.PI;
      const ax = x + Math.cos(a) * (w * 0.62), ay = y - h * 0.5 + Math.sin(a) * h * 0.62;
      stone(ctx, ax, ay, s * 0.2, s * 0.16, r, frame, 1);
    }
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) stone(ctx, x + sx * w * 0.62, y - h * 0.38 + k * 0.32 * s, s * 0.18, s * 0.16, r, frame, 0.9);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w / 2, y - h * 0.5);
    ctx.arc(x, y - h * 0.5, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, '#000'); g.addColorStop(1, '#1a0e08');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    if (style === 'boss') {
      // a skull over boss doors
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath(); ctx.arc(x, y - h * 1.05, s * 0.17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#100604';
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sx * s * 0.06, y - h * 1.06, s * 0.05, 0, Math.PI * 2); ctx.fill(); }
    }
  } else if (dir === 's') {
    ctx.fillStyle = '#0a0503';
    ctx.fillRect(x - 0.75 * s, y, 1.5 * s, 0.9 * s);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(x - 0.75 * s, y, 1.5 * s, 0.9 * s);
    for (const sx of [-1, 1]) stone(ctx, x + sx * 0.85 * s, y + 0.45 * s, s * 0.17, s * 0.3, r, frame, 0.7);
  } else {
    const sx = dir === 'w' ? -1 : 1;
    ctx.fillStyle = '#0a0503';
    ctx.fillRect(dir === 'w' ? x - 0.6 * s : x, y - 0.75 * s, 0.6 * s, 1.5 * s);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.strokeRect(dir === 'w' ? x - 0.6 * s : x, y - 0.75 * s, 0.6 * s, 1.5 * s);
    for (const sy of [-1, 1]) stone(ctx, x + sx * 0.3 * s, y + sy * 0.88 * s, s * 0.32, s * 0.16, r, frame, 0.8);
  }
  ctx.restore();
}
