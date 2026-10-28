import { describe, expect, it } from 'vitest';
import {
  CHALLENGES,
  createDefaultState,
  resetChallengeProgress,
  sanitizeState,
} from '../../app/state';
import { MAX_MASTER_VOLUME } from '../../audio/constants';

describe('state sanitization', () => {
  it('creates a quiet, safe default state', () => {
    const state = createDefaultState();
    expect(state.preferences.masterVolume).toBeCloseTo(0.18, 8);
    expect(state.preferences.classVolumeCap).toBe(MAX_MASTER_VOLUME);
    expect(state.challenge.activeIds).toHaveLength(CHALLENGES.length);
    expect(state.rhythm.playing).toBe(false);
  });

  it('clamps loaded values into safe ranges', () => {
    const state = sanitizeState({
      tone: { waveform: 'square', frequency: 99999, volume: 4 },
      harmonics: { fundamental: 1, gains: [5, -1, 2, 0] },
      chord: { rootMidi: 83, quality: 'minor' },
      rhythm: { bpm: 999, steps: [60, 60, 60], metronome: false },
      preferences: {
        masterVolume: 5,
        classVolumeCap: 0.2,
        visualsOnly: true,
        safetyAcknowledged: true,
      },
    });
    expect(state.tone.waveform).toBe('square');
    expect(state.tone.frequency).toBe(1760);
    expect(state.tone.volume).toBe(1);
    expect(state.harmonics.fundamental).toBe(55);
    expect(state.harmonics.gains).toEqual([1, 0, 1, 0]);
    expect(state.chord.rootMidi).toBe(83);
    expect(state.chord.quality).toBe('minor');
    expect(state.rhythm.bpm).toBe(160);
    expect(state.rhythm.steps).toHaveLength(8);
    expect(state.preferences.masterVolume).toBeLessThanOrEqual(0.2);
    expect(state.preferences.visualsOnly).toBe(true);
  });

  it('drops unknown challenge ids and invalid predictions', () => {
    const state = sanitizeState({
      challenge: {
        activeIds: ['pitch-octave', 'nope', 'pitch-octave'],
        completed: ['pitch-octave', 'nope'],
        predictions: { 'pitch-octave': '0', 'wave-bright': '99', nope: '0' },
        answers: { 'pitch-octave': 'A5', nope: 'x' },
        currentId: 'nope',
      },
    });
    expect(state.challenge.activeIds).toEqual(['pitch-octave']);
    expect(state.challenge.completed).toEqual(['pitch-octave']);
    expect(state.challenge.predictions).toEqual({ 'pitch-octave': '0' });
    expect(state.challenge.answers).toEqual({ 'pitch-octave': 'A5' });
    expect(state.challenge.currentId).toBeNull();
  });

  it('resets challenge progress but keeps teacher choices', () => {
    const source = createDefaultState();
    source.challenge.completed = ['pitch-octave'];
    source.challenge.answers = { 'pitch-octave': 'A5' };
    source.challenge.currentId = 'pitch-octave';
    source.challenge.activeIds = ['pitch-octave'];
    source.preferences.classVolumeCap = 0.3;
    const reset = resetChallengeProgress(source);
    expect(reset.challenge.completed).toEqual([]);
    expect(reset.challenge.answers).toEqual({});
    expect(reset.challenge.currentId).toBeNull();
    expect(reset.challenge.activeIds).toEqual(['pitch-octave']);
    expect(reset.preferences.classVolumeCap).toBeCloseTo(0.3, 8);
    expect(source.challenge.completed).toEqual(['pitch-octave']);
  });

  it('falls back safely on malformed input', () => {
    const state = sanitizeState('not an object');
    expect(state.route).toBe('tone');
    expect(state.tone.frequency).toBe(440);
    expect(state.challenge.completed).toEqual([]);
  });
});
