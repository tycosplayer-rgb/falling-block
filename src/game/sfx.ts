/** Procedural SFX via Web Audio — no asset files required. */
import type { Orientation } from './types';

type RollKind = 'standUp' | 'layDown' | 'flatRoll';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext {
  if (!ctx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
  }
  return ctx;
}

function out(): GainNode {
  ac();
  return master!;
}

/**
 * Call from a user gesture. Starts resume() synchronously on the call stack
 * (required by Safari / Chrome autoplay rules).
 */
export function unlockAudio(): Promise<void> {
  const c = ac();
  // Kick resume NOW, while still inside the gesture handler.
  const p = c.state === 'suspended' ? c.resume() : Promise.resolve();
  return p.then(() => undefined).catch(() => undefined);
}

function whenReady(play: (c: AudioContext, t0: number) => void): void {
  const c = ac();
  const run = () => {
    if (c.state !== 'running') return;
    try {
      play(c, c.currentTime);
    } catch {
      // ignore decode / scheduling errors
    }
  };
  if (c.state === 'running') {
    run();
    return;
  }
  // Still suspended: resume (hopefully still in gesture) then play.
  void c
    .resume()
    .then(run)
    .catch(() => undefined);
}

function toneAt(
  c: AudioContext,
  t0: number,
  freq: number,
  duration: number,
  type: OscillatorType,
  opts: { gain?: number; attack?: number; detune?: number; slideTo?: number } = {},
) {
  const g = c.createGain();
  const peak = opts.gain ?? 0.22;
  const attack = opts.attack ?? 0.008;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  g.connect(out());

  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo != null) {
    o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t0 + duration);
  }
  if (opts.detune != null) o.detune.value = opts.detune;
  o.connect(g);
  o.start(t0);
  o.stop(t0 + duration + 0.02);
}

function noiseBurstAt(c: AudioContext, t0: number, duration: number, peak = 0.18) {
  const n = Math.max(1, Math.floor(c.sampleRate * duration));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  const g = c.createGain();
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter);
  filter.connect(g);
  g.connect(out());
  src.start(t0);
  src.stop(t0 + duration);
}

export function rollKind(from: Orientation, to: Orientation): RollKind {
  if (from === 'standing' && to !== 'standing') return 'layDown';
  if (from !== 'standing' && to === 'standing') return 'standUp';
  return 'flatRoll';
}

export function playFlatRoll() {
  whenReady((c, t0) => {
    toneAt(c, t0, 180, 0.09, 'triangle', { gain: 0.18, slideTo: 140 });
    noiseBurstAt(c, t0, 0.07, 0.12);
  });
}

export function playLayDown() {
  whenReady((c, t0) => {
    toneAt(c, t0, 220, 0.14, 'sine', { gain: 0.22, slideTo: 90 });
    toneAt(c, t0, 110, 0.16, 'triangle', { gain: 0.14, slideTo: 70 });
    noiseBurstAt(c, t0, 0.1, 0.16);
  });
}

export function playStandUp() {
  whenReady((c, t0) => {
    toneAt(c, t0, 140, 0.08, 'triangle', { gain: 0.16, slideTo: 200 });
    toneAt(c, t0, 260, 0.12, 'sine', { gain: 0.2, slideTo: 320, attack: 0.02 });
    noiseBurstAt(c, t0, 0.06, 0.1);
  });
}

export function playRoll(from: Orientation, to: Orientation) {
  const kind = rollKind(from, to);
  if (kind === 'standUp') playStandUp();
  else if (kind === 'layDown') playLayDown();
  else playFlatRoll();
}

export function playBounce() {
  whenReady((c, t0) => {
    toneAt(c, t0, 420, 0.08, 'square', { gain: 0.12, slideTo: 280 });
    toneAt(c, t0 + 0.05, 260, 0.12, 'triangle', { gain: 0.14, slideTo: 160 });
    noiseBurstAt(c, t0, 0.08, 0.1);
  });
}

export function playMorph() {
  whenReady((c, t0) => {
    toneAt(c, t0, 480, 0.1, 'sine', { gain: 0.16, slideTo: 720 });
    toneAt(c, t0 + 0.06, 360, 0.14, 'triangle', { gain: 0.14, slideTo: 240 });
    toneAt(c, t0 + 0.1, 600, 0.12, 'sine', { gain: 0.1, slideTo: 900 });
    noiseBurstAt(c, t0, 0.12, 0.08);
  });
}

export function playFall() {
  whenReady((c, t0) => {
    toneAt(c, t0, 320, 0.45, 'sawtooth', { gain: 0.14, slideTo: 40 });
    toneAt(c, t0, 180, 0.5, 'triangle', { gain: 0.12, slideTo: 30 });
    noiseBurstAt(c, t0, 0.4, 0.18);
  });
}

export function playWin() {
  whenReady((c, t0) => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const start = t0 + i * 0.09;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      g.connect(out());
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start(start);
      o.stop(start + 0.3);
    });
  });
}

export function playVictory() {
  whenReady((c, t0) => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const start = t0 + i * 0.09;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      g.connect(out());
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start(start);
      o.stop(start + 0.3);
    });
    [392, 523.25, 659.25, 784].forEach((f, i) => {
      const start = t0 + 0.4 + i * 0.08;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      g.connect(out());
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.connect(g);
      o.start(start);
      o.stop(start + 0.4);
    });
  });
}
