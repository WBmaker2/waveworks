import { engine } from '../../audio/AudioEngine';
import { MAX_VOICE_LEVEL, MIN_VOICE_LEVEL } from '../../audio/constants';
import { describeFrequency, formatHz } from '../../audio/notes';
import { formatPercent } from '../../audio/safety';
import { WAVEFORMS, waveformLabel, type Waveform } from '../../audio/waveforms';
import type { Room, RoomContext } from '../../app/room';
import { CHALLENGES, getChallenge } from '../../app/state';
import { CONCEPT_ROOM } from '../challenges/evaluate';
import { ChallengeWorkbench } from '../challenges/ChallengeWorkbench';
import { h, iconEl } from '../../ui/dom';
import { ScopeStack } from '../../ui/ScopeStack';
import { Slider } from '../../ui/Slider';

export class ToneRoom implements Room {
  readonly element: HTMLElement;
  private readonly store: RoomContext['store'];
  private readonly scope: ScopeStack;
  private readonly workbench: ChallengeWorkbench | null;
  private readonly waveformButtons = new Map<Waveform, HTMLButtonElement>();
  private readonly frequencySlider: Slider;
  private readonly volumeSlider: Slider;
  private readonly playButton: HTMLButtonElement;
  private readonly playLabel: HTMLElement;
  private readonly playIcon: HTMLElement;
  private readonly status: HTMLElement;
  private heldVoice = null as ReturnType<typeof engine.playVoice> | null;
  private playing = false;
  private busy = false;
  private destroyed = false;

