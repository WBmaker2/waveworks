import { engine } from '../../audio/AudioEngine';
import {
  chordLabel,
  chordTones,
  intervalLabel,
  QUALITY_LABEL,
  type ChordQuality,
} from '../../audio/chords';
import { formatHz, midiToFrequency, midiToName } from '../../audio/notes';
import type { Room, RoomContext } from '../../app/room';
import { CHALLENGES, getChallenge } from '../../app/state';
import { CONCEPT_ROOM } from '../challenges/evaluate';
import { ChallengeWorkbench } from '../challenges/ChallengeWorkbench';
import { h, iconEl } from '../../ui/dom';
import { isTypingTarget, midiForCode, PianoKeyboard } from '../../ui/PianoKeyboard';
import { ScopeStack } from '../../ui/ScopeStack';

interface HistoryItem {
  rootMidi: number;
  quality: ChordQuality;
}

const ROOT_MIDIS = Array.from({ length: 24 }, (_, index) => 60 + index);

export class ChordsRoom implements Room {
  readonly element: HTMLElement;
  private readonly store: RoomContext['store'];
  private readonly scope: ScopeStack;
  private readonly workbench: ChallengeWorkbench | null;
  private readonly piano: PianoKeyboard;
  private readonly rootSelect: HTMLSelectElement;
  private readonly qualityButtons = new Map<ChordQuality, HTMLButtonElement>();
  private readonly chordTitle: HTMLElement;
  private readonly intervalText: HTMLElement;
  private readonly noteChips: HTMLElement;
  private readonly historyStrip: HTMLElement;
  private readonly status: HTMLElement;
  private readonly history: HistoryItem[] = [];
  private busy = false;
  private destroyed = false;
  private scopeActive = false;
  private scopeTimer: number | null = null;

