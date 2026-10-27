import {
  TRACK_IDS,
  PATTERN_IDS,
  BPM_MIN,
  BPM_MAX,
  BPM_DEFAULT,
  SWING_MAX,
  VOLUME_MAX,
  VOLUME_DEFAULT,
  CHAIN_MAX,
} from './constants.js';
import { createPattern, clonePattern, isValidPattern } from './pattern.js';

/**
 * Mixer settings of one track.
 * @typedef {object} Channel
 * @property {number} volume 0..100
 * @property {boolean} mute
 * @property {boolean} solo
 */

/**
 * Everything a user edits; the data that share links and JSON files store.
 * @typedef {object} Song
 * @property {number} bpm tempo, integer 60..200
 * @property {number} swing integer 0..60: percent of a 1/16 step by which every second step is delayed
 * @property {Record<string, import('./pattern.js').Pattern>} patterns slots A-D
 * @property {string} current selected slot: the one being edited, and played while the chain is off
 * @property {string[]} chain up to 16 slot ids, played bar by bar while chainOn is true
 * @property {boolean} chainOn
 * @property {Channel[]} channels one per track, in TRACK_IDS order
 */

/**
 * Creates a new song: four empty patterns, 120 BPM, no swing, an empty chain.
 * @returns {Song}
 */
export function createSong() {
  return {
    bpm: BPM_DEFAULT,
    swing: 0,
    patterns: Object.fromEntries(PATTERN_IDS.map((id) => [id, createPattern()])),
    current: PATTERN_IDS[0],
    chain: [],
    chainOn: false,
    channels: TRACK_IDS.map(() => ({ volume: VOLUME_DEFAULT, mute: false, solo: false })),
  };
}

/**
 * Deep-copies a song.
 * @param {Song} song
 * @returns {Song}
 */
export function cloneSong(song) {
  return {
    bpm: song.bpm,
    swing: song.swing,
    patterns: Object.fromEntries(PATTERN_IDS.map((id) => [id, clonePattern(song.patterns[id])])),
    current: song.current,
    chain: song.chain.slice(),
    chainOn: song.chainOn,
    channels: song.channels.map((channel) => ({ ...channel })),
  };
}

/**
 * Tells whether a value is a complete song with every field in range
 * (used to vet decoded share links and imported JSON).
 * @param {unknown} song
 * @returns {boolean}
 */
export function isValidSong(song) {
  return (
    isObject(song) &&
    isIntInRange(song.bpm, BPM_MIN, BPM_MAX) &&
    isIntInRange(song.swing, 0, SWING_MAX) &&
    PATTERN_IDS.includes(song.current) &&
    typeof song.chainOn === 'boolean' &&
    isValidChain(song.chain) &&
    Array.isArray(song.channels) &&
    song.channels.length === TRACK_IDS.length &&
    song.channels.every(isValidChannel) &&
    isObject(song.patterns) &&
    PATTERN_IDS.every((id) => isValidPattern(song.patterns[id]))
  );
}

function isObject(value) {
  return typeof value === 'object' && value !== null;
}

function isIntInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isValidChain(chain) {
  return Array.isArray(chain) && chain.length <= CHAIN_MAX && chain.every((id) => PATTERN_IDS.includes(id));
}

function isValidChannel(channel) {
  return (
    isObject(channel) &&
    isIntInRange(channel.volume, 0, VOLUME_MAX) &&
    typeof channel.mute === 'boolean' &&
    typeof channel.solo === 'boolean'
  );
}

/**
 * Rounds and clamps a tempo into 60..200 BPM (slider and text input values).
 * @param {number | string} bpm
 * @param {number} [fallback] returned when the value is not a number
 * @returns {number}
 */
export function clampBpm(bpm, fallback = BPM_DEFAULT) {
  return clampInt(bpm, BPM_MIN, BPM_MAX, fallback);
}

/**
 * Rounds and clamps a swing amount into 0..60 percent.
 * @param {number | string} swing
 * @param {number} [fallback] returned when the value is not a number
 * @returns {number}
 */
export function clampSwing(swing, fallback = 0) {
  return clampInt(swing, 0, SWING_MAX, fallback);
}

/**
 * Rounds and clamps a track volume into 0..100.
 * @param {number | string} volume
 * @param {number} [fallback] returned when the value is not a number
 * @returns {number}
 */
export function clampVolume(volume, fallback = VOLUME_DEFAULT) {
  return clampInt(volume, 0, VOLUME_MAX, fallback);
}

function clampInt(value, min, max, fallback) {
  const number = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}
