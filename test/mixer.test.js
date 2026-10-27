import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAudible, hitGain, VELOCITY_GAINS } from '../src/mixer.js';

/**
 * Builds channels from a compact spec, one character per track:
 * '.' plain, 'M' muted, 'S' soloed, 'B' both muted and soloed.
 */
function channels(spec) {
  return [...spec].map((ch) => ({ volume: 80, mute: ch === 'M' || ch === 'B', solo: ch === 'S' || ch === 'B' }));
}

/** Which tracks are heard, as a string of 1/0 per track. */
function heard(spec) {
  const list = channels(spec);
  return list.map((_, track) => (isAudible(list, track) ? '1' : '0')).join('');
}

test('without mute or solo every track is heard', () => {
  assert.equal(heard('........'), '11111111');
});

test('a muted track is silent and the others are heard', () => {
  assert.equal(heard('..M.....'), '11011111');
  assert.equal(heard('MMMMMMMM'), '00000000');
});

test('solo isolates the soloed tracks', () => {
  assert.equal(heard('S.......'), '10000000');
  assert.equal(heard('S..S....'), '10010000');
  assert.equal(heard('SSSSSSSS'), '11111111');
});

test('a muted track stays silent while another track is soloed', () => {
  assert.equal(heard('S.M.....'), '10000000');
});

test('mute wins over solo on the same track, and its solo still silences the rest', () => {
  assert.equal(heard('B.......'), '00000000');
  assert.equal(heard('BS......'), '01000000');
});

test('an unknown track index is never heard', () => {
  assert.equal(isAudible(channels('........'), 8), false);
});

test('hit gain follows velocity and a square-law volume curve', () => {
  assert.equal(VELOCITY_GAINS[0], 0, 'velocity 0 is silent');
  assert.equal(VELOCITY_GAINS[3], 1, 'an accent plays at full volume');
  assert.equal(hitGain({ volume: 100 }, 3), 1);
  assert.equal(hitGain({ volume: 100 }, 0), 0);
  assert.equal(hitGain({ volume: 50 }, 3), 0.25);
  assert.equal(hitGain({ volume: 0 }, 3), 0);
  const channel = { volume: 80 };
  assert.ok(hitGain(channel, 1) < hitGain(channel, 2));
  assert.ok(hitGain(channel, 2) < hitGain(channel, 3));
  assert.equal(hitGain(channel, 9), 0, 'unknown velocity is silent');
});
