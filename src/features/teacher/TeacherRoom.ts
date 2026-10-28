import { MAX_MASTER_VOLUME } from '../../audio/constants';
import { formatPercent } from '../../audio/safety';
import type { Room, RoomContext } from '../../app/room';
import { CHALLENGES, resetChallengeProgress, type AppState } from '../../app/state';
import { h, iconEl } from '../../ui/dom';
import { openDialog } from '../../ui/dialog';
import { Slider } from '../../ui/Slider';
import { CONCEPT_LABEL } from '../challenges/ChallengeWorkbench';

export class TeacherRoom implements Room {
  readonly element: HTMLElement;
  private readonly store: RoomContext['store'];
  private readonly announce: RoomContext['announce'];
  private readonly progressText: HTMLElement;
  private readonly volumeSummary: HTMLElement;
  private readonly selectionCount: HTMLElement;
  private readonly answersHost: HTMLElement;
  private readonly unsubscribe: () => void;

  constructor(context: RoomContext) {
    this.store = context.store;
    this.announce = context.announce;
    const state = this.store.get();

    this.progressText = h('strong', { className: 'progress-count' });
    this.volumeSummary = h('p', { className: 'field-help' });
    this.selectionCount = h('p', { className: 'field-help' });
    this.answersHost = h('div', { className: 'teacher-answers' });

    this.element = h(
      'div',
      { className: 'room-content teacher-room' },
      h(
        'div',
        { className: 'teacher-grid' },
        this.createSoundSettings(state),
        this.createChallengeSelection(state),
      ),
      this.createProgressPanel(),
      h(
        'section',
        {
          className: 'panel teacher-answer-panel',
          attrs: { 'aria-labelledby': 'teacher-answers-title' },
        },
        h(
          'div',
          { className: 'panel-head-row' },
          h('h2', { id: 'teacher-answers-title', className: 'panel-title' }, '도전 정답과 해설'),
          h(
            'p',
            { className: 'field-help' },
            '학생에게 보여 주기 전에 문제, 목표, 해설을 확인할 수 있습니다.',
          ),
        ),
        this.answersHost,
      ),
      h(
        'p',
        { className: 'storage-note' },
        '교사용 설정과 학생 진행 기록은 이 기기의 브라우저에만 저장됩니다.',
      ),
    );

    this.renderAnswers();
    this.updateProgress(state);
    this.updateVolumeSummary(state);
    this.updateSelectionCount(state);
    this.unsubscribe = this.store.subscribe((next) => {
      this.updateProgress(next);
      this.updateVolumeSummary(next);
      this.updateSelectionCount(next);
    });
  }

  destroy(): void {
    this.unsubscribe();
  }

  private createSoundSettings(state: AppState): HTMLElement {
    const capSlider = new Slider({
      labelKo: '수업 최대 음량',
      min: 10,
      max: MAX_MASTER_VOLUME * 100,
      value: state.preferences.classVolumeCap * 100,
      step: 1,
      numeric: true,
      unit: '%',
      formatValue: (value) => formatPercent(value / 100),
      formatEdge: (value) => `${value}%`,
      helpKo: '학생 화면의 마스터 음량은 이 값을 넘을 수 없습니다. 오디오 엔진에서도 강제됩니다.',
      onInput: (value) => {
        const cap = value / 100;
        this.store.update((draft) => {
          draft.preferences.classVolumeCap = cap;
          draft.preferences.masterVolume = Math.min(draft.preferences.masterVolume, cap);
        });
        this.announce(`수업 최대 음량을 ${Math.round(value)}퍼센트로 설정했습니다.`);
      },
    });

    return h(
      'section',
      { className: 'panel teacher-panel', attrs: { 'aria-labelledby': 'teacher-sound-title' } },
      h('h2', { id: 'teacher-sound-title', className: 'panel-title' }, '소리와 화면'),
      capSlider.element,
      this.volumeSummary,
      this.createSwitch(
        'toggle-visuals-only',
        '시각 전용 모드',
        '소리를 재생하지 않고 파형, 스펙트럼, 숫자만으로 모든 도전을 진행합니다.',
        state.preferences.visualsOnly,
        (checked) => {
          this.store.update((draft) => {
            draft.preferences.visualsOnly = checked;
          });
          this.announce(
            checked
              ? '시각 전용 모드를 켰습니다. 소리가 나지 않습니다.'
              : '시각 전용 모드를 껐습니다.',
          );
        },
      ),
      this.createSwitch(
        'toggle-reduced-motion',
        '동작 줄이기',
        '파형의 움직임과 화면 전환 애니메이션을 줄입니다. 재생 위치 표시는 유지됩니다.',
        state.preferences.reducedMotion,
        (checked) => {
          this.store.update((draft) => {
            draft.preferences.reducedMotion = checked;
          });
          this.announce(checked ? '동작 줄이기를 켰습니다.' : '동작 줄이기를 껐습니다.');
        },
      ),
      h(
        'div',
        { className: 'switch-note' },
        iconEl('headphones', 18),
        h(
          'p',
          {},
          '학생에게는 첫 실행 때 청력 보호 안내가 표시됩니다. 마스터 음량의 절대 상한은 ',
          h('strong', {}, formatPercent(MAX_MASTER_VOLUME)),
          '입니다.',
        ),
      ),
    );
  }

