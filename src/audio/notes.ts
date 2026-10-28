import { A4_HZ, A4_MIDI, MAX_FREQ, MAX_MIDI, MIN_FREQ, MIN_MIDI } from './constants';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface Note {
  midi: number;
  name: string;
  frequency: number;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function midiToFrequency(midi: number): number {
  return A4_HZ * 2 ** ((midi - A4_MIDI) / 12);
}

export function frequencyToMidi(frequency: number): number {
  return A4_MIDI + 12 * Math.log2(frequency / A4_HZ);
}

export function midiToName(midi: number): string {
  const rounded = Math.round(midi);
  const pitchClass = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
}

export function midiToNote(midi: number): Note {
  const rounded = Math.round(midi);
  return {
    midi: rounded,
    name: midiToName(rounded),
    frequency: midiToFrequency(rounded),
  };
}

export function noteNameFromFrequency(frequency: number): string {
  return midiToName(frequencyToMidi(frequency));
}

export function nearestNote(frequency: number): { note: Note; cents: number } {
  const exactMidi = frequencyToMidi(frequency);
  const rounded = Math.round(exactMidi);
  return {
    note: midiToNote(rounded),
    cents: (exactMidi - rounded) * 100,
  };
}

export function centsBetween(frequency: number, target: number): number {
  return 1200 * Math.log2(frequency / target);
}

export function clampFrequency(frequency: number): number {
  return clamp(frequency, MIN_FREQ, MAX_FREQ);
}

export function clampMidi(midi: number): number {
  return Math.round(clamp(midi, MIN_MIDI, MAX_MIDI));
}

export function formatHz(frequency: number): string {
  if (frequency < 100) {
    return `${frequency.toFixed(1)} Hz`;
  }
  return `${Math.round(frequency)} Hz`;
}

export function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  if (rounded === 0) {
    return '0¢';
  }
  return `${rounded > 0 ? '+' : ''}${rounded}¢`;
}

export function describeFrequency(frequency: number): string {
  const { note, cents } = nearestNote(frequency);
  if (Math.abs(cents) < 0.6) {
    return note.name;
  }
  return `${note.name} ${formatCents(cents)}`;
}
