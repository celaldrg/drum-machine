import { PATTERN_IDS } from './constants.js';
import { patternFromRows } from './pattern.js';
import { createSong } from './song.js';

/**
 * A demo groove. Rows are 16 characters per track: '.' off, '1' soft, '2' normal, '3' accent.
 * @typedef {object} Demo
 * @property {string} id rock | house | hiphop | bossa (the UI translates the name)
 * @property {number} bpm
 * @property {number} swing percent
 * @property {Record<string, string>} rows track id → step text; missing tracks are silent
 */

/** Original demo grooves written for this app. @type {Demo[]} */
export const DEMOS = [
  {
    id: 'rock',
    bpm: 112,
    swing: 0,
    rows: {
      kick: '3.....2.3.2.....',
      snare: '....3.......3..1',
      chh: '3.2.3.2.3.2.3...',
      ohh: '..............2.',
    },
  },
  {
    id: 'house',
    bpm: 124,
    swing: 12,
    rows: {
      kick: '3...3...3...3...',
      snare: '.......1......1.',
      chh: '.1.1.1.1.1.1.1.2',
      ohh: '..3...3...3...3.',
      clap: '....3.......3...',
      ltom: '..........2..2..',
      htom: '...1.......1....',
      rim: '...2.....2.....1',
    },
  },
  {
    id: 'hiphop',
    bpm: 90,
    swing: 30,
    rows: {
      kick: '3......2..3.....',
      snare: '....3.......3...',
      chh: '2.1.2.1.2.1.2.1.',
      ohh: '...............1',
      clap: '....1.......1...',
      rim: '...........1..1.',
    },
  },
  {
    id: 'bossa',
    bpm: 132,
    swing: 0,
    rows: {
      kick: '3..23..23..23..2',
      chh: '2.1.2.1.2.1.2.1.',
      rim: '3..3..3...3..3..',
    },
  },
];

/** Step indicator position of the ?demo state: mid-bar. */
export const DEMO_CURSOR = 6;

/** Grooves placed in slots A-D of the demo song. */
const DEMO_SLOTS = ['house', 'hiphop', 'rock', 'bossa'];

/** Track volumes of the demo song, in TRACK_IDS order. */
const DEMO_VOLUMES = [90, 75, 65, 60, 80, 70, 70, 55];

/**
 * Looks up a demo groove by id.
 * @param {string} id
 * @returns {Demo | undefined}
 */
export function findDemo(id) {
  return DEMOS.find((demo) => demo.id === id);
}

/**
 * Builds the song behind the ?demo screenshot: the house groove in slot A,
 * the other grooves in B-D, a short chain and varied track volumes.
 * @returns {import('./song.js').Song}
 */
export function createDemoSong() {
  const song = createSong();
  const house = findDemo('house');
  song.bpm = house.bpm;
  song.swing = house.swing;
  DEMO_SLOTS.forEach((id, slot) => {
    song.patterns[PATTERN_IDS[slot]] = patternFromRows(findDemo(id).rows);
  });
  song.chain = ['A', 'A', 'B', 'A'];
  DEMO_VOLUMES.forEach((volume, track) => {
    song.channels[track].volume = volume;
  });
  return song;
}
