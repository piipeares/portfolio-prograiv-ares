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
  leadFilter: BiquadFilterNode;
  voices: Voice[];
  melodyTimer: ReturnType<typeof setInterval> | null;
  step: number;
  everStarted: boolean;
}

const FADE_IN = 2;
const GLIDE = 1.8;

// Escala pentatónica por canal (semitonos desde la raíz, dos octavas arriba).
const SCALES: Record<ChannelId, number[]> = {
  0: [0, 3, 5, 7, 10, 12, 15],
  1: [0, 2, 4, 7, 9, 12, 14],
  2: [0, 3, 5, 7, 10, 12, 15],
  3: [0, 2, 4, 7, 9, 12, 14],
};

// Recorrido melódico: asciende y desciende sin saltos bruscos.
const PATTERN = [0, 2, 1, 3, 2, 4, 3, 5, 4, 2, 3, 1];

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

  const leadFilter = ctx.createBiquadFilter();
  leadFilter.type = 'lowpass';
  leadFilter.frequency.value = 2400;
  leadFilter.Q.value = 0.5;
  leadFilter.connect(master);
  const leadSend = ctx.createGain();
  leadSend.gain.value = 0.55;
  leadFilter.connect(leadSend);
  leadSend.connect(delay);

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

  const engine: Engine = {
    ctx,
    master,
    filter,
    delay,
    leadFilter,
    voices,
    melodyTimer: null,
    step: 0,
    everStarted: true,
  };
  setEngine(engine);
  applyChannel(engine, channel, 0);
  return engine;
}

function glide(param: AudioParam, value: number, seconds: number, now: number): void {  param.cancelScheduledValues(now);
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

function playNote(engine: Engine, semitones: number, when: number, velocity = 1): void {
  const ctx = engine.ctx;
  const channel = $channel.get();
  const frequency = PRESETS[channel].root * 4 * Math.pow(2, semitones / 12);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = frequency;

  const harmonic = ctx.createOscillator();
  harmonic.type = 'sine';
  harmonic.frequency.value = frequency * 2.002;
  const harmonicGain = ctx.createGain();
  harmonicGain.gain.value = 0.32;
  harmonic.connect(harmonicGain);

  const envelope = ctx.createGain();
  const peak = 0.05 * velocity;
  envelope.gain.setValueAtTime(0.0001, when);
  envelope.gain.exponentialRampToValueAtTime(peak, when + 0.06);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + 2.9);

  osc.connect(envelope);
  harmonicGain.connect(envelope);
  envelope.connect(engine.leadFilter);

  osc.start(when);
  harmonic.start(when);
  osc.stop(when + 3.1);
  harmonic.stop(when + 3.1);
}

function tickMelody(engine: Engine): void {
  if ($audio.get() !== 'on') return;
  const scale = SCALES[$channel.get()];
  const position = PATTERN[engine.step % PATTERN.length];
  engine.step += 1;

  const when = engine.ctx.currentTime + 0.08;
  playNote(engine, scale[position], when);
  // Cada cinco pasos agrega una quinta suave: acorde sin bloques fijos.
  if (engine.step % 5 === 0) {
    playNote(engine, scale[(position + 2) % scale.length], when + 0.22, 0.55);
  }
}

function startMelody(engine: Engine): void {
  if (engine.melodyTimer) return;
  engine.melodyTimer = setInterval(() => tickMelody(engine), 3400);
  setTimeout(() => tickMelody(engine), 1500);
}

function stopMelody(engine: Engine): void {
  if (!engine.melodyTimer) return;
  clearInterval(engine.melodyTimer);
  engine.melodyTimer = null;
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
  startMelody(engine);
}

export function stopAmbient(): void {
  const engine = getEngine();
  $audio.set('off');
  if (!engine) return;
  stopMelody(engine);

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
