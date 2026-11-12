/**
 * Motor de audio ambiental generativo.
 * Sin archivos externos: piano de fieltro sintetizado, pads suaves, bajo y
 * reverb por convolución. Una frase melódica compuesta de 4 compases se repite
 * y varía por canal; los cambios de canal entran en el siguiente compás para
 * que la transición sea musical y nunca corte el sonido.
 */
import type { ChannelId } from '../data/profile';
import { $audio, $channel } from '../stores/signal';

const BPM = 76;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LOOKAHEAD = 0.9;
const FADE_IN = 2;

const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Acordes base en Do mayor; cada canal los transpone a su tonalidad. */
const CHORDS = [
  { notes: [55, 60, 64, 67], bass: 48 }, // C
  { notes: [57, 60, 64, 69], bass: 45 }, // Am
  { notes: [53, 57, 60, 65], bass: 41 }, // F
  { notes: [55, 59, 62, 67], bass: 43 }, // G
];

/** Frase principal, 4 compases en Do mayor (beats absolutos 0–16). */
const MELODY = [
  { beat: 0, note: 67, len: 1, vel: 0.8 },
  { beat: 1, note: 72, len: 1, vel: 0.85 },
  { beat: 2, note: 76, len: 1.5, vel: 0.9 },
  { beat: 3.5, note: 74, len: 0.5, vel: 0.65 },

  { beat: 4, note: 72, len: 1, vel: 0.78 },
  { beat: 5, note: 69, len: 1, vel: 0.72 },
  { beat: 6, note: 76, len: 1.5, vel: 0.85 },
  { beat: 7.5, note: 79, len: 0.5, vel: 0.7 },

  { beat: 8, note: 77, len: 1, vel: 0.82 },
  { beat: 9, note: 76, len: 1, vel: 0.75 },
  { beat: 10, note: 74, len: 1.5, vel: 0.8 },
  { beat: 11.5, note: 72, len: 0.5, vel: 0.62 },

  { beat: 12, note: 74, len: 1, vel: 0.78 },
  { beat: 13, note: 76, len: 0.5, vel: 0.62 },
  { beat: 13.5, note: 74, len: 0.5, vel: 0.58 },
  { beat: 14, note: 71, len: 2, vel: 0.72 },
];

interface ChannelTone {
  offset: number;
  padCutoff: number;
  leadCutoff: number;
  reverb: number;
}

const TONES: Record<ChannelId, ChannelTone> = {
  0: { offset: 0, padCutoff: 1500, leadCutoff: 3200, reverb: 0.32 },
  1: { offset: 2, padCutoff: 1800, leadCutoff: 3800, reverb: 0.28 },
  2: { offset: -7, padCutoff: 1350, leadCutoff: 3000, reverb: 0.36 },
  3: { offset: -5, padCutoff: 1200, leadCutoff: 2800, reverb: 0.34 },
};

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  leadBus: GainNode;
  padBus: GainNode;
  leadFilter: BiquadFilterNode;
  padFilter: BiquadFilterNode;
  wet: GainNode;
  timer: ReturnType<typeof setInterval> | null;
  nextBar: number;
  barNumber: number;
  channel: ChannelId;
  pending: ChannelId | null;
  everStarted: boolean;
}

const scope = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
const getEngine = (): Engine | null => (scope?.__faEngine as Engine | null) ?? null;
const setEngine = (engine: Engine): void => {
  if (scope) scope.__faEngine = engine;
};

let suspendTimer: ReturnType<typeof setTimeout> | null = null;

/** Transpone un acorde completo sin romper su voicing. */
const transpose = (notes: number[], offset: number): number[] => notes.map((note) => note + offset);

function impulse(ctx: AudioContext, seconds = 2.8, decay = 3): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

function build(): Engine | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 24;
  comp.ratio.value = 2.6;
  comp.attack.value = 0.03;
  comp.release.value = 0.35;

  const leadFilter = ctx.createBiquadFilter();
  leadFilter.type = 'lowpass';
  leadFilter.frequency.value = 3300;
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 1500;

  const leadBus = ctx.createGain();
  leadBus.gain.value = 0.9;
  const padBus = ctx.createGain();
  padBus.gain.value = 0.85;

  leadBus.connect(leadFilter);
  padBus.connect(padFilter);

  // Reverb corta y cálida, generada en memoria.
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  convolver.connect(wet);
  wet.connect(master);

  const dry = ctx.createGain();
  dry.gain.value = 0.9;
  leadFilter.connect(dry);
  padFilter.connect(dry);
  leadFilter.connect(convolver);
  padFilter.connect(convolver);
  dry.connect(master);
  master.connect(comp);
  comp.connect(ctx.destination);

  const engine: Engine = {
    ctx,
    master,
    leadBus,
    padBus,
    leadFilter,
    padFilter,
    wet,
    timer: null,
    nextBar: ctx.currentTime + 0.2,
    barNumber: 0,
    channel: $channel.get(),
    pending: null,
    everStarted: true,
  };
  setEngine(engine);
  return engine;
}

