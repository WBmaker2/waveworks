import { engine } from '../../audio/AudioEngine';
import type { Store } from '../../app/store';
import { CHALLENGES, type AppState } from '../../app/state';
import { h, iconEl } from '../../ui/dom';
import type { Challenge, ChallengeConcept } from './types';
import { evaluateChallenge, type Evaluation } from './evaluate';
import { previewChallengeTarget } from './preview';

export const CONCEPT_LABEL: Record<ChallengeConcept, string> = {
  pitch: '음높이',
  waveform: '파형',
  harmonics: '배음',
  chord: '화음',
  rhythm: '리듬',
};

export interface ChallengeWorkbenchOptions {
  challenge: Challenge;
  challengeNumber: number;
  onExit: () => void;
  onNext: (id: string) => void;
}

export class ChallengeWorkbench {
  readonly element: HTMLElement;
  private readonly challenge: Challenge;
  private readonly store: Store;
  private readonly options: ChallengeWorkbenchOptions;
  private readonly currentValue: HTMLElement;
  private readonly feedback: HTMLElement;
  private readonly submitButton: HTMLButtonElement;
  private readonly previewButton: HTMLButtonElement;
  private readonly unsubscribe: () => void;
  private nextId: string | null;
  private nextReady = false;

  constructor(store: Store, options: ChallengeWorkbenchOptions) {
    this.store = store;
    this.challenge = options.challenge;
    this.options = options;
    this.nextId = findNextChallenge(this.store.get(), this.challenge.id);

    this.currentValue = h('strong', { className: 'workbench-current' });
    this.feedback = h('div', {
      className: 'workbench-feedback',
      attrs: { 'aria-live': 'polite' },
    });
    this.submitButton = h(
      'button',
      {
        className: 'btn btn-primary btn-pulse',
        attrs: { type: 'button' },
        on: { click: () => this.submit() },
      },
      iconEl('target', 18),
      '제출하고 비교',
    );
    this.previewButton = h(
      'button',
      {
        className: 'btn btn-secondary',
        attrs: { type: 'button' },
        on: { click: () => void this.preview() },
      },
      iconEl('volume', 18),
      '목표 듣기',
    );

    this.element = h(
      'section',
      {
        className: 'challenge-workbench',
        attrs: { 'aria-labelledby': 'workbench-title' },
      },
      h(
        'div',
        { className: 'workbench-head' },
        h(
          'p',
          { className: 'workbench-kicker' },
          `도전 ${String(options.challengeNumber).padStart(2, '0')} · ${
            CONCEPT_LABEL[this.challenge.concept]
          } · 난이도 ${this.challenge.difficulty}/3`,
        ),
        h('h2', { id: 'workbench-title' }, this.challenge.titleKo),
        h('p', { className: 'workbench-prompt' }, this.challenge.promptKo),
      ),
      h(
        'div',
        { className: 'workbench-data' },
        h(
          'div',
          { className: 'workbench-datum' },
          h('span', {}, '목표'),
          h('strong', {}, this.challenge.targetSummaryKo),
        ),
        h('div', { className: 'workbench-datum' }, h('span', {}, '현재 설정'), this.currentValue),
      ),
      h(
        'div',
        { className: 'workbench-actions' },
        this.previewButton,
        this.submitButton,
        h(
          'button',
          {
            className: 'btn btn-ghost',
            attrs: { type: 'button' },
            on: { click: () => this.options.onExit() },
          },
          '도전 목록',
        ),
      ),
      this.feedback,
    );

    this.refresh(store.get());
    this.unsubscribe = store.subscribe((state) => this.refresh(state));
  }

  destroy(): void {
    this.unsubscribe();
  }

  private refresh(state: AppState): void {
    const evaluation = evaluateChallenge(this.challenge, state);
    this.currentValue.textContent = evaluation.currentSummary;
    const visualsOnly = state.preferences.visualsOnly;
    this.previewButton.disabled = visualsOnly;
    this.previewButton.title = visualsOnly
      ? '시각 전용 모드에서는 소리를 재생하지 않습니다. 목표 값은 위에 표시됩니다.'
      : '목표 소리를 미리 듣습니다.';
    this.nextId = findNextChallenge(state, this.challenge.id);
    const next = this.nextId ? getNextChallenge(state, this.nextId) : null;
    const prediction = this.nextId ? state.challenge.predictions[this.nextId] : undefined;
    this.nextReady = Boolean(
      next && prediction !== undefined && Number(prediction) === next.prediction.correctIndex,
    );
  }

