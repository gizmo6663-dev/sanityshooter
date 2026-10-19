// Pixel-art pipeline. Things are painted with the vector sprite code at a
// low resolution, then snapped to a limited, grimy palette with ordered
// (Bayer) dithering, hard alpha and a 1 px dark outline. Lighting is applied
// in dithered steps. Upscaled with nearest-neighbour this reads as pixel art.

// A muted palette in ramps: darks, browns, warm stone, blood, skin, moss,
// gold, cold blues, a little purple.
const HEX = [
  '0d0705', '1a0e09', '2a1810',
  '3a2416', '4e321f', '63412a', '7a5236', '93673f', 'ad7f52', 'c49a6a',
  '3d3530', '554a42', '6e625a', '887b70', 'a39587', 'c0b2a2', 'ddd0be',
  '3a0a0c', '5e1014', '861a1e', 'b02a2a', 'd24a40', 'ee7a62',
  '6e4a3e', '9a6e5c', 'c49884', 'e2bca6', 'f6dccb', 'fff1e6',
  '1f2a12', '34461c', '4e6a26', '6e8e34', '98b450',
  '6a4210', 'a0661a', 'd89a2a', 'f6c84a', 'fff0a8',
  '1c2a3c', '2f4e6e', '4e82aa', '86bce0', 'cfeaff',
  '3a2238', '5e3a5a', 'ffffff',
];
export const PALETTE = HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);

const cache = new Map();
function nearest(r, g, b) {
  const key = (r >> 2) << 12 | (g >> 2) << 6 | (b >> 2);
  const hit = cache.get(key);
  if (hit) return hit;
  let best = PALETTE[0], bd = 1e9;
  for (const p of PALETTE) {
    // weight green more, like the eye does
    const dr = r - p[0], dg = g - p[1], db = b - p[2];
    const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
    if (d < bd) { bd = d; best = p; }
  }
  cache.set(key, best);
  return best;
}

/** Snaps an image to the palette with ordered dithering and hard alpha. */
export function quantize(ctx, w, h, { spread = 22, alphaCut = 120 } = {}) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < alphaCut) { d[i + 3] = 0; continue; }
      const o = BAYER[(y & 3) * 4 + (x & 3)] * spread;
      const p = nearest(clamp(d[i] + o), clamp(d[i + 1] + o), clamp(d[i + 2] + o));
      d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** 1 px outline around opaque pixels. */
export function outline(ctx, w, h, color = [26, 14, 9]) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) solid[k] = d[k * 4 + 3] > 0 ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (solid[k]) continue;
      if ((x > 0 && solid[k - 1]) || (x < w - 1 && solid[k + 1]) || (y > 0 && solid[k - w]) || (y < h - 1 && solid[k + w])) {
        d[k * 4] = color[0]; d[k * 4 + 1] = color[1]; d[k * 4 + 2] = color[2]; d[k * 4 + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Renders a vector sprite into a small pixel canvas.
 * draw(ctx, x, y, s) paints with its feet at (x, y). w/h are in world units.
 * Returns { canvas, ax, ay } where (ax, ay) is the feet anchor in pixels.
 */
export function pixelSprite(draw, s, w = 2, h = 2.4, { outlined = true, spread = 20 } = {}) {
  const pw = Math.ceil(w * s) + 2, ph = Math.ceil(h * s) + 2;
  const c = document.createElement('canvas');
  c.width = pw; c.height = ph;
  const g = c.getContext('2d');
  const ax = Math.round(pw / 2), ay = ph - Math.round(0.35 * s);
  draw(g, ax, ay, s);
  quantize(g, pw, ph, { spread });
  if (outlined) outline(g, pw, ph);
  return { canvas: c, ax, ay };
}

/**
 * Applies lighting in dithered steps: lights = [{x, y, r, k}] in pixels,
 * ambient 0..1. Pixels are multiplied by the quantized light level.
 */
export function light(ctx, w, h, ambient, lights, { steps = 5, warm = [1.0, 0.86, 0.68] } = {}) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let l = ambient, wl = 0;
      for (const L of lights) {
        const dx = x - L.x, dy = (y - L.y) * 1.25, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < L.r) { const f = (1 - dd / L.r) * L.k; l += f; wl += f; }
      }
      const o = BAYER[(y & 3) * 4 + (x & 3)] / steps;
      const q = Math.max(0, Math.min(1.25, Math.round((l + o) * steps) / steps));
      const wq = Math.min(1, wl);
      const i = (y * w + x) * 4;
      // lit areas also drift towards a warm tint
      d[i] = clamp(d[i] * q * warm[0] + 18 * wq);
      d[i + 1] = clamp(d[i + 1] * q * (1 - (1 - warm[1]) * wq * 0.5));
      d[i + 2] = clamp(d[i + 2] * q * (1 - (1 - warm[2]) * wq * 0.6));
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Adds fine grime to a background so flat areas get texture. */
export function grime(ctx, w, h, seed = 1, amount = 0.18) {
  let a = seed * 7919 + 1;
  const rnd = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let k = 0; k < w * h; k++) {
    const n = (rnd() - 0.5) * 2 * amount * 60;
    d[k * 4] = clamp(d[k * 4] + n); d[k * 4 + 1] = clamp(d[k * 4 + 1] + n); d[k * 4 + 2] = clamp(d[k * 4 + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
}
