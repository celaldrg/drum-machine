import { TRACK_IDS, STEPS, VOLUME_MAX } from './constants.js';
import { PAGE_STEPS, FOLLOW_HOLD_MS, pageOf, followPage } from './paging.js';
import { h, icon, setAttr, setText, setPressed, setRange } from './dom.js';

/**
 * The step grid: a row of step numbers, then one row per track with a
 * preview pad, mute, solo, volume and 16 step pads. On narrow screens CSS
 * shows one page of 8 steps at a time (data-page on the container), and
 * while playing the page turns with the playhead.
 */

const BEATS = 4;
const STEPS_PER_BEAT = STEPS / BEATS;

/** The narrow layout in style.css that shows one page at a time (keep the two in step). */
const PAGED_LAYOUT = '(max-width: 759.98px)';

/** How long (ms) a preview pad lights up after a key press. */
const FLASH_MS = 140;

/** Speaker glyph on the preview pads (24 x 24 path data). */
const SPEAKER_PATHS = ['M4 9h3l4.5-4v14L7 15H4z', 'M15 9.5a3.5 3.5 0 0 1 0 5', 'M17.8 6.8a7.4 7.4 0 0 1 0 10.4'];

/**
 * Builds the grid inside `container` and returns its render and focus methods.
 * Pads, mute, solo, preview and volume elements carry data-action, data-track
 * (and data-step) so the app can handle their events by delegation.
 * @param {HTMLElement} container
 * @param {HTMLButtonElement[]} pagerButtons buttons with data-page-button="0" | "1"
 */
export function createGridView(container, pagerButtons) {
  const numbers = [];
  const header = h('div', { className: 'grid-row grid-numbers', attrs: { 'aria-hidden': 'true' } }, [
    h('div', { className: 'cell-head' }),
    h('div', { className: 'cell-mix' }),
    buildSteps((step) => {
      const cell = h('span', { className: step % STEPS_PER_BEAT === 0 ? 'num is-beat' : 'num' }, [String(step + 1)]);
      numbers.push(cell);
      return cell;
    }),
  ]);
  const rows = TRACK_IDS.map((_, track) => buildTrack(track));
  container.append(header, ...rows.map((row) => row.element));

  const paged = window.matchMedia(PAGED_LAYOUT);
  const flashTimers = [];
  let playhead = -1;
  let page = 0;
  /** Until when (performance.now() ms) the page stays put instead of following the playhead. */
  let heldUntil = 0;
  let focus = { track: 0, step: 0 };
  rows[0].pads[0].tabIndex = 0;

  /** Roving tabindex: only the last focused pad is in the tab order; arrows move between pads. */
  function setFocusCell(track, step) {
    rows[focus.track].pads[focus.step].tabIndex = -1;
    focus = { track, step };
    rows[track].pads[step].tabIndex = 0;
  }

  function showPage(next) {
    page = next;
    container.dataset.page = String(page);
    pagerButtons.forEach((button) => setPressed(button, Number(button.dataset.pageButton) === page));
    if (pageOf(focus.step) !== page) {
      setFocusCell(focus.track, page * PAGE_STEPS + (focus.step % PAGE_STEPS));
    }
  }

  /** The user picked a page or touched the grid: the page stops following the playhead for a while. */
  function holdPage() {
    heldUntil = performance.now() + FOLLOW_HOLD_MS;
  }

  /** On narrow screens, shows the page the playhead moves onto, unless a pad has the keyboard focus. */
  function followPlayhead(cursor) {
    if (!paged.matches || keyboardOnPad()) return;
    const next = followPage({ page, cursor, previous: playhead, now: performance.now(), heldUntil });
    if (next !== page) showPage(next);
  }

  function movePlayhead(cursor) {
    if (playhead >= 0) {
      numbers[playhead].classList.remove('is-playhead');
      rows.forEach((row) => row.pads[playhead].classList.remove('is-playhead'));
    }
    if (cursor >= 0) {
      numbers[cursor].classList.add('is-playhead');
      rows.forEach((row) => row.pads[cursor].classList.add('is-playhead'));
    }
    playhead = cursor;
  }

  container.addEventListener('focusin', (event) => {
    const pad = event.target.closest('.pad');
    if (pad) setFocusCell(Number(pad.dataset.track), Number(pad.dataset.step));
  });
  container.addEventListener('pointerdown', holdPage);
  pagerButtons.forEach((button) => {
    button.addEventListener('click', () => {
      holdPage();
      showPage(Number(button.dataset.pageButton));
    });
  });
  showPage(0);

  return {
    /**
     * Shows the selected pattern, the track names and the mixer settings.
     * @param {import('./machine.js').MachineState} state
     * @param {(key: string, params?: object) => string} t translator
     */
    renderSong(state, t) {
      const pattern = state.patterns[state.current];
      rows.forEach((row, track) => {
        const name = t(`track_${TRACK_IDS[track]}`);
        renderTrackHead(row, state.channels[track], name, track, t);
        row.element.classList.toggle('is-silent', !state.audible[track]);
        row.pads.forEach((pad, step) => {
          const velocity = pattern[track][step];
          setAttr(pad, 'data-v', String(velocity));
          setPressed(pad, velocity > 0);
          setAttr(pad, 'aria-label', t('padLabel', { track: name, step: step + 1, velocity: t(`velocity${velocity}`) }));
        });
      });
    },

    /**
     * Moves the step indicator, turns the page with it on narrow screens and
     * lights the LEDs of the tracks sounding under it.
     * @param {import('./machine.js').MachineState} state
     */
    renderPlayback(state) {
      const { cursor } = state;
      if (cursor !== playhead) {
        if (state.playing) followPlayhead(cursor);
        movePlayhead(cursor);
      }
      const sounding = state.playingPattern ? state.patterns[state.playingPattern] : null;
      container.classList.toggle('is-elsewhere', sounding !== null && state.playingPattern !== state.current);
      rows.forEach((row, track) => {
        const lit = cursor >= 0 && sounding !== null && sounding[track][cursor] > 0 && state.audible[track];
        row.led.classList.toggle('is-lit', lit);
      });
      pagerButtons.forEach((button) => {
        const here = cursor >= 0 && pageOf(cursor) === Number(button.dataset.pageButton);
        button.classList.toggle('has-playhead', here);
      });
    },

    /**
     * Moves the keyboard focus from the focused pad, switching the page when needed.
     * @param {number} tracks rows to move (-1, 0, 1)
     * @param {number} steps columns to move (-1, 0, 1)
     */
    moveFocus(tracks, steps) {
      const track = clamp(focus.track + tracks, 0, TRACK_IDS.length - 1);
      const step = clamp(focus.step + steps, 0, STEPS - 1);
      setFocusCell(track, step);
      holdPage();
      showPage(pageOf(step));
      rows[track].pads[step].focus();
    },

    /**
     * Briefly lights a track's preview pad (for previews played from the keyboard).
     * @param {number} track
     */
    flash(track) {
      const { preview } = rows[track];
      preview.classList.add('is-hit');
      clearTimeout(flashTimers[track]);
      flashTimers[track] = setTimeout(() => preview.classList.remove('is-hit'), FLASH_MS);
    },
  };
}

