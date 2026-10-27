import { VOLUME_MAX } from './constants.js';

/** Gain factor per velocity level: off, soft, normal, accent. */
export const VELOCITY_GAINS = Object.freeze([0, 0.4, 0.7, 1]);

/**
 * Tells whether a track is heard. A muted track is always silent (mute wins
 * over solo); while any track is soloed, only soloed tracks are heard.
 * @param {{ mute: boolean, solo: boolean }[]} channels one per track
 * @param {number} track track index
 * @returns {boolean}
 */
export function isAudible(channels, track) {
  const channel = channels[track];
  if (!channel || channel.mute) return false;
  return channel.solo || !channels.some((other) => other.solo);
}

/**
 * Gain of one hit: the track volume on a square-law curve (so the slider
 * feels even across its range) times the velocity factor.
 * Mute and solo are not applied here; see isAudible().
 * @param {{ volume: number }} channel
 * @param {number} velocity 0..3
 * @returns {number} 0..1
 */
export function hitGain(channel, velocity) {
  const level = channel.volume / VOLUME_MAX;
  return level * level * (VELOCITY_GAINS[velocity] ?? 0);
}
