import { h, setText } from './dom.js';

/** How long (ms) a plain message and a message with an action stay visible. */
const SHORT_MS = 2600;
const LONG_MS = 6000;

/**
 * A small status message at the bottom of the screen, optionally with one
 * action button (Undo). The element should carry role="status". Texts are
 * passed as functions, so a visible message can be re-rendered in a new language.
 * @param {HTMLElement} root
 * @returns {{
 *   show(message: () => string, action?: { label: () => string, run: () => void }): void,
 *   refresh(): void,
 *   dropAction(): void,
 * }}
 */
export function createToast(root) {
  const text = h('span', { className: 'toast-text' });
  const button = h('button', { type: 'button', className: 'toast-action', hidden: true });
  root.append(text, button);
  let timer = 0;
  /** The visible message: { message, action }, or null. */
  let current = null;

  function render() {
    setText(text, current.message());
    if (current.action) setText(button, current.action.label());
  }

  function hide() {
    clearTimeout(timer);
    current = null;
    button.hidden = true;
    root.classList.remove('is-visible');
  }

  button.addEventListener('click', () => {
    const action = current?.action;
    hide();
    if (action) action.run();
  });

  return {
    show(message, action) {
      clearTimeout(timer);
      current = { message, action };
      button.hidden = !action;
      render();
      root.classList.add('is-visible');
      timer = setTimeout(hide, action ? LONG_MS : SHORT_MS);
    },

    /** Re-renders the visible message, e.g. after a language change. */
    refresh() {
      if (current) render();
    },

    /** Hides the toast if it offers an action, e.g. an Undo that a newer edit made stale. */
    dropAction() {
      if (current?.action) hide();
    },
  };
}
