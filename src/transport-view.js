import { isEmptyPattern } from './pattern.js';
import { setAttr, setText, setPressed, setRange } from './dom.js';

/**
 * @typedef {object} TransportElements
 * @property {HTMLButtonElement} play
 * @property {HTMLElement} playLabel
 * @property {HTMLInputElement} tempo range input
 * @property {HTMLInputElement} tempoNumber number input
 * @property {HTMLInputElement} swing range input
 * @property {HTMLInputElement} swingNumber number input
 * @property {HTMLButtonElement[]} patternButtons buttons with data-pattern="A".."D"
 * @property {HTMLElement} patternBadge letter of the selected pattern above the grid
 */

/**
 * Shows the transport: Play/Stop, tempo, swing and the pattern buttons
 * (selected, holding notes, sounding). Cheap enough to run on every frame.
 * @param {TransportElements} ui
 * @param {import('./machine.js').MachineState} state
 * @param {(key: string, params?: object) => string} t translator
 */
export function renderTransport(ui, state, t) {
  ui.play.classList.toggle('is-playing', state.playing);
  setText(ui.playLabel, t(state.playing ? 'stop' : 'play'));
  setRange(ui.tempo, state.bpm);
  setNumber(ui.tempoNumber, state.bpm);
  setRange(ui.swing, state.swing);
  setNumber(ui.swingNumber, state.swing);
  ui.patternButtons.forEach((button) => {
    const id = button.dataset.pattern;
    setPressed(button, id === state.current);
    setAttr(button, 'aria-label', t('patternButton', { id }));
    button.classList.toggle('has-notes', !isEmptyPattern(state.patterns[id]));
    button.classList.toggle('is-playing', state.playing && state.playingPattern === id);
  });
  setText(ui.patternBadge, state.current);
}

/** Updates a number field unless the user is typing in it. */
function setNumber(input, value) {
  if (document.activeElement !== input && input.valueAsNumber !== value) input.value = String(value);
}
