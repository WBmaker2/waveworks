/** All audio and timing limits live here, with units, so safety rules are easy to audit. */

/** Concert pitch. MIDI note 69 is A4. */
export const A4_HZ = 440;
export const A4_MIDI = 69;

/** Playable range: A1 (55 Hz) through A6 (1760 Hz). */
export const MIN_FREQ = 55;
export const MAX_FREQ = 1760;
export const MIN_MIDI = 33;
export const MAX_MIDI = 81;

/** Master volume is intentionally quiet by default. Values are linear gain, 0–1. */
export const DEFAULT_MASTER_VOLUME = 0.18;
export const MIN_MASTER_VOLUME = 0;
export const MAX_MASTER_VOLUME = 0.6;
export const DEFAULT_VOICE_LEVEL = 0.55;
export const MIN_VOICE_LEVEL = 0;
export const MAX_VOICE_LEVEL = 1;

/** Envelope in seconds. Every note ramps in and out to prevent clicks. */
export const ATTACK_SECONDS = 0.012;
export const RELEASE_SECONDS = 0.03;
export const FADE_SECONDS = 0.01;

/** Lookahead sequencer. Timer is only a poll; note times come from the audio clock. */
export const LOOKAHEAD_SECONDS = 0.1;
export const SCHEDULER_INTERVAL_MS = 25;

/** Hard limits enforced in the audio engine, not just in the interface. */
export const MAX_POLYPHONY = 8;

/** Rhythm controls. */
export const MIN_BPM = 60;
export const MAX_BPM = 160;
export const DEFAULT_BPM = 120;
export const STEP_COUNT = 8;
export const STEP_DIVISION = 2;
export const STEP_NOTE_SECONDS = 0.16;

/** Assessment tolerances. */
export const PITCH_TOLERANCE_CENTS = 25;
export const BPM_TOLERANCE = 2;
export const HARMONIC_TOLERANCE = 0.06;

/** Persistence. */
export const STORAGE_KEY = 'waveworks.progress.v1';
export const STORAGE_VERSION = 1;