  private createChallengeSelection(state: AppState): HTMLElement {
    const list = h('div', { className: 'teacher-challenge-list' });

    for (const challenge of CHALLENGES) {
      const checkbox = h('input', {
        attrs: { type: 'checkbox' },
        on: {
          change: () => {
            const current = new Set(this.store.get().challenge.activeIds);
            if (checkbox.checked) {
              current.add(challenge.id);
            } else {
              current.delete(challenge.id);
            }
            this.setActiveIds(current);
          },
        },
      });
      checkbox.checked = state.challenge.activeIds.includes(challenge.id);
      list.append(
        h(
          'label',
          { className: 'teacher-challenge-row' },
          checkbox,
          h(
            'span',
            { className: 'teacher-challenge-info' },
            h(
              'span',
              { className: 'teacher-challenge-meta' },
              `${CONCEPT_LABEL[challenge.concept]} · 난이도 ${challenge.difficulty}/3`,
            ),
            h('strong', {}, challenge.titleKo),
            h('span', { className: 'teacher-challenge-target' }, challenge.targetSummaryKo),
          ),
        ),
      );
    }

    const selectAll = (): void => {
      this.setActiveIds(new Set(CHALLENGES.map((challenge) => challenge.id)));
      for (const input of list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
        input.checked = true;
      }
    };
    const clearAll = (): void => {
      this.setActiveIds(new Set());
      for (const input of list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
        input.checked = false;
      }
    };

    return h(
      'section',
      { className: 'panel teacher-panel', attrs: { 'aria-labelledby': 'teacher-challenge-title' } },
      h('h2', { id: 'teacher-challenge-title', className: 'panel-title' }, '도전 선택'),
      h(
        'p',
        { className: 'field-help' },
        '도전 화면에는 선택한 문제만 표시됩니다. 완료 기록은 선택을 바꿔도 유지됩니다.',
      ),
      this.selectionCount,
      h(
        'div',
        { className: 'select-all-row' },
        h(
          'button',
          {
            className: 'btn btn-secondary',
            attrs: { type: 'button' },
            on: { click: selectAll },
          },
          '모두 선택',
        ),
        h(
          'button',
          {
            className: 'btn btn-secondary',
            attrs: { type: 'button' },
            on: { click: clearAll },
          },
          '모두 해제',
        ),
      ),
      list,
    );
  }

  private createProgressPanel(): HTMLElement {
    return h(
      'section',
      {
        className: 'panel teacher-progress-panel',
        attrs: { 'aria-labelledby': 'teacher-progress-title' },
      },
      h(
        'div',
        {},
        h('h2', { id: 'teacher-progress-title', className: 'panel-title' }, '학생 진행'),
        this.progressText,
        h(
          'p',
          { className: 'field-help' },
          '도전 답안, 예측, 완료 표시를 지웁니다. 소리 설정과 선택한 도전은 유지됩니다.',
        ),
      ),
      h(
        'button',
        {
          className: 'btn btn-danger',
          attrs: { type: 'button' },
          on: { click: () => this.confirmReset() },
        },
        iconEl('reset', 18),
        '진행 기록 초기화',
      ),
    );
  }

