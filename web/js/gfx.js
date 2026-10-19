// Small three.js helpers shared by the model builders: transform matrices,
// geometry merging with vertex colours, canvas textures and a seeded PRNG.

import * as THREE from 'three';

const PI = Math.PI;

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

// Cel shading: three flat tones instead of smooth lighting, for a drawn look.
let toonRamp = null;
export function toonGradient() {
  if (toonRamp) return toonRamp;
  const data = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  toonRamp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
  toonRamp.needsUpdate = true;
  return toonRamp;
}

/** Cel-shaded material. Accepts the usual options; PBR-only ones are dropped. */
export function toon(opts = {}) {
  const { roughness, metalness, flatShading, ...rest } = opts;
  void roughness; void metalness; void flatShading;
  return new THREE.MeshToonMaterial({ gradientMap: toonGradient(), ...rest });
}

export function vcMat(extra = {}) {
  return toon({ vertexColors: true, ...extra });
}

// Ink outlines: a black copy of the mesh pushed out along its normals and
// drawn from the inside (the "inverted hull" trick).
const outlineCache = new Map();
export function outlineMaterial(thickness = 0.025) {
  const key = thickness.toFixed(3);
  if (outlineCache.has(key)) return outlineCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color: 0x0a0605, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>\n  transformed += normalize(normal) * ${key};`);
  };
  m.userData.outline = true;
  outlineCache.set(key, m);
  return m;
}

/** Adds ink outlines to every opaque mesh under root. */
export function addOutlines(root, thickness = 0.025) {
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh && !o.material.transparent && !o.material.userData.outline && !o.userData.noOutline) meshes.push(o);
  });
  for (const m of meshes) {
    const ol = new THREE.Mesh(m.geometry, outlineMaterial(thickness));
    ol.userData.noOutline = true;
    m.add(ol);
  }
  return root;
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

