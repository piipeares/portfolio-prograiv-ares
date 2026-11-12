/**
 * Motor de audio ambiental generativo.
 * Sin archivos externos: osciladores filtrados, delay y reverb corta.
 * El canal activo define acorde, filtro y textura; los cambios se interpolan
 * con rampas largas para que nunca haya cortes ni saltos audibles.
 */
import type { ChannelId } from '../data/profile';
import { $audio, $channel } from '../stores/signal';

interface Preset {
  root: number;
  ratios: number[];
  cutoff: number;
  delay: number;
}

const PRESETS: Record<ChannelId, Preset> = {
  0: { root: 110.0, ratios: [1, 1.5, 2, 2.9966], cutoff: 780, delay: 0.46 },
  1: { root: 130.81, ratios: [1, 1.2599, 1.4983, 1.8877], cutoff: 1180, delay: 0.38 },
  2: { root: 98.0, ratios: [1, 1.1892, 1.4983, 1.7818], cutoff: 880, delay: 0.5 },
  3: { root: 87.31, ratios: [1, 1.3348, 1.4983, 2], cutoff: 660, delay: 0.58 },
};

interface Voice {
  a: OscillatorNode;
  b: OscillatorNode;
}

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  filter: BiquadFilterNode;
  delay: DelayNode;
  voices: Voice[];
  everStarted: boolean;
}

const FADE_IN = 2;
const GLIDE = 1.8;

const scope = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
const getEngine = (): Engine | null => (scope?.__faEngine as Engine | null) ?? null;
const setEngine = (engine: Engine): void => {
  if (scope) scope.__faEngine = engine;
};

let suspendTimer: ReturnType<typeof setTimeout> | null = null;

function build(): Engine | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.8;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 26;
  comp.ratio.value = 3;
  comp.attack.value = 0.02;
  comp.release.value = 0.3;

  const delay = ctx.createDelay(1);
  const feedback = ctx.createGain();
  feedback.gain.value = 0.29;
  const wet = ctx.createGain();
  wet.gain.value = 0.16;

  filter.connect(master);
  filter.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(master);
  master.connect(comp);
  comp.connect(ctx.destination);

  // Movimiento lento del filtro: respiración, no efecto.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 70;
  lfo.connect(lfoDepth);
  lfoDepth.connect(filter.detune);
  lfo.start();

  const channel = $channel.get();
  const preset = PRESETS[channel];
  const voices: Voice[] = [];

  preset.ratios.forEach((ratio) => {
    const a = ctx.createOscillator();
    a.type = 'triangle';
    a.frequency.value = preset.root * ratio;
    const b = ctx.createOscillator();
    b.type = 'sine';
    b.frequency.value = preset.root * ratio * 1.004;
    b.detune.value = 4;
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0.055;
    a.connect(voiceGain);
    b.connect(voiceGain);
    voiceGain.connect(filter);
    a.start();
    b.start();
    voices.push({ a, b });
  });

  const engine: Engine = { ctx, master, filter, delay, voices, everStarted: true };
  setEngine(engine);
  applyChannel(engine, channel, 0);
  return engine;
}

function glide(param: AudioParam, value: number, seconds: number, now: number): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  if (seconds <= 0) param.setValueAtTime(value, now);
  else param.linearRampToValueAtTime(value, now + seconds);
}

function rampFrequency(osc: OscillatorNode, value: number, seconds: number, now: number): void {
  const param = osc.frequency;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  if (seconds <= 0) param.setValueAtTime(value, now);
  else param.exponentialRampToValueAtTime(value, now + seconds);
}

function applyChannel(engine: Engine, channel: ChannelId, seconds = GLIDE): void {
  const preset = PRESETS[channel];
  const now = engine.ctx.currentTime;
  glide(engine.filter.frequency, preset.cutoff, seconds, now);
  glide(engine.delay.delayTime, preset.delay, seconds, now);

  engine.voices.forEach((voice, index) => {
    const base = preset.root * preset.ratios[index];
    rampFrequency(voice.a, base, seconds, now);
    rampFrequency(voice.b, base * 1.004, seconds, now);
  });
}

export async function startAmbient(fade = FADE_IN): Promise<void> {
  if (typeof window === 'undefined') return;

  let engine = getEngine();
  if (!engine) {
    engine = build();
    if (!engine) {
      $audio.set('unsupported');
      return;
    }
  }

  if (suspendTimer) {
    clearTimeout(suspendTimer);
    suspendTimer = null;
  }

  if (engine.ctx.state === 'suspended') {
    try {
      await engine.ctx.resume();
    } catch {
      return;
    }
  }

  const now = engine.ctx.currentTime;
  const gain = engine.master.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
  gain.linearRampToValueAtTime(0.5, now + fade);
  $audio.set('on');
}

export function stopAmbient(): void {
  const engine = getEngine();
  $audio.set('off');
  if (!engine) return;

  const now = engine.ctx.currentTime;
  const gain = engine.master.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
  gain.linearRampToValueAtTime(0.0001, now + 0.4);

  suspendTimer = setTimeout(() => {
    void engine.ctx.suspend().catch(() => undefined);
    suspendTimer = null;
  }, 700);
}

export function toggleAmbient(): void {
  if ($audio.get() === 'on') stopAmbient();
  else void startAmbient();
}

/** Solo arranca en la primera interacción; si el usuario ya silenció, lo respeta. */
export function resumeOnInteraction(): void {
  if (typeof window === 'undefined') return;
  if ($audio.get() !== 'off') return;
  if (getEngine()?.everStarted) return;
  void startAmbient();
}

if (typeof window !== 'undefined' && !scope?.__faAmbientHook) {
  if (scope) scope.__faAmbientHook = true;
  $channel.subscribe((channel) => {
    const engine = getEngine();
    if (engine?.everStarted) applyChannel(engine, channel as ChannelId, GLIDE);
  });
}