  private createSwitch(
    id: string,
    labelKo: string,
    descriptionKo: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
  ): HTMLElement {
    const input = h('input', {
      id,
      attrs: { type: 'checkbox', role: 'switch' },
      on: { change: () => onChange(input.checked) },
    });
    input.checked = checked;
    return h(
      'label',
      { className: 'switch-row', attrs: { for: id } },
      h('span', {}, h('strong', {}, labelKo), h('small', {}, descriptionKo)),
      h('span', { className: 'switch-control' }, input, h('span', { className: 'switch-track' })),
    );
  }

  private setActiveIds(ids: Set<string>): void {
    const ordered = CHALLENGES.map((challenge) => challenge.id).filter((id) => ids.has(id));
    this.store.update((draft) => {
      draft.challenge.activeIds = ordered;
      if (draft.challenge.currentId && !ordered.includes(draft.challenge.currentId)) {
        draft.challenge.currentId = null;
      }
    });
    this.announce(`도전 ${ordered.length}개를 선택했습니다.`);
  }

  private updateSelectionCount(state: AppState): void {
    this.selectionCount.textContent = `${state.challenge.activeIds.length} / ${CHALLENGES.length}개 선택됨`;
  }

  private updateVolumeSummary(state: AppState): void {
    this.volumeSummary.textContent = `현재 마스터 음량 ${formatPercent(
      state.preferences.masterVolume,
    )} · 수업 상한 ${formatPercent(state.preferences.classVolumeCap)}`;
  }

  private updateProgress(state: AppState): void {
    const completed = state.challenge.completed.length;
    this.progressText.textContent = `${completed} / ${CHALLENGES.length} 완료`;
  }

  private renderAnswers(): void {
    const state = this.store.get();
    this.answersHost.replaceChildren();
    for (const challenge of CHALLENGES) {
      const completed = state.challenge.completed.includes(challenge.id);
      const lastAnswer = state.challenge.answers[challenge.id];
      this.answersHost.append(
        h(
          'details',
          { className: 'teacher-answer' },
          h(
            'summary',
            {},
            h(
              'span',
              { className: 'challenge-number' },
              String(CHALLENGES.findIndex((item) => item.id === challenge.id) + 1).padStart(2, '0'),
            ),
            h('strong', {}, challenge.titleKo),
            h(
              'span',
              { className: `tag ${completed ? 'is-complete' : ''}` },
              completed ? '완료' : '미완료',
            ),
          ),
          h(
            'div',
            { className: 'teacher-answer-body' },
            h('p', { className: 'field-label' }, '예측'),
            h('p', {}, challenge.prediction.questionKo),
            h(
              'p',
              { className: 'answer-highlight' },
              iconEl('check', 16),
              challenge.prediction.optionsKo[challenge.prediction.correctIndex],
            ),
            h('p', { className: 'field-label' }, '목표'),
            h('p', {}, challenge.targetSummaryKo),
            h('p', { className: 'field-label' }, '해설'),
            h('p', {}, challenge.explanationKo),
            h('p', { className: 'field-label' }, '가져갈 원리'),
            h('p', {}, challenge.takeawayKo),
            h('p', { className: 'field-label' }, '마지막 제출'),
            h('p', {}, lastAnswer ?? '아직 제출하지 않았습니다.'),
          ),
        ),
      );
    }
  }

  private confirmReset(): void {
    openDialog({
      titleKo: '진행 기록을 지울까요?',
      descriptionKo:
        '도전 답안, 예측, 완료 표시가 모두 지워집니다. 소리 설정과 선택한 도전은 그대로 유지됩니다.',
      confirmLabelKo: '기록 지우기',
      cancelLabelKo: '취소',
      danger: true,
      onConfirm: () => {
        this.store.replace(resetChallengeProgress(this.store.get()));
        this.renderAnswers();
        this.announce('학생 진행 기록을 초기화했습니다.');
      },
    });
  }
}
