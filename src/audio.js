import { resolveVoice } from './voices.js';
import { createRng } from './rng.js';

/**
 * WebAudio engine: renders the synthesized voices of voices.js (oscillators
 * and white noise, filters, envelopes). The AudioContext is created by
 * unlock(), which must run inside a user gesture (click, tap or key press).
 */

const MASTER_LEVEL = 0.8;
const NOISE_SECONDS = 1;
/** Envelopes fall to this fraction of their peak (-60 dB) before the source stops. */
const ENVELOPE_FLOOR = 0.001;
/** Between the bursts of a clap the level dips to this fraction of the peak. */
const BURST_DIP = 0.2;
/** Time constant (s) of the fade when a hat chokes another one. */
const CHOKE_TIME_CONSTANT = 0.006;
/** Extra time (s) a source keeps running after its envelope ends. */
const STOP_PADDING = 0.03;

/**
 * Creates the audio engine. Nothing touches WebAudio until unlock() is called.
 * @param {{ seed?: number }} [options] seed of the noise generator
 * @returns the engine methods documented below
 */
export function createAudioEngine(options = {}) {
  const rng = createRng(options.seed ?? 1);
  let context = null;
  let master = null;
  let noise = null;
  /** Hits that may still sound: { start, end, choke, output }. */
  let voices = [];

  function setUp(AudioContextClass) {
    context = new AudioContextClass({ latencyHint: 'interactive' });
    master = context.createGain();
    master.gain.value = MASTER_LEVEL;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    master.connect(limiter).connect(context.destination);
    noise = createNoiseBuffer(context, rng);
  }

  function startLayer(layer, start, stop, output) {
    const source = layer.source === 'noise' ? noiseSource() : oscillator(layer, start);
    const envelope = context.createGain();
    scheduleEnvelope(envelope.gain, layer, start);
    let tail = source;
    if (layer.filter) {
      const filter = context.createBiquadFilter();
      filter.type = layer.filter.type;
      filter.frequency.value = layer.filter.freq;
      filter.Q.value = layer.filter.q;
      tail = source.connect(filter);
    }
    tail.connect(envelope).connect(output);
    if (layer.source === 'noise') source.start(start, rng() * NOISE_SECONDS);
    else source.start(start);
    source.stop(stop);
    return source;
  }

  function noiseSource() {
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    return source;
  }

  function oscillator(layer, start) {
    const source = context.createOscillator();
    source.type = layer.source;
    source.frequency.setValueAtTime(layer.freq, start);
    if (layer.freqEnd) source.frequency.exponentialRampToValueAtTime(layer.freqEnd, start + layer.sweep);
    return source;
  }

  /** A new hat cuts the hat still ringing; a hat booked earlier is cut where the later one starts. */
  function applyChoke(hit) {
    for (const other of voices) {
      if (other.choke !== hit.choke) continue;
      if (other.start < hit.start && other.end > hit.start) cut(other, hit.start);
      else if (hit.start < other.start && hit.end > other.start) cut(hit, other.start);
    }
  }

  return {
    /**
     * Creates or resumes the AudioContext. Call it from a user gesture.
     * @returns {boolean} false when the browser has no WebAudio
     */
    unlock() {
      if (!context) {
        const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!AudioContextClass) return false;
        setUp(AudioContextClass);
      }
      // A refused resume (no user gesture yet) is simply retried on the next gesture.
      if (context.state !== 'running') context.resume().catch(() => {});
      return true;
    },

    /**
     * Whether sound can play right now (the context exists and runs).
     * @returns {boolean}
     */
    isRunning() {
      return context?.state === 'running';
    },

    /**
     * The audio clock in seconds (0 before unlock).
     * @returns {number}
     */
    currentTime() {
      return context ? context.currentTime : 0;
    },

    /**
     * The audio clock minus the output latency: the time of what is heard right
     * now, used to keep the step indicator in sync with the sound.
     * @returns {number}
     */
    audibleTime() {
      if (!context) return 0;
      return Math.max(0, context.currentTime - (context.baseLatency || 0) - (context.outputLatency || 0));
    },

    /**
     * Plays one drum hit at an exact time.
     * @param {string} trackId e.g. "kick"
     * @param {number} gain 0..1 (volume and velocity already applied)
     * @param {number} time audio clock time in seconds; past times play at once
     */
    playHit(trackId, gain, time) {
      const voice = context ? resolveVoice(trackId, gain) : null;
      if (!voice) return;
      const start = Math.max(time, context.currentTime);
      const hit = { start, end: start + voice.duration, choke: voice.choke, output: context.createGain() };
      hit.output.connect(master);
      const sources = voice.layers.map((layer) => startLayer(layer, start, hit.end + STOP_PADDING, hit.output));
      sources[0].onended = () => hit.output.disconnect();
      voices = voices.filter((other) => other.end > context.currentTime);
      if (hit.choke) applyChoke(hit);
      voices.push(hit);
    },

    /**
     * Silences hits booked to start after `time` (used on Stop); ringing hits fade out naturally.
     * @param {number} time audio clock time in seconds
     */
    silenceAfter(time) {
      voices.filter((hit) => hit.start > time).forEach((hit) => hit.output.gain.setValueAtTime(0, time));
    },
  };
}

function createNoiseBuffer(context, rng) {
  const buffer = context.createBuffer(1, Math.round(context.sampleRate * NOISE_SECONDS), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = rng() * 2 - 1;
  return buffer;
}

/** Attack ramps up linearly, decay falls exponentially; a clap restarts the envelope for each burst. */
function scheduleEnvelope(param, layer, start) {
  const bursts = layer.bursts ?? 1;
  const gap = layer.burstGap ?? 0;
  param.setValueAtTime(0, start);
  for (let burst = 0; burst < bursts; burst += 1) {
    const peak = start + burst * gap + layer.attack;
    param.linearRampToValueAtTime(layer.level, peak);
    if (burst < bursts - 1) param.exponentialRampToValueAtTime(layer.level * BURST_DIP, start + (burst + 1) * gap);
    else param.exponentialRampToValueAtTime(layer.level * ENVELOPE_FLOOR, peak + layer.decay);
  }
}

function cut(hit, time) {
  hit.output.gain.setTargetAtTime(0, time, CHOKE_TIME_CONSTANT);
  hit.end = Math.min(hit.end, time);
}
