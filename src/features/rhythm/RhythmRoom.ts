import { engine } from '../../audio/AudioEngine';
import { MAX_BPM, MIN_BPM, SCHEDULER_INTERVAL_MS, STEP_NOTE_SECONDS } from '../../audio/constants';
import { frequencyToMidi, midiToFrequency, midiToName } from '../../audio/notes';
import { StepScheduler, stepDuration } from '../../audio/scheduler';
import type { Room, RoomContext } from '../../app/room';
import { CHALLENGES, getChallenge } from '../../app/state';
import scalesJson from '../../data/scales.json';
import { Playhead } from '../../render/Playhead';
import { CONCEPT_ROOM } from '../challenges/evaluate';
import { ChallengeWorkbench } from '../challenges/ChallengeWorkbench';
import { h } from '../../ui/dom';
import { ScopeStack } from '../../ui/ScopeStack';
import { SequencerGrid } from '../../ui/SequencerGrid';
import { Slider } from '../../ui/Slider';
import { Transport } from '../../ui/Transport';

interface ScalesData {
  rhythmChoices: { midi: number[] };
}

const RHYTHM_CHOICES = (scalesJson as ScalesData).rhythmChoices.midi;

export class RhythmRoom implements Room {
  readonly element: HTMLElement;
  private readonly store: RoomContext['store'];
  private readonly announce: RoomContext['announce'];
  private readonly scope: ScopeStack;
  private readonly workbench: ChallengeWorkbench | null;
  private readonly grid: SequencerGrid;
  private readonly transport: Transport;
  private readonly tempoSlider: Slider;
  private readonly stepInfo: HTMLElement;
  private readonly status: HTMLElement;
  private readonly playhead: Playhead;
  private scheduler: StepScheduler | null = null;
  private timer: number | null = null;
  private playing = false;
  private audioMode = true;
  private busy = false;
  private destroyed = false;

