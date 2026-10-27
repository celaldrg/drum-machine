import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseStart, SONG_KEY, LANG_KEY } from '../src/session.js';

test('?demo wins over a share link and the saved song', () => {
  assert.deepEqual(chooseStart({ search: '?demo', hash: '#abc', saved: '{}' }), { kind: 'demo' });
  assert.deepEqual(chooseStart({ search: '?x=1&demo=1' }), { kind: 'demo' });
});

test('a share link in the hash wins over the saved song', () => {
  assert.deepEqual(chooseStart({ hash: '#v1.abc', saved: '{}' }), { kind: 'link', text: 'v1.abc' });
  assert.deepEqual(chooseStart({ search: '?other', hash: 'v1.abc' }), { kind: 'link', text: 'v1.abc' });
});

test('without a link the autosaved song is used, otherwise a new song', () => {
  assert.deepEqual(chooseStart({ saved: '{"bpm":120}' }), { kind: 'saved', text: '{"bpm":120}' });
  assert.deepEqual(chooseStart({ hash: '#', saved: null }), { kind: 'new' });
  assert.deepEqual(chooseStart({ search: '', hash: '', saved: '' }), { kind: 'new' });
  assert.deepEqual(chooseStart(), { kind: 'new' });
});

test('the song and the language are stored under separate, app-specific keys', () => {
  assert.notEqual(SONG_KEY, LANG_KEY);
  assert.ok(SONG_KEY.startsWith('drum-machine:'));
  assert.ok(LANG_KEY.startsWith('drum-machine:'));
});
