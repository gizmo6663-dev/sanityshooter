// Procedural models and textures. Everything is built from primitives in
// code, no asset files. Static props are merged into a few vertex-coloured
// meshes so the whole scene stays at a handful of draw calls.

import * as THREE from 'three';
import { Cfg } from './config.js';

const PI = Math.PI;

// --- Helpers -------------------------------------------------------------
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Transform matrix from position, euler rotation and scale. */
export function mat(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(
    _p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

/**
 * Merges geometries into one non-indexed geometry with a vertex colour per
 * part. Parts: { geo, color, matrix }.
 */
export function mergeGeos(parts) {
  let total = 0;
  const prepared = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    if (p.matrix) g.applyMatrix4(p.matrix);
    total += g.attributes.position.count;
    return { g, c: new THREE.Color(p.color ?? 0xffffff) };
  });
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const { g, c } of prepared) {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++, o++) {
      pos[o * 3] = P.getX(i); pos[o * 3 + 1] = P.getY(i); pos[o * 3 + 2] = P.getZ(i);
      nor[o * 3] = N.getX(i); nor[o * 3 + 1] = N.getY(i); nor[o * 3 + 2] = N.getZ(i);
      if (U) { uv[o * 2] = U.getX(i); uv[o * 2 + 1] = U.getY(i); }
      col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** Collects static parts and turns them into one mesh. */
export class Batch {
  constructor() { this.parts = []; }
  add(geo, color, matrix) { this.parts.push({ geo, color, matrix }); return this; }
  build(material, shadow = true) {
    const m = new THREE.Mesh(mergeGeos(this.parts), material);
    m.castShadow = shadow;
    m.receiveShadow = true;
    return m;
  }
}

export function vcMat(extra = {}) {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, ...extra });
}

export function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

export function seeded(seed) {
  let a = seed;
  return () => ((a = (a * 16807) % 2147483647) / 2147483647);
}

// --- Textures ----------------------------------------------------------------
function brickTexture(base, mortar, rx, ry, vary = 0.12) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = mortar;
    g.fillRect(0, 0, w, h);
    const rows = 8, cols = 4, bh = h / rows, bw = w / cols;
    const rnd = seeded(7);
    const c = new THREE.Color(base);
    for (let r = 0; r < rows; r++) {
      for (let k = -1; k < cols; k++) {
        const x = k * bw + (r % 2 ? bw / 2 : 0);
        const v = 1 + (rnd() - 0.5) * vary * 2;
        g.fillStyle = `rgb(${Math.min(255, c.r * 255 * v)},${Math.min(255, c.g * 255 * v)},${Math.min(255, c.b * 255 * v)})`;
        g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
        // a soft top highlight per brick
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fillRect(x + 3, r * bh + 3, bw - 6, 4);
      }
    }
  }, rx, ry);
}

function roadTexture(laneHalf, tileLen) {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#5a6172';
    g.fillRect(0, 0, w, h);
    // asphalt speckle
    const rnd = seeded(99);
    for (let i = 0; i < 2600; i++) {
      const v = 70 + rnd() * 60;
      g.fillStyle = `rgba(${v},${v + 4},${v + 14},0.5)`;
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
    // a couple of soft cracks/patches
    g.fillStyle = 'rgba(40,44,56,0.35)';
    g.fillRect(w * 0.62, h * 0.2, 36, 50);
    g.fillRect(w * 0.18, h * 0.66, 28, 30);
    const px = (x) => (x / (laneHalf * 2) + 0.5) * w;
    // edge lines
    g.fillStyle = '#f4f4f4';
    for (const sx of [-1, 1]) g.fillRect(px(sx * (laneHalf - 0.35)) - 3, 0, 6, h);
    // dashed lane lines, 4 dashes per tile
    for (const sx of [-1, 1]) {
      for (let d = 0; d < 4; d++) g.fillRect(px(sx * laneHalf / 3) - 3, (d / 4) * h, 6, (1.8 / tileLen) * h);
    }
  }, 1, 1);
}

function stripeTexture(color) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 10;
    for (let k = -2; k < 4; k++) {
      g.beginPath();
      g.moveTo(k * 48, h);
      g.lineTo(k * 48 + h, 0);
      g.stroke();
    }
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,0.25)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }, 1, 1);
}
export { stripeTexture };

