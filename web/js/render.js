// Three.js renderer. Reads a World every frame and draws it; never changes
// game state. Sim (x, z) maps to three.js (x, 0, -z). The models themselves
// live in models.js.

import * as THREE from 'three';
import { Cfg } from './config.js';
import {
  RIG, mobGeometries, hordeGeometry, buildCannon, buildPlayerWall, buildCastle, buildTurret,
  buildEnvironment, waveFlag, stripeTexture, Batch, vcMat, mat, seeded,
} from './models.js';

const COL = {
  blue: 0x2f7dff,
  giant: 0xffc02e,
  red: 0xff3434,
  gold: 0xffc23d,
};

const GATE_COLORS = { 2: '#33b4ff', 3: '#a64dff', 4: '#ff4fd8' };
const gateColor = (g) => (g.kind === 'add' ? '#2fe07a' : g.kind === 'div' ? '#ff3030' : GATE_COLORS[g.value] || '#ffbf1f');
const gateText = (g) => (g.kind === 'add' ? `+${g.value}` : g.kind === 'div' ? `÷${g.value}` : `×${g.value}`);

// Element colours: 1 fire, 2 ice, 3 poison
const EL_BODY = [0x2f7dff, 0xff7a1a, 0x5fd0ff, 0x4fd14a];
const EL_FX = [0xffb347, 0xff6a1a, 0x8fe8ff, 0x6fe36a];
const RED_KIND = { unit: 0xff3434, runner: 0xff7a3a, shield: 0xd62f3a, bomber: 0x9b2335, brute: 0xb3122e, boss: 0x7a0a1e };
const RED_SCALE = { unit: 1.6, runner: 1.3, shield: 1.75, bomber: 1.7, brute: 3.4, boss: 6.2 };
const tmpC2 = new THREE.Color();
const BURN = new THREE.Color(0xffa020), FROST = new THREE.Color(0xa8ecff), VENOM = new THREE.Color(0x8ad04a), WHITE = new THREE.Color(0xffffff);
const CONFETTI = [0xff3b6b, 0xffc23d, 0x3fd2ff, 0x5ce65c, 0xb36bff, 0xffffff];

const MAX_PARTICLES = 1000;
const MAX_GIANTS = 24;
const HORDE = 520;
const tmpM = new THREE.Matrix4();
const tmpL = new THREE.Matrix4();
const tmpO = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const MAX_BLUE_DRAW = 900;
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpE = new THREE.Euler();
const tmpC = new THREE.Color();

// Text drawn onto a canvas, used for gate labels, hp tags and floaters.
function makeLabel(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, ctx: canvas.getContext('2d'), tex, text: null };
}

