// Pixel-art renderer (Canvas 2D). Reads the World every frame and draws it;
// never changes game state. Everything is drawn into a small low-resolution
// canvas and scaled up by a whole number with nearest-neighbour, so pixels
// stay crisp. Rooms are painted once and cached; sprites are rendered once
// per animation frame and cached.

import { Cfg } from './config.js';
import * as S from './sprites.js';
import { drawRoom } from './roomart.js';
import { pixelSprite, quantize, light, grime, outline } from './pixel.js';
import { textSprite } from './font.js';
import { Effects } from './effects.js';
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
// Trail colour for each projectile look
const SKIN_TRAIL = {
  flame: '#ffb040', shard: '#cfeaff', bubble: '#9ad050', blade: '#e0e8f0', bone: '#ece0c4',
  skull: '#9ad8ff', star: '#fff0a0', fly: '#6a6a50', tar: '#2a1a30', bomb: '#ff8a2a', void: '#a060ff',
};
const ROTATES = new Set(['flame', 'shard', 'bone', 'skull', 'fly']);
// Items that show on the hero
const COSTUME = { ember: 'flame', halo: 'halo', sulfur: 'horns', storm: 'crown', janus: 'mask', armor: 'bones' };
const EL_HEX = { fire: '#ff8a3a', ice: '#8af0ff', poison: '#9ad050', blood: '#e04848' };

