import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stepDuration,
  swingDelay,
  createTransport,
  startTransport,
  stopTransport,
  setTransportTempo,
  setTransportSwing,
  stepTime,
  scheduleWindow,
  MAX_LATE_SECONDS,
} from '../src/scheduler.js';
import { createRng } from '../src/rng.js';

const EPSILON = 1e-9;

function assertClose(actual, expected, label = '') {
  assert.ok(Math.abs(actual - expected) < EPSILON, `${label} expected ${expected}, got ${actual}`);
}

function playing(bpm, swing, startTime = 0) {
  return startTransport(createTransport(bpm, swing), startTime);
}

/** Expected time of absolute step `index` at a fixed tempo and swing. */
function expectedTime(startTime, bpm, swing, index) {
  const step = 60 / bpm / 4;
  return startTime + index * step + (index % 2 === 1 ? (swing / 100) * step : 0);
}

test('a 1/16 step lasts 0.125 s at 120 BPM (0.25 s at 60, 0.075 s at 200)', () => {
  assert.equal(stepDuration(120), 0.125);
  assert.equal(stepDuration(60), 0.25);
  assertClose(stepDuration(200), 0.075);
});

test('without swing, step n starts at n * 0.125 s at 120 BPM', () => {
  const { events } = scheduleWindow(playing(120, 0), 0, 4);
  assert.equal(events.length, 32, 'two bars fit in a 4 s window');
  events.forEach((event, n) => {
    assert.equal(event.index, n);
    assert.equal(event.step, n % 16);
    assert.equal(event.bar, Math.floor(n / 16));
    assert.equal(event.late, false);
    assertClose(event.time, n * 0.125, `step ${n}`);
  });
});

test('swing delays every second 1/16 step by swing% of a step, even steps stay on the grid', () => {
  const at50 = scheduleWindow(playing(120, 50), 0, 1).events.map((event) => event.time);
  assert.deepEqual(at50, [0, 0.1875, 0.25, 0.4375, 0.5, 0.6875, 0.75, 0.9375]);

  for (const swing of [0, 10, 25, 33, 50, 60]) {
    const delay = (swing / 100) * 0.125;
    const { events } = scheduleWindow(playing(120, swing), 0, 4);
    assert.equal(events.length, 32, 'swing never changes the bar length');
    for (const event of events) {
      const grid = event.index * 0.125;
      assertClose(event.time, event.index % 2 === 1 ? grid + delay : grid, `swing ${swing}, step ${event.index}`);
    }
  }
});

test('swing keeps each pair of steps one eighth note long at any tempo', () => {
  for (const bpm of [60, 97, 120, 200]) {
    const { events } = scheduleWindow(playing(bpm, 40, 1.5), 1.5, 3);
    for (let i = 0; i + 2 < events.length; i += 2) {
      assertClose(events[i + 2].time - events[i].time, 2 * stepDuration(bpm), `bpm ${bpm}`);
      assertClose(events[i + 1].time - events[i].time, 1.4 * stepDuration(bpm), `bpm ${bpm}`);
    }
  }
});

test('swingDelay is zero on even steps and swing% of a step on odd steps', () => {
  assert.equal(swingDelay(0, 120, 60), 0);
  assert.equal(swingDelay(14, 120, 60), 0);
  assertClose(swingDelay(1, 120, 60), 0.075);
  assertClose(swingDelay(15, 120, 20), 0.025);
  assertClose(swingDelay(3, 60, 50), 0.125);
});

test('a step exactly on the window edge is booked by the next call, never twice', () => {
  let result = scheduleWindow(playing(120, 0), 0, 0.125);
  assert.deepEqual(result.events.map((event) => event.index), [0], 'step 1 at 0.125 is outside [.., 0.125)');
  result = scheduleWindow(result.transport, 0.0625, 0.125);
  assert.deepEqual(result.events.map((event) => event.index), [1]);
  result = scheduleWindow(result.transport, 0.0625, 0.125);
  assert.deepEqual(result.events, [], 'repeating a call books nothing new');
});

test('DONE: 10,000 jittery scheduler calls book every step exactly once at its exact time', () => {
  const lookahead = 0.1;
  const start = 0.05;
  const rng = createRng(2026);
  let transport = playing(120, 30, start);
  let now = 0;
  let next = 0;
  for (let call = 0; call < 10000; call += 1) {
    now += 0.01 + rng() * 0.03; // the timer fires every 10..40 ms instead of every 25 ms
    const result = scheduleWindow(transport, now, lookahead);
    transport = result.transport;
    for (const event of result.events) {
      assert.equal(event.index, next, `call ${call}: steps are booked in order, none skipped or repeated`);
      next += 1;
      assertClose(event.time, expectedTime(start, 120, 30, event.index), `step ${event.index}`);
      assert.ok(event.time < now + lookahead, 'only steps inside the window are booked');
      assert.equal(event.late, false, 'with this jitter no step is ever late');
    }
    assert.ok(stepTime(transport, transport.nextStep) >= now + lookahead, 'nothing before the window edge is left unbooked');
  }
  assert.ok(next > 1900, `about 250 s of music were booked (${next} steps)`);
});

