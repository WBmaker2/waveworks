import { describe, expect, it } from 'vitest';
import {
  CHORD_INTERVALS,
  chordLabel,
  chordTones,
  intervalLabel,
  triadMidiNotes,
} from '../../audio/chords';

describe('chord intervals', () => {
  it('builds a major triad from 0, 4, 7 semitones', () => {
    expect(CHORD_INTERVALS.major).toEqual([0, 4, 7]);
    expect(triadMidiNotes(60, 'major')).toEqual([60, 64, 67]);
  });

  it('builds a minor triad from 0, 3, 7 semitones', () => {
    expect(CHORD_INTERVALS.minor).toEqual([0, 3, 7]);
    expect(triadMidiNotes(60, 'minor')).toEqual([60, 63, 67]);
  });

  it('returns note names, frequencies and intervals', () => {
    const tones = chordTones(60, 'major');
    expect(tones.map((tone) => tone.name)).toEqual(['C4', 'E4', 'G4']);
    expect(tones.map((tone) => tone.interval)).toEqual([0, 4, 7]);
    expect(tones[1]?.frequency).toBeCloseTo(329.627557, 5);
  });

  it('builds a minor triad on another root', () => {
    const tones = chordTones(57, 'minor');
    expect(tones.map((tone) => tone.name)).toEqual(['A3', 'C4', 'E4']);
    expect(tones.map((tone) => tone.interval)).toEqual([0, 3, 7]);
  });

  it('labels chords and intervals', () => {
    expect(chordLabel(60, 'major')).toBe('C 메이저');
    expect(chordLabel(57, 'minor')).toBe('A 마이너');
    expect(intervalLabel('major')).toBe('0 · 4 · 7');
    expect(intervalLabel('minor')).toBe('0 · 3 · 7');
  });
});
