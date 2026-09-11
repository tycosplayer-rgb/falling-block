/** Procedural SFX via Web Audio — no asset files required. */
import type { Orientation } from './types';

type RollKind = 'standUp' | 'layDown' | 'flatRoll';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  return ctx;
}

function out(): GainNode {
  ac();
  return master!;
}

/** Call from first user gesture so mobile browsers allow audio. */
export function unlockAudio(): void {
  const c = ac();
  if (c.state === 'suspended') void c.resume();
  if (!unlocked) {
    // Tiny silent blip to fully unlock on some WebKit builds.
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.value = 0.0001;
    g.connect(out());
    const o = c.createOscillator();
    o.frequency.value = 40;
    o.connect(g);
    o.start(t);
    o.stop(t + 0.01);
    unlocked = true;
  }
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  opts: { gain?: number; attack?: number; detune?: number; slideTo?: number } = {},
) {
  const c = ac();
  const t0 = c.currentTime;
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

function noiseBurst(duration: number, peak = 0.18) {
  const c = ac();
  const t0 = c.currentTime;
  const n = Math.floor(c.sampleRate * duration);
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

/** 躺着滚：短促木块滑动 */
export function playFlatRoll() {
  unlockAudio();
  tone(180, 0.09, 'triangle', { gain: 0.16, slideTo: 140 });
  noiseBurst(0.07, 0.1);
}

/** 放倒：立→躺，低频落下 */
export function playLayDown() {
  unlockAudio();
  tone(220, 0.14, 'sine', { gain: 0.2, slideTo: 90 });
  tone(110, 0.16, 'triangle', { gain: 0.12, slideTo: 70 });
  noiseBurst(0.1, 0.14);
}

/** 立起来：躺→立，上扬顿挫 */
export function playStandUp() {
  unlockAudio();
  tone(140, 0.08, 'triangle', { gain: 0.14, slideTo: 200 });
  tone(260, 0.12, 'sine', { gain: 0.18, slideTo: 320, attack: 0.02 });
  noiseBurst(0.06, 0.08);
}

export function playRoll(from: Orientation, to: Orientation) {
  const kind = rollKind(from, to);
  if (kind === 'standUp') playStandUp();
  else if (kind === 'layDown') playLayDown();
  else playFlatRoll();
}

/** 跌落虚空 */
export function playFall() {
  unlockAudio();
  tone(320, 0.45, 'sawtooth', { gain: 0.12, slideTo: 40 });
  tone(180, 0.5, 'triangle', { gain: 0.1, slideTo: 30 });
  noiseBurst(0.4, 0.16);
}

/** 过关 */
export function playWin() {
  unlockAudio();
  const c = ac();
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => {
    const t0 = c.currentTime + i * 0.09;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    g.connect(out());
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(g);
    o.start(t0);
    o.stop(t0 + 0.3);
  });
}

/** 全部通关 */
export function playVictory() {
  unlockAudio();
  playWin();
  const c = ac();
  const t0 = c.currentTime + 0.4;
  [392, 523.25, 659.25, 784].forEach((f, i) => {
    const g = c.createGain();
    const start = t0 + i * 0.08;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    g.connect(out());
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    o.connect(g);
    o.start(start);
    o.stop(start + 0.4);
  });
}
