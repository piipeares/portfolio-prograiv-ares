/**
 * Motor de audio ambiental generativo.
 * Sin archivos externos: piano de fieltro sintetizado, pads cálidos, bajo y
 * reverb por convolución. Una frase melódica compuesta de 4 compases sobre
 * acordes con séptima se repite y cada canal la transpone a otra tonalidad.
 * El timbre del canal responde al instante y la nueva tonalidad entra en el
 * siguiente compás, para que el cambio sea audible pero nunca corte el sonido.
 */
import type { ChannelId } from '../data/profile';
import { $audio, $channel } from '../stores/signal';

const BPM = 80;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LOOKAHEAD = 0.5;
const FADE_IN = 2;
const GLIDE = 1.2;

const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Acordes con séptima: cálidos, sin el brillo de una tríada simple. */
const CHORDS = [
  { notes: [57, 60, 64, 67], bass: 45 }, // Am7
  { notes: [53, 57, 60, 64], bass: 41 }, // Fmaj7
  { notes: [52, 55, 59, 64], bass: 36 }, // Cmaj7
  { notes: [55, 59, 62, 64], bass: 43 }, // G6
];

/**
 * Frase de 4 compases (beats absolutos 0–16). Notas largas, contorno amplio y
 * silencios: melodía cantable, sin el rebote de negras de una canción infantil.
 */
const MELODY = [
  { beat: 0, note: 76, len: 2.5, vel: 0.8 },
  { beat: 2.5, note: 72, len: 1.5, vel: 0.66 },

  { beat: 4, note: 69, len: 3, vel: 0.72 },
  { beat: 7, note: 67, len: 1, vel: 0.56 },

  { beat: 8, note: 71, len: 2, vel: 0.68 },
  { beat: 10, note: 76, len: 2, vel: 0.72 },

  { beat: 12, note: 74, len: 2.5, vel: 0.7 },
  { beat: 14.5, note: 71, len: 1.5, vel: 0.58 },
];

interface ChannelTone {
  offset: number;
  octave: number;
  padCutoff: number;
  leadCutoff: number;
  reverb: number;
}

const TONES: Record<ChannelId, ChannelTone> = {
  0: { offset: 0, octave: 0, padCutoff: 1250, leadCutoff: 2200, reverb: 0.44 },
  1: { offset: 5, octave: 0, padCutoff: 1650, leadCutoff: 2800, reverb: 0.34 },
  2: { offset: 7, octave: -12, padCutoff: 1100, leadCutoff: 2400, reverb: 0.48 },
  3: { offset: 2, octave: -12, padCutoff: 950, leadCutoff: 1800, reverb: 0.38 },
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

/** Transpone un voicing completo para no romper su equilibrio. */
const transpose = (notes: number[], offset: number): number[] => notes.map((note) => note + offset);

/** Mantiene el bajo en un registro audible aunque el canal baje de octava. */
const fitBass = (midi: number): number => {
  let value = midi;
  while (value < 36) value += 12;
  return value;
};

function impulse(ctx: AudioContext, seconds = 3.2, decay = 2.6): AudioBuffer {
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
  comp.threshold.value = -20;
  comp.knee.value = 28;
  comp.ratio.value = 2;
  comp.attack.value = 0.05;
  comp.release.value = 0.4;

  const leadFilter = ctx.createBiquadFilter();
  leadFilter.type = 'lowpass';
  leadFilter.frequency.value = 2200;
  leadFilter.Q.value = 0.4;
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 1250;
  padFilter.Q.value = 0.4;

  const leadBus = ctx.createGain();
  leadBus.gain.value = 0.85;
  const padBus = ctx.createGain();
  padBus.gain.value = 0.8;

  leadBus.connect(leadFilter);
  padBus.connect(padFilter);

  const convolver = ctx.createConvolver();
  convolver.buffer = impulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.4;
  convolver.connect(wet);
  wet.connect(master);

  const dry = ctx.createGain();
  dry.gain.value = 0.85;
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

/** Fieltro: seno como fundamental y triángulo muy suave, sin brillo metálico. */
function leadNote(engine: Engine, midi: number, when: number, beats: number, velocity: number): void {
  const ctx = engine.ctx;
  const frequency = midiToHz(midi);
  const duration = Math.max(1.1, beats * BEAT * 1.5);
  const peak = 0.07 * velocity;

  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.value = frequency;
  const warmth = ctx.createOscillator();
  warmth.type = 'triangle';
  warmth.frequency.value = frequency;
  warmth.detune.value = 5;
  const warmthGain = ctx.createGain();
  warmthGain.gain.value = 0.22;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, when);
  envelope.gain.exponentialRampToValueAtTime(peak, when + 0.06);
  envelope.gain.exponentialRampToValueAtTime(peak * 0.42, when + 0.5);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  body.connect(envelope);
  warmth.connect(warmthGain);
  warmthGain.connect(envelope);
  envelope.connect(engine.leadBus);

  body.start(when);
  warmth.start(when);
  body.stop(when + duration + 0.05);
  warmth.stop(when + duration + 0.05);
}

function padNote(engine: Engine, midi: number, when: number, duration: number): void {
  const ctx = engine.ctx;
  const frequency = midiToHz(midi);

  const a = ctx.createOscillator();
  a.type = 'sine';
  a.frequency.value = frequency;
  const b = ctx.createOscillator();
  b.type = 'triangle';
  b.frequency.value = frequency;
  b.detune.value = -6;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, when);
  envelope.gain.linearRampToValueAtTime(0.011, when + 0.8);
  envelope.gain.setValueAtTime(0.011, when + duration - 1.2);
  envelope.gain.linearRampToValueAtTime(0.0001, when + duration);

  const voiceGain = ctx.createGain();
  voiceGain.gain.value = 0.45;
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
  envelope.gain.linearRampToValueAtTime(0.042, when + 0.18);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  osc.connect(envelope);
  envelope.connect(engine.padBus);
  osc.start(when);
  osc.stop(when + duration + 0.05);
}

