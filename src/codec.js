import { TRACK_IDS, STEPS, PATTERN_IDS, BPM_MIN } from './constants.js';
import { createPattern, isEmptyPattern, patternFromRows, patternToRows } from './pattern.js';
import { createSong, isValidSong } from './song.js';

/**
 * Song serialization: a compact URL-safe string for share links
 * (location.hash) and readable JSON for files.
 *
 * Share string = base64url (no padding) of these bytes:
 *   0       format version
 *   1       bpm - 60
 *   2       swing
 *   3       flags: bit 0 chain on, bits 1-2 current slot, bits 3-6 slots stored (A-D)
 *   4, 5    mute bits, solo bits (bit n = track n)
 *   6..13   track volumes
 *   14      chain length
 *   then    chain slots, 2 bits each
 *   then    32 bytes per stored slot: every step as 2 bits, track by track
 * Empty slots are not stored, so a one-pattern song is 63 characters long.
 */

const FORMAT_VERSION = 1;
const JSON_FORMAT = 'drum-machine-song';
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const VOLUME_OFFSET = 6;
const CHAIN_LENGTH_OFFSET = VOLUME_OFFSET + TRACK_IDS.length;
const HEADER_BYTES = CHAIN_LENGTH_OFFSET + 1;
const PATTERN_BYTES = (TRACK_IDS.length * STEPS * 2) / 8;

/**
 * Encodes a song as a compact URL-safe string for share links.
 * @param {import('./song.js').Song} song a valid song
 * @returns {string} characters A-Z a-z 0-9 - _ only
 */
export function encodeSong(song) {
  const slots = PATTERN_IDS.filter((id) => !isEmptyPattern(song.patterns[id]));
  const patternStart = HEADER_BYTES + Math.ceil(song.chain.length / 4);
  const bytes = new Uint8Array(patternStart + slots.length * PATTERN_BYTES);
  writeHeader(bytes, song, slots);
  song.chain.forEach((id, i) => writeBits(bytes, HEADER_BYTES, i, PATTERN_IDS.indexOf(id)));
  slots.forEach((id, i) => writePattern(bytes, patternStart + i * PATTERN_BYTES, song.patterns[id]));
  return toBase64Url(bytes);
}

/**
 * Decodes a share string made by encodeSong().
 * @param {string} text
 * @returns {import('./song.js').Song | null} null for anything malformed or out of range
 */
export function decodeSong(text) {
  const bytes = fromBase64Url(text);
  if (!bytes || bytes.length < HEADER_BYTES || bytes[0] !== FORMAT_VERSION) return null;
  const slots = PATTERN_IDS.filter((_, i) => (bytes[3] >> (3 + i)) & 1);
  const chainLength = bytes[CHAIN_LENGTH_OFFSET];
  const patternStart = HEADER_BYTES + Math.ceil(chainLength / 4);
  if (bytes.length !== patternStart + slots.length * PATTERN_BYTES) return null;
  const song = readHeader(bytes);
  song.chain = Array.from({ length: chainLength }, (_, i) => PATTERN_IDS[readBits(bytes, HEADER_BYTES, i)]);
  slots.forEach((id, i) => {
    song.patterns[id] = readPattern(bytes, patternStart + i * PATTERN_BYTES);
  });
  return isValidSong(song) ? song : null;
}

/**
 * Serializes a song as readable JSON; every track row is a 16-character
 * string ('.' off, '1' soft, '2' normal, '3' accent).
 * @param {import('./song.js').Song} song
 * @returns {string}
 */
