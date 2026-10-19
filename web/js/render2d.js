// Pixel-art renderer (Canvas 2D). Reads the World every frame and draws it;
// never changes game state. Everything is drawn into a small low-resolution
// canvas and scaled up by a whole number with nearest-neighbour, so pixels
// stay crisp. Rooms are painted once and cached; sprites are rendered once
// per animation frame and cached.

import { Cfg } from './config.js';
import * as S from './sprites.js';
import { drawRoom } from './roomart.js';
import { pixelSprite, quantize, light, grime, outline } from './pixel.js';
import { textSprite, textWidth } from './font.js';
import { ITEMS, activeTransforms, TRANSFORMS } from './items.js';
import { tileIndex } from './dungeon.js';
import { ENEMIES } from './enemies.js';

const PX = 20;                                  // pixels per world unit
const W = Cfg.ROOM_W, D = Cfg.ROOM_D;
const WALL_TOP = Math.round(1.8 * PX), WALL_SIDE = Math.round(0.6 * PX), WALL_BOT = Math.round(0.9 * PX);
const ROOM_PW = W * PX + WALL_SIDE * 2;
const ROOM_PH = D * PX + WALL_TOP + WALL_BOT;
const HUD_H = 46;
const TAU = Math.PI * 2;
const FLOOR_TINTS = [[120, 88, 64], [100, 94, 90], [130, 112, 86], [122, 66, 58]];
const BLOOD = {
  fly: [120, 20, 18], grub: [190, 170, 100], slime: [90, 130, 40], eye: [160, 20, 22], ram: [170, 160, 140], bloat: [150, 16, 20],
  spider: [60, 40, 30], clot: [140, 10, 14], gaper: [130, 18, 20], host: [170, 160, 140], leaper: [140, 40, 30],
  boomfly: [150, 150, 40], wraith: [120, 130, 150], gorger: [90, 110, 60], hive: [170, 110, 50], bonelord: [170, 160, 140], deep: [110, 30, 80],
};
const EL_HEX = { fire: '#ff8a3a', ice: '#8af0ff', poison: '#9ad050', blood: '#e04848' };

// Frames per animation cycle: [period in seconds, frames]
const CYCLE = {
  heroWalk: [TAU / 12, 8], heroIdle: [TAU / 2.2, 4],
  fly: [TAU / 7, 10], grub: [TAU / 5, 6], eye: [TAU / 2.5, 8], ram: [TAU / 8, 6],
  slime: [TAU / 6, 6], bloat: [TAU / 3, 6], coin: [TAU / 3, 8],
  spider: [TAU / 6, 4], spiderRun: [TAU / 30, 4], clot: [TAU / 4, 6], gaper: [TAU / 9, 6], gaperRun: [TAU / 14, 6],
  boomfly: [TAU / 6, 8], wraith: [TAU / 2, 8], gorger: [TAU / 3, 6], hive: [TAU / 1.5, 8], deep: [TAU / 1.2, 8],
};
function frame(name, time) {
  const [P, N] = CYCLE[name];
  const k = Math.floor(((time % P) + P) % P / P * N);
  return [k, (k / N) * P];
}

function shotColor(fx) {
  const cols = ['fire', 'ice', 'poison', 'blood'].filter((k) => fx && fx[k] > 0).map((k) => EL_HEX[k]);
  return cols[0] || '#9ad0ff';
}

