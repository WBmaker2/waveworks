import { AnalyserTap } from '../audio/analyser';
import { engine } from '../audio/AudioEngine';
import { SpectrumView, type SpectrumConfig } from '../render/SpectrumView';
import { WaveformView, type WaveformConfig } from '../render/WaveformView';
import { h } from './dom';

export class ScopeStack {
  readonly element: HTMLElement;
  private readonly waveform: WaveformView;
  private readonly spectrum: SpectrumView;

  constructor(tap = new AnalyserTap(engine)) {
    this.waveform = new WaveformView(tap);
    this.spectrum = new SpectrumView(tap);

    const waveformHost = h('div', { className: 'scope-canvas-host' });
    const spectrumHost = h('div', { className: 'scope-canvas-host compact' });

    this.element = h(
      'div',
      { className: 'scope-stack' },
      h(
        'section',
        { className: 'scope-card', attrs: { 'aria-labelledby': 'scope-wave-title' } },
        h(
          'header',
          { className: 'scope-head' },
          h('h2', { id: 'scope-wave-title' }, '파형'),
          h('span', { className: 'scope-domain' }, '시간 영역'),
        ),
        waveformHost,
      ),
      h(
        'section',
        { className: 'scope-card', attrs: { 'aria-labelledby': 'scope-spectrum-title' } },
        h(
          'header',
          { className: 'scope-head' },
          h('h2', { id: 'scope-spectrum-title' }, '스펙트럼'),
          h('span', { className: 'scope-domain' }, '주파수 영역'),
        ),
        spectrumHost,
      ),
    );

    this.waveform.mount(waveformHost);
    this.spectrum.mount(spectrumHost);
  }

  setWaveform(config: Partial<WaveformConfig>): void {
    this.waveform.setConfig(config);
  }

  setSpectrum(config: Partial<SpectrumConfig>): void {
    this.spectrum.setConfig(config);
  }

  destroy(): void {
    this.waveform.destroy();
    this.spectrum.destroy();
  }
}
