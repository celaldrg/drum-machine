import { CHAIN_MAX } from './constants.js';
import { h, setAttr, setText, setPressed } from './dom.js';

/**
 * The song chain editor: one chip per bar (click cycles A→B→C→D, Delete
 * removes it), add buttons, remove-last, clear and the chain on/off toggle.
 */

/**
 * @typedef {object} ChainElements
 * @property {HTMLElement} panel
 * @property {HTMLOListElement} list chips go here, one <li> per bar
 * @property {HTMLElement} empty hint shown while the chain is empty
 * @property {HTMLElement} count
 * @property {HTMLButtonElement} toggle
 * @property {HTMLElement} toggleLabel
 * @property {HTMLButtonElement[]} addButtons buttons with data-add="A".."D"
 * @property {HTMLButtonElement} back
 * @property {HTMLButtonElement} clear
 */

/**
 * Creates the chain view.
 * @param {ChainElements} ui
 */
export function createChainView(ui) {
  const chips = () => ui.list.querySelectorAll('.chain-chip');

  return {
    /**
     * Shows the chain, its length and the on/off state.
     * @param {import('./machine.js').MachineState} state
     * @param {(key: string, params?: object) => string} t translator
     */
    renderSong(state, t) {
      const { chain } = state;
      syncChipCount(ui.list, chain.length);
      chips().forEach((chip, index) => {
        setText(chip, chain[index]);
        setAttr(chip, 'aria-label', t('chainChip', { bar: index + 1, id: chain[index] }));
      });
      ui.empty.hidden = chain.length > 0;
      setText(ui.count, t('chainCount', { count: chain.length, max: CHAIN_MAX }));
      setPressed(ui.toggle, state.chainOn);
      setText(ui.toggleLabel, t(state.chainOn ? 'chainOn' : 'chainOff'));
      ui.addButtons.forEach((button) => {
        button.disabled = chain.length >= CHAIN_MAX;
        setAttr(button, 'aria-label', t('chainAdd', { id: button.dataset.add }));
      });
      ui.back.disabled = chain.length === 0;
      ui.clear.disabled = chain.length === 0;
      ui.panel.classList.toggle('is-off', !state.chainOn);
    },

    /**
     * Highlights the bar under the play head while the chain plays.
     * @param {import('./machine.js').MachineState} state
     */
    renderPlayback(state) {
      chips().forEach((chip, index) => {
        chip.classList.toggle('is-playing', state.chainOn && index === state.playingChainIndex);
      });
    },

    /**
     * Focuses the chip at `index` (or the last one), or the first add button when the chain is empty.
     * @param {number} index
     */
    focusChip(index) {
      const all = chips();
      (all[Math.min(index, all.length - 1)] ?? ui.addButtons[0]).focus();
    },
  };
}

/** Adds or removes chip elements at the end, so the focused chip keeps its element. */
function syncChipCount(list, count) {
  while (list.children.length < count) {
    const index = list.children.length;
    list.append(h('li', {}, [h('button', { type: 'button', className: 'btn chain-chip', dataset: { index } })]));
  }
  while (list.children.length > count) list.lastElementChild.remove();
}
