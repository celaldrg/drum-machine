import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VOICES, resolveVoice } from '../src/voices.js';
import { TRACK_IDS } from '../src/constants.js';

const OSCILLATORS = ['sine', 'triangle', 'square'];
const FILTERS = ['highpass', 'bandpass', 'lowpass'];

function assertValidLayer(layer, label) {
  assert.ok([...OSCILLATORS, 'noise'].includes(layer.source), `${label}: source`);
  assert.ok(layer.attack >= 0 && layer.attack < 0.05, `${label}: attack`);
  assert.ok(layer.decay > 0 && layer.decay <= 1, `${label}: decay`);
  assert.ok(layer.level > 0 && layer.level <= 1, `${label}: level`);
  if (layer.source === 'noise') {
    assert.ok(layer.filter, `${label}: noise is always filtered`);
  } else {
    assert.ok(layer.freq > 20 && layer.freq < 20000, `${label}: freq`);
  }
  if (layer.freqEnd !== undefined) {
    assert.ok(layer.freqEnd > 20 && layer.freqEnd < layer.freq, `${label}: pitch glides down`);
    assert.ok(layer.sweep > 0, `${label}: sweep`);
  }
  if (layer.filter) {
    assert.ok(FILTERS.includes(layer.filter.type), `${label}: filter type`);
    assert.ok(layer.filter.freq > 20 && layer.filter.freq < 20000, `${label}: filter freq`);
    assert.ok(layer.filter.q > 0, `${label}: filter q`);
  }
  if (layer.bursts !== undefined) {
    assert.ok(Number.isInteger(layer.bursts) && layer.bursts >= 1, `${label}: bursts`);
    assert.ok(layer.burstGap > 0, `${label}: burstGap`);
  }
}

test('every track has a synthesized voice with valid parameters', () => {
  assert.deepEqual(Object.keys(VOICES).sort(), [...TRACK_IDS].sort());
  for (const id of TRACK_IDS) {
    assert.ok(VOICES[id].layers.length > 0, id);
    VOICES[id].layers.forEach((layer, i) => assertValidLayer(layer, `${id} layer ${i}`));
  }
});

test('the kick is a sine whose pitch sweeps down', () => {
  const sine = VOICES.kick.layers.find((layer) => layer.source === 'sine');
  assert.ok(sine);
  assert.ok(sine.freq >= 2 * sine.freqEnd);
  assert.ok(sine.decay >= 0.3, 'a long body');
});

test('the snare is a noise burst plus a tone', () => {
  const sources = VOICES.snare.layers.map((layer) => layer.source);
  assert.ok(sources.includes('noise'));
  assert.ok(sources.some((source) => OSCILLATORS.includes(source)));
});

test('hats are high-passed noise in one choke group, the open hat rings longer', () => {
  for (const id of ['chh', 'ohh']) {
    assert.equal(VOICES[id].choke, 'hat');
    assert.ok(VOICES[id].layers.every((layer) => layer.source === 'noise' && layer.filter.type === 'highpass'));
  }
  assert.ok(VOICES.ohh.layers[0].decay > 4 * VOICES.chh.layers[0].decay);
});

test('the clap is a few quick noise bursts and the toms are tuned low to high', () => {
  assert.ok(VOICES.clap.layers.some((layer) => layer.source === 'noise' && layer.bursts >= 2));
  assert.ok(VOICES.ltom.layers[0].freq < VOICES.htom.layers[0].freq);
});

test('resolveVoice scales levels by the hit gain and reports the ring time', () => {
  const voice = resolveVoice('clap', 0.5);
  const layer = VOICES.clap.layers[0];
  assert.equal(voice.layers[0].level, layer.level * 0.5);
  assert.ok(Math.abs(voice.duration - ((layer.bursts - 1) * layer.burstGap + layer.attack + layer.decay)) < 1e-12);
  assert.equal(voice.choke, null);
  assert.equal(resolveVoice('ohh', 1).choke, 'hat');
  for (const id of TRACK_IDS) {
    const { duration } = resolveVoice(id, 1);
    assert.ok(duration > 0.02 && duration < 1.5, `${id} rings ${duration} s`);
  }
});

test('resolveVoice returns null for silent hits and unknown tracks, and copies its data', () => {
  assert.equal(resolveVoice('kick', 0), null);
  assert.equal(resolveVoice('cowbell', 1), null);
  assert.equal(resolveVoice('toString', 1), null);
  const voice = resolveVoice('snare', 1);
  voice.layers[0].level = 0;
  voice.layers[0].filter.freq = 1;
  assert.ok(VOICES.snare.layers[0].level > 0);
  assert.ok(VOICES.snare.layers[0].filter.freq > 20);
});
