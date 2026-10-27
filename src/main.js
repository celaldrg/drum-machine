import { createMachine, createDemoMachine } from './machine.js';
import { createApp } from './app.js';
import { storage } from './storage.js';
import { chooseStart, SONG_KEY } from './session.js';

/**
 * Entry point: starts the app with the ?demo state, or with the autosaved
 * song (or a new one) and a share link from the URL opened on top of it.
 */
function boot() {
  const saved = storage.get(SONG_KEY);
  const start = chooseStart({ search: location.search, hash: location.hash, saved });
  if (start.kind === 'demo') {
    createApp({ machine: createDemoMachine(), demo: true });
    return;
  }
  const machine = createMachine({ seed: Date.now() });
  const own = saved && machine.importJSON(saved) ? saved : null;
  createApp({ machine, saved: own, link: start.kind === 'link' ? start.text : null });
}

boot();
