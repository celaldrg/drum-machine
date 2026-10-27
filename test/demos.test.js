import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMOS, findDemo, createDemoSong } from '../src/demos.js';
import { patternFromRows, isEmptyPattern } from '../src/pattern.js';
import { isValidSong } from '../src/song.js';
import { TRACK_IDS, BPM_MIN, BPM_MAX, SWING_MAX } from '../src/constants.js';

test('there are rock, house, hip-hop and bossa demo grooves', () => {
  assert.deepEqual(
    DEMOS.map((demo) => demo.id),
    ['rock', 'house', 'hiphop', 'bossa'],
  );
  assert.equal(findDemo('house').id, 'house');
  assert.equal(findDemo('polka'), undefined);
});

test('every demo is a valid, non-empty groove in range', () => {
  for (const demo of DEMOS) {
    assert.ok(Object.keys(demo.rows).every((id) => TRACK_IDS.includes(id)), `${demo.id}: known tracks only`);
    const pattern = patternFromRows(demo.rows);
    assert.ok(pattern, `${demo.id}: rows are 16 valid characters`);
    assert.equal(isEmptyPattern(pattern), false);
    assert.ok(demo.bpm >= BPM_MIN && demo.bpm <= BPM_MAX, `${demo.id}: tempo`);
    assert.ok(demo.swing >= 0 && demo.swing <= SWING_MAX, `${demo.id}: swing`);
  }
});

test('the hip-hop groove swings and the house groove fills every track', () => {
  assert.ok(findDemo('hiphop').swing > findDemo('rock').swing);
  assert.equal(Object.keys(findDemo('house').rows).length, TRACK_IDS.length);
});

test('the demo song is valid and starts on the house groove', () => {
  const song = createDemoSong();
  assert.ok(isValidSong(song));
  assert.equal(song.current, 'A');
  assert.deepEqual(song.patterns.A, patternFromRows(findDemo('house').rows));
  assert.ok(song.chain.length > 0);
});
