import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMachine, createDemoMachine } from '../src/machine.js';
import { START_DELAY_SECONDS, TIMER_INTERVAL_MS } from '../src/scheduler.js';
import { PATTERN_IDS, TRACK_IDS } from '../src/constants.js';
import { patternFromRows } from '../src/pattern.js';
import { findDemo, DEMO_CURSOR } from '../src/demos.js';

/** Seconds per bar at the default 120 BPM. */
const BAR = 2;
const EPSILON = 1e-9;

/** Calls schedule() like the UI timer does, every 25 ms from `from` to `to` seconds, and collects the booked steps. */
function run(machine, from, to) {
  const tick = TIMER_INTERVAL_MS / 1000;
  const events = [];
  for (let i = 0; from + i * tick <= to; i += 1) events.push(...machine.schedule(from + i * tick));
  return events;
}

/** The song part of a state snapshot (without playback details). */
function songOf(state) {
  const { bpm, swing, patterns, current, chain, chainOn, channels } = state;
  return { bpm, swing, patterns, current, chain, chainOn, channels };
}

function assertContiguous(events) {
  events.forEach((event, i) => assert.equal(event.index, events[0].index + i, 'no step skipped or repeated'));
}

test('the song chain plays its slots in order, one bar each, and loops', () => {
  const machine = createMachine();
  PATTERN_IDS.forEach((id, slot) => {
    machine.selectPattern(id);
    machine.setStep(0, slot, 3); // a kick on step `slot` marks the slot
  });
  machine.selectPattern('A');
  const chain = ['A', 'C', 'B', 'C', 'D'];
  machine.setChain(chain);
  machine.setChainOn(true);
  machine.play(0);
  const events = run(machine, 0, 12 * BAR);
  assertContiguous(events);
  const barSlots = events.filter((event) => event.step === 0).map((event) => event.patternId);
  assert.deepEqual(barSlots.slice(0, 12), [...'ACBCDACBCDAC']);
  for (const event of events) {
    assert.equal(event.chainIndex, event.bar % chain.length);
    assert.equal(event.patternId, chain[event.bar % chain.length]);
    const kick = event.hits.some((hit) => hit.id === 'kick');
    assert.equal(kick, event.step === PATTERN_IDS.indexOf(event.patternId), `bar ${event.bar}, step ${event.step}`);
  }
  machine.updateCursor(START_DELAY_SECONDS + BAR);
  const state = machine.getState();
  assert.equal(state.playingPattern, 'C', 'the play head is in bar 2 of the chain');
  assert.equal(state.playingChainIndex, 1);
});

