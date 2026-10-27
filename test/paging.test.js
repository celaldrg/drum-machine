import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_STEPS, FOLLOW_HOLD_MS, pageOf, followPage } from '../src/paging.js';
import { STEPS } from '../src/constants.js';

/** Times at which the user has not touched the page for a long while. */
const FREE = { now: 60_000, heldUntil: 0 };

test('a bar splits into two pages of 8 steps', () => {
  assert.equal(PAGE_STEPS * 2, STEPS);
  assert.deepEqual(
    Array.from({ length: STEPS }, (_, step) => pageOf(step)),
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
  );
});

test('the page turns when the playhead moves onto the other page', () => {
  assert.equal(followPage({ page: 0, cursor: 8, previous: 7, ...FREE }), 1);
  assert.equal(followPage({ page: 1, cursor: 0, previous: 15, ...FREE }), 0);
  assert.equal(followPage({ page: 0, cursor: 10, previous: 6, ...FREE }), 1, 'also when frames skipped steps');
  assert.equal(followPage({ page: 1, cursor: 0, previous: -1, ...FREE }), 0, 'playback starts on the first page');
});

test('the page stays while the playhead moves within a page, and when stopped', () => {
  assert.equal(followPage({ page: 0, cursor: 5, previous: 4, ...FREE }), 0);
  assert.equal(followPage({ page: 1, cursor: 3, previous: 2, ...FREE }), 1, 'a picked page waits for the next turn');
  assert.equal(followPage({ page: 1, cursor: -1, previous: 9, ...FREE }), 1);
});

test('a page the user picked or touched is held, then turns with the next page change', () => {
  const heldUntil = 5000 + FOLLOW_HOLD_MS;
  assert.equal(followPage({ page: 0, cursor: 8, previous: 7, now: heldUntil - 1, heldUntil }), 0, 'held');
  assert.equal(followPage({ page: 0, cursor: 9, previous: 8, now: heldUntil + 1, heldUntil }), 0, 'no jump mid-page');
  assert.equal(followPage({ page: 0, cursor: 0, previous: 15, now: heldUntil + 500, heldUntil }), 0);
  assert.equal(followPage({ page: 0, cursor: 8, previous: 7, now: heldUntil + 1500, heldUntil }), 1);
});

test('over two bars of playback the visible page always shows the playhead', () => {
  let page = 1;
  let previous = -1;
  for (let i = 0; i < 2 * STEPS; i += 1) {
    const cursor = i % STEPS;
    page = followPage({ page, cursor, previous, ...FREE });
    assert.equal(page, pageOf(cursor), `step ${cursor}`);
    previous = cursor;
  }
});
