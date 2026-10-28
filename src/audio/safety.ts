import {
  ATTACK_SECONDS,
  DEFAULT_MASTER_VOLUME,
  FADE_SECONDS,
  MAX_MASTER_VOLUME,
  MAX_VOICE_LEVEL,
  MIN_MASTER_VOLUME,
  RELEASE_SECONDS,
} from './constants';
import { clamp } from './notes';

/** The final hard ceiling. No user or teacher setting can exceed this value. */
export function clampMasterVolume(value: number, classCap = MAX_MASTER_VOLUME): number {
  const safeCap = clamp(classCap, MIN_MASTER_VOLUME, MAX_MASTER_VOLUME);
  return clamp(value, MIN_MASTER_VOLUME, safeCap);
}

export function clampVoiceLevel(value: number): number {
  return clamp(value, 0, MAX_VOICE_LEVEL);
}

export function clampClassCap(value: number): number {
  return clamp(value, 0.1, MAX_MASTER_VOLUME);
}

export function masterVolumeOrDefault(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clampMasterVolume(value)
    : DEFAULT_MASTER_VOLUME;
}

export interface EnvelopeTiming {
  attack: number;
  release: number;
  fade: number;
}

export function envelopeTiming(): EnvelopeTiming {
  return {
    attack: ATTACK_SECONDS,
    release: RELEASE_SECONDS,
    fade: FADE_SECONDS,
  };
}

/**
 * Peak amplitude for a single voice. Keeping this below 1 leaves headroom for
 * chords and the limiter, and makes the polyphony cap predictable.
 */
export function voicePeak(level: number): number {
  return clampVoiceLevel(level) * 0.9;
}

export function formatPercent(value: number): string {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}
