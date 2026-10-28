import { midiToFrequency, midiToName } from './notes';

export type ChordQuality = 'major' | 'minor';

export const CHORD_INTERVALS: Record<ChordQuality, readonly number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
};

export const QUALITY_LABEL: Record<ChordQuality, string> = {
  major: '메이저',
  minor: '마이너',
};

export interface ChordTone {
  midi: number;
  name: string;
  frequency: number;
  interval: number;
}

export function triadMidiNotes(rootMidi: number, quality: ChordQuality): number[] {
  return CHORD_INTERVALS[quality].map((interval) => rootMidi + interval);
}

export function chordTones(rootMidi: number, quality: ChordQuality): ChordTone[] {
  return CHORD_INTERVALS[quality].map((interval) => {
    const midi = rootMidi + interval;
    return {
      midi,
      name: midiToName(midi),
      frequency: midiToFrequency(midi),
      interval,
    };
  });
}

export function chordLabel(rootMidi: number, quality: ChordQuality): string {
  const rootName = midiToName(rootMidi).replace(/-?\d+$/, '');
  return `${rootName} ${QUALITY_LABEL[quality]}`;
}

export function intervalLabel(quality: ChordQuality): string {
  return CHORD_INTERVALS[quality].join(' · ');
}
