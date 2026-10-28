import { engine } from '../../audio/AudioEngine';
import {
  HARMONIC_COUNT,
  HARMONIC_PRESETS,
  harmonicBrightness,
  matchPreset,
  type HarmonicGains,
} from '../../audio/harmonics';
import { describeFrequency, formatHz, midiToFrequency, midiToName } from '../../audio/notes';
import { formatPercent } from '../../audio/safety';
import type { Room, RoomContext } from '../../app/room';
import { CHALLENGES, getChallenge } from '../../app/state';
import scalesJson from '../../data/scales.json';
import { CONCEPT_ROOM } from '../challenges/evaluate';
import { ChallengeWorkbench } from '../challenges/ChallengeWorkbench';
import { h, iconEl } from '../../ui/dom';
import { ScopeStack } from '../../ui/ScopeStack';
import { Slider } from '../../ui/Slider';

interface ScalesData {
  fundamentals: { midi: number[] };
}

const FUNDAMENTALS = (scalesJson as ScalesData).fundamentals.midi;
const HARMONIC_LEVEL = 0.6;

export class HarmonicsRoom implements Room {
  readonly element: HTMLElement;
  private readonly store: RoomContext['store'];
  private readonly scope: ScopeStack;
  private readonly workbench: ChallengeWorkbench | null;
  private readonly sliders: Slider[] = [];
  private readonly frequencyLabels: HTMLElement[] = [];
  private readonly presetButtons = new Map<string, HTMLButtonElement>();
  private readonly playButton: HTMLButtonElement;
  private readonly playLabel: HTMLElement;
  private readonly playIcon: HTMLElement;
  private readonly status: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly fundamentalSelect: HTMLSelectElement;
  private heldVoice = null as ReturnType<typeof engine.playVoice> | null;
  private playing = false;
  private busy = false;
  private destroyed = false;

