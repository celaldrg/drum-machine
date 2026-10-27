import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLongPress, LONG_PRESS_MS, LONG_PRESS_SLOP_PX } from '../src/long-press.js';

/** setTimeout and clearTimeout on a manual clock: tick(ms) runs the timers that come due, in order. */
function fakeTimers() {
  let now = 0;
  let lastId = 0;
  const timers = new Map();
  return {
    setTimeout(fn, ms) {
      lastId += 1;
      timers.set(lastId, { at: now + ms, fn });
      return lastId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    tick(ms) {
      now += ms;
      const due = [...timers].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at);
      for (const [id, timer] of due) if (timers.delete(id)) timer.fn();
    },
  };
}

function setup() {
  const timers = fakeTimers();
  const fired = [];
  const press = createLongPress((target) => fired.push(target), { timers });
  return { timers, fired, press };
}

test('a long press lasts about half a second', () => {
  assert.ok(LONG_PRESS_MS >= 400 && LONG_PRESS_MS <= 700);
  assert.ok(LONG_PRESS_SLOP_PX > 0);
});

test('a touch resting for the long-press time fires once, with its target', () => {
  const { timers, fired, press } = setup();
  press.start(1, 100, 100, 'pad 3');
  timers.tick(LONG_PRESS_MS - 1);
  assert.deepEqual(fired, []);
  timers.tick(1);
  assert.deepEqual(fired, ['pad 3']);
  press.end(1);
  timers.tick(10 * LONG_PRESS_MS);
  assert.deepEqual(fired, ['pad 3']);
});

test('a touch lifted or cancelled in time is a plain tap', () => {
  const { timers, fired, press } = setup();
  press.start(1, 0, 0, 'tapped');
  timers.tick(LONG_PRESS_MS - 100);
  press.end(1); // pointerup
  press.start(2, 0, 0, 'scrolled');
  timers.tick(10);
  press.end(2); // pointercancel: the page began to scroll
  timers.tick(10 * LONG_PRESS_MS);
  assert.deepEqual(fired, []);
});

test('a small wobble keeps the press, a drag beyond the slop drops it', () => {
  const { timers, fired, press } = setup();
  const wobble = LONG_PRESS_SLOP_PX * 0.6; // diagonal: 0.85 of the slop
  press.start(1, 50, 50, 'kept');
  press.move(1, 50 + wobble, 50 + wobble);
  timers.tick(LONG_PRESS_MS);
  press.start(2, 50, 50, 'dragged');
  press.move(2, 50, 50 + LONG_PRESS_SLOP_PX + 1);
  timers.tick(LONG_PRESS_MS);
  assert.deepEqual(fired, ['kept']);
});

test('events of another pointer leave the press alone, and a new press replaces the old one', () => {
  const { timers, fired, press } = setup();
  press.start(1, 0, 0, 'first');
  press.move(7, 500, 500);
  press.end(7);
  timers.tick(LONG_PRESS_MS);
  press.start(1, 0, 0, 'replaced');
  timers.tick(LONG_PRESS_MS / 2);
  press.start(2, 0, 0, 'second');
  timers.tick(LONG_PRESS_MS);
  assert.deepEqual(fired, ['first', 'second']);
});
