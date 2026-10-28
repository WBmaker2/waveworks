import { describe, expect, it } from 'vitest';
import {
  HARMONIC_PRESETS,
  gainsMatch,
  harmonicBrightness,
  harmonicFrequencies,
  harmonicPartials,
  matchPreset,
  normalizeGains,
  sanitizeGains,
} from '../../audio/harmonics';

describe('harmonic stack', () => {
  it('creates integer multiples of the fundamental', () => {
    expect(harmonicFrequencies(220)).toEqual([220, 440, 660, 880]);
  });

  it('keeps ratios but limits the sum to avoid clipping', () => {
    const normalized = normalizeGains([1, 1, 1, 1]);
    expect(normalized.reduce((sum, gain) => sum + gain, 0)).toBeCloseTo(1, 8);
    expect(normalized[0]).toBeCloseTo(0.25, 8);
    expect(normalized[1] / normalized[0]).toBeCloseTo(1, 8);
  });

  it('leaves a quiet stack unchanged', () => {
    expect(normalizeGains([0.5, 0.2, 0, 0.1])).toEqual([0.5, 0.2, 0, 0.1]);
  });

  it('sanitizes negative and non-finite gains', () => {
    expect(sanitizeGains([-1, Number.NaN, 2, 0.3])).toEqual([0, 0, 1, 0.3]);
  });

  it('exposes partial frequencies with normalized gains', () => {
    const partials = harmonicPartials(220, [1, 0.5, 0.25, 0]);
    expect(partials.map((partial) => partial.multiple)).toEqual([1, 2, 3, 4]);
    expect(partials.map((partial) => partial.frequency)).toEqual([220, 440, 660, 880]);
    expect(partials[1]?.normalizedGain).toBeCloseTo(0.285714, 5);
  });

  it('matches presets and target tolerances', () => {
    expect(matchPreset([1, 0, 0, 0])?.id).toBe('pure');
    expect(matchPreset([1, 0.7, 0.45, 0.25])?.id).toBe('bright');
    expect(matchPreset([1, 0.2, 0.2, 0.2])).toBeNull();
    expect(gainsMatch([1, 0.5, 0.3, 0.15], [1, 0.5, 0.3, 0.15], 0.06)).toBe(true);
    expect(gainsMatch([1, 0.2, 0.3, 0.15], [1, 0.5, 0.3, 0.15], 0.06)).toBe(false);
  });

  it('reports brightness from upper harmonic energy', () => {
    expect(harmonicBrightness([1, 0, 0, 0])).toBe(0);
    expect(harmonicBrightness([1, 0.5, 0.3, 0.15])).toBeGreaterThan(0);
    expect(harmonicBrightness([1, 0.5, 0.3, 0.15])).toBeLessThan(1);
  });

  it('ships four named preset timbres', () => {
    expect(HARMONIC_PRESETS.map((preset) => preset.id)).toEqual([
      'pure',
      'bright',
      'hollow',
      'warm',
    ]);
  });
});
