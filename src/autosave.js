/**
 * Debounced autosave of the song. Only edits are written: a song that was just
 * opened, such as one from a share link, never replaces the saved song until
 * it is edited.
 */

/**
 * Creates the autosave. Call schedule() after every edit: the song is written
 * once it has been left alone for `delayMs`, so a slider drag writes once.
 * flush() writes a pending edit at once (when the page is hidden, or before a
 * share link replaces the song) and does nothing when there is none.
 * @param {{ read: () => string, write: (text: string) => void, delayMs: number, saved?: string | null,
 *   timers?: { setTimeout: Function, clearTimeout: Function } }} options
 *   read serializes the current song; write stores it; saved is the song already
 *   stored at start-up; timers are setTimeout and clearTimeout (a fake clock in tests)
 * @returns {{ schedule(): void, flush(): void, readonly saved: string | null }}
 *   saved: the song as last written (or the start-up one), null when there is none
 */
export function createAutosave({ read, write, delayMs, saved = null, timers = globalThis }) {
  let timer = null;
  let last = saved;

  function flush() {
    if (timer === null) return;
    timers.clearTimeout(timer);
    timer = null;
    last = read();
    write(last);
  }

  return {
    schedule() {
      if (timer !== null) timers.clearTimeout(timer);
      timer = timers.setTimeout(flush, delayMs);
    },
    flush,
    get saved() {
      return last;
    },
  };
}
