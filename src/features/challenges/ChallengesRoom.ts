import type { Room, RoomContext } from '../../app/room';
import { CHALLENGES, getChallenge } from '../../app/state';
import { h, iconEl } from '../../ui/dom';
import { CONCEPT_LABEL } from './ChallengeWorkbench';
import type { Challenge } from './types';

export class ChallengesRoom implements Room {
  readonly element: HTMLElement;
  private readonly store: RoomContext['store'];
  private readonly context: RoomContext;
  private readonly feedback = new Map<string, string>();
  private pendingFocus: string | null = null;

  constructor(context: RoomContext) {
    this.context = context;
    this.store = context.store;
    this.element = h('div', { className: 'room-content challenge-room' });
    this.render();
  }

  destroy(): void {
    // No timers or audio owned by this room.
  }

  private render(): void {
    const state = this.store.get();
    const active = state.challenge.activeIds
      .map((id) => getChallenge(id))
      .filter((challenge): challenge is Challenge => challenge !== null);
    const completed = active.filter((challenge) =>
      state.challenge.completed.includes(challenge.id),
    ).length;
    const firstOpen = active.find((challenge) => !state.challenge.completed.includes(challenge.id));
    const firstUnlocked = active.find((challenge) => {
      if (state.challenge.completed.includes(challenge.id)) {
        return false;
      }
      const prediction = state.challenge.predictions[challenge.id];
      return prediction !== undefined && Number(prediction) === challenge.prediction.correctIndex;
    });

    this.element.replaceChildren();
    this.element.append(
      h(
        'section',
        {
          className: 'challenge-overview',
          attrs: { 'aria-labelledby': 'challenge-progress-title' },
        },
        h(
          'div',
          {},
          h('p', { className: 'field-label' }, '진행'),
          h(
            'h2',
            { id: 'challenge-progress-title', className: 'progress-count' },
            `${completed} / ${active.length} 완료`,
          ),
        ),
        h(
          'div',
          {
            className: 'progress-track',
            attrs: {
              role: 'progressbar',
              'aria-valuemin': '0',
              'aria-valuemax': String(active.length),
              'aria-valuenow': String(completed),
              'aria-label': '도전 완료 수',
            },
          },
          h('span', {
            className: 'progress-fill',
            attrs: {
              style: `width: ${active.length === 0 ? 0 : (completed / active.length) * 100}%`,
            },
          }),
        ),
        h(
          'p',
          { className: 'storage-note' },
          '예측과 완료 기록은 이 기기의 브라우저에만 저장됩니다.',
        ),
      ),
    );

    if (active.length === 0) {
      this.element.append(
        h(
          'div',
          { className: 'empty-state' },
          h('h2', {}, '선택된 도전이 없습니다.'),
          h('p', {}, '교사용 화면에서 학생에게 보여 줄 도전을 선택하세요.'),
          h(
            'button',
            {
              className: 'btn btn-primary',
              attrs: { type: 'button' },
              on: { click: () => this.context.navigate('teacher') },
            },
            '교사용으로 이동',
          ),
        ),
      );
      return;
    }

    const list = h('div', { className: 'challenge-list' });
    active.forEach((challenge) => {
      list.append(
        this.createCard(
          challenge,
          state.challenge.completed.includes(challenge.id),
          state.challenge.currentId === challenge.id,
          firstOpen?.id === challenge.id,
          firstUnlocked?.id === challenge.id,
        ),
      );
    });
    this.element.append(list);

    this.element.append(
      h(
        'section',
        { className: 'panel challenge-loop' },
        h('h2', { className: 'panel-title' }, '도전은 이렇게 진행됩니다'),
        h(
          'ol',
          { className: 'loop-list' },
          h('li', {}, h('strong', {}, '예측'), ' 먼저 결과를 골라 봅니다.'),
          h('li', {}, h('strong', {}, '만들기'), ' 실험실에서 목표 소리를 직접 만듭니다.'),
          h('li', {}, h('strong', {}, '비교'), ' 목표와 내 설정을 비교하고 원리를 확인합니다.'),
        ),
      ),
    );

    if (this.pendingFocus) {
      const target = this.element.querySelector<HTMLElement>(`#${this.pendingFocus}`);
      this.pendingFocus = null;
      target?.focus();
    }
  }