  constructor(context: RoomContext) {
    this.store = context.store;
    const state = this.store.get();
    const challenge = getChallenge(state.challenge.currentId);
    this.workbench =
      challenge && CONCEPT_ROOM[challenge.concept] === 'chords'
        ? new ChallengeWorkbench(this.store, {
            challenge,
            challengeNumber: CHALLENGES.findIndex((item) => item.id === challenge.id) + 1,
            onExit: context.exitChallenge,
            onNext: context.openChallenge,
          })
        : null;

    this.scope = new ScopeStack();
    this.chordTitle = h('h3', { className: 'chord-name' });
    this.intervalText = h('p', { className: 'chord-intervals' });
    this.noteChips = h('div', { className: 'note-chips' });
    this.historyStrip = h('div', { className: 'history-strip' });
    this.status = h('p', { className: 'play-status' });

    this.rootSelect = h(
      'select',
      {
        className: 'select-control',
        attrs: { id: 'chord-root', 'aria-label': '화음 근음' },
        on: { change: () => this.setRoot(Number(this.rootSelect.value)) },
      },
      ...ROOT_MIDIS.map((midi) =>
        h(
          'option',
          { attrs: { value: String(midi) } },
          `${midiToName(midi)} · ${formatHz(midiToFrequency(midi))}`,
        ),
      ),
    );

    const qualityGroup = h(
      'div',
      { className: 'segmented', attrs: { role: 'group', 'aria-label': '화음 종류' } },
      ...(['major', 'minor'] as const).map((quality) => {
        const button = h(
          'button',
          {
            className: 'segment-btn',
            attrs: { type: 'button', 'aria-pressed': 'false' },
            on: { click: () => this.setQuality(quality) },
          },
          QUALITY_LABEL[quality],
          h('span', {}, intervalLabel(quality)),
        );
        this.qualityButtons.set(quality, button);
        return button;
      }),
    );

    this.piano = new PianoKeyboard({
      startMidi: 60,
      endMidi: 83,
      onKey: (midi) => {
        this.setRoot(midi);
        void this.playChord(false);
      },
    });

    const chordDisplay = h(
      'div',
      { className: 'chord-display' },
      h('p', { className: 'field-label' }, '지금 만든 화음'),
      this.chordTitle,
      this.intervalText,
      this.noteChips,
    );

    const playRow = h(
      'div',
      { className: 'play-row' },
      h(
        'button',
        {
          className: 'btn btn-primary play-toggle',
          attrs: { type: 'button' },
          on: { click: () => void this.playChord(false) },
        },
        iconEl('play', 20),
        '화음 듣기',
      ),
      h(
        'button',
        {
          className: 'btn btn-secondary',
          attrs: { type: 'button' },
          on: { click: () => void this.playChord(true) },
        },
        iconEl('arrowRight', 18),
        '아르페지오',
      ),
      this.status,
    );

    const controls = h(
      'section',
      { className: 'panel control-panel', attrs: { 'aria-labelledby': 'chords-controls-title' } },
      h('h2', { id: 'chords-controls-title', className: 'panel-title' }, '화음 만들기'),
      h(
        'div',
        { className: 'chord-selectors' },
        h(
          'div',
          { className: 'field' },
          h('label', { className: 'field-label', attrs: { for: 'chord-root' } }, '근음'),
          this.rootSelect,
        ),
        h(
          'div',
          { className: 'field' },
          h('span', { className: 'field-label' }, '종류'),
          qualityGroup,
        ),
      ),
      chordDisplay,
      playRow,
    );

    const historyPanel = h(
      'section',
      { className: 'panel history-panel', attrs: { 'aria-labelledby': 'history-title' } },
      h('h2', { id: 'history-title', className: 'panel-title' }, '화음 기록'),
      this.historyStrip,
      h('p', { className: 'field-help' }, '최근에 연주한 화음 다섯 개를 다시 들을 수 있습니다.'),
    );

    const reading = h(
      'section',
      { className: 'panel reading-panel', attrs: { 'aria-labelledby': 'chords-reading-title' } },
      h('h2', { id: 'chords-reading-title', className: 'panel-title' }, '읽을거리'),
      h(
        'div',
        { className: 'reading-grid' },
        h(
          'div',
          {},
          h('h3', {}, '반음으로 세는 화음'),
          h(
            'p',
            {},
            '메이저는 근음에서 0·4·7반음, 마이너는 0·3·7반음입니다. 가운데 음이 반음 내려가면 밝은 느낌이 어두운 느낌으로 바뀝니다.',
          ),
        ),
        h(
          'div',
          {},
          h('h3', {}, '건반으로 연주하기'),
          h(
            'p',
            {},
            '컴퓨터 키 A W S E D F T G Y H U J가 C4부터 B4까지의 건반에 연결되어 있습니다. 건반을 누르면 근음이 바뀌고 화음을 미리 들려줍니다.',
          ),
        ),
      ),
    );

    const pianoPanel = h(
      'section',
      { className: 'panel piano-panel', attrs: { 'aria-labelledby': 'piano-title' } },
      h(
        'div',
        { className: 'panel-head-row' },
        h('h2', { id: 'piano-title', className: 'panel-title' }, '건반'),
        h(
          'p',
          { className: 'field-help' },
          '건반을 누르면 그 음이 근음이 되고 화음을 미리 들려줍니다.',
        ),
      ),
      h('div', { className: 'piano-scroll' }, this.piano.element),
    );

    this.element = h(
      'div',
      { className: 'room-content' },
      this.workbench?.element ?? null,
      h(
        'div',
        { className: 'room-grid' },
        h('div', { className: 'panel-stack' }, controls, historyPanel, reading),
        h('div', { className: 'scope-column' }, this.scope.element),
      ),
      pianoPanel,
    );

    document.addEventListener('keydown', this.handleKeydown);
    this.updateChordUi();
    this.renderHistory();
  }

  destroy(): void {
    this.destroyed = true;
    document.removeEventListener('keydown', this.handleKeydown);
    this.clearScopeTimer();
    this.workbench?.destroy();
    this.scope.destroy();
  }

