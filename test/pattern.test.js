import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPattern,
  clonePattern,
  isEmptyPattern,
  isValidPattern,
  nextVelocity,
  patternFromRows,
  patternToRows,
  randomPattern,
} from '../src/pattern.js';
import { createRng } from '../src/rng.js';
import { TRACK_IDS, STEPS } from '../src/constants.js';

const KICK = TRACK_IDS.indexOf('kick');
const SNARE = TRACK_IDS.indexOf('snare');
const CLOSED_HAT = TRACK_IDS.indexOf('chh');
const OPEN_HAT = TRACK_IDS.indexOf('ohh');
const LOW_TOM = TRACK_IDS.indexOf('ltom');
const HIGH_TOM = TRACK_IDS.indexOf('htom');

test('a new pattern has 8 tracks of 16 silent steps', () => {
  const pattern = createPattern();
  assert.equal(pattern.length, 8);
  assert.ok(pattern.every((row) => row.length === STEPS && row.every((v) => v === 0)));
  assert.ok(isEmptyPattern(pattern));
  assert.ok(isValidPattern(pattern));
});

test('tapping cycles off → normal → accent → soft → off', () => {
  const seen = [0];
  for (let i = 0; i < 4; i += 1) seen.push(nextVelocity(seen.at(-1)));
  assert.deepEqual(seen, [0, 2, 3, 1, 0]);
});

test('clonePattern makes an independent copy', () => {
  const pattern = createPattern();
  const copy = clonePattern(pattern);
  copy[0][0] = 3;
  assert.equal(pattern[0][0], 0);
  assert.equal(isEmptyPattern(copy), false);
});

test('text rows convert to patterns and back', () => {
  const rows = { kick: '3...2...3...1...', ohh: '..2...2...2...2.' };
  const pattern = patternFromRows(rows);
  assert.deepEqual(pattern[KICK], [3, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0]);
  const back = patternToRows(pattern);
  assert.equal(back.kick, rows.kick);
  assert.equal(back.ohh, rows.ohh);
  assert.equal(back.snare, '................', 'missing tracks are silent');
});

test('invalid text rows are rejected', () => {
  assert.equal(patternFromRows({ kick: '3...' }), null, 'too short');
  assert.equal(patternFromRows({ kick: '3...2...3...2...3' }), null, 'too long');
  assert.equal(patternFromRows({ kick: '3...4...........' }), null, 'velocity 4');
  assert.equal(patternFromRows({ kick: 3 }), null, 'not text');
  assert.equal(patternFromRows(null), null);
  assert.equal(patternFromRows('kick'), null);
});

test('isValidPattern rejects wrong shapes and values', () => {
  const pattern = createPattern();
  assert.equal(isValidPattern(pattern.slice(1)), false);
  pattern[2][5] = 4;
  assert.equal(isValidPattern(pattern), false);
  pattern[2][5] = 1.5;
  assert.equal(isValidPattern(pattern), false);
  assert.equal(isValidPattern('pattern'), false);
});

test('randomPattern is deterministic for a seed and varies across seeds', () => {
  assert.deepEqual(randomPattern(createRng(5)), randomPattern(createRng(5)));
  const distinct = new Set();
  for (let seed = 0; seed < 20; seed += 1) distinct.add(JSON.stringify(randomPattern(createRng(seed))));
  assert.equal(distinct.size, 20);
});

/** Adds the velocities of the hits of `row` on `steps` to running totals. */
function addVelocities(totals, row, steps) {
  for (const step of steps) {
    if (row[step] === 0) continue;
    totals.sum += row[step];
    totals.count += 1;
  }
}

test('randomPattern has musical density per track', () => {
  const runs = 400;
  const all = [...Array(STEPS).keys()];
  const odd = all.filter((step) => step % 2 === 1);
  const hits = TRACK_IDS.map(() => new Array(STEPS).fill(0));
  const downbeats = { sum: 0, count: 0 };
  const sixteenths = { sum: 0, count: 0 };
  for (let seed = 1; seed <= runs; seed += 1) {
    const pattern = randomPattern(createRng(seed));
    assert.ok(isValidPattern(pattern));
    pattern.forEach((row, track) => {
      row.forEach((velocity, step) => {
        if (velocity > 0) hits[track][step] += 1;
      });
      addVelocities(downbeats, row, [0, 8]);
      addVelocities(sixteenths, row, odd);
    });
    for (const step of all) {
      assert.ok(!(pattern[CLOSED_HAT][step] && pattern[OPEN_HAT][step]), 'an open hat silences the closed hat');
    }
  }
  const rate = (track, steps) => steps.reduce((sum, step) => sum + hits[track][step], 0) / (steps.length * runs);
  assert.ok(rate(KICK, [0, 8]) > 0.8, 'kick lands on the downbeats');
  assert.ok(rate(KICK, odd) < 0.2, 'kick rarely hits sixteenths');
  assert.ok(rate(SNARE, [4, 12]) > 0.8, 'snare lands on the backbeats');
  assert.ok(rate(SNARE, [0, 8]) < 0.1, 'snare rarely hits the downbeats');
  assert.ok(rate(CLOSED_HAT, all) > 0.4, 'closed hats are busy');
  assert.ok(rate(CLOSED_HAT, all) > 5 * rate(LOW_TOM, all), 'toms are sparse');
  assert.ok(rate(CLOSED_HAT, all) > 5 * rate(HIGH_TOM, all), 'toms are sparse');
  assert.ok(downbeats.sum / downbeats.count > sixteenths.sum / sixteenths.count + 0.5, 'downbeats are accented more');
});
