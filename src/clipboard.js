/**
 * Copying the share link to the clipboard, without waiting forever.
 */

/** How long (ms) to wait for the clipboard before saying where the link is instead. */
export const CLIPBOARD_TIMEOUT_MS = 1500;

/**
 * Copies text to the clipboard. writeText is missing outside secure contexts
 * and can stay pending for good (an unanswered permission prompt, some
 * embedded or headless pages), so the result is false after a timeout.
 * @param {{ writeText(text: string): Promise<void> } | undefined} clipboard e.g. navigator.clipboard
 * @param {string} text
 * @param {{ timeoutMs?: number, timers?: { setTimeout: Function, clearTimeout: Function } }} [options]
 *   timers: setTimeout and clearTimeout to use (a fake clock in tests)
 * @returns {Promise<boolean>} true once copied; false when refused, unavailable or too slow
 */
export function copyText(clipboard, text, { timeoutMs = CLIPBOARD_TIMEOUT_MS, timers = globalThis } = {}) {
  return new Promise((resolve) => {
    const timer = timers.setTimeout(() => resolve(false), timeoutMs);
    const settle = (copied) => {
      timers.clearTimeout(timer);
      resolve(copied);
    };
    try {
      clipboard.writeText(text).then(
        () => settle(true),
        () => settle(false),
      );
    } catch {
      settle(false);
    }
  });
}
