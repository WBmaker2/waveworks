import { midiToName } from '../audio/notes';
import { h } from './dom';

export const KEYBOARD_SHORTCUTS: Record<string, number> = {
  KeyA: 60,
  KeyW: 61,
  KeyS: 62,
  KeyE: 63,
  KeyD: 64,
  KeyF: 65,
  KeyT: 66,
  KeyG: 67,
  KeyY: 68,
  KeyH: 69,
  KeyU: 70,
  KeyJ: 71,
};

export interface PianoOptions {
  startMidi?: number;
  endMidi?: number;
  onKey: (midi: number) => void;
}

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

function isBlack(midi: number): boolean {
  return BLACK_PITCH_CLASSES.has(((midi % 12) + 12) % 12);
}

export class PianoKeyboard {
  readonly element: HTMLElement;
  private readonly keys = new Map<number, HTMLButtonElement>();
  private readonly onKey: (midi: number) => void;

  constructor(options: PianoOptions) {
    const startMidi = options.startMidi ?? 60;
    const endMidi = options.endMidi ?? 83;
    this.onKey = options.onKey;

    this.element = h('div', {
      className: 'piano',
      attrs: { role: 'group', 'aria-label': '피아노 건반' },
    });

    const whites: number[] = [];
    for (let midi = startMidi; midi <= endMidi; midi += 1) {
      if (!isBlack(midi)) {
        whites.push(midi);
      }
    }
    this.element.style.setProperty('--white-count', String(whites.length));

    for (const midi of whites) {
      const button = this.createKey(midi, false);
      this.element.append(button);
    }

    for (let midi = startMidi; midi <= endMidi; midi += 1) {
      if (!isBlack(midi)) {
        continue;
      }
      const button = this.createKey(midi, true);
      const whitesBefore = whites.filter((white) => white < midi).length;
      button.style.left = `${(whitesBefore / whites.length) * 100}%`;
      this.element.append(button);
    }
  }

  setHighlighted(midis: readonly number[], rootMidi: number | null): void {
    for (const [midi, button] of this.keys) {
      button.classList.toggle('is-chord', midis.includes(midi));
      button.classList.toggle('is-root', midi === rootMidi);
    }
  }

  setEnabled(enabled: boolean): void {
    for (const button of this.keys.values()) {
      button.disabled = !enabled;
    }
  }

  flash(midi: number): void {
    const button = this.keys.get(midi);
    if (!button) {
      return;
    }
    button.classList.add('is-pressed');
    window.setTimeout(() => button.classList.remove('is-pressed'), 140);
  }

  private createKey(midi: number, black: boolean): HTMLButtonElement {
    const name = midiToName(midi);
    const shortcut = shortcutLabel(midi);
    const button = h(
      'button',
      {
        className: `piano-key ${black ? 'piano-black' : 'piano-white'}`,
        attrs: {
          type: 'button',
          'aria-label': `${name} 음 재생`,
          'data-midi': String(midi),
        },
        on: {
          click: () => {
            this.flash(midi);
            this.onKey(midi);
          },
        },
      },
      h('span', { className: 'piano-note' }, name),
      shortcut ? h('span', { className: 'piano-shortcut' }, shortcut) : null,
    );
    this.keys.set(midi, button);
    return button;
  }
}

export function shortcutLabel(midi: number): string | null {
  const found = Object.entries(KEYBOARD_SHORTCUTS).find(([, value]) => value === midi);
  return found ? found[0].replace('Key', '') : null;
}

export function midiForCode(code: string): number | null {
  return KEYBOARD_SHORTCUTS[code] ?? null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
