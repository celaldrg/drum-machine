import { STEPS } from './constants.js';

/**
 * Lookahead scheduling, independent of WebAudio. A timer calls
 * scheduleWindow() every few milliseconds with the audio clock's current time;
 * it books every step that starts before now + lookahead, with its exact
 * time. A cursor (nextStep) makes sure each step is booked once and only once,
 * however irregular the timer is. All times are in seconds.
 */

/** How far ahead (s) each scheduler call books steps. */
export const LOOKAHEAD_SECONDS = 0.1;

/** Suggested period (ms) of the timer that calls the scheduler; well below the lookahead so windows overlap. */
export const TIMER_INTERVAL_MS = 25;

/** Gap (s) between pressing Play and the first step, so the first step can still be booked on time. */
export const START_DELAY_SECONDS = 0.05;

/**
 * When the next step is overdue by more than this (s), for example after the
 * tab was frozen, the transport jumps to the present instead of firing a burst
 * of stale steps.
 */
export const MAX_LATE_SECONDS = 1;

/**
 * Playback position and timing. Step times are measured from an anchor so
 * that tempo changes never shift steps that are already booked.
 * @typedef {object} Transport
 * @property {boolean} playing
 * @property {number} bpm
 * @property {number} swing 0..60 percent
 * @property {number} anchorStep absolute step whose unswung time is anchorTime
 * @property {number} anchorTime seconds
 * @property {number} nextStep first absolute step not booked yet
 */

/**
 * One booked step.
 * @typedef {object} StepEvent
 * @property {number} index absolute step number since Play (0, 1, 2, ...)
 * @property {number} step position in the bar, 0..15
 * @property {number} bar bar number since Play
 * @property {number} time exact start time in seconds, swing included
 * @property {boolean} late true when that time had already passed at booking
 */

/**
 * Length of one 1/16 step: a beat (quarter note) lasts 60 / bpm seconds and holds four steps.
 * @param {number} bpm
 * @returns {number} seconds
 */
export function stepDuration(bpm) {
  return 60 / bpm / 4;
}

/**
 * Swing delay of a step: every second 1/16 step (odd index) is pushed back by
 * `swing` percent of a step; even steps stay on the grid.
 * @param {number} index step index (absolute or within the bar; a bar has an even number of steps)
 * @param {number} bpm
 * @param {number} swing 0..60 percent
 * @returns {number} seconds
 */
export function swingDelay(index, bpm, swing) {
  return index % 2 === 1 ? (swing / 100) * stepDuration(bpm) : 0;
}

/**
 * Creates a stopped transport.
 * @param {number} bpm
 * @param {number} swing 0..60 percent
 * @returns {Transport}
 */
export function createTransport(bpm, swing) {
  return { playing: false, bpm, swing, anchorStep: 0, anchorTime: 0, nextStep: 0 };
}

/**
 * Starts playback: step 0 sounds at startTime.
 * @param {Transport} transport
 * @param {number} startTime seconds on the scheduling clock
 * @returns {Transport}
 */
export function startTransport(transport, startTime) {
  return { ...transport, playing: true, anchorStep: 0, anchorTime: startTime, nextStep: 0 };
}

/**
 * Stops playback.
 * @param {Transport} transport
 * @returns {Transport}
 */
export function stopTransport(transport) {
  return { ...transport, playing: false };
}

/**
 * Changes the tempo. While playing, the grid is re-anchored at the next
 * unbooked step, so booked steps keep their times and the beat goes on
 * without a jump.
 * @param {Transport} transport
 * @param {number} bpm
 * @returns {Transport}
 */
export function setTransportTempo(transport, bpm) {
  if (bpm === transport.bpm) return transport;
  if (!transport.playing) return { ...transport, bpm };
  const anchorTime = gridTime(transport, transport.nextStep);
  return { ...transport, bpm, anchorStep: transport.nextStep, anchorTime };
}

/**
 * Changes the swing amount; it applies to steps booked from now on.
 * @param {Transport} transport
 * @param {number} swing 0..60 percent
 * @returns {Transport}
 */
export function setTransportSwing(transport, swing) {
  return swing === transport.swing ? transport : { ...transport, swing };
}

/**
 * Exact start time of an absolute step under the current tempo and swing.
 * @param {Transport} transport
 * @param {number} index absolute step number
 * @returns {number} seconds
 */
export function stepTime(transport, index) {
  return gridTime(transport, index) + swingDelay(index, transport.bpm, transport.swing);
}

function gridTime(transport, index) {
  return transport.anchorTime + (index - transport.anchorStep) * stepDuration(transport.bpm);
}

/**
 * Books every step that starts before now + lookahead (classic lookahead
 * scheduling). Steps are booked strictly in order, each exactly once. A step
 * whose time has already passed is still returned, flagged `late`, unless the
 * transport is more than MAX_LATE_SECONDS behind: then it skips ahead to the
 * first step that is not yet due.
 * @param {Transport} transport
 * @param {number} now current time in seconds (the audio clock)
 * @param {number} [lookahead] seconds
 * @returns {{ transport: Transport, events: StepEvent[] }} the updated transport and the booked steps
 */
export function scheduleWindow(transport, now, lookahead = LOOKAHEAD_SECONDS) {
  if (!transport.playing) return { transport, events: [] };
  const current = catchUp(transport, now);
  const horizon = now + lookahead;
  const events = [];
  let index = current.nextStep;
  let time = stepTime(current, index);
  while (time < horizon) {
    events.push({ index, step: index % STEPS, bar: Math.floor(index / STEPS), time, late: time < now });
    index += 1;
    time = stepTime(current, index);
  }
  return { transport: { ...current, nextStep: index }, events };
}

function catchUp(transport, now) {
  if (stepTime(transport, transport.nextStep) >= now - MAX_LATE_SECONDS) return transport;
  const stepsSinceAnchor = Math.ceil((now - transport.anchorTime) / stepDuration(transport.bpm));
  let index = transport.anchorStep + stepsSinceAnchor;
  if (stepTime(transport, index - 1) >= now) index -= 1;
  return { ...transport, nextStep: index };
}
