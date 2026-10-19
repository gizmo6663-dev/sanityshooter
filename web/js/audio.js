// Small synthesized sound effects, no audio files. Low and dull on purpose:
// thuds, squelches and drones rather than chimes. Throttled so a busy room
// does not turn into noise.

let ctx = null;
let master = null;
let noiseBuf = null;
const last = {};

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.4;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol, freq, q = 1) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.3), t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function throttle(name, ms) {
  const now = performance.now();
  if (last[name] && now - last[name] < ms) return false;
  last[name] = now;
  return true;
}

export const sfx = {
  shoot() { if (throttle('shoot', 90)) { tone(330 + Math.random() * 40, 0.09, 'sine', 0.07, 0.5); noise(0.06, 0.04, 2500); } },
  hit() { if (throttle('hit', 50)) noise(0.08, 0.12, 900); },
  kill() { if (throttle('kill', 60)) { noise(0.18, 0.22, 600, 3); tone(90, 0.15, 'triangle', 0.12, 0.6); } },
  hurt() { tone(160, 0.3, 'sawtooth', 0.2, 0.45); noise(0.25, 0.2, 400); },
  dash() { if (throttle('dash', 150)) noise(0.15, 0.12, 3000); },
  door() { tone(70, 0.5, 'sawtooth', 0.08, 0.8); noise(0.4, 0.08, 300); },
  clear() { tone(196, 0.6, 'sine', 0.12); tone(294, 0.7, 'sine', 0.08, 0, 0.12); },
  coin() { if (throttle('coin', 60)) { tone(988, 0.08, 'square', 0.05); tone(1318, 0.12, 'square', 0.04, 0, 0.05); } },
  xp() { if (throttle('xp', 40)) tone(700 + Math.random() * 300, 0.05, 'sine', 0.04); },
  heal() { tone(440, 0.25, 'sine', 0.12, 1.5); },
  item() { [262, 330, 392, 523].forEach((f, i) => tone(f, 1.2, 'sine', 0.08, 0, i * 0.08)); },
  levelup() { [392, 494, 587].forEach((f, i) => tone(f, 0.6, 'triangle', 0.1, 0, i * 0.1)); },
  explode() { if (throttle('boom', 80)) { noise(0.35, 0.3, 500, 2); tone(60, 0.3, 'sine', 0.2, 0.5); } },
  boss() { tone(55, 2.0, 'sawtooth', 0.12, 0.9); tone(58, 2.0, 'sawtooth', 0.1, 0.9); },
  slam() { noise(0.5, 0.4, 300, 2); tone(45, 0.5, 'sine', 0.3, 0.6); },
  dead() { tone(220, 1.6, 'sawtooth', 0.15, 0.25); },
  win() { [262, 330, 392, 523, 659].forEach((f, i) => tone(f, 1.6, 'sine', 0.08, 0, i * 0.15)); },
};