  pause(): void {
    this.clearScopeTimer();
    this.setScopeActive(false);
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      isTypingTarget(event.target) ||
      document.querySelector('dialog[open]')
    ) {
      return;
    }
    const midi = midiForCode(event.code);
    if (midi === null) {
      return;
    }
    event.preventDefault();
    this.piano.flash(midi);
    this.setRoot(midi);
    void this.playChord(false);
  };

  private setRoot(rootMidi: number): void {
    this.store.update((draft) => {
      draft.chord.rootMidi = rootMidi;
    });
    this.rootSelect.value = String(rootMidi);
    this.updateChordUi();
  }

  private setQuality(quality: ChordQuality): void {
    this.store.update((draft) => {
      draft.chord.quality = quality;
    });
    this.updateChordUi();
  }

  private async playChord(arpeggio: boolean): Promise<void> {
    if (this.busy) {
      return;
    }
    const state = this.store.get();
    const tones = chordTones(state.chord.rootMidi, state.chord.quality);
    this.rememberChord({ rootMidi: state.chord.rootMidi, quality: state.chord.quality });

    if (state.preferences.visualsOnly) {
      this.setScopeActive(true, arpeggio ? 1600 : 1200);
      this.status.textContent = `${chordLabel(state.chord.rootMidi, state.chord.quality)} · 시각 전용 재생`;
      return;
    }

    this.busy = true;
    const started = await engine.start();
    if (!started || this.destroyed) {
      this.busy = false;
      if (!this.destroyed) {
        this.status.textContent = '오디오를 시작하지 못했습니다. 소리 버튼을 다시 눌러 주세요.';
      }
      return;
    }

    const now = engine.currentTime + 0.03;
    tones.forEach((tone, index) => {
      engine.playVoice({
        frequency: tone.frequency,
        waveform: 'sine',
        level: 0.3,
        duration: 0.95,
        when: now + (arpeggio ? index * 0.22 : 0),
      });
    });
    this.busy = false;
    this.setScopeActive(true, 1250 + (arpeggio ? 450 : 0));
    this.status.textContent = `${chordLabel(state.chord.rootMidi, state.chord.quality)} · ${
      arpeggio ? '아르페지오 재생' : '화음 재생'
    }`;
  }

  private setScopeActive(active: boolean, duration = 0): void {
    this.clearScopeTimer();
    this.scopeActive = active;
    if (active && duration > 0) {
      this.scopeTimer = window.setTimeout(() => {
        this.scopeActive = false;
        this.scopeTimer = null;
        this.updateScope();
        const state = this.store.get();
        this.status.textContent = `${chordLabel(state.chord.rootMidi, state.chord.quality)} · 3개 음`;
      }, duration);
    }
    this.updateScope();
  }

  private clearScopeTimer(): void {
    if (this.scopeTimer !== null) {
      window.clearTimeout(this.scopeTimer);
      this.scopeTimer = null;
    }
  }

  private rememberChord(item: HistoryItem): void {
    const last = this.history[0];
    if (!last || last.rootMidi !== item.rootMidi || last.quality !== item.quality) {
      this.history.unshift(item);
      if (this.history.length > 5) {
        this.history.pop();
      }
      this.renderHistory();
    }
  }

  private renderHistory(): void {
    this.historyStrip.replaceChildren();
    if (this.history.length === 0) {
      this.historyStrip.append(h('p', { className: 'empty-note' }, '아직 연주한 화음이 없습니다.'));
      return;
    }
    for (const item of this.history) {
      this.historyStrip.append(
        h(
          'button',
          {
            className: 'history-chip',
            attrs: { type: 'button' },
            on: {
              click: () => {
                this.store.update((draft) => {
                  draft.chord.rootMidi = item.rootMidi;
                  draft.chord.quality = item.quality;
                });
                this.rootSelect.value = String(item.rootMidi);
                this.updateChordUi();
                void this.playChord(false);
              },
            },
          },
          h('strong', {}, chordLabel(item.rootMidi, item.quality)),
          h('span', {}, intervalLabel(item.quality)),
        ),
      );
    }
  }

  private updateChordUi(): void {
    const state = this.store.get();
    const tones = chordTones(state.chord.rootMidi, state.chord.quality);
    this.chordTitle.textContent = chordLabel(state.chord.rootMidi, state.chord.quality);
    this.intervalText.textContent = `근음에서 ${intervalLabel(state.chord.quality)} 반음`;
    this.noteChips.replaceChildren();
    tones.forEach((tone, index) => {
      this.noteChips.append(
        h(
          'span',
          { className: `note-chip ${index === 0 ? 'is-root' : ''}` },
          h('strong', {}, tone.name),
          h('span', {}, `+${tone.interval}반음 · ${formatHz(tone.frequency)}`),
        ),
      );
    });
    for (const [quality, button] of this.qualityButtons) {
      button.setAttribute('aria-pressed', String(quality === state.chord.quality));
    }
    this.piano.setHighlighted(
      tones.map((tone) => tone.midi),
      state.chord.rootMidi,
    );
    this.status.textContent = `${chordLabel(state.chord.rootMidi, state.chord.quality)} · 3개 음`;
    this.updateScope();
  }

  private updateScope(): void {
    const state = this.store.get();
    const tones = chordTones(state.chord.rootMidi, state.chord.quality);
    const frequencies = tones.map((tone) => tone.frequency);
    const markers = tones.map((tone) => ({
      frequency: tone.frequency,
      label: tone.name.replace(/-?\d+$/, ''),
    }));
    const live = this.scopeActive && !state.preferences.visualsOnly && engine.running;
    this.scope.setWaveform({
      frequency: midiToFrequency(state.chord.rootMidi),
      tones: frequencies,
      mode: 'tones',
      level: 0.55,
      active: this.scopeActive,
      live,
      reducedMotion: state.preferences.reducedMotion,
    });
    this.scope.setSpectrum({
      frequency: midiToFrequency(state.chord.rootMidi),
      tones: frequencies,
      mode: 'tones',
      level: 0.7,
      active: this.scopeActive,
      live,
      markers,
    });
  }
}