export class Renderer {
  constructor(container) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.imageRendering = 'pixelated';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.low = document.createElement('canvas');
    this.g = this.low.getContext('2d');
    this.sprites = new Map();
    this.rooms = new Map();
    this.parts = [];
    this.rings = [];
    this.zaps = [];
    this.time = 0;
    this.world = null;
    this.lanternGlow = this.makeGlow(70);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const dw = Math.round(window.innerWidth * dpr), dh = Math.round(window.innerHeight * dpr);
    const k = Math.max(1, Math.floor(dw / (ROOM_PW + 4)));
    this.k = k;
    this.VW = Math.ceil(dw / k);
    this.VH = Math.ceil(dh / k);
    this.canvas.width = this.VW * k;
    this.canvas.height = this.VH * k;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.low.width = this.VW;
    this.low.height = this.VH;
    this.bx = Math.floor((this.VW - ROOM_PW) / 2);
    this.by = HUD_H + Math.max(0, Math.floor((this.VH - HUD_H - ROOM_PH) * 0.3));
    // where the HUD ends on screen, in CSS pixels (for HTML buttons)
    this.hudBottomCss = (HUD_H * k) / dpr;
  }

  setWorld(world) {
    this.world = world;
    this.rooms.clear();
    this.parts = [];
    this.rings = [];
    this.builtDungeon = world.dungeon;
  }

  // ======================================================================
  // Caches
  // ======================================================================
  sprite(key, draw, size, w = 2.2, h = 2.6) {
    let s = this.sprites.get(key);
    if (!s) {
      s = pixelSprite(draw, size, w, h);
      this.sprites.set(key, s);
    }
    return s;
  }

  /** A copy of a sprite washed with a colour (hit flash, status tints). */
  tinted(key, base, color, alpha) {
    const k = `${key}|${color}|${alpha}`;
    let s = this.sprites.get(k);
    if (!s) {
      const c = document.createElement('canvas');
      c.width = base.canvas.width; c.height = base.canvas.height;
      const g = c.getContext('2d');
      g.drawImage(base.canvas, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = alpha;
      g.fillStyle = color;
      g.fillRect(0, 0, c.width, c.height);
      s = { canvas: c, ax: base.ax, ay: base.ay };
      this.sprites.set(k, s);
    }
    return s;
  }

  icon(emoji, size = 12) {
    const key = `icon:${emoji}:${size}`;
    let s = this.sprites.get(key);
    if (!s) {
      const c = document.createElement('canvas');
      c.width = size + 4; c.height = size + 4;
      const g = c.getContext('2d');
      g.font = `${size}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(emoji, c.width / 2, c.height / 2 + 1);
      quantize(g, c.width, c.height, { spread: 8, alphaCut: 100 });
      outline(g, c.width, c.height);
      s = { canvas: c, ax: c.width / 2, ay: c.height / 2 };
      this.sprites.set(key, s);
    }
    return s;
  }

  makeGlow(r) {
    const c = document.createElement('canvas');
    c.width = c.height = r * 2;
    const g = c.getContext('2d');
    const img = g.createImageData(r * 2, r * 2);
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 0; y < r * 2; y++) {
      for (let x = 0; x < r * 2; x++) {
        const d = Math.hypot(x - r, (y - r) * 1.25) / r;
        const f = Math.max(0, 1 - d);
        const lvl = Math.floor(f * 4 + B[(y & 3) * 4 + (x & 3)] / 16) / 4;
        const i = (y * r * 2 + x) * 4;
        img.data[i] = 255; img.data[i + 1] = 190; img.data[i + 2] = 110;
        img.data[i + 3] = Math.round(lvl * 110);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // ======================================================================
  // Rooms
  // ======================================================================
  roomCanvas(world, room) {
    let r = this.rooms.get(room.key);
    if (!r) {
      r = { canvas: this.bakeRoom(world, room), room };
      this.rooms.set(room.key, r);
    }
    return r.canvas;
  }

  bakeRoom(world, room) {
    const c = document.createElement('canvas');
    c.width = ROOM_PW; c.height = ROOM_PH;
    const g = c.getContext('2d');
    const seed = room.key * 31 + world.floor * 7 + 1;
    const rnd = S.rng(seed);
    const doorStyle = {};
    for (const d of ['n', 's', 'e', 'w']) {
      if (!room.doors[d]) continue;
      const o = world.dungeon.rooms.get(world.neighbourKey(room, d));
      doorStyle[d] = room.type === 'boss' || o.type === 'boss' ? 'boss' : room.type === 'treasure' || o.type === 'treasure' ? 'treasure' : 'normal';
    }
    g.fillStyle = '#0d0705';
    g.fillRect(0, 0, ROOM_PW, ROOM_PH);
    drawRoom(g, { s: PX, ox: WALL_SIDE, oy: WALL_TOP, w: W, d: D, doors: room.doors, seed, doorStyle, tint: FLOOR_TINTS[world.floor % 4] });
    const at = (i, j) => [WALL_SIDE + (i + 0.5) * PX, WALL_TOP + (D - j - 0.5) * PX];
    // a few old stains
    for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) {
      const [x, y] = at(Math.floor(rnd() * W), Math.floor(rnd() * D));
      S.bloodSplat(g, x, y, PX, seed + k, [110, 14, 16]);
    }
    grime(g, ROOM_PW, ROOM_PH, seed, 0.07);
    quantize(g, ROOM_PW, ROOM_PH, { spread: 12 });

    // props on free tiles near the walls, rocks on solid tiles; drawn top to bottom
    const props = [];
    const free = (i, j) => i >= 0 && j >= 0 && i < W && j < D && !room.tiles[tileIndex(i, j)];
    const nearDoor = (i, j) => (Math.abs(i - (W - 1) / 2) <= 1 && (j <= 1 || j >= D - 2)) || (Math.abs(j - (D - 1) / 2) <= 1 && (i === 0 || i === W - 1));
    for (let j = 0; j < D; j++) {
      for (let i = 0; i < W; i++) {
        if (room.tiles[tileIndex(i, j)] === 1) props.push(['rock', i, j, Math.floor(rnd() * 6)]);
      }
    }
    const candles = [];
    const nProps = 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < nProps; k++) {
      const edge = rnd() < 0.5;
      const i = edge ? (rnd() < 0.5 ? 0 : W - 1) : Math.floor(rnd() * W);
      const j = edge ? Math.floor(rnd() * D) : (rnd() < 0.5 ? 0 : D - 1);
      if (!free(i, j) || nearDoor(i, j) || room.type !== 'normal' && room.type !== 'start' && rnd() < 0.5) continue;
      const kind = ['skull', 'bone', 'candle', 'candle', 'urn', 'bone'][Math.floor(rnd() * 6)];
      props.push([kind, i, j, k]);
      if (kind === 'candle') candles.push(at(i, j));
    }
    props.sort((a, b) => b[2] - a[2]);
    for (const [kind, i, j, v] of props) {
      const [x, y] = at(i, j);
      if (kind === 'rock') this.blitOn(g, this.sprite(`rock${v}`, (cc, px, py, ss) => S.rock(cc, px, py + 0.42 * ss, ss, v + 1), PX), x, y);
      if (kind === 'skull') this.blitOn(g, this.sprite(`skull${v % 3}`, (cc, px, py, ss) => S.skull(cc, px, py, ss, (v % 3 - 1) * 0.4), PX), x, y);
      if (kind === 'bone') this.blitOn(g, this.sprite(`bone${v % 3}`, (cc, px, py, ss) => S.bone(cc, px, py - 0.1 * ss, ss, v % 3), PX), x, y);
      if (kind === 'urn') this.blitOn(g, this.sprite(`urn${v % 2}`, (cc, px, py, ss) => S.urn(cc, px, py + 0.4 * ss, ss, v % 2), PX), x, y);
      if (kind === 'candle') this.blitOn(g, this.sprite(`candle${v % 3}`, (cc, px, py, ss) => S.candle(cc, px, py, ss, 0.3, v % 3 + 1), PX), x, y);
    }
    light(g, ROOM_PW, ROOM_PH, 0.9, candles.map(([x, y]) => ({ x, y: y - 6, r: 46, k: 0.45 })), { steps: 6 });
    return c;
  }

  /** Stamps a blood splat into the room's painting so it stays. */
  stampSplat(world, roomKey, x, y, color, size) {
    const r = this.rooms.get(roomKey);
    if (!r) return;
    const w = Math.ceil(PX * size * 1.6), h = Math.ceil(PX * size * 1.1);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    S.bloodSplat(g, w / 2, h / 2, PX * size, Math.floor(Math.random() * 1000), color);
    quantize(g, w, h, { spread: 10, alphaCut: 90 });
    const rg = r.canvas.getContext('2d');
    rg.globalAlpha = 0.9;
    rg.drawImage(c, Math.round(x - w / 2), Math.round(y - h / 2));
    rg.globalAlpha = 1;
  }

  blitOn(g, spr, x, y) { g.drawImage(spr.canvas, Math.round(x - spr.ax), Math.round(y - spr.ay)); }
  blit(spr, x, y) { this.g.drawImage(spr.canvas, Math.round(x - spr.ax), Math.round(y - spr.ay)); }

  // ======================================================================
  // Per frame
  // ======================================================================
  render(dt) {
    const w = this.world;
    this.time += dt;
    const g = this.g;
    g.fillStyle = '#0a0604';
    g.fillRect(0, 0, this.VW, this.VH);
    if (w) {
      if (w.dungeon !== this.builtDungeon) this.setWorld(w);
      this.drawWorld(w, dt);
      this.drawHud(w);
      this.prebake(w);
    }
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.low, 0, 0, this.VW * this.k, this.VH * this.k);
  }

  /** Paints one not-yet-cached room per frame so doors open without a hitch. */
  prebake(w) {
    for (const room of w.dungeon.rooms.values()) {
      if (!this.rooms.has(room.key) && (room.seen || room.visited)) { this.roomCanvas(w, room); return; }
    }
  }

  drawWorld(w, dt) {
    const g = this.g;
    const room = w.room;
    let offX = 0, offY = 0;
    const sh = w.shake > 0.5 ? Math.round((Math.random() - 0.5) * Math.min(4, w.shake * 0.5)) : 0;
    const tr = w.transition;
    if (tr) {
      const from = w.dungeon.rooms.get(tr.from);
      const k = Math.min(1, tr.t / Cfg.TRANSITION);
      const s = 1 - k * k * (3 - 2 * k);
      const dx = room.gx - from.gx, dy = room.gy - from.gy;
      offX = Math.round(dx * ROOM_PW * s);
      offY = Math.round(-dy * ROOM_PH * s);
      g.drawImage(this.roomCanvas(w, from), this.bx + offX - dx * ROOM_PW, this.by + offY + dy * ROOM_PH);
    }
    const ox = this.bx + offX + sh, oy = this.by + offY;
    g.drawImage(this.roomCanvas(w, room), ox, oy);
    this.ox = ox; this.oy = oy;
    const P = (x, z) => [ox + WALL_SIDE + (x + W / 2) * PX, oy + WALL_TOP + (D / 2 - z) * PX];

    this.consumeEvents(w, P);

    // closed doors while the room has enemies
    if (!room.cleared) {
      for (const d of ['n', 's', 'e', 'w']) {
        if (!room.doors[d]) continue;
        const o = w.dungeon.rooms.get(w.neighbourKey(room, d));
        const style = room.type === 'boss' || o.type === 'boss' ? 'boss' : o.type === 'treasure' ? 'treasure' : 'normal';
        const spr = this.sprite(`door:${d}:${style}`, (cc, x, y, ss) => S.closedDoor(cc, x, y - (d === 'n' ? 0 : 0.6 * ss), ss, d, style), PX, d === 'n' ? 1.8 : 1.6, d === 'n' ? 2.2 : 1.8);
        const [dx, dy] = d === 'n' ? P(0, D / 2) : d === 's' ? P(0, -D / 2) : d === 'e' ? P(W / 2, 0) : P(-W / 2, 0);
        this.blit(spr, dx, dy + (d === 'n' ? 0 : 0.6 * PX));
      }
    }

    // everything that stands on the floor, sorted by depth
    const list = [];
    const t = this.time;
    for (const it of room.pickups) {
      const [x, y] = P(it.x, it.z);
      list.push([y, () => this.drawPickup(it, x, y, t)]);
    }
    for (const c of w.clouds) {
      const [x, y] = P(c.x, c.z);
      const k = c.t / c.life;
      const spr = this.sprite(`cloud${Math.round(c.r * 4)}`, (cc, px, py, ss) => S.cloud(cc, px, py, ss, 3), PX * c.r, 2, 1.4);
      list.push([y - 100, () => { g.globalAlpha = 0.55 * Math.min(1, (1 - k) * 4); this.blit(spr, x, y); g.globalAlpha = 1; }]);
    }
    for (const e of w.enemies) {
      const [x, y] = P(e.x, e.z);
      list.push([y, () => this.drawEnemy(w, e, x, y, t)]);
    }
    const p = w.player;
    {
      const [x, y] = P(p.x, p.z);
      list.push([y, () => this.drawHero(w, x, y, t)]);
    }
    const fx = w.shotEffects();
    const wispCol = shotColor(fx) === '#9ad0ff' ? '#ffb060' : shotColor(fx);
    for (const [wx, wz] of w.orbitalPositions()) {
      const [x, y] = P(wx, wz);
      list.push([y, () => this.blit(this.sprite(`wisp${wispCol}`, (cc, px, py, ss) => S.wisp(cc, px, py, ss, wispCol), PX, 1, 1.2), x, y)]);
    }
    for (const s of w.shots) {
      const [x, y] = P(s.x, s.z);
      const col = shotColor(s.fx);
      const size = Math.round(s.r * 40) / 40;
      list.push([y, () => this.blit(this.sprite(`tear${col}${size}`, (cc, px, py, ss) => S.tear(cc, px, py - 0.5 * ss, ss, { color: col, size }), PX, 1, 1.3), x, y)]);
    }
    for (const b of w.eshots) {
      const [x, y] = P(b.x, b.z);
      list.push([y, () => this.blit(this.sprite('etear', (cc, px, py, ss) => S.tear(cc, px, py - 0.5 * ss, ss, { enemy: true }), PX, 1, 1.3), x, y)]);
    }
    list.sort((a, b) => a[0] - b[0]);
    for (const [, draw] of list) draw();

    this.updateParticles(dt);
    this.drawRings(dt);
    this.drawZaps(dt, P);

    // the lantern's warm light follows the hero
    const [hx, hy] = P(p.x, p.z);
    g.globalCompositeOperation = 'soft-light';
    g.drawImage(this.lanternGlow, Math.round(hx + 6 - this.lanternGlow.width / 2), Math.round(hy - 12 - this.lanternGlow.height / 2));
    g.globalCompositeOperation = 'source-over';
  }

  drawHero(w, x, y, t) {
    const p = w.player;
    if (p.iframes > 0 && Math.floor(t * 14) % 2 === 0 && w.state === 'play') return;
    const moving = Math.hypot(p.vx, p.vz) > 0.5 || p.dashT > 0;
    const hasTarget = w.enemies.some((e) => e.alive && e.spawnT <= 0);
    let dx = hasTarget ? p.aimX : moving ? p.vx : p.faceX;
    let dz = hasTarget ? p.aimZ : moving ? p.vz : p.faceZ;
    if (!dx && !dz) dz = -1;
    const facing = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : (dz > 0 ? 'up' : 'down');
    const [k, ft] = frame(moving ? 'heroWalk' : 'heroIdle', t);
    const key = `hero:${facing}:${moving ? 'w' : 'i'}${k}`;
    const spr = this.sprite(key, (cc, px, py, ss) => S.hero(cc, px, py, ss, ft, { facing, moving }), PX * 1.45, 1.9, 2.0);
    if (p.dashT > 0) {
      this.g.globalAlpha = 0.35;
      this.blit(spr, x - p.dashX * 6, y + p.dashZ * 6);
      this.g.globalAlpha = 1;
    }
    this.blit(spr, x, y);
    if (p.shield > 0) {
      // bone armour: a ring of pale dots circling the hero
      const g = this.g;
      g.fillStyle = '#ece0c4';
      for (let k = 0; k < 8; k++) {
        const a = t * 3 + (k / 8) * TAU;
        g.fillRect(Math.round(x + Math.cos(a) * 11), Math.round(y - 12 + Math.sin(a) * 8), 2, 2);
      }
    }
  }

  drawEnemy(w, e, x, y, t) {
    if (e.spawnT > 0) {
      if (Math.random() < 0.25) this.burst(x, y, '#140a06', 1, 0.6, 2);
      if (Math.floor(t * 16) % 2 === 0) return;
    }
    const tt = t + e.phase;
    let spr, key;
    const big = 1.3;
    if (e.type === 'fly') {
      const [k, ft] = frame('fly', tt);
      key = `fly${k}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.fly(cc, px, py, ss, ft), PX * 1.5, 1.2, 1.6);
    } else if (e.type === 'grub') {
      const [k, ft] = frame('grub', tt);
      key = `grub${k}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.grub(cc, px, py, ss, ft), PX * big, 1.2, 1.4);
    } else if (e.type === 'eye') {
      const [k, ft] = frame('eye', tt);
      const p = w.player;
      const a = Math.round(Math.atan2(-(p.z - e.z), p.x - e.x) / (TAU / 8));
      const look = [Math.cos(a * TAU / 8), Math.sin(a * TAU / 8)];
      const blink = e.blink > 0 ? 1 : 0;
      key = `eye${k}:${a}:${blink}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.eyeball(cc, px, py, ss, ft, { look, blink: blink ? 0.7 : 0 }), PX * big, 1.2, 1.8);
    } else if (e.type === 'ram') {
      const [k, ft] = frame('ram', tt * (e.state === 'charge' ? 2 : 1));
      key = `ram${k}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.ram(cc, px, py, ss, ft), PX * big, 1.3, 1.5);
    } else if (e.type === 'slime') {
      const [k, ft] = frame('slime', tt);
      key = `slime${e.small ? 's' : ''}${k}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.slime(cc, px, py, ss, ft, { small: !!e.small }), PX * big, 1.3, 1.3);
      if (e.hop > 0) y -= Math.round(Math.sin((e.hop / 0.45) * Math.PI) * 6);
    } else if (e.type === 'bloat') {
      const [k, ft] = frame('bloat', tt);
      const swell = e.swell ? 1.12 : 1;
      key = `bloat${k}:${swell}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.bloat(cc, px, py, ss, ft), PX * 0.85 * swell, 3.4, 3.2);
      if (e.lift) {
        S.shadow(this.g, x, y, PX, 1.0, 0.4);
        y -= Math.round(e.lift * PX * 0.6);
      }
    } else if (e.type === 'spider') {
      const run = e.run > 0;
      const [k, ft] = frame(run ? 'spiderRun' : 'spider', tt);
      key = `spider${run ? 'r' : ''}${k}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.spider(cc, px, py, ss, ft, { run }), PX * 1.3, 1.0, 1.0);
    } else if (e.type === 'clot') {
      const [k, ft] = frame('clot', tt);
      const sq = e.squish > 0.3 ? 1 : 0;
      key = `clot${k}:${sq}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.clot(cc, px, py, ss, ft, { squish: sq }), PX * 1.3, 1.1, 1.3);
    } else if (e.type === 'gaper') {
      const angry = !!e.angry;
      const [k, ft] = frame(angry ? 'gaperRun' : 'gaper', tt);
      key = `gaper${angry ? 'a' : ''}${k}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.gaper(cc, px, py, ss, ft, { angry }), PX * 1.3, 0.9, 1.6);
    } else if (e.type === 'host') {
      const up = Math.round(e.up * 3) / 3;
      key = `host${up}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.host(cc, px, py, ss, 0, { up }), PX * 1.3, 1.0, 1.3);
    } else if (e.type === 'leaper') {
      const air = !!e.air;
      key = `leaper${air ? 'a' : 's'}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.leaper(cc, px, py, ss, 0, { air }), PX * 1.3, 1.1, 1.3);
      if (e.lift) {
        S.shadow(this.g, x, y, PX, 0.35, 0.35);
        y -= Math.round(e.lift * PX * 0.6);
      }
    } else if (e.type === 'boomfly') {
      const [k, ft] = frame('boomfly', tt);
      key = `boomfly${k}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.boomfly(cc, px, py, ss, ft), PX * 1.3, 1.2, 1.6);
    } else if (e.type === 'wraith') {
      const [k, ft] = frame('wraith', tt);
      key = `wraith${k}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.wraith(cc, px, py, ss, ft), PX * 1.3, 1.0, 1.9);
    } else if (e.type === 'gorger') {
      const [k, ft] = frame('gorger', tt);
      const mouth = e.mouth ? 1 : 0;
      key = `gorger${k}:${mouth}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.gorger(cc, px, py, ss, ft, { mouth }), PX * 1.05, 2.5, 2.5);
      if (e.lift) {
        S.shadow(this.g, x, y, PX, 1.0, 0.4);
        y -= Math.round(e.lift * PX * 0.6);
      }
    } else if (e.type === 'hive') {
      const [k, ft] = frame('hive', tt);
      const pulse = e.pulse ? 1 : 0;
      key = `hive${k}:${pulse}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.hive(cc, px, py, ss, ft, { pulse }), PX * 1.1, 2.3, 3.6);
    } else if (e.type === 'bonelord') {
      const [k, ft] = frame('ram', tt * (e.windup || e.step === 2 ? 2 : 1));
      const windup = e.windup ? 1 : 0;
      key = `bonelord${k}:${windup}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.bonelord(cc, px, py, ss, ft, { windup }), PX * 1.05, 2.4, 3.3);
    } else if (e.type === 'deep') {
      const [k, ft] = frame('deep', tt);
      const p = w.player;
      const a = Math.round(Math.atan2(-(p.z - e.z), p.x - e.x) / (TAU / 8));
      const look = [Math.cos(a * TAU / 8), Math.sin(a * TAU / 8)];
      const stare = e.stare ? 1 : 0;
      key = `deep${k}:${a}:${stare}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.deepEye(cc, px, py, ss, ft, { look, stare }), PX * 1.2, 2.8, 3.4);
    }
    if (!spr) return;
    if (e.flash > 0.3) spr = this.tinted(key, spr, '#ffffff', 0.75);
    else if (e.stun > 0) spr = this.tinted(key, spr, '#ffe060', 0.35);
    else if (e.frozen > 0) spr = this.tinted(key, spr, '#8adcff', 0.5);
    else if (e.burn > 0) spr = this.tinted(key, spr, Math.floor(t * 8) % 2 ? '#ff7a2a' : '#ffb040', 0.35);
    else if (e.poison > 0) spr = this.tinted(key, spr, '#7ad040', 0.3);
    if (e.alpha !== undefined && e.alpha < 0.99) {
      // ghosts flicker in and out
      if (e.alpha < 0.05) return;
      this.g.globalAlpha = e.alpha;
      this.blit(spr, x, y);
      this.g.globalAlpha = 1;
    } else this.blit(spr, x, y);
    if (e.burn > 0 && Math.random() < 0.3) this.burst(x, y - 14, '#ff9a2a', 1, 0.4, 3, -30);
  }

  drawPickup(it, x, y, t) {
    if (it.kind === 'coin') {
      const [k, ft] = frame('coin', t + it.x);
      this.blit(this.sprite(`coin${k}`, (cc, px, py, ss) => S.coin(cc, px, py, ss, ft), PX, 0.8, 0.9), x, y);
    } else if (it.kind === 'heart') {
      this.blit(this.sprite('heartPick', (cc, px, py, ss) => S.heart(cc, px, py, ss), PX * 1.1, 1, 1), x, y - Math.round(Math.abs(Math.sin(t * 3)) * 2));
    } else if (it.kind === 'item') {
      this.blit(this.sprite('pedestal', (cc, px, py, ss) => S.pedestal(cc, px, py, ss), PX, 1.2, 1.1), x, y);
      const ic = this.icon(ITEMS[it.id].icon, 13);
      const gy = y - 0.9 * PX - Math.round(Math.sin(t * 2.2) * 2);
      this.g.globalCompositeOperation = 'soft-light';
      this.g.drawImage(this.lanternGlow, Math.round(x - 20), Math.round(gy - 16), 40, 32);
      this.g.globalCompositeOperation = 'source-over';
      this.blit(ic, x, gy);
    } else if (it.kind === 'trapdoor') {
      this.blit(this.sprite('trapdoor', (cc, px, py, ss) => S.trapdoor(cc, px, py, ss), PX, 1.8, 1.6), x, y);
    }
    if (it.price) {
      const txt = textSprite(`${it.price}¢`, '#f6c84a');
      this.g.drawImage(txt, Math.round(x - txt.width / 2), Math.round(y + 3));
    }
  }

  // ======================================================================
  // Effects
  // ======================================================================
  consumeEvents(w, P) {
    for (const e of w.events) {
      if (e.type === 'kill') {
        const [x, y] = P(e.x, e.z);
        const c = BLOOD[e.enemy] || [150, 16, 20];
        const hex = `rgb(${c[0]},${c[1]},${c[2]})`;
        this.burst(x, y - 8, hex, e.boss ? 50 : 12, e.boss ? 2.5 : 1.2, 6);
        this.stampSplat(w, w.roomKey, x - this.ox, y - this.oy, c, e.boss ? 2.4 : e.small ? 0.6 : 1);
      } else if (e.type === 'hit') {
        const [x, y] = P(e.x, e.z);
        this.burst(x, y - 10, shotColor(e.fx), 4, 0.8, 3);
      } else if (e.type === 'splat') {
        const [x, y] = P(e.x, e.z);
        this.burst(x, y - 10, shotColor(e.fx), 5, 0.6, 2);
      } else if (e.type === 'esplat') {
        const [x, y] = P(e.x, e.z);
        this.burst(x, y - 10, '#9a1418', 4, 0.6, 2);
      } else if (e.type === 'explode') {
        const [x, y] = P(e.x, e.z);
        const col = shotColor(e.fx);
        this.rings.push({ x, y, r: e.r * PX, t: 0, life: 0.3, color: col === '#9ad0ff' ? '#ffb040' : col, fill: true });
        this.burst(x, y - 4, col === '#9ad0ff' ? '#ff9a2a' : col, 14, 1.6, 4);
      } else if (e.type === 'slam') {
        const [x, y] = P(e.x, e.z);
        this.rings.push({ x, y, r: e.r * PX, t: 0, life: 0.45, color: '#8a6a4a' });
        this.burst(x, y, '#4a3a2a', 30, 2, 2);
      } else if (e.type === 'zap') {
        this.zaps.push({ pts: e.pts.map(([x, z]) => P(x, z)), t: 0 });
      } else if (e.type === 'clink') {
        const [x, y] = P(e.x, e.z);
        this.burst(x, y - 10, '#ece0c4', 4, 0.7, 3);
      } else if (e.type === 'block') {
        const [x, y] = P(w.player.x, w.player.z);
        this.rings.push({ x, y: y - 10, r: 16, t: 0, life: 0.3, color: '#ece0c4' });
        this.burst(x, y - 12, '#ece0c4', 10, 1.2, 4);
      } else if (e.type === 'hurt') {
        const [x, y] = P(w.player.x, w.player.z);
        this.burst(x, y - 12, '#b01818', 12, 1.2, 4);
      }
    }
  }

  burst(x, y, color, n, power, z = 4, gravity = 220) {
    for (let k = 0; k < n && this.parts.length < 500; k++) {
      const a = Math.random() * TAU, sp = (10 + Math.random() * 40) * power;
      this.parts.push({
        x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 30 + Math.random() * 60 * power,
        t: 0, life: 0.3 + Math.random() * 0.4, color, size: Math.random() < 0.3 ? 2 : 1, g: gravity,
      });
    }
  }

  updateParticles(dt) {
    const g = this.g;
    this.parts = this.parts.filter((p) => {
      p.t += dt;
      if (p.t >= p.life) return false;
      p.vz -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5; }
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y - p.z), p.size, p.size);
      return true;
    });
  }

  drawRings(dt) {
    const g = this.g;
    this.rings = this.rings.filter((r) => {
      r.t += dt;
      if (r.t >= r.life) return false;
      const k = r.t / r.life;
      const rad = r.r * (0.3 + 0.7 * Math.sqrt(k));
      if (r.fill && k < 0.4) {
        g.fillStyle = '#fff0b0';
        g.globalAlpha = 0.6 * (1 - k / 0.4);
        g.beginPath(); g.ellipse(Math.round(r.x), Math.round(r.y), rad * 0.7, rad * 0.55, 0, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
      // pixel circle
      g.fillStyle = r.color;
      const n = Math.max(12, Math.round(rad * 3));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        g.fillRect(Math.round(r.x + Math.cos(a) * rad), Math.round(r.y + Math.sin(a) * rad * 0.75), 1, 1);
      }
      return true;
    });
  }

  /** Lightning: jagged pixel lines between the points, flickering briefly. */
  drawZaps(dt) {
    const g = this.g;
    this.zaps = this.zaps.filter((z) => {
      z.t += dt;
      if (z.t > 0.15) return false;
      g.fillStyle = Math.floor(z.t * 40) % 2 ? '#fff6b0' : '#a8e0ff';
      for (let i = 0; i + 1 < z.pts.length; i++) {
        const [x0, y0] = z.pts[i], [x1, y1] = z.pts[i + 1];
        const ya = y0 - 10, yb = y1 - 10;
        const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, yb - ya) / 6));
        let px = x0, py = ya;
        for (let k = 1; k <= n; k++) {
          const nx = x0 + ((x1 - x0) * k) / n + (k < n ? (Math.random() - 0.5) * 6 : 0);
          const ny = ya + ((yb - ya) * k) / n + (k < n ? (Math.random() - 0.5) * 6 : 0);
          const steps = Math.ceil(Math.hypot(nx - px, ny - py));
          for (let s = 0; s <= steps; s++) g.fillRect(Math.round(px + ((nx - px) * s) / steps), Math.round(py + ((ny - py) * s) / steps), 1, 1);
          px = nx; py = ny;
        }
      }
      return true;
    });
  }

  // ======================================================================
  // HUD
  // ======================================================================
  drawHud(w) {
    const g = this.g;
    const p = w.player, s = w.stats;
    // hearts
    const hearts = s.maxHp / 2;
    for (let i = 0; i < hearts; i++) {
      const v = p.hp - i * 2;
      const kind = v >= 2 ? 'full' : v === 1 ? 'half' : 'empty';
      const spr = this.sprite(`hud:heart:${kind}`, (cc, px, py, ss) => S.heart(cc, px, py, ss, { half: kind === 'half', empty: kind === 'empty' }), 13, 1, 1);
      this.blit(spr, 9 + (i % 6) * 11, 15 + Math.floor(i / 6) * 10);
    }
    // coins and floor name
    const row = hearts > 6 ? 32 : 24;
    this.blit(this.sprite('hud:coin', (cc, px, py, ss) => S.coin(cc, px, py, ss, 0), 13, 1, 1), 8, row + 7);
    g.drawImage(textSprite(String(p.coins).padStart(2, '0'), '#f6c84a'), 15, row);
    const names = ['KJELLEREN', 'KATAKOMBENE', 'BENHUSET', 'DYPET'];
    g.drawImage(textSprite(`${names[w.floor]} ${['I', 'II', 'III', 'IV'][w.floor]}`, '#c0b2a2'), 34, row);
    // items and transformations
    let ix = 6;
    for (const id of w.items) {
      const ic = this.icon(ITEMS[id].icon, 9);
      g.drawImage(ic.canvas, ix, row + 8);
      ix += 11;
      if (ix > this.VW - 70) break;
    }
    for (const tf of activeTransforms(w.items)) {
      g.drawImage(this.icon(TRANSFORMS[tf].icon, 9).canvas, ix, row + 8);
      ix += 11;
    }
    // minimap
    this.drawMinimap(w);
    // boss health
    const boss = w.enemies.find((e) => e.boss);
    if (boss) {
      const y = this.by + ROOM_PH + 4;
      const name = textSprite(ENEMIES[boss.type].name, '#e0a090');
      g.drawImage(name, Math.round(this.VW / 2 - name.width / 2), y);
      const bw2 = ROOM_PW - 30, bx = Math.round(this.VW / 2 - bw2 / 2);
      g.fillStyle = '#0d0705'; g.fillRect(bx - 1, y + 8, bw2 + 2, 6);
      g.fillStyle = '#3a0a0c'; g.fillRect(bx, y + 9, bw2, 4);
      g.fillStyle = '#b02a2a'; g.fillRect(bx, y + 9, Math.round(bw2 * Math.max(0, boss.hp / boss.maxHp)), 4);
      g.fillStyle = '#d24a40'; g.fillRect(bx, y + 9, Math.round(bw2 * Math.max(0, boss.hp / boss.maxHp)), 1);
    }
  }

  drawMinimap(w) {
    const g = this.g;
    const cur = w.room;
    const cw = 9, ch = 6, gap = 1;
    const cx = this.VW - 34, cy = 14;
    for (const r of w.dungeon.rooms.values()) {
      if (!r.visited && !r.seen) continue;
      const dx = r.gx - cur.gx, dy = r.gy - cur.gy;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) continue;
      const x = cx + dx * (cw + gap) - Math.floor(cw / 2), y = cy - dy * (ch + gap) - Math.floor(ch / 2);
      g.fillStyle = '#0d0705';
      g.fillRect(x - 1, y - 1, cw + 2, ch + 2);
      g.fillStyle = r === cur ? '#fff1e6' : r.visited ? '#887b70' : '#3d3530';
      g.fillRect(x, y, cw, ch);
      const mark = { boss: '#b02a2a', treasure: '#f6c84a', shop: '#d89a2a' }[r.type];
      if (mark) { g.fillStyle = mark; g.fillRect(x + 3, y + 1, 3, 4); }
    }
  }
}