  private submit(): void {
    const state = this.store.get();
    const evaluation = evaluateChallenge(this.challenge, state);

    this.store.update((draft) => {
      draft.challenge.answers[this.challenge.id] = evaluation.currentSummary;
      if (evaluation.correct) {
        if (!draft.challenge.completed.includes(this.challenge.id)) {
          draft.challenge.completed.push(this.challenge.id);
        }
        draft.challenge.currentId = null;
      }
    });

    this.renderFeedback(evaluation);
  }

  private renderFeedback(evaluation: Evaluation): void {
    this.feedback.className = `workbench-feedback ${
      evaluation.correct ? 'is-correct' : 'is-wrong'
    }`;
    this.feedback.replaceChildren();

    if (!evaluation.correct) {
      this.feedback.append(
        h('p', { className: 'feedback-title' }, '아직 목표와 다릅니다.'),
        h('p', {}, evaluation.detail),
        h(
          'dl',
          { className: 'compare-list' },
          h('dt', {}, '내 설정'),
          h('dd', {}, evaluation.currentSummary),
          h('dt', {}, '목표'),
          h('dd', {}, evaluation.targetSummary),
        ),
      );
      return;
    }

    const nextId = this.nextId;
    const primaryAction =
      nextId && this.nextReady
        ? h(
            'button',
            {
              className: 'btn btn-primary btn-pulse',
              attrs: { type: 'button' },
              on: { click: () => this.options.onNext(nextId) },
            },
            '다음 도전',
            iconEl('arrowRight', 18),
          )
        : h(
            'button',
            {
              className: 'btn btn-primary btn-pulse',
              attrs: { type: 'button' },
              on: { click: () => this.options.onExit() },
            },
            nextId ? '다음 도전 예측하기' : '도전 목록으로',
            iconEl('arrowRight', 18),
          );

    this.feedback.append(
      h(
        'div',
        { className: 'award-line' },
        h('span', { className: 'award-stamp' }, iconEl('check', 16), '완료'),
        h('p', { className: 'feedback-title' }, '목표를 정확히 맞췄습니다.'),
      ),
      h('p', {}, evaluation.detail),
      h(
        'dl',
        { className: 'compare-list' },
        h('dt', {}, '내 설정'),
        h('dd', {}, evaluation.currentSummary),
        h('dt', {}, '목표'),
        h('dd', {}, evaluation.targetSummary),
      ),
      h('p', { className: 'explanation' }, this.challenge.explanationKo),
      h('p', { className: 'takeaway' }, h('span', {}, '가져갈 원리'), this.challenge.takeawayKo),
      h(
        'div',
        { className: 'feedback-actions' },
        primaryAction,
        h(
          'button',
          {
            className: 'btn btn-ghost',
            attrs: { type: 'button' },
            on: { click: () => this.options.onExit() },
          },
          '도전 목록',
        ),
      ),
    );
  }

  private async preview(): Promise<void> {
    this.previewButton.disabled = true;
    const ok = await previewChallengeTarget(this.challenge, engine);
    if (!ok && !this.store.get().preferences.visualsOnly) {
      this.feedback.className = 'workbench-feedback is-wrong';
      this.feedback.replaceChildren(
        h('p', { className: 'feedback-title' }, '목표 소리를 재생하지 못했습니다.'),
        h('p', {}, '오디오를 켠 뒤 다시 시도해 주세요.'),
      );
    }
    this.previewButton.disabled = this.store.get().preferences.visualsOnly;
  }
}

function findNextChallenge(state: AppState, currentId: string): string | null {
  const active = state.challenge.activeIds;
  if (active.length === 0) {
    return null;
  }
  const start = active.indexOf(currentId);
  for (let offset = 1; offset <= active.length; offset += 1) {
    const index = (start + offset + active.length) % active.length;
    const id = active[index];
    if (id && !state.challenge.completed.includes(id)) {
      return id;
    }
  }
  return null;
}

function getNextChallenge(state: AppState, id: string): Challenge | null {
  return state.challenge.activeIds.includes(id)
    ? (CHALLENGES.find((challenge) => challenge.id === id) ?? null)
    : null;
}
