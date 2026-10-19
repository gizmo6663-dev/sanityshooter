// Three.js renderer. Reads a World every frame and draws it; never changes
// game state. Sim (x, z) maps to three.js (x, 0, -z).

import * as THREE from 'three';
import { Cfg } from './config.js';

const COL = {
  sand: 0xf3c98b,
  sandDark: 0xe0ad6a,
  road: 0x5d6475,
  line: 0xffffff,
  fence: 0x8a5a35,
  blue: 0x2f7dff,
  blueGiant: 0xffc02e,
  red: 0xff3434,
  brute: 0xb3122e,
  gold: 0xffc23d,
  castle: 0xd8313a,
  castleDark: 0x8e1d2a,
};

const GATE_COLORS = { 2: '#33b4ff', 3: '#a64dff', 4: '#ff4fd8' };
const gateColor = (g) => (g.kind === 'add' ? '#2fe07a' : GATE_COLORS[g.value] || '#ffbf1f');

const MAX_PARTICLES = 900;
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const tmpQ2 = new THREE.Quaternion();

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
    ctx.fillStyle = opts.barColor || '#ff3b3b';
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

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });
}

function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
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
    this.scene.fog = new THREE.Fog(0xf7dcb0, 90, 170);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 300);
    this.camBase = new THREE.Vector3(0, 19, 6.5);
    this.camLook = new THREE.Vector3(0, 0, -19);

    this.buildLights();
    this.buildEnvironment();
    this.buildCannon();
    this.buildBase();
    this.buildMobs();
    this.buildParticles();

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
    grad.addColorStop(0, '#4fb6ff');
    grad.addColorStop(0.5, '#a9dcff');
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
    this.scene.add(new THREE.HemisphereLight(0xcfeaff, 0xe8b57a, 1.25));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sun.position.set(10, 26, 4);
    sun.target.position.set(0, 0, -24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    const sc = sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 90;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
  }

  buildEnvironment() {
    const s = this.scene;
    const L = Cfg.LANE_LEN, H = Cfg.LANE_HALF;
    const ground = mesh(new THREE.PlaneGeometry(260, 260), std(COL.sand, { roughness: 0.95 }), 0, 0, -40, false);
    ground.rotation.x = -Math.PI / 2;
    s.add(ground);

    // Raised road with a curb
    const roadLen = L + 10;
    s.add(mesh(new THREE.BoxGeometry(H * 2 + 1.0, 0.3, roadLen), std(0x8b6b4a), 0, 0.05, -(L / 2 - 2), false));
    s.add(mesh(new THREE.BoxGeometry(H * 2, 0.32, roadLen), std(COL.road, { roughness: 0.8 }), 0, 0.07, -(L / 2 - 2), false));
    const lineMat = std(COL.line, { roughness: 0.6 });
    for (const sx of [-1, 1]) {
      s.add(mesh(new THREE.BoxGeometry(0.14, 0.02, roadLen), lineMat, sx * (H - 0.35), 0.24, -(L / 2 - 2), false));
    }
    for (let z = 2; z < L; z += 4) {
      for (const sx of [-1, 1]) {
        s.add(mesh(new THREE.BoxGeometry(0.12, 0.02, 1.8), lineMat, sx * H / 3, 0.24, -z, false));
      }
    }

    // Enemy ground: a red sea behind the base, like the ads
    const field = mesh(new THREE.BoxGeometry(H * 2 + 8, 0.3, 40), std(0xd94a3c, { roughness: 0.9 }), 0, 0.06, -(L + 22), false);
    s.add(field);

    // Fences along both sides (instanced posts + rails)
    const postGeo = new THREE.BoxGeometry(0.16, 0.8, 0.16);
    const fenceMat = std(COL.fence, { roughness: 0.8 });
    const count = Math.ceil(roadLen / 1.4) * 2;
    const posts = new THREE.InstancedMesh(postGeo, fenceMat, count);
    let i = 0;
    for (let z = -6; z < L + 4 && i < count - 1; z += 1.4) {
      for (const sx of [-1, 1]) {
        tmpM.makeTranslation(sx * (H + 0.35), 0.55, -z);
        posts.setMatrixAt(i++, tmpM);
      }
    }
    posts.count = i;
    posts.castShadow = true;
    s.add(posts);
    for (const sx of [-1, 1]) {
      for (const y of [0.55, 0.85]) {
        s.add(mesh(new THREE.BoxGeometry(0.1, 0.1, roadLen), fenceMat, sx * (H + 0.35), y, -(L / 2 - 1)));
      }
    }

    // Desert props: cacti, rocks and palm-ish trees scattered on the sand
    const rnd = (() => { let a = 12345; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
    const cactusMat = std(0x37b24d, { roughness: 0.7 });
    const rockMat = std(0xd39a62, { roughness: 0.9, flatShading: true });
    const cactusGeo = new THREE.CapsuleGeometry(0.35, 1.6, 4, 8);
    const armGeo = new THREE.CapsuleGeometry(0.22, 0.7, 4, 8);
    const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    for (let k = 0; k < 46; k++) {
      const side = rnd() < 0.5 ? -1 : 1;
      const x = side * (H + 2.5 + rnd() * 18);
      const z = -6 + rnd() * (L + 30);
      if (rnd() < 0.45) {
        const g = new THREE.Group();
        g.add(mesh(cactusGeo, cactusMat, 0, 1.15, 0));
        const arm = mesh(armGeo, cactusMat, 0.45, 1.3, 0);
        g.add(arm);
        const arm2 = mesh(armGeo, cactusMat, -0.42, 1.0, 0);
        g.add(arm2);
        g.position.set(x, 0, -z);
        g.scale.setScalar(0.8 + rnd() * 0.7);
        g.rotation.y = rnd() * Math.PI;
        s.add(g);
      } else {
        const rock = mesh(rockGeo, rockMat, x, 0.3, -z);
        rock.scale.set(0.6 + rnd() * 1.4, 0.4 + rnd() * 0.8, 0.6 + rnd() * 1.4);
        rock.rotation.y = rnd() * Math.PI;
        s.add(rock);
      }
    }
  }

  buildCannon() {
    const g = new THREE.Group();
    const blue = std(COL.blue, { roughness: 0.35, metalness: 0.2 });
    const gold = std(COL.gold, { roughness: 0.3, metalness: 0.6 });
    const dark = std(0x26304a, { roughness: 0.5 });
    // Platform
    g.add(mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.35, 24), dark, 0, 0.35, 0));
    g.add(mesh(new THREE.TorusGeometry(1.05, 0.08, 8, 28), gold, 0, 0.53, 0).rotateX(Math.PI / 2));
    // Body + barrel (barrel points down -Z)
    const body = mesh(new THREE.SphereGeometry(0.75, 24, 16), blue, 0, 1.0, 0);
    g.add(body);
    const barrel = new THREE.Group();
    barrel.position.set(0, 1.05, 0);
    const tube = mesh(new THREE.CylinderGeometry(0.38, 0.48, 1.7, 20), blue, 0, 0, -0.75);
    tube.rotation.x = Math.PI / 2;
    barrel.add(tube);
    const muzzle = mesh(new THREE.TorusGeometry(0.4, 0.1, 8, 20), gold, 0, 0, -1.6);
    barrel.add(muzzle);
    barrel.rotation.x = 0.12;
    g.add(barrel);
    // Wheels
    for (const sx of [-1, 1]) {
      const w = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 18), gold, sx * 0.9, 0.55, 0.2);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    }
    g.position.set(0, 0.2, -Cfg.CANNON_Z + 0.6);
    g.scale.setScalar(0.85);
    this.scene.add(g);
    this.cannon = g;
    this.barrel = barrel;

    // The player's wall behind the cannon: flashes when enemies get through.
    this.wallMat = std(0x4f8dff, { roughness: 0.5, emissive: 0xff0000, emissiveIntensity: 0 });
    const wall = new THREE.Group();
    for (let x = -Cfg.LANE_HALF; x <= Cfg.LANE_HALF + 0.01; x += 0.92) {
      wall.add(mesh(new THREE.BoxGeometry(0.8, 0.9, 0.5), this.wallMat, x, 0.6, 0));
      wall.add(mesh(new THREE.BoxGeometry(0.4, 0.4, 0.5), this.wallMat, x, 1.25, 0));
    }
    wall.position.z = 0.9;
    this.scene.add(wall);
  }

  buildBase() {
    const L = Cfg.LANE_LEN;
    const g = new THREE.Group();
    this.baseMat = std(COL.castle, { roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0 });
    const darkMat = std(COL.castleDark, { roughness: 0.6 });
    const roofMat = std(0xffc23d, { roughness: 0.35, metalness: 0.4 });
    const W = Cfg.LANE_HALF * 2 + 1.2;
    g.add(mesh(new THREE.BoxGeometry(W, 3.2, 2.6), this.baseMat, 0, 1.6, -1.3));
    // Crenellations
    for (let x = -W / 2 + 0.4; x <= W / 2 - 0.3; x += 0.9) {
      g.add(mesh(new THREE.BoxGeometry(0.55, 0.6, 0.6), this.baseMat, x, 3.5, -0.2));
    }
    // Gate opening
    g.add(mesh(new THREE.BoxGeometry(2.6, 2.0, 0.2), darkMat, 0, 1.0, 0.02, false));
    // Towers with golden roofs and flags
    for (const sx of [-1, 1]) {
      const tx = sx * (W / 2 - 0.2);
      g.add(mesh(new THREE.CylinderGeometry(1.0, 1.15, 5.0, 16), this.baseMat, tx, 2.5, -1.2));
      g.add(mesh(new THREE.ConeGeometry(1.3, 1.8, 16), roofMat, tx, 5.9, -1.2));
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), darkMat, tx, 7.4, -1.2));
      const flag = mesh(new THREE.BoxGeometry(0.9, 0.5, 0.04), std(0xff2d55), tx + 0.45, 7.8, -1.2);
      g.add(flag);
    }
    g.position.set(0, 0.2, -L);
    this.scene.add(g);
    this.base = g;

    // HP sign floating above the base
    this.baseLabel = makeLabel(512, 200);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.baseLabel.tex, depthTest: false, transparent: true }));
    sprite.scale.set(9, 3.5, 1);
    sprite.position.set(0, 9.2, -L - 1);
    sprite.renderOrder = 10;
    this.scene.add(sprite);
  }

  buildMobs() {
    // A jelly-bean body with a little visor; the same geometry for both teams,
    // tinted per instance.
    const body = new THREE.LatheGeometry([
      new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.2, 0.02), new THREE.Vector2(0.27, 0.12),
      new THREE.Vector2(0.28, 0.34), new THREE.Vector2(0.25, 0.52), new THREE.Vector2(0.18, 0.64),
      new THREE.Vector2(0.08, 0.7), new THREE.Vector2(0.0, 0.71),
    ], 14);
    const visor = new THREE.SphereGeometry(0.12, 10, 6);
    visor.scale(1.5, 0.55, 0.7);
    visor.translate(0, 0.48, 0.2);
    const bodyMat = std(0xffffff, { roughness: 0.35 });
    const visorMat = std(0xffffff, { roughness: 0.15, metalness: 0.1, emissive: 0x222222 });
    const n = Cfg.MAX_BLUE + Cfg.MAX_RED + 8;
    this.mobBody = new THREE.InstancedMesh(body, bodyMat, n);
    this.mobVisor = new THREE.InstancedMesh(visor, visorMat, n);
    for (const im of [this.mobBody, this.mobVisor]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true;
      im.frustumCulled = false;
      im.count = 0;
      this.scene.add(im);
    }
    this.mobBody.setColorAt(0, tmpC.set(0xffffff));
  }

  buildParticles() {
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.partMesh = new THREE.InstancedMesh(geo, std(0xffffff, { roughness: 0.4 }), MAX_PARTICLES);
    this.partMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.partMesh.frustumCulled = false;
    this.partMesh.count = 0;
    this.partMesh.setColorAt(0, tmpC.set(0xffffff));
    this.scene.add(this.partMesh);
    this.parts = [];
  }

  // ======================================================================
  // Per-world setup
  // ======================================================================
  setWorld(world) {
    this.world = world;
    for (const o of this.gateObjs) this.scene.remove(o.group);
    this.gateObjs = world.gates.map((g) => this.makeGate(g));
    for (const t of this.tags) this.scene.remove(t.sprite);
    this.tags = [];
    for (const f of this.floaters) this.scene.remove(f.sprite);
    this.floaters = [];
    this.parts = [];
    this.lastBaseText = null;
  }

  makeGate(g) {
    const group = new THREE.Group();
    const col = new THREE.Color(gateColor(g));
    const w = g.halfW * 2, h = Cfg.GATE_HEIGHT;
    const panelMat = new THREE.MeshStandardMaterial({
      color: col, transparent: true, opacity: 0.55, emissive: col, emissiveIntensity: 0.35,
      roughness: 0.2, depthWrite: false, side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), panelMat);
    panel.position.y = h / 2 + 0.25;
    panel.renderOrder = 2;
    group.add(panel);
    const frameMat = std(col.clone().multiplyScalar(0.75), { roughness: 0.35, metalness: 0.3 });
    group.add(mesh(new THREE.BoxGeometry(w + 0.2, 0.16, 0.2), frameMat, 0, h + 0.3, 0));
    for (const sx of [-1, 1]) group.add(mesh(new THREE.BoxGeometry(0.18, h + 0.3, 0.22), frameMat, sx * (w / 2 + 0.02), (h + 0.3) / 2 + 0.1, 0));

    const label = makeLabel(256, 128);
    drawLabel(label, g.kind === 'add' ? `+${g.value}` : `×${g.value}`, { stroke: '#2a0c4a' });
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.98, 3.8), Math.min(w * 0.49, 1.9)),
      new THREE.MeshBasicMaterial({ map: label.tex, transparent: true, depthWrite: false }));
    lm.position.set(0, h / 2 + 0.3, 0.08);
    lm.renderOrder = 3;
    group.add(lm);
    group.position.set(g.x, 0.2, -g.z);
    this.scene.add(group);
    return { gate: g, group, panelMat, scale: 1 };
  }

  // ======================================================================
  // Per-frame
  // ======================================================================
  render(dt) {
    const w = this.world;
    this.time += dt;
    if (w) {
      this.consumeEvents(w);
      this.updateGates(dt);
      this.updateMobs(w);
      this.updateTags(w);
      this.updateBase(w);
      this.updateCannon(w);
    }
    this.updateParticles(dt);
    this.updateFloaters(dt);
    this.updateCamera(w);
    this.renderer.render(this.scene, this.camera);
  }

  consumeEvents(w) {
    for (const e of w.events) {
      if (e.type === 'pop') {
        const color = e.team === 0 ? COL.blue : e.team === 1 ? COL.red : COL.gold;
        this.burst(e.x, e.z, color, e.big ? 18 : 5, e.big ? 1.6 : 1);
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
      o.panelMat.emissiveIntensity = 0.35 + g.flash * 1.2;
      if (g.used) o.scale = Math.max(0, o.scale - dt * 5);
      const pulse = 1 + g.flash * 0.06;
      o.group.scale.set(o.scale * pulse, o.scale * pulse, 1);
      o.group.visible = o.scale > 0.01;
    }
  }

  updateMobs(w) {
    let i = 0;
    const t = this.time;
    const write = (m, color, scale) => {
      const bob = Math.abs(Math.sin(t * 12 + m.phase)) * 0.12 * scale;
      const lean = Math.sin(t * 12 + m.phase) * 0.12;
      tmpP.set(m.x, 0.22 + bob, -m.z);
      // Blue units run away from the camera, red ones towards it.
      tmpQ.setFromAxisAngle(UP, m.team === 0 ? Math.PI : 0);
      tmpQ.multiply(tmpQ2.setFromAxisAngle(FWD, lean));
      tmpS.set(scale, scale * (1 - bob * 0.6), scale);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.mobBody.setMatrixAt(i, tmpM);
      this.mobVisor.setMatrixAt(i, tmpM);
      this.mobBody.setColorAt(i, tmpC.set(color));
      i++;
    };
    for (const m of w.blue) {
      const s = m.giant ? 3.6 : 1.6 + Math.min(0.7, (m.hp - 1) * 0.04);
      write(m, m.giant ? COL.blueGiant : COL.blue, s);
    }
    for (const m of w.red) write(m, m.giant ? COL.brute : COL.red, m.giant ? 3.4 : 1.6);
    this.mobBody.count = i;
    this.mobVisor.count = i;
    this.mobBody.instanceMatrix.needsUpdate = true;
    this.mobVisor.instanceMatrix.needsUpdate = true;
    if (this.mobBody.instanceColor) this.mobBody.instanceColor.needsUpdate = true;
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
      drawLabel(tag.label, String(m.hp), {
        color: m.team === 0 ? '#ffe680' : '#ffffff', stroke: m.team === 0 ? '#5a3500' : '#4a0010',
      });
      tag.sprite.position.set(m.x, 3.6, -m.z);
    }
  }

  updateBase(w) {
    const txt = String(Math.max(0, Math.ceil(w.baseHp)));
    if (txt !== this.lastBaseText) {
      this.lastBaseText = txt;
      drawLabel(this.baseLabel, txt, { bar: Math.max(0, w.baseHp / w.baseMax), force: true });
    }
    this.baseMat.emissiveIntensity = w.baseFlash * 0.5;
    const destroyed = w.state === 'won';
    const k = destroyed ? Math.min(1, w.endTime * 1.5) : 0;
    this.base.position.y = 0.2 - k * 4;
    this.base.rotation.z = destroyed ? Math.sin(w.endTime * 30) * 0.03 * (1 - k) : 0;
    this.base.scale.set(1 + w.baseFlash * 0.03, 1 - w.baseFlash * 0.02, 1);
    this.wallMat.emissiveIntensity = w.castleFlash * 0.8;
  }

  updateCannon(w) {
    this.cannon.position.x = w.cannonX;
    this.barrel.position.z = w.recoil * 0.25;
    this.cannon.scale.setScalar(0.85 * (1 + w.recoil * 0.04));
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
        life: 0.45 + Math.random() * 0.35, t: 0, color, s: 0.7 + Math.random() * 0.8,
      });
    }
  }

  updateParticles(dt) {
    let i = 0;
    const keep = [];
    for (const p of this.parts) {
      p.t += dt;
      if (p.t >= p.life) continue;
      p.vy -= 18 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.3) { p.y = 0.3; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
      const s = p.s * (1 - p.t / p.life);
      tmpP.set(p.x, p.y, p.z);
      tmpQ.setFromAxisAngle(UP, p.t * 8);
      tmpS.set(s, s, s);
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
