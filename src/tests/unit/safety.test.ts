import { describe, expect, it } from 'vitest';
import { MAX_MASTER_VOLUME, MAX_VOICE_LEVEL } from '../../audio/constants';
import {
  clampClassCap,
  clampMasterVolume,
  clampVoiceLevel,
  envelopeTiming,
  formatPercent,
  masterVolumeOrDefault,
  voicePeak,
} from '../../audio/safety';

describe('volume safety', () => {
  it('never exceeds the hard master cap', () => {
    expect(clampMasterVolume(1)).toBe(MAX_MASTER_VOLUME);
    expect(clampMasterVolume(0.3)).toBe(0.3);
    expect(clampMasterVolume(-1)).toBe(0);
    expect(clampMasterVolume(Number.NaN)).toBe(0);
  });

  it('applies a teacher class cap below the hard cap', () => {
    expect(clampMasterVolume(0.5, 0.2)).toBe(0.2);
    expect(clampMasterVolume(0.1, 0.2)).toBe(0.1);
    expect(clampClassCap(0.9)).toBe(MAX_MASTER_VOLUME);
    expect(clampClassCap(0.05)).toBe(0.1);
  });

  it('clamps voice level and leaves headroom', () => {
    expect(clampVoiceLevel(2)).toBe(MAX_VOICE_LEVEL);
    expect(voicePeak(1)).toBeCloseTo(0.9, 8);
    expect(voicePeak(0)).toBe(0);
  });

  it('uses the safe default for invalid persisted values', () => {
    expect(masterVolumeOrDefault(undefined)).toBeCloseTo(0.18, 8);
    expect(masterVolumeOrDefault(2)).toBe(MAX_MASTER_VOLUME);
    expect(masterVolumeOrDefault(0.3)).toBeCloseTo(0.3, 8);
  });

  it('uses short fade values so notes do not click', () => {
    const timing = envelopeTiming();
    expect(timing.attack).toBeGreaterThan(0);
    expect(timing.attack).toBeLessThan(0.02);
    expect(timing.release).toBeGreaterThan(0);
    expect(timing.release).toBeLessThan(0.05);
    expect(timing.fade).toBeGreaterThan(0);
  });

  it('formats percentages', () => {
    expect(formatPercent(0.18)).toBe('18%');
    expect(formatPercent(1.2)).toBe('100%');
  });
});
