import { TRACK_IDS, PATTERN_IDS, MAX_VELOCITY } from './constants.js';
import { DEMOS } from './demos.js';
import { hitGain } from './mixer.js';
import { createAudioEngine } from './audio.js';
import { createPlayer } from './player.js';
import { createGridView } from './grid-view.js';
import { createChainView } from './chain-view.js';
import { renderTransport } from './transport-view.js';
import { createToast } from './toast.js';
import { keyAction } from './keymap.js';
import { createAutosave } from './autosave.js';
import { createLongPress } from './long-press.js';
import { copyText } from './clipboard.js';
import { storage } from './storage.js';
import { LANG_KEY, SONG_KEY } from './session.js';
import { translate, normalizeLanguage, otherLanguage } from './i18n.js';
import { h, setText, translateStatic } from './dom.js';

/** Delay (ms) before an edit is autosaved, so slider drags write once. */
const SAVE_DELAY_MS = 400;
/** A click on a preview pad within this time (ms) of its pointerdown is the same press. */
const PRESS_MS = 1000;
/** Seed of the audio engine's noise generator. */
const AUDIO_SEED = 909;

/**
 * Wires the page (index.html) to a drum machine: rendering, playback,
 * editing, keyboard shortcuts, language, autosave and share links.
 * @param {{ machine: ReturnType<import('./machine.js').createMachine>, demo?: boolean,
 *   saved?: string | null, link?: string | null }} options
 *   demo: the ?demo screenshot state (never autosaved); saved: the autosaved song (JSON)
 *   the machine was loaded with; link: share-link text from the URL to open at start
 */
