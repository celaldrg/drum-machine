import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutosave } from '../src/autosave.js';

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

const DELAY = 400;

/** An autosave around a song held as text, with a log of what was written. */
function setup(saved = null) {
  const timers = fakeTimers();
  const writes = [];
  const song = { text: 'song v1' };
  const autosave = createAutosave({
    read: () => song.text,
    write: (text) => writes.push(text),
    delayMs: DELAY,
    saved,
    timers,
  });
  return { timers, writes, song, autosave };
}

test('an edit is written once the song has been left alone for the delay', () => {
  const { timers, writes, song, autosave } = setup();
  autosave.schedule();
  timers.tick(DELAY - 1);
  assert.deepEqual(writes, []);
  timers.tick(1);
  assert.deepEqual(writes, ['song v1']);
  song.text = 'changed without an edit';
  timers.tick(10 * DELAY);
  assert.deepEqual(writes, ['song v1'], 'nothing is written without a new edit');
});

test('a burst of edits, such as a slider drag, is written once with the final song', () => {
  const { timers, writes, song, autosave } = setup();
  for (let bpm = 100; bpm < 120; bpm += 1) {
    song.text = `tempo ${bpm}`;
    autosave.schedule();
    timers.tick(DELAY / 8);
  }
  assert.deepEqual(writes, []);
  timers.tick(DELAY);
  assert.deepEqual(writes, ['tempo 119']);
});

test('flush writes a pending edit at once, and only once', () => {
  const { timers, writes, autosave } = setup();
  autosave.schedule();
  autosave.flush();
  assert.deepEqual(writes, ['song v1']);
  autosave.flush();
  timers.tick(10 * DELAY);
  assert.deepEqual(writes, ['song v1']);
});

test('a song opened from a share link is not written until it is edited', () => {
  const { timers, writes, song, autosave } = setup('own song');
  song.text = 'linked song'; // opening a link replaces the song but is no edit
  autosave.flush(); // the page is hidden or closed
  timers.tick(10 * DELAY);
  assert.deepEqual(writes, []);
  assert.equal(autosave.saved, 'own song', 'Undo can still bring the own song back');
  autosave.schedule(); // the first edit of the linked song
  timers.tick(DELAY);
  assert.deepEqual(writes, ['linked song']);
  assert.equal(autosave.saved, 'linked song');
});

test('an edit made just before a link opens is written first, as the own song', () => {
  const { timers, writes, song, autosave } = setup('own song');
  song.text = 'own song, edited';
  autosave.schedule();
  timers.tick(DELAY / 4);
  autosave.flush(); // the app flushes before it imports the link
  song.text = 'linked song';
  timers.tick(10 * DELAY);
  assert.deepEqual(writes, ['own song, edited']);
  assert.equal(autosave.saved, 'own song, edited');
});

test('saved is null until something is written when nothing was saved at start', () => {
  const { autosave } = setup();
  assert.equal(autosave.saved, null);
  autosave.schedule();
  autosave.flush();
  assert.equal(autosave.saved, 'song v1');
});
