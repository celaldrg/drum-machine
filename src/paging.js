/**
 * Paging of the step grid on narrow screens, where one page of 8 steps is
 * visible at a time, kept free of the DOM.
 */

/** Steps per page on narrow screens (style.css shows two beats per page). */
export const PAGE_STEPS = 8;

/** How long (ms) the page stays put after the user picks a page or touches the grid. */
export const FOLLOW_HOLD_MS = 3000;

/**
 * The page that holds a step.
 * @param {number} step 0..15
 * @returns {number} 0 or 1
 */
export function pageOf(step) {
  return Math.floor(step / PAGE_STEPS);
}

/**
 * Turns the visible page along with the playhead: when the playhead moves
 * onto the other page, that page is shown, unless the user holds the page
 * (picked it or touched the grid) until `heldUntil`. A page held past that
 * time turns with the playhead's next page change.
 * @param {{ page: number, cursor: number, previous: number, now: number, heldUntil: number }} view
 *   page: the visible page; cursor and previous: the playhead step now and at
 *   the last render (-1 when stopped); now and heldUntil: times in ms
 * @returns {number} the page to show
 */
export function followPage({ page, cursor, previous, now, heldUntil }) {
  if (cursor < 0 || now < heldUntil) return page;
  const target = pageOf(cursor);
  const turned = previous < 0 || pageOf(previous) !== target;
  return turned ? target : page;
}