export function createApp({ machine, demo = false, saved = null, link = null }) {
  const ui = findElements();
  const engine = createAudioEngine({ seed: AUDIO_SEED });
  const grid = createGridView(ui.grid, ui.pagerButtons);
  const chain = createChainView(ui.chain);
  const toast = createToast(ui.toast);
  const player = createPlayer({ machine, engine, onFrame: renderPlayback });
  const autosave = createAutosave({
    read: () => machine.exportJSON(),
    write: (text) => storage.set(SONG_KEY, text),
    delayMs: SAVE_DELAY_MS,
    saved,
  });
  const longPress = createLongPress(onLongPress);
  let language = normalizeLanguage(storage.get(LANG_KEY));
  let pointerPreview = { track: -1, time: 0 };
  /** The pad a long press has just erased: the click that ends the press is skipped. */
  let longPressed = null;
  const t = (key, params) => translate(language, key, params);

  function renderSong() {
    const state = machine.getState();
    renderTransport(ui, state, t);
    grid.renderSong(state, t);
    grid.renderPlayback(state);
    chain.renderSong(state, t);
    chain.renderPlayback(state);
  }

  function renderPlayback() {
    const state = machine.getState();
    renderTransport(ui, state, t);
    grid.renderPlayback(state);
    chain.renderPlayback(state);
  }

  /** Call after every edit: re-render, autosave, and retire a stale share link or Undo offer. */
  function commit() {
    toast.dropAction();
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    if (!demo) autosave.schedule();
    renderSong();
  }

  /** Shows a short message; it follows language changes while visible. */
  function say(key, params) {
    toast.show(() => t(key, params));
  }

  /**
   * Shows a message with an Undo button that brings a song back.
   * @param {() => string} message translated on every render
   * @param {string} snapshot the song to bring back (JSON)
   */
  function offerUndo(message, snapshot) {
    toast.show(message, {
      label: () => t('undo'),
      run: () => {
        machine.importJSON(snapshot);
        commit();
      },
    });
  }

  /**
   * Runs a destructive edit and offers to undo it.
   * @param {() => string} message translated on every render
   * @param {() => void} change
   */
  function withUndo(message, change) {
    const snapshot = machine.exportJSON();
    change();
    commit();
    offerUndo(message, snapshot);
  }

  /** A message naming the selected pattern as it was when the edit happened. */
  function aboutPattern(key) {
    const id = machine.getState().current;
    return () => t(key, { id });
  }

  function applyLanguage() {
    document.documentElement.lang = language;
    document.title = t('docTitle');
    ui.description.setAttribute('content', t('metaDescription'));
    translateStatic(document, t);
    [...ui.demo.options].forEach((option) => {
      setText(option, option.value ? t(`demo_${option.value}`) : t('demoPlaceholder'));
    });
    toast.refresh();
    renderSong();
  }

  function togglePlay() {
    if (machine.getState().playing) player.stop();
    else if (!player.start()) say('noAudio');
    renderPlayback();
  }

  function selectPattern(id) {
    if (machine.selectPattern(id)) commit();
  }

  function playNow(track, gain) {
    if (engine.unlock()) engine.playHit(TRACK_IDS[track], gain, engine.currentTime());
  }

  function preview(track) {
    playNow(track, hitGain(machine.getState().channels[track], MAX_VELOCITY));
    grid.flash(track);
  }

  /** Cycles a pad's velocity; while stopped, a pad switched on plays its sound. */
  function tapPad(track, step) {
    const velocity = machine.toggleStep(track, step);
    commit();
    const state = machine.getState();
    if (!state.playing && velocity > 0 && state.audible[track]) playNow(track, hitGain(state.channels[track], velocity));
  }

  /** Switches a pad off; a pad that is already off is left alone (no edit, no autosave). */
  function erase(track, step) {
    const { patterns, current } = machine.getState();
    if (patterns[current][track][step] === 0) return;
    machine.setStep(track, step, 0);
    commit();
  }

  /** Puts a link to the song in the address bar and copies it, if the clipboard answers in time. */
  async function share() {
    const url = `${location.origin}${location.pathname}#${machine.exportShare()}`;
    history.replaceState(null, '', url);
    const copied = await copyText(navigator.clipboard, url);
    say(copied ? 'linkCopied' : 'linkInBar');
  }

  /**
   * Opens the song of a share link. It is autosaved only once it is edited,
   * so the saved song survives, and the message offers Undo to go back to it.
   * @param {string} code share-link text (the URL hash without '#')
   */
  function openLink(code) {
    autosave.flush();
    if (!machine.importShare(code)) {
      // Drop the bad hash, so a reload does not show the same message again.
      history.replaceState(null, '', `${location.pathname}${location.search}`);
      say('linkBad');
      return;
    }
    renderSong();
    const own = autosave.saved;
    if (own !== null && own !== machine.exportJSON()) offerUndo(() => t('linkLoaded'), own);
    else say('linkLoaded');
  }

  function onHashChange() {
    const code = location.hash.slice(1);
    if (code && code !== machine.exportShare()) openLink(code);
  }

  function onGridClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const track = Number(target.dataset.track);
    switch (target.dataset.action) {
      case 'pad': {
        // The pointer click that ends a long press is skipped; a keyboard click (detail 0) never is.
        const endsLongPress = target === longPressed && event.detail > 0;
        longPressed = null;
        if (!endsLongPress) tapPad(track, Number(target.dataset.step));
        break;
      }
      case 'mute':
        machine.toggleMute(track);
        commit();
        break;
      case 'solo':
        machine.toggleSolo(track);
        commit();
        break;
      case 'preview':
        if (!endsPointerPress(track, event)) preview(track);
        break;
    }
  }

  /**
   * Preview pads sound on pointerdown for a tight feel; the click that follows is skipped.
   * A touch only counts as a user gesture once it ends, so until audio runs a touch plays on click.
   */
  function onGridPointerDown(event) {
    const button = event.target.closest('.preview');
    if (!button || event.button !== 0) return;
    if (event.pointerType !== 'mouse' && !engine.isRunning()) return;
    const track = Number(button.dataset.track);
    pointerPreview = { track, time: event.timeStamp };
    preview(track);
  }

  /** Whether a click ends a press that already sounded on pointerdown; each press counts once. */
  function endsPointerPress(track, event) {
    const press = pointerPreview;
    pointerPreview = { track: -1, time: 0 };
    return event.detail > 0 && press.track === track && event.timeStamp - press.time < PRESS_MS;
  }

  function onGridInput(event) {
    const input = event.target;
    if (input.dataset.action !== 'volume') return;
    machine.setVolume(Number(input.dataset.track), input.value);
    commit();
  }

  /** Right-click erases a pad (so does a long press on Android, which fires contextmenu). */
  function onGridContextMenu(event) {
    const pad = event.target.closest('.pad');
    if (!pad) return;
    event.preventDefault();
    erase(Number(pad.dataset.track), Number(pad.dataset.step));
  }

  /** A touch or pen resting on a pad starts a long press; each new press clears the last one's click skip. */
  function onPadPointerDown(event) {
    longPressed = null;
    const pad = event.target.closest('.pad');
    if (pad && event.pointerType !== 'mouse' && event.isPrimary) {
      longPress.start(event.pointerId, event.clientX, event.clientY, pad);
    }
  }

  /** A long press erases the pad on every touch screen (iOS Safari fires no contextmenu). */
  function onLongPress(pad) {
    longPressed = pad;
    erase(Number(pad.dataset.track), Number(pad.dataset.step));
  }

  function onPadPointerEnd(event) {
    longPress.end(event.pointerId);
  }

  function onKeyDown(event) {
    const action = keyAction(event, keyTarget(event.target));
    if (!action) return;
    event.preventDefault();
    if (event.repeat && action.type !== 'move') return;
    if (action.type === 'toggle-play') togglePlay();
    else if (action.type === 'preview') preview(action.track);
    else if (action.type === 'pattern') selectPattern(action.id);
    else if (action.type === 'move') grid.moveFocus(action.tracks, action.steps);
    else if (action.type === 'erase') erase(Number(event.target.dataset.track), Number(event.target.dataset.step));
  }

  /** Stops a focused button from also reacting to the Space key that plays and stops. */
  function onKeyUp(event) {
    if (event.key === ' ' && keyTarget(event.target) !== 'field') event.preventDefault();
  }

  function editChain(change) {
    const ids = machine.getState().chain;
    change(ids);
    machine.setChain(ids);
    commit();
  }

  function onChipClick(event) {
    const chip = event.target.closest('.chain-chip');
    if (!chip) return;
    const index = Number(chip.dataset.index);
    editChain((ids) => {
      ids[index] = PATTERN_IDS[(PATTERN_IDS.indexOf(ids[index]) + 1) % PATTERN_IDS.length];
    });
  }

  function onChipKeyDown(event) {
    const chip = event.target.closest('.chain-chip');
    if (!chip || (event.key !== 'Delete' && event.key !== 'Backspace')) return;
    event.preventDefault();
    const index = Number(chip.dataset.index);
    editChain((ids) => ids.splice(index, 1));
    chain.focusChip(index);
  }

  function wireTransport() {
    ui.play.addEventListener('click', togglePlay);
    ui.tempo.addEventListener('input', () => {
      machine.setTempo(ui.tempo.value);
      commit();
    });
    ui.tempoNumber.addEventListener('change', () => {
      ui.tempoNumber.value = String(machine.setTempo(ui.tempoNumber.value));
      commit();
    });
    ui.swing.addEventListener('input', () => {
      machine.setSwing(ui.swing.value);
      commit();
    });
    ui.swingNumber.addEventListener('change', () => {
      ui.swingNumber.value = String(machine.setSwing(ui.swingNumber.value));
      commit();
    });
    ui.patternButtons.forEach((button) => button.addEventListener('click', () => selectPattern(button.dataset.pattern)));
  }

  function wireTools() {
    ui.demo.append(h('option', { value: '' }), ...DEMOS.map((demoGroove) => h('option', { value: demoGroove.id })));
    ui.demo.addEventListener('change', () => {
      const demoId = ui.demo.value;
      ui.demo.value = '';
      if (!demoId) return;
      const id = machine.getState().current;
      withUndo(() => t('demoLoaded', { name: t(`demo_${demoId}`), id }), () => machine.loadDemo(demoId));
    });
    ui.randomize.addEventListener('click', () => withUndo(aboutPattern('randomized'), () => machine.randomize()));
    ui.clear.addEventListener('click', () => withUndo(aboutPattern('cleared'), () => machine.clearPattern()));
    ui.share.addEventListener('click', share);
    ui.newSong.addEventListener('click', () => withUndo(() => t('newSongDone'), () => machine.newSong()));
    ui.lang.addEventListener('click', () => {
      language = otherLanguage(language);
      storage.set(LANG_KEY, language);
      applyLanguage();
    });
  }

  function wireGrid() {
    ui.grid.addEventListener('click', onGridClick);
    ui.grid.addEventListener('pointerdown', onGridPointerDown);
    ui.grid.addEventListener('pointerdown', onPadPointerDown);
    ui.grid.addEventListener('pointermove', (event) => longPress.move(event.pointerId, event.clientX, event.clientY));
    ui.grid.addEventListener('pointerup', onPadPointerEnd);
    ui.grid.addEventListener('pointercancel', onPadPointerEnd);
    ui.grid.addEventListener('input', onGridInput);
    ui.grid.addEventListener('contextmenu', onGridContextMenu);
  }

  function wireChain() {
    ui.chain.toggle.addEventListener('click', () => {
      machine.setChainOn(!machine.getState().chainOn);
      commit();
    });
    ui.chain.addButtons.forEach((button) => {
      button.addEventListener('click', () => editChain((ids) => ids.push(button.dataset.add)));
    });
    ui.chain.back.addEventListener('click', () => editChain((ids) => ids.pop()));
    ui.chain.clear.addEventListener('click', () => withUndo(() => t('chainCleared'), () => machine.setChain([])));
    ui.chain.list.addEventListener('click', onChipClick);
    ui.chain.list.addEventListener('keydown', onChipKeyDown);
  }

  wireTransport();
  wireTools();
  wireGrid();
  wireChain();
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('pagehide', autosave.flush);
  applyLanguage();
  if (link) openLink(link);
}

