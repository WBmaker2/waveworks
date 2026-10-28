import { MAX_MASTER_VOLUME, MAX_POLYPHONY } from './constants';
import { clampClassCap, clampMasterVolume } from './safety';
import { Voice, type VoiceSpec } from './Voice';

export type AudioState = 'idle' | 'running' | 'suspended' | 'closed' | 'unavailable';

export interface AudioSnapshot {
  available: boolean;
  state: AudioState;
  silent: boolean;
  masterVolume: number;
  classCap: number;
  polyphony: number;
  error: string | null;
}

type SnapshotListener = (snapshot: AudioSnapshot) => void;

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const AudioContextClass = (): typeof AudioContext | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const audioWindow = window as AudioWindow;
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private voices = new Set<Voice>();
  private listeners = new Set<SnapshotListener>();
  private masterVolume = 0.18;
  private classCap = MAX_MASTER_VOLUME;
  private silent = false;
  private error: string | null = null;
  private starting: Promise<boolean> | null = null;

  get started(): boolean {
    return this.ctx !== null;
  }

  get running(): boolean {
    return this.ctx?.state === 'running' && !this.silent;
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48_000;
  }

  get analyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  get polyphony(): number {
    return this.voices.size;
  }

  snapshot(): AudioSnapshot {
    const available = Boolean(AudioContextClass());
    let state: AudioState = 'idle';
    if (!available) {
      state = 'unavailable';
    } else if (this.ctx) {
      state =
        this.ctx.state === 'running' ||
        this.ctx.state === 'suspended' ||
        this.ctx.state === 'closed'
          ? this.ctx.state
          : 'suspended';
    }
    return {
      available,
      state,
      silent: this.silent,
      masterVolume: this.masterVolume,
      classCap: this.classCap,
      polyphony: this.voices.size,
      error: this.error,
    };
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  async start(): Promise<boolean> {
    if (this.silent) {
      return false;
    }
    if (this.starting) {
      return this.starting;
    }
    this.starting = this.startInternal();
    try {
      return await this.starting;
    } finally {
      this.starting = null;
    }
  }

  private async startInternal(): Promise<boolean> {
    const AudioCtor = AudioContextClass();
    if (!AudioCtor) {
      this.error = '이 브라우저는 Web Audio API를 지원하지 않습니다.';
      this.emit();
      return false;
    }

    try {
      if (!this.ctx) {
        this.createGraph(new AudioCtor({ latencyHint: 'interactive' }));
      }
      if (this.ctx?.state === 'suspended') {
        await this.ctx.resume();
      }
      this.error = null;
      this.applyMasterGain();
      this.emit();
      return this.ctx?.state === 'running';
    } catch {
      this.error = '오디오를 시작하지 못했습니다. 다시 눌러 주세요.';
      this.emit();
      return false;
    }
  }

  private createGraph(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.value = this.silent ? 0 : this.masterVolume;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-6, ctx.currentTime);
    limiter.knee.setValueAtTime(0, ctx.currentTime);
    limiter.ratio.setValueAtTime(20, ctx.currentTime);
    limiter.attack.setValueAtTime(0.003, ctx.currentTime);
    limiter.release.setValueAtTime(0.25, ctx.currentTime);

    master.connect(analyser);
    analyser.connect(limiter);
    limiter.connect(ctx.destination);

    this.ctx = ctx;
    this.masterGain = master;
    this.analyser = analyser;
    ctx.onstatechange = () => this.emit();
  }

  setMasterVolume(value: number): void {
    this.masterVolume = clampMasterVolume(value, this.classCap);
    this.applyMasterGain();
    this.emit();
  }

  setClassCap(value: number): void {
    this.classCap = clampClassCap(value);
    this.masterVolume = clampMasterVolume(this.masterVolume, this.classCap);
    this.applyMasterGain();
    this.emit();
  }

  setSilent(silent: boolean): void {
    if (this.silent === silent) {
      return;
    }
    this.silent = silent;
    if (silent) {
      this.stopAllVoices();
    }
    this.applyMasterGain();
    this.emit();
  }

  playVoice(spec: VoiceSpec): Voice | null {
    if (this.silent || !this.ctx || !this.masterGain || this.ctx.state !== 'running') {
      return null;
    }

    while (this.voices.size >= MAX_POLYPHONY) {
      const oldest = this.voices.values().next().value as Voice | undefined;
      if (!oldest) {
        break;
      }
      this.voices.delete(oldest);
      oldest.stop();
    }

    let voice: Voice | null = null;
    voice = new Voice(this.ctx, this.masterGain, spec, () => {
      if (voice) {
        this.voices.delete(voice);
      }
    });
    this.voices.add(voice);
    const when = spec.when ?? this.ctx.currentTime;
    voice.start(when);
    return voice;
  }

  stopAllVoices(): void {
    const current = Array.from(this.voices);
    this.voices.clear();
    for (const voice of current) {
      voice.stop();
    }
  }

  /** Fade to silence and suspend. Used when the tab is hidden. */
  pauseForHidden(): void {
    this.stopAllVoices();
    if (!this.ctx || !this.masterGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const gain = this.masterGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
    gain.linearRampToValueAtTime(0.0001, now + 0.03);
    window.setTimeout(() => {
      if (this.ctx?.state === 'running') {
        void this.ctx.suspend().catch(() => undefined);
      }
    }, 60);
    this.emit();
  }

  /** Resume from a user gesture after returning to the tab. */
  async resumeFromHidden(): Promise<void> {
    if (!this.ctx) {
      return;
    }
    try {
      if (this.ctx.state === 'suspended' && !this.silent) {
        await this.ctx.resume();
        this.applyMasterGain();
      }
    } catch {
      this.error = '오디오를 다시 켜지 못했습니다.';
    }
    this.emit();
  }

  private applyMasterGain(): void {
    if (!this.ctx || !this.masterGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const target = this.silent ? 0 : clampMasterVolume(this.masterVolume, this.classCap);
    this.masterGain.gain.setTargetAtTime(target, now, 0.02);
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

export const engine = new AudioEngine();
