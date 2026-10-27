/**
 * Creates a deterministic pseudo-random number generator (mulberry32).
 * The same seed always yields the same sequence, which keeps randomized
 * patterns reproducible and tests deterministic.
 * @param {number} seed Any number; it is reduced to a 32-bit integer.
 * @returns {() => number} A function returning floats in [0, 1).
 */
export function createRng(seed) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
