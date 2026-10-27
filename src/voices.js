/**
 * Synthesized drum voices as plain parameter sets (no samples). An audio
 * engine renders each layer as an oscillator or a white-noise source, through
 * an optional filter, with a pitch glide and an attack/decay envelope.
 */

/**
 * One sound source of a drum voice.
 * @typedef {object} VoiceLayer
 * @property {'sine' | 'triangle' | 'square' | 'noise'} source oscillator wave, or white noise
 * @property {number} [freq] oscillator start frequency in Hz (oscillators only)
 * @property {number} [freqEnd] frequency reached after `sweep` seconds on an exponential glide; omitted = no glide
 * @property {number} [sweep] pitch glide time in seconds
 * @property {{ type: 'highpass' | 'bandpass' | 'lowpass', freq: number, q: number }} [filter]
 * @property {number} attack seconds from silence to the peak (linear)
 * @property {number} decay seconds from the peak to silence (exponential)
 * @property {number} level peak gain 0..1
 * @property {number} [bursts] the envelope restarts this many times, `burstGap` apart (hand claps); default 1
 * @property {number} [burstGap] seconds between bursts
 */

/**
 * Voice parameters per track id. `choke` names a group in which a new hit
 * cuts the previous one off (the closed hat silences a ringing open hat).
 * @type {Record<string, { layers: VoiceLayer[], choke?: string }>}
 */
export const VOICES = {
  kick: {
    layers: [
      { source: 'sine', freq: 150, freqEnd: 45, sweep: 0.12, attack: 0.002, decay: 0.5, level: 1 },
      { source: 'noise', filter: { type: 'lowpass', freq: 3000, q: 0.7 }, attack: 0.001, decay: 0.015, level: 0.3 },
    ],
  },
  snare: {
    layers: [
      { source: 'noise', filter: { type: 'highpass', freq: 1200, q: 0.7 }, attack: 0.001, decay: 0.2, level: 0.8 },
      { source: 'triangle', freq: 230, freqEnd: 180, sweep: 0.05, attack: 0.001, decay: 0.12, level: 0.55 },
    ],
  },
  chh: {
    choke: 'hat',
    layers: [{ source: 'noise', filter: { type: 'highpass', freq: 7500, q: 0.8 }, attack: 0.001, decay: 0.05, level: 0.55 }],
  },
  ohh: {
    choke: 'hat',
    layers: [{ source: 'noise', filter: { type: 'highpass', freq: 7000, q: 0.8 }, attack: 0.002, decay: 0.4, level: 0.45 }],
  },
  clap: {
    layers: [
      {
        source: 'noise',
        filter: { type: 'bandpass', freq: 1200, q: 1.2 },
        attack: 0.001,
        decay: 0.22,
        level: 0.85,
        bursts: 3,
        burstGap: 0.011,
      },
    ],
  },
  ltom: {
    layers: [{ source: 'sine', freq: 160, freqEnd: 100, sweep: 0.25, attack: 0.002, decay: 0.45, level: 0.9 }],
  },
  htom: {
    layers: [{ source: 'sine', freq: 250, freqEnd: 165, sweep: 0.2, attack: 0.002, decay: 0.35, level: 0.85 }],
  },
  rim: {
    layers: [
      { source: 'triangle', freq: 1700, attack: 0.001, decay: 0.03, level: 0.5 },
      { source: 'square', freq: 500, filter: { type: 'bandpass', freq: 1000, q: 2 }, attack: 0.001, decay: 0.025, level: 0.3 },
    ],
  },
};

/**
 * Resolves the synth parameters for one hit: copies of the track's layers with
 * their peak level scaled by the hit gain, how long the hit rings, and its
 * choke group.
 * @param {string} trackId e.g. "kick"
 * @param {number} gain 0..1, usually hitGain(channel, velocity)
 * @returns {{ layers: VoiceLayer[], duration: number, choke: string | null } | null} null for an unknown track or a silent hit
 */
export function resolveVoice(trackId, gain) {
  if (!Object.hasOwn(VOICES, trackId) || !(gain > 0)) return null;
  const voice = VOICES[trackId];
  const layers = voice.layers.map((layer) => scaleLayer(layer, gain));
  return { layers, duration: Math.max(...layers.map(layerDuration)), choke: voice.choke ?? null };
}

function scaleLayer(layer, gain) {
  const copy = { ...layer, level: layer.level * gain };
  if (layer.filter) copy.filter = { ...layer.filter };
  return copy;
}

function layerDuration(layer) {
  return ((layer.bursts ?? 1) - 1) * (layer.burstGap ?? 0) + layer.attack + layer.decay;
}
