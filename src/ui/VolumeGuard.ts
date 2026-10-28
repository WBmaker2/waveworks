import { DEFAULT_MASTER_VOLUME, MAX_MASTER_VOLUME } from '../audio/constants';
import { formatPercent } from '../audio/safety';
import type { Store } from '../app/store';
import type { AppState } from '../app/state';
import { h, iconEl } from './dom';
import { Slider } from './Slider';

export class VolumeGuard {
  readonly element: HTMLElement;
  private readonly slider: Slider;
  private readonly capNote: HTMLElement;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly store: Store,
    onOpenSettings: () => void,
  ) {
    this.capNote = h('p', { className: 'cap-note' });
    this.slider = new Slider({
      labelKo: '마스터 음량',
      min: 0,
      max: MAX_MASTER_VOLUME * 100,
      value: store.get().preferences.masterVolume * 100,
      step: 1,
      numeric: true,
      unit: '%',
      formatValue: (value) => formatPercent(value / 100),
      formatEdge: (value) => `${Math.round(value)}%`,
      onInput: (value) => {
        this.store.update((draft) => {
          draft.preferences.masterVolume = value / 100;
        });
      },
    });

    this.element = h(
      'div',
      { className: 'volume-guard' },
      this.slider.element,
      this.capNote,
      h(
        'div',
        { className: 'safety-callout' },
        h('span', { className: 'safety-icon' }, iconEl('headphones', 18)),
        h(
          'p',
          {},
          '큰 소리를 오래 듣지 마세요. 기본 음량은 ',
          h('strong', {}, formatPercent(DEFAULT_MASTER_VOLUME)),
          '로 낮게 시작합니다.',
        ),
      ),
      h(
        'button',
        {
          className: 'btn btn-secondary btn-wide',
          attrs: { type: 'button' },
          on: { click: onOpenSettings },
        },
        iconEl('sliders', 18),
        '소리 설정',
      ),
    );

    this.sync(store.get());
    this.unsubscribe = store.subscribe((state) => this.sync(state));
  }

  destroy(): void {
    this.unsubscribe();
  }

  private sync(state: AppState): void {
    const cap = state.preferences.classVolumeCap;
    this.slider.setMax(Math.round(cap * 100));
    this.slider.setValue(Math.min(state.preferences.masterVolume, cap) * 100);
    this.capNote.textContent =
      cap < MAX_MASTER_VOLUME
        ? `수업 상한 ${formatPercent(cap)}이 적용 중입니다.`
        : `최대 ${formatPercent(MAX_MASTER_VOLUME)} · 기본 ${formatPercent(DEFAULT_MASTER_VOLUME)}`;
    this.capNote.classList.toggle('is-capped', cap < MAX_MASTER_VOLUME);
  }
}