/** Whether a step pad has the keyboard focus (a page turn would hide it). */
function keyboardOnPad() {
  const active = document.activeElement;
  return Boolean(active?.classList.contains('pad') && active.matches(':focus-visible'));
}

function buildSteps(makeCell) {
  const beats = Array.from({ length: BEATS }, (_, beat) =>
    h(
      'div',
      { className: 'beat' },
      Array.from({ length: STEPS_PER_BEAT }, (_, i) => makeCell(beat * STEPS_PER_BEAT + i)),
    ),
  );
  return h('div', { className: 'steps' }, beats);
}

function buildTrack(track) {
  const led = h('span', { className: 'led', attrs: { 'aria-hidden': 'true' } });
  const name = h('span', { className: 'track-name' });
  const pads = [];
  const steps = buildSteps((step) => {
    const pad = h('button', { type: 'button', className: 'pad', tabIndex: -1, dataset: { action: 'pad', track, step, v: 0 } });
    pads.push(pad);
    return pad;
  });
  const preview = h('button', { type: 'button', className: 'btn preview', dataset: { action: 'preview', track } }, [
    led,
    name,
    icon(SPEAKER_PATHS, 'preview-icon'),
  ]);
  const mute = h('button', { type: 'button', className: 'btn btn-small mute', dataset: { action: 'mute', track } });
  const solo = h('button', { type: 'button', className: 'btn btn-small solo', dataset: { action: 'solo', track } });
  const volume = h('input', {
    type: 'range',
    className: 'volume',
    min: '0',
    max: String(VOLUME_MAX),
    step: '1',
    dataset: { action: 'volume', track },
  });
  const element = h('div', { className: 'grid-row track', attrs: { role: 'group' } }, [
    h('div', { className: 'cell-head' }, [preview]),
    h('div', { className: 'cell-mix' }, [mute, solo, volume]),
    steps,
  ]);
  return { element, led, name, preview, mute, solo, volume, pads };
}

function renderTrackHead(row, channel, name, track, t) {
  const previewLabel = t('previewLabel', { track: name, key: track + 1 });
  setText(row.name, name);
  setAttr(row.element, 'aria-label', name);
  setAttr(row.preview, 'aria-label', previewLabel);
  setAttr(row.preview, 'title', previewLabel);
  setText(row.mute, t('mute'));
  setAttr(row.mute, 'aria-label', t('muteLabel', { track: name }));
  setPressed(row.mute, channel.mute);
  setText(row.solo, t('solo'));
  setAttr(row.solo, 'aria-label', t('soloLabel', { track: name }));
  setPressed(row.solo, channel.solo);
  setAttr(row.volume, 'aria-label', t('volumeLabel', { track: name }));
  setRange(row.volume, channel.volume);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