function leadNote(engine: Engine, midi: number, when: number, beats: number, velocity: number): void {
  const ctx = engine.ctx;
  const frequency = midiToHz(midi);
  const duration = Math.max(0.5, beats * BEAT * 1.7);
  const peak = 0.095 * velocity;

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.value = frequency;
  const shimmer = ctx.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.value = frequency * 2.001;
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0.14;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, when);
  envelope.gain.exponentialRampToValueAtTime(peak, when + 0.02);
  envelope.gain.exponentialRampToValueAtTime(peak * 0.38, when + 0.32);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  body.connect(envelope);
  shimmer.connect(shimmerGain);
  shimmerGain.connect(envelope);
  envelope.connect(engine.leadBus);

  body.start(when);
  shimmer.start(when);
  body.stop(when + duration + 0.05);
  shimmer.stop(when + duration + 0.05);
}

function padNote(engine: Engine, midi: number, when: number, duration: number, peak = 0.013): void {
  const ctx = engine.ctx;
  const frequency = midiToHz(midi);

  const a = ctx.createOscillator();
  a.type = 'sine';
  a.frequency.value = frequency;
  const b = ctx.createOscillator();
  b.type = 'triangle';
  b.frequency.value = frequency;
  b.detune.value = -5;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, when);
  envelope.gain.linearRampToValueAtTime(peak, when + 0.55);
  envelope.gain.setValueAtTime(peak, when + duration - 0.9);
  envelope.gain.linearRampToValueAtTime(0.0001, when + duration);

  const voiceGain = ctx.createGain();
  voiceGain.gain.value = 0.5;
  a.connect(voiceGain);
  b.connect(voiceGain);
  voiceGain.connect(envelope);
  envelope.connect(engine.padBus);

  a.start(when);
  b.start(when);
  a.stop(when + duration + 0.05);
  b.stop(when + duration + 0.05);
}

function bassNote(engine: Engine, midi: number, when: number, duration: number): void {
  const ctx = engine.ctx;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = midiToHz(midi);

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, when);
  envelope.gain.linearRampToValueAtTime(0.05, when + 0.12);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  osc.connect(envelope);
  envelope.connect(engine.padBus);
  osc.start(when);
  osc.stop(when + duration + 0.05);
}

function scheduleBar(engine: Engine, when: number): void {
  if (engine.pending !== null) {
    engine.channel = engine.pending;
    engine.pending = null;
  }

  const tone = TONES[engine.channel];
  const offset = tone.offset;
  const bar = engine.barNumber % 4;
  const loop = Math.floor(engine.barNumber / 4);
  const chord = CHORDS[bar];

  // El timbre del canal entra deslizándose: nunca hay salto de textura.
  engine.leadFilter.frequency.setTargetAtTime(tone.leadCutoff, when, 0.9);
  engine.padFilter.frequency.setTargetAtTime(tone.padCutoff, when, 0.9);
  engine.wet.gain.setTargetAtTime(tone.reverb, when, 1.1);

  const padNotes = transpose(chord.notes, offset);
  const lift = Math.min(...padNotes) < 45 ? 12 : 0;
  padNotes.forEach((note) => {
    padNote(engine, note + lift, when, BAR * 0.95, 0.012);
  });
  bassNote(engine, chord.bass + offset, when, BAR * 0.82);

  const barStart = bar * 4;
  MELODY.forEach((note) => {
    if (note.beat < barStart || note.beat >= barStart + 4) return;
    const at = when + (note.beat - barStart) * BEAT;
    const velocity = note.vel * (loop % 2 === 1 ? 0.94 : 1);
    const midi = note.note + offset;
    leadNote(engine, midi, at, note.len, velocity);
    // Mano izquierda: octava baja en las notas largas, para dar cuerpo.
    if (note.len >= 1.5 && midi - 12 >= 45) {
      leadNote(engine, midi - 12, at + 0.02, note.len, velocity * 0.42);
    }
    // Cada dos vueltas, una octava suave en las notas largas.
    if (loop % 2 === 1 && note.len >= 1 && midi + 12 <= 88) {
      leadNote(engine, midi + 12, at + 0.04, note.len, velocity * 0.4);
    }
  });

  engine.barNumber += 1;
}

function scheduler(engine: Engine): void {
  if (engine.ctx.state !== 'running') return;
  while (engine.nextBar < engine.ctx.currentTime + LOOKAHEAD) {
    scheduleBar(engine, engine.nextBar);
    engine.nextBar += BAR;
  }
}

function startScheduler(engine: Engine): void {
  if (engine.timer) return;
  engine.nextBar = engine.ctx.currentTime + 0.25;
  engine.barNumber = 0;
  engine.pending = null;
  engine.channel = $channel.get();
  engine.timer = setInterval(() => {
    if (engine) scheduler(engine);
  }, 250);
  scheduler(engine);
}

function stopScheduler(engine: Engine): void {
  if (!engine.timer) return;
  clearInterval(engine.timer);
  engine.timer = null;
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

  const tone = TONES[$channel.get()];
  const now = engine.ctx.currentTime;
  const gain = engine.master.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
  gain.linearRampToValueAtTime(0.42, now + fade);
  engine.wet.gain.linearRampToValueAtTime(tone.reverb, now + fade);

  $audio.set('on');
  startScheduler(engine);
}

export function stopAmbient(): void {
  const engine = getEngine();
  $audio.set('off');
  if (!engine) return;

  stopScheduler(engine);
  const now = engine.ctx.currentTime;
  const gain = engine.master.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
  gain.linearRampToValueAtTime(0.0001, now + 0.6);

  suspendTimer = setTimeout(() => {
    void engine.ctx.suspend().catch(() => undefined);
    suspendTimer = null;
  }, 900);
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
    if (engine?.everStarted) engine.pending = channel as ChannelId;
  });
}