/** El canal redefine el color del sonido en el acto (filtros y reverb). */
function auditionTone(engine: Engine, channel: ChannelId, now = engine.ctx.currentTime): void {
  const tone = TONES[channel];
  engine.leadFilter.frequency.setTargetAtTime(tone.leadCutoff, now, GLIDE / 3);
  engine.padFilter.frequency.setTargetAtTime(tone.padCutoff, now, GLIDE / 3);
  engine.wet.gain.setTargetAtTime(tone.reverb, now, GLIDE / 3);
}

function scheduleBar(engine: Engine, when: number): void {
  if (engine.pending !== null) {
    engine.channel = engine.pending;
    engine.pending = null;
  }

  const tone = TONES[engine.channel];
  const bar = engine.barNumber % 4;
  const loop = Math.floor(engine.barNumber / 4);
  const chord = CHORDS[bar];

  auditionTone(engine, engine.channel, when);

  const padNotes = transpose(chord.notes, tone.offset + tone.octave);
  const lift = Math.min(...padNotes) < 40 ? 12 : 0;
  padNotes.forEach((note) => {
    padNote(engine, note + lift, when, BAR * 0.96);
  });
  bassNote(engine, fitBass(chord.bass + tone.offset + tone.octave), when, BAR * 0.9);

  const barStart = bar * 4;
  MELODY.forEach((note) => {
    if (note.beat < barStart || note.beat >= barStart + 4) return;
    const at = when + (note.beat - barStart) * BEAT;
    const velocity = note.vel * (loop % 2 === 1 ? 0.92 : 1);
    const midi = note.note + tone.offset + tone.octave;
    leadNote(engine, midi, at, note.len, velocity);
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
  }, 200);
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

  const now = engine.ctx.currentTime;
  const gain = engine.master.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
  gain.linearRampToValueAtTime(0.36, now + fade);
  auditionTone(engine, $channel.get(), now);

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
    if (!engine?.everStarted) return;
    // Respuesta inmediata en timbre; la tonalidad nueva entra en el próximo compás.
    auditionTone(engine, channel as ChannelId);
    engine.pending = channel as ChannelId;
  });
}
