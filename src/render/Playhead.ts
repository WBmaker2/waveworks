export interface PlayheadEvent {
  step: number;
  time: number;
}

/**
 * Visual playhead driven by scheduled event times, not by where the timer
 * happens to fire. The audio clock and the visual clock both use seconds.
 */
export class Playhead {
  private queue: PlayheadEvent[] = [];
  private current: number | null = null;
  private frame = 0;
  private running = false;

  constructor(
    private readonly getTime: () => number,
    private readonly onStep: (step: number | null) => void,
  ) {}

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    const loop = (): void => {
      if (!this.running) {
        return;
      }
      this.update();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  push(step: number, time: number): void {
    this.queue.push({ step, time });
  }

  reset(): void {
    this.queue = [];
    this.current = null;
    this.onStep(null);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.reset();
  }

  destroy(): void {
    this.stop();
  }

  private update(): void {
    const now = this.getTime();
    let next: number | null = this.current;
    while (this.queue.length > 0 && (this.queue[0]?.time ?? Infinity) <= now + 0.001) {
      const event = this.queue.shift();
      next = event ? event.step : next;
    }
    if (next !== this.current) {
      this.current = next;
      this.onStep(next);
    }
  }
}
