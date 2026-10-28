import { BPM_TOLERANCE, PITCH_TOLERANCE_CENTS, STEP_COUNT } from '../../audio/constants';
import type { ChordQuality } from '../../audio/chords';
import { chordLabel } from '../../audio/chords';
import { gainsMatch, normalizeGains } from '../../audio/harmonics';
import { centsBetween, formatHz, midiToName, nearestNote } from '../../audio/notes';
import { formatPercent } from '../../audio/safety';
import { bpmWithinTolerance } from '../../audio/scheduler';
import type { Waveform } from '../../audio/waveforms';
import { waveformLabel } from '../../audio/waveforms';
import type { Challenge, ChallengeConcept } from './types';

export interface ChallengeSnapshot {
  tone: {
    waveform: Waveform;
    frequency: number;
    volume: number;
  };
  harmonics: {
    fundamental: number;
    gains: number[];
  };
  chord: {
    rootMidi: number;
    quality: ChordQuality;
  };
  rhythm: {
    bpm: number;
    steps: (number | null)[];
  };
}

export interface Evaluation {
  correct: boolean;
  currentSummary: string;
  targetSummary: string;
  detail: string;
  direction: 'low' | 'high' | 'match' | 'different';
}

export const CONCEPT_ROOM: Record<ChallengeConcept, string> = {
  pitch: 'tone',
  waveform: 'tone',
  harmonics: 'harmonics',
  chord: 'chords',
  rhythm: 'rhythm',
};

export function evaluateChallenge(challenge: Challenge, snapshot: ChallengeSnapshot): Evaluation {
  const target = challenge.target;

  if (challenge.concept === 'pitch' && typeof target.frequency === 'number') {
    const tolerance = challenge.tolerance ?? PITCH_TOLERANCE_CENTS;
    const cents = centsBetween(snapshot.tone.frequency, target.frequency);
    const correct = Math.abs(cents) <= tolerance;
    const { note } = nearestNote(snapshot.tone.frequency);
    return {
      correct,
      currentSummary: `${note.name} · ${formatHz(snapshot.tone.frequency)}`,
      targetSummary: challenge.targetSummaryKo,
      direction: correct ? 'match' : cents > 0 ? 'high' : 'low',
      detail: correct
        ? `목표와 ${Math.abs(Math.round(cents))}센트 안쪽으로 맞았습니다.`
        : cents > 0
          ? `목표보다 ${Math.round(cents)}센트 높습니다. 주파수를 조금 낮춰 보세요.`
          : `목표보다 ${Math.abs(Math.round(cents))}센트 낮습니다. 주파수를 조금 높여 보세요.`,
    };
  }

  if (challenge.concept === 'waveform' && target.waveform) {
    const waveformOk = snapshot.tone.waveform === target.waveform;
    const frequencyOk =
      typeof target.frequency !== 'number' ||
      Math.abs(centsBetween(snapshot.tone.frequency, target.frequency)) <=
        (challenge.tolerance ?? PITCH_TOLERANCE_CENTS);
    const correct = waveformOk && frequencyOk;
    return {
      correct,
      currentSummary: `${waveformLabel(snapshot.tone.waveform)}파 · ${formatHz(
        snapshot.tone.frequency,
      )}`,
      targetSummary: challenge.targetSummaryKo,
      direction: correct ? 'match' : 'different',
      detail: correct
        ? '배음이 풍부한 파형과 주파수를 모두 맞췄습니다.'
        : !waveformOk
          ? '파형이 아직 목표와 다릅니다. 배음이 많은 쪽을 골라 보세요.'
          : '파형은 맞았습니다. 주파수를 목표에 가깝게 맞춰 보세요.',
    };
  }

  if (challenge.concept === 'harmonics' && target.harmonics) {
    const tolerance = challenge.tolerance ?? 0.06;
    const gainsOk = gainsMatch(snapshot.harmonics.gains, target.harmonics, tolerance);
    const frequencyOk =
      typeof target.fundamental !== 'number' ||
      Math.abs(centsBetween(snapshot.harmonics.fundamental, target.fundamental)) <= 15;
    const normalized = normalizeGains(snapshot.harmonics.gains);
    const correct = gainsOk && frequencyOk;
    return {
      correct,
      currentSummary: `${formatHz(snapshot.harmonics.fundamental)} · ${normalized
        .map(formatPercent)
        .join(' / ')}`,
      targetSummary: challenge.targetSummaryKo,
      direction: correct ? 'match' : 'different',
      detail: correct
        ? '네 배음의 비율이 목표 스펙트럼과 일치합니다.'
        : !frequencyOk
          ? '기본음이 목표와 다릅니다. 기본음을 220 Hz에 맞춰 보세요.'
          : '배음 비율이 아직 목표와 다릅니다. 각 슬라이더를 조금씩 조정해 보세요.',
    };
  }

  if (challenge.concept === 'chord' && target.chord) {
    const correct =
      snapshot.chord.rootMidi === target.chord.rootMidi &&
      snapshot.chord.quality === target.chord.quality;
    return {
      correct,
      currentSummary: chordLabel(snapshot.chord.rootMidi, snapshot.chord.quality),
      targetSummary: challenge.targetSummaryKo,
      direction: correct ? 'match' : 'different',
      detail: correct
        ? '근음과 화음 종류를 모두 맞췄습니다.'
        : snapshot.chord.rootMidi !== target.chord.rootMidi
          ? '근음이 목표와 다릅니다. 건반에서 C4를 골라 보세요.'
          : '근음은 맞았습니다. 메이저와 마이너 중 목표를 다시 확인하세요.',
    };
  }

  if (challenge.concept === 'rhythm' && target.pattern) {
    const targetSteps = normalizePattern(target.pattern);
    const currentSteps = normalizePattern(snapshot.rhythm.steps);
    const patternOk = targetSteps.every((step, index) => step === currentSteps[index]);
    const bpmOk =
      typeof target.bpm !== 'number' ||
      bpmWithinTolerance(snapshot.rhythm.bpm, target.bpm, challenge.tolerance ?? BPM_TOLERANCE);
    const mismatchCount = targetSteps.filter((step, index) => step !== currentSteps[index]).length;
    const correct = patternOk && bpmOk;
    return {
      correct,
      currentSummary: `${formatPattern(currentSteps)} · ${snapshot.rhythm.bpm} BPM`,
      targetSummary: challenge.targetSummaryKo,
      direction: correct ? 'match' : 'different',
      detail: correct
        ? '8칸의 음과 템포를 모두 맞췄습니다.'
        : !patternOk
          ? `${mismatchCount}칸이 목표와 다릅니다. 쉼표와 음의 위치를 확인하세요.`
          : '음은 모두 맞았습니다. 템포를 목표 BPM에 맞춰 보세요.',
    };
  }

  return {
    correct: false,
    currentSummary: '아직 목표를 확인할 수 없습니다.',
    targetSummary: challenge.targetSummaryKo,
    direction: 'different',
    detail: '이 도전의 목표 값을 다시 확인해 주세요.',
  };
}

function normalizePattern(pattern: readonly (number | null)[]): (number | null)[] {
  return Array.from({ length: STEP_COUNT }, (_, index) => {
    const value = pattern[index];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  });
}

export function formatPattern(steps: readonly (number | null)[]): string {
  return steps
    .map((step, index) =>
      step === null ? `${index + 1}:쉼표` : `${index + 1}:${midiToName(step)}`,
    )
    .join(' ');
}
