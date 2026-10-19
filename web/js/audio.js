// Tiny synthesized sound effects, no audio files. Throttled so a crowd of
// pops does not turn into noise.

let ctx = null;
let master = null;
const last = {};

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
}

function tone(freq, dur, type = 'square', vol = 0.3, slide = 0) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function throttle(name, ms) {
  const now = performance.now();
  if (last[name] && now - last[name] < ms) return false;
  last[name] = now;
  return true;
}

export const sfx = {
  shoot() { if (throttle('shoot', 70)) tone(520 + Math.random() * 80, 0.06, 'triangle', 0.12, 0.6); },
  pop() { if (throttle('pop', 45)) tone(260 + Math.random() * 200, 0.07, 'square', 0.06, 0.4); },
  gate() { if (throttle('gate', 90)) tone(880, 0.12, 'sine', 0.15, 1.5); },
  hurt() { if (throttle('hurt', 120)) tone(140, 0.25, 'sawtooth', 0.25, 0.5); },
  giant() { tone(110, 0.5, 'sawtooth', 0.3, 2.2); },
  buy() { tone(660, 0.08, 'square', 0.15); setTimeout(() => tone(990, 0.12, 'square', 0.15), 70); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'square', 0.18), i * 120)); },
  lose() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.2), i * 180)); },
};
