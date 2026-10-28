import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../app/state';
import {
  CONCEPT_ROOM,
  evaluateChallenge,
  formatPattern,
  type ChallengeSnapshot,
} from '../../features/challenges/evaluate';
import type { Challenge } from '../../features/challenges/types';

function challenge(id: string): Challenge {
  const found = CHALLENGES.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Missing challenge ${id}`);
  }
  return found;
}

function snapshot(
  overrides: {
    frequency?: number;
    waveform?: 'sine' | 'square' | 'sawtooth' | 'triangle';
    fundamental?: number;
    gains?: [number, number, number, number];
    rootMidi?: number;
    quality?: 'major' | 'minor';
    bpm?: number;
    steps?: (number | null)[];
  } = {},
): ChallengeSnapshot {
  return {
    tone: {
      waveform: overrides.waveform ?? 'sine',
      frequency: overrides.frequency ?? 440,
      volume: 0.55,
    },
    harmonics: {
      fundamental: overrides.fundamental ?? 220,
      gains: overrides.gains ?? [1, 0, 0, 0],
    },
    chord: {
      rootMidi: overrides.rootMidi ?? 60,
      quality: overrides.quality ?? 'major',
    },
    rhythm: {
      bpm: overrides.bpm ?? 120,
      steps: overrides.steps ?? [60, null, 60, null, 64, null, 67, null],
    },
  };
}

describe('challenge evaluation', () => {
  it('has five valid challenges with in-range prediction answers', () => {
    expect(CHALLENGES).toHaveLength(5);
    for (const item of CHALLENGES) {
      expect(item.prediction.correctIndex).toBeGreaterThanOrEqual(0);
      expect(item.prediction.correctIndex).toBeLessThan(item.prediction.optionsKo.length);
    }
  });

  it('maps concepts to the correct room', () => {
    expect(CONCEPT_ROOM.pitch).toBe('tone');
    expect(CONCEPT_ROOM.waveform).toBe('tone');
    expect(CONCEPT_ROOM.harmonics).toBe('harmonics');
    expect(CONCEPT_ROOM.chord).toBe('chords');
    expect(CONCEPT_ROOM.rhythm).toBe('rhythm');
  });

  it('matches a pitch within 25 cents', () => {
    const item = challenge('pitch-octave');
    const correct = evaluateChallenge(item, snapshot({ frequency: 880 }));
    expect(correct.correct).toBe(true);
    expect(correct.direction).toBe('match');

    const high = evaluateChallenge(item, snapshot({ frequency: 900 }));
    expect(high.correct).toBe(false);
    expect(high.direction).toBe('high');

    const low = evaluateChallenge(item, snapshot({ frequency: 850 }));
    expect(low.correct).toBe(false);
    expect(low.direction).toBe('low');
  });

  it('requires both the target waveform and frequency', () => {
    const item = challenge('wave-bright');
    expect(evaluateChallenge(item, snapshot({ waveform: 'square', frequency: 220 })).correct).toBe(
      true,
    );
    expect(evaluateChallenge(item, snapshot({ waveform: 'sine', frequency: 220 })).correct).toBe(
      false,
    );
    expect(evaluateChallenge(item, snapshot({ waveform: 'square', frequency: 440 })).correct).toBe(
      false,
    );
  });

  it('matches the harmonic gain stack and fundamental', () => {
    const item = challenge('harmonics-warm');
    expect(
      evaluateChallenge(item, snapshot({ fundamental: 220, gains: [1, 0.5, 0.3, 0.15] })).correct,
    ).toBe(true);
    expect(
      evaluateChallenge(item, snapshot({ fundamental: 220, gains: [1, 0.2, 0.3, 0.15] })).correct,
    ).toBe(false);
    expect(
      evaluateChallenge(item, snapshot({ fundamental: 440, gains: [1, 0.5, 0.3, 0.15] })).correct,
    ).toBe(false);
  });

  it('matches chord root and quality exactly', () => {
    const item = challenge('chord-c-major');
    expect(evaluateChallenge(item, snapshot({ rootMidi: 60, quality: 'major' })).correct).toBe(
      true,
    );
    expect(evaluateChallenge(item, snapshot({ rootMidi: 60, quality: 'minor' })).correct).toBe(
      false,
    );
    expect(evaluateChallenge(item, snapshot({ rootMidi: 62, quality: 'major' })).correct).toBe(
      false,
    );
  });

  it('matches the rhythm pattern and BPM tolerance', () => {
    const item = challenge('rhythm-eighth');
    const correctSteps = [60, null, 60, null, 64, null, 67, null];
    expect(evaluateChallenge(item, snapshot({ steps: correctSteps, bpm: 120 })).correct).toBe(true);
    expect(evaluateChallenge(item, snapshot({ steps: correctSteps, bpm: 122 })).correct).toBe(true);
    expect(evaluateChallenge(item, snapshot({ steps: correctSteps, bpm: 124 })).correct).toBe(
      false,
    );
    expect(
      evaluateChallenge(
        item,
        snapshot({ steps: [60, null, 62, null, 64, null, 67, null], bpm: 120 }),
      ).correct,
    ).toBe(false);
  });

  it('formats rhythm patterns with note names', () => {
    const text = formatPattern([60, null, 64, null, 67, null, 64, null]);
    expect(text).toContain('C4');
    expect(text).toContain('E4');
    expect(text).toContain('G4');
    expect(text).toContain('쉼표');
  });
});
