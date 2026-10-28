import type { ChordQuality } from '../../audio/chords';
import type { Waveform } from '../../audio/waveforms';

export type ChallengeConcept = 'pitch' | 'waveform' | 'harmonics' | 'chord' | 'rhythm';

export interface ChallengePrediction {
  questionKo: string;
  optionsKo: string[];
  correctIndex: number;
}

export interface ChallengeTarget {
  frequency?: number;
  waveform?: Waveform;
  fundamental?: number;
  harmonics?: number[];
  chord?: {
    rootMidi: number;
    quality: ChordQuality;
  };
  pattern?: (number | null)[];
  bpm?: number;
}

export interface Challenge {
  id: string;
  titleKo: string;
  concept: ChallengeConcept;
  promptKo: string;
  prediction: ChallengePrediction;
  target: ChallengeTarget;
  tolerance?: number;
  targetSummaryKo: string;
  explanationKo: string;
  takeawayKo: string;
  difficulty: 1 | 2 | 3;
}

export interface ChallengeData {
  version: number;
  challenges: Challenge[];
}