  constructor(context: RoomContext) {
    this.store = context.store;
    const state = this.store.get();
    const challenge = getChallenge(state.challenge.currentId);
    this.workbench =
      challenge && CONCEPT_ROOM[challenge.concept] === 'tone'
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
    this.status = h('p', {
      className: 'play-status',
      attrs: { 'aria-live': 'polite' },
    });

    const waveformFieldset = h(
      'fieldset',
      { className: 'waveform-picker' },
      h('legend', { className: 'field-label' }, '파형'),
      h(
        'div',
        { className: 'waveform-grid' },
        ...WAVEFORMS.map((waveform) => {
          const button = h(
            'button',
            {
              className: 'waveform-option',
              attrs: {
                type: 'button',
                'aria-pressed': String(state.tone.waveform === waveform.id),
              },
              on: { click: () => this.setWaveform(waveform.id) },
            },
            h('span', { className: 'waveform-icon', html: iconEl(waveform.icon, 44).innerHTML }),
            h('strong', {}, waveform.nameKo),
            h('span', { className: 'waveform-description' }, waveform.descriptionKo),
          );
          this.waveformButtons.set(waveform.id, button);
          return button;
        }),
      ),
    );

    this.frequencySlider = new Slider({
      labelKo: '주파수',
      min: 55,
      max: 1760,
      value: state.tone.frequency,
      step: 1,
      scale: 'log',
      unit: 'Hz',
      numeric: true,
      formatValue: (value) => `${describeFrequency(value)} · ${formatHz(value)}`,
      formatEdge: (value) => formatHz(value),
      helpKo: '주파수는 1초에 진동하는 횟수입니다. 숫자가 커질수록 음이 높아집니다.',
      onInput: (value) => this.setFrequency(value),
    });

    this.volumeSlider = new Slider({
      labelKo: '이 음의 크기',
      min: MIN_VOICE_LEVEL,
      max: MAX_VOICE_LEVEL,
      value: state.tone.volume,
      step: 0.01,
      numeric: true,
      formatValue: (value) => formatPercent(value),
      formatEdge: (value) => formatPercent(value),
      helpKo: '마스터 음량과 따로 조절됩니다. 전체 음량은 왼쪽 아래의 마스터 음량으로 제한됩니다.',
      onInput: (value) => this.setVolume(value),
    });

    const controls = h(
      'section',
      { className: 'panel control-panel', attrs: { 'aria-labelledby': 'tone-controls-title' } },
      h('h2', { id: 'tone-controls-title', className: 'panel-title' }, '조절하기'),
      waveformFieldset,
      h(
        'div',
        { className: 'field-stack' },
        this.frequencySlider.element,
        this.volumeSlider.element,
      ),
      h('div', { className: 'play-row' }, this.playButton, this.status),
    );

    const reading = h(
      'section',
      { className: 'panel reading-panel', attrs: { 'aria-labelledby': 'tone-reading-title' } },
      h('h2', { id: 'tone-reading-title', className: 'panel-title' }, '읽을거리'),
      h(
        'div',
        { className: 'reading-grid' },
        h(
          'div',
          {},
          h('h3', {}, '주파수와 음높이'),
          h(
            'p',
            {},
            'A4는 440 Hz, A5는 880 Hz입니다. 주파수가 2배가 되면 한 옥타브 위의 같은 음이 됩니다.',
          ),
        ),
        h(
          'div',
          {},
          h('h3', {}, '딸깍 소리가 없는 이유'),
          h(
            'p',
            {},
            '소리는 12 ms 동안 부드럽게 커지고 30 ms 동안 사라집니다. 갑자기 0으로 끊지 않아 스피커가 딸깍거리지 않습니다.',
          ),
        ),
        h(
          'div',
          {},
          h('h3', {}, '파형 읽기'),
          h(
            'p',
            {},
            '사인파는 가장 단순하고, 사각파와 톱니파는 배음이 많아 더 밝고 거칠게 들립니다.',
          ),
        ),
      ),
    );

    const roomGrid = h(
      'div',
      { className: 'room-grid' },
      h('div', { className: 'panel-stack' }, controls, reading),
      h('div', { className: 'scope-column' }, this.scope.element),
    );

    this.element = h(
      'div',
      { className: 'room-content' },
      this.workbench?.element ?? null,
      roomGrid,
    );

    this.updateScope();
    this.updatePlayUi();
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

  private setWaveform(waveform: Waveform): void {
    this.store.update((draft) => {
      draft.tone.waveform = waveform;
    });
    for (const [id, button] of this.waveformButtons) {
      button.setAttribute('aria-pressed', String(id === waveform));
    }
    this.heldVoice?.setWaveform(waveform);
    this.updateScope();
    this.updatePlayUi();
  }

  private setFrequency(value: number): void {
    this.store.update((draft) => {
      draft.tone.frequency = value;
    });
    this.heldVoice?.setFrequency(value);
    this.updateScope();
    this.updatePlayUi();
  }

  private setVolume(value: number): void {
    this.store.update((draft) => {
      draft.tone.volume = value;
    });
    this.heldVoice?.setLevel(value);
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
        frequency: state.tone.frequency,
        waveform: state.tone.waveform,
        level: state.tone.volume,
      });
      if (!this.heldVoice) {
        this.busy = false;
        this.status.textContent = '소리를 재생하지 못했습니다. 오디오 상태를 확인해 주세요.';
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

  private updatePlayUi(): void {
    const state = this.store.get();
    this.playButton.setAttribute('aria-pressed', String(this.playing));
    this.playButton.classList.toggle('is-playing', this.playing);
    this.playIcon.innerHTML = iconEl(this.playing ? 'stop' : 'play', 20).innerHTML;
    this.playLabel.textContent = this.playing ? '정지' : '재생';
    if (this.playing) {
      this.status.textContent = state.preferences.visualsOnly
        ? '시각 전용 모드로 파형을 재생하는 중입니다. 소리는 나지 않습니다.'
        : `재생 중 · ${describeFrequency(state.tone.frequency)} · ${formatHz(state.tone.frequency)}`;
    } else {
      this.status.textContent = `정지 · ${waveformLabel(state.tone.waveform)}파 · ${describeFrequency(
        state.tone.frequency,
      )}`;
    }
  }

  private updateScope(): void {
    const state = this.store.get();
    const live = this.playing && !state.preferences.visualsOnly && engine.running;
    this.scope.setWaveform({
      waveform: state.tone.waveform,
      frequency: state.tone.frequency,
      mode: 'oscillator',
      level: state.tone.volume,
      active: this.playing,
      live,
      reducedMotion: state.preferences.reducedMotion,
    });
    this.scope.setSpectrum({
      waveform: state.tone.waveform,
      frequency: state.tone.frequency,
      mode: 'oscillator',
      level: state.tone.volume,
      active: this.playing,
      live,
      markers: [{ frequency: state.tone.frequency, label: '기본음' }],
    });
  }
}
