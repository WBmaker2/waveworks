import { h, iconEl } from './dom';

export interface TransportOptions {
  playing: boolean;
  metronome: boolean;
  onTogglePlay: () => void;
  onClear: () => void;
  onToggleMetronome: (enabled: boolean) => void;
}

export class Transport {
  readonly element: HTMLElement;
  private readonly playButton: HTMLButtonElement;
  private readonly metronomeButton: HTMLButtonElement;

  constructor(options: TransportOptions) {
    this.playButton = h(
      'button',
      {
        className: 'btn btn-primary transport-play',
        attrs: { type: 'button', 'aria-pressed': String(options.playing) },
        on: { click: options.onTogglePlay },
      },
      h('span', { className: 'transport-play-icon' }, iconEl('play', 18)),
      h('span', { className: 'transport-label' }, options.playing ? '정지' : '재생'),
    );

    const clearButton = h(
      'button',
      {
        className: 'btn btn-secondary',
        attrs: { type: 'button' },
        on: { click: options.onClear },
      },
      iconEl('trash', 18),
      '비우기',
    );

    this.metronomeButton = h(
      'button',
      {
        className: 'btn btn-secondary',
        attrs: { type: 'button', 'aria-pressed': String(options.metronome) },
        on: {
          click: () => options.onToggleMetronome(!this.metronomeButton.classList.contains('is-on')),
        },
      },
      iconEl('metronome', 18),
      '메트로놈',
    );
    this.metronomeButton.classList.toggle('is-on', options.metronome);

    this.element = h(
      'div',
      { className: 'transport' },
      this.playButton,
      h('div', { className: 'transport-secondary' }, clearButton, this.metronomeButton),
    );
  }

  setPlaying(playing: boolean): void {
    this.playButton.setAttribute('aria-pressed', String(playing));
    this.playButton.classList.toggle('is-playing', playing);
    const icon = this.playButton.querySelector('.transport-play-icon');
    const label = this.playButton.querySelector('.transport-label');
    if (icon) {
      icon.innerHTML = iconEl(playing ? 'stop' : 'play', 18).innerHTML;
    }
    if (label) {
      label.textContent = playing ? '정지' : '재생';
    }
  }

  setMetronome(enabled: boolean): void {
    this.metronomeButton.classList.toggle('is-on', enabled);
    this.metronomeButton.setAttribute('aria-pressed', String(enabled));
  }
}
