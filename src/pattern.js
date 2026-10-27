import { TRACK_IDS, STEPS, MAX_VELOCITY } from './constants.js';

/**
 * A pattern is one bar: pattern[track][step] holds a velocity 0..3
 * (0 off, 1 soft, 2 normal, 3 accent), tracks in TRACK_IDS order.
 * @typedef {number[][]} Pattern
 */

/** Velocity a tapped pad moves to, indexed by its current velocity: off → normal → accent → soft → off. */
const NEXT_VELOCITY = [2, 0, 3, 1];

/** One track row as text: '.' for off, '1'..'3' for a velocity. */
const ROW_TEXT = new RegExp(`^[.1-${MAX_VELOCITY}]{${STEPS}}$`);

/** Positions in a bar, used by the randomizer: downbeat, backbeat, off-beat eighth, sixteenth. */
const DOWNBEAT = 0;
const BACKBEAT = 1;
const EIGHTH = 2;
const SIXTEENTH = 3;

/** Chance that the randomizer turns a step on, per track and position (downbeat, backbeat, eighth, sixteenth). */
const DENSITY = {
  kick: [0.9, 0.2, 0.25, 0.1],
  snare: [0.03, 0.9, 0.08, 0.1],
  chh: [0.85, 0.85, 0.8, 0.35],
  ohh: [0, 0, 0.3, 0.03],
  clap: [0.02, 0.45, 0.05, 0.04],
  ltom: [0.04, 0.02, 0.06, 0.06],
  htom: [0.03, 0.02, 0.06, 0.06],
  rim: [0.05, 0.05, 0.15, 0.12],
};

/** Chance of an accent and of a soft hit, per position. */
const ACCENT_CHANCE = [0.6, 0.6, 0.25, 0.08];
const SOFT_CHANCE = [0.05, 0.05, 0.15, 0.4];

/**
 * Creates an empty pattern.
 * @returns {Pattern}
 */
export function createPattern() {
  return TRACK_IDS.map(() => new Array(STEPS).fill(0));
}

/**
 * Copies a pattern so it can be changed without touching the original.
 * @param {Pattern} pattern
 * @returns {Pattern}
 */
export function clonePattern(pattern) {
  return pattern.map((row) => row.slice());
}

/**
 * Tells whether no step of the pattern is on.
 * @param {Pattern} pattern
 * @returns {boolean}
 */
export function isEmptyPattern(pattern) {
  return pattern.every((row) => row.every((velocity) => velocity === 0));
}

/**
 * Tells whether a value is a well-formed pattern (8 rows of 16 integers 0..3).
 * @param {unknown} pattern
 * @returns {boolean}
 */
export function isValidPattern(pattern) {
  return (
    Array.isArray(pattern) &&
    pattern.length === TRACK_IDS.length &&
    pattern.every((row) => Array.isArray(row) && row.length === STEPS && row.every(isVelocity))
  );
}

function isVelocity(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_VELOCITY;
}

/**
 * Velocity a pad gets when tapped: off → normal (2) → accent (3) → soft (1) → off,
 * so the first tap gives an ordinary hit.
 * @param {number} velocity current velocity 0..3
 * @returns {number}
 */
export function nextVelocity(velocity) {
  return NEXT_VELOCITY[velocity] ?? 0;
}

/**
 * Builds a pattern from text rows such as "3...2...3...2..." keyed by track id
 * ('.' off, '1' soft, '2' normal, '3' accent). Tracks missing from `rows` stay empty.
 * @param {Record<string, string>} rows
 * @returns {Pattern | null} null when `rows` is not an object or a row is not 16 valid characters
 */
export function patternFromRows(rows) {
  if (!rows || typeof rows !== 'object') return null;
  const pattern = createPattern();
  for (const [track, id] of TRACK_IDS.entries()) {
    const text = rows[id];
    if (text === undefined) continue;
    if (typeof text !== 'string' || !ROW_TEXT.test(text)) return null;
    pattern[track] = [...text].map((ch) => (ch === '.' ? 0 : Number(ch)));
  }
  return pattern;
}

/**
 * Converts a pattern to text rows keyed by track id (the inverse of patternFromRows).
 * @param {Pattern} pattern
 * @returns {Record<string, string>}
 */
export function patternToRows(pattern) {
  return Object.fromEntries(
    TRACK_IDS.map((id, track) => [id, pattern[track].map((v) => (v === 0 ? '.' : String(v))).join('')]),
  );
}

/**
 * Generates a random but musical pattern. Each track has its own density per
 * position in the bar (kick on downbeats, snare and clap on backbeats, busy
 * closed hats, sparse toms), strong positions get more accents, and an open
 * hat silences the closed hat on the same step.
 * @param {() => number} rng seeded generator from createRng()
 * @returns {Pattern}
 */
export function randomPattern(rng) {
  const pattern = TRACK_IDS.map((id) =>
    Array.from({ length: STEPS }, (_, step) => {
      const position = positionInBar(step);
      return rng() < DENSITY[id][position] ? randomVelocity(rng, position) : 0;
    }),
  );
  chokeClosedHats(pattern);
  return pattern;
}

function positionInBar(step) {
  if (step % 2 === 1) return SIXTEENTH;
  if (step % 8 === 0) return DOWNBEAT;
  return step % 8 === 4 ? BACKBEAT : EIGHTH;
}

function randomVelocity(rng, position) {
  const roll = rng();
  if (roll < ACCENT_CHANCE[position]) return 3;
  return roll < ACCENT_CHANCE[position] + SOFT_CHANCE[position] ? 1 : 2;
}

function chokeClosedHats(pattern) {
  const closed = pattern[TRACK_IDS.indexOf('chh')];
  pattern[TRACK_IDS.indexOf('ohh')].forEach((velocity, step) => {
    if (velocity > 0) closed[step] = 0;
  });
}
