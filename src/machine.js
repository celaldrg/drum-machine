import { TRACK_IDS, STEPS, MAX_VELOCITY, PATTERN_IDS, CHAIN_MAX } from './constants.js';
import { createPattern, nextVelocity, patternFromRows, randomPattern } from './pattern.js';
import { isAudible, hitGain } from './mixer.js';
import { createSong, cloneSong, clampBpm, clampSwing, clampVolume } from './song.js';
import {
  createTransport,
  startTransport,
  stopTransport,
  setTransportTempo,
  setTransportSwing,
  scheduleWindow,
  LOOKAHEAD_SECONDS,
  START_DELAY_SECONDS,
} from './scheduler.js';
import { encodeSong, decodeSong, songToJSON, songFromJSON } from './codec.js';
import { createRng } from './rng.js';
import { findDemo, createDemoSong, DEMO_CURSOR } from './demos.js';

/**
 * One drum hit inside a booked step.
 * @typedef {object} Hit
 * @property {number} track track index
 * @property {string} id track id, e.g. "kick"
 * @property {number} velocity 1..3
 * @property {number} gain 0..1 with volume and velocity applied (muted and un-soloed tracks are left out)
 */

/**
 * A booked step with the pattern it plays and the hits to sound.
 * @typedef {import('./scheduler.js').StepEvent & { patternId: string, chainIndex: number, hits: Hit[] }} HitEvent
 */

/**
 * Playback details added to the song in a state snapshot.
 * @typedef {object} PlaybackState
 * @property {boolean[]} audible per track, whether it is heard (mute and solo applied)
 * @property {boolean} playing
 * @property {number} cursor step under the play head, -1 when stopped
 * @property {string | null} playingPattern slot under the play head
 * @property {number} playingChainIndex chain position under the play head, -1 when not chaining
 */

/**
 * Snapshot for rendering: a copy of the song plus playback details.
 * @typedef {import('./song.js').Song & PlaybackState} MachineState
 */

/**
 * Creates the drum machine that the UI drives. Every method is synchronous
 * and deterministic. Times are seconds on the caller's clock: the
 * AudioContext clock in the browser, a fake clock in tests.
 *
 * Playback: call play(now), then schedule(now) from a timer about every
 * TIMER_INTERVAL_MS and sound the returned hits at their times; call
 * updateCursor(now) once per animation frame to move the step indicator.
 * While the chain is off, a newly selected slot starts playing at the next bar.
 * @param {{ song?: import('./song.js').Song, seed?: number, cursor?: number }} [options]
 *   song: starting song (copied); seed: seed for Randomize; cursor: initial step indicator (the ?demo state)
 * @returns the machine: the methods below, each documented where it is defined
 */
