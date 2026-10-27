/**
 * Where the app's starting song comes from, and the keys it is saved under.
 */

/** localStorage key of the autosaved song (JSON from songToJSON). */
export const SONG_KEY = 'drum-machine:song';

/** localStorage key of the chosen UI language. */
export const LANG_KEY = 'drum-machine:lang';

/**
 * Picks the source of the starting song, in order of precedence: the ?demo
 * screenshot state, a share link in the URL hash, the autosaved song, or a
 * new empty song.
 * @param {{ search?: string, hash?: string, saved?: string | null }} sources
 *   location.search, location.hash and the saved song text
 * @returns {{ kind: 'demo' } | { kind: 'link', text: string } | { kind: 'saved', text: string } | { kind: 'new' }}
 */
export function chooseStart({ search = '', hash = '', saved = null } = {}) {
  if (new URLSearchParams(search).has('demo')) return { kind: 'demo' };
  const link = hash.replace(/^#/, '');
  if (link) return { kind: 'link', text: link };
  if (saved) return { kind: 'saved', text: saved };
  return { kind: 'new' };
}
