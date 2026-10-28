import {
  DEFAULT_BPM,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_VOICE_LEVEL,
  MAX_BPM,
  MAX_FREQ,
  MAX_MASTER_VOLUME,
  MIN_BPM,
  MIN_FREQ,
  STEP_COUNT,
} from '../audio/constants';
import type { ChordQuality } from '../audio/chords';
import { sanitizeGains, type HarmonicGains } from '../audio/harmonics';
import { clamp, clampFrequency, clampMidi } from '../audio/notes';
import { clampClassCap, clampMasterVolume, clampVoiceLevel } from '../audio/safety';
import { isWaveform, type Waveform } from '../audio/waveforms';
import challengeJson from '../data/challenges.json';
import type { Challenge, ChallengeData } from '../features/challenges/types';

export type Route = 'tone' | 'harmonics' | 'chords' | 'rhythm' | 'challenges' | 'teacher';

export interface AppState {
  route: Route;
  tone: {
    waveform: Waveform;
    frequency: number;
    volume: number;
  };
  harmonics: {
    fundamental: number;
    gains: HarmonicGains;
  };
  chord: {
    rootMidi: number;
    quality: ChordQuality;
  };
  rhythm: {
    bpm: number;
    steps: (number | null)[];
    playing: boolean;
    metronome: boolean;
  };
  challenge: {
    currentId: string | null;
    predictions: Record<string, string>;
    answers: Record<string, string>;
    completed: string[];
    activeIds: string[];
  };
  preferences: {
    reducedMotion: boolean;
    visualsOnly: boolean;
    masterVolume: number;
    classVolumeCap: number;
    safetyAcknowledged: boolean;
  };
}

export const CHALLENGES: readonly Challenge[] = (challengeJson as unknown as ChallengeData)
  .challenges;

export const CHALLENGE_IDS = new Set(CHALLENGES.map((challenge) => challenge.id));

export const DEFAULT_RHYTHM_STEPS: (number | null)[] = [60, null, 64, null, 67, null, 64, null];

export function createDefaultState(prefersReducedMotion = false): AppState {
  return {
    route: 'tone',
    tone: {
      waveform: 'sine',
      frequency: 440,
      volume: DEFAULT_VOICE_LEVEL,
    },
    harmonics: {
      fundamental: 220,
      gains: [1, 0, 0, 0],
    },
    chord: {
      rootMidi: 67,
      quality: 'major',
    },
    rhythm: {
      bpm: DEFAULT_BPM,
      steps: [...DEFAULT_RHYTHM_STEPS],
      playing: false,
      metronome: true,
    },
    challenge: {
      currentId: null,
      predictions: {},
      answers: {},
      completed: [],
      activeIds: CHALLENGES.map((challenge) => challenge.id),
    },
    preferences: {
      reducedMotion: prefersReducedMotion,
      visualsOnly: false,
      masterVolume: DEFAULT_MASTER_VOLUME,
      classVolumeCap: MAX_MASTER_VOLUME,
      safetyAcknowledged: false,
    },
  };
}

export function getChallenge(id: string | null): Challenge | null {
  if (!id) {
    return null;
  }
  return CHALLENGES.find((challenge) => challenge.id === id) ?? null;
}

