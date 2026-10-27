import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyAction } from '../src/keymap.js';

const key = (name, extra = {}) => ({ key: name, ...extra });

test('Space plays and stops from anywhere except a form field', () => {
  assert.deepEqual(keyAction(key(' '), 'other'), { type: 'toggle-play' });
  assert.deepEqual(keyAction(key(' '), 'pad'), { type: 'toggle-play' });
  assert.equal(keyAction(key(' '), 'field'), null);
});

test('number keys 1-8 preview the eight tracks', () => {
  for (let track = 0; track < 8; track += 1) {
    assert.deepEqual(keyAction(key(String(track + 1)), 'other'), { type: 'preview', track });
  }
  assert.equal(keyAction(key('0'), 'other'), null);
  assert.equal(keyAction(key('9'), 'other'), null);
});

test('A-D select a pattern, in either case', () => {
  assert.deepEqual(keyAction(key('a'), 'other'), { type: 'pattern', id: 'A' });
  assert.deepEqual(keyAction(key('D'), 'pad'), { type: 'pattern', id: 'D' });
  assert.equal(keyAction(key('e'), 'other'), null);
});

test('on a focused pad the arrows move and Delete or Backspace erase', () => {
  assert.deepEqual(keyAction(key('ArrowUp'), 'pad'), { type: 'move', tracks: -1, steps: 0 });
  assert.deepEqual(keyAction(key('ArrowDown'), 'pad'), { type: 'move', tracks: 1, steps: 0 });
  assert.deepEqual(keyAction(key('ArrowLeft'), 'pad'), { type: 'move', tracks: 0, steps: -1 });
  assert.deepEqual(keyAction(key('ArrowRight'), 'pad'), { type: 'move', tracks: 0, steps: 1 });
  assert.deepEqual(keyAction(key('Delete'), 'pad'), { type: 'erase' });
  assert.deepEqual(keyAction(key('Backspace'), 'pad'), { type: 'erase' });
});

test('arrows and Delete elsewhere keep their normal browser meaning', () => {
  for (const name of ['ArrowUp', 'ArrowRight', 'Delete', 'Backspace']) {
    assert.equal(keyAction(key(name), 'other'), null, name);
  }
});

test('keys typed into fields, shortcuts with modifiers and other keys are left alone', () => {
  assert.equal(keyAction(key('1'), 'field'), null);
  assert.equal(keyAction(key('a'), 'field'), null);
  assert.equal(keyAction(key('c', { ctrlKey: true }), 'other'), null);
  assert.equal(keyAction(key('1', { metaKey: true }), 'pad'), null);
  assert.equal(keyAction(key(' ', { altKey: true }), 'other'), null);
  assert.equal(keyAction(key('Enter'), 'pad'), null);
  assert.equal(keyAction(key('Tab'), 'pad'), null);
});
