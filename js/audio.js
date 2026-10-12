/*
 * Tiny WebAudio blip synth. No audio files, everything is generated, so the
 * whole game stays a handful of kilobytes.
 */

let ctx = null;
let master = null;
let enabled = true;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  return ctx;
}

function tone({ freq = 440, to = null, dur = 0.12, type = 'triangle', gain = 1, delay = 0 }) {
  if (!enabled) return;
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.18, gain = 0.5, delay = 0, hp = 600 }) {
  if (!enabled) return;
  const ac = ensure();
  if (!ac) return;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = hp;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(master);
  src.start(ac.currentTime + delay);
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

export const sfx = {
  get enabled() { return enabled; },
  setEnabled(v) {
    enabled = !!v;
    if (enabled) this.unlock();
  },
  /** Browsers need a user gesture before audio can start. */
  unlock() {
    const ac = ensure();
    if (ac && ac.state === 'suspended') ac.resume();
  },
  tap() { tone({ freq: 520, dur: 0.05, type: 'sine', gain: 0.5 }); },
  swap() { tone({ freq: 380, to: 560, dur: 0.1, type: 'sine', gain: 0.6 }); },
  bad() { tone({ freq: 200, to: 140, dur: 0.14, type: 'sawtooth', gain: 0.35 }); },
  /** Cascades walk up a pentatonic scale, so chains sound like a melody. */
  pop(cascade = 1, count = 3) {
    const step = PENTA[Math.min(PENTA.length - 1, cascade - 1)];
    const base = 440 * Math.pow(2, step / 12);
    tone({ freq: base, to: base * 1.5, dur: 0.14, type: 'triangle', gain: 0.55 });
    if (count >= 5) tone({ freq: base * 1.5, dur: 0.1, type: 'sine', gain: 0.3, delay: 0.05 });
    noise({ dur: 0.1, gain: 0.12, hp: 1400 });
  },
  special(kind) {
    if (kind === 4) {
      for (let i = 0; i < 6; i++) {
        tone({ freq: 523 * Math.pow(2, PENTA[i] / 12), dur: 0.12, type: 'sine', gain: 0.4, delay: i * 0.045 });
      }
    } else if (kind === 3) {
      tone({ freq: 160, to: 60, dur: 0.3, type: 'sawtooth', gain: 0.5 });
      noise({ dur: 0.3, gain: 0.35, hp: 300 });
    } else {
      tone({ freq: 900, to: 300, dur: 0.22, type: 'square', gain: 0.3 });
      noise({ dur: 0.2, gain: 0.2, hp: 900 });
    }
  },
  ice() { noise({ dur: 0.22, gain: 0.4, hp: 2600 }); tone({ freq: 1500, to: 900, dur: 0.12, type: 'sine', gain: 0.25 }); },
  shuffle() {
    for (let i = 0; i < 5; i++) tone({ freq: 300 + i * 90, dur: 0.07, type: 'sine', gain: 0.3, delay: i * 0.06 });
  },
  win() {
    [0, 4, 7, 12, 16].forEach((s, i) => tone({ freq: 440 * Math.pow(2, s / 12), dur: 0.34, type: 'triangle', gain: 0.5, delay: i * 0.1 }));
  },
  lose() {
    [0, -2, -5].forEach((s, i) => tone({ freq: 392 * Math.pow(2, s / 12), dur: 0.3, type: 'sine', gain: 0.4, delay: i * 0.13 }));
  },
};
