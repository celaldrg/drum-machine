import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyText, CLIPBOARD_TIMEOUT_MS } from '../src/clipboard.js';

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
    get size() {
      return timers.size;
    },
  };
}

/** Lets every queued promise callback run. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('resolves true once the clipboard holds the text, and clears its timeout', async () => {
  const timers = fakeTimers();
  const written = [];
  const clipboard = { writeText: async (text) => written.push(text) };
  assert.equal(await copyText(clipboard, 'https://example.test/#v1.abc', { timers }), true);
  assert.deepEqual(written, ['https://example.test/#v1.abc']);
  assert.equal(timers.size, 0);
});

test('resolves false when writing is refused or there is no clipboard (insecure context)', async () => {
  const timers = fakeTimers();
  const refused = { writeText: () => Promise.reject(new Error('NotAllowedError')) };
  const throwing = {
    writeText() {
      throw new TypeError('not allowed');
    },
  };
  assert.equal(await copyText(refused, 'x', { timers }), false);
  assert.equal(await copyText(throwing, 'x', { timers }), false);
  assert.equal(await copyText(undefined, 'x', { timers }), false);
  assert.equal(timers.size, 0);
});

test('gives up after about 1.5 s when writeText never settles', async () => {
  assert.ok(CLIPBOARD_TIMEOUT_MS >= 1000 && CLIPBOARD_TIMEOUT_MS <= 2000);
  const timers = fakeTimers();
  let result = 'pending';
  const done = copyText({ writeText: () => new Promise(() => {}) }, 'x', { timers }).then((copied) => {
    result = copied;
  });
  timers.tick(CLIPBOARD_TIMEOUT_MS - 1);
  await settle();
  assert.equal(result, 'pending', 'still waiting just before the timeout');
  timers.tick(1);
  await done;
  assert.equal(result, false);
});

test('a write that finishes after the timeout does not change the answer', async () => {
  const timers = fakeTimers();
  let finish;
  const clipboard = { writeText: () => new Promise((resolve) => (finish = resolve)) };
  const answer = copyText(clipboard, 'x', { timers });
  timers.tick(CLIPBOARD_TIMEOUT_MS);
  finish();
  assert.equal(await answer, false);
});
