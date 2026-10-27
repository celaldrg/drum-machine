import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { LANGUAGES, normalizeLanguage, otherLanguage, stringKeys, translate } from '../src/i18n.js';
import { TRACK_IDS, MAX_VELOCITY } from '../src/constants.js';
import { DEMOS } from '../src/demos.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sources = readdirSync(new URL('../src/', import.meta.url))
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'));

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

/** Attributes of every start tag in index.html, as plain objects. */
const tags = [...html.matchAll(/<[a-z][^>]*>/g)].map((match) =>
  Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map((attr) => [attr[1], attr[2]])),
);

test('English is the default and Turkish the only other language', () => {
  assert.deepEqual(LANGUAGES, ['en', 'tr']);
  assert.equal(normalizeLanguage('tr'), 'tr');
  assert.equal(normalizeLanguage('de'), 'en');
  assert.equal(normalizeLanguage(null), 'en');
  assert.equal(otherLanguage('en'), 'tr');
  assert.equal(otherLanguage('tr'), 'en');
  assert.equal(otherLanguage('xx'), 'tr');
});

test('both languages have the same keys, no empty strings and the same placeholders', () => {
  assert.deepEqual([...stringKeys('tr')].sort(), [...stringKeys('en')].sort());
  for (const key of stringKeys('en')) {
    const en = translate('en', key);
    const tr = translate('tr', key);
    assert.ok(en.trim() && tr.trim(), `${key} is empty`);
    assert.deepEqual(placeholders(tr), placeholders(en), `${key} placeholders differ`);
  }
});

test('translate fills placeholders and falls back to English, then to the key', () => {
  assert.equal(translate('en', 'patternButton', { id: 'C' }), 'Pattern C');
  assert.equal(translate('tr', 'patternButton', { id: 'C' }), 'C deseni');
  assert.equal(translate('en', 'chainCount', { count: 0, max: 16 }), '0/16 bars');
  assert.equal(translate('en', 'patternButton'), 'Pattern {id}', 'a missing parameter stays visible');
  assert.equal(translate('fr', 'play'), 'Play');
  assert.equal(translate('tr', 'no-such-key'), 'no-such-key');
});

test('the language button names the language it switches to', () => {
  assert.equal(translate('en', 'langToggle'), 'TR');
  assert.equal(translate('tr', 'langToggle'), 'EN');
  for (const language of LANGUAGES) {
    const label = translate(language, 'langToggleLabel');
    assert.ok(label.startsWith(translate(language, 'langToggle')), 'the accessible name starts with the visible text');
  }
});

test('every track, demo groove and velocity level has a name in both languages', () => {
  const keys = [
    ...TRACK_IDS.map((id) => `track_${id}`),
    ...DEMOS.map((demo) => `demo_${demo.id}`),
    ...Array.from({ length: MAX_VELOCITY + 1 }, (_, velocity) => `velocity${velocity}`),
  ];
  for (const language of LANGUAGES) {
    for (const key of keys) assert.ok(stringKeys(language).includes(key), `${language} lacks ${key}`);
  }
});

test('every key that index.html and the app code use exists', () => {
  const htmlKeys = tags.flatMap((attrs) =>
    ['data-i18n', 'data-i18n-title', 'data-i18n-aria'].filter((name) => name in attrs).map((name) => attrs[name]),
  );
  // Calls such as t('key'), t(flag ? 'a' : 'b'), say('key') and aboutPattern('key') in the app code.
  const call = /\b(?:t|say|aboutPattern)\(\s*(?:[^'`()]*\?\s*)?'(\w+)'(?:\s*:\s*'(\w+)')?/g;
  const codeKeys = sources.flatMap((source) => [...source.matchAll(call)].flatMap((match) => match.slice(1)));
  const used = new Set([...htmlKeys, ...codeKeys].filter(Boolean));
  for (const key of ['linkCopied', 'linkInBar', 'linkLoaded', 'linkBad', 'previewLabel']) {
    assert.ok(used.has(key), `the scan finds ${key}`);
  }
  assert.ok(used.size > 40, 'the scan found the keys');
  for (const key of used) assert.ok(stringKeys('en').includes(key), `unknown key ${key}`);
});

test('the English text in index.html matches the English strings, so the first paint is right', () => {
  for (const match of html.matchAll(/<[^>]*\sdata-i18n="(\w+)"[^>]*>([^<]*)</g)) {
    assert.equal(match[2], translate('en', match[1]), `text of ${match[1]}`);
  }
  for (const attrs of tags) {
    if (attrs['data-i18n-title']) assert.equal(attrs.title, translate('en', attrs['data-i18n-title']));
    if (attrs['data-i18n-aria']) assert.equal(attrs['aria-label'], translate('en', attrs['data-i18n-aria']));
  }
  assert.ok(html.includes(`<title>${translate('en', 'docTitle')}</title>`));
  assert.ok(html.includes(`<meta name="description" content="${translate('en', 'metaDescription')}">`));
});
