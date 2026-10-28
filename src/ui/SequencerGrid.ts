import { midiToName } from '../audio/notes';
import { h, iconEl } from './dom';

export interface SequencerGridOptions {
  steps: (number | null)[];
  choices: readonly number[];
  onChange: (steps: (number | null)[]) => void;
  onPreview: (midi: number) => void;
}

export class SequencerGrid {
  readonly element: HTMLElement;
  private readonly cards: HTMLElement[] = [];
  private readonly selects: HTMLSelectElement[] = [];
  private steps: (number | null)[];
  private readonly choices: readonly number[];
  private readonly onChange: (steps: (number | null)[]) => void;
  private readonly onPreview: (midi: number) => void;

  constructor(options: SequencerGridOptions) {
    this.steps = [...options.steps];
    this.choices = options.choices;
    this.onChange = options.onChange;
    this.onPreview = options.onPreview;
    this.element = h('div', {
      className: 'sequencer-grid',
      attrs: { role: 'group', 'aria-label': '8단계 리듬 패턴' },
    });

    this.steps.forEach((step, index) => {
      const select = h('select', {
        className: 'step-select',
        attrs: { 'aria-label': `${index + 1}번째 칸 음` },
        on: {
          change: () => {
            const value = select.value;
            const midi = value === '' ? null : Number(value);
            this.steps[index] = Number.isFinite(midi) ? midi : null;
            this.syncCard(index);
            this.onChange([...this.steps]);
            if (typeof midi === 'number') {
              this.onPreview(midi);
            }
          },
        },
      });
      select.append(h('option', { attrs: { value: '' } }, '쉼표'));
      for (const midi of this.choices) {
        select.append(h('option', { attrs: { value: String(midi) } }, midiToName(midi)));
      }
      select.value = step === null ? '' : String(step);
      this.selects.push(select);

      const preview = h(
        'button',
        {
          className: 'step-preview icon-btn',
          attrs: {
            type: 'button',
            'aria-label': `${index + 1}번째 칸 미리 듣기`,
            title: '미리 듣기',
          },
          on: {
            click: () => {
              const midi = this.steps[index];
              if (typeof midi === 'number') {
                this.onPreview(midi);
              }
            },
          },
        },
        iconEl('play', 12),
      );

      const card = h(
        'div',
        {
          className: 'step-card',
          dataset: { step: String(index), beat: String(Math.floor(index / 2) + 1) },
          attrs: { role: 'group', 'aria-label': `${index + 1}단계` },
        },
        h(
          'div',
          { className: 'step-head' },
          h('span', { className: 'step-number' }, String(index + 1).padStart(2, '0')),
          preview,
        ),
        select,
      );
      this.cards.push(card);
      this.syncCard(index);
      this.element.append(card);
    });
  }

  setSteps(steps: readonly (number | null)[]): void {
    this.steps = [...steps];
    this.selects.forEach((select, index) => {
      select.value = this.steps[index] === null ? '' : String(this.steps[index]);
      this.syncCard(index);
    });
  }

  setPlayhead(step: number | null): void {
    this.cards.forEach((card, index) => {
      card.classList.toggle('is-playing', index === step);
      if (index === step) {
        card.setAttribute('aria-current', 'step');
      } else {
        card.removeAttribute('aria-current');
      }
    });
  }

  private syncCard(index: number): void {
    const card = this.cards[index];
    if (!card) {
      return;
    }
    const isRest = this.steps[index] === null;
    card.classList.toggle('is-rest', isRest);
    card.classList.toggle('is-note', !isRest);
  }
}