export function sanitizeState(raw: unknown, prefersReducedMotion = false): AppState {
  const defaults = createDefaultState(prefersReducedMotion);
  if (!isRecord(raw)) {
    return defaults;
  }

  const tone = isRecord(raw.tone) ? raw.tone : {};
  const harmonics = isRecord(raw.harmonics) ? raw.harmonics : {};
  const chord = isRecord(raw.chord) ? raw.chord : {};
  const rhythm = isRecord(raw.rhythm) ? raw.rhythm : {};
  const challenge = isRecord(raw.challenge) ? raw.challenge : {};
  const preferences = isRecord(raw.preferences) ? raw.preferences : {};

  const waveform = isWaveform(tone.waveform) ? tone.waveform : defaults.tone.waveform;
  const frequency = clampFrequency(numberOr(tone.frequency, defaults.tone.frequency));
  const volume = clampVoiceLevel(numberOr(tone.volume, defaults.tone.volume));
  const fundamental = clampFrequency(
    numberOr(harmonics.fundamental, defaults.harmonics.fundamental),
  );
  const gains = sanitizeGains(
    Array.isArray(harmonics.gains) ? harmonics.gains : defaults.harmonics.gains,
  );
  const rootMidi = Math.round(clamp(numberOr(chord.rootMidi, defaults.chord.rootMidi), 60, 83));
  const quality: ChordQuality = chord.quality === 'minor' ? 'minor' : 'major';
  const bpm = clamp(numberOr(rhythm.bpm, defaults.rhythm.bpm), MIN_BPM, MAX_BPM);
  const steps = sanitizeSteps(rhythm.steps);
  const metronome = typeof rhythm.metronome === 'boolean' ? rhythm.metronome : true;

  const activeIds = sanitizeActiveIds(challenge.activeIds);
  const completed = sanitizeIdList(challenge.completed);
  const predictions = sanitizeStringRecord(challenge.predictions, (value, id) => {
    const parsed = Number.parseInt(value, 10);
    const definition = CHALLENGES.find((item) => item.id === id);
    return (
      Number.isInteger(parsed) &&
      parsed >= 0 &&
      parsed < (definition?.prediction.optionsKo.length ?? 0)
    );
  });
  const answers = sanitizeStringRecord(challenge.answers, (_value, id) => CHALLENGE_IDS.has(id));
  const rawCurrentId = typeof challenge.currentId === 'string' ? challenge.currentId : null;
  const currentId = rawCurrentId && CHALLENGE_IDS.has(rawCurrentId) ? rawCurrentId : null;

  const classVolumeCap = clampClassCap(
    numberOr(preferences.classVolumeCap, defaults.preferences.classVolumeCap),
  );
  const masterVolume = clampMasterVolume(
    numberOr(preferences.masterVolume, DEFAULT_MASTER_VOLUME),
    classVolumeCap,
  );

  const result: AppState = {
    ...defaults,
    tone: { waveform, frequency, volume },
    harmonics: { fundamental, gains },
    chord: { rootMidi, quality },
    rhythm: {
      bpm,
      steps,
      playing: false,
      metronome,
    },
    challenge: {
      currentId,
      predictions,
      answers,
      completed,
      activeIds,
    },
    preferences: {
      reducedMotion:
        typeof preferences.reducedMotion === 'boolean'
          ? preferences.reducedMotion
          : prefersReducedMotion,
      visualsOnly: Boolean(preferences.visualsOnly),
      masterVolume,
      classVolumeCap,
      safetyAcknowledged: Boolean(preferences.safetyAcknowledged),
    },
  };

  if (result.tone.frequency < MIN_FREQ || result.tone.frequency > MAX_FREQ) {
    result.tone.frequency = defaults.tone.frequency;
  }
  return result;
}

export function resetChallengeProgress(state: AppState): AppState {
  const next = structuredClone(state);
  next.challenge.currentId = null;
  next.challenge.predictions = {};
  next.challenge.answers = {};
  next.challenge.completed = [];
  next.rhythm.playing = false;
  return next;
}

function sanitizeSteps(raw: unknown): (number | null)[] {
  const source = Array.isArray(raw) ? raw : DEFAULT_RHYTHM_STEPS;
  return Array.from({ length: STEP_COUNT }, (_, index) => {
    const value = source[index];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }
    return clampMidi(value);
  });
}

function sanitizeActiveIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return CHALLENGES.map((challenge) => challenge.id);
  }
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value === 'string' && CHALLENGE_IDS.has(value)) {
      seen.add(value);
    }
  }
  return Array.from(seen);
}

function sanitizeIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return Array.from(
    new Set(
      raw.filter((value): value is string => typeof value === 'string' && CHALLENGE_IDS.has(value)),
    ),
  );
}

function sanitizeStringRecord(
  raw: unknown,
  accept: (value: string, id: string) => boolean,
): Record<string, string> {
  if (!isRecord(raw)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value === 'string' && CHALLENGE_IDS.has(id) && accept(value, id)) {
      result[id] = value;
    }
  }
  return result;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