test('with the chain off, a newly selected slot starts playing at the next bar', () => {
  const machine = createMachine();
  machine.play(0);
  const before = machine.schedule(0, 1);
  assert.deepEqual(
    before.map((event) => event.index),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  machine.selectPattern('B');
  const after = machine.schedule(1, 1.5);
  assert.deepEqual(
    after.map((event) => `${event.index}${event.patternId}`),
    ['8A', '9A', '10A', '11A', '12A', '13A', '14A', '15A', '16B', '17B', '18B', '19B'],
  );
  assert.ok(before.every((event) => event.patternId === 'A' && event.chainIndex === -1));
});

test('turning the chain on mid-bar starts it from its first slot at the next bar', () => {
  const machine = createMachine();
  machine.setChain(['C', 'D']);
  machine.play(0);
  machine.schedule(0, 1);
  machine.setChainOn(true);
  const slotOfBar = new Map(run(machine, 1, 4 * BAR).map((event) => [event.bar, event.patternId]));
  assert.deepEqual([0, 1, 2, 3].map((bar) => slotOfBar.get(bar)), ['A', 'C', 'D', 'C']);

  machine.setChainOn(false);
  machine.selectPattern('B');
  const later = run(machine, 4 * BAR + 0.025, 6 * BAR);
  assert.equal(later.at(-1).patternId, 'B', 'chain off: back to the selected slot');
});

test('an empty chain plays the selected slot', () => {
  const machine = createMachine();
  machine.selectPattern('D');
  machine.setChainOn(true);
  machine.play(0);
  assert.ok(run(machine, 0, 3 * BAR).every((event) => event.patternId === 'D' && event.chainIndex === -1));
});

test('setChain keeps only known slots and at most 16 bars', () => {
  const machine = createMachine();
  assert.deepEqual(machine.setChain(['A', 'X', 'b', 'D', 7]), ['A', 'D']);
  assert.equal(machine.setChain(new Array(20).fill('B')).length, 16);
  assert.deepEqual(machine.setChain('ABC'), []);
  assert.deepEqual(machine.getState().chain, []);
});

test('muted tracks and tracks outside the solo group are left out of scheduled hits', () => {
  const machine = createMachine();
  TRACK_IDS.forEach((_, track) => machine.setStep(track, 0, 3));
  const firstHits = () => {
    machine.stop();
    machine.play(0);
    return machine.schedule(0)[0].hits.map((hit) => hit.id);
  };
  assert.deepEqual(firstHits(), [...TRACK_IDS]);
  assert.equal(machine.toggleMute(1), true);
  assert.deepEqual(firstHits(), TRACK_IDS.filter((id) => id !== 'snare'));
  machine.toggleSolo(3);
  machine.toggleSolo(5);
  assert.deepEqual(firstHits(), ['ohh', 'ltom']);
  machine.toggleMute(3);
  assert.deepEqual(firstHits(), ['ltom'], 'mute wins over solo');
  assert.deepEqual(machine.getState().audible, [false, false, false, false, false, true, false, false]);
  assert.equal(machine.toggleSolo(5), false);
  assert.equal(machine.toggleSolo(3), false);
  assert.deepEqual(firstHits(), ['kick', 'chh', 'clap', 'ltom', 'htom', 'rim'], 'no solo left: all unmuted tracks');
});

test('hits carry velocity and the volume-scaled gain', () => {
  const machine = createMachine();
  machine.setStep(0, 0, 3);
  machine.setStep(1, 0, 1);
  machine.setVolume(0, 100);
  machine.setVolume(1, 50);
  machine.setVolume(2, 0);
  machine.setStep(2, 0, 3);
  machine.play(0);
  const [first] = machine.schedule(0);
  assert.deepEqual(first.hits, [
    { track: 0, id: 'kick', velocity: 3, gain: 1 },
    { track: 1, id: 'snare', velocity: 1, gain: 0.1 },
  ]);
  assert.ok(Math.abs(first.time - START_DELAY_SECONDS) < EPSILON);
});

test('tapping a pad cycles its velocity in the selected slot only', () => {
  const machine = createMachine();
  machine.selectPattern('C');
  assert.deepEqual([1, 2, 3, 4].map(() => machine.toggleStep(2, 5)), [2, 3, 1, 0]);
  machine.toggleStep(2, 5);
  const state = machine.getState();
  assert.equal(state.patterns.C[2][5], 2);
  assert.ok(['A', 'B', 'D'].every((id) => state.patterns[id].flat().every((v) => v === 0)));
});

test('setStep and clearPattern edit the selected slot', () => {
  const machine = createMachine();
  machine.setStep(4, 9, 3);
  machine.selectPattern('B');
  machine.setStep(4, 9, 1);
  machine.clearPattern();
  const state = machine.getState();
  assert.equal(state.patterns.A[4][9], 3);
  assert.equal(state.patterns.B[4][9], 0);
});

test('newSong resets every slot, the mixer, the chain and the tempo, and keeps playing in time', () => {
  const machine = createDemoMachine();
  machine.toggleMute(2);
  machine.setChainOn(true);
  machine.play(0);
  const first = run(machine, 0, 1);
  machine.newSong();
  assert.deepEqual(songOf(machine.getState()), songOf(createMachine().getState()));
  const second = run(machine, 1.025, 3);
  assertContiguous([...first, ...second]);
  assert.ok(second.every((event) => event.hits.length === 0 && event.patternId === 'A'));
  assert.ok(Math.abs(second[2].time - second[0].time - 0.25) < EPSILON, 'steps follow the default 120 BPM');
});

test('invalid tracks, steps and velocities throw a RangeError', () => {
  const machine = createMachine();
  assert.throws(() => machine.toggleStep(8, 0), RangeError);
  assert.throws(() => machine.toggleStep(-1, 0), RangeError);
  assert.throws(() => machine.toggleStep(0, 16), RangeError);
  assert.throws(() => machine.toggleStep(0, 1.5), RangeError);
  assert.throws(() => machine.setStep(0, 0, 4), RangeError);
  assert.throws(() => machine.toggleMute(9), RangeError);
  assert.equal(machine.selectPattern('E'), false);
  assert.equal(machine.getState().current, 'A');
});

test('tempo, swing and volume are rounded and clamped; non-numbers keep the old value', () => {
  const machine = createMachine();
  assert.equal(machine.setTempo(500), 200);
  assert.equal(machine.setTempo(10), 60);
  assert.equal(machine.setTempo('95.6'), 96);
  assert.equal(machine.setTempo('abc'), 96);
  assert.equal(machine.setSwing(75), 60);
  assert.equal(machine.setSwing(-5), 0);
  assert.equal(machine.setSwing('22'), 22);
  assert.equal(machine.setVolume(0, 150), 100);
  assert.equal(machine.setVolume(0, ''), 100);
  const state = machine.getState();
  assert.equal(state.bpm, 96);
  assert.equal(state.swing, 22);
});

test('a tempo change while playing continues the beat without a jump', () => {
  const machine = createMachine();
  machine.play(0);
  const first = run(machine, 0, 1);
  assert.equal(first.at(-1).index, 8);
  machine.setTempo(60);
  const second = run(machine, 1.025, 3);
  assertContiguous([...first, ...second]);
  assert.ok(Math.abs(second[0].time - (START_DELAY_SECONDS + 9 * 0.125)) < EPSILON, 'the next step keeps its slot');
  assert.ok(Math.abs(second[1].time - second[0].time - 0.25) < EPSILON, 'then 60 BPM steps');
});

test('randomize is deterministic for a seed and fills only the selected slot', () => {
  const a = createMachine({ seed: 7 });
  const b = createMachine({ seed: 7 });
  const c = createMachine({ seed: 8 });
  [a, b, c].forEach((machine) => machine.randomize());
  const first = a.getState().patterns.A;
  assert.deepEqual(b.getState().patterns.A, first);
  assert.notDeepEqual(c.getState().patterns.A, first);
  assert.ok(first.flat().some((v) => v > 0));
  a.randomize();
  assert.notDeepEqual(a.getState().patterns.A, first, 'each press gives a new groove');
  assert.ok(a.getState().patterns.B.flat().every((v) => v === 0));
});

test('loadDemo puts a groove in the selected slot with its tempo and swing', () => {
  const machine = createMachine();
  machine.selectPattern('B');
  assert.equal(machine.loadDemo('hiphop'), true);
  const state = machine.getState();
  assert.equal(state.bpm, 90);
  assert.equal(state.swing, 30);
  assert.deepEqual(state.patterns.B, patternFromRows(findDemo('hiphop').rows));
  assert.ok(state.patterns.A.flat().every((v) => v === 0));
  assert.equal(machine.loadDemo('polka'), false);
});

test('the step cursor follows the clock and resets on stop', () => {
  const machine = createMachine();
  assert.equal(machine.getState().cursor, -1);
  machine.play(0);
  machine.schedule(0);
  assert.equal(machine.updateCursor(0.04), -1, 'step 0 sounds at 0.05 s');
  assert.equal(machine.updateCursor(0.05), 0);
  machine.schedule(0.1);
  assert.equal(machine.updateCursor(0.17), 0);
  assert.equal(machine.updateCursor(0.2), 1);
  let state = machine.getState();
  assert.equal(state.playing, true);
  assert.equal(state.cursor, 1);
  assert.equal(state.playingPattern, 'A');
  assert.equal(state.playingChainIndex, -1);
  machine.stop();
  state = machine.getState();
  assert.equal(state.playing, false);
  assert.equal(state.cursor, -1);
  assert.equal(state.playingPattern, null);
  assert.deepEqual(machine.schedule(1), []);
});

test('play is ignored while already playing', () => {
  const machine = createMachine();
  machine.play(0);
  machine.schedule(0, 0.5);
  machine.play(10);
  assert.deepEqual(
    machine.schedule(0.5, 0.1).map((event) => event.index),
    [4],
  );
});

test('share links and JSON files restore the song; bad input changes nothing', () => {
  const demo = createDemoMachine();
  const viaLink = createMachine();
  assert.equal(viaLink.importShare(demo.exportShare()), true);
  assert.deepEqual(songOf(viaLink.getState()), songOf(demo.getState()));
  const before = viaLink.getState();
  assert.equal(viaLink.importShare('%%%'), false);
  assert.equal(viaLink.importJSON('{"format":"other"}'), false);
  assert.deepEqual(viaLink.getState(), before);

  const viaFile = createMachine();
  assert.equal(viaFile.importJSON(demo.exportJSON()), true);
  assert.deepEqual(songOf(viaFile.getState()), songOf(demo.getState()));
});

test('importing a song while playing adopts its tempo without repeating steps', () => {
  const machine = createMachine();
  machine.play(0);
  const first = run(machine, 0, 1);
  assert.equal(machine.importShare(createDemoMachine().exportShare()), true);
  const second = run(machine, 1.025, 3);
  assertContiguous([...first, ...second]);
  const step = 60 / 124 / 4;
  assert.ok(Math.abs(second[3].time - second[1].time - 2 * step) < EPSILON, 'steps follow 124 BPM');
});

test('the ?demo state is a filled house groove with the step cursor mid-bar', () => {
  const state = createDemoMachine().getState();
  assert.equal(state.current, 'A');
  assert.deepEqual(state.patterns.A, patternFromRows(findDemo('house').rows));
  assert.equal(state.bpm, 124);
  assert.equal(state.cursor, DEMO_CURSOR);
  assert.ok(state.cursor >= 4 && state.cursor <= 11, 'mid-bar');
  assert.equal(state.playingPattern, 'A');
  assert.equal(state.playing, false);
  assert.ok(state.patterns.A.every((row) => row.some((v) => v > 0)), 'every track plays');
  assert.ok(state.patterns.A.flat().filter((v) => v > 0).length >= 24, 'well filled');
  assert.ok(PATTERN_IDS.every((id) => state.patterns[id].flat().some((v) => v > 0)), 'all four slots hold a groove');
  assert.deepEqual(createDemoMachine().getState(), state, 'deterministic');
});

test('getState returns a copy and the starting song is copied too', () => {
  const song = createDemoMachine().getState();
  const machine = createMachine({ song: songOf(song) });
  song.patterns.A[0][0] = 0;
  const state = machine.getState();
  state.patterns.A[0][1] = 3;
  state.channels[0].mute = true;
  state.chain.push('D');
  const fresh = machine.getState();
  assert.equal(fresh.patterns.A[0][0], 3);
  assert.equal(fresh.patterns.A[0][1], 0);
  assert.equal(fresh.channels[0].mute, false);
  assert.deepEqual(fresh.chain, ['A', 'A', 'B', 'A']);
});
