import type { AnalyserTap } from '../audio/analyser';
import { normalizeGains } from '../audio/harmonics';
import type { Waveform } from '../audio/waveforms';
import { expectedHarmonics } from '../audio/waveforms';
import { CanvasView, SCOPE_THEME } from './canvas';

const MIN_SPECTRUM_HZ = 50;
const MAX_SPECTRUM_HZ = 8000;

export interface SpectrumMarker {
  frequency: number;
  label: string;
}

export type SpectrumMode = 'oscillator' | 'harmonics' | 'tones';

export interface SpectrumConfig {
  waveform: Waveform;
  frequency: number;
  harmonics: number[];
  tones: number[];
  mode: SpectrumMode;
  level: number;
  active: boolean;
  live: boolean;
  markers: SpectrumMarker[];
}

const DEFAULTS: SpectrumConfig = {
  waveform: 'sine',
  frequency: 440,
  harmonics: [1, 0, 0, 0],
  tones: [],
  mode: 'oscillator',
  level: 0.55,
  active: false,
  live: false,
  markers: [],
};

export class SpectrumView extends CanvasView {
  private config: SpectrumConfig = { ...DEFAULTS };
  private levels = new Float32Array(0);

  constructor(private readonly tap: AnalyserTap) {
    super('scope-canvas spectrum-canvas', '소리의 배음 스펙트럼');
  }

  setConfig(next: Partial<SpectrumConfig>): void {
    this.config = { ...this.config, ...next };
  }

  protected drawFrame(): void {
    const ctx = this.context;
    ctx.fillStyle = SCOPE_THEME.background;
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawGrid(8, 3);

    const live = this.config.live && this.tap.available;
    const barCount = Math.max(32, Math.min(120, Math.floor(this.width / 8)));
    this.ensureLevels(barCount);
    const target = live ? this.readLive(barCount) : this.readSynthetic(barCount);
    this.smooth(target, live);

    this.drawMarkers();
    this.drawBars(barCount);
    this.drawAxis();
    this.drawScopeLabel(live ? '실시간 스펙트럼' : '스펙트럼 미리보기');
  }

  private ensureLevels(count: number): void {
    if (this.levels.length !== count) {
      this.levels = new Float32Array(count);
    }
  }

  private readLive(barCount: number): Float32Array {
    const target = new Float32Array(barCount);
    const data = this.tap.readSpectrum();
    if (!data) {
      return target;
    }
    for (let bar = 0; bar < barCount; bar += 1) {
      const startFrequency = barFrequency(bar, barCount, 0);
      const endFrequency = barFrequency(bar, barCount, 1);
      const startBin = Math.max(1, this.tap.binForFrequency(startFrequency));
      const endBin = Math.max(startBin + 1, this.tap.binForFrequency(endFrequency));
      let peak = 0;
      for (let bin = startBin; bin < endBin && bin < data.length; bin += 1) {
        peak = Math.max(peak, data[bin] ?? 0);
      }
      target[bar] = peak / 255;
    }
    return target;
  }

  private readSynthetic(barCount: number): Float32Array {
    const target = new Float32Array(barCount);
    const { mode, waveform, frequency, harmonics, tones, level } = this.config;

    const sources: { frequency: number; amplitude: number }[] = [];
    if (mode === 'harmonics') {
      const normalized = normalizeGains(harmonics);
      normalized.forEach((gain, index) => {
        sources.push({ frequency: frequency * (index + 1), amplitude: gain });
      });
    } else if (mode === 'tones') {
      tones.forEach((tone) => {
        sources.push({ frequency: tone, amplitude: 0.85 });
      });
    } else {
      const series = expectedHarmonics(waveform, 64);
      series.forEach((amplitude, index) => {
        if (amplitude > 0.001) {
          sources.push({ frequency: frequency * (index + 1), amplitude });
        }
      });
    }

    for (const source of sources) {
      if (source.frequency > MAX_SPECTRUM_HZ) {
        continue;
      }
      const bar = frequencyToBar(source.frequency, barCount);
      if (bar < 0 || bar >= barCount) {
        continue;
      }
      const amplitude = Math.min(1, source.amplitude) * Math.min(1, Math.max(0, level));
      target[bar] = Math.max(target[bar] ?? 0, amplitude);
    }
    return target;
  }

