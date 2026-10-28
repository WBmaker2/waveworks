import { h, uniqueId } from './dom';

export interface SliderOptions {
  id?: string;
  labelKo: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  scale?: 'linear' | 'log';
  unit?: string;
  numeric?: boolean;
  formatValue?: (value: number) => string;
  formatEdge?: (value: number) => string;
  onInput: (value: number) => void;
  helpKo?: string;
  className?: string;
}

const LOG_STEPS = 1000;

export class Slider {
  readonly element: HTMLElement;
  private readonly range: HTMLInputElement;
  private readonly numberInput: HTMLInputElement | null;
  private readonly output: HTMLOutputElement;
  private readonly options: SliderOptions;
  private readonly id: string;

  constructor(options: SliderOptions) {
    this.options = { ...options };
    this.id = options.id ?? uniqueId('slider');
    this.options.value = clamp(options.value, options.min, options.max);

    this.range = h('input', {
      className: 'range',
      id: this.id,
      attrs: {
        type: 'range',
        min: options.scale === 'log' ? 0 : options.min,
        max: options.scale === 'log' ? LOG_STEPS : options.max,
        step: options.scale === 'log' ? 1 : (options.step ?? 'any'),
        value: this.positionForValue(this.options.value),
        'aria-valuetext': this.formatValue(this.options.value),
      },
      on: {
        input: () => this.handleRangeInput(),
      },
    });

    this.output = h('output', {
      className: 'field-value',
      attrs: { for: this.id },
    });

    this.numberInput = options.numeric
      ? h('input', {
          className: 'number-input',
          attrs: {
            type: 'number',
            min: options.min,
            max: options.max,
            step: options.step ?? 'any',
            value: formatNumber(this.options.value),
            inputmode: 'decimal',
            'aria-label': `${options.labelKo} 숫자 입력`,
          },
          on: {
            change: () => this.handleNumberChange(),
            blur: () => this.handleNumberChange(),
          },
        })
      : null;

    const numberWrap = this.numberInput
      ? h(
          'span',
          { className: 'number-wrap' },
          this.numberInput,
          options.unit ? h('span', { className: 'number-unit' }, options.unit) : null,
        )
      : null;

    this.element = h(
      'div',
      { className: `field slider-field ${options.className ?? ''}`.trim() },
      h(
        'div',
        { className: 'field-head' },
        h('label', { className: 'field-label', attrs: { for: this.id } }, options.labelKo),
        this.output,
      ),
      h('div', { className: 'slider-row' }, this.range, numberWrap),
      h(
        'div',
        { className: 'range-edges' },
        h('span', {}, this.formatEdge(options.min)),
        h('span', {}, this.formatEdge(options.max)),
      ),
      options.helpKo ? h('p', { className: 'field-help' }, options.helpKo) : null,
    );

    this.refreshDisplay();
  }

  setValue(value: number): void {
    this.options.value = clamp(value, this.options.min, this.options.max);
    this.range.value = String(this.positionForValue(this.options.value));
    if (this.numberInput) {
      this.numberInput.value = formatNumber(this.options.value);
    }
    this.refreshDisplay();
  }

  setMax(max: number): void {
    this.options.max = max;
    if (this.options.scale !== 'log') {
      this.range.max = String(max);
    }
    if (this.numberInput) {
      this.numberInput.max = String(max);
    }
    const edge = this.element.querySelector('.range-edges span:last-child');
    if (edge) {
      edge.textContent = this.formatEdge(max);
    }
    this.setValue(Math.min(this.options.value, max));
  }

  setDisabled(disabled: boolean): void {
    this.range.disabled = disabled;
    if (this.numberInput) {
      this.numberInput.disabled = disabled;
    }
  }

  get value(): number {
    return this.options.value;
  }

  private handleRangeInput(): void {
    const position = Number(this.range.value);
    const value = this.valueForPosition(position);
    this.options.value = value;
    if (this.numberInput) {
      this.numberInput.value = formatNumber(value);
    }
    this.refreshDisplay();
    this.options.onInput(value);
  }

  private handleNumberChange(): void {
    if (!this.numberInput) {
      return;
    }
    const parsed = Number(this.numberInput.value);
    if (!Number.isFinite(parsed)) {
      this.numberInput.value = formatNumber(this.options.value);
      return;
    }
    const value = clamp(parsed, this.options.min, this.options.max);
    this.options.value = value;
    this.numberInput.value = formatNumber(value);
    this.range.value = String(this.positionForValue(value));
    this.refreshDisplay();
    this.options.onInput(value);
  }

  private refreshDisplay(): void {
    const value = this.options.value;
    this.output.textContent = this.formatValue(value);
    this.range.setAttribute('aria-valuetext', this.formatValue(value));
    this.range.style.setProperty('--fill', `${this.fillPercent(value)}%`);
  }

  private positionForValue(value: number): number {
    if (this.options.scale === 'log') {
      const ratio =
        Math.log(value / this.options.min) / Math.log(this.options.max / this.options.min);
      return Math.round(clamp(ratio, 0, 1) * LOG_STEPS);
    }
    return value;
  }

  private valueForPosition(position: number): number {
    if (this.options.scale === 'log') {
      const ratio = clamp(position / LOG_STEPS, 0, 1);
      const value = this.options.min * (this.options.max / this.options.min) ** ratio;
      return Math.round(value * 10) / 10;
    }
    return position;
  }

  private fillPercent(value: number): number {
    if (this.options.scale === 'log') {
      return (this.positionForValue(value) / LOG_STEPS) * 100;
    }
    return ((value - this.options.min) / (this.options.max - this.options.min)) * 100;
  }

  private formatValue(value: number): string {
    return this.options.formatValue
      ? this.options.formatValue(value)
      : `${formatNumber(value)}${this.options.unit ?? ''}`;
  }

  private formatEdge(value: number): string {
    return this.options.formatEdge ? this.options.formatEdge(value) : formatNumber(value);
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}