function bannerTexture(bg, fg, kind) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // swallowtail cut
    g.fillStyle = 'rgba(0,0,0,0)';
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, h - 40); g.lineTo(w, h); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#ffc23d';
    g.fillRect(0, 0, w, 10);
    g.fillRect(0, 0, 8, h - 20);
    g.fillRect(w - 8, 0, 8, h - 20);
    g.fillStyle = fg;
    const cx = w / 2, cy = h * 0.42;
    if (kind === 'skull') {
      g.beginPath(); g.arc(cx, cy, 34, 0, PI * 2); g.fill();
      g.fillRect(cx - 20, cy + 20, 40, 26);
      g.fillStyle = bg;
      g.beginPath(); g.arc(cx - 13, cy, 10, 0, PI * 2); g.arc(cx + 13, cy, 10, 0, PI * 2); g.fill();
      for (let k = -1; k <= 1; k++) g.fillRect(cx + k * 12 - 3, cy + 32, 6, 14);
    } else {
      // star
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 16 : 40, a = -PI / 2 + k * PI / 5;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.fill();
    }
  }, 1, 1);
}

// --- Mobs ----------------------------------------------------------------------
// A little running character, built as separate parts so legs and arms can
// swing. Local space: feet at y=0, facing +Z.
export const RIG = {
  hipY: 0.24, hipX: 0.11,
  shoulderY: 0.5, shoulderX: 0.255,
};

export function mobGeometries() {
  const body = mergeGeos([
    { geo: new THREE.LatheGeometry([
      new THREE.Vector2(0.0, 0.17), new THREE.Vector2(0.17, 0.18), new THREE.Vector2(0.25, 0.25),
      new THREE.Vector2(0.27, 0.37), new THREE.Vector2(0.26, 0.51), new THREE.Vector2(0.22, 0.63),
      new THREE.Vector2(0.14, 0.71), new THREE.Vector2(0.05, 0.745), new THREE.Vector2(0.0, 0.75),
    ], 12) },
    // belt and buckle, darker than the body tint
    { geo: new THREE.CylinderGeometry(0.268, 0.268, 0.06, 12, 1, true), color: 0x4a4a55, matrix: mat(0, 0.3, 0) },
    { geo: new THREE.BoxGeometry(0.09, 0.07, 0.03), color: 0xffd76a, matrix: mat(0, 0.3, 0.27) },
  ]);

  const leg = mergeGeos([
    { geo: new THREE.CylinderGeometry(0.075, 0.065, 0.2, 6, 1, true), matrix: mat(0, -0.09, 0) },
    { geo: new THREE.SphereGeometry(0.085, 6, 4), color: 0x2b2b35, matrix: mat(0, -0.2, 0.03, 0, 0, 0, 1, 0.6, 1.35) },
  ]);

  const arm = mergeGeos([
    { geo: new THREE.CylinderGeometry(0.055, 0.05, 0.18, 5, 1, true), matrix: mat(0, -0.09, 0) },
    { geo: new THREE.SphereGeometry(0.065, 5, 4), color: 0xf0f0f0, matrix: mat(0, -0.19, 0) },
  ]);

  const eyes = mergeGeos([-1, 1].map((sx) => ({
    geo: new THREE.SphereGeometry(0.07, 8, 5, 0, PI * 2, 0, PI * 0.75), matrix: mat(sx * 0.088, 0.52, 0.222, 0, 0, 0, 1, 1.12, 0.55),
  })));

  const pupils = mergeGeos([-1, 1].flatMap((sx) => [
    { geo: new THREE.SphereGeometry(0.037, 6, 4), color: 0x14142a, matrix: mat(sx * 0.085, 0.515, 0.255, 0, 0, 0, 1, 1.15, 0.5) },
    { geo: new THREE.SphereGeometry(0.012, 4, 3), color: 0xffffff, matrix: mat(sx * 0.085 + 0.012, 0.53, 0.272) },
  ]));

  // Angry eyebrows for the red team
  const brows = mergeGeos([-1, 1].map((sx) => ({
    geo: new THREE.BoxGeometry(0.1, 0.028, 0.03), color: 0x2a0a0a, matrix: mat(sx * 0.09, 0.6, 0.235, 0, 0, sx * 0.42),
  })));

  // Blue team: a wide-brim hat with a gold band
  const hat = mergeGeos([
    { geo: new THREE.CylinderGeometry(0.3, 0.3, 0.03, 14), color: 0x3f74e8, matrix: mat(0, 0.68, 0) },
    { geo: new THREE.CylinderGeometry(0.14, 0.17, 0.15, 12, 1, true), color: 0x3f74e8, matrix: mat(0, 0.77, 0) },
    { geo: new THREE.SphereGeometry(0.14, 12, 3, 0, PI * 2, 0, PI / 2), color: 0x3f74e8, matrix: mat(0, 0.845, 0, 0, 0, 0, 1, 0.35, 1) },
    { geo: new THREE.CylinderGeometry(0.175, 0.175, 0.045, 12, 1, true), color: 0xffc23d, matrix: mat(0, 0.715, 0) },
    { geo: new THREE.TorusGeometry(0.3, 0.02, 3, 16), color: 0xffc23d, matrix: mat(0, 0.68, 0, PI / 2) },
  ]);

  // Red team: horned helmet
  const helmet = mergeGeos([
    { geo: new THREE.SphereGeometry(0.255, 12, 5, 0, PI * 2, 0, PI / 2), color: 0x50555f, matrix: mat(0, 0.6, 0, 0, 0, 0, 1, 0.85, 1) },
    { geo: new THREE.TorusGeometry(0.255, 0.028, 4, 14), color: 0x2e323a, matrix: mat(0, 0.6, 0, PI / 2) },
    { geo: new THREE.BoxGeometry(0.045, 0.2, 0.05), color: 0x2e323a, matrix: mat(0, 0.66, 0.2, -0.5) },
    ...[-1, 1].flatMap((sx) => [
      { geo: new THREE.ConeGeometry(0.055, 0.24, 6), color: 0xf5e6c4, matrix: mat(sx * 0.24, 0.74, 0, 0, 0, -sx * 0.75) },
      { geo: new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6, 1, true), color: 0x2e323a, matrix: mat(sx * 0.2, 0.68, 0, 0, 0, -sx * 0.75) },
    ]),
  ]);

  // Gold giant: crown with gems
  const crownParts = [
    { geo: new THREE.CylinderGeometry(0.2, 0.18, 0.11, 16, 1, true), color: 0xffd24a, matrix: mat(0, 0.77, 0) },
    { geo: new THREE.TorusGeometry(0.19, 0.02, 6, 20), color: 0xffe9a0, matrix: mat(0, 0.72, 0, PI / 2) },
  ];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * PI * 2;
    crownParts.push({ geo: new THREE.ConeGeometry(0.04, 0.1, 6), color: 0xffd24a, matrix: mat(Math.sin(a) * 0.19, 0.87, Math.cos(a) * 0.19) });
    crownParts.push({ geo: new THREE.SphereGeometry(0.025, 6, 4), color: k % 2 ? 0x2fd0ff : 0xff2d55, matrix: mat(Math.sin(a) * 0.2, 0.775, Math.cos(a) * 0.2) });
  }
  const crown = mergeGeos(crownParts);

  return { body, leg, arm, eyes, pupils, brows, hat, helmet, crown };
}