  constructor(context: RoomContext) {
    this.store = context.store;
    const state = this.store.get();
    const challenge = getChallenge(state.challenge.currentId);
    this.workbench =
      challenge && CONCEPT_ROOM[challenge.concept] === 'harmonics'
        ? new ChallengeWorkbench(this.store, {
            challenge,
            challengeNumber: CHALLENGES.findIndex((item) => item.id === challenge.id) + 1,
            onExit: context.exitChallenge,
            onNext: context.openChallenge,
          })
        : null;

    this.scope = new ScopeStack();
    this.playLabel = h('span', {}, '재생');
    this.playIcon = h('span', { className: 'play-icon', html: iconEl('play', 20).innerHTML });
    this.playButton = h(
      'button',
      {
        className: 'btn btn-primary play-toggle',
        attrs: { type: 'button', 'aria-pressed': 'false' },
        on: { click: () => void this.togglePlay() },
      },
      this.playIcon,
      this.playLabel,
    );
    this.status = h('p', { className: 'play-status' });
    this.summary = h('p', { className: 'harmonic-summary' });

    this.fundamentalSelect = h(
      'select',
      {
        className: 'select-control',
        attrs: { id: 'fundamental-select', 'aria-label': '기본음 선택' },
        on: {
          change: () => this.setFundamental(midiToFrequency(Number(this.fundamentalSelect.value))),
        },
      },
      ...FUNDAMENTALS.map((midi) =>
        h(
          'option',
          { attrs: { value: String(midi) } },
          `${midiToName(midi)} · ${formatHz(midiToFrequency(midi))}`,
        ),
      ),
    );
    this.fundamentalSelect.value = String(nearestFundamentalMidi(state.harmonics.fundamental));

    const fundamentalField = h(
      'div',
      { className: 'field' },
      h(
        'div',
        { className: 'field-head' },
        h('label', { className: 'field-label', attrs: { for: 'fundamental-select' } }, '기본음'),
        h(
          'output',
          { className: 'field-value' },
          `${describeFrequency(state.harmonics.fundamental)} · ${formatHz(
            state.harmonics.fundamental,
          )}`,
        ),
      ),
      this.fundamentalSelect,
      h('p', { className: 'field-help' }, '네 배음은 이 기본음의 2배, 3배, 4배 주파수입니다.'),
    );

    const harmonicRows = h('div', { className: 'harmonic-rows' });
    for (let index = 0; index < HARMONIC_COUNT; index += 1) {
      const frequencyLabel = h('span', { className: 'harmonic-frequency' });
      this.frequencyLabels.push(frequencyLabel);
      const slider = new Slider({
        labelKo: `${index + 1}배음`,
        min: 0,
        max: 100,
        value: Math.round((state.harmonics.gains[index] ?? 0) * 100),
        step: 1,
        numeric: true,
        unit: '%',
        formatValue: (value) => formatPercent(value / 100),
        formatEdge: (value) => `${value}%`,
        onInput: (value) => this.setGain(index, value / 100),
      });
      this.sliders.push(slider);
      harmonicRows.append(
        h(
          'div',
          { className: 'harmonic-row' },
          h(
            'div',
            { className: 'harmonic-multiple' },
            h('span', {}, `×${index + 1}`),
            h('small', {}, index === 0 ? '기본음' : `${index + 1}배음`),
          ),
          h('div', { className: 'harmonic-control' }, slider.element, frequencyLabel),
        ),
      );
    }

    const presetRow = h('div', { className: 'preset-row', attrs: { 'aria-label': '음색 프리셋' } });
    for (const preset of HARMONIC_PRESETS) {
      const button = h(
        'button',
        {
          className: 'preset-btn',
          attrs: { type: 'button', 'aria-pressed': 'false', title: preset.descriptionKo },
          on: { click: () => this.applyPreset(preset.gains) },
        },
        h('strong', {}, preset.nameKo),
        h('span', {}, preset.descriptionKo),
      );
      this.presetButtons.set(preset.id, button);
      presetRow.append(button);
    }

    const controls = h(
      'section',
      {
        className: 'panel control-panel',
        attrs: { 'aria-labelledby': 'harmonics-controls-title' },
      },
      h('h2', { id: 'harmonics-controls-title', className: 'panel-title' }, '배음 조절'),
      fundamentalField,
      harmonicRows,
      h(
        'div',
        { className: 'preset-section' },
        h('p', { className: 'field-label' }, '프리셋'),
        presetRow,
      ),
      this.summary,
      h('div', { className: 'play-row' }, this.playButton, this.status),
    );

    const reading = h(
      'section',
      { className: 'panel reading-panel', attrs: { 'aria-labelledby': 'harmonics-reading-title' } },
      h('h2', { id: 'harmonics-reading-title', className: 'panel-title' }, '읽을거리'),
      h(
        'div',
        { className: 'reading-grid' },
        h(
          'div',
          {},
          h('h3', {}, '더하기로 만드는 음색'),
          h(
            'p',
            {},
            '기본음 위에 정수 배의 사인파를 더하면 하나의 복잡한 파형이 됩니다. 이 방식을 가산 합성이라고 합니다.',
          ),
        ),
        h(
          'div',
          {},
          h('h3', {}, '배음의 위치'),
          h(
            'p',
            {},
            '2배음은 한 옥타브 위, 3배음은 한 옥타브와 완전5도 위입니다. 높은 배음을 더할수록 소리가 밝아집니다.',
          ),
        ),
        h(
          'div',
          {},
          h('h3', {}, '같은 음, 다른 악기'),
          h(
            'p',
            {},
            '피아노와 바이올린이 같은 음을 내도 다르게 들리는 이유는 배음의 양과 비율이 다르기 때문입니다.',
          ),
        ),
      ),
    );

    this.element = h(
      'div',
      { className: 'room-content' },
      this.workbench?.element ?? null,
      h(
        'div',
        { className: 'room-grid' },
        h('div', { className: 'panel-stack' }, controls, reading),
        h('div', { className: 'scope-column' }, this.scope.element),
      ),
    );

    this.updateFrequencyLabels();
    this.updateSummary();
    this.updatePresetButtons();
    this.updatePlayUi();
    this.updateScope();
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    this.workbench?.destroy();
    this.scope.destroy();
  }

  pause(): void {
    this.stop();
  }

  private setFundamental(frequency: number): void {
    this.store.update((draft) => {
      draft.harmonics.fundamental = frequency;
    });
    this.heldVoice?.setFrequency(frequency);
    this.fundamentalSelect.value = String(nearestFundamentalMidi(frequency));
    const output = this.fundamentalSelect.closest('.field')?.querySelector('.field-value');
    if (output) {
      output.textContent = `${describeFrequency(frequency)} · ${formatHz(frequency)}`;
    }
    this.updateFrequencyLabels();
    this.updateSummary();
    this.updateScope();
    this.updatePlayUi();
  }

  private setGain(index: number, gain: number): void {
    this.store.update((draft) => {
      draft.harmonics.gains[index] = gain;
    });
    this.heldVoice?.setPartialGains(this.store.get().harmonics.gains);
    this.updateSummary();
    this.updatePresetButtons();
    this.updatePlayUi();
    this.updateScope();
    if (this.totalGain() === 0 && this.playing) {
      this.stop();
    }
  }

  private applyPreset(gains: HarmonicGains): void {
    this.store.update((draft) => {
      draft.harmonics.gains = [...gains];
    });
    this.sliders.forEach((slider, index) => {
      slider.setValue(Math.round((gains[index] ?? 0) * 100));
    });
    this.heldVoice?.setPartialGains(gains);
    this.updateSummary();
    this.updatePresetButtons();
    this.updatePlayUi();
    this.updateScope();
  }

