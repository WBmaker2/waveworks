import type { Route } from './state';

export interface RouteMeta {
  id: Route;
  number: string;
  navLabelKo: string;
  titleKo: string;
  introKo: string;
  icon: 'wave' | 'layers' | 'piano' | 'grid' | 'target' | 'sliders';
}

export const ROUTES: readonly RouteMeta[] = [
  {
    id: 'tone',
    number: '01',
    navLabelKo: '파형',
    titleKo: '한 음을 해부해 보세요.',
    introKo: '파형, 주파수, 음량을 바꾸며 소리의 세 가지 얼굴을 관찰합니다.',
    icon: 'wave',
  },
  {
    id: 'harmonics',
    number: '02',
    navLabelKo: '배음',
    titleKo: '음색을 쌓아 올리세요.',
    introKo: '기본음 위에 2·3·4배음을 더해 악기마다 다른 음색이 생기는 원리를 봅니다.',
    icon: 'layers',
  },
  {
    id: 'chords',
    number: '03',
    navLabelKo: '화음',
    titleKo: '세 음으로 화음을 만드세요.',
    introKo: '반음 간격을 세어 메이저와 마이너 화음을 직접 조립합니다.',
    icon: 'piano',
  },
  {
    id: 'rhythm',
    number: '04',
    navLabelKo: '리듬',
    titleKo: '8칸에 리듬을 쓰세요.',
    introKo: '8분음표 8칸에 음을 놓고, 템포를 바꾸며 박자를 확인합니다.',
    icon: 'grid',
  },
  {
    id: 'challenges',
    number: '05',
    navLabelKo: '도전',
    titleKo: '예측하고, 만들고, 설명하세요.',
    introKo: '다섯 가지 도전에서 소리의 원리를 직접 확인합니다.',
    icon: 'target',
  },
  {
    id: 'teacher',
    number: '06',
    navLabelKo: '교사용',
    titleKo: '수업 준비를 한곳에서.',
    introKo: '음량 상한, 시각 전용 모드, 도전 선택과 진행 초기화를 설정합니다.',
    icon: 'sliders',
  },
];

export function routeMeta(route: Route): RouteMeta {
  return ROUTES.find((item) => item.id === route) ?? ROUTES[0]!;
}

export function routeFromHash(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return ROUTES.find((item) => item.id === cleaned)?.id ?? 'tone';
}

export function routeHash(route: Route): string {
  return `#/${route}`;
}
