import { describe, expect, it } from 'vitest';
import {
  StepScheduler,
  bpmWithinTolerance,
  countsStepsInWindow,
  normalizeSteps,
  stepDuration,
} from '../../audio/scheduler';

describe('sequencer timing', () => {
  it('computes eighth-note duration at 60, 120 and 160 BPM', () => {
    expect(stepDuration(60)).toBeCloseTo(0.5, 10);
    expect(stepDuration(120)).toBeCloseTo(0.25, 10);
    expect(stepDuration(160)).toBeCloseTo(0.1875, 10);
  });

  it('counts steps in a window', () => {
    expect(countsStepsInWindow(120, 1)).toBeCloseTo(4, 8);
    expect(countsStepsInWindow(60, 4)).toBeCloseTo(8, 8);
  });

  it('schedules only steps inside the lookahead window', () => {
    const scheduler = new StepScheduler({
      bpm: 120,
      steps: [60, null, 64, null, 67, null, 64, null],
      lookahead: 0.1,
    });
    scheduler.start(0);

    const first = scheduler.tick(0);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ index: 0, loopStep: 0, time: 0, midi: 60 });

    const second = scheduler.tick(0.2);
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ index: 1, loopStep: 1, time: 0.25, midi: null });

    const third = scheduler.tick(0.41);
    expect(third).toHaveLength(1);
    expect(third[0]?.time).toBeCloseTo(0.5, 10);
  });

  it('advances exactly eight steps over 1.9 seconds at 120 BPM', () => {
    const scheduler = new StepScheduler({
      bpm: 120,
      steps: [60, 62, 64, 65, 67, 69, 71, 72],
    });
    scheduler.start(0);
    const scheduled = [];
    for (let time = 0; time <= 1.9; time += 0.025) {
      scheduled.push(...scheduler.tick(time));
    }
    expect(scheduled).toHaveLength(8);
    expect(scheduled.map((event) => event.loopStep)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(scheduled[7]?.time).toBeCloseTo(1.75, 10);
  });

  it('does not duplicate scheduled times and wraps the pattern', () => {
    const scheduler = new StepScheduler({
      bpm: 160,
      steps: [60, null, 64, null, 67, null, 64, null],
      lookahead: 1.6,
    });
    scheduler.start(10);
    const events = scheduler.tick(10);
    const times = events.map((event) => event.time);
    expect(new Set(times).size).toBe(times.length);
    expect(events.length).toBeGreaterThan(8);
    expect(events[8]?.loopStep).toBe(0);
  });

  it('changes tempo for future steps', () => {
    const scheduler = new StepScheduler({ bpm: 120, steps: [60], lookahead: 0.1 });
    scheduler.start(0);
    const first = scheduler.tick(0);
    expect(first[0]?.time).toBe(0);
    scheduler.setBpm(60);
    const next = scheduler.tick(0.2);
    expect(next[0]?.time).toBeCloseTo(0.25, 10);
    expect(scheduler.tick(0.7)[0]?.time).toBeCloseTo(0.75, 10);
  });

  it('returns nothing when stopped', () => {
    const scheduler = new StepScheduler({ bpm: 120, steps: [60] });
    scheduler.start(0);
    scheduler.stop();
    expect(scheduler.tick(0)).toEqual([]);
  });

  it('normalizes patterns to eight slots', () => {
    expect(normalizeSteps([60, 61])).toEqual([60, 61, null, null, null, null, null, null]);
    expect(normalizeSteps([60, 61, 62, 63, 64, 65, 66, 67, 68])).toHaveLength(8);
    expect(normalizeSteps([Number.NaN, 60.4])[0]).toBeNull();
    expect(normalizeSteps([Number.NaN, 60.4])[1]).toBe(60);
  });

  it('compares BPM within tolerance', () => {
    expect(bpmWithinTolerance(120, 120)).toBe(true);
    expect(bpmWithinTolerance(122, 120)).toBe(true);
    expect(bpmWithinTolerance(123, 120)).toBe(false);
  });
});
