import { TRACK_IDS, PATTERN_IDS } from './constants.js';

/**
 * Keyboard shortcuts as pure data, so they can be tested without a browser.
 * @typedef {{ type: 'toggle-play' }
 *   | { type: 'preview', track: number }
 *   | { type: 'pattern', id: string }
 *   | { type: 'move', tracks: number, steps: number }
 *   | { type: 'erase' }} KeyAction
 */

/** Arrow keys on a pad move the focus by [tracks, steps]. */
const ARROWS = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * Maps a key press to an app action.
 * Space plays or stops; 1–8 preview the tracks; A–D select a pattern; on a
 * focused pad the arrows move between pads and Delete/Backspace erase it.
 * Keys typed into a form field and keys with Ctrl, Alt or Meta are left alone.
 * @param {{ key: string, ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean }} event
 * @param {'pad' | 'field' | 'other'} target what had the focus: a step pad, a text-like form field, or anything else
 * @returns {KeyAction | null}
 */
export function keyAction(event, target) {
  if (target === 'field' || event.ctrlKey || event.altKey || event.metaKey) return null;
  const { key } = event;
  if (key === ' ') return { type: 'toggle-play' };
  if (target === 'pad') {
    if (Object.hasOwn(ARROWS, key)) {
      const [tracks, steps] = ARROWS[key];
      return { type: 'move', tracks, steps };
    }
    if (key === 'Delete' || key === 'Backspace') return { type: 'erase' };
  }
  const track = Number(key) - 1;
  if (key.length === 1 && Number.isInteger(track) && track >= 0 && track < TRACK_IDS.length) {
    return { type: 'preview', track };
  }
  const id = key.toUpperCase();
  if (key.length === 1 && PATTERN_IDS.includes(id)) return { type: 'pattern', id };
  return null;
}