  constructor(context: RoomContext) {
    this.store = context.store;
    this.announce = context.announce;
    const state = this.store.get();
    const challenge = getChallenge(state.challenge.currentId);
    this.workbench =
      challenge && CONCEPT_ROOM[challenge.concept] === 'rhythm'
        ? new ChallengeWorkbench(this.store, {
            challenge,
            challengeNumber: CHALLENGES.findIndex((item) => item.id === challenge.id) + 1,
            onExit: context.exitChallenge,
            onNext: context.openChallenge,
          })
        : null;

    this.scope = new ScopeStack();
    this.status = h('p', { className: 'play-status' });
    this.stepInfo = h('p', { className: 'step-info' });

    this.grid = new SequencerGrid({
      steps: state.rhythm.steps,
      choices: RHYTHM_CHOICES,
      onChange: (steps) => {
        this.store.update((draft) => {
          draft.rhythm.steps = steps;
        });
        this.scheduler?.setSteps(steps);
        this.updateScope();
      },
      onPreview: (midi) => this.previewNote(midi),
    });

    this.tempoSlider = new Slider({
      labelKo: '템포',
      min: MIN_BPM,
      max: MAX_BPM,
      value: state.rhythm.bpm,
      step: 1,
      numeric: true,
      unit: 'BPM',
      formatValue: (value) => `${Math.round(value)} BPM`,
      formatEdge: (value) => String(value),
      helpKo: 'BPM은 1분 동안의 박자 수입니다. 이 패턴은 8분음표 8칸으로 이루어집니다.',
      onInput: (value) => this.setBpm(value),
    });

    this.transport = new Transport({
      playing: false,
      metronome: state.rhythm.metronome,
      onTogglePlay: () => void this.togglePlay(),
      onClear: () => this.clearPattern(),
      onToggleMetronome: (enabled) => this.setMetronome(enabled),
    });

    this.playhead = new Playhead(
      () => (this.audioMode ? engine.currentTime : performance.now() / 1000),
      (step) => this.grid.setPlayhead(step),
    );

    const patternPanel = h(
      'section',
      { className: 'panel rhythm-panel', attrs: { 'aria-labelledby': 'rhythm-pattern-title' } },
      h('h2', { id: 'rhythm-pattern-title', className: 'panel-title' }, '8단계 패턴'),
      h('div', { className: 'tempo-block' }, this.tempoSlider.element, this.stepInfo),
      this.transport.element,
      this.grid.element,
      this.status,
    );

    const reading = h(
      'section',
      { className: 'panel reading-panel', attrs: { 'aria-labelledby': 'rhythm-reading-title' } },
      h('h2', { id: 'rhythm-reading-title', className: 'panel-title' }, '읽을거리'),
      h(
        'div',
        { className: 'reading-grid' },
        h(
          'div',
          {},
          h('h3', {}, '8분음표 한 칸'),
          h(
            'p',
            {},
            '120 BPM에서 4분음표 한 박은 0.5초, 8분음표 한 칸은 0.25초입니다. 템포를 바꾸면 모든 칸의 길이가 함께 바뀝니다.',
          ),
        ),
        h(
          'div',
          {},
          h('h3', {}, '미리 예약하는 스케줄러'),
          h(
            'p',
            {},
            '이 실험실은 25 ms마다 0.1초 앞의 소리를 오디오 시계에 정확히 예약합니다. 타이머가 늦게 울려도 박자가 밀리지 않습니다.',
          ),
        ),
        h(
          'div',
          {},
          h('h3', {}, '쉼표도 리듬입니다'),
          h(
            'p',
            {},
            '소리가 없는 칸도 박자를 만듭니다. 쉼표를 넣고 빼면서 리듬의 느낌이 어떻게 달라지는지 비교해 보세요.',
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
        h('div', { className: 'panel-stack' }, patternPanel, reading),
        h('div', { className: 'scope-column' }, this.scope.element),
      ),
    );

    this.updateStepInfo();
    this.updateScope();
    this.updateStatus();
  }

  destroy(): void {
    this.destroyed = true;
    this.stopPlayback();
    this.workbench?.destroy();
    this.scope.destroy();
  }

  pause(): void {
    if (this.playing) {
      this.stopPlayback();
      this.announce('탭이 숨겨져 재생을 멈췄습니다.');
    }
  }

  private setBpm(bpm: number): void {
    this.store.update((draft) => {
      draft.rhythm.bpm = bpm;
    });
    this.scheduler?.setBpm(bpm);
    this.updateStepInfo();
    this.updateStatus();
  }

  private setMetronome(enabled: boolean): void {
    this.store.update((draft) => {
      draft.rhythm.metronome = enabled;
    });
    this.transport.setMetronome(enabled);
    this.announce(enabled ? '메트로놈을 켰습니다.' : '메트로놈을 껐습니다.');
  }

  private clearPattern(): void {
    const empty = Array.from({ length: 8 }, () => null);
    this.store.update((draft) => {
      draft.rhythm.steps = empty;
    });
    this.grid.setSteps(empty);
    this.scheduler?.setSteps(empty);
    this.updateScope();
    this.announce('리듬 패턴을 비웠습니다.');
  }

  private async togglePlay(): Promise<void> {
    if (this.busy) {
      return;
    }
    if (this.playing) {
      this.stopPlayback();
      return;
    }
    this.busy = true;
    const state = this.store.get();
    this.audioMode = !state.preferences.visualsOnly;

    if (this.audioMode) {
      const started = await engine.start();
      if (!started || this.destroyed) {
        this.busy = false;
        this.updateStatus('오디오를 시작하지 못했습니다. 소리 버튼을 다시 눌러 주세요.');
        return;
      }
    }

    this.scheduler = new StepScheduler({
      bpm: state.rhythm.bpm,
      steps: state.rhythm.steps,
    });
    this.playhead.reset();
    this.playhead.start();
    this.scheduler.start(this.clockNow() + 0.04);
    this.playing = true;
    this.busy = false;
    this.transport.setPlaying(true);
    this.store.update((draft) => {
      draft.rhythm.playing = true;
    });
    this.updateScope();
    this.updateStatus();
    this.timer = window.setInterval(() => this.tick(), SCHEDULER_INTERVAL_MS);
    this.tick();
  }

  private tick(): void {
    if (!this.scheduler || !this.playing) {
      return;
    }
    const events = this.scheduler.tick(this.clockNow());
    const state = this.store.get();
    for (const event of events) {
      this.playhead.push(event.loopStep, event.time);
      if (!this.audioMode) {
        continue;
      }
      if (event.midi !== null) {
        engine.playVoice({
          frequency: midiToFrequency(event.midi),
          waveform: 'triangle',
          level: 0.38,
          duration: STEP_NOTE_SECONDS,
          attack: 0.005,
          release: 0.08,
          when: event.time,
        });
      }
      if (state.rhythm.metronome && event.loopStep % 2 === 0) {
        engine.playVoice({
          frequency: event.loopStep === 0 ? 1568 : 1046,
          waveform: 'sine',
          level: 0.1,
          duration: 0.035,
          attack: 0.002,
          release: 0.02,
          when: event.time,
        });
      }
    }
  }

  private stopPlayback(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.scheduler?.stop();
    this.scheduler = null;
    this.playhead.stop();
    this.playing = false;
    this.busy = false;
    this.transport.setPlaying(false);
    if (this.store.get().rhythm.playing) {
      this.store.update((draft) => {
        draft.rhythm.playing = false;
      });
    }
    this.updateScope();
    this.updateStatus();
  }

  private previewNote(midi: number): void {
    if (this.store.get().preferences.visualsOnly) {
      this.updateStatus(
        '시각 전용 모드에서는 미리 듣기를 사용할 수 없습니다. 재생 버튼으로 패턴을 확인하세요.',
      );
      this.announce('시각 전용 모드에서는 미리 듣기를 사용할 수 없습니다.');
      return;
    }
    void (async () => {
      if (!(await engine.start())) {
        return;
      }
      engine.playVoice({
        frequency: midiToFrequency(midi),
        waveform: 'triangle',
        level: 0.38,
        duration: 0.22,
        attack: 0.005,
        release: 0.08,
      });
    })();
  }

  private clockNow(): number {
    return this.audioMode ? engine.currentTime : performance.now() / 1000;
  }

  private updateStepInfo(): void {
    const bpm = this.store.get().rhythm.bpm;
    const seconds = stepDuration(bpm);
    this.stepInfo.textContent = `${bpm} BPM · 8분음표 1칸 = ${seconds.toFixed(2)}초 · 한 바퀴 ${(
      seconds * 8
    ).toFixed(2)}초`;
  }

  private updateStatus(message?: string): void {
    const state = this.store.get();
    if (message) {
      this.status.textContent = message;
      return;
    }
    this.status.textContent = this.playing
      ? state.preferences.visualsOnly
        ? `시각 전용 재생 중 · ${state.rhythm.bpm} BPM · 소리는 나지 않습니다.`
        : `재생 중 · ${state.rhythm.bpm} BPM · 1칸 ${stepDuration(state.rhythm.bpm).toFixed(2)}초`
      : `정지 · ${state.rhythm.bpm} BPM · 8칸`;
  }

  private updateScope(): void {
    const state = this.store.get();
    const tones = uniqueTones(state.rhythm.steps);
    const live = this.playing && this.audioMode && !state.preferences.visualsOnly && engine.running;
    this.scope.setWaveform({
      steps: state.rhythm.steps,
      mode: 'rhythm',
      level: 0.7,
      active: this.playing,
      live,
      reducedMotion: state.preferences.reducedMotion,
    });
    this.scope.setSpectrum({
      frequency: tones[0] ?? 440,
      tones,
      mode: 'tones',
      level: 0.7,
      active: this.playing,
      live,
      markers: tones.map((frequency) => ({
        frequency,
        label: midiToName(frequencyToMidi(frequency)),
      })),
    });
  }
}

function uniqueTones(steps: readonly (number | null)[]): number[] {
  const seen = new Set<number>();
  const tones: number[] = [];
  for (const midi of steps) {
    if (midi === null || seen.has(midi)) {
      continue;
    }
    seen.add(midi);
    tones.push(midiToFrequency(midi));
  }
  return tones;
}
