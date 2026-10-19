// Procedural models and textures for the dungeon: the hero, enemies,
// pickups and room pieces. Built from primitives in code, no asset files.
// Dark, muted palette; the only saturated colours are light sources, blood
// and the things you want the player to notice.

import * as THREE from 'three';
import { Cfg } from './config.js';
import { mat, mergeGeos, Batch, vcMat, canvasTex, seeded } from './gfx.js';
import { tileIndex, tileX, tileZ } from './dungeon.js';

const PI = Math.PI;

// --- Textures --------------------------------------------------------------
function noise(g, w, h, n, alpha, rnd, size = 2) {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(rnd() * 255);
    g.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    g.fillRect(rnd() * w, rnd() * h, size, size);
  }
}

export const floorTexture = (() => {
  let cache = null;
  return () => cache || (cache = canvasTex(512, 512, (g, w, h) => {
    const rnd = seeded(31);
    g.fillStyle = '#2a2622';
    g.fillRect(0, 0, w, h);
    const n = 4, s = w / n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v = 52 + rnd() * 22;
        g.fillStyle = `rgb(${v},${v * 0.92},${v * 0.84})`;
        g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
        // worn edges
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(i * s + 3, j * s + s - 12, s - 6, 9);
        g.fillStyle = 'rgba(255,240,220,0.05)';
        g.fillRect(i * s + 3, j * s + 3, s - 6, 6);
      }
    }
    noise(g, w, h, 9000, 0.08, rnd);
    // cracks
    g.strokeStyle = 'rgba(10,8,6,0.6)';
    g.lineWidth = 2;
    for (let k = 0; k < 9; k++) {
      let x = rnd() * w, y = rnd() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let s2 = 0; s2 < 5; s2++) { x += (rnd() - 0.5) * 50; y += (rnd() - 0.5) * 50; g.lineTo(x, y); }
      g.stroke();
    }
    // grime blotches
    for (let k = 0; k < 14; k++) {
      const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 60;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(15,12,8,0.35)');
      grad.addColorStop(1, 'rgba(15,12,8,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }, Cfg.ROOM_W / 4, Cfg.ROOM_D / 4));
})();

export const wallTexture = (() => {
  let cache = null;
  return () => cache || (cache = canvasTex(256, 256, (g, w, h) => {
    const rnd = seeded(77);
    g.fillStyle = '#14110f';
    g.fillRect(0, 0, w, h);
    const rows = 8, cols = 4, bh = h / rows, bw = w / cols;
    for (let r = 0; r < rows; r++) {
      for (let k = -1; k < cols; k++) {
        const x = k * bw + (r % 2 ? bw / 2 : 0);
        const v = 40 + rnd() * 26;
        g.fillStyle = `rgb(${v * 1.05},${v * 0.9},${v * 0.8})`;
        g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(x + 2, r * bh + bh - 7, bw - 4, 5);
      }
    }
    noise(g, w, h, 4000, 0.1, rnd);
    // damp streaks
    for (let k = 0; k < 6; k++) {
      const x = rnd() * w;
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(20,30,15,0.35)');
      grad.addColorStop(1, 'rgba(20,30,15,0)');
      g.fillStyle = grad;
      g.fillRect(x, 0, 6 + rnd() * 10, h * (0.4 + rnd() * 0.6));
    }
  }, 3, 1));
})();

export const bloodTexture = (() => {
  let cache = null;
  return () => cache || (cache = canvasTex(128, 128, (g, w, h) => {
    const rnd = seeded(5);
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(90,8,10,0.85)';
    for (let k = 0; k < 9; k++) {
      const r = 10 + rnd() * 24;
      g.beginPath();
      g.arc(w / 2 + (rnd() - 0.5) * 50, h / 2 + (rnd() - 0.5) * 50, r, 0, PI * 2);
      g.fill();
    }
    for (let k = 0; k < 18; k++) {
      g.beginPath();
      g.arc(rnd() * w, rnd() * h, 2 + rnd() * 5, 0, PI * 2);
      g.fill();
    }
  }));
})();

function veinTexture(base, vein) {
  return canvasTex(256, 128, (g, w, h) => {
    const rnd = seeded(13);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = vein;
    for (let k = 0; k < 26; k++) {
      g.lineWidth = 1 + rnd() * 2.5;
      let x = rnd() * w, y = rnd() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
    noise(g, w, h, 1500, 0.08, rnd);
  });
}

export function iconTexture(emoji, size = 128) {
  return canvasTex(size, size, (g, w, h) => {
    g.font = `${Math.floor(size * 0.72)}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.8)';
    g.shadowBlur = 8;
    g.fillText(emoji, w / 2, h / 2 + size * 0.05);
  });
}

export function glowTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

// --- Hero --------------------------------------------------------------------
// A small hooded wanderer with glowing eyes and a lantern. Faces +Z.
export function buildHero() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const b = new Batch();
  const CLOAK = 0x3b342d, CLOAK_D = 0x2a241f, ROPE = 0x6b5a3e;
  b.add(new THREE.LatheGeometry([
    new THREE.Vector2(0.0, 0.02), new THREE.Vector2(0.33, 0.02), new THREE.Vector2(0.3, 0.2),
    new THREE.Vector2(0.24, 0.42), new THREE.Vector2(0.17, 0.56), new THREE.Vector2(0.0, 0.6),
  ], 14), CLOAK);
  // ragged hem
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * PI * 2;
    b.add(new THREE.ConeGeometry(0.07, 0.14, 4), CLOAK_D, mat(Math.sin(a) * 0.31, 0.02, Math.cos(a) * 0.31, PI, a, 0));
  }
  b.add(new THREE.TorusGeometry(0.24, 0.025, 4, 16), ROPE, mat(0, 0.36, 0, PI / 2));
  // hood
  b.add(new THREE.SphereGeometry(0.23, 14, 10), CLOAK, mat(0, 0.74, -0.02, 0, 0, 0, 1, 1.05, 1.05));
  b.add(new THREE.ConeGeometry(0.12, 0.25, 8), CLOAK, mat(0, 0.9, -0.12, -0.9, 0, 0));
  b.add(new THREE.SphereGeometry(0.16, 12, 8), 0x050405, mat(0, 0.72, 0.1, 0, 0, 0, 1, 1.05, 0.7));
  // sleeves and pale hands
  for (const sx of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.06, 0.08, 0.28, 6), CLOAK_D, mat(sx * 0.22, 0.4, 0.06, 0.5, 0, sx * 0.35));
    b.add(new THREE.SphereGeometry(0.05, 6, 4), 0xc9bfae, mat(sx * 0.27, 0.27, 0.13));
  }
  const cloak = b.build(vcMat({ roughness: 0.9 }));
  body.add(cloak);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), eyeMat);
    e.position.set(sx * 0.06, 0.74, 0.2);
    e.scale.set(1, 0.7, 1);
    body.add(e);
  }
  // lantern in the right hand
  const lantern = new THREE.Group();
  const lb = new Batch();
  lb.add(new THREE.BoxGeometry(0.1, 0.13, 0.1), 0x2a2420, mat(0, 0, 0));
  lb.add(new THREE.ConeGeometry(0.08, 0.06, 4), 0x2a2420, mat(0, 0.09, 0, 0, PI / 4, 0));
  lb.add(new THREE.TorusGeometry(0.035, 0.008, 4, 8), 0x2a2420, mat(0, 0.14, 0));
  lantern.add(lb.build(vcMat({ metalness: 0.6, roughness: 0.4 })));
  const flame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.07), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
  lantern.add(flame);
  lantern.position.set(0.3, 0.2, 0.16);
  body.add(lantern);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, lantern, flame };
}

// --- Enemies ------------------------------------------------------------------
// Each builder returns { root, parts } where parts are animated by the
// renderer. Models face +Z.
const ENEMY_BUILDERS = {
  fly() {
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const b = new Batch();
    b.add(new THREE.SphereGeometry(0.12, 10, 8), 0x1c1f17, mat(0, 0, 0.04));
    b.add(new THREE.SphereGeometry(0.13, 10, 8), 0x2b2e1d, mat(0, -0.02, -0.12, 0, 0, 0, 0.9, 0.85, 1.25));
    for (let k = 0; k < 3; k++) b.add(new THREE.TorusGeometry(0.11, 0.012, 4, 10), 0x4a4a2a, mat(0, -0.02, -0.08 - k * 0.07));
    for (const sx of [-1, 1]) {
      b.add(new THREE.SphereGeometry(0.055, 8, 6), 0x8a0d0d, mat(sx * 0.07, 0.04, 0.12));
      for (let l = 0; l < 3; l++) b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 3), 0x111111, mat(sx * 0.08, -0.12, -l * 0.07, 0, 0, sx * 0.5));
    }
    body.add(b.build(vcMat({ roughness: 0.35, metalness: 0.2 })));
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xc8d0c0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    const wings = [];
    for (const sx of [-1, 1]) {
      const g = new THREE.CircleGeometry(0.17, 10);
      g.scale(0.7, 1.4, 1);
      g.rotateX(PI / 2);
      g.translate(sx * 0.12, 0, -0.06);
      const w = new THREE.Mesh(g, wingMat);
      w.position.set(sx * 0.03, 0.09, 0);
      body.add(w);
      wings.push(w);
    }
    body.position.y = 0.9;
    return { root, body, wings };
  },
  grub() {
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const segs = [];
    const segMat = vcMat({ roughness: 0.55 });
    for (let k = 0; k < 5; k++) {
      const r = 0.24 - k * 0.035;
      const parts = [{ geo: new THREE.SphereGeometry(r, 12, 8), color: k % 2 ? 0x9b8b6c : 0xa89878 }];
      if (k === 0) {
        parts.push({ geo: new THREE.TorusGeometry(0.09, 0.03, 6, 10), color: 0x3a1010, matrix: mat(0, 0.02, r * 0.9) });
        parts.push({ geo: new THREE.CircleGeometry(0.08, 10), color: 0x120404, matrix: mat(0, 0.02, r * 0.92) });
      }
      const m = new THREE.Mesh(mergeGeos(parts), segMat);
      m.castShadow = true;
      m.position.set(0, r, -k * 0.24);
      body.add(m);
      segs.push(m);
    }
    return { root, body, segs };
  },
  eye() {
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14),
      new THREE.MeshStandardMaterial({ map: veinTexture('#d9cfc0', 'rgba(140,20,20,0.75)'), roughness: 0.3 }));
    sclera.castShadow = true;
    body.add(sclera);
    const b = new Batch();
    b.add(new THREE.SphereGeometry(0.14, 14, 10), 0x8a6a1a, mat(0, 0, 0.21, 0, 0, 0, 1, 1, 0.5));
    b.add(new THREE.SphereGeometry(0.075, 10, 8), 0x050202, mat(0, 0, 0.27, 0, 0, 0, 1, 1, 0.5));
    b.add(new THREE.SphereGeometry(0.025, 6, 4), 0xffffff, mat(0.04, 0.04, 0.3));
    b.add(new THREE.ConeGeometry(0.08, 0.5, 8), 0x6a1414, mat(0, -0.05, -0.42, -PI / 2 - 0.3, 0, 0));
    body.add(b.build(vcMat({ roughness: 0.25 })));
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 8, 0, PI * 2, 0, PI / 2), new THREE.MeshStandardMaterial({ color: 0x6e4a40, roughness: 0.6 }));
    lid.rotation.x = -PI / 2;
    lid.scale.set(1, 1, 0.02);
    body.add(lid);
    body.position.y = 1.0;
    return { root, body, lid };
  },
  ram() {
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const BONE = 0xcfc4a8, BONE_D = 0x9e9378;
    const b = new Batch();
    b.add(new THREE.BoxGeometry(0.08, 0.08, 0.7), BONE_D, mat(0, 0.55, -0.1));
    for (let k = 0; k < 4; k++) b.add(new THREE.TorusGeometry(0.18 - k * 0.015, 0.025, 4, 12, PI * 1.3), BONE, mat(0, 0.45, 0.12 - k * 0.12, 0, PI / 2, PI / 2 + 0.35 * PI));
    for (const [lx, lz] of [[-0.18, 0.15], [0.18, 0.15], [-0.18, -0.35], [0.18, -0.35]]) {
      b.add(new THREE.CylinderGeometry(0.035, 0.025, 0.5, 5), BONE, mat(lx, 0.25, lz));
    }
    // skull and curled horns
    b.add(new THREE.SphereGeometry(0.17, 12, 8), BONE, mat(0, 0.62, 0.34, 0, 0, 0, 1, 0.9, 1.25));
    b.add(new THREE.BoxGeometry(0.16, 0.08, 0.18), BONE, mat(0, 0.54, 0.5));
    for (const sx of [-1, 1]) {
      b.add(new THREE.SphereGeometry(0.045, 6, 4), 0x0a0505, mat(sx * 0.07, 0.65, 0.48));
      b.add(new THREE.TorusGeometry(0.12, 0.04, 6, 12, PI * 1.5), 0x5e5446, mat(sx * 0.15, 0.72, 0.3, 0, PI / 2, 0));
    }
    body.add(b.build(vcMat({ roughness: 0.75 })));
    const glow = new THREE.MeshBasicMaterial({ color: 0xff3a1a });
    for (const sx of [-1, 1]) {
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), glow);
      g.position.set(sx * 0.07, 0.65, 0.51);
      body.add(g);
    }
    body.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { root, body };
  },
  slime() {
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const jelly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 12, 0, PI * 2, 0, PI * 0.62),
      new THREE.MeshStandardMaterial({ color: 0x55702a, roughness: 0.15, transparent: true, opacity: 0.78, emissive: 0x1a2a05, emissiveIntensity: 0.5 }));
    jelly.position.y = 0.0;
    jelly.scale.set(1, 1.1, 1);
    jelly.castShadow = true;
    body.add(jelly);
    const b = new Batch();
    b.add(new THREE.SphereGeometry(0.14, 10, 8), 0x2a3a10, mat(0.05, 0.2, -0.05));
    b.add(new THREE.DodecahedronGeometry(0.06), 0xc9bfae, mat(-0.12, 0.14, 0.05));
    for (const sx of [-1, 1]) {
      b.add(new THREE.SphereGeometry(0.06, 8, 6), 0xd8d0b0, mat(sx * 0.11, 0.3, 0.26));
      b.add(new THREE.SphereGeometry(0.03, 6, 4), 0x0a0a05, mat(sx * 0.11, 0.3, 0.31));
    }
    body.add(b.build(vcMat({ roughness: 0.4 })));
    return { root, body, jelly };
  },
  bloat() {
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const flesh = new THREE.Mesh(new THREE.SphereGeometry(1.15, 28, 20),
      new THREE.MeshStandardMaterial({ map: veinTexture('#7a4c46', 'rgba(60,10,20,0.7)'), roughness: 0.55 }));
    flesh.position.y = 1.0;
    flesh.scale.set(1, 0.92, 1);
    flesh.castShadow = true;
    body.add(flesh);
    const b = new Batch();
    const rnd = seeded(9);
    // tumours
    for (let k = 0; k < 9; k++) {
      const a = rnd() * PI * 2, h = 0.6 + rnd() * 0.9;
      b.add(new THREE.SphereGeometry(0.18 + rnd() * 0.2, 10, 8), 0x8a5650, mat(Math.cos(a) * 1.0, h, Math.sin(a) * 1.0));
    }
    // eyes, mostly towards the front
    for (let k = 0; k < 6; k++) {
      const a = PI / 2 + (rnd() - 0.5) * 2.2, h = 1.2 + rnd() * 0.6;
      const x = Math.cos(a) * 0.95, z = Math.sin(a) * 0.95;
      const s = 0.12 + rnd() * 0.1;
      b.add(new THREE.SphereGeometry(s, 10, 8), 0xd8cfc0, mat(x, h, z));
      b.add(new THREE.SphereGeometry(s * 0.55, 8, 6), 0x7a1010, mat(x * 1.08, h, z * 1.08));
      b.add(new THREE.SphereGeometry(s * 0.28, 6, 4), 0x050000, mat(x * 1.12, h, z * 1.12));
    }
    // mouth with teeth
    b.add(new THREE.SphereGeometry(0.42, 14, 10), 0x1a0306, mat(0, 0.75, 0.88, 0, 0, 0, 1.4, 0.6, 0.5));
    for (let k = 0; k < 8; k++) {
      const x = -0.42 + k * 0.12;
      b.add(new THREE.ConeGeometry(0.04, 0.14, 4), 0xd8d0b8, mat(x, 0.95, 1.02, PI, 0, 0));
      b.add(new THREE.ConeGeometry(0.035, 0.12, 4), 0xd8d0b8, mat(x + 0.06, 0.55, 1.0));
    }
    const deco = b.build(vcMat({ roughness: 0.45 }));
    body.add(deco);
    return { root, body, flesh };
  },
};

export function buildEnemy(type) {
  const m = ENEMY_BUILDERS[type]();
  m.root.traverse((o) => {
    if (o.isMesh && o.material && o.material.emissive !== undefined && !o.material.userData.shared) {
      // per-enemy material copy so hit flashes / status tints stay local
      o.material = o.material.clone();
    }
  });
  return m;
}

// --- Pickups --------------------------------------------------------------------
export function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.18);
  s.bezierCurveTo(-0.05, -0.12, -0.2, -0.04, -0.2, 0.06);
  s.bezierCurveTo(-0.2, 0.16, -0.08, 0.2, 0, 0.11);
  s.bezierCurveTo(0.08, 0.2, 0.2, 0.16, 0.2, 0.06);
  s.bezierCurveTo(0.2, -0.04, 0.05, -0.12, 0, -0.18);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
  g.translate(0, 0, -0.04);
  return g;
}

export function buildPedestal() {
  const b = new Batch();
  b.add(new THREE.CylinderGeometry(0.38, 0.45, 0.16, 12), 0x3a3631, mat(0, 0.08, 0));
  b.add(new THREE.CylinderGeometry(0.26, 0.3, 0.5, 12), 0x4a453e, mat(0, 0.4, 0));
  b.add(new THREE.CylinderGeometry(0.36, 0.3, 0.12, 12), 0x3a3631, mat(0, 0.7, 0));
  return b.build(vcMat({ roughness: 0.85 }));
}

export function buildTrapdoor() {
  const g = new THREE.Group();
  const b = new Batch();
  b.add(new THREE.BoxGeometry(1.3, 0.06, 1.3), 0x2a1c12, mat(0, 0.03, 0));
  b.add(new THREE.BoxGeometry(1.05, 0.07, 1.05), 0x020101, mat(0, 0.04, 0));
  for (const [x, z, sx, sz] of [[0, 0.62, 1.4, 0.12], [0, -0.62, 1.4, 0.12], [0.62, 0, 0.12, 1.4], [-0.62, 0, 0.12, 1.4]]) {
    b.add(new THREE.BoxGeometry(sx, 0.12, sz), 0x4a3422, mat(x, 0.06, z));
  }
  for (let k = 0; k < 3; k++) b.add(new THREE.BoxGeometry(0.6, 0.04, 0.06), 0x5a4030, mat(0, 0.05 - k * 0.002, 0.3 - k * 0.3));
  g.add(b.build(vcMat({ roughness: 0.9 }), false));
  return g;
}

// --- Rooms ----------------------------------------------------------------------
const W = Cfg.ROOM_W, D = Cfg.ROOM_D, HW = W / 2, HD = D / 2;
const WALL_H = 1.5, WALL_T = 1.0;

/** Builds the static meshes of one room. Returns { group, doors, candles }. */
export function buildRoom(room, floor) {
  const group = new THREE.Group();
  const rnd = seeded(room.key * 131 + floor * 977 + 3);
  const tint = [0xffffff, 0xd8e0ff, 0xffd8c8, 0xffc8c8][floor % 4];

  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.92, color: tint });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floorMesh.rotation.x = -PI / 2;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Walls with door gaps; textured boxes
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.9, color: tint });
  const addWall = (x, z, w, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wallMat);
    m.position.set(x, WALL_H / 2, -z);
    m.receiveShadow = true;
    m.castShadow = true;
    group.add(m);
  };
  const g = Cfg.DOOR_HALF;
  for (const [dir, z] of [['n', HD + WALL_T / 2], ['s', -HD - WALL_T / 2]]) {
    const full = W + WALL_T * 2;
    if (room.doors[dir]) {
      const seg = (full / 2) - g;
      addWall(-g - seg / 2, z, seg, WALL_T);
      addWall(g + seg / 2, z, seg, WALL_T);
    } else addWall(0, z, full, WALL_T);
  }
  for (const [dir, x] of [['e', HW + WALL_T / 2], ['w', -HW - WALL_T / 2]]) {
    if (room.doors[dir]) {
      const seg = HD - g;
      addWall(x, -g - seg / 2, WALL_T, seg);
      addWall(x, g + seg / 2, WALL_T, seg);
    } else addWall(x, 0, WALL_T, D);
  }

  const st = new Batch();
  // dark cap along the wall tops and corner pillars
  for (const [x, z, w, d] of [[0, HD + WALL_T / 2, W + 2, WALL_T + 0.1], [0, -HD - WALL_T / 2, W + 2, WALL_T + 0.1], [HW + WALL_T / 2, 0, WALL_T + 0.1, D], [-HW - WALL_T / 2, 0, WALL_T + 0.1, D]]) {
    st.add(new THREE.BoxGeometry(w, 0.1, d), 0x4a423a, mat(x, WALL_H + 0.05, -z));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    st.add(new THREE.BoxGeometry(0.5, WALL_H + 0.3, 0.5), 0x4a423a, mat(sx * (HW + 0.1), (WALL_H + 0.3) / 2, -sz * (HD + 0.1)));
  }
  // skirting stones
  for (const [x, z, w, d] of [[0, HD - 0.06, W, 0.12], [0, -HD + 0.06, W, 0.12], [HW - 0.06, 0, 0.12, D], [-HW + 0.06, 0, 0.12, D]]) {
    st.add(new THREE.BoxGeometry(w, 0.12, d), 0x1e1a17, mat(x, 0.06, -z));
  }

  // Door frames
  const doors = {};
  for (const dir of ['n', 's', 'e', 'w']) {
    if (!room.doors[dir]) continue;
    const vertical = dir === 'n' || dir === 's';
    const sign = dir === 'n' || dir === 'e' ? 1 : -1;
    const px = vertical ? 0 : sign * (HW + 0.05);
    const pz = vertical ? sign * (HD + 0.05) : 0;
    const ry = vertical ? 0 : PI / 2;
    const frameCol = room.type === 'boss' ? 0x6a2020 : 0x5e554c;
    const m = (lx, ly, lz, rx = 0, rz = 0) => new THREE.Matrix4().makeTranslation(px, 0, -pz).multiply(mat(0, 0, 0, 0, ry, 0)).multiply(mat(lx, ly, lz, rx, 0, rz));
    for (const s of [-1, 1]) st.add(new THREE.BoxGeometry(0.28, 1.5, 1.15), frameCol, m(s * (g + 0.1), 0.75, 0));
    st.add(new THREE.BoxGeometry(g * 2 + 0.5, 0.3, 1.15), frameCol, m(0, 1.5, 0));
    st.add(new THREE.BoxGeometry(0.3, 0.42, 1.2), room.type === 'boss' ? 0x8a2a2a : 0x6e655a, m(0, 1.62, 0));
    st.add(new THREE.BoxGeometry(g * 2, 0.02, 1.0), 0x0a0807, m(0, 0.005, 0));
    doors[dir] = { px, pz, ry };
  }

  // Rocks
  for (let j = 0; j < D; j++) {
    for (let i = 0; i < W; i++) {
      if (room.tiles[tileIndex(i, j)] !== 1) continue;
      const x = tileX(i), z = tileZ(j);
      const c = [0x45403a, 0x3a3631, 0x504a42][Math.floor(rnd() * 3)];
      st.add(new THREE.DodecahedronGeometry(0.5, 0), c, mat(x, 0.32, -z, rnd(), rnd() * PI, rnd(), 0.95, 0.75, 0.95));
      st.add(new THREE.DodecahedronGeometry(0.22, 0), c, mat(x + (rnd() - 0.5) * 0.5, 0.12, -z + (rnd() - 0.5) * 0.5, rnd(), rnd(), 0));
    }
  }

  // Bones and skulls scattered about
  const freeTile = () => {
    for (let k = 0; k < 20; k++) {
      const i = Math.floor(rnd() * W), j = Math.floor(rnd() * D);
      if (!room.tiles[tileIndex(i, j)]) return [tileX(i) + (rnd() - 0.5) * 0.6, tileZ(j) + (rnd() - 0.5) * 0.6];
    }
    return [0, 0];
  };
  const nBones = 2 + Math.floor(rnd() * 4);
  for (let k = 0; k < nBones; k++) {
    const [x, z] = freeTile();
    const a = rnd() * PI;
    if (rnd() < 0.35) {
      st.add(new THREE.SphereGeometry(0.11, 8, 6), 0xbdb39a, mat(x, 0.09, -z, 0, a, 0, 1, 0.9, 1.15));
      st.add(new THREE.SphereGeometry(0.028, 4, 3), 0x0a0808, mat(x + Math.sin(a) * 0.08 + Math.cos(a) * 0.04, 0.11, -z + Math.cos(a) * 0.08));
    } else {
      st.add(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 5), 0xa89f88, mat(x, 0.03, -z, PI / 2, a, 0));
      st.add(new THREE.SphereGeometry(0.04, 5, 4), 0xa89f88, mat(x + Math.sin(a) * 0.18, 0.04, -z + Math.cos(a) * 0.18));
    }
  }
  group.add(st.build(vcMat({ roughness: 0.9 })));

  // Blood stains baked into the floor
  const nStains = Math.floor(rnd() * 3);
  const bloodMat = new THREE.MeshBasicMaterial({ map: bloodTexture(), transparent: true, depthWrite: false, color: 0x8a6a6a });
  for (let k = 0; k < nStains; k++) {
    const [x, z] = freeTile();
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), bloodMat);
    s.rotation.set(-PI / 2, 0, rnd() * PI);
    s.position.set(x, 0.012, -z);
    group.add(s);
  }

  // Candles on the walls (flames are animated by the renderer)
  const candles = [];
  const holder = new Batch();
  const spots = [[-HW + 0.18, 2.5], [HW - 0.18, -2.5], [-HW + 0.18, -3.5], [HW - 0.18, 3.5]];
  const nCandles = 2 + Math.floor(rnd() * 3);
  for (let k = 0; k < nCandles; k++) {
    const [x, z] = spots[k];
    holder.add(new THREE.BoxGeometry(0.16, 0.05, 0.16), 0x2a2420, mat(x, 0.82, -z));
    holder.add(new THREE.CylinderGeometry(0.045, 0.05, 0.2, 8), 0xd8cfb0, mat(x, 0.95, -z));
    candles.push({ x, y: 1.1, z });
  }
  if (nCandles) group.add(holder.build(vcMat({ roughness: 0.6 })));

  return { group, doors, candles };
}

/** Door leaf that closes a doorway while enemies are alive. */
export function buildDoorLeaf(type) {
  const b = new Batch();
  const wood = type === 'boss' ? 0x3a1010 : type === 'treasure' ? 0x5a4a20 : 0x3a2a1c;
  b.add(new THREE.BoxGeometry(Cfg.DOOR_HALF * 2, 1.3, 0.12), wood, mat(0, 0.65, 0));
  for (let k = -2; k <= 2; k++) b.add(new THREE.BoxGeometry(0.05, 1.3, 0.14), 0x1a1210, mat(k * 0.28, 0.65, 0));
  for (const y of [0.3, 1.0]) b.add(new THREE.BoxGeometry(Cfg.DOOR_HALF * 2, 0.08, 0.16), 0x2a2a2e, mat(0, y, 0));
  if (type === 'boss') {
    b.add(new THREE.SphereGeometry(0.16, 8, 6), 0xcfc4a8, mat(0, 1.05, 0.1, 0, 0, 0, 1, 1, 0.6));
    for (const sx of [-1, 1]) b.add(new THREE.SphereGeometry(0.04, 4, 3), 0x050000, mat(sx * 0.06, 1.07, 0.18));
  }
  return b.build(vcMat({ roughness: 0.8 }));
}
