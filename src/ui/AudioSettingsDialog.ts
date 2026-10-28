import { engine, type AudioSnapshot } from '../audio/AudioEngine';
import { MAX_MASTER_VOLUME } from '../audio/constants';
import { formatPercent } from '../audio/safety';
import type { Store } from '../app/store';
import { h, iconEl, uniqueId } from './dom';
import { openDialog } from './dialog';
import { Slider } from './Slider';

export function openAudioSettingsDialog(
  store: Store,
  onApplied?: (snapshot: AudioSnapshot) => void,
): void {
  const state = store.get();
  const cap = state.preferences.classVolumeCap;
  const snapshot = engine.snapshot();

  const masterSlider = new Slider({
    labelKo: '마스터 음량',
    min: 0,
    max: Math.round(cap * 100),
    value: state.preferences.masterVolume * 100,
    step: 1,
    numeric: true,
    unit: '%',
    formatValue: (value) => formatPercent(value / 100),
    formatEdge: (value) => `${value}%`,
    helpKo: `수업 상한 ${formatPercent(cap)} · 절대 상한 ${formatPercent(MAX_MASTER_VOLUME)}`,
    onInput: (value) => {
      store.update((draft) => {
        draft.preferences.masterVolume = value / 100;
      });
      onApplied?.(engine.snapshot());
    },
  });

  const visualSwitch = switchField(
    uniqueId('visuals'),
    '시각 전용 모드',
    '소리 없이 파형과 숫자만으로 실험합니다.',
    state.preferences.visualsOnly,
    (checked) => {
      store.update((draft) => {
        draft.preferences.visualsOnly = checked;
      });
      onApplied?.(engine.snapshot());
    },
  );

  const motionSwitch = switchField(
    uniqueId('motion'),
    '동작 줄이기',
    '파형 움직임과 화면 전환 애니메이션을 줄입니다.',
    state.preferences.reducedMotion,
    (checked) => {
      store.update((draft) => {
        draft.preferences.reducedMotion = checked;
      });
    },
  );

  openDialog({
    titleKo: '소리 설정',
    descriptionKo: '설정은 이 기기에만 저장되며, 다음에 열 때 그대로 적용됩니다.',
    content: [
      h('p', { className: 'settings-status' }, `오디오 상태: ${audioStateLabel(snapshot)}`),
      masterSlider.element,
      visualSwitch,
      motionSwitch,
      h(
        'div',
        { className: 'safety-callout' },
        h('span', { className: 'safety-icon' }, iconEl('headphones', 18)),
        h(
          'p',
          {},
          '큰 소리를 오래 듣지 마세요. 이어폰은 낮은 음량으로 사용하고, 소리는 직접 재생 버튼을 누를 때만 시작됩니다.',
        ),
      ),
    ],
    confirmLabelKo: '닫기',
    onConfirm: () => {
      onApplied?.(engine.snapshot());
    },
  });
}

function switchField(
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

function audioStateLabel(snapshot: AudioSnapshot): string {
  if (snapshot.silent) {
    return '시각 전용 모드';
  }
  switch (snapshot.state) {
    case 'idle':
      return '아직 시작하지 않음';
    case 'running':
      return '실행 중';
    case 'suspended':
      return '일시정지';
    case 'closed':
      return '닫힘';
    case 'unavailable':
      return '지원하지 않음';
  }
}