test('DONE: with stalls of up to 0.6 s, overdue steps are still booked once and flagged late', () => {
  const lookahead = 0.1;
  const rng = createRng(77);
  let transport = playing(120, 45);
  let now = 0;
  let next = 0;
  let lateCount = 0;
  for (let call = 0; call < 10000; call += 1) {
    now += rng() < 0.05 ? 0.1 + rng() * 0.5 : 0.005 + rng() * 0.04;
    const result = scheduleWindow(transport, now, lookahead);
    transport = result.transport;
    for (const event of result.events) {
      assert.equal(event.index, next, `call ${call}: no step skipped or repeated`);
      next += 1;
      assertClose(event.time, expectedTime(0, 120, 45, event.index), `step ${event.index}`);
      assert.equal(event.late, event.time < now);
      if (event.late) lateCount += 1;
    }
    assert.equal(transport.nextStep, next, 'the cursor waits right after the last booked step');
    assert.ok(stepTime(transport, transport.nextStep) >= now + lookahead);
  }
  assert.ok(lateCount > 0, 'the stalls produced overdue steps');
});

test('tempo and swing changes during 10,000 jittery calls never repeat, skip or reorder steps', () => {
  const lookahead = 0.1;
  const rng = createRng(4242);
  let transport = playing(120, 0);
  let now = 0;
  let next = 0;
  let lastTime = -Infinity;
  for (let call = 0; call < 10000; call += 1) {
    if (rng() < 0.01) transport = setTransportTempo(transport, 60 + Math.floor(rng() * 141));
    if (rng() < 0.01) transport = setTransportSwing(transport, Math.floor(rng() * 61));
    now += 0.01 + rng() * 0.03;
    const result = scheduleWindow(transport, now, lookahead);
    transport = result.transport;
    for (const event of result.events) {
      assert.equal(event.index, next, `call ${call}: no step skipped or repeated`);
      next += 1;
      assert.ok(event.time - lastTime > 0.029, `step ${event.index} comes after the previous one`);
      lastTime = event.time;
    }
    assert.equal(transport.nextStep, next, 'the cursor waits right after the last booked step');
    assert.ok(stepTime(transport, transport.nextStep) >= now + lookahead);
  }
});

test('a tempo change keeps booked steps and continues from the next step', () => {
  let result = scheduleWindow(playing(120, 0), 0, 0.6);
  assert.deepEqual(result.events.map((event) => event.index), [0, 1, 2, 3, 4]);
  const slower = setTransportTempo(result.transport, 60);
  assertClose(stepTime(slower, 5), 0.625, 'the next step keeps its place');
  assertClose(stepTime(slower, 6), 0.875, 'then steps are 0.25 s apart');
  result = scheduleWindow(slower, 0.6, 0.3);
  assert.deepEqual(result.events.map((event) => event.index), [5, 6]);
  assertClose(result.events[1].time, 0.875);
});

test('swing changes apply to steps booked afterwards', () => {
  let result = scheduleWindow(playing(120, 0), 0, 0.1);
  const swung = setTransportSwing(result.transport, 60);
  result = scheduleWindow(swung, 0.1, 0.2);
  assert.deepEqual(result.events.map((event) => event.index), [1, 2]);
  assertClose(result.events[0].time, 0.2);
  assertClose(result.events[1].time, 0.25);
});

test(`a transport stalled for more than ${MAX_LATE_SECONDS} s jumps ahead instead of firing a burst`, () => {
  let result = scheduleWindow(playing(120, 0), 0, 0.1);
  result = scheduleWindow(result.transport, 10.03, 0.1);
  assert.deepEqual(result.events.map((event) => event.index), [81], 'resumes at the first step not yet due (10.125 s)');
  assert.equal(result.events[0].late, false);

  let swung = scheduleWindow(playing(120, 60), 0, 0.1);
  swung = scheduleWindow(swung.transport, 10.15, 0.08);
  assert.deepEqual(swung.events.map((event) => event.index), [81], 'a swung step still due is not skipped');
  assertClose(swung.events[0].time, 10.2);
});

test('steps overdue by less than the limit are booked late, not dropped', () => {
  let result = scheduleWindow(playing(120, 0), 0, 0.1);
  result = scheduleWindow(result.transport, 0.5, 0.1);
  assert.deepEqual(
    result.events.map((event) => [event.index, event.late]),
    [
      [1, true],
      [2, true],
      [3, true],
      [4, false],
    ],
  );
});

test('a stopped transport books nothing', () => {
  assert.deepEqual(scheduleWindow(createTransport(120, 0), 5, 0.1).events, []);
  const started = scheduleWindow(playing(120, 0), 0, 0.1).transport;
  assert.deepEqual(scheduleWindow(stopTransport(started), 0.2, 0.1).events, []);
});
