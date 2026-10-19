// Three.js renderer. Reads the World every frame and draws it; never changes
// game state. Room-local sim positions (x, z) become three.js
// (roomX + x, y, roomZ - z).

import * as THREE from 'three';
import { Cfg } from './config.js';
import { outlineMaterial, toon, addOutlines } from './gfx.js';
import {
  buildHero, buildEnemy, buildRoom, buildDoorLeaf, buildPedestal, buildTrapdoor,
  heartGeometry, iconTexture, glowTexture, bloodTexture,
} from './models.js';
import { ITEMS } from './items.js';

const G = Cfg.GRID;
const MAX_PARTICLES = 700;
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpE = new THREE.Euler();
const tmpC = new THREE.Color();
const tmpC2 = new THREE.Color();
const WHITE = new THREE.Color(0xffffff);

const FX_COL = { fire: new THREE.Color(0xff7a2a), ice: new THREE.Color(0x8fdcff), poison: new THREE.Color(0x8fd04a) };
const SOUL = new THREE.Color(0x8fc8ff);
const BLOOD = { fly: 0xb02020, grub: 0xc8b070, slime: 0x6a9a2a, eye: 0xc02020, ram: 0xb0a890, bloat: 0xb01818 };

function shotColor(fx, out) {
  let n = 0;
  out.setRGB(0, 0, 0);
  for (const k of ['fire', 'ice', 'poison']) if (fx && fx[k] > 0) { out.add(FX_COL[k]); n++; }
  if (!n) return out.copy(SOUL);
  return out.multiplyScalar(1 / n);
}

function instanced(geo, material, count, color = false) {
  const im = new THREE.InstancedMesh(geo, material, count);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  if (color) im.setColorAt(0, tmpC.set(0xffffff));
  im.count = 0;
  return im;
}

