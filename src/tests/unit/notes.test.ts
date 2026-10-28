import { describe, expect, it } from 'vitest';
import {
  centsBetween,
  clampFrequency,
  describeFrequency,
  formatHz,
  frequencyToMidi,
  midiToFrequency,
  midiToName,
  nearestNote,
} from '../../audio/notes';

describe('note math', () => {
  it('maps MIDI 69 to A4 at 440 Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6);
    expect(midiToName(69)).toBe('A4');
  });

  it('maps MIDI 60 to C4 within tuning tolerance', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.625565, 5);
    expect(midiToName(60)).toBe('C4');
  });

  it('doubles frequency at the octave', () => {
    expect(midiToFrequency(81) / midiToFrequency(69)).toBeCloseTo(2, 10);
    expect(midiToFrequency(33)).toBeCloseTo(55, 6);
  });

  it('round-trips frequency and MIDI', () => {
    for (const midi of [33, 48, 60, 69, 81]) {
      expect(frequencyToMidi(midiToFrequency(midi))).toBeCloseTo(midi, 8);
    }
  });

  it('calculates cents between two frequencies', () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 8);
    expect(centsBetween(440, 440)).toBeCloseTo(0, 8);
    expect(centsBetween(440 * 2 ** (25 / 1200), 440)).toBeCloseTo(25, 6);
  });

  it('finds the nearest note and its cents offset', () => {
    const exact = nearestNote(440);
    expect(exact.note.name).toBe('A4');
    expect(exact.cents).toBeCloseTo(0, 8);
    const sharp = nearestNote(445);
    expect(sharp.note.name).toBe('A4');
    expect(sharp.cents).toBeGreaterThan(0);
  });

  it('formats frequency descriptions', () => {
    expect(formatHz(440)).toBe('440 Hz');
    expect(formatHz(55)).toBe('55.0 Hz');
    expect(describeFrequency(440)).toBe('A4');
    expect(describeFrequency(445)).toContain('A4');
    expect(describeFrequency(445)).toContain('+');
  });

  it('clamps the playable frequency range', () => {
    expect(clampFrequency(10)).toBe(55);
    expect(clampFrequency(5000)).toBe(1760);
    expect(clampFrequency(Number.NaN)).toBe(55);
  });
});