/** Cheap one-piece red mob for the idle horde behind the base. */
export function hordeGeometry() {
  return mergeGeos([
    { geo: new THREE.LatheGeometry([
      new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.22, 0.03), new THREE.Vector2(0.27, 0.2),
      new THREE.Vector2(0.25, 0.5), new THREE.Vector2(0.13, 0.7), new THREE.Vector2(0.0, 0.74),
    ], 8), color: 0xff3a36 },
    { geo: new THREE.TorusGeometry(0.2, 0.035, 4, 12), color: 0x7a1220, matrix: mat(0, 0.6, 0, PI / 2) },
    ...[-1, 1].map((sx) => ({ geo: new THREE.ConeGeometry(0.05, 0.2, 5), color: 0xf5e6c4, matrix: mat(sx * 0.22, 0.68, 0, 0, 0, -sx * 0.75) })),
    ...[-1, 1].map((sx) => ({ geo: new THREE.SphereGeometry(0.06, 6, 4), color: 0xffffff, matrix: mat(sx * 0.085, 0.46, 0.21, 0, 0, 0, 1, 1, 0.5) })),
  ]);
}

// --- Cannon --------------------------------------------------------------------
export function buildCannon() {
  const root = new THREE.Group();
  const chassis = new Batch();
  const BLUE = 0x2f7dff, BLUE_D = 0x1f4fb8, GOLD = 0xffc23d, DARK = 0x262d45;

  // Turntable with gear teeth
  chassis.add(new THREE.CylinderGeometry(1.05, 1.2, 0.3, 28), DARK, mat(0, 0.3, 0));
  chassis.add(new THREE.TorusGeometry(1.1, 0.07, 8, 32), GOLD, mat(0, 0.46, 0, PI / 2));
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * PI * 2;
    chassis.add(new THREE.BoxGeometry(0.14, 0.18, 0.16), 0x3b4566, mat(Math.sin(a) * 1.2, 0.3, Math.cos(a) * 1.2, 0, a, 0));
  }
  // Carriage side plates with rivets
  for (const sx of [-1, 1]) {
    chassis.add(new THREE.BoxGeometry(0.16, 0.7, 1.4), BLUE_D, mat(sx * 0.62, 0.8, 0.1));
    for (const [ry, rz] of [[0.6, -0.4], [0.6, 0.6], [1.0, 0.1], [0.6, 0.1]]) {
      chassis.add(new THREE.SphereGeometry(0.05, 6, 4), GOLD, mat(sx * 0.71, ry, rz));
    }
    // Spoked wheels
    const wx = sx * 0.95;
    chassis.add(new THREE.TorusGeometry(0.5, 0.08, 8, 24), GOLD, mat(wx, 0.62, 0.25, 0, PI / 2, 0));
    chassis.add(new THREE.CylinderGeometry(0.47, 0.47, 0.06, 20), 0x6b4423, mat(wx, 0.62, 0.25, 0, 0, PI / 2));
    chassis.add(new THREE.CylinderGeometry(0.13, 0.13, 0.24, 10), GOLD, mat(wx, 0.62, 0.25, 0, 0, PI / 2));
    for (let k = 0; k < 8; k++) {
      chassis.add(new THREE.BoxGeometry(0.07, 0.8, 0.06), 0x8a5a2b, mat(wx + sx * 0.04, 0.62, 0.25, (k / 8) * PI, 0, 0));
    }
  }
  root.add(chassis.build(vcMat({ roughness: 0.4, metalness: 0.25 })));

  // Barrel (separate so it can recoil); points down -Z
  const barrel = new THREE.Group();
  barrel.position.set(0, 1.08, 0);
  barrel.rotation.x = 0.12;
  const b = new Batch();
  b.add(new THREE.SphereGeometry(0.62, 24, 16), BLUE, mat(0, 0, 0.25));
  b.add(new THREE.CylinderGeometry(0.5, 0.36, 1.9, 24), BLUE, mat(0, 0, -0.75, PI / 2));
  for (const [z, r] of [[-0.05, 0.52], [-0.75, 0.46], [-1.35, 0.42]]) {
    b.add(new THREE.TorusGeometry(r, 0.06, 8, 24), GOLD, mat(0, 0, z));
  }
  b.add(new THREE.TorusGeometry(0.4, 0.13, 10, 24), GOLD, mat(0, 0, -1.72));
  b.add(new THREE.CircleGeometry(0.33, 20), 0x0b0f1f, mat(0, 0, -1.74, 0, PI, 0));
  // breech knob and a star emblem
  b.add(new THREE.SphereGeometry(0.16, 10, 8), GOLD, mat(0, 0, 0.9));
  b.add(new THREE.OctahedronGeometry(0.14), GOLD, mat(0, 0.56, 0.2, 0, PI / 4, 0, 1, 1, 0.4));
  // hopper on top where the mobs are loaded
  b.add(new THREE.CylinderGeometry(0.42, 0.2, 0.45, 16, 1, true), BLUE_D, mat(0, 0.75, 0.45));
  b.add(new THREE.TorusGeometry(0.42, 0.05, 6, 20), GOLD, mat(0, 0.97, 0.45, PI / 2));
  b.add(new THREE.SphereGeometry(0.17, 10, 8), BLUE, mat(0.1, 0.9, 0.45));
  b.add(new THREE.SphereGeometry(0.15, 10, 8), BLUE, mat(-0.14, 0.88, 0.5));
  barrel.add(b.build(vcMat({ roughness: 0.3, metalness: 0.3 })));

  // Muzzle flash, scaled by recoil
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.position.set(0, 0, -2.0);
  flash.scale.set(1, 1, 1.8);
  barrel.add(flash);
  root.add(barrel);

  return { root, barrel, flash };
}