export class Renderer {
  constructor(container) {
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    this.renderer = r;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040303);
    this.scene.fog = new THREE.Fog(0x040303, 26, 50);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 200);
    this.camOffset = new THREE.Vector3(0, 19.5, 4.2);
    this.camPos = new THREE.Vector3();

    this.buildLights();
    this.glowTex = glowTexture();
    this.hero = buildHero();
    this.scene.add(this.hero.root);
    this.buildDynamic();

    this.rooms = new Map();      // roomKey -> { group, leaves, candles, decals }
    this.enemyModels = new Map();
    this.pickupModels = new Map();
    this.parts = [];
    this.rings = [];
    this.world = null;
    this.builtFloor = -1;
    this.time = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Fit the room's width (plus walls) whatever the phone's shape.
    const dist = this.camOffset.length();
    const hfov = 2 * Math.atan((Cfg.ROOM_W + 2.6) / 2 / dist);
    const vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180 / Math.PI;
    this.camera.fov = Math.min(80, Math.max(40, vfov));
    this.camera.updateProjectionMatrix();
  }

  buildLights() {
    this.scene.add(new THREE.AmbientLight(0x8a7060, 1.6));
    this.scene.add(new THREE.HemisphereLight(0xe0c8a8, 0x3a2418, 1.0));
    const moon = new THREE.DirectionalLight(0xfff0d8, 1.6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    const sc = moon.shadow.camera;
    sc.left = -9; sc.right = 9; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 40;
    moon.shadow.bias = -0.0008;
    moon.shadow.normalBias = 0.02;
    this.scene.add(moon, moon.target);
    this.moon = moon;
    // The hero's lantern
    this.lantern = new THREE.PointLight(0xffc890, 12, 9, 1.6);
    this.scene.add(this.lantern);
    // Two candle lights, moved to the current room's candles
    this.candleLights = [0, 1].map(() => {
      const l = new THREE.PointLight(0xff9a4a, 5, 6, 1.8);
      this.scene.add(l);
      return l;
    });
  }

  buildDynamic() {
    const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    // player shots: bright core + soft glow
    this.shotCore = instanced(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial(), 300, true);
    this.shotGlow = instanced(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ ...add, opacity: 0.18 }), 300, true);
    this.shotInk = instanced(new THREE.SphereGeometry(1, 12, 10), outlineMaterial(0.28), 300);
    // enemy shots: dark blood with a red halo
    this.eshotCore = instanced(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color: 0xa8141c }), 200);
    this.eshotInk = instanced(new THREE.SphereGeometry(1, 12, 10), outlineMaterial(0.28), 200);
    this.eshotGlow = instanced(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a, ...add, opacity: 0.3 }), 200);
    // xp orbs
    this.orbMesh = instanced(new THREE.OctahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: 0x7affc8 }), 200);
    // orbiting wisps
    this.wispMesh = instanced(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd08a }), 8, true);
    this.wispGlow = instanced(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff9a3a, ...add, opacity: 0.3 }), 8, true);
    // particles
    this.partMesh = instanced(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshStandardMaterial({ roughness: 0.5 }), MAX_PARTICLES, true);
    // rings for explosions / slams
    const ringGeo = new THREE.TorusGeometry(1, 0.06, 4, 32);
    ringGeo.rotateX(Math.PI / 2);
    this.ringMesh = instanced(ringGeo, new THREE.MeshBasicMaterial(add), 40, true);
    this.flashMesh = instanced(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ ...add, opacity: 0.5 }), 40, true);
    // poison clouds
    this.cloudMesh = instanced(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: 0x6a8a2a, transparent: true, opacity: 0.35, depthWrite: false, emissive: 0x2a3a08 }), 40);
    // candle flames
    this.flameMesh = instanced(new THREE.ConeGeometry(0.05, 0.16, 6), new THREE.MeshBasicMaterial({ color: 0xffb050 }), 64);
    this.flameGlow = instanced(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, ...add, opacity: 0.18 }), 64);
    // shadow blob under flying things
    this.blobMesh = instanced(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }), 64);
    for (const im of [this.shotCore, this.shotGlow, this.shotInk, this.eshotInk, this.eshotCore, this.eshotGlow, this.orbMesh, this.wispMesh, this.wispGlow,
      this.partMesh, this.ringMesh, this.flashMesh, this.cloudMesh, this.flameMesh, this.flameGlow, this.blobMesh]) this.scene.add(im);

    this.heartGeo = heartGeometry();
    this.heartMat = toon({ color: 0xc8202a, emissive: 0x300000 });
    this.coinGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.04, 14).rotateX(Math.PI / 2);
    this.coinMat = toon({ color: 0xe0b040, emissive: 0x3a2400 });
    this.decalGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.decalMats = {};
  }

  // ======================================================================
  // Floor setup
  // ======================================================================
  roomOrigin(room) {
    return [(room.gx - (G - 1) / 2) * Cfg.ROOM_STRIDE_X, -(room.gy - (G - 1) / 2) * Cfg.ROOM_STRIDE_Z];
  }

  buildFloor(world) {
    for (const r of this.rooms.values()) {
      this.scene.remove(r.group);
      r.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
    }
    this.rooms.clear();
    for (const m of this.pickupModels.values()) m.parent && m.parent.remove(m);
    this.pickupModels.clear();
    for (const room of world.dungeon.rooms.values()) {
      const built = buildRoom(room, world.floor);
      const [ox, oz] = this.roomOrigin(room);
      built.group.position.set(ox, 0, oz);
      const leaves = [];
      for (const [dir, d] of Object.entries(built.doors)) {
        const other = world.dungeon.rooms.get(world.neighbourKey(room, dir));
        const type = room.type === 'boss' || other.type === 'boss' ? 'boss' : other.type === 'treasure' || room.type === 'treasure' ? 'treasure' : 'normal';
        const leaf = buildDoorLeaf(type);
        leaf.position.set(d.px, 0, -d.pz);
        leaf.rotation.y = d.ry;
        built.group.add(leaf);
        leaves.push(leaf);
      }
      built.group.visible = false;
      this.scene.add(built.group);
      this.rooms.set(room.key, { ...built, leaves, decals: [], origin: [ox, oz], room });
    }
    this.builtFloor = world.floor;
    this.builtDungeon = world.dungeon;
    const start = this.rooms.get(world.roomKey);
    this.camPos.set(start.origin[0], 0, start.origin[1]);
  }

  setWorld(world) {
    this.world = world;
    for (const m of this.enemyModels.values()) this.scene.remove(m.root);
    this.enemyModels.clear();
    this.parts = [];
    this.rings = [];
    this.buildFloor(world);
  }

  // ======================================================================
  // Per-frame
  // ======================================================================
  render(dt) {
    const w = this.world;
    this.time += dt;
    if (w) {
      if (w.dungeon !== this.builtDungeon) this.buildFloor(w);
      this.consumeEvents(w);
      this.updateRooms(w, dt);
      this.updateHero(w, dt);
      this.updateEnemies(w, dt);
      this.updateProjectiles(w);
      this.updatePickups(w, dt);
      this.updateFx(w, dt);
    }
    this.updateParticles(dt);
    this.renderer.render(this.scene, this.camera);
  }

  origin(w) { return this.rooms.get(w.roomKey).origin; }

  consumeEvents(w) {
    const [ox, oz] = this.origin(w);
    for (const e of w.events) {
      if (e.type === 'kill') {
        const col = BLOOD[e.enemy] || 0x5a0606;
        this.burst(ox + e.x, oz - e.z, col, e.boss ? 60 : 14, e.boss ? 3 : 1.2, 0.5);
        this.addDecal(w.roomKey, e.x, e.z, col, e.boss ? 3 : e.small ? 0.6 : 0.95);
      } else if (e.type === 'hit') {
        this.burst(ox + e.x, oz - e.z, shotColor(e.fx, tmpC).getHex(), 4, 0.6, 0.7);
      } else if (e.type === 'splat') {
        this.burst(ox + e.x, oz - e.z, shotColor(e.fx, tmpC).getHex(), 5, 0.5, 0.4);
      } else if (e.type === 'esplat') {
        this.burst(ox + e.x, oz - e.z, 0x6a0808, 4, 0.5, 0.4);
      } else if (e.type === 'explode') {
        const c = shotColor(e.fx, tmpC).getHex();
        const col = c === SOUL.getHex() ? 0xff9a3a : c;
        this.rings.push({ x: ox + e.x, z: oz - e.z, r: e.r, t: 0, life: 0.35, color: col, flash: true });
        this.burst(ox + e.x, oz - e.z, col, 12, 1.4, 0.6);
      } else if (e.type === 'slam') {
        this.rings.push({ x: ox + e.x, z: oz - e.z, r: e.r, t: 0, life: 0.5, color: 0x8a5a3a });
        this.burst(ox + e.x, oz - e.z, 0x3a3028, 30, 2, 0.3);
      } else if (e.type === 'hurt') {
        this.burst(ox + w.player.x, oz - w.player.z, 0x8a0a0a, 12, 1.2, 0.8);
      }
    }
  }

  addDecal(roomKey, x, z, color, size) {
    const r = this.rooms.get(roomKey);
    if (!r) return;
    let m = this.decalMats[color];
    if (!m) m = this.decalMats[color] = new THREE.MeshBasicMaterial({ map: bloodTexture(), color, transparent: true, depthWrite: false });
    const d = new THREE.Mesh(this.decalGeo, m);
    d.position.set(x, 0.015 + r.decals.length * 0.0005, -z);
    d.rotation.y = Math.random() * Math.PI * 2;
    d.scale.setScalar(size * (0.8 + Math.random() * 0.5));
    r.group.add(d);
    r.decals.push(d);
    if (r.decals.length > 30) r.group.remove(r.decals.shift());
  }

  updateRooms(w, dt) {
    const cur = this.rooms.get(w.roomKey);
    const tr = w.transition;
    for (const [k, r] of this.rooms) r.group.visible = k === w.roomKey || (!!tr && k === tr.from);
    // doors: closed while the current room has enemies
    for (const r of this.rooms.values()) {
      const closed = r.room === cur.room ? !cur.room.cleared : false;
      for (const leaf of r.leaves) {
        const target = closed ? 0 : -1.4;
        leaf.position.y += (target - leaf.position.y) * Math.min(1, dt * 10);
        leaf.visible = leaf.position.y > -1.35;
      }
    }
    // camera: pan between rooms during a transition
    let tx = cur.origin[0], tz = cur.origin[1];
    if (tr) {
      const from = this.rooms.get(tr.from).origin;
      const k = Math.min(1, tr.t / Cfg.TRANSITION);
      const s = k * k * (3 - 2 * k);
      tx = from[0] + (tx - from[0]) * s;
      tz = from[1] + (tz - from[1]) * s;
    }
    this.camPos.set(tx, 0, tz);
    const sh = w.shake * 0.04;
    this.camera.position.set(tx + this.camOffset.x + (Math.random() - 0.5) * sh, this.camOffset.y + (Math.random() - 0.5) * sh, tz + this.camOffset.z);
    this.camera.lookAt(tx, 0, tz + 0.2);
    this.moon.position.set(tx - 3, 18, tz + 4);
    this.moon.target.position.set(tx, 0, tz);
    // candles
    let n = 0;
    cur.candles.forEach((c, i) => {
      const f = 1 + Math.sin(this.time * 13 + i * 2.1) * 0.12 + Math.sin(this.time * 31 + i) * 0.06;
      tmpM.compose(tmpP.set(tx + c.x, c.y, tz - c.z), tmpQ.identity(), tmpS.set(f, f * 1.2, f));
      this.flameMesh.setMatrixAt(n, tmpM);
      tmpM.compose(tmpP, tmpQ, tmpS.setScalar(f));
      this.flameGlow.setMatrixAt(n, tmpM);
      n++;
      if (i < 2) {
        this.candleLights[i].position.set(tx + c.x + (c.x > 0 ? -0.3 : 0.3), c.y + 0.2, tz - c.z);
        this.candleLights[i].intensity = 5 * f;
      }
    });
    for (let i = cur.candles.length; i < 2; i++) this.candleLights[i].intensity = 0;
    this.flameMesh.count = this.flameGlow.count = n;
    this.flameMesh.instanceMatrix.needsUpdate = this.flameGlow.instanceMatrix.needsUpdate = true;
  }

  updateHero(w, dt) {
    const p = w.player;
    const [ox, oz] = this.origin(w);
    const h = this.hero;
    const moving = p.moving || p.dashT > 0;
    const bob = moving ? Math.abs(Math.sin(this.time * 11)) * 0.06 : Math.sin(this.time * 2) * 0.015;
    h.root.position.set(ox + p.x, 0, oz - p.z);
    h.root.scale.setScalar(1.4);
    h.body.position.y = bob;
    // Face where you walk; when standing still, face what you shoot at.
    const yaw = moving && Math.hypot(p.vx, p.vz) > 0.5 ? Math.atan2(p.vx, p.vz) : Math.atan2(p.aimX, p.aimZ);
    const cur = h.root.rotation.y;
    const diff = ((yaw - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    h.root.rotation.y = cur + diff * Math.min(1, dt * 14);
    // Lean back towards the camera so the face reads, like a front-facing sprite.
    h.root.rotation.x = -0.6;
    const sway = moving ? Math.sin(this.time * 12) : 0;
    h.body.rotation.z = sway * 0.09;
    h.body.rotation.x = moving ? 0.1 : 0;
    const dash = p.dashT > 0;
    h.body.scale.set(dash ? 0.85 : 1, dash ? 0.85 : 1, dash ? 1.3 : 1);
    h.root.visible = !(p.iframes > 0 && Math.floor(this.time * 18) % 2 === 0) || w.state !== 'play';
    const fl = 1 + Math.sin(this.time * 17) * 0.1 + Math.sin(this.time * 41) * 0.05;
    h.flame.scale.setScalar(fl);
    h.lantern.getWorldPosition(tmpP);
    this.lantern.position.set(tmpP.x, tmpP.y + 0.3, tmpP.z);
    this.lantern.intensity = 12 * fl;
    if (dash && Math.random() < 0.6) this.burst(ox + p.x, oz - p.z, 0x1a1418, 2, 0.3, 0.6);
  }

  updateEnemies(w, dt) {
    const [ox, oz] = this.origin(w);
    const seen = new Set();
    let nb = 0;
    for (const e of w.enemies) {
      seen.add(e.id);
      let m = this.enemyModels.get(e.id);
      if (!m) {
        m = buildEnemy(e.type);
        m.mats = [];
        m.root.traverse((o) => { if (o.isMesh && o.material.emissive) m.mats.push(o.material); });
        m.base = m.mats.map((mt) => mt.emissive.clone());
        this.scene.add(m.root);
        this.enemyModels.set(e.id, m);
      }
      const t = this.time + e.phase;
      const grow = e.spawnT > 0 ? Math.max(0.05, 1 - e.spawnT / Cfg.SPAWN_DELAY) : 1;
      const size = e.small ? 0.65 : 1;
      m.root.position.set(ox + e.x, e.lift || 0, oz - e.z);
      m.root.scale.setScalar(grow * size * (e.boss ? 1.1 : 1.3));
      if (e.spawnT > 0 && Math.random() < 0.3) this.burst(ox + e.x, oz - e.z, 0x0a0808, 1, 0.4, 0.3);
      // face the player, or the direction of travel for chargers/grubs
      const p = w.player;
      let yaw = Math.atan2(p.x - e.x, p.z - e.z);
      if ((e.type === 'ram' || e.type === 'grub') && e.face !== undefined) yaw = Math.atan2(Math.cos(e.face), Math.sin(e.face));
      m.root.rotation.y = yaw;
      m.root.rotation.x = e.boss ? -0.35 : e.type === 'fly' || e.type === 'grub' ? -0.2 : -0.5;
      // per-type animation
      if (e.type === 'fly') {
        m.body.position.y = 0.9 + Math.sin(t * 6) * 0.08;
        const flap = Math.sin(this.time * 60) * 0.7;
        m.wings[0].rotation.z = flap; m.wings[1].rotation.z = -flap;
      } else if (e.type === 'grub') {
        m.segs.forEach((s, i) => { s.position.x = Math.sin(t * 5 - i * 0.9) * 0.07; s.scale.setScalar(1 + Math.sin(t * 5 - i) * 0.05); });
      } else if (e.type === 'eye') {
        m.body.position.y = 1.0 + Math.sin(t * 2.5) * 0.12;
        m.lid.scale.z = e.blink > 0 ? 1 : 0.02;
      } else if (e.type === 'ram') {
        m.body.rotation.x = e.state === 'charge' ? 0.25 : e.state === 'stun' ? Math.sin(this.time * 30) * 0.1 : Math.sin(t * 8) * 0.04;
      } else if (e.type === 'slime') {
        const squash = e.hop > 0 ? 1.25 : 0.85 + Math.sin(t * 6) * 0.05;
        m.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
        m.body.position.y = e.hop > 0 ? Math.sin((e.hop / 0.45) * Math.PI) * 0.35 : 0;
      } else if (e.type === 'bloat') {
        const swell = e.swell ? 1.12 : 1;
        const pulse = 1 + Math.sin(t * 3) * 0.03;
        m.body.scale.set(swell * pulse, swell / pulse, swell * pulse);
      }
      // status tint and hit flash through emissive
      let tint = null;
      if (e.frozen > 0) tint = FX_COL.ice;
      else if (e.burn > 0) tint = FX_COL.fire;
      else if (e.poison > 0) tint = FX_COL.poison;
      m.mats.forEach((mt, i) => {
        mt.emissive.copy(m.base[i]);
        if (tint) mt.emissive.lerp(tint, e.frozen > 0 ? 0.55 : 0.3 + 0.15 * Math.sin(this.time * 12));
        if (e.flash > 0) mt.emissive.lerp(WHITE, e.flash * 0.6);
      });
      if (e.burn > 0 && Math.random() < 0.15) this.burst(ox + e.x, oz - e.z, 0xff8a2a, 1, 0.3, 1.2, -6);
      if (e.flying || e.lift || e.type === 'eye') {
        const s = e.r * (e.lift ? Math.max(0.6, 1.4 - e.lift * 0.15) : 1.1);
        tmpM.compose(tmpP.set(ox + e.x, 0.02, oz - e.z), tmpQ.identity(), tmpS.setScalar(s * grow));
        this.blobMesh.setMatrixAt(nb++, tmpM);
      }
    }
    this.blobMesh.count = nb;
    this.blobMesh.instanceMatrix.needsUpdate = true;
    for (const [id, m] of this.enemyModels) {
      if (!seen.has(id)) { this.scene.remove(m.root); this.enemyModels.delete(id); }
    }
  }

  updateProjectiles(w) {
    const [ox, oz] = this.origin(w);
    let i = 0;
    for (const s of w.shots) {
      if (i >= 300) break;
      const r = s.r * (1 + Math.sin(s.t * 20) * 0.08);
      tmpM.compose(tmpP.set(ox + s.x, 0.55, oz - s.z), tmpQ.identity(), tmpS.setScalar(r));
      this.shotCore.setMatrixAt(i, tmpM);
      shotColor(s.fx, tmpC);
      this.shotCore.setColorAt(i, tmpC2.copy(tmpC).lerp(WHITE, 0.5));
      tmpM.compose(tmpP, tmpQ, tmpS.setScalar(r * 2.6));
      this.shotGlow.setMatrixAt(i, tmpM);
      this.shotGlow.setColorAt(i, tmpC);
      tmpM.compose(tmpP, tmpQ, tmpS.setScalar(r));
      this.shotInk.setMatrixAt(i, tmpM);
      i++;
    }
    this.shotCore.count = this.shotGlow.count = this.shotInk.count = i;
    i = 0;
    for (const b of w.eshots) {
      if (i >= 200) break;
      tmpM.compose(tmpP.set(ox + b.x, 0.55, oz - b.z), tmpQ.identity(), tmpS.setScalar(b.r));
      this.eshotCore.setMatrixAt(i, tmpM);
      this.eshotInk.setMatrixAt(i, tmpM);
      tmpM.compose(tmpP, tmpQ, tmpS.setScalar(b.r * 2.4));
      this.eshotGlow.setMatrixAt(i, tmpM);
      i++;
    }
    this.eshotCore.count = this.eshotGlow.count = this.eshotInk.count = i;
    i = 0;
    for (const o of w.orbs) {
      if (i >= 200) break;
      tmpQ.setFromEuler(tmpE.set(0, this.time * 4 + i, 0));
      tmpM.compose(tmpP.set(ox + o.x, 0.25 + Math.sin(this.time * 5 + i) * 0.05, oz - o.z), tmpQ, tmpS.setScalar(1 + Math.min(2, o.value * 0.15)));
      this.orbMesh.setMatrixAt(i++, tmpM);
    }
    this.orbMesh.count = i;
    i = 0;
    const fx = w.shotEffects();
    for (const [x, z] of w.orbitalPositions()) {
      const f = 1 + Math.sin(this.time * 15 + i) * 0.1;
      tmpM.compose(tmpP.set(ox + x, 0.7, oz - z), tmpQ.identity(), tmpS.setScalar(f));
      this.wispMesh.setMatrixAt(i, tmpM);
      this.wispGlow.setMatrixAt(i, tmpM);
      const c = shotColor(fx, tmpC).getHex() === SOUL.getHex() ? tmpC.set(0xffb060) : tmpC;
      this.wispMesh.setColorAt(i, c);
      this.wispGlow.setColorAt(i, c);
      i++;
    }
    this.wispMesh.count = this.wispGlow.count = i;
    for (const im of [this.shotCore, this.shotGlow, this.shotInk, this.eshotCore, this.eshotInk, this.eshotGlow, this.orbMesh, this.wispMesh, this.wispGlow]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  updatePickups(w, dt) {
    const r = this.rooms.get(w.roomKey);
    const room = w.room;
    const seen = new Set();
    for (const it of room.pickups) {
      seen.add(it);
      let m = this.pickupModels.get(it);
      if (!m) {
        m = this.makePickup(it);
        r.group.add(m);
        this.pickupModels.set(it, m);
      }
      m.position.x = it.x;
      m.position.z = -it.z;
      const t = this.time;
      if (it.kind === 'coin') { m.rotation.y = t * 4; m.position.y = 0.25 + Math.sin(t * 3) * 0.04; }
      if (it.kind === 'heart') { m.rotation.y = Math.sin(t * 2) * 0.5; m.position.y = 0.3 + Math.sin(t * 3) * 0.05; m.scale.setScalar(1 + Math.sin(t * 6) * 0.06); }
      if (it.kind === 'item' && m.userData.icon) {
        m.userData.icon.position.y = 1.35 + Math.sin(t * 2.2) * 0.08;
        m.userData.glow.material.opacity = 0.35 + Math.sin(t * 3) * 0.1;
      }
    }
    for (const [it, m] of this.pickupModels) {
      if (!seen.has(it) && m.parent === r.group) {
        if (it.kind === 'item') this.burst(r.origin[0] + it.x, r.origin[1] - it.z, 0xfff0c0, 20, 1.5, 1.0);
        r.group.remove(m);
        this.pickupModels.delete(it);
      }
    }
  }

  makePickup(it) {
    const g = new THREE.Group();
    if (it.kind === 'coin') {
      const c = new THREE.Mesh(this.coinGeo, this.coinMat);
      c.castShadow = true;
      g.add(addOutlines(c, 0.02));
    } else if (it.kind === 'heart') {
      const h = new THREE.Mesh(this.heartGeo, this.heartMat);
      h.castShadow = true;
      h.scale.setScalar(1.3);
      g.add(addOutlines(h, 0.02));
    } else if (it.kind === 'item') {
      g.add(buildPedestal());
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffe0a0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(1.6, 1.6, 1);
      glow.position.y = 1.35;
      g.add(glow);
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(ITEMS[it.id].icon), transparent: true }));
      icon.scale.set(0.8, 0.8, 1);
      g.add(icon);
      g.userData.icon = icon;
      g.userData.glow = glow;
    } else if (it.kind === 'trapdoor') {
      g.add(buildTrapdoor());
    }
    if (it.price) {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 64;
      const ctx = c.getContext('2d');
      ctx.font = 'bold 40px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#000';
      ctx.strokeText(`${it.price}¢`, 64, 34);
      ctx.fillStyle = '#e8c870';
      ctx.fillText(`${it.price}¢`, 64, 34);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      tag.scale.set(0.9, 0.45, 1);
      tag.position.set(0, it.kind === 'item' ? 0.2 : 0.75, 0.75);
      g.add(tag);
    }
    return g;
  }

  updateFx(w, dt) {
    const [ox, oz] = this.origin(w);
    let i = 0, f = 0;
    this.rings = this.rings.filter((r) => (r.t += dt) < r.life);
    for (const r of this.rings) {
      const k = r.t / r.life;
      const s = r.r * (0.3 + 0.7 * Math.sqrt(k));
      tmpM.compose(tmpP.set(r.x, 0.2, r.z), tmpQ.identity(), tmpS.set(s, 1, s));
      this.ringMesh.setMatrixAt(i, tmpM);
      this.ringMesh.setColorAt(i, tmpC.set(r.color).multiplyScalar(1 - k));
      i++;
      if (r.flash) {
        tmpM.compose(tmpP.set(r.x, 0.4, r.z), tmpQ, tmpS.setScalar(r.r * 0.8 * (0.5 + k)));
        this.flashMesh.setMatrixAt(f, tmpM);
        this.flashMesh.setColorAt(f, tmpC.set(r.color).multiplyScalar((1 - k) * 0.8));
        f++;
      }
    }
    this.ringMesh.count = i;
    this.flashMesh.count = f;
    i = 0;
    for (const c of w.clouds) {
      const k = c.t / c.life;
      const fade = Math.min(1, (1 - k) * 4) * Math.min(1, c.t * 5);
      const wob = 1 + Math.sin(this.time * 3 + c.x) * 0.08;
      tmpM.compose(tmpP.set(ox + c.x, 0.3, oz - c.z), tmpQ.identity(), tmpS.set(c.r * wob * fade, c.r * 0.45 * fade + 0.01, c.r * wob * fade));
      this.cloudMesh.setMatrixAt(i++, tmpM);
    }
    this.cloudMesh.count = i;
    for (const im of [this.ringMesh, this.flashMesh, this.cloudMesh]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  burst(x, z, color, n, power, y = 0.5, gravity = 14) {
    for (let k = 0; k < n && this.parts.length < MAX_PARTICLES; k++) {
      const a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random() * 2.2) * power;
      this.parts.push({
        x, y, z, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 3 * power, vz: Math.sin(a) * sp,
        t: 0, life: 0.35 + Math.random() * 0.4, color, s: 0.6 + Math.random() * 1.0, g: gravity,
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
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      const s = p.s * (1 - p.t / p.life);
      tmpM.compose(tmpP.set(p.x, p.y, p.z), tmpQ.setFromEuler(tmpE.set(p.t * 6, p.t * 8, 0)), tmpS.setScalar(s));
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
}
