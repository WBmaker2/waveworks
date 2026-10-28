import type { AnalyserTap } from '../audio/analyser';
import { MAX_FREQ, MIN_FREQ } from '../audio/constants';
import { formatHz, midiToName } from '../audio/notes';
import type { Waveform } from '../audio/waveforms';
import { waveformAt, waveformLabel } from '../audio/waveforms';
import { CanvasView, SCOPE_THEME } from './canvas';

export type WaveformMode = 'oscillator' | 'harmonics' | 'tones' | 'rhythm';

export interface WaveformConfig {
  waveform: Waveform;
  frequency: number;
  harmonics: number[];
  tones: number[];
  steps: (number | null)[];
  mode: WaveformMode;
  level: number;
  active: boolean;
  live: boolean;
  reducedMotion: boolean;
}

const DEFAULTS: WaveformConfig = {
  waveform: 'sine',
  frequency: 440,
  harmonics: [1, 0, 0, 0],
  tones: [],
  steps: [],
  mode: 'oscillator',
  level: 0.55,
  active: false,
  live: false,
  reducedMotion: false,
};

export class WaveformView extends CanvasView {
  private config: WaveformConfig = { ...DEFAULTS };

  constructor(private readonly tap: AnalyserTap) {
    super('scope-canvas waveform-canvas', '소리의 파형 미리보기');
  }

  setConfig(next: Partial<WaveformConfig>): void {
    this.config = { ...this.config, ...next };
    this.canvas.setAttribute('aria-label', this.ariaLabel());
  }

  protected drawFrame(now: number): void {
    const ctx = this.context;
    ctx.fillStyle = SCOPE_THEME.background;
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawGrid(10, 4);

    const live = this.config.live && this.tap.available && this.config.mode !== 'rhythm';
    if (live) {
      this.drawLive();
    } else if (this.config.mode === 'rhythm') {
      this.drawRhythm(now);
    } else {
      this.drawSynthetic(now);
    }

    this.drawScopeLabel(
      live ? '실시간 파형' : this.config.mode === 'rhythm' ? '리듬 패턴 미리보기' : '파형 미리보기',
    );
  }

  private ariaLabel(): string {
    if (this.config.mode === 'rhythm') {
      return `8단계 리듬 패턴의 음높이 미리보기. ${this.config.active ? '재생 중' : '정지'}.`;
    }
    if (this.config.mode === 'tones') {
      return `화음 ${this.config.tones.length}개 음의 합성 파형. ${
        this.config.active ? '재생 중' : '정지'
      }.`;
    }
    const modeLabel =
      this.config.mode === 'harmonics' ? '배음 합성' : `${waveformLabel(this.config.waveform)}파`;
    return `${modeLabel} ${formatHz(this.config.frequency)} 파형. ${
      this.config.active ? '재생 중' : '정지'
    }.`;
  }

  private drawLive(): void {
    const data = this.tap.readWaveform();
    if (!data) {
      this.drawSynthetic(performance.now());
      return;
    }
    const ctx = this.context;
    const mid = this.height / 2;
    const amplitude = this.height * 0.38;
    const stride = Math.max(1, Math.floor(data.length / Math.max(1, this.width)));
    ctx.save();
    ctx.strokeStyle = SCOPE_THEME.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < this.width; x += 1) {
      const index = Math.min(data.length - 1, Math.floor(x * stride));
      const value = ((data[index] ?? 128) - 128) / 128;
      const y = mid - value * amplitude;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawSynthetic(now: number): void {
    const { waveform, frequency, harmonics, tones, mode, level, active } = this.config;
    const ctx = this.context;
    const mid = this.height / 2;
    const cycles = cyclesForFrequency(frequency);
    const speed = this.reducedMotion() ? 0.12 : 0.5;
    const phase = active ? ((now / 1000) * speed) % 1 : 0.08;
    const points: number[] = [];

    for (let x = 0; x <= this.width; x += 1) {
      const t = (x / Math.max(1, this.width)) * cycles + phase;
      if (mode === 'harmonics') {
        let value = 0;
        for (let index = 0; index < harmonics.length; index += 1) {
          const gain = harmonics[index] ?? 0;
          value += Math.sin(2 * Math.PI * t * (index + 1)) * gain;
        }
        points.push(value);
      } else if (mode === 'tones') {
        let value = 0;
        for (const tone of tones) {
          const ratio = tone / Math.max(1, frequency);
          value += Math.sin(2 * Math.PI * t * ratio);
        }
        points.push(value / Math.max(1, tones.length));
      } else {
        points.push(waveformAt(waveform, t));
      }
    }

    let maxAbs = 0.0001;
    for (const value of points) {
      maxAbs = Math.max(maxAbs, Math.abs(value));
    }
    const amplitude = this.height * 0.4 * Math.min(1, Math.max(0, level));
    ctx.save();
    ctx.strokeStyle = active ? SCOPE_THEME.accent : SCOPE_THEME.accentSoft;
    ctx.globalAlpha = active ? 1 : 0.62;
    ctx.lineWidth = 2.25;
    ctx.beginPath();
    points.forEach((value, x) => {
      const y = mid - (value / maxAbs) * amplitude;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  private drawRhythm(now: number): void {
    const { steps, active } = this.config;
    const ctx = this.context;
    const baseline = this.height * 0.72;
    const cell = this.width / 8;
    const pitchMin = 58;
    const pitchMax = 74;
    const pulse = active && !this.reducedMotion() ? 0.65 + Math.sin(now / 260) * 0.12 : 0.7;

    ctx.save();
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let index = 0; index < 8; index += 1) {
      const midi = steps[index] ?? null;
      const x = cell * index + cell / 2;
      ctx.strokeStyle = SCOPE_THEME.gridStrong;
      ctx.beginPath();
      ctx.moveTo(cell * index + 0.5, this.height * 0.16);
      ctx.lineTo(cell * index + 0.5, this.height * 0.78);
      ctx.stroke();

      ctx.fillStyle = SCOPE_THEME.muted;
      ctx.fillText(String(index + 1), x, this.height - 18);

      if (midi === null) {
        ctx.fillStyle = SCOPE_THEME.axis;
        ctx.beginPath();
        ctx.arc(x, baseline, 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      const normalized = Math.min(1, Math.max(0, (midi - pitchMin) / (pitchMax - pitchMin)));
      const y = baseline - normalized * this.height * 0.38;
      const pulseWidth = cell * 0.56;
      const pulseHeight = 9 + normalized * 6;
      ctx.fillStyle = active ? SCOPE_THEME.accent : SCOPE_THEME.accentSoft;
      ctx.globalAlpha = pulse;
      ctx.fillRect(x - pulseWidth / 2, y - pulseHeight / 2, pulseWidth, pulseHeight);
      ctx.globalAlpha = 1;
      ctx.fillStyle = SCOPE_THEME.paper;
      ctx.fillRect(x - pulseWidth / 2, y - pulseHeight / 2, pulseWidth, 1);
      ctx.fillStyle = SCOPE_THEME.paper;
      ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(midiToName(midi), x, y - pulseHeight / 2 - 13);
      ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    }
    ctx.restore();
  }

  private reducedMotion(): boolean {
    return (
      this.config.reducedMotion ||
      document.documentElement.classList.contains('reduce-motion') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}

export function cyclesForFrequency(frequency: number): number {
  const clamped = Math.min(MAX_FREQ, Math.max(MIN_FREQ, frequency));
  const normalized = Math.log2(clamped / MIN_FREQ) / Math.log2(MAX_FREQ / MIN_FREQ);
  return 1.4 + normalized * 4.4;
}