  private async togglePlay(): Promise<void> {
    if (this.busy) {
      return;
    }
    if (this.playing) {
      this.stop();
      return;
    }
    if (this.totalGain() === 0) {
      return;
    }

    this.busy = true;
    const state = this.store.get();
    if (!state.preferences.visualsOnly) {
      const started = await engine.start();
      if (!started || this.destroyed) {
        this.busy = false;
        if (!this.destroyed) {
          this.status.textContent = '오디오를 시작하지 못했습니다. 소리 버튼을 다시 눌러 주세요.';
        }
        return;
      }
      this.heldVoice = engine.playVoice({
        frequency: state.harmonics.fundamental,
        waveform: 'sine',
        partials: state.harmonics.gains.map((gain, index) => ({
          multiple: index + 1,
          gain,
        })),
        level: HARMONIC_LEVEL,
      });
      if (!this.heldVoice) {
        this.busy = false;
        this.status.textContent = '소리를 재생하지 못했습니다.';
        return;
      }
    }

    this.playing = true;
    this.busy = false;
    this.updatePlayUi();
    this.updateScope();
  }

  private stop(): void {
    this.heldVoice?.stop();
    this.heldVoice = null;
    this.playing = false;
    this.busy = false;
    this.updatePlayUi();
    this.updateScope();
  }

  private totalGain(): number {
    return this.store.get().harmonics.gains.reduce((sum, gain) => sum + gain, 0);
  }

  private updateFrequencyLabels(): void {
    const fundamental = this.store.get().harmonics.fundamental;
    this.frequencyLabels.forEach((label, index) => {
      label.textContent = formatHz(fundamental * (index + 1));
    });
  }

  private updateSummary(): void {
    const state = this.store.get();
    const activeCount = state.harmonics.gains.filter((gain) => gain > 0.001).length;
    const brightness = Math.round(harmonicBrightness(state.harmonics.gains) * 100);
    const preset = matchPreset(state.harmonics.gains);
    this.summary.textContent = `${formatHz(state.harmonics.fundamental)} · 배음 ${activeCount}개 사용 · 밝기 ${brightness}% · ${
      preset ? `프리셋 ${preset.nameKo}` : '직접 설계'
    }`;
  }

  private updatePresetButtons(): void {
    const preset = matchPreset(this.store.get().harmonics.gains);
    for (const [id, button] of this.presetButtons) {
      button.setAttribute('aria-pressed', String(preset?.id === id));
    }
  }

  private updatePlayUi(): void {
    const state = this.store.get();
    const empty = this.totalGain() === 0;
    this.playButton.disabled = empty;
    this.playButton.setAttribute('aria-pressed', String(this.playing));
    this.playButton.classList.toggle('is-playing', this.playing);
    this.playIcon.innerHTML = iconEl(this.playing ? 'stop' : 'play', 20).innerHTML;
    this.playLabel.textContent = this.playing ? '정지' : '재생';
    this.status.textContent = empty
      ? '배음이 모두 0입니다. 하나 이상 올려 주세요.'
      : this.playing
        ? state.preferences.visualsOnly
          ? '시각 전용 모드로 배음 파형을 재생하는 중입니다. 소리는 나지 않습니다.'
          : `재생 중 · ${formatHz(state.harmonics.fundamental)} 기본음과 배음`
        : `정지 · ${formatHz(state.harmonics.fundamental)} 기본음`;
  }

  private updateScope(): void {
    const state = this.store.get();
    const live = this.playing && !state.preferences.visualsOnly && engine.running;
    const markers = state.harmonics.gains.map((_gain, index) => ({
      frequency: state.harmonics.fundamental * (index + 1),
      label: `×${index + 1}`,
    }));
    this.scope.setWaveform({
      frequency: state.harmonics.fundamental,
      harmonics: state.harmonics.gains,
      mode: 'harmonics',
      level: HARMONIC_LEVEL,
      active: this.playing,
      live,
      reducedMotion: state.preferences.reducedMotion,
    });
    this.scope.setSpectrum({
      frequency: state.harmonics.fundamental,
      harmonics: state.harmonics.gains,
      mode: 'harmonics',
      level: HARMONIC_LEVEL,
      active: this.playing,
      live,
      markers,
    });
  }
}

function nearestFundamentalMidi(frequency: number): number {
  return FUNDAMENTALS.reduce((best, midi) => {
    const bestDistance = Math.abs(Math.log2(midiToFrequency(best) / frequency));
    const distance = Math.abs(Math.log2(midiToFrequency(midi) / frequency));
    return distance < bestDistance ? midi : best;
  }, FUNDAMENTALS[0] ?? 48);
}