// --- Player wall --------------------------------------------------------------
export function buildPlayerWall() {
  const H = Cfg.LANE_HALF;
  const group = new THREE.Group();
  const stone = brickTexture('#7ea6e8', '#3d5a96', 6, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.75, emissive: 0xff0000, emissiveIntensity: 0 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(H * 2 + 1, 1.0, 0.7), wallMat);
  wall.position.set(0, 0.6, 0);
  wall.castShadow = wall.receiveShadow = true;
  group.add(wall);
  const deco = new Batch();
  for (let x = -H; x <= H + 0.01; x += 0.92) deco.add(new THREE.BoxGeometry(0.5, 0.42, 0.72), 0x5f8ee0, mat(x, 1.3, 0));
  for (const sx of [-1, 1]) {
    const tx = sx * (H + 0.9);
    deco.add(new THREE.CylinderGeometry(0.7, 0.8, 2.6, 14), 0x6d94d6, mat(tx, 1.3, 0.2));
    deco.add(new THREE.TorusGeometry(0.72, 0.06, 6, 20), 0xffc23d, mat(tx, 2.55, 0.2, PI / 2));
    deco.add(new THREE.ConeGeometry(0.95, 1.3, 14), 0x2f7dff, mat(tx, 3.25, 0.2));
    deco.add(new THREE.SphereGeometry(0.12, 8, 6), 0xffc23d, mat(tx, 3.95, 0.2));
    deco.add(new THREE.BoxGeometry(0.22, 0.4, 0.05), 0x10162e, mat(tx, 1.6, -0.55));
  }
  const decoMesh = deco.build(vcMat({ roughness: 0.6, emissive: 0xff0000, emissiveIntensity: 0 }));
  group.add(decoMesh);
  group.position.z = 1.1;
  return { group, mats: [wallMat, decoMesh.material] };
}