  private smooth(target: Float32Array, live: boolean): void {
    for (let index = 0; index < this.levels.length; index += 1) {
      const next = target[index] ?? 0;
      const previous = this.levels[index] ?? 0;
      const decay = live ? 0.86 : 0.9;
      this.levels[index] = Math.max(next, previous * decay);
    }
  }

  private drawMarkers(): void {
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = SCOPE_THEME.axis;
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = SCOPE_THEME.paper;
    for (const marker of this.config.markers) {
      if (marker.frequency < MIN_SPECTRUM_HZ || marker.frequency > MAX_SPECTRUM_HZ) {
        continue;
      }
      const x = Math.round(frequencyToX(marker.frequency, this.width)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, this.height - 24);
      ctx.stroke();
      ctx.textAlign = x > this.width - 36 ? 'right' : 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(marker.label, x + (ctx.textAlign === 'right' ? -4 : 4), 20);
    }
    ctx.restore();
  }

  private drawBars(barCount: number): void {
    const ctx = this.context;
    const baseline = this.height - 24;
    const drawableHeight = baseline - 30;
    const cell = this.width / barCount;
    const barWidth = Math.max(2, cell - 2);
    ctx.save();
    for (let index = 0; index < barCount; index += 1) {
      const level = Math.min(1, this.levels[index] ?? 0);
      if (level <= 0.008) {
        continue;
      }
      const height = Math.max(1.5, level * drawableHeight);
      const x = index * cell + 1;
      const y = baseline - height;
      ctx.fillStyle = this.config.active ? SCOPE_THEME.accent : SCOPE_THEME.accentSoft;
      ctx.globalAlpha = this.config.active ? 0.86 : 0.5;
      ctx.fillRect(x, y, barWidth, height);
      ctx.globalAlpha = 1;
      ctx.fillStyle = SCOPE_THEME.paper;
      ctx.fillRect(x, y, barWidth, 1.5);
    }
    ctx.restore();
  }

  private drawAxis(): void {
    const ctx = this.context;
    const baseline = this.height - 24;
    ctx.save();
    ctx.strokeStyle = SCOPE_THEME.gridStrong;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseline + 0.5);
    ctx.lineTo(this.width, baseline + 0.5);
    ctx.stroke();

    ctx.fillStyle = SCOPE_THEME.muted;
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'top';
    const labels = [110, 440, 1760, 7040];
    for (const frequency of labels) {
      const x = frequencyToX(frequency, this.width);
      ctx.textAlign = x > this.width - 30 ? 'right' : 'center';
      ctx.fillText(axisLabel(frequency), x, baseline + 6);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = SCOPE_THEME.axis;
    ctx.fillText('Hz', this.width - 2, baseline + 17);
    ctx.restore();
  }
}

function frequencyToX(frequency: number, width: number): number {
  const normalized =
    Math.log(frequency / MIN_SPECTRUM_HZ) / Math.log(MAX_SPECTRUM_HZ / MIN_SPECTRUM_HZ);
  return normalized * width;
}

function frequencyToBar(frequency: number, barCount: number): number {
  const normalized =
    Math.log(frequency / MIN_SPECTRUM_HZ) / Math.log(MAX_SPECTRUM_HZ / MIN_SPECTRUM_HZ);
  return Math.floor(normalized * barCount);
}

function barFrequency(bar: number, barCount: number, edge: 0 | 1): number {
  const normalized = (bar + edge) / barCount;
  return MIN_SPECTRUM_HZ * (MAX_SPECTRUM_HZ / MIN_SPECTRUM_HZ) ** normalized;
}

function axisLabel(frequency: number): string {
  if (frequency >= 1000) {
    return `${(frequency / 1000).toFixed(frequency >= 2000 ? 0 : 1)}k`;
  }
  return String(frequency);
}