function drawLabel(label, text, opts = {}) {
  if (label.text === text && !opts.force) return;
  label.text = text;
  const { canvas, ctx } = label;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (opts.bar !== undefined) {
    // HP bar under the number
    const bw = canvas.width * 0.86, bh = canvas.height * 0.2;
    const bx = (canvas.width - bw) / 2, by = canvas.height * 0.72;
    ctx.fillStyle = 'rgba(40,0,10,0.85)';
    roundRect(ctx, bx - 4, by - 4, bw + 8, bh + 8, 10); ctx.fill();
    const grad = ctx.createLinearGradient(0, by, 0, by + bh);
    grad.addColorStop(0, '#ff7a6b');
    grad.addColorStop(1, '#d81e2c');
    ctx.fillStyle = grad;
    roundRect(ctx, bx, by, Math.max(bh, bw * opts.bar), bh, 7); ctx.fill();
  }
  const size = opts.size || canvas.height * 0.62;
  ctx.font = `900 ${size}px "Arial Black", "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const y = opts.bar !== undefined ? canvas.height * 0.36 : canvas.height * 0.52;
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = opts.stroke || '#1b1033';
  ctx.strokeText(text, canvas.width / 2, y);
  ctx.fillStyle = opts.color || '#ffffff';
  ctx.fillText(text, canvas.width / 2, y);
  label.tex.needsUpdate = true;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function instanced(geo, material, count, { color = false, shadow = false } = {}) {
  const im = new THREE.InstancedMesh(geo, material, count);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  im.castShadow = shadow;
  if (color) im.setColorAt(0, tmpC.set(0xffffff));
  im.count = 0;
  return im;
}

export class Renderer {
  constructor(container) {
    this.container = container;
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.scene.background = this.skyTexture();
    this.scene.fog = new THREE.Fog(0xf7dcb0, 90, 190);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);
    this.camBase = new THREE.Vector3(0, 19, 6.5);
    this.camLook = new THREE.Vector3(0, 0, -19);

    this.buildLights();
    this.env = buildEnvironment(this.scene);
    this.buildCannon();
    this.buildBase();
    this.buildMobs();
    this.buildHorde();
    this.buildParticles();
    this.buildFx();

    this.gateObjs = [];
    this.tags = [];          // hp tags over giants / brutes
    this.floaters = [];
    this.world = null;
    this.time = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  skyTexture() {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#3fa8ff');
    grad.addColorStop(0.55, '#a9dcff');
    grad.addColorStop(1, '#ffe4b8');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Keep the lane filling the width whatever the phone's shape.
    const hfov = 60 * Math.PI / 180;
    const vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180 / Math.PI;
    this.camera.fov = Math.min(78, Math.max(45, vfov));
    this.camera.updateProjectionMatrix();
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xcfeaff, 0xe8b57a, 1.2));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.5);
    sun.position.set(10, 26, 4);
    sun.target.position.set(0, 0, -24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 95;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
  }

  buildCannon() {
    const c = buildCannon();
    c.root.position.set(0, 0.2, -Cfg.CANNON_Z + 0.6);
    c.root.scale.setScalar(0.85);
    c.root.traverse((o) => { if (o.isMesh && o !== c.flash) o.castShadow = true; });
    this.scene.add(c.root);
    this.cannon = c.root;
    this.barrel = c.barrel;
    this.flash = c.flash;

    const wall = buildPlayerWall();
    this.scene.add(wall.group);
    this.wallMats = wall.mats;
  }

  buildBase() {
    const L = Cfg.LANE_LEN;
    const c = buildCastle();
    c.group.position.set(0, 0.2, -L);
    this.scene.add(c.group);
    this.base = c.group;
    this.baseMats = c.mats;
    this.torches = c.flames;
    this.banners = c.banners;
    this.flags = c.flags;

    // HP sign floating above the base
    this.baseLabel = makeLabel(512, 200);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.baseLabel.tex, depthTest: false, transparent: true }));
    sprite.scale.set(9, 3.5, 1);
    sprite.position.set(0, 11.0, -L - 1);
    sprite.renderOrder = 10;
    this.scene.add(sprite);
    this.baseSprite = sprite;
  }

  buildMobs() {
    const g = mobGeometries();
    const n = MAX_BLUE_DRAW + Cfg.MAX_RED + 8;
    const tinted = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.05 });
    const shiny = vcMat({ roughness: 0.2, metalness: 0.1 });
    const metal = vcMat({ roughness: 0.35, metalness: 0.45 });
    this.mob = {
      body: instanced(g.body, tinted, n, { color: true, shadow: true }),
      legs: instanced(g.leg, tinted, n * 2, { color: true, shadow: true }),
      arms: instanced(g.arm, tinted, n * 2, { color: true }),
      eyes: instanced(g.eyes, shiny, n),
      pupils: instanced(g.pupils, shiny, n),
      brows: instanced(g.brows, vcMat(), Cfg.MAX_RED + 8),
      hat: instanced(g.hat, vcMat({ roughness: 0.5, side: THREE.DoubleSide }), Cfg.MAX_BLUE + 8),
      helmet: instanced(g.helmet, metal, Cfg.MAX_RED + 8),
      crown: instanced(g.crown, vcMat({ roughness: 0.25, metalness: 0.7 }), MAX_GIANTS),
      board: instanced(g.board, vcMat({ roughness: 0.7 }), Cfg.MAX_RED + 8),
      bomb: instanced(g.bomb, vcMat({ roughness: 0.3, metalness: 0.3 }), Cfg.MAX_RED + 8),
      bubble: instanced(g.bubble, new THREE.MeshStandardMaterial({
        color: 0x8fe0ff, emissive: 0x2fa8ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.28, depthWrite: false,
      }), 900),
    };
    for (const im of Object.values(this.mob)) this.scene.add(im);
  }

  buildHorde() {
    // The red sea waiting behind the base, like in the ads.
    const L = Cfg.LANE_LEN, H = Cfg.LANE_HALF;
    const im = new THREE.InstancedMesh(hordeGeometry(), vcMat({ roughness: 0.45 }), HORDE);
    const rnd = seeded(4242);
    this.hordeSlots = [];
    for (let i = 0; i < HORDE; i++) {
      this.hordeSlots.push({
        x: (rnd() - 0.5) * (H * 2 + 8),
        z: -(L + 4.5 + rnd() * 34),
        s: 1.5 + rnd() * 0.4,
        ph: rnd() * Math.PI * 2,
        yaw: (rnd() - 0.5) * 0.6,
      });
    }
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    this.horde = im;
    this.scene.add(im);
  }

  buildFx() {
    // Expanding rings for explosions and stomps
    const ringGeo = new THREE.TorusGeometry(1, 0.07, 4, 36);
    ringGeo.rotateX(Math.PI / 2);
    const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    this.ringMesh = instanced(ringGeo, new THREE.MeshBasicMaterial(add), 160, { color: true });
    this.rings = [];
    // Catapult target markers and the rocks themselves
    const markGeo = new THREE.RingGeometry(0.8, 1, 32);
    markGeo.rotateX(-Math.PI / 2);
    this.markMesh = instanced(markGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a, ...add, side: THREE.DoubleSide }), 8);
    this.rockMesh = instanced(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9, flatShading: true }), 8, { shadow: true });
    // Poison clouds
    this.cloudMesh = instanced(new THREE.SphereGeometry(1, 14, 8), new THREE.MeshStandardMaterial({
      color: 0x7bea5a, emissive: 0x3fbf2a, emissiveIntensity: 0.5, transparent: true, opacity: 0.35, depthWrite: false,
    }), Cfg.MAX_CLOUDS);
    // Turret shots
    this.shotMesh = instanced(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial(), 80, { color: true });
    for (const im of [this.ringMesh, this.markMesh, this.rockMesh, this.cloudMesh, this.shotMesh]) this.scene.add(im);
    this.turrets = [];
  }

  buildParticles() {
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.partMesh = instanced(geo, new THREE.MeshStandardMaterial({ roughness: 0.4 }), MAX_PARTICLES, { color: true });
    this.scene.add(this.partMesh);
    this.parts = [];
  }

  // ======================================================================
  // Per-world setup
  // ======================================================================
  setWorld(world) {
    this.world = world;
    for (const o of this.gateObjs) {
      this.scene.remove(o.group);
      o.group.traverse((c) => {
        if (!c.isMesh) return;
        c.geometry.dispose();
        if (c.material.map) c.material.map.dispose();
        c.material.dispose();
      });
    }
    this.gateObjs = world.gates.map((g) => this.makeGate(g));
    for (const t of this.tags) this.scene.remove(t.sprite);
    this.tags = [];
    for (const f of this.floaters) this.scene.remove(f.sprite);
    this.floaters = [];
    this.parts = [];
    this.rings = [];
    this.lastBaseText = null;
    this.celebrated = false;
    // Wall turrets from items
    for (const t of this.turrets) this.scene.remove(t.root);
    this.turrets = [];
    const n = world.mods.turrets;
    for (let i = 0; i < n; i++) {
      const t = buildTurret();
      const x = n === 1 ? 0 : -Cfg.LANE_HALF + 0.6 + (i / (n - 1)) * (Cfg.LANE_HALF * 2 - 1.2);
      t.root.position.set(x, 1.1, 1.1);
      this.scene.add(t.root);
      this.turrets.push(t);
    }
  }

  makeGate(g) {
    const group = new THREE.Group();
    const css = gateColor(g);
    const col = new THREE.Color(css);
    const w = g.halfW * 2, h = Cfg.GATE_HEIGHT;

    const tex = stripeTexture(css);
    tex.repeat.set(Math.max(1, Math.round(w / 1.2)), 1);
    const panelMat = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, opacity: 0.62, emissive: col, emissiveIntensity: 0.3,
      roughness: 0.2, depthWrite: false, side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), panelMat);
    panel.position.y = h / 2 + 0.3;
    panel.renderOrder = 2;
    group.add(panel);

    // Frame: rounded posts on feet, a top bar, glowing caps
    const dark = col.clone().multiplyScalar(0.6).getHex();
    const mid = col.clone().multiplyScalar(0.85).getHex();
    const f = new Batch();
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 + 0.06);
      f.add(new THREE.CylinderGeometry(0.12, 0.14, h + 0.35, 12), mid, mat(x, (h + 0.35) / 2 + 0.12, 0));
      f.add(new THREE.BoxGeometry(0.42, 0.18, 0.5), dark, mat(x, 0.2, 0));
      f.add(new THREE.TorusGeometry(0.135, 0.035, 6, 14), 0xffffff, mat(x, 0.5, 0, Math.PI / 2));
      f.add(new THREE.TorusGeometry(0.135, 0.035, 6, 14), 0xffffff, mat(x, h + 0.1, 0, Math.PI / 2));
    }
    f.add(new THREE.CylinderGeometry(0.09, 0.09, w + 0.1, 10), mid, mat(0, h + 0.47, 0, 0, 0, Math.PI / 2));
    f.add(new THREE.CylinderGeometry(0.06, 0.06, w, 8), dark, mat(0, 0.33, 0, 0, 0, Math.PI / 2));
    group.add(f.build(vcMat({ roughness: 0.3, metalness: 0.35 })));

    const capMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.2 });
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), capMat);
      cap.position.set(sx * (w / 2 + 0.06), h + 0.55, 0);
      group.add(cap);
    }

    const label = makeLabel(256, 128);
    drawLabel(label, gateText(g), { stroke: g.kind === 'div' ? '#4a0000' : '#2a0c4a' });
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.98, 3.8), Math.min(w * 0.49, 1.9)),
      new THREE.MeshBasicMaterial({ map: label.tex, transparent: true, depthWrite: false }));
    lm.position.set(0, h / 2 + 0.35, 0.06);
    lm.renderOrder = 3;
    group.add(lm);
    group.position.set(g.x, 0.2, -g.z);
    this.scene.add(group);
    return { gate: g, group, panelMat, capMat, tex, scale: 1 };
  }

  // ======================================================================
  // Per-frame
  // ======================================================================
  render(dt) {
    const w = this.world;
    this.time += dt;
    this.adaptQuality(dt);
    if (w) {
      this.consumeEvents(w);
      this.updateGates(dt);
      this.updateMobs(w);
      this.updateTags(w);
      this.updateBase(w);
      this.updateCannon(w);
      this.updateFx(w, dt);
    }
    this.updateScenery(dt);
    this.updateParticles(dt);
    this.updateFloaters(dt);
    this.updateCamera(w);
    this.renderer.render(this.scene, this.camera);
  }

  // Drops the render resolution step by step if the phone can't keep up.
  adaptQuality(dt) {
    this.qa = this.qa || { t: 0, frames: 0, ratio: this.renderer.getPixelRatio() };
    const q = this.qa;
    q.t += dt; q.frames++;
    if (q.t < 2.5) return;
    const fps = q.frames / q.t;
    q.t = 0; q.frames = 0;
    if (fps < 40 && q.ratio > 1) {
      q.ratio = Math.max(1, q.ratio - 0.5);
      this.renderer.setPixelRatio(q.ratio);
      this.resize();
    }
  }

  consumeEvents(w) {
    for (const e of w.events) {
      if (e.type === 'pop') {
        let color = e.team === 0 ? COL.blue : e.team === 1 ? COL.red : e.team === 4 ? 0x8a6a4a : COL.gold;
        if (e.el) color = EL_FX[e.el];
        this.burst(e.x, e.z, color, e.big ? 18 : e.team === 3 ? 3 : 5, e.big ? 1.6 : 1);
      } else if (e.type === 'ring') {
        if (this.rings.length < 160) this.rings.push({ x: e.x, z: e.z, r: e.r, t: 0, life: e.stomp ? 0.45 : 0.35, color: e.color });
      } else if (e.type === 'text') {
        this.addFloater(e.x, e.z, e.text, e.color);
      }
    }
    w.events.length = 0;
  }

  updateGates(dt) {
    for (const o of this.gateObjs) {
      const g = o.gate;
      o.group.position.x = g.x;
      o.tex.offset.x -= dt * 0.6;
      o.panelMat.emissiveIntensity = 0.3 + g.flash * 1.2;
      o.capMat.emissiveIntensity = 0.7 + Math.sin(this.time * 4 + g.id) * 0.3 + g.flash;
      if (g.used) o.scale = Math.max(0, o.scale - dt * 5);
      const pulse = 1 + g.flash * 0.06;
      o.group.scale.set(o.scale * pulse, o.scale * pulse, 1);
      o.group.visible = o.scale > 0.01;
    }
  }

  updateMobs(w) {
    const M = this.mob;
    const t = this.time;
    let n = 0, nl = 0, nh = 0, nr = 0, nc = 0, nb = 0, nbo = 0, nbu = 0;

    const part = (im, idx, lx, ly, rx, rz) => {
      tmpL.makeRotationFromEuler(tmpE.set(rx, 0, rz));
      tmpL.setPosition(lx, ly, 0);
      tmpO.multiplyMatrices(tmpM, tmpL);
      im.setMatrixAt(idx, tmpO);
    };

    const write = (m, bodyCol, scale) => {
      const speed = m.giant ? 7 : 13;
      const ph = t * speed + m.phase;
      const swing = Math.sin(ph) * 0.85;
      const bob = Math.abs(Math.cos(ph)) * 0.05 * scale;
      tmpP.set(m.x, 0.24 + bob, -m.z);
      // Blue units run away from the camera, red ones towards it.
      const yaw = (m.team === 0 ? Math.PI : 0) + Math.sin(ph * 0.5) * 0.08 + m.vx * 0.08;
      tmpQ.setFromEuler(tmpE.set(0.08, yaw, Math.sin(ph) * 0.06));
      tmpS.set(scale, scale, scale);
      tmpM.compose(tmpP, tmpQ, tmpS);

      M.body.setMatrixAt(n, tmpM);
      M.body.setColorAt(n, bodyCol);
      M.eyes.setMatrixAt(n, tmpM);
      M.pupils.setMatrixAt(n, tmpM);
      tmpC.copy(bodyCol).multiplyScalar(0.72);
      for (const sx of [-1, 1]) {
        part(M.legs, nl, sx * RIG.hipX, RIG.hipY, swing * sx, 0);
        M.legs.setColorAt(nl, tmpC);
        part(M.arms, nl, sx * RIG.shoulderX, RIG.shoulderY, -swing * sx * 0.9, sx * 0.35);
        M.arms.setColorAt(nl, tmpC);
        nl++;
      }
      if (m.team === 0) {
        if (m.kind === 'giant' && nc < MAX_GIANTS) M.crown.setMatrixAt(nc++, tmpM);
        else if (m.kind !== 'giant') M.hat.setMatrixAt(nh++, tmpM);
        if (m.shield && nbu < 900) M.bubble.setMatrixAt(nbu++, tmpM);
      } else {
        M.helmet.setMatrixAt(nr, tmpM);
        M.brows.setMatrixAt(nr, tmpM);
        nr++;
        if (m.kind === 'shield' && m.armor > 0) M.board.setMatrixAt(nb++, tmpM);
        if (m.kind === 'bomber') M.bomb.setMatrixAt(nbo++, tmpM);
        if (m.kind === 'boss' && nc < MAX_GIANTS) M.crown.setMatrixAt(nc++, tmpM);
      }
      n++;
    };

    for (const m of w.blue) {
      if (n >= MAX_BLUE_DRAW) break;
      const s = m.kind === 'giant' ? 3.6 : (m.small ? 1.2 : 1.6) + Math.min(0.7, (m.hp - 1) * 0.04);
      if (m.kind === 'giant') tmpC2.set(m.el ? EL_BODY[m.el] : COL.giant);
      else if (m.gold) tmpC2.set(COL.giant);
      else tmpC2.set(EL_BODY[m.el]);
      if (m.ghost) tmpC2.lerp(WHITE, 0.45);
      write(m, tmpC2, s);
    }
    for (const m of w.red) {
      tmpC2.set(RED_KIND[m.kind] || COL.red);
      if (m.burn > 0) {
        tmpC2.lerp(BURN, 0.45 + 0.25 * Math.sin(t * 20 + m.phase));
        if (Math.random() < 0.06 && this.parts.length < MAX_PARTICLES) {
          this.parts.push({ x: m.x + (Math.random() - 0.5) * 0.4, y: 1.0, z: -m.z, vx: 0, vy: 2.5, vz: 0, life: 0.4, t: 0, color: 0xff8a1a, s: 0.7, g: -1 });
        }
      }
      if (m.slow > 0) tmpC2.lerp(FROST, 0.6);
      if (m.poisoned > 0) tmpC2.lerp(VENOM, 0.35);
      write(m, tmpC2, RED_SCALE[m.kind] || 1.6);
    }

    M.body.count = M.eyes.count = M.pupils.count = n;
    M.legs.count = M.arms.count = nl;
    M.hat.count = nh;
    M.helmet.count = M.brows.count = nr;
    M.crown.count = nc;
    M.board.count = nb;
    M.bomb.count = nbo;
    M.bubble.count = nbu;
    for (const im of Object.values(M)) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  updateTags(w) {
    const big = [];
    for (const m of w.blue) if (m.giant) big.push(m);
    for (const m of w.red) if (m.giant) big.push(m);
    while (this.tags.length < big.length) {
      const label = makeLabel(256, 112);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: label.tex, depthTest: false, transparent: true }));
      sprite.scale.set(3.0, 1.3, 1);
      sprite.renderOrder = 9;
      this.scene.add(sprite);
      this.tags.push({ label, sprite });
    }
    for (let k = 0; k < this.tags.length; k++) {
      const tag = this.tags[k];
      const m = big[k];
      tag.sprite.visible = !!m;
      if (!m) continue;
      drawLabel(tag.label, String(Math.ceil(m.hp + m.armor)), {
        color: m.team === 0 ? '#ffe680' : '#ffffff', stroke: m.team === 0 ? '#5a3500' : '#4a0010',
      });
      tag.sprite.position.set(m.x, m.kind === 'boss' ? 7 : 4.0, -m.z);
    }
  }

  updateBase(w) {
    const txt = String(Math.max(0, Math.ceil(w.baseHp)));
    if (txt !== this.lastBaseText) {
      this.lastBaseText = txt;
      drawLabel(this.baseLabel, txt, { bar: Math.max(0, w.baseHp / w.baseMax), force: true });
    }
    for (const m of this.baseMats) m.emissiveIntensity = w.baseFlash * 0.45;
    const destroyed = w.state === 'won';
    const k = destroyed ? Math.min(1, w.endTime * 1.5) : 0;
    this.base.position.y = 0.2 - k * 5;
    this.base.rotation.z = destroyed ? Math.sin(w.endTime * 30) * 0.03 * (1 - k) : 0;
    this.base.scale.set(1 + w.baseFlash * 0.03, 1 - w.baseFlash * 0.02, 1);
    this.baseSprite.visible = k < 1;
    this.horde.position.y = -k * 2;
    this.horde.visible = k < 1;
    if (destroyed && !this.celebrated) {
      this.celebrated = true;
      for (let i = 0; i < 6; i++) this.burst((Math.random() - 0.5) * 8, Cfg.LANE_LEN, 0xe0403f, 14, 2.2);
      this.confetti();
    }
    for (const m of this.wallMats) m.emissiveIntensity = w.castleFlash * 0.8;
  }

  updateFx(w, dt) {
    const t = this.time;
    // rings
    let i = 0;
    this.rings = this.rings.filter((r) => (r.t += dt) < r.life);
    for (const r of this.rings) {
      const k = r.t / r.life;
      const sc = r.r * (0.25 + 0.75 * Math.sqrt(k));
      tmpM.compose(tmpP.set(r.x, 0.4 + k * 0.3, -r.z), tmpQ.identity(), tmpS.set(sc, 1 + (1 - k) * 2, sc));
      this.ringMesh.setMatrixAt(i, tmpM);
      this.ringMesh.setColorAt(i, tmpC.set(r.color).multiplyScalar(1 - k));
      i++;
    }
    this.ringMesh.count = i;
    // catapult rocks + markers
    i = 0;
    for (const r of w.rocks) {
      const k = Math.min(1, r.t / r.dur);
      const pulse = 1 + Math.sin(t * 18) * 0.06;
      tmpM.compose(tmpP.set(r.tx, 0.27, -r.tz), tmpQ.identity(), tmpS.setScalar(Cfg.ROCK_RADIUS * pulse * (0.6 + 0.4 * k)));
      this.markMesh.setMatrixAt(i, tmpM);
      const sx = 0, sy = 7, sz = -Cfg.LANE_LEN + 1;
      tmpP.set(sx + (r.tx - sx) * k, sy + (0.4 - sy) * k + Math.sin(k * Math.PI) * 9, sz + (-r.tz - sz) * k);
      tmpQ.setFromEuler(tmpE.set(t * 5, t * 3, 0));
      tmpM.compose(tmpP, tmpQ, tmpS.setScalar(1));
      this.rockMesh.setMatrixAt(i, tmpM);
      i++;
    }
    this.markMesh.count = this.rockMesh.count = i;
    // poison clouds
    i = 0;
    for (const c of w.clouds) {
      const k = c.t / c.life;
      const fade = Math.min(1, (1 - k) * 4) * Math.min(1, c.t * 6);
      const wob = 1 + Math.sin(t * 3 + c.x) * 0.06;
      tmpM.compose(tmpP.set(c.x, 0.5, -c.z), tmpQ.identity(), tmpS.set(c.r * wob * fade, c.r * 0.4 * fade + 0.01, c.r * wob * fade));
      this.cloudMesh.setMatrixAt(i++, tmpM);
    }
    this.cloudMesh.count = i;
    // turret shots
    i = 0;
    for (const s of w.shots) {
      if (i >= 80) break;
      tmpM.compose(tmpP.set(s.x, 1.6, -s.z), tmpQ.identity(), tmpS.setScalar(1));
      this.shotMesh.setMatrixAt(i, tmpM);
      this.shotMesh.setColorAt(i, tmpC.set(s.el ? EL_FX[s.el] : 0xfff2a0));
      i++;
    }
    this.shotMesh.count = i;
    for (const im of [this.ringMesh, this.markMesh, this.rockMesh, this.cloudMesh, this.shotMesh]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    // turrets aim at the closest enemy
    for (const tr of this.turrets) {
      let best = null, bd = 1e9;
      for (const r of w.red) {
        const d = (r.x - tr.root.position.x) ** 2 + r.z * r.z;
        if (d < bd) { bd = d; best = r; }
      }
      if (best) tr.head.rotation.y = Math.atan2(-(best.x - tr.root.position.x), best.z + 1);
    }
  }

  updateCannon(w) {
    this.cannon.position.x = w.cannonX;
    this.cannon.rotation.z = w.stun > 0 ? Math.sin(this.time * 40) * 0.08 : 0;
    this.barrel.position.z = w.recoil * 0.25;
    this.cannon.scale.setScalar(0.85 * (1 + w.recoil * 0.04));
    const f = Math.max(0, w.recoil - 0.55) / 0.45;
    this.flash.visible = f > 0.02;
    this.flash.scale.set(0.6 + f * 0.6, 0.6 + f * 0.6, 1 + f * 1.4);
    this.flash.material.opacity = 0.9 * f;
  }

  updateScenery(dt) {
    const t = this.time;
    for (const f of this.torches) {
      const s = 1 + Math.sin(t * 17 + f.position.x) * 0.15 + Math.sin(t * 29) * 0.08;
      f.scale.set(s, s * 1.15, s);
    }
    for (const b of this.banners) b.rotation.x = Math.sin(t * 2 + b.position.x) * 0.06;
    for (const fl of this.flags) waveFlag(fl, t + fl.position.x, 0.18);
    for (const c of this.env.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 130) c.position.x = -130;
    }
    // Idle horde: bob and sway in place
    if (this.horde.visible) {
      for (let i = 0; i < HORDE; i++) {
        const h = this.hordeSlots[i];
        const b = Math.abs(Math.sin(t * 5 + h.ph));
        tmpP.set(h.x, 0.22 + b * 0.18, h.z);
        tmpQ.setFromEuler(tmpE.set(0, h.yaw, Math.sin(t * 2.5 + h.ph) * 0.12));
        tmpS.set(h.s, h.s * (0.94 + b * 0.08), h.s);
        tmpM.compose(tmpP, tmpQ, tmpS);
        this.horde.setMatrixAt(i, tmpM);
      }
      this.horde.instanceMatrix.needsUpdate = true;
    }
  }

  updateCamera(w) {
    const shake = w ? w.shake : 0;
    const follow = w ? w.cannonX * 0.12 : 0;
    this.camera.position.set(
      this.camBase.x + follow + (Math.random() - 0.5) * shake * 0.06,
      this.camBase.y + (Math.random() - 0.5) * shake * 0.06,
      this.camBase.z);
    this.camera.lookAt(this.camLook.x + follow * 0.5, this.camLook.y, this.camLook.z);
  }

  burst(x, z, color, n, power) {
    for (let k = 0; k < n && this.parts.length < MAX_PARTICLES; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (1.5 + Math.random() * 3) * power;
      this.parts.push({
        x, y: 0.5, z: -z,
        vx: Math.cos(a) * sp, vy: 3 + Math.random() * 4 * power, vz: Math.sin(a) * sp,
        life: 0.45 + Math.random() * 0.35, t: 0, color, s: 0.7 + Math.random() * 0.8, g: 18,
      });
    }
  }

  confetti() {
    for (let k = 0; k < 220 && this.parts.length < MAX_PARTICLES; k++) {
      this.parts.push({
        x: (Math.random() - 0.5) * 10, y: 2 + Math.random() * 3, z: -(Cfg.LANE_LEN - 2 - Math.random() * 8),
        vx: (Math.random() - 0.5) * 8, vy: 8 + Math.random() * 9, vz: Math.random() * 6,
        life: 1.6 + Math.random() * 1.2, t: 0, s: 0.9 + Math.random() * 0.6, g: 9, flat: true,
        color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
      });
    }
  }

  updateParticles(dt) {
    let i = 0;
    const keep = [];
    for (const p of this.parts) {
      p.t += dt;
      if (p.t >= p.life) continue;
      p.vy -= p.g * dt;
      if (p.flat) { p.vx *= 1 - dt; p.vz *= 1 - dt; p.vy = Math.max(p.vy, -3); }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.3) { p.y = 0.3; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
      const s = p.flat ? p.s : p.s * (1 - p.t / p.life);
      tmpP.set(p.x, p.y, p.z);
      tmpQ.setFromEuler(tmpE.set(p.t * 7, p.t * 9, 0));
      if (p.flat) tmpS.set(s * 1.4, s * 0.15, s); else tmpS.set(s, s, s);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.partMesh.setMatrixAt(i, tmpM);
      this.partMesh.setColorAt(i, tmpC.set(p.color));
      i++;
      keep.push(p);
    }
    this.parts = keep;
    this.partMesh.count = i;
    this.partMesh.instanceMatrix.needsUpdate = true;
    if (this.partMesh.instanceColor) this.partMesh.instanceColor.needsUpdate = true;
  }

  addFloater(x, z, text, color) {
    const label = makeLabel(256, 112);
    drawLabel(label, text, { color });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: label.tex, depthTest: false, transparent: true }));
    sprite.scale.set(3, 1.3, 1);
    sprite.renderOrder = 11;
    sprite.position.set(x, 2.5, -z);
    this.scene.add(sprite);
    this.floaters.push({ sprite, t: 0 });
  }

  updateFloaters(dt) {
    this.floaters = this.floaters.filter((f) => {
      f.t += dt;
      f.sprite.position.y += dt * 2.5;
      f.sprite.material.opacity = Math.max(0, 1 - f.t / 1.2);
      if (f.t > 1.2) {
        this.scene.remove(f.sprite);
        f.sprite.material.map.dispose();
        f.sprite.material.dispose();
        return false;
      }
      return true;
    });
  }
}