// --- Enemy base ---------------------------------------------------------------
export function buildCastle() {
  const W = Cfg.LANE_HALF * 2 + 1.2;
  const group = new THREE.Group();
  const bricks = brickTexture('#e0403f', '#7a1d24', W / 2.2, 1.6);
  const wallMat = new THREE.MeshStandardMaterial({ map: bricks, roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0 });
  const towerTex = brickTexture('#d63a3c', '#701a22', 3, 2.4);
  const towerMat = new THREE.MeshStandardMaterial({ map: towerTex, roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0 });

  const wall = new THREE.Mesh(new THREE.BoxGeometry(W, 3.4, 2.6), wallMat);
  wall.position.set(0, 1.7, -1.3);
  wall.castShadow = wall.receiveShadow = true;
  group.add(wall);
  const keep = new THREE.Mesh(new THREE.BoxGeometry(W * 0.5, 5.2, 2.4), wallMat);
  keep.position.set(0, 2.6, -3.6);
  keep.castShadow = true;
  group.add(keep);
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 5.4, 18), towerMat);
    t.position.set(sx * (W / 2 - 0.15), 2.7, -1.2);
    t.castShadow = t.receiveShadow = true;
    group.add(t);
  }

  const d = new Batch();
  const STONE = 0x8e2630, TRIM = 0xb8333a, GOLD = 0xffc23d, IRON = 0x2a2a33, VOID = 0x1a0508;
  // trims and crenellations
  d.add(new THREE.BoxGeometry(W + 0.2, 0.35, 2.8), STONE, mat(0, 0.18, -1.3));
  d.add(new THREE.BoxGeometry(W + 0.3, 0.25, 2.9), TRIM, mat(0, 3.45, -1.3));
  for (let x = -W / 2 + 0.45; x <= W / 2 - 0.3; x += 0.9) {
    d.add(new THREE.BoxGeometry(0.55, 0.6, 0.6), 0xe0403f, mat(x, 3.85, -0.15));
    d.add(new THREE.BoxGeometry(0.55, 0.6, 0.6), 0xe0403f, mat(x, 3.85, -2.45));
  }
  for (let x = -W * 0.25 + 0.4; x <= W * 0.25 - 0.3; x += 0.9) {
    d.add(new THREE.BoxGeometry(0.5, 0.55, 0.5), 0xe0403f, mat(x, 5.45, -2.5));
  }
  d.add(new THREE.ConeGeometry(1.1, 1.6, 4), GOLD, mat(0, 6.3, -3.6, 0, PI / 4, 0, 1.6, 1, 0.9));
  // arched gate with portcullis
  d.add(new THREE.BoxGeometry(2.4, 1.7, 0.2), VOID, mat(0, 1.05, 0.03));
  d.add(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 20, 1, false, -PI / 2, PI), VOID, mat(0, 1.9, 0.03, -PI / 2, 0, 0));
  d.add(new THREE.TorusGeometry(1.32, 0.14, 8, 20, PI), STONE, mat(0, 1.9, 0.08));
  for (const sx of [-1, 1]) d.add(new THREE.BoxGeometry(0.28, 1.75, 0.3), STONE, mat(sx * 1.32, 1.02, 0.08));
  for (let x = -1.0; x <= 1.01; x += 0.33) d.add(new THREE.BoxGeometry(0.06, 2.6, 0.06), IRON, mat(x, 1.5, 0.18));
  for (const y of [0.7, 1.4, 2.1]) d.add(new THREE.BoxGeometry(2.3, 0.06, 0.06), IRON, mat(0, y, 0.18));
  // skull plaque over the gate
  d.add(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 18), GOLD, mat(0, 3.0, 0.05, PI / 2));
  d.add(new THREE.SphereGeometry(0.3, 12, 8), 0xf2ead8, mat(0, 3.05, 0.14, 0, 0, 0, 1, 1, 0.5));
  d.add(new THREE.BoxGeometry(0.28, 0.16, 0.12), 0xf2ead8, mat(0, 2.8, 0.14));
  for (const sx of [-1, 1]) d.add(new THREE.SphereGeometry(0.08, 6, 4), VOID, mat(sx * 0.11, 3.07, 0.27));
  // towers: trims, windows, roofs, flagpoles
  for (const sx of [-1, 1]) {
    const tx = sx * (W / 2 - 0.15);
    for (const y of [0.2, 2.6, 5.35]) d.add(new THREE.TorusGeometry(1.14, 0.1, 6, 22), TRIM, mat(tx, y, -1.2, PI / 2));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * PI * 2;
      d.add(new THREE.BoxGeometry(0.4, 0.5, 0.35), 0xd63a3c, mat(tx + Math.sin(a) * 1.05, 5.7, -1.2 + Math.cos(a) * 1.05, 0, a, 0));
    }
    d.add(new THREE.ConeGeometry(1.4, 2.0, 18), GOLD, mat(tx, 7.0, -1.2));
    d.add(new THREE.SphereGeometry(0.16, 8, 6), 0xff2d55, mat(tx, 8.05, -1.2));
    d.add(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), IRON, mat(tx, 8.7, -1.2));
    for (const y of [1.8, 3.8]) {
      d.add(new THREE.BoxGeometry(0.34, 0.6, 0.12), 0x2a0a0a, mat(tx, y, -0.03));
      d.add(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12, 1, false, -PI / 2, PI), 0x2a0a0a, mat(tx, y + 0.3, -0.03, -PI / 2));
    }
    // torch brackets beside the gate
    d.add(new THREE.CylinderGeometry(0.06, 0.04, 0.6, 6), IRON, mat(sx * 2.0, 1.9, 0.25));
    d.add(new THREE.CylinderGeometry(0.16, 0.1, 0.18, 8), IRON, mat(sx * 2.0, 2.25, 0.25));
  }
  group.add(d.build(vcMat({ roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0 })));
  const decoMat = group.children[group.children.length - 1].material;

  // glowing windows
  const glow = new Batch();
  for (const sx of [-1, 1]) {
    const tx = sx * (W / 2 - 0.15);
    for (const y of [1.8, 3.8]) glow.add(new THREE.PlaneGeometry(0.22, 0.45), 0xffb347, mat(tx, y + 0.02, 0.04));
  }
  const glowMesh = new THREE.Mesh(mergeGeos(glow.parts), new THREE.MeshBasicMaterial({ vertexColors: true }));
  group.add(glowMesh);

  // torches (animated flames)
  const flames = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa21f, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 8), flameMat);
    f.position.set(sx * 2.0, 2.55, 0.25);
    group.add(f);
    flames.push(f);
  }

  // banners on the wall and flags on the towers
  const banners = [];
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTexture('#2a0d14', '#ffe9c0', 'skull'), side: THREE.DoubleSide, transparent: true, alphaTest: 0.5, roughness: 0.8 });
  for (const sx of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(1.0, 2.0, 1, 6);
    geo.translate(0, -1.0, 0);
    const bm = new THREE.Mesh(geo, bannerMat);
    bm.position.set(sx * 3.0, 3.3, 0.06);
    group.add(bm);
    banners.push(bm);
  }
  const flagMat = new THREE.MeshStandardMaterial({ map: bannerTexture('#ff2d55', '#ffffff', 'star'), side: THREE.DoubleSide, roughness: 0.8 });
  const flags = [];
  for (const sx of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(1.2, 0.7, 8, 1);
    geo.translate(0.6, 0, 0);
    const fm = new THREE.Mesh(geo, flagMat);
    fm.position.set(sx * (W / 2 - 0.15), 9.15, -1.2);
    fm.castShadow = true;
    group.add(fm);
    flags.push(fm);
  }

  return { group, mats: [wallMat, towerMat, decoMat], flames, banners, flags };
}

