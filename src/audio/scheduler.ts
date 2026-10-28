import {
  BPM_TOLERANCE,
  LOOKAHEAD_SECONDS,
  MAX_BPM,
  MIN_BPM,
  STEP_COUNT,
  STEP_DIVISION,
} from './constants';
import { clamp } from './notes';

export interface ScheduledStep {
  /** Index in the pattern, 0-based. */
  index: number;
  /** Position in the loop, 0-based. */
  loopStep: number;
  /** Exact audio-clock time, in seconds. */
  time: number;
  /** MIDI note or null for a rest. */
  midi: number | null;
}

export interface SchedulerOptions {
  bpm: number;
  steps: readonly (number | null)[];
  lookahead?: number;
}

export function stepDuration(bpm: number, division = STEP_DIVISION): number {
  const safeBpm = clamp(bpm, MIN_BPM, MAX_BPM);
  return 60 / safeBpm / division;
}

export function bpmWithinTolerance(
  actual: number,
  target: number,
  tolerance = BPM_TOLERANCE,
): boolean {
  return Math.abs(actual - target) <= tolerance;
}

/**
 * Deterministic lookahead scheduler. `tick(now)` returns every step that falls
 * inside the lookahead window and advances the internal cursor. The caller
 * schedules audio at the returned `time` values; no note timing depends on a
 * timer. This class is unit-tested with a fake clock.
 */
export class StepScheduler {
  private bpm: number;
  private steps: readonly (number | null)[];
  private readonly lookahead: number;
  private running = false;
  private nextStepTime = 0;
  private stepIndex = 0;

  constructor(options: SchedulerOptions) {
    this.bpm = clamp(options.bpm, MIN_BPM, MAX_BPM);
    this.steps = normalizeSteps(options.steps);
    this.lookahead = options.lookahead ?? LOOKAHEAD_SECONDS;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get nextTime(): number {
    return this.nextStepTime;
  }

  get currentIndex(): number {
    return this.stepIndex;
  }

  get stepSeconds(): number {
    return stepDuration(this.bpm);
  }

  start(now: number): void {
    this.running = true;
    this.stepIndex = 0;
    this.nextStepTime = now;
  }

  stop(): void {
    this.running = false;
  }

  setBpm(bpm: number): void {
    this.bpm = clamp(bpm, MIN_BPM, MAX_BPM);
  }

  setSteps(steps: readonly (number | null)[]): void {
    this.steps = normalizeSteps(steps);
  }

  tick(now: number): ScheduledStep[] {
    if (!this.running) {
      return [];
    }
    const scheduled: ScheduledStep[] = [];
    const horizon = now + this.lookahead;
    let guard = 0;
    while (this.nextStepTime < horizon && guard < 256) {
      guard += 1;
      const loopStep = this.stepIndex % this.steps.length;
      scheduled.push({
        index: this.stepIndex,
        loopStep,
        time: this.nextStepTime,
        midi: this.steps[loopStep] ?? null,
      });
      this.nextStepTime += this.stepSeconds;
      this.stepIndex += 1;
    }
    return scheduled;
  }
}

export function normalizeSteps(steps: readonly (number | null)[]): (number | null)[] {
  return Array.from({ length: STEP_COUNT }, (_, index) => {
    const value = steps[index];
    return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
  });
}

export function countsStepsInWindow(
  bpm: number,
  seconds: number,
  division = STEP_DIVISION,
): number {
  return seconds / stepDuration(bpm, division);
}
