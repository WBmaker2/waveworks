import { ATTACK_SECONDS, RELEASE_SECONDS } from './constants';
import { normalizeGains } from './harmonics';
import { voicePeak } from './safety';
import type { Waveform } from './waveforms';

export interface VoicePartial {
  multiple: number;
  gain: number;
}

export interface VoiceSpec {
  frequency: number;
  waveform: Waveform;
  partials?: VoicePartial[];
  level: number;
  attack?: number;
  release?: number;
  /** Scheduled notes release automatically after this many seconds. */
  duration?: number;
  when?: number;
}

/**
 * One synthesized voice. Oscillators feed partial gains, then one envelope.
 * Held voices can be retuned; one-shot voices schedule their own release.
 */
export class Voice {
  private readonly ctx: AudioContext;
  private readonly envelope: GainNode;
  private readonly oscillators: OscillatorNode[] = [];
  private readonly partialGains: GainNode[] = [];
  private readonly multiples: number[] = [];
  private readonly attack: number;
  private readonly release: number;
  private readonly duration: number | null;
  private peak: number;
  private startTime: number;
  private stopped = false;
  private cleaned = false;

  constructor(
    ctx: AudioContext,
    destination: AudioNode,
    spec: VoiceSpec,
    private readonly onEnded: () => void,
  ) {
    this.ctx = ctx;
    this.attack = Math.max(0.005, spec.attack ?? ATTACK_SECONDS);
    this.release = Math.max(0.01, spec.release ?? RELEASE_SECONDS);
    this.duration =
      typeof spec.duration === 'number' && Number.isFinite(spec.duration)
        ? Math.max(0.02, spec.duration)
        : null;
    this.peak = voicePeak(spec.level);
    this.startTime = spec.when ?? ctx.currentTime;

    this.envelope = ctx.createGain();
    this.envelope.gain.value = 0;
    this.envelope.connect(destination);

    const requested = spec.partials?.length ? spec.partials : [{ multiple: 1, gain: 1 }];
    const normalized = normalizeGains(
      requested.map((partial) => Math.max(0, Number.isFinite(partial.gain) ? partial.gain : 0)),
    );

    requested.forEach((partial, index) => {
      const multiple = Math.max(0.25, partial.multiple);
      const oscillator = ctx.createOscillator();
      oscillator.type = spec.waveform;
      oscillator.frequency.setValueAtTime(spec.frequency * multiple, this.startTime);

      const gain = ctx.createGain();
      gain.gain.value = normalized[index] ?? 0;

      oscillator.connect(gain);
      gain.connect(this.envelope);
      this.oscillators.push(oscillator);
      this.partialGains.push(gain);
      this.multiples.push(multiple);
    });

    let remaining = this.oscillators.length;
    for (const oscillator of this.oscillators) {
      oscillator.onended = () => {
        remaining -= 1;
        if (remaining === 0) {
          this.cleanup();
        }
      };
    }
  }

  start(when = this.startTime): void {
    this.startTime = when;
    const gain = this.envelope.gain;
    gain.cancelScheduledValues(when);
    gain.setValueAtTime(0.0001, when);
    gain.linearRampToValueAtTime(this.peak, when + this.attack);

    if (this.duration !== null) {
      const stopAt = Math.max(when + this.attack + 0.005, when + this.duration);
      gain.setValueAtTime(this.peak, stopAt);
      gain.linearRampToValueAtTime(0.0001, stopAt + this.release);
      for (const oscillator of this.oscillators) {
        oscillator.start(when);
        oscillator.stop(stopAt + this.release + 0.01);
      }
      return;
    }

    for (const oscillator of this.oscillators) {
      oscillator.start(when);
    }
  }

  stop(when = this.ctx.currentTime): void {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    const time = Math.max(when, this.ctx.currentTime);
    const gain = this.envelope.gain;

    try {
      if (typeof gain.cancelAndHoldAtTime === 'function') {
        gain.cancelAndHoldAtTime(time);
      } else {
        gain.cancelScheduledValues(time);
        gain.setValueAtTime(Math.max(gain.value, 0.0001), time);
      }
      gain.linearRampToValueAtTime(0.0001, time + this.release);
      for (const oscillator of this.oscillators) {
        try {
          oscillator.stop(time + this.release + 0.01);
        } catch {
          // One-shot voices already scheduled their stop; the envelope fade still works.
        }
      }
    } catch {
      this.cleanup();
    }
  }

  setFrequency(frequency: number): void {
    const now = this.ctx.currentTime;
    this.oscillators.forEach((oscillator, index) => {
      const multiple = this.multiples[index] ?? 1;
      oscillator.frequency.setTargetAtTime(frequency * multiple, now, 0.012);
    });
  }

  setWaveform(waveform: Waveform): void {
    for (const oscillator of this.oscillators) {
      oscillator.type = waveform;
    }
  }

  setLevel(level: number): void {
    this.peak = voicePeak(level);
    if (!this.stopped && this.duration === null) {
      this.envelope.gain.setTargetAtTime(this.peak, this.ctx.currentTime, 0.02);
    }
  }

  setPartialGains(gains: readonly number[]): void {
    const normalized = normalizeGains(gains);
    const now = this.ctx.currentTime;
    this.partialGains.forEach((gainNode, index) => {
      gainNode.gain.setTargetAtTime(normalized[index] ?? 0, now, 0.025);
    });
  }

  isHeld(): boolean {
    return this.duration === null && !this.stopped;
  }

  private cleanup(): void {
    if (this.cleaned) {
      return;
    }
    this.cleaned = true;
    this.envelope.disconnect();
    for (const gain of this.partialGains) {
      gain.disconnect();
    }
    for (const oscillator of this.oscillators) {
      oscillator.disconnect();
    }
    this.onEnded();
  }
}