export function createMachine(options = {}) {
  let song = options.song ? cloneSong(options.song) : createSong();
  let transport = createTransport(song.bpm, song.swing);
  const rng = createRng(options.seed ?? 1);
  /** Booked steps whose time has not been reached yet. @type {HitEvent[]} */
  let pending = [];
  /** Bar being booked: its number, slot and chain position. */
  let bookingBar = null;
  /** Chain position the next bar plays. */
  let chainPos = 0;
  let cursor = options.cursor ?? -1;
  let playingPattern = cursor >= 0 ? song.current : null;
  let playingChainIndex = -1;

  function syncTiming() {
    transport = setTransportSwing(setTransportTempo(transport, song.bpm), song.swing);
  }

  function replaceSong(next) {
    song = next;
    chainPos = 0;
    syncTiming();
  }

  function currentPattern() {
    return song.patterns[song.current];
  }

  function startBar(bar) {
    if (song.chainOn && song.chain.length > 0) {
      const chainIndex = chainPos % song.chain.length;
      chainPos = chainIndex + 1;
      return { bar, patternId: song.chain[chainIndex], chainIndex };
    }
    return { bar, patternId: song.current, chainIndex: -1 };
  }

  function hitsAt(pattern, step) {
    const hits = [];
    TRACK_IDS.forEach((id, track) => {
      const velocity = pattern[track][step];
      if (velocity === 0 || !isAudible(song.channels, track)) return;
      const gain = hitGain(song.channels[track], velocity);
      if (gain > 0) hits.push({ track, id, velocity, gain });
    });
    return hits;
  }

  function toHitEvent(event) {
    if (!bookingBar || bookingBar.bar !== event.bar) bookingBar = startBar(event.bar);
    const { patternId, chainIndex } = bookingBar;
    return { ...event, patternId, chainIndex, hits: hitsAt(song.patterns[patternId], event.step) };
  }

  return {
    /**
     * Returns a snapshot of the song and playback state (a copy; changing it has no effect).
     * @returns {MachineState}
     */
    getState() {
      return {
        ...cloneSong(song),
        audible: TRACK_IDS.map((_, track) => isAudible(song.channels, track)),
        playing: transport.playing,
        cursor,
        playingPattern,
        playingChainIndex,
      };
    },

    /**
     * Taps a pad of the selected pattern: off → normal → accent → soft → off.
     * @param {number} track 0..7
     * @param {number} step 0..15
     * @returns {number} the new velocity
     */
    toggleStep(track, step) {
      checkCell(track, step);
      const row = currentPattern()[track];
      row[step] = nextVelocity(row[step]);
      return row[step];
    },

    /**
     * Sets a pad of the selected pattern to a velocity (e.g. 0 to erase).
     * @param {number} track 0..7
     * @param {number} step 0..15
     * @param {number} velocity 0..3
     */
    setStep(track, step, velocity) {
      checkCell(track, step);
      if (!Number.isInteger(velocity) || velocity < 0 || velocity > MAX_VELOCITY) {
        throw new RangeError(`Invalid velocity: ${velocity}`);
      }
      currentPattern()[track][step] = velocity;
    },

    /** Empties the selected pattern. */
    clearPattern() {
      song.patterns[song.current] = createPattern();
    },

    /** Replaces the whole song with a new, empty one (default tempo, mixer and chain); playback goes on. */
    newSong() {
      replaceSong(createSong());
    },

    /** Fills the selected pattern with a random musical groove from the machine's seeded generator. */
    randomize() {
      song.patterns[song.current] = randomPattern(rng);
    },

    /**
     * Loads a demo groove into the selected slot and takes over its tempo and swing.
     * @param {string} id rock | house | hiphop | bossa
     * @returns {boolean} false for an unknown id
     */
    loadDemo(id) {
      const demo = findDemo(id);
      if (!demo) return false;
      song.patterns[song.current] = patternFromRows(demo.rows);
      song.bpm = demo.bpm;
      song.swing = demo.swing;
      syncTiming();
      return true;
    },

    /**
     * Selects the slot to edit (and to play while the chain is off, from the next bar on).
     * @param {string} id A | B | C | D
     * @returns {boolean} false for an unknown slot
     */
    selectPattern(id) {
      if (!PATTERN_IDS.includes(id)) return false;
      song.current = id;
      return true;
    },

    /**
     * Sets the tempo; while playing, the change applies from the next unbooked step.
     * Values are rounded and clamped; a non-number keeps the current tempo.
     * @param {number | string} bpm
     * @returns {number} the tempo applied (60..200)
     */
    setTempo(bpm) {
      song.bpm = clampBpm(bpm, song.bpm);
      syncTiming();
      return song.bpm;
    },

    /**
     * Sets the swing amount (rounded and clamped; a non-number keeps the current swing).
     * @param {number | string} swing percent
     * @returns {number} the swing applied (0..60)
     */
    setSwing(swing) {
      song.swing = clampSwing(swing, song.swing);
      syncTiming();
      return song.swing;
    },

    /**
     * Mutes or unmutes a track.
     * @param {number} track 0..7
     * @returns {boolean} whether the track is now muted
     */
    toggleMute(track) {
      checkTrack(track);
      const channel = song.channels[track];
      channel.mute = !channel.mute;
      return channel.mute;
    },

    /**
     * Solos or unsolos a track.
     * @param {number} track 0..7
     * @returns {boolean} whether the track is now soloed
     */
    toggleSolo(track) {
      checkTrack(track);
      const channel = song.channels[track];
      channel.solo = !channel.solo;
      return channel.solo;
    },

    /**
     * Sets a track volume (rounded and clamped; a non-number keeps the current volume).
     * @param {number} track 0..7
     * @param {number | string} volume 0..100
     * @returns {number} the volume applied
     */
    setVolume(track, volume) {
      checkTrack(track);
      song.channels[track].volume = clampVolume(volume, song.channels[track].volume);
      return song.channels[track].volume;
    },

    /**
     * Replaces the song chain; unknown slot ids are dropped and it is cut to 16 bars.
     * @param {string[]} ids e.g. ["A", "A", "B", "C"]
     * @returns {string[]} the chain applied
     */
    setChain(ids) {
      const valid = Array.isArray(ids) ? ids.filter((id) => PATTERN_IDS.includes(id)) : [];
      song.chain = valid.slice(0, CHAIN_MAX);
      return song.chain.slice();
    },

    /**
     * Turns chain playback on or off. Turning it on starts the chain from its
     * first slot (at the next bar while playing). An empty chain plays the selected slot.
     * @param {boolean} on
     */
    setChainOn(on) {
      song.chainOn = Boolean(on);
      chainPos = 0;
    },

    /**
     * Starts playback; the first step sounds START_DELAY_SECONDS after `now`. Ignored while playing.
     * @param {number} now current time in seconds
     */
    play(now) {
      if (transport.playing) return;
      transport = startTransport(transport, now + START_DELAY_SECONDS);
      pending = [];
      bookingBar = null;
      chainPos = 0;
    },

    /** Stops playback and hides the step indicator. */
    stop() {
      transport = stopTransport(transport);
      pending = [];
      bookingBar = null;
      cursor = -1;
      playingPattern = null;
      playingChainIndex = -1;
    },

    /**
     * Books the steps that start before now + lookahead (see scheduleWindow).
     * @param {number} now current time in seconds
     * @param {number} [lookahead] seconds
     * @returns {HitEvent[]} booked steps in order, each with the hits to sound at `time`
     */
    schedule(now, lookahead = LOOKAHEAD_SECONDS) {
      const result = scheduleWindow(transport, now, lookahead);
      transport = result.transport;
      const events = result.events.map(toHitEvent);
      pending.push(...events);
      return events;
    },

    /**
     * Moves the step indicator to the latest booked step whose time has come.
     * @param {number} now current time in seconds
     * @returns {number} the step under the play head, -1 when stopped
     */
    updateCursor(now) {
      while (pending.length > 0 && pending[0].time <= now) {
        const event = pending.shift();
        cursor = event.step;
        playingPattern = event.patternId;
        playingChainIndex = event.chainIndex;
      }
      return cursor;
    },

    /**
     * Encodes the song for a share link (put it in location.hash).
     * @returns {string} URL-safe text
     */
    exportShare() {
      return encodeSong(song);
    },

    /**
     * Loads a song from share-link text.
     * @param {string} text
     * @returns {boolean} false (and nothing changes) when the text is invalid
     */
    importShare(text) {
      const next = decodeSong(text);
      if (next) replaceSong(next);
      return next !== null;
    },

    /**
     * Serializes the song as readable JSON.
     * @returns {string}
     */
    exportJSON() {
      return songToJSON(song);
    },

    /**
     * Loads a song from JSON made by exportJSON().
     * @param {string} text
     * @returns {boolean} false (and nothing changes) when the JSON is invalid
     */
    importJSON(text) {
      const next = songFromJSON(text);
      if (next) replaceSong(next);
      return next !== null;
    },
  };
}

/**
 * Builds the deterministic ?demo state: the house groove filled in slot A,
 * other grooves in B-D, and the step indicator mid-bar.
 * @returns {ReturnType<typeof createMachine>}
 */
export function createDemoMachine() {
  return createMachine({ song: createDemoSong(), cursor: DEMO_CURSOR });
}

function checkTrack(track) {
  if (!Number.isInteger(track) || track < 0 || track >= TRACK_IDS.length) {
    throw new RangeError(`Invalid track: ${track}`);
  }
}

function checkCell(track, step) {
  checkTrack(track);
  if (!Number.isInteger(step) || step < 0 || step >= STEPS) throw new RangeError(`Invalid step: ${step}`);
}