  private createCard(
    challenge: Challenge,
    completed: boolean,
    current: boolean,
    isFirstOpen: boolean,
    isFirstUnlocked: boolean,
  ): HTMLElement {
    const state = this.store.get();
    const number = CHALLENGES.findIndex((item) => item.id === challenge.id) + 1;
    const storedPrediction = state.challenge.predictions[challenge.id];
    const predictionCorrect =
      storedPrediction !== undefined &&
      Number(storedPrediction) === challenge.prediction.correctIndex;
    const lastAnswer = state.challenge.answers[challenge.id];
    const feedbackText = this.feedback.get(challenge.id);
    const radioName = `prediction-${challenge.id}`;
    const titleId = `challenge-title-${challenge.id}`;

    const card = h(
      'article',
      {
        className: `challenge-card ${completed ? 'is-complete' : ''} ${
          current ? 'is-current' : ''
        }`.trim(),
        attrs: { 'aria-labelledby': titleId },
      },
      h(
        'div',
        { className: 'challenge-card-head' },
        h('span', { className: 'challenge-number' }, String(number).padStart(2, '0')),
        h(
          'div',
          {},
          h(
            'p',
            { className: 'challenge-meta' },
            `${CONCEPT_LABEL[challenge.concept]} · 난이도 ${challenge.difficulty}/3`,
            current ? h('span', { className: 'tag is-current' }, '실험 중') : null,
            completed ? h('span', { className: 'tag is-complete' }, '완료') : null,
          ),
          h('h2', { id: titleId }, challenge.titleKo),
          h('p', { className: 'challenge-prompt' }, challenge.promptKo),
        ),
      ),
    );

    if (completed) {
      card.append(
        h(
          'div',
          { className: 'challenge-complete-box' },
          h(
            'div',
            { className: 'award-line' },
            h('span', { className: 'award-stamp' }, iconEl('check', 16), '완료'),
            h('p', {}, challenge.takeawayKo),
          ),
          lastAnswer
            ? h('p', { className: 'last-answer' }, '마지막 제출: ', h('strong', {}, lastAnswer))
            : null,
          h(
            'div',
            { className: 'challenge-actions' },
            h(
              'button',
              {
                className: 'btn btn-secondary',
                attrs: { type: 'button' },
                on: { click: () => this.context.openChallenge(challenge.id) },
              },
              '실험실 다시 열기',
              iconEl('arrowRight', 18),
            ),
          ),
        ),
      );
      return card;
    }

    if (predictionCorrect) {
      card.append(
        h(
          'div',
          { className: 'prediction-done' },
          h('span', { className: 'award-stamp' }, iconEl('check', 16), '예측 완료'),
          h('p', {}, challenge.prediction.optionsKo[challenge.prediction.correctIndex]),
          h(
            'button',
            {
              id: `open-${challenge.id}`,
              className: `btn btn-primary ${isFirstUnlocked ? 'btn-pulse' : ''}`.trim(),
              attrs: { type: 'button' },
              on: { click: () => this.context.openChallenge(challenge.id) },
            },
            '실험실 열기',
            iconEl('arrowRight', 18),
          ),
        ),
      );
      return card;
    }

    const fieldset = h(
      'fieldset',
      { className: 'prediction-fieldset' },
      h(
        'legend',
        {},
        h('span', { className: 'field-label' }, '예측'),
        challenge.prediction.questionKo,
      ),
    );
    challenge.prediction.optionsKo.forEach((option, index) => {
      fieldset.append(
        h(
          'label',
          { className: 'radio-option' },
          h('input', {
            attrs: {
              type: 'radio',
              name: radioName,
              value: String(index),
            },
          }),
          h('span', {}, option),
        ),
      );
    });

    const feedbackId = `feedback-${challenge.id}`;
    card.append(fieldset);
    if (feedbackText) {
      card.append(h('p', { className: 'prediction-feedback', id: feedbackId }, feedbackText));
    }
    card.append(
      h(
        'div',
        { className: 'challenge-actions' },
        h(
          'button',
          {
            id: `predict-${challenge.id}`,
            className: `btn btn-primary ${isFirstOpen ? 'btn-pulse' : ''}`.trim(),
            attrs: { type: 'button' },
            on: {
              click: () => {
                const selected = card.querySelector<HTMLInputElement>(
                  `input[name="${radioName}"]:checked`,
                );
                if (!selected) {
                  this.feedback.set(challenge.id, '답을 하나 골라 주세요.');
                  this.context.announce('예측 답을 하나 골라 주세요.');
                  this.pendingFocus = `predict-${challenge.id}`;
                  this.render();
                  return;
                }
                const choice = Number(selected.value);
                if (choice !== challenge.prediction.correctIndex) {
                  this.feedback.set(
                    challenge.id,
                    '예측이 아직 맞지 않습니다. 소리의 원리를 다시 생각해 보고 다른 답을 골라 보세요.',
                  );
                  this.context.announce('예측이 아직 맞지 않습니다. 다시 골라 보세요.');
                  this.pendingFocus = `predict-${challenge.id}`;
                  this.render();
                  return;
                }
                this.feedback.delete(challenge.id);
                this.store.update((draft) => {
                  draft.challenge.predictions[challenge.id] = String(choice);
                });
                this.pendingFocus = `open-${challenge.id}`;
                this.context.announce('예측이 맞았습니다. 실험실을 열어 목표를 만들어 보세요.');
                this.render();
              },
            },
          },
          '예측 확인',
        ),
      ),
    );
    return card;
  }
}
