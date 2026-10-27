/**
 * Fixed sizes and value ranges shared by the drum machine modules.
 */

/** Track ids in display order: kick, snare, closed hat, open hat, clap, low tom, high tom, rim. */
export const TRACK_IDS = Object.freeze(['kick', 'snare', 'chh', 'ohh', 'clap', 'ltom', 'htom', 'rim']);

/** Number of 1/16 steps in one pattern (one bar of 4/4). */
export const STEPS = 16;

/** Highest velocity level. A step holds 0 (off), 1 (soft), 2 (normal) or 3 (accent). */
export const MAX_VELOCITY = 3;

/** Pattern slot ids. */
export const PATTERN_IDS = Object.freeze(['A', 'B', 'C', 'D']);

/** Slowest tempo, in beats per minute. */
export const BPM_MIN = 60;

/** Fastest tempo, in beats per minute. */
export const BPM_MAX = 200;

/** Tempo of a new song, in beats per minute. */
export const BPM_DEFAULT = 120;

/** Highest swing amount: percent of a 1/16 step by which every second step is delayed. */
export const SWING_MAX = 60;

/** Highest track volume (volumes run from 0 to this value). */
export const VOLUME_MAX = 100;

/** Volume of a track in a new song. */
export const VOLUME_DEFAULT = 80;

/** Longest song chain, in bars. */
export const CHAIN_MAX = 16;
