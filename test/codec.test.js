import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeSong, decodeSong, songToJSON, songFromJSON } from '../src/codec.js';
import { createSong, isValidSong } from '../src/song.js';
import { createRng } from '../src/rng.js';
import { PATTERN_IDS, TRACK_IDS, STEPS } from '../src/constants.js';

function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** A random grid with a random density (anything from almost empty to full). */
function randomGrid(rng) {
  const density = rng();
  return TRACK_IDS.map(() => Array.from({ length: STEPS }, () => (rng() < density ? randomInt(rng, 1, 3) : 0)));
}

/** A song with a random pattern in a random slot, random other slots and random settings. */
function randomSong(seed) {
  const rng = createRng(seed);
  const song = createSong();
  song.bpm = randomInt(rng, 60, 200);
  song.swing = randomInt(rng, 0, 60);
  for (const id of PATTERN_IDS) {
    if (rng() < 0.5) song.patterns[id] = randomGrid(rng);
  }
  song.patterns[PATTERN_IDS[randomInt(rng, 0, 3)]] = randomGrid(rng);
  song.current = PATTERN_IDS[randomInt(rng, 0, 3)];
  song.chain = Array.from({ length: randomInt(rng, 0, 16) }, () => PATTERN_IDS[randomInt(rng, 0, 3)]);
  song.chainOn = rng() < 0.5;
  song.channels = TRACK_IDS.map(() => ({ volume: randomInt(rng, 0, 100), mute: rng() < 0.2, solo: rng() < 0.1 }));
  return song;
}

function bytesOf(code) {
  return Uint8Array.from(Buffer.from(code, 'base64url'));
}

function codeOf(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

test('share strings round-trip 500 seeded random patterns exactly', () => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const song = randomSong(seed);
    const code = encodeSong(song);
    assert.match(code, /^[A-Za-z0-9_-]+$/, 'URL-safe characters only');
    assert.deepEqual(decodeSong(code), song, `seed ${seed}`);
  }
});

test('JSON round-trips the same 500 seeded random songs exactly', () => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const song = randomSong(seed);
    assert.deepEqual(songFromJSON(songToJSON(song)), song, `seed ${seed}`);
  }
});

test('the share encoding is standard base64url of a compact byte layout', () => {
  const code = encodeSong(randomSong(7));
  assert.equal(codeOf(bytesOf(code)), code, 'matches Node base64url, no padding');
});

test('share strings are compact: empty slots are left out', () => {
  const empty = createSong();
  assert.equal(encodeSong(empty).length, 20);

  const one = createSong();
  one.patterns.A = TRACK_IDS.map(() => new Array(STEPS).fill(3));
  assert.equal(encodeSong(one).length, 63);

  const full = createSong();
  for (const id of PATTERN_IDS) full.patterns[id] = TRACK_IDS.map(() => new Array(STEPS).fill(2));
  full.chain = new Array(16).fill('D');
  assert.ok(encodeSong(full).length <= 200);
});

test('decodeSong rejects malformed and out-of-range share strings', () => {
  const code = encodeSong(randomSong(11));
  const bytes = bytesOf(code);
  const tampered = (offset, value) => {
    const copy = bytes.slice();
    copy[offset] = value;
    return decodeSong(codeOf(copy));
  };
  assert.equal(decodeSong(''), null);
  assert.equal(decodeSong('A'), null, 'a lone trailing character cannot hold a byte');
  assert.equal(decodeSong('not base64!'), null);
  assert.equal(decodeSong(code.slice(0, -4)), null, 'truncated');
  assert.equal(decodeSong(`${code}AAAA`), null, 'trailing bytes');
  assert.equal(decodeSong(undefined), null);
  assert.equal(tampered(0, 2), null, 'unknown format version');
  assert.equal(tampered(1, 141), null, 'tempo above 200 BPM');
  assert.equal(tampered(2, 61), null, 'swing above 60%');
  assert.equal(tampered(6, 101), null, 'volume above 100');

  const longChain = new Uint8Array(15 + 5);
  longChain[0] = 1;
  longChain[14] = 17;
  assert.equal(decodeSong(codeOf(longChain)), null, 'chain longer than 16 bars');
  longChain[14] = 16;
  assert.equal(decodeSong(codeOf(longChain.slice(0, 19))).chain.length, 16);
});

test('decodeSong never throws on random text and only returns valid songs', () => {
  const rng = createRng(99);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_!/+=%#';
  for (let i = 0; i < 3000; i += 1) {
    const length = randomInt(rng, 0, 90);
    const text = Array.from({ length }, () => alphabet[randomInt(rng, 0, alphabet.length - 1)]).join('');
    const song = decodeSong(text);
    assert.ok(song === null || isValidSong(song), text);
  }
});

test('songToJSON writes readable rows', () => {
  const song = createSong();
  song.patterns.A[0] = [3, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0];
  const data = JSON.parse(songToJSON(song));
  assert.equal(data.patterns.A.kick, '3...2...3...1...');
  assert.deepEqual(data.tracks[0], { id: 'kick', volume: 80, mute: false, solo: false });
});

test('songFromJSON fills missing fields with defaults', () => {
  const minimal = JSON.stringify({ format: 'drum-machine-song', version: 1 });
  assert.deepEqual(songFromJSON(minimal), createSong());

  const partial = JSON.stringify({
    format: 'drum-machine-song',
    version: 1,
    bpm: 98,
    tracks: [{ id: 'snare', volume: 30 }],
    patterns: { B: { kick: '3...............' } },
  });
  const song = songFromJSON(partial);
  assert.equal(song.bpm, 98);
  assert.deepEqual(song.channels[1], { volume: 30, mute: false, solo: false });
  assert.equal(song.patterns.B[0][0], 3);
  assert.equal(song.patterns.B[1].join(''), '0'.repeat(16));
});

test('songFromJSON rejects broken or invalid files', () => {
  const base = { format: 'drum-machine-song', version: 1 };
  const variant = (extra) => songFromJSON(JSON.stringify({ ...base, ...extra }));
  assert.equal(songFromJSON('{'), null, 'not JSON');
  assert.equal(songFromJSON('null'), null);
  assert.equal(songFromJSON('[]'), null);
  assert.equal(songFromJSON(JSON.stringify({ format: 'other', version: 1 })), null);
  assert.equal(variant({ version: 2 }), null);
  assert.equal(variant({ bpm: 300 }), null);
  assert.equal(variant({ bpm: '120' }), null);
  assert.equal(variant({ swing: 12.5 }), null);
  assert.equal(variant({ current: 'E' }), null);
  assert.equal(variant({ chain: ['A', 'Z'] }), null);
  assert.equal(variant({ chain: new Array(17).fill('A') }), null);
  assert.equal(variant({ tracks: [{ id: 'kick', mute: 'yes' }] }), null);
  assert.equal(variant({ patterns: { A: { kick: '3...x...........' } } }), null);
  assert.equal(variant({ patterns: { A: { kick: '3...' } } }), null);
  assert.equal(variant({ patterns: { A: 'kick' } }), null);
});
