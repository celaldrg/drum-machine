/**
 * Tiny localStorage helper. Every read and write is wrapped in try/catch, so
 * private browsing, blocked site data or a full quota never break the app:
 * reads fall back to a default and failed writes are simply skipped.
 */

/**
 * Creates a storage helper around a store such as window.localStorage.
 * The store is looked up on every call, inside the try block, because merely
 * touching window.localStorage can throw when site data is blocked.
 * @param {() => { getItem(key: string): string | null, setItem(key: string, value: string): void }} [getStore]
 * @returns {{ get(key: string, fallback?: string | null): string | null, set(key: string, value: string): boolean }}
 */
export function createStorage(getStore = () => globalThis.localStorage) {
  return {
    get(key, fallback = null) {
      try {
        const value = getStore().getItem(key);
        return typeof value === 'string' ? value : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        getStore().setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** The app's helper around window.localStorage. */
export const storage = createStorage();