/** Waves a plane's vertices along x (flags) — call each frame. */
export function waveFlag(mesh, t, amp = 0.12) {
  const p = mesh.geometry.attributes.position;
  if (!mesh.userData.base) mesh.userData.base = p.array.slice();
  const b = mesh.userData.base;
  for (let i = 0; i < p.count; i++) {
    const x = b[i * 3];
    p.array[i * 3 + 2] = b[i * 3 + 2] + Math.sin(t * 6 - x * 4) * amp * x;
  }
  p.needsUpdate = true;
}

// --- Environment ------------------------------------------------------------------
export function buildEnvironment(scene) {
  const L = Cfg.LANE_LEN, H = Cfg.LANE_HALF;
  const rnd = seeded(12345);

  // Rolling dunes, flattened around the road
  const gw = 300, seg = 90;
  const ground = new THREE.PlaneGeometry(gw, gw, seg, seg);
  const gp = ground.attributes.position;
  const colors = new Float32Array(gp.count * 3);
  const sand = new THREE.Color(0xf3c98b), crest = new THREE.Color(0xffe2ae), shade = new THREE.Color(0xdba467);
  const tmp = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), wz = -gp.getY(i) - 60;
    const ax = Math.abs(x);
    const fade = Math.min(1, Math.max(0, (ax - H - 2.5) / 10));
    const hgt = (Math.sin(x * 0.07 + wz * 0.05) * 1.4 + Math.sin(x * 0.17 - wz * 0.09) * 0.6 +
      Math.sin(wz * 0.06 + 1.3) * 0.9 + 0.9) * fade;
    gp.setZ(i, hgt);
    const k = Math.max(-1, Math.min(1, (hgt - 1.2) / 1.6));
    tmp.copy(sand).lerp(k > 0 ? crest : shade, Math.abs(k) * 0.7);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const gm = new THREE.Mesh(ground, vcMat({ roughness: 0.95 }));
  gm.rotation.x = -PI / 2;
  gm.position.z = -60;
  gm.receiveShadow = true;
  scene.add(gm);

  // Road with a painted asphalt texture
  const roadLen = L + 10;
  const tile = 16;
  const roadTex = roadTexture(H, tile);
  roadTex.repeat.set(1, roadLen / tile);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, roadLen),
    new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 }));
  road.rotation.x = -PI / 2;
  road.position.set(0, 0.23, -(L / 2 - 2));
  road.receiveShadow = true;
  scene.add(road);

  const st = new Batch();
  // road bed and red/white curbs
  st.add(new THREE.BoxGeometry(H * 2 + 1.4, 0.22, roadLen), 0x8b6b4a, mat(0, 0.11, -(L / 2 - 2)));
  let n = 0;
  for (let z = -7; z < L + 3; z += 1.0, n++) {
    for (const sx of [-1, 1]) {
      st.add(new THREE.BoxGeometry(0.3, 0.12, 0.98), n % 2 ? 0xffffff : 0xe63946, mat(sx * (H + 0.12), 0.29, -z - 0.5));
    }
  }
  // fence: pointed posts and two rails
  for (let z = -6; z < L + 3; z += 1.4) {
    for (const sx of [-1, 1]) {
      const c = 0x8a5a35 + Math.floor(rnd() * 3) * 0x050302;
      st.add(new THREE.BoxGeometry(0.16, 0.75, 0.16), c, mat(sx * (H + 0.55), 0.6, -z));
      st.add(new THREE.ConeGeometry(0.12, 0.2, 4), c, mat(sx * (H + 0.55), 1.07, -z, 0, PI / 4, 0));
    }
  }
  for (const sx of [-1, 1]) {
    for (const y of [0.55, 0.85]) st.add(new THREE.BoxGeometry(0.08, 0.12, roadLen), 0x9c6a3f, mat(sx * (H + 0.55), y, -(L / 2 - 1.5)));
  }
  // enemy field behind the base
  st.add(new THREE.BoxGeometry(H * 2 + 10, 0.3, 46), 0xc23a32, mat(0, 0.06, -(L + 25)));
  st.add(new THREE.BoxGeometry(H * 2 + 10.6, 0.34, 0.5), 0x8e2630, mat(0, 0.08, -(L + 2)));

  // Desert props
  const CACTUS = 0x3bb54a, CACTUS_D = 0x2a8f3a;
  const place = (minX, maxX) => {
    const side = rnd() < 0.5 ? -1 : 1;
    return [side * (H + minX + rnd() * (maxX - minX)), -(-6 + rnd() * (L + 40))];
  };
  for (let k = 0; k < 26; k++) {
    const [x, z] = place(2.5, 20);
    const s = 0.8 + rnd() * 0.8, ry = rnd() * PI;
    const m = (lx, ly, lz, rz = 0, sc = 1) => new THREE.Matrix4().makeTranslation(x, 0, z)
      .multiply(mat(0, 0, 0, 0, ry, 0, s)).multiply(mat(lx, ly, lz, 0, 0, rz, sc));
    st.add(new THREE.CapsuleGeometry(0.35, 1.7, 4, 10), CACTUS, m(0, 1.2, 0));
    for (let r = 0; r < 6; r++) st.add(new THREE.BoxGeometry(0.04, 1.8, 0.04), CACTUS_D, m(Math.sin(r) * 0.34, 1.2, Math.cos(r) * 0.34));
    st.add(new THREE.CapsuleGeometry(0.2, 0.55, 4, 8), CACTUS, m(0.42, 1.55, 0));
    st.add(new THREE.CapsuleGeometry(0.18, 0.3, 4, 8), CACTUS, m(0.3, 1.05, 0, PI / 2));
    if (rnd() < 0.7) {
      st.add(new THREE.CapsuleGeometry(0.18, 0.4, 4, 8), CACTUS, m(-0.4, 1.3, 0));
      st.add(new THREE.CapsuleGeometry(0.16, 0.25, 4, 8), CACTUS, m(-0.28, 0.95, 0, PI / 2));
    }
    st.add(new THREE.SphereGeometry(0.13, 8, 6), 0xff5fa2, m(0, 2.4, 0));
    st.add(new THREE.SphereGeometry(0.08, 6, 4), 0xffe14d, m(0, 2.5, 0));
  }
  for (let k = 0; k < 12; k++) {
    // palms
    const [x, z] = place(5, 24);
    const lean = (rnd() - 0.5) * 0.5, s = 0.9 + rnd() * 0.5;
    const base = new THREE.Matrix4().makeTranslation(x, 0, z).multiply(mat(0, 0, 0, 0, rnd() * PI, lean, s));
    for (let j = 0; j < 7; j++) {
      st.add(new THREE.CylinderGeometry(0.17 - j * 0.01, 0.2 - j * 0.01, 0.55, 8), j % 2 ? 0x9b6b3d : 0x87592f,
        base.clone().multiply(mat(Math.sin(j * 0.35) * 0.25 * j * 0.3, 0.27 + j * 0.52, 0)));
    }
    const top = new THREE.Vector3(Math.sin(2.1) * 0.25 * 2.1, 3.9, 0);
    for (let l = 0; l < 7; l++) {
      const a = (l / 7) * PI * 2;
      st.add(new THREE.ConeGeometry(0.32, 2.2, 4), l % 2 ? 0x2fae4f : 0x3fcf5e,
        base.clone().multiply(mat(top.x + Math.cos(a) * 0.9, top.y - 0.2, Math.sin(a) * 0.9, 0, PI - a, PI / 2 + 0.35, 0.25, 1, 1)));
    }
    for (let c = 0; c < 3; c++) st.add(new THREE.SphereGeometry(0.16, 8, 6), 0x7a4a22, base.clone().multiply(mat(top.x + (c - 1) * 0.2, top.y - 0.35, 0.1)));
  }
  for (let k = 0; k < 40; k++) {
    // rock clusters
    const [x, z] = place(2.2, 26);
    const c = [0xd39a62, 0xc7884f, 0xe0ae78][Math.floor(rnd() * 3)];
    for (let r = 0; r < 1 + Math.floor(rnd() * 3); r++) {
      const sc = 0.4 + rnd() * 1.1;
      st.add(new THREE.DodecahedronGeometry(0.8, 0), c, mat(x + (rnd() - 0.5) * 1.6, 0.25 * sc, z + (rnd() - 0.5) * 1.6, rnd(), rnd() * PI, rnd(), sc, sc * (0.5 + rnd() * 0.5), sc));
    }
  }
  for (let k = 0; k < 70; k++) {
    // grass tufts
    const [x, z] = place(1.5, 22);
    for (let b = 0; b < 4; b++) {
      st.add(new THREE.ConeGeometry(0.06, 0.45 + rnd() * 0.3, 3), 0x8fbf3a, mat(x + (rnd() - 0.5) * 0.4, 0.25, z + (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6));
    }
  }
  // Distant mesas on the horizon
  for (let k = 0; k < 9; k++) {
    const x = (k - 4) * 26 + (rnd() - 0.5) * 12;
    const z = -(L + 115 + rnd() * 50);
    const r = 5 + rnd() * 6, h = 4 + rnd() * 6;
    st.add(new THREE.CylinderGeometry(r * 0.75, r, h, 7), 0xd9773f, mat(x, h / 2, z, 0, rnd(), 0, 1, 1, 0.7));
    st.add(new THREE.CylinderGeometry(r * 0.78, r * 0.8, h * 0.18, 7), 0xb8562c, mat(x, h * 0.62, z, 0, rnd(), 0, 1, 1, 0.7));
    st.add(new THREE.CylinderGeometry(r * 0.72, r * 0.75, 0.6, 7), 0xf09a5a, mat(x, h + 0.3, z, 0, rnd(), 0, 1, 1, 0.7));
  }
  scene.add(st.build(vcMat({ roughness: 0.85 })));

  // Puffy clouds, drifting
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35, fog: false });
  for (let k = 0; k < 9; k++) {
    const cb = new Batch();
    for (let p = 0; p < 6; p++) {
      const r = 2.5 + rnd() * 3;
      cb.add(new THREE.SphereGeometry(r, 10, 8), 0xffffff, mat((p - 2.5) * 3 + rnd() * 2, rnd() * 1.5, rnd() * 3, 0, 0, 0, 1, 0.6, 1));
    }
    const c = new THREE.Mesh(mergeGeos(cb.parts), cloudMat);
    c.position.set((rnd() - 0.5) * 220, 26 + rnd() * 14, -(L + 80 + rnd() * 70));
    c.userData.speed = 0.6 + rnd() * 0.8;
    scene.add(c);
    clouds.push(c);
  }
  return { clouds };
}
