/**
 * Long-press detection for touch screens, kept free of the DOM. The app
 * erases a pad with it, because iOS Safari fires no contextmenu event on a
 * long press.
 */

/** How long (ms) a touch must rest on a pad to count as a long press. */
export const LONG_PRESS_MS = 500;

/** How far (px) a resting touch may drift; further, and it is a scroll or a drag. */
export const LONG_PRESS_SLOP_PX = 10;

/**
 * Creates a long-press detector for one pointer at a time. Feed it the
 * pointer events: start() on pointerdown, move() on pointermove, end() on
 * pointerup and pointercancel.
 * @template T
 * @param {(target: T) => void} onLongPress runs once the press has rested for `delayMs`
 * @param {{ delayMs?: number, slopPx?: number, timers?: { setTimeout: Function, clearTimeout: Function } }} [options]
 *   timers: setTimeout and clearTimeout to use (a fake clock in tests)
 * @returns {{
 *   start(pointerId: number, x: number, y: number, target: T): void,
 *   move(pointerId: number, x: number, y: number): void,
 *   end(pointerId: number): void,
 * }}
 */
export function createLongPress(onLongPress, { delayMs = LONG_PRESS_MS, slopPx = LONG_PRESS_SLOP_PX, timers = globalThis } = {}) {
  /** The press being timed: { pointerId, x, y, timer }, or null. */
  let press = null;

  function cancel() {
    if (press) timers.clearTimeout(press.timer);
    press = null;
  }

  return {
    /** Starts timing a press; a press still being timed is dropped. */
    start(pointerId, x, y, target) {
      cancel();
      const timer = timers.setTimeout(() => {
        press = null;
        onLongPress(target);
      }, delayMs);
      press = { pointerId, x, y, timer };
    },

    /** Drops the press when its pointer drifts further than `slopPx`. */
    move(pointerId, x, y) {
      if (press?.pointerId === pointerId && Math.hypot(x - press.x, y - press.y) > slopPx) cancel();
    },

    /** Drops the press when its pointer is lifted or cancelled. */
    end(pointerId) {
      if (press?.pointerId === pointerId) cancel();
    },
  };
}