/** Where a key press happened: on a step pad, in a text-like form field, or elsewhere. */
function keyTarget(element) {
  if (element.classList?.contains('pad')) return 'pad';
  if (element.closest?.('select, textarea, [contenteditable="true"]')) return 'field';
  return element.tagName === 'INPUT' && element.type !== 'range' ? 'field' : 'other';
}

function findElements() {
  const byId = (id) => document.getElementById(id);
  const all = (selector) => [...document.querySelectorAll(selector)];
  return {
    play: byId('play'),
    playLabel: byId('play-label'),
    tempo: byId('tempo'),
    tempoNumber: byId('tempo-number'),
    swing: byId('swing'),
    swingNumber: byId('swing-number'),
    patternButtons: all('[data-pattern]'),
    patternBadge: byId('pattern-badge'),
    demo: byId('demo'),
    randomize: byId('randomize'),
    clear: byId('clear'),
    share: byId('share'),
    grid: byId('grid'),
    pagerButtons: all('[data-page-button]'),
    chain: {
      panel: byId('chain-panel'),
      list: byId('chain-list'),
      empty: byId('chain-empty'),
      count: byId('chain-count'),
      toggle: byId('chain-toggle'),
      toggleLabel: byId('chain-toggle-label'),
      addButtons: all('[data-add]'),
      back: byId('chain-back'),
      clear: byId('chain-clear'),
    },
    newSong: byId('new-song'),
    lang: byId('lang'),
    toast: byId('toast'),
    description: document.querySelector('meta[name="description"]'),
  };
}