export function songToJSON(song) {
  const data = {
    format: JSON_FORMAT,
    version: FORMAT_VERSION,
    bpm: song.bpm,
    swing: song.swing,
    current: song.current,
    chainOn: song.chainOn,
    chain: song.chain,
    tracks: TRACK_IDS.map((id, track) => ({ id, ...song.channels[track] })),
    patterns: Object.fromEntries(PATTERN_IDS.map((id) => [id, patternToRows(song.patterns[id])])),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Reads a song saved by songToJSON(). Missing fields, tracks or slots fall
 * back to the defaults of a new song.
 * @param {string} text
 * @returns {import('./song.js').Song | null} null when the text is not such JSON or holds invalid values
 */
export function songFromJSON(text) {
  const data = parseObject(text);
  if (!data || data.format !== JSON_FORMAT || data.version !== FORMAT_VERSION) return null;
  const defaults = createSong();
  const song = {
    bpm: data.bpm ?? defaults.bpm,
    swing: data.swing ?? defaults.swing,
    patterns: Object.fromEntries(PATTERN_IDS.map((id) => [id, patternFromJSON(data.patterns?.[id])])),
    current: data.current ?? defaults.current,
    chain: data.chain ?? defaults.chain,
    chainOn: data.chainOn ?? defaults.chainOn,
    channels: TRACK_IDS.map((id, track) => channelFromJSON(data.tracks, id, defaults.channels[track])),
  };
  return isValidSong(song) ? song : null;
}

function parseObject(text) {
  try {
    const data = JSON.parse(text);
    return typeof data === 'object' && data !== null ? data : null;
  } catch {
    return null;
  }
}

function patternFromJSON(rows) {
  return rows === undefined ? createPattern() : patternFromRows(rows);
}

function channelFromJSON(tracks, id, fallback) {
  const entry = Array.isArray(tracks) ? tracks.find((track) => track?.id === id) : undefined;
  if (!entry) return fallback;
  return { volume: entry.volume ?? fallback.volume, mute: entry.mute ?? fallback.mute, solo: entry.solo ?? fallback.solo };
}

function writeHeader(bytes, song, slots) {
  const slotMask = slots.reduce((mask, id) => mask | (1 << PATTERN_IDS.indexOf(id)), 0);
  bytes[0] = FORMAT_VERSION;
  bytes[1] = song.bpm - BPM_MIN;
  bytes[2] = song.swing;
  bytes[3] = (song.chainOn ? 1 : 0) | (PATTERN_IDS.indexOf(song.current) << 1) | (slotMask << 3);
  bytes[4] = channelBits(song.channels, 'mute');
  bytes[5] = channelBits(song.channels, 'solo');
  song.channels.forEach((channel, track) => {
    bytes[VOLUME_OFFSET + track] = channel.volume;
  });
  bytes[CHAIN_LENGTH_OFFSET] = song.chain.length;
}

function readHeader(bytes) {
  const song = createSong();
  song.bpm = BPM_MIN + bytes[1];
  song.swing = bytes[2];
  song.chainOn = (bytes[3] & 1) === 1;
  song.current = PATTERN_IDS[(bytes[3] >> 1) & 3];
  song.channels = TRACK_IDS.map((_, track) => ({
    volume: bytes[VOLUME_OFFSET + track],
    mute: ((bytes[4] >> track) & 1) === 1,
    solo: ((bytes[5] >> track) & 1) === 1,
  }));
  return song;
}

function channelBits(channels, key) {
  return channels.reduce((bits, channel, track) => (channel[key] ? bits | (1 << track) : bits), 0);
}

function writePattern(bytes, offset, pattern) {
  pattern.forEach((row, track) => {
    row.forEach((velocity, step) => writeBits(bytes, offset, track * STEPS + step, velocity));
  });
}

function readPattern(bytes, offset) {
  return TRACK_IDS.map((_, track) =>
    Array.from({ length: STEPS }, (_, step) => readBits(bytes, offset, track * STEPS + step)),
  );
}

/** Writes the 2-bit field number `index` of the area starting at byte `offset`. */
function writeBits(bytes, offset, index, value) {
  bytes[offset + (index >> 2)] |= value << ((index & 3) * 2);
}

function readBits(bytes, offset, index) {
  return (bytes[offset + (index >> 2)] >> ((index & 3) * 2)) & 3;
}

function toBase64Url(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const group = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(3, bytes.length - i) + 1;
    for (let c = 0; c < chars; c += 1) text += BASE64URL[(group >> (18 - 6 * c)) & 63];
  }
  return text;
}

function fromBase64Url(text) {
  if (typeof text !== 'string' || text.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((text.length * 6) / 8));
  let buffer = 0;
  let bits = 0;
  let length = 0;
  for (const ch of text) {
    const value = BASE64URL.indexOf(ch);
    if (value < 0) return null;
    buffer = ((buffer << 6) | value) & 0xfff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[length] = (buffer >> bits) & 0xff;
      length += 1;
    }
  }
  return bytes;
}
