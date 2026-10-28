export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface WaveformMeta {
  id: Waveform;
  nameKo: string;
  descriptionKo: string;
  icon: 'sine' | 'square' | 'saw' | 'triangle';
}

export const WAVEFORMS: readonly WaveformMeta[] = [
  {
    id: 'sine',
    nameKo: '사인',
    descriptionKo: '한 가지 진동만 있어 가장 맑습니다.',
    icon: 'sine',
  },
  {
    id: 'square',
    nameKo: '사각',
    descriptionKo: '홀수 배음이 많아 밝고 단단합니다.',
    icon: 'square',
  },
  {
    id: 'sawtooth',
    nameKo: '톱니',
    descriptionKo: '모든 배음이 들어 있어 거칠고 풍부합니다.',
    icon: 'saw',
  },
  {
    id: 'triangle',
    nameKo: '삼각',
    descriptionKo: '부드러운 홀수 배음으로 둥글게 들립니다.',
    icon: 'triangle',
  },
];

export function isWaveform(value: unknown): value is Waveform {
  return value === 'sine' || value === 'square' || value === 'sawtooth' || value === 'triangle';
}

export function waveformLabel(waveform: Waveform): string {
  return WAVEFORMS.find((item) => item.id === waveform)?.nameKo ?? waveform;
}

/**
 * Relative harmonic magnitudes used by the synthetic spectrum when audio is not playing.
 * The fundamental is always 1; upper partials follow the usual Fourier series.
 */
export function expectedHarmonics(waveform: Waveform, count = 24): number[] {
  const values: number[] = [];
  for (let multiple = 1; multiple <= count; multiple += 1) {
    let amplitude: number;
    if (waveform === 'sine') {
      amplitude = multiple === 1 ? 1 : 0;
    } else if (waveform === 'square') {
      amplitude = multiple % 2 === 1 ? 1 / multiple : 0;
    } else if (waveform === 'sawtooth') {
      amplitude = 1 / multiple;
    } else {
      amplitude = multiple % 2 === 1 ? 1 / (multiple * multiple) : 0;
    }
    values.push(amplitude);
  }
  return values;
}

export function waveformAt(waveform: Waveform, phase: number): number {
  const wrapped = ((phase % 1) + 1) % 1;
  switch (waveform) {
    case 'sine':
      return Math.sin(wrapped * Math.PI * 2);
    case 'square':
      return wrapped < 0.5 ? 0.9 : -0.9;
    case 'sawtooth':
      return (wrapped * 2 - 1) * 0.9;
    case 'triangle':
      return (1 - 4 * Math.abs(wrapped - 0.5)) * 0.9;
  }
}
