import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/storage.js';

/** An in-memory stand-in for window.localStorage. */
function memoryStore() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
  };
}

const failing = () => {
  throw new Error('blocked');
};

test('values written with set come back from get', () => {
  const store = memoryStore();
  const storage = createStorage(() => store);
  assert.equal(storage.set('drum-machine:lang', 'tr'), true);
  assert.equal(storage.get('drum-machine:lang'), 'tr');
  assert.equal(store.getItem('drum-machine:lang'), 'tr');
});

test('a missing key gives the fallback, which defaults to null', () => {
  const storage = createStorage(() => memoryStore());
  assert.equal(storage.get('nothing'), null);
  assert.equal(storage.get('nothing', 'en'), 'en');
});

test('a store whose methods throw (private mode, full quota) never breaks the app', () => {
  const storage = createStorage(() => ({ getItem: failing, setItem: failing }));
  assert.equal(storage.get('key', 'fallback'), 'fallback');
  assert.equal(storage.set('key', 'value'), false);
});

test('a store that throws when touched, or does not exist, gives fallbacks too', () => {
  for (const getStore of [failing, () => undefined]) {
    const storage = createStorage(getStore);
    assert.equal(storage.get('key', 'fallback'), 'fallback');
    assert.equal(storage.set('key', 'value'), false);
  }
});

test('the store is looked up on every call, so a store that appears later is used', () => {
  let store;
  const storage = createStorage(() => store);
  assert.equal(storage.set('key', 'early'), false);
  store = memoryStore();
  assert.equal(storage.set('key', 'late'), true);
  assert.equal(storage.get('key'), 'late');
});
