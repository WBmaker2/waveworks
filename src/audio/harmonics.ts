import { HARMONIC_TOLERANCE } from './constants';

export const HARMONIC_COUNT = 4;

export type HarmonicGains = [number, number, number, number];

export interface HarmonicPreset {
  id: 'pure' | 'bright' | 'hollow' | 'warm';
  nameKo: string;
  descriptionKo: string;
  gains: HarmonicGains;
}

export const HARMONIC_PRESETS: readonly HarmonicPreset[] = [
  {
    id: 'pure',
    nameKo: '맑게',
    descriptionKo: '기본음만 남긴 가장 투명한 소리',
    gains: [1, 0, 0, 0],
  },
  {
    id: 'bright',
    nameKo: '밝게',
    descriptionKo: '위쪽 배음을 고르게 더한 소리',
    gains: [1, 0.7, 0.45, 0.25],
  },
  {
    id: 'hollow',
    nameKo: '비게',
    descriptionKo: '2배음 대신 3배음을 살린 속이 빈 소리',
    gains: [1, 0, 0.5, 0],
  },
  {
    id: 'warm',
    nameKo: '따뜻하게',
    descriptionKo: '배음을 부드럽게 겹친 둥근 소리',
    gains: [1, 0.5, 0.3, 0.15],
  },
];

export function clampGain(gain: number): number {
  if (!Number.isFinite(gain)) {
    return 0;
  }
  return Math.min(1, Math.max(0, gain));
}

export function sanitizeGains(gains: readonly number[]): HarmonicGains {
  return [
    clampGain(gains[0] ?? 0),
    clampGain(gains[1] ?? 0),
    clampGain(gains[2] ?? 0),
    clampGain(gains[3] ?? 0),
  ];
}

/**
 * Scale partial gains so their sum stays at or below 1. The ratio between
 * harmonics is preserved, so timbre is unchanged while clipping risk drops.
 */
export function normalizeGains(gains: readonly number[]): HarmonicGains {
  const safe = sanitizeGains(gains);
  const sum = safe.reduce((total, gain) => total + gain, 0);
  if (sum <= 1) {
    return safe;
  }
  return safe.map((gain) => gain / sum) as HarmonicGains;
}

export function harmonicFrequencies(fundamental: number, count = HARMONIC_COUNT): number[] {
  return Array.from({ length: count }, (_, index) => fundamental * (index + 1));
}

export interface HarmonicPartial {
  multiple: number;
  frequency: number;
  gain: number;
  normalizedGain: number;
}

export function harmonicPartials(fundamental: number, gains: readonly number[]): HarmonicPartial[] {
  const normalized = normalizeGains(gains);
  return harmonicFrequencies(fundamental).map((frequency, index) => ({
    multiple: index + 1,
    frequency,
    gain: clampGain(gains[index] ?? 0),
    normalizedGain: normalized[index] ?? 0,
  }));
}

export function matchPreset(gains: readonly number[], tolerance = 0.02): HarmonicPreset | null {
  return (
    HARMONIC_PRESETS.find((preset) =>
      preset.gains.every((gain, index) => Math.abs(gain - (gains[index] ?? 0)) <= tolerance),
    ) ?? null
  );
}

export function gainsMatch(
  gains: readonly number[],
  target: readonly number[],
  tolerance = HARMONIC_TOLERANCE,
): boolean {
  return target.every((gain, index) => Math.abs(gain - (gains[index] ?? 0)) <= tolerance);
}

export function harmonicBrightness(gains: readonly number[]): number {
  const normalized = normalizeGains(gains);
  const total = normalized.reduce((sum, gain) => sum + gain, 0);
  if (total === 0) {
    return 0;
  }
  const upper = normalized[1] + normalized[2] + normalized[3];
  return upper / total;
}
