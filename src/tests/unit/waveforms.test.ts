import { describe, expect, it } from 'vitest';
import {
  WAVEFORMS,
  expectedHarmonics,
  isWaveform,
  waveformAt,
  waveformLabel,
} from '../../audio/waveforms';

describe('waveforms', () => {
  it('ships four distinct waveform choices', () => {
    expect(WAVEFORMS.map((waveform) => waveform.id)).toEqual([
      'sine',
      'square',
      'sawtooth',
      'triangle',
    ]);
    expect(waveformLabel('sawtooth')).toBe('톱니');
    expect(isWaveform('square')).toBe(true);
    expect(isWaveform('noise')).toBe(false);
  });

  it('gives each waveform a different harmonic recipe', () => {
    const sine = expectedHarmonics('sine', 4);
    const square = expectedHarmonics('square', 4);
    const saw = expectedHarmonics('sawtooth', 4);
    const triangle = expectedHarmonics('triangle', 4);

    expect(sine).toEqual([1, 0, 0, 0]);
    expect(square[0]).toBe(1);
    expect(square[1]).toBe(0);
    expect(square[2]).toBeCloseTo(1 / 3, 8);
    expect(saw).toEqual([1, 0.5, 1 / 3, 0.25]);
    expect(triangle[2]).toBeCloseTo(1 / 9, 8);
    expect(
      new Set([sine.join(','), square.join(','), saw.join(','), triangle.join(',')]).size,
    ).toBe(4);
  });

  it('renders distinct time-domain shapes', () => {
    const phase = 0.3;
    const values = ['sine', 'square', 'sawtooth', 'triangle'] as const;
    const atPhase = values.map((waveform) => waveformAt(waveform, phase));
    expect(new Set(atPhase.map((value) => value.toFixed(3))).size).toBe(4);
    expect(waveformAt('square', 0.25)).toBeGreaterThan(0);
    expect(waveformAt('square', 0.75)).toBeLessThan(0);
    expect(waveformAt('sine', 0.25)).toBeCloseTo(1, 8);
  });
});
