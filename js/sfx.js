// Tiny synthesised sound effects. Off by default; the player turns them on.
let ctx = null;
let enabled = false;
try { enabled = localStorage.getItem('margin.sound') === 'on'; } catch { /* storage blocked */ }

export function soundOn() { return enabled; }
export function setSound(on) {
  enabled = on;
  try { localStorage.setItem('margin.sound', on ? 'on' : 'off'); } catch { /* ignore */ }
  if (on) audio();
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.12, type = 'sine', gain = 0.08, when = 0, slideTo = null) {
  if (!enabled) return;
  const a = audio(); if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur = 2, gain = 0.15, when = 0) {
  if (!enabled) return;
  const a = audio(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = a.createBufferSource(); src.buffer = buf;
  const g = a.createGain(); const t = a.currentTime + when;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(g).connect(a.destination); src.start(t);
}

export const sfx = {
  click: () => tone(660, 0.05, 'triangle', 0.04),
  good: () => { tone(523, 0.12, 'triangle', 0.06); tone(784, 0.18, 'triangle', 0.06, 0.08); },
  bad: () => tone(220, 0.35, 'sawtooth', 0.04, 0, 110),
  count: () => tone(880, 0.1, 'square', 0.035),
  liftoff: () => { tone(1320, 0.25, 'square', 0.04); noise(2.6, 0.22, 0.05); },
  alert: () => { tone(740, 0.12, 'square', 0.04); tone(740, 0.12, 'square', 0.04, 0.18); },
  success: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, 'triangle', 0.05, i * 0.12)),
  fail: () => [392, 330, 262].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.035, i * 0.18)),
  ping: () => tone(1200, 0.08, 'sine', 0.03),
};