// Frames per animation cycle: [period in seconds, frames]
const CYCLE = {
  heroWalk: [TAU / 12, 8], heroIdle: [TAU / 2.2, 8],
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
    this.fx = new Effects();
    this.time = 0;
    this.dt = 0;
    this.world = null;
    this.lanternGlow = this.makeGlow(70);
    this.smallGlow = this.makeGlow(16);
    this.candles = new Map();     // room key -> flame positions in room pixels
    this.lights = [];             // short flashes of light (explosions)
    this.trail = [];              // dash afterimages
    this.motes = [];
    this.recoil = 0;
    this.dustT = 0;
    this.doorOpen = null;
    this.holdItem = null;
    this.bossIntro = null;
    this.whiteFlash = 0;
    this.deathT = 0;
    this.hudShake = 0;
    this.lastCoins = 0;
    this.coinBump = 0;
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
    this.g.imageSmoothingEnabled = false;
    this.redEdge = this.makeEdge(this.VW, this.VH);
    this.bx = Math.floor((this.VW - ROOM_PW) / 2);
    this.by = HUD_H + Math.max(0, Math.floor((this.VH - HUD_H - ROOM_PH) * 0.3));
    // where the HUD ends on screen, in CSS pixels (for HTML buttons)
    this.hudBottomCss = (HUD_H * k) / dpr;
  }

  setWorld(world) {
    const fresh = this.world !== world;
    this.world = world;
    this.rooms.clear();
    this.candles.clear();
    this.fx.clear();
    this.lights = [];
    this.trail = [];
    this.builtDungeon = world.dungeon;
    if (fresh) {
      this.look = null;
      this.deathT = 0;
      this.bossIntro = null;
      this.holdItem = null;
      this.lastCoins = world.player.coins;
    }
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

  /** Red edges for low health, the size of the screen. */
  makeEdge(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.62);
    gr.addColorStop(0, 'rgba(150,0,0,0)');
    gr.addColorStop(1, 'rgba(150,0,0,0.75)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    return c;
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
    const candles = [], flames = [];
    this.candles.set(room.key, flames);
    const nProps = 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < nProps; k++) {
      const edge = rnd() < 0.5;
      const i = edge ? (rnd() < 0.5 ? 0 : W - 1) : Math.floor(rnd() * W);
      const j = edge ? Math.floor(rnd() * D) : (rnd() < 0.5 ? 0 : D - 1);
      if (!free(i, j) || nearDoor(i, j) || room.type !== 'normal' && room.type !== 'start' && rnd() < 0.5) continue;
      // each floor has its own clutter: cellar jars, catacomb candles, ossuary skulls
      const pool = [
        ['urn', 'urn', 'candle', 'bone', 'skull', 'candle'],
        ['candle', 'candle', 'skull', 'bone', 'urn', 'skull'],
        ['skulls', 'skull', 'bone', 'bone', 'candle', 'skulls'],
        ['skulls', 'candle', 'bone', 'skull', 'candle', 'urn'],
      ][world.floor % 4];
      const kind = pool[Math.floor(rnd() * pool.length)];
      props.push([kind, i, j, k]);
      if (kind === 'candle') {
        candles.push(at(i, j));
        // where this candle's flame sits, so it can flicker live
        const h = (0.22 + S.rng(k % 3 + 1)() * 0.15) * PX;
        flames.push([at(i, j)[0], at(i, j)[1] - h - 2]);
      }
    }
    props.sort((a, b) => b[2] - a[2]);
    for (const [kind, i, j, v] of props) {
      const [x, y] = at(i, j);
      if (kind === 'rock') this.blitOn(g, this.sprite(`rock${v}`, (cc, px, py, ss) => S.rock(cc, px, py + 0.42 * ss, ss, v + 1), PX), x, y);
      if (kind === 'skulls') {
        for (const [dx, dy, sv] of [[-5, 2, 0], [5, 3, 2], [0, -3, 1]]) this.blitOn(g, this.sprite(`skull${sv}`, (cc, px, py, ss) => S.skull(cc, px, py, ss, (sv - 1) * 0.4), PX), x + dx, y + dy);
      }
      if (kind === 'skull') this.blitOn(g, this.sprite(`skull${v % 3}`, (cc, px, py, ss) => S.skull(cc, px, py, ss, (v % 3 - 1) * 0.4), PX), x, y);
      if (kind === 'bone') this.blitOn(g, this.sprite(`bone${v % 3}`, (cc, px, py, ss) => S.bone(cc, px, py - 0.1 * ss, ss, v % 3), PX), x, y);
      if (kind === 'urn') this.blitOn(g, this.sprite(`urn${v % 2}`, (cc, px, py, ss) => S.urn(cc, px, py + 0.4 * ss, ss, v % 2), PX), x, y);
      if (kind === 'candle') this.blitOn(g, this.sprite(`candle${v % 3}`, (cc, px, py, ss) => S.candle(cc, px, py, ss, 0.3, v % 3 + 1), PX), x, y);
    }
    // torches on the north wall, either side of the doorway
    const torches = [];
    if (rnd() < 0.75) {
      for (const tx of [1.6, W - 1.6]) {
        const x = WALL_SIDE + tx * PX, y = Math.round(WALL_TOP * 0.45);
        this.blitOn(g, this.sprite('torch', (cc, px, py, ss) => S.torch(cc, px, py - 0.2 * ss, ss), PX, 0.6, 0.8), x, y);
        torches.push([x, y]);
        flames.push([x, y - 11, true]);
      }
    }
    light(g, ROOM_PW, ROOM_PH, 0.9, [
      ...candles.map(([x, y]) => ({ x, y: y - 6, r: 46, k: 0.45 })),
      ...torches.map(([x, y]) => ({ x, y: y + 10, r: 70, k: 0.5 })),
    ], { steps: 6 });
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
    this.dt = dt;
    const g = this.g;
    g.fillStyle = '#0a0604';
    g.fillRect(0, 0, this.VW, this.VH);
    if (w) {
      if (w.dungeon !== this.builtDungeon) this.setWorld(w);
      this.drawWorld(w, dt);
      this.drawOverlays(w, dt);
      this.drawHud(w, dt);
      if (this.bossIntro) this.drawBossIntro(w, dt);
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
    this.drawCandles(room, ox, oy);

    // closed doors while the room has enemies; they sink away when it is cleared
    const opening = this.doorOpen && this.doorOpen.key === room.key ? this.doorOpen : null;
    if (opening) { opening.t += dt; if (opening.t > 0.4) this.doorOpen = null; }
    if (!room.cleared || opening) {
      const k = opening ? Math.min(1, opening.t / 0.4) : 0;
      for (const d of ['n', 's', 'e', 'w']) {
        if (!room.doors[d]) continue;
        const o = w.dungeon.rooms.get(w.neighbourKey(room, d));
        const style = room.type === 'boss' || o.type === 'boss' ? 'boss' : o.type === 'treasure' ? 'treasure' : 'normal';
        const spr = this.sprite(`door:${d}:${style}`, (cc, x, y, ss) => S.closedDoor(cc, x, y - (d === 'n' ? 0 : 0.6 * ss), ss, d, style), PX, d === 'n' ? 1.8 : 1.6, d === 'n' ? 2.2 : 1.8);
        const [dx, dy] = d === 'n' ? P(0, D / 2) : d === 's' ? P(0, -D / 2) : d === 'e' ? P(W / 2, 0) : P(-W / 2, 0);
        if (k > 0) g.globalAlpha = 1 - k;
        this.blit(spr, dx, dy + (d === 'n' ? 0 : 0.6 * PX) - Math.round(k * 6));
        g.globalAlpha = 1;
      }
    }
    this.fx.drawUnder(g, dt);
    this.drawMotes(dt, ox, oy);
    if (!tr) { this.drawCritters(w, dt, ox, oy, P); this.drawDrips(w, dt, ox, oy); }

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
      this.drawTrail(dt);
      list.push([y, () => this.drawHero(w, x, y, t)]);
    }
    const fx = w.shotEffects();
    const wispCol = shotColor(fx) === '#9ad0ff' ? '#ffb060' : shotColor(fx);
    for (const [wx, wz] of w.orbitalPositions()) {
      const [x, y] = P(wx, wz);
      list.push([y, () => this.blit(this.sprite(`wisp${wispCol}`, (cc, px, py, ss) => S.wisp(cc, px, py, ss, wispCol), PX, 1, 1.2), x, y)]);
    }
    const baseSkin = w.stats.skin || 'tear';
    for (const s of w.shots) {
      const [x, y] = P(s.x, s.z);
      const col = shotColor(s.fx);
      const size = Math.round(s.r * 40) / 40;
      const skin = s.big && w.stats.charge ? 'void' : baseSkin;
      const trail = skin === 'tear' ? col : SKIN_TRAIL[skin];
      // a faint trail behind each shot; some looks leave their own kind of trail
      if (Math.random() < (s.big ? 1 : 0.5)) this.fx.add(x + (Math.random() - 0.5) * 2, y - 10 + (Math.random() - 0.5) * 2, 0, 0, trail, { life: s.big ? 0.25 : 0.14, fade: true, size: s.big ? 2 : 1 });
      if (skin === 'star' && Math.random() < 0.35) this.fx.add(x + (Math.random() - 0.5) * 6, y - 10 + (Math.random() - 0.5) * 6, 0, 0, Math.random() < 0.5 ? '#ffffff' : '#ffe060', { life: 0.35, fade: true });
      if (skin === 'tar' && Math.random() < 0.15) this.fx.add(x, y - 8, 0, 0, '#1a1420', { z: 0, g: 200, life: 0.3 });
      if ((skin === 'bomb' || (s.fx && s.fx.fire)) && Math.random() < 0.3) this.fx.add(x, y - 10, (Math.random() - 0.5) * 10, 0, '#ffb040', { z: 0, vz: 25, life: 0.3, fade: true });
      if (s.big || skin === 'flame' || skin === 'skull' || skin === 'star' || (s.fx && s.fx.fire)) this.lights.push({ x, y: y - 10, r: s.big ? 18 : 12, t: 0, life: 0.001, k: 0.6 });
      let spr;
      if (skin === 'tear') {
        spr = this.sprite(`tear${col}${size}`, (cc, px, py, ss) => S.tear(cc, px, py - 0.5 * ss, ss, { color: col, size }), PX, 1, 1.3);
      } else {
        // 16 flight directions for things that point, 8 spin frames for things that turn
        const ab = ROTATES.has(skin) ? Math.round(Math.atan2(-s.vz, s.vx) / (TAU / 16)) & 15 : 0;
        const sf = Math.floor(((this.time * (skin === 'blade' ? 3 : 1.5) + s.t) % 1) * 8);
        spr = this.sprite(`shot:${skin}:${size}:${ab}:${sf}`, (cc, px, py, ss) => S.projectile(cc, px, py - 0.5 * ss, ss, { skin, size, angle: (ab * TAU) / 16, spin: sf / 8 }), PX, 1.3, 1.5);
      }
      list.push([y, () => this.blit(spr, x, y)]);
    }
    for (const b of w.eshots) {
      const [x, y] = P(b.x, b.z);
      if (Math.random() < 0.3) this.fx.add(x, y - 10, 0, 0, '#7a1014', { life: 0.12, fade: true });
      list.push([y, () => this.blit(this.sprite('etear', (cc, px, py, ss) => S.tear(cc, px, py - 0.5 * ss, ss, { enemy: true }), PX, 1, 1.3), x, y)]);
    }
    list.sort((a, b) => a[0] - b[0]);
    for (const [, draw] of list) draw();

    this.fx.draw(g, dt);
    this.drawHeldItem(w, P, dt);

    // the lantern's warm light follows the hero; explosions flash
    const [hx, hy] = P(p.x, p.z);
    g.globalCompositeOperation = 'soft-light';
    g.drawImage(this.lanternGlow, Math.round(hx + 6 - this.lanternGlow.width / 2), Math.round(hy - 12 - this.lanternGlow.height / 2));
    this.lights = this.lights.filter((l) => {
      l.t += dt;
      const k = Math.min(1, l.t / Math.max(l.life, 0.001));
      g.globalAlpha = (l.k || 1) * (1 - k * 0.8);
      g.drawImage(this.lanternGlow, Math.round(l.x - l.r), Math.round(l.y - l.r * 0.8), l.r * 2, Math.round(l.r * 1.6));
      return l.t < l.life;
    });
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  /** Live flicker on top of the baked candles. */
  drawCandles(room, ox, oy) {
    const g = this.g, t = this.time;
    for (const [i, [x, y, big]] of (this.candles.get(room.key) || []).entries()) {
      const n = Math.sin(t * 13 + i * 7) + Math.sin(t * 23 + i * 3) * 0.5;
      const fx = Math.round(ox + x), fy = Math.round(oy + y);
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = 0.55 + n * 0.15;
      if (big) g.drawImage(this.lanternGlow, fx - 30, fy - 22, 60, 48);
      else g.drawImage(this.smallGlow, fx - 16, fy - 13);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      if (big) {
        // torch: a wider, taller flame that throws sparks
        const h = 5 + Math.round(n * 1.5);
        g.fillStyle = '#c8401a'; g.fillRect(fx - 2, fy - h + 3, 5, h - 1);
        g.fillStyle = '#ff9a2a'; g.fillRect(fx - 1, fy - h, 3, h);
        g.fillStyle = '#fff4c0'; g.fillRect(fx, fy - 2, 1, 3);
        if (Math.random() < 0.06) this.fx.add(fx, fy - h, (Math.random() - 0.5) * 8, 0, '#ffb040', { z: 0, vz: 18, life: 0.6, fade: true });
        continue;
      }
      const h = n > 0.6 ? 3 : n > -0.6 ? 2 : 1;
      g.fillStyle = '#ff9a2a'; g.fillRect(fx, fy - h, 1, h + 1);
      g.fillStyle = '#fff4c0'; g.fillRect(fx, fy, 1, 1);
      if (n > 1.1) { g.fillStyle = '#ff9a2a'; g.fillRect(fx + (i % 2 ? 1 : -1), fy - 1, 1, 1); }
    }
  }

  /** Dust specks drifting through the lamplight. */
  drawMotes(dt, ox, oy) {
    const g = this.g;
    const x0 = WALL_SIDE, x1 = WALL_SIDE + W * PX, y0 = WALL_TOP, y1 = WALL_TOP + D * PX;
    while (this.motes.length < 16) {
      this.motes.push({ x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0), vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 3, ph: Math.random() * TAU });
    }
    g.fillStyle = '#f0e0b8';
    for (const m of this.motes) {
      m.x += (m.vx + Math.sin(this.time * 0.7 + m.ph) * 2) * dt;
      m.y += m.vy * dt;
      if (m.y < y0) m.y = y1;
      if (m.x < x0) m.x = x1; else if (m.x > x1) m.x = x0;
      g.globalAlpha = 0.18 + 0.18 * Math.sin(this.time * 1.3 + m.ph);
      g.fillRect(Math.round(ox + m.x), Math.round(oy + m.y), 1, 1);
    }
    g.globalAlpha = 1;
  }

  /** Rats and roaches: harmless, they scurry about and flee into the walls. */
  drawCritters(w, dt, ox, oy, P) {
    const g = this.g, room = w.room;
    const x0 = WALL_SIDE + 2, x1 = WALL_SIDE + W * PX - 2, y0 = WALL_TOP + 2, y1 = WALL_TOP + D * PX - 2;
    if (this.critKey !== room.key) {
      this.critKey = room.key;
      this.critters = [];
      const n = Math.floor(Math.random() * 3) + (room.type === 'normal' ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const i = Math.floor(Math.random() * W), j = Math.floor(Math.random() * D);
        if (room.tiles[tileIndex(i, j)]) continue;
        this.critters.push({ x: WALL_SIDE + (i + 0.5) * PX, y: WALL_TOP + (D - j - 0.5) * PX, vx: 0, vy: 0, t: Math.random() * 2, kind: Math.random() < 0.5 ? 'rat' : 'roach', face: 1 });
      }
    }
    const [hx, hy] = P(w.player.x, w.player.z);
    const lx = hx - ox, ly = hy - oy;
    for (const c of this.critters) {
      if (c.gone) continue;
      const dx = c.x - lx, dy = c.y - ly, d = Math.hypot(dx, dy) || 1;
      const fast = c.kind === 'rat' ? 75 : 55;
      if (d < 34 || c.flee) {
        // run for the nearest wall, away from the hero
        c.flee = true;
        c.vx += ((dx / d) * fast - c.vx) * Math.min(1, dt * 8);
        c.vy += ((dy / d) * fast - c.vy) * Math.min(1, dt * 8);
      } else {
        c.t -= dt;
        if (c.t <= 0) {
          if (c.vx || c.vy) { c.vx = c.vy = 0; c.t = 0.6 + Math.random() * 2; }
          else { const a = Math.random() * TAU, sp = 15 + Math.random() * 20; c.vx = Math.cos(a) * sp; c.vy = Math.sin(a) * sp * 0.7; c.t = 0.2 + Math.random() * 0.5; }
        }
      }
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) {
        if (c.flee) { c.gone = true; continue; }
        c.x = Math.max(x0, Math.min(x1, c.x)); c.y = Math.max(y0, Math.min(y1, c.y)); c.vx = -c.vx; c.vy = -c.vy;
      }
      if (Math.abs(c.vx) > 1) c.face = Math.sign(c.vx);
      const px = Math.round(ox + c.x), py = Math.round(oy + c.y), f = c.face;
      const moving = Math.abs(c.vx) + Math.abs(c.vy) > 1;
      const leg = moving && Math.floor(this.time * 20) % 2;
      if (c.kind === 'roach') {
        g.fillStyle = '#1a0e08';
        g.fillRect(px - 2, py + (leg ? 0 : 1), 1, 1); g.fillRect(px + 1, py + (leg ? 1 : 0), 1, 1);
        g.fillStyle = '#4a2a14'; g.fillRect(px - 1, py - 1, 3, 2);
        g.fillStyle = '#6a3e1c'; g.fillRect(px - 1, py - 1, 2, 1);
        g.fillStyle = '#1a0e08'; g.fillRect(px + (f > 0 ? 2 : -2), py - 1, 1, 1);
      } else {
        // tail, body, head, ear and a red eye
        g.fillStyle = '#9a7060';
        const wag = Math.round(Math.sin(this.time * 12) * 1);
        g.fillRect(px - f * 4, py + wag, 1, 1); g.fillRect(px - f * 5, py + wag, 1, 1); g.fillRect(px - f * 6, py + wag * 2, 1, 1);
        g.fillStyle = '#3a3230'; g.fillRect(px - 3, py - 1, 6, 3);
        g.fillStyle = '#5e5450'; g.fillRect(px - 2, py - 2, 4, 1);
        g.fillStyle = '#4a4240'; g.fillRect(px + f * 3 - (f < 0 ? 1 : 0), py - 1, 2, 2);
        g.fillStyle = '#8a7a74'; g.fillRect(px + f * 2, py - 2, 1, 1);
        g.fillStyle = '#e03030'; g.fillRect(px + f * 4 - (f < 0 ? 1 : 0), py - 1, 1, 1);
        g.fillStyle = '#1a0e08';
        if (leg) { g.fillRect(px - 2, py + 2, 1, 1); g.fillRect(px + 2, py + 2, 1, 1); } else { g.fillRect(px - 1, py + 2, 1, 1); g.fillRect(px + 1, py + 2, 1, 1); }
      }
    }
  }

  /** Water dripping from the ceiling along the north wall. */
  drawDrips(w, dt, ox, oy) {
    const g = this.g, room = w.room;
    if (this.dripKey !== room.key) {
      this.dripKey = room.key;
      this.drips = [];
      const n = 1 + Math.floor(Math.random() * 2);
      for (let k = 0; k < n; k++) {
        this.drips.push({ x: WALL_SIDE + 8 + Math.random() * (W * PX - 16), land: WALL_TOP + 6 + Math.random() * 30, t: Math.random() * 3, y: 0, v: 0, state: 'wait' });
      }
    }
    for (const d of this.drips) {
      d.t -= dt;
      const px = Math.round(ox + d.x);
      if (d.state === 'wait') {
        if (d.t <= 0) { d.state = 'grow'; d.t = 0.6; }
      } else if (d.state === 'grow') {
        g.fillStyle = '#8ab0c8';
        g.fillRect(px, Math.round(oy + WALL_TOP - 3), 1, d.t < 0.3 ? 2 : 1);
        if (d.t <= 0) { d.state = 'fall'; d.y = WALL_TOP - 2; d.v = 0; }
      } else if (d.state === 'fall') {
        d.v += 400 * dt; d.y += d.v * dt;
        g.fillStyle = '#a8cce0';
        g.fillRect(px, Math.round(oy + d.y) - 1, 1, 2);
        if (d.y >= d.land) {
          this.fx.splash(px, oy + d.land, '#8ab0c8');
          d.state = 'wait'; d.t = 2 + Math.random() * 4;
        }
      }
    }
  }

  /** Dash afterimages, fading out. */
  drawTrail(dt) {
    const g = this.g;
    this.trail = this.trail.filter((a) => {
      a.t += dt;
      if (a.t > 0.22) return false;
      g.globalAlpha = 0.45 * (1 - a.t / 0.22);
      this.blit(a.spr, a.x, a.y);
      g.globalAlpha = 1;
      return true;
    });
  }

  /** The item you just picked up, held over your head in a beam of light. */
  drawHeldItem(w, P, dt) {
    const h = this.holdItem;
    if (!h) return;
    h.t += dt;
    if (h.t > 1.5) { this.holdItem = null; return; }
    const g = this.g;
    const [x, y] = P(w.player.x, w.player.z);
    const k = Math.min(1, h.t / 0.2) * (h.t > 1.2 ? 1 - (h.t - 1.2) / 0.3 : 1);
    const iy = y - 44 - Math.round(Math.sin(h.t * 4) * 1);
    // rays turning slowly
    g.fillStyle = '#fff0c0';
    for (let r = 0; r < 8; r++) {
      const a = h.t * 0.8 + (r / 8) * TAU;
      for (let d = 9; d < 18; d += 2) {
        g.globalAlpha = k * 0.5 * (1 - (d - 9) / 9);
        g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(iy + Math.sin(a) * d), 1, 1);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = k;
    g.drawImage(this.lanternGlow, Math.round(x - 24), Math.round(iy - 20), 48, 40);
    g.globalCompositeOperation = 'source-over';
    this.blit(this.icon(ITEMS[h.id].icon, 13), x, iy);
    g.globalAlpha = 1;
    if (Math.random() < 0.3) this.fx.add(x + (Math.random() - 0.5) * 16, iy + 4, 0, 0, '#fff0b0', { z: 0, vz: 12, life: 0.5, fade: true });
  }

  blitScaled(spr, x, y, sx, sy) {
    if (sx === 1 && sy === 1) { this.blit(spr, x, y); return; }
    const c = spr.canvas;
    const w = Math.max(1, Math.round(c.width * sx)), h = Math.max(1, Math.round(c.height * sy));
    this.g.drawImage(c, Math.round(x - spr.ax * sx), Math.round(y - spr.ay * sy), w, h);
  }

  /** Eye colour and costume pieces from the items you carry. */
  heroLook(w) {
    const n = w.items.length;
    if (this.look && this.look.n === n) return this.look;
    const s = w.stats;
    const costume = [...new Set(w.items.map((id) => COSTUME[id]).filter(Boolean))].sort();
    const eyes = s.fire ? '#ff8a3a' : s.ice ? '#8af0ff' : s.poison ? '#9ad050' : s.spectral || s.orbitals ? '#c080ff' : '#ffd27a';
    this.look = { n, eyes, costume, key: `${eyes}:${costume.join(',')}` };
    return this.look;
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
    const look = this.heroLook(w);
    const blink = !moving && k === 7;
    const key = `hero:${facing}:${moving ? 'w' : 'i'}${k}:${look.key}`;
    const spr = this.sprite(key, (cc, px, py, ss) => S.hero(cc, px, py, ss, ft, { facing, moving, eyes: look.eyes, costume: look.costume, blink }), PX * 1.45, 1.9, 2.2);
    const dashing = p.dashT > 0;
    if (dashing) {
      this.trail.push({ spr: this.tinted(key, spr, '#7ab8ff', 0.6), x, y, t: 0 });
    } else if (moving) {
      // little puffs of dust from the feet
      this.dustT -= this.dt;
      if (this.dustT <= 0) { this.dustT = 0.18; this.fx.smoke(x, y - 1, '#7a6a58', 1, 6, 0.4, 5); }
    }
    // squash and stretch: bob while walking, stretch while dashing, kick back when shooting
    let sx = 1, sy = 1;
    if (dashing) { if (Math.abs(p.dashX) > Math.abs(p.dashZ)) { sx = 1.12; sy = 0.92; } else { sx = 0.9; sy = 1.1; } }
    else if (moving) sy = 1 + Math.sin(t * 24) * 0.03;
    else sy = 1 + Math.sin(t * 2.2) * 0.015;
    let rx = 0, ry = 0;
    if (this.recoil > 0) { this.recoil -= this.dt; rx = -Math.round(p.aimX); ry = Math.round(p.aimZ); }
    this.blitScaled(spr, x + rx, y + ry, sx, sy);
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

  /** Picks the sprite for an enemy's current look. */
  enemySprite(w, e, t) {
    const tt = t + e.phase;
    let spr, key, lift = 0, shadowR = 0;
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
      if (e.hop > 0) lift = Math.round(Math.sin((e.hop / 0.45) * Math.PI) * 6);
    } else if (e.type === 'bloat') {
      const [k, ft] = frame('bloat', tt);
      const swell = e.swell ? 1.12 : 1;
      key = `bloat${k}:${swell}`;
      spr = this.sprite(key, (cc, px, py, ss) => S.bloat(cc, px, py, ss, ft), PX * 0.85 * swell, 3.4, 3.2);
      if (e.lift) { lift = Math.round(e.lift * PX * 0.6); shadowR = 1.0; }
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
      if (e.lift) { lift = Math.round(e.lift * PX * 0.6); shadowR = 0.35; }
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
      if (e.lift) { lift = Math.round(e.lift * PX * 0.6); shadowR = 1.0; }
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
    return spr ? { spr, key, lift, shadowR } : null;
  }

  drawEnemy(w, e, x, y, t) {
    const r = this.enemySprite(w, e, t);
    if (!r) return;
    let { spr } = r;
    const key = r.key, g = this.g;
    if (r.shadowR) S.shadow(g, x, y, PX, r.shadowR, 0.4);
    y -= r.lift;
    if (e.flash > 0.3) spr = this.tinted(key, spr, '#ffffff', 0.75);
    else if (e.stun > 0) spr = this.tinted(key, spr, '#ffe060', 0.35);
    else if (e.frozen > 0) spr = this.tinted(key, spr, '#8adcff', 0.5);
    else if (e.burn > 0) spr = this.tinted(key, spr, Math.floor(t * 8) % 2 ? '#ff7a2a' : '#ffb040', 0.35);
    else if (e.poison > 0) spr = this.tinted(key, spr, '#7ad040', 0.3);
    let sx = 1, sy = 1, alpha = e.alpha !== undefined ? e.alpha : 1;
    if (e.spawnT > 0) {
      // rises out of a puff of dark smoke
      const k = 1 - Math.min(1, e.spawnT / 0.45);
      if (Math.random() < 0.5) this.fx.smoke(x, y, '#1e120c', 1, e.boss ? 30 : 12, 0.6, 12);
      if (k <= 0) return;
      sx = 0.5 + 0.5 * k; sy = k; alpha *= k;
    } else if (e.flash > 0) {
      // squash when hit
      sx = 1 + 0.14 * e.flash; sy = 1 - 0.12 * e.flash;
    }
    if (alpha < 0.05) return;
    g.globalAlpha = alpha;
    this.blitScaled(spr, x, y, sx, sy);
    g.globalAlpha = 1;
    if (e.burn > 0 && Math.random() < 0.3) this.fx.add(x + (Math.random() - 0.5) * 10, y - 14, 0, 0, '#ff9a2a', { z: 0, vz: 30, life: 0.4, fade: true });
    if (e.poison > 0 && Math.random() < 0.15) this.fx.add(x + (Math.random() - 0.5) * 10, y - 10, 0, 0, '#9ad050', { z: 0, vz: 12, life: 0.5, fade: true, size: 2 });
    if (e.stun > 0 && Math.random() < 0.3) this.fx.add(x + (Math.random() - 0.5) * 10, y - 22, 0, 0, '#ffe060', { life: 0.2 });
  }

  drawPickup(it, x, y, t) {
    if (it.kind === 'coin') {
      const [k, ft] = frame('coin', t + it.x);
      this.blit(this.sprite(`coin${k}`, (cc, px, py, ss) => S.coin(cc, px, py, ss, ft), PX, 0.8, 0.9), x, y);
      // an occasional glint
      const gl = (t * 0.7 + it.x * 0.37 + it.z * 0.11) % 2;
      if (gl < 0.12) {
        const g = this.g;
        g.fillStyle = '#fffbe0';
        g.fillRect(Math.round(x + 1), Math.round(y - 9), 1, 1);
        if (gl > 0.03 && gl < 0.09) { g.fillRect(Math.round(x), Math.round(y - 9), 3, 1); g.fillRect(Math.round(x + 1), Math.round(y - 10), 1, 3); }
      }
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
      if (Math.random() < 0.06) this.fx.add(x + (Math.random() - 0.5) * 16, gy + 6, 0, 0, '#fff0b0', { z: 0, vz: 10, life: 0.7, fade: true });
    } else if (it.kind === 'trapdoor') {
      this.blit(this.sprite('trapdoor', (cc, px, py, ss) => S.trapdoor(cc, px, py, ss), PX, 1.8, 1.6), x, y);
      if (Math.random() < 0.15) this.fx.add(x + (Math.random() - 0.5) * 18, y - 4, 0, 0, '#0a0604', { z: 0, vz: 10, life: 0.8, fade: true, size: 2, grow: 1 });
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
    const fx = this.fx;
    const seen = new Set();
    for (const e of w.events) {
      if (e.type === 'kill') {
        const [x, y] = P(e.x, e.z);
        const c = BLOOD[e.enemy] || [150, 16, 20];
        const hex = `rgb(${c[0]},${c[1]},${c[2]})`;
        const dark = `rgb(${c[0] >> 1},${c[1] >> 1},${c[2] >> 1})`;
        const bony = ['ram', 'host', 'bonelord'].includes(e.enemy);
        fx.burst(x, y - 8, hex, e.boss ? 50 : 10, e.boss ? 2.5 : 1.2, 6);
        fx.gibs(x, y - 6, bony ? ['#ece0c4', '#a89878', hex] : [hex, dark, '#e0b0a0'], e.boss ? 24 : e.small ? 3 : 6, e.boss ? 1.6 : 1);
        fx.ring(x, y - 8, e.boss ? 30 : 9, '#fff4e0', 0.15);
        this.stampSplat(w, w.roomKey, x - this.ox, y - this.oy, c, e.boss ? 2.4 : e.small ? 0.6 : 1);
        if (e.boss) {
          // a chain of bursts across the body
          for (let k = 0; k < 6; k++) {
            setTimeout(() => {
              const bx = x + (Math.random() - 0.5) * 40, by = y - 10 - Math.random() * 30;
              fx.fireball(bx, by, 10 + Math.random() * 6, '#b01818');
              fx.gibs(bx, by, [hex, dark], 5);
              this.lights.push({ x: bx, y: by, r: 40, t: 0, life: 0.3 });
            }, k * 140);
          }
          this.whiteFlash = 0.35;
        }
      } else if (e.type === 'hit') {
        const [x, y] = P(e.x, e.z);
        fx.splash(x, y - 10, shotColor(e.fx));
        fx.burst(x, y - 10, shotColor(e.fx), 3, 0.7, 3);
      } else if (e.type === 'splat') {
        const [x, y] = P(e.x, e.z);
        fx.splash(x, y - 10, shotColor(e.fx));
      } else if (e.type === 'esplat') {
        const [x, y] = P(e.x, e.z);
        fx.splash(x, y - 10, '#b01818');
      } else if (e.type === 'explode') {
        const [x, y] = P(e.x, e.z);
        const col = shotColor(e.fx);
        const tint = col === '#9ad0ff' ? null : col;
        fx.fireball(x, y, e.r * PX * 0.85, tint);
        this.lights.push({ x, y: y - 6, r: e.r * PX * 2.2, t: 0, life: 0.3 });
      } else if (e.type === 'slam') {
        const [x, y] = P(e.x, e.z);
        fx.ring(x, y, e.r * PX, '#8a6a4a', 0.45);
        fx.smoke(x, y, '#5a4a3a', Math.round(6 + e.r * 4), e.r * PX * 1.2, 0.8, 10);
        fx.burst(x, y, '#4a3a2a', Math.round(10 + e.r * 8), 1.6, 2);
      } else if (e.type === 'zap') {
        fx.zap(e.pts.map(([x, z]) => P(x, z)));
      } else if (e.type === 'eshoot') {
        // a spit of blood where an enemy fires; once per spot per frame
        const key = `${Math.round(e.x * 4)}:${Math.round(e.z * 4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const [x, y] = P(e.x, e.z);
        fx.burst(x, y - 12, '#c01818', 3, 0.6, 3);
        fx.ring(x, y - 12, 6, '#ff5040', 0.12);
      } else if (e.type === 'clink') {
        const [x, y] = P(e.x, e.z);
        fx.burst(x, y - 10, '#fff8e0', 4, 0.7, 3);
      } else if (e.type === 'block') {
        const [x, y] = P(w.player.x, w.player.z);
        fx.ring(x, y - 10, 16, '#ece0c4', 0.3);
        fx.gibs(x, y - 10, ['#ece0c4', '#a89878'], 6);
        fx.text(textSprite('BLOKK', '#ece0c4'), x, y - 30);
      } else if (e.type === 'hurt') {
        const [x, y] = P(w.player.x, w.player.z);
        fx.burst(x, y - 12, '#b01818', 14, 1.3, 4);
        this.hudShake = 0.4;
      } else if (e.type === 'shoot') {
        const p = w.player;
        const [x, y] = P(p.x + p.aimX * 0.35, p.z + p.aimZ * 0.35);
        this.recoil = 0.06;
        fx.add(x, y - 12, p.aimX * 20, -p.aimZ * 20, '#e8f4ff', { life: 0.07, size: 2 });
      } else if (e.type === 'dash') {
        const [x, y] = P(w.player.x, w.player.z);
        fx.smoke(x, y, '#8a7a68', 5, 8, 0.45, 6);
      } else if (e.type === 'coin') {
        const [x, y] = e.x !== undefined ? P(e.x, e.z) : P(w.player.x, w.player.z);
        fx.burst(x, y - 6, '#f6c84a', 5, 0.7, 4);
        fx.text(textSprite(`+${e.value || 1}¢`, '#f6c84a'), x, y - 18);
      } else if (e.type === 'heal') {
        const [x, y] = e.x !== undefined ? P(e.x, e.z) : P(w.player.x, w.player.z);
        fx.burst(x, y - 8, '#ff6a6a', 6, 0.7, 4);
        fx.text(textSprite('+♥', '#ff7a7a'), x, y - 22);
      } else if (e.type === 'item') {
        this.holdItem = { id: e.id, t: 0 };
        const [x, y] = P(w.player.x, w.player.z);
        fx.ring(x, y - 30, 22, '#fff0c0', 0.4);
      } else if (e.type === 'clear') {
        this.doorOpen = { key: w.roomKey, t: 0 };
        for (const d of ['n', 's', 'e', 'w']) {
          if (!w.room.doors[d]) continue;
          const [dx, dy] = d === 'n' ? P(0, D / 2) : d === 's' ? P(0, -D / 2) : d === 'e' ? P(W / 2, 0) : P(-W / 2, 0);
          fx.smoke(dx, dy + (d === 'n' ? -4 : 6), '#6a5a48', 6, 16, 0.7, 10);
        }
      } else if (e.type === 'boss') {
        this.bossIntro = { type: w.bossType, t: 0 };
      } else if (e.type === 'descend') {
        this.whiteFlash = 0.2;
      }
    }
  }

  /** Screen-wide overlays: low health pulse, white flashes, the fade on death. */
  drawOverlays(w, dt) {
    const g = this.g, p = w.player;
    if (p.hp <= 2 && p.hp > 0 && w.state !== 'dead') {
      const beat = Math.pow(Math.max(0, Math.sin(this.time * 5)), 6);
      g.globalAlpha = 0.25 + beat * 0.45;
      g.drawImage(this.redEdge, 0, 0);
      g.globalAlpha = 1;
    }
    if (this.whiteFlash > 0) {
      g.globalAlpha = Math.min(1, this.whiteFlash * 2.5);
      g.fillStyle = '#fff6e8';
      g.fillRect(0, 0, this.VW, this.VH);
      g.globalAlpha = 1;
      this.whiteFlash -= dt;
    }
    if (w.state === 'dead') {
      this.deathT += dt;
      g.globalAlpha = Math.min(0.7, this.deathT * 0.6);
      g.fillStyle = '#1a0204';
      g.fillRect(0, 0, this.VW, this.VH);
      g.globalAlpha = 1;
    }
  }

  /** Boss introduction, Isaac style: the hero and the boss slide in on a band. */
  drawBossIntro(w, dt) {
    const bi = this.bossIntro;
    bi.t += dt;
    const T = 2.3;
    if (bi.t > T) { this.bossIntro = null; return; }
    const g = this.g, VW = this.VW;
    const k = Math.min(1, bi.t / 0.2, (T - bi.t) / 0.25);
    g.globalAlpha = 0.6 * k;
    g.fillStyle = '#000';
    g.fillRect(0, 0, VW, this.VH);
    g.globalAlpha = 1;
    const cy = this.by + Math.round(ROOM_PH * 0.42), bandH = Math.round(104 * k);
    g.fillStyle = '#160806';
    g.fillRect(0, cy - bandH / 2, VW, bandH);
    // rough torn edges
    g.fillStyle = '#5a1414';
    for (let x = 0; x < VW; x += 3) {
      const j = (x * 7) % 5 === 0 ? 1 : 0;
      g.fillRect(x, Math.round(cy - bandH / 2) - j, 3, 1 + j);
      g.fillRect(x, Math.round(cy + bandH / 2) - 1, 3, 1 + ((x * 11) % 7 === 0 ? 1 : 0));
    }
    if (k < 0.95) return;
    const u = Math.min(1, (bi.t - 0.2) / 0.35);
    const slide = 1 - Math.pow(1 - u, 3);
    const floor = cy + 40;
    // hero from the left
    const look = this.heroLook(w);
    const hero = this.sprite(`intro:hero:${look.key}`, (cc, px, py, ss) => S.hero(cc, px, py, ss, 0, { facing: 'right', eyes: look.eyes, costume: look.costume }), PX * 2.2, 1.9, 2.2);
    this.blit(hero, Math.round(-30 + slide * (VW * 0.22 + 30)), floor);
    // boss from the right, scaled down if it would not fit the band
    const r = this.enemySprite(w, { type: bi.type, phase: 0, x: 0, z: 0 }, this.time);
    if (r) {
      const sc = Math.min(1.5, 100 / r.spr.canvas.height);
      const bx = Math.round(VW + 60 - slide * (VW * 0.3 + 60));
      this.blitScaled(r.spr, bx, floor, sc, sc);
    }
    // name, scaled 2x, with a jolt when it lands
    if (bi.t > 0.5) {
      const name = textSprite(ENEMIES[bi.type].name, '#e8c0a8');
      const vs = textSprite('MOT', '#8a6a5a');
      const jolt = bi.t < 0.6 ? Math.round((Math.random() - 0.5) * 4) : 0;
      g.drawImage(name, Math.round(VW / 2 - name.width) + jolt, cy - bandH / 2 + 8, name.width * 2, name.height * 2);
      g.drawImage(vs, Math.round(VW / 2 - vs.width / 2), cy - 4);
    }
  }

  // ======================================================================
  // HUD
  // ======================================================================
  drawHud(w, dt) {
    const g = this.g;
    const p = w.player, s = w.stats;
    // hearts: shake when hurt, the last one beats when you are low
    const hearts = s.maxHp / 2;
    this.hudShake = Math.max(0, this.hudShake - dt);
    const last = Math.ceil(p.hp / 2) - 1;
    const beat = p.hp <= 2 ? Math.pow(Math.max(0, Math.sin(this.time * 5)), 6) : 0;
    for (let i = 0; i < hearts; i++) {
      const v = p.hp - i * 2;
      const kind = v >= 2 ? 'full' : v === 1 ? 'half' : 'empty';
      const spr = this.sprite(`hud:heart:${kind}`, (cc, px, py, ss) => S.heart(cc, px, py, ss, { half: kind === 'half', empty: kind === 'empty' }), 13, 1, 1);
      const jx = this.hudShake > 0 ? Math.round((Math.random() - 0.5) * 3) : 0;
      const jy = this.hudShake > 0 ? Math.round((Math.random() - 0.5) * 2) : 0;
      const sc = i === last ? 1 + beat * 0.3 : 1;
      this.blitScaled(spr, 9 + (i % 6) * 11 + jx, 15 + Math.floor(i / 6) * 10 + jy, sc, sc);
    }
    // coins (bump when they change) and floor name
    if (p.coins !== this.lastCoins) { this.coinBump = 0.25; this.lastCoins = p.coins; }
    this.coinBump = Math.max(0, this.coinBump - dt);
    const row = hearts > 6 ? 32 : 24;
    const bump = this.coinBump > 0 ? 1 : 0;
    this.blit(this.sprite('hud:coin', (cc, px, py, ss) => S.coin(cc, px, py, ss, 0), 13, 1, 1), 8, row + 7 - bump);
    g.drawImage(textSprite(String(p.coins).padStart(2, '0'), bump ? '#fff4b0' : '#f6c84a'), 15, row - bump);
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
      // the bar drains in two steps: a pale chunk lingers, then catches up
      const f = Math.max(0, boss.hp / boss.maxHp);
      if (this.bossShown === undefined || this.bossShown < f || this.bossId !== boss.id) { this.bossShown = f; this.bossId = boss.id; }
      this.bossShown += (f - this.bossShown) * Math.min(1, dt * 3);
      g.fillStyle = '#e8c0a0'; g.fillRect(bx, y + 9, Math.round(bw2 * this.bossShown), 4);
      g.fillStyle = '#b02a2a'; g.fillRect(bx, y + 9, Math.round(bw2 * f), 4);
      g.fillStyle = '#d24a40'; g.fillRect(bx, y + 9, Math.round(bw2 * f), 1);
      if (boss.hp < boss.maxHp * 0.5) {
        // enraged: the frame pulses
        g.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 8);
        g.fillStyle = '#ff4030'; g.fillRect(bx - 1, y + 8, bw2 + 2, 1); g.fillRect(bx - 1, y + 13, bw2 + 2, 1);
        g.globalAlpha = 1;
      }
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
