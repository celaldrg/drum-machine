import { LOOKAHEAD_SECONDS, TIMER_INTERVAL_MS } from './scheduler.js';

/**
 * Playback loop: a timer books the machine's steps a little ahead on the
 * audio clock (lookahead scheduling) and an animation frame loop moves the
 * step indicator.
 */

/**
 * Lookahead (s) while the tab is hidden: browsers then run timers about once
 * a second, so steps are booked further ahead to keep the beat going.
 */
const HIDDEN_LOOKAHEAD_SECONDS = 1.5;

/** Hits booked more than this late (s), e.g. after a stalled tab, are skipped instead of piling up. */
const LATE_TOLERANCE_SECONDS = 0.03;

/**
 * Connects a machine (machine.js) to the audio engine (audio.js).
 * @param {{ machine: ReturnType<import('./machine.js').createMachine>,
 *   engine: ReturnType<import('./audio.js').createAudioEngine>, onFrame: () => void }} parts
 *   onFrame runs once per animation frame while playing, and once after Stop
 * @returns {{ start(): boolean, stop(): void }} start returns false when audio is unavailable
 */
export function createPlayer({ machine, engine, onFrame }) {
  let timer = 0;
  let frame = 0;

  function tick() {
    const now = engine.currentTime();
    const lookahead = document.hidden ? HIDDEN_LOOKAHEAD_SECONDS : LOOKAHEAD_SECONDS;
    for (const event of machine.schedule(now, lookahead)) {
      if (event.late && now - event.time > LATE_TOLERANCE_SECONDS) continue;
      event.hits.forEach((hit) => engine.playHit(hit.id, hit.gain, event.time));
    }
    // Also moves the indicator here, so booked steps never pile up while frames are paused.
    machine.updateCursor(engine.audibleTime());
  }

  function animate() {
    machine.updateCursor(engine.audibleTime());
    onFrame();
    frame = requestAnimationFrame(animate);
  }

  return {
    start() {
      if (!engine.unlock()) return false;
      machine.play(engine.currentTime());
      tick();
      clearInterval(timer);
      timer = setInterval(tick, TIMER_INTERVAL_MS);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(animate);
      return true;
    },

    stop() {
      clearInterval(timer);
      cancelAnimationFrame(frame);
      machine.stop();
      engine.silenceAfter(engine.currentTime());
      onFrame();
    },
  };
}
