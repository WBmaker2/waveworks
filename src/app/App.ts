import { engine, type AudioSnapshot } from '../audio/AudioEngine';
import { getChallenge, sanitizeState, type Route } from './state';
import { Store } from './store';
import { ROUTES, routeFromHash, routeHash, routeMeta } from './routes';
import type { Room, RoomContext } from './room';
import { loadProgress, saveProgress } from '../storage/progress';
import { CONCEPT_ROOM } from '../features/challenges/evaluate';
import { ChallengesRoom } from '../features/challenges/ChallengesRoom';
import { ChordsRoom } from '../features/chords/ChordsRoom';
import { HarmonicsRoom } from '../features/harmonics/HarmonicsRoom';
import { RhythmRoom } from '../features/rhythm/RhythmRoom';
import { TeacherRoom } from '../features/teacher/TeacherRoom';
import { ToneRoom } from '../features/tone/ToneRoom';
import { openAudioSettingsDialog } from '../ui/AudioSettingsDialog';
import { openDialog } from '../ui/dialog';
import { h, iconEl, setPulse } from '../ui/dom';
import { VolumeGuard } from '../ui/VolumeGuard';

export class App {
  private readonly root: HTMLElement;
  private readonly store: Store;
  private readonly roomContext: RoomContext;
  private readonly roomHost: HTMLElement;
  private readonly main: HTMLElement;
  private readonly announcer: HTMLElement;
  private readonly navLinks = new Map<Route, HTMLAnchorElement>();
  private readonly audioButton: HTMLButtonElement;
  private readonly audioLabel: HTMLElement;
  private readonly audioIcon: HTMLElement;
  private readonly volumeGuard: VolumeGuard;
  private currentRoom: Room | null = null;
  private route: Route = 'tone';
  private saveTimer: number | null = null;
  private lastVisualsOnly: boolean;
  private announcementFrame = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const initial = sanitizeState(loadProgress(), prefersReducedMotion);
    this.store = new Store(initial);
    this.lastVisualsOnly = initial.preferences.visualsOnly;

    this.roomHost = h('div', { className: 'room-host' });
    this.main = h('main', {
      id: 'main',
      className: 'app-main',
      attrs: { tabindex: '-1' },
    });
    this.announcer = h('div', {
      className: 'sr-only',
      attrs: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
    });

    this.audioLabel = h('span', { className: 'audio-label' }, '소리 켜기');
    this.audioIcon = h('span', {
      className: 'audio-icon',
      html: iconEl('volume', 18).innerHTML,
    });
    this.audioButton = h(
      'button',
      {
        className: 'audio-status',
        attrs: { type: 'button', 'data-audio-state': 'idle' },
        on: { click: () => void this.handleAudioClick() },
      },
      this.audioIcon,
      this.audioLabel,
    );

    const settingsButton = h(
      'button',
      {
        className: 'icon-btn settings-btn',
        attrs: { type: 'button', 'aria-label': '소리 설정', title: '소리 설정' },
        on: { click: () => this.openSettings() },
      },
      iconEl('sliders', 20),
    );

    this.volumeGuard = new VolumeGuard(this.store, () => this.openSettings());

    const brand = h(
      'a',
      {
        className: 'brand',
        attrs: {
          href: routeHash('tone'),
          'aria-label': 'WaveWorks 소리 실험실, 파형 실험실로 이동',
        },
        on: {
          click: (event) => {
            event.preventDefault();
            this.navigate('tone');
          },
        },
      },
      h('span', { className: 'brand-mark', html: iconEl('wave', 26).innerHTML }),
      h(
        'span',
        { className: 'brand-text' },
        h('strong', {}, 'WaveWorks'),
        h('span', {}, '소리 실험실'),
      ),
    );

    const nav = h('nav', { className: 'room-nav', attrs: { 'aria-label': '실험실 메뉴' } });
    for (const route of ROUTES) {
      const link = h(
        'a',
        {
          className: 'nav-item',
          attrs: { href: routeHash(route.id) },
          on: {
            click: (event) => {
              event.preventDefault();
              this.navigate(route.id);
            },
          },
        },
        h('span', { className: 'nav-number' }, route.number),
        h('span', { className: 'nav-icon', html: iconEl(route.icon, 20).innerHTML }),
        h('span', { className: 'nav-label' }, route.navLabelKo),
      );
      this.navLinks.set(route.id, link);
      nav.append(link);
    }

    const sidebar = h(
      'aside',
      { className: 'sidebar' },
      h(
        'div',
        { className: 'sidebar-top' },
        brand,
        h('div', { className: 'sidebar-utility' }, this.audioButton, settingsButton),
      ),
      nav,
      h(
        'div',
        { className: 'sidebar-foot' },
        this.volumeGuard.element,
        h('p', { className: 'storage-note' }, '진행 기록은 이 기기의 브라우저에만 저장됩니다.'),
      ),
    );

    const footer = h(
      'footer',
      { className: 'app-footer' },
      h('p', {}, h('strong', {}, 'WaveWorks'), ' · 모든 소리는 Web Audio API로 실시간 합성됩니다.'),
      h('p', {}, '오디오 파일, 서버, 로그인 없이 작동합니다.'),
    );

    this.main.append(this.roomHost, footer);
    this.root.replaceChildren(
      h('div', { className: 'app-shell' }, sidebar, this.main),
      this.announcer,
    );

    this.roomContext = {
      store: this.store,
      navigate: (route) => this.navigate(route),
      openChallenge: (id) => this.openChallenge(id),
      exitChallenge: () => this.exitChallenge(),
      announce: (message) => this.announce(message),
    };

    this.applyPreferences(initial);
    this.store.subscribe((state) => {
      this.applyPreferences(state);
      this.scheduleSave();
    });
    engine.subscribe((snapshot) => this.updateAudioButton(snapshot));
    window.addEventListener('hashchange', this.handleHashChange);
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('pagehide', this.flushSave);

    this.updateAudioButton(engine.snapshot());
    this.mountRoute(routeFromHash(window.location.hash));
    window.setTimeout(() => this.showSafetyNotice(), 120);
  }

  private readonly handleHashChange = (): void => {
    const route = routeFromHash(window.location.hash);
    if (route !== this.route) {
      this.mountRoute(route);
    }
  };

  private readonly handleVisibility = (): void => {
    if (document.hidden) {
      this.currentRoom?.pause?.();
      engine.pauseForHidden();
    } else {
      void engine.resumeFromHidden();
      this.updateAudioButton(engine.snapshot());
    }
  };

  private mountRoute(route: Route): void {
    this.currentRoom?.destroy();
    this.currentRoom = null;
    engine.stopAllVoices();

    this.route = route;
    this.store.update((draft) => {
      draft.route = route;
    });
    const meta = routeMeta(route);
    document.title = `${meta.navLabelKo} — WaveWorks`;
    document.body.dataset.route = route;
    this.updateNav();

    this.roomHost.replaceChildren();
    const room = createRoom(route, this.roomContext);
    this.currentRoom = room;
    this.roomHost.append(this.buildRoomHeader(route), room.element);

    this.announce(`${meta.navLabelKo} 화면으로 이동했습니다.`);
    window.requestAnimationFrame(() => {
      const reduceMotion =
        this.store.get().preferences.reducedMotion ||
        document.documentElement.classList.contains('reduce-motion') ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({
        top: 0,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
      this.main.focus({ preventScroll: true });
    });
  }

  private buildRoomHeader(route: Route): HTMLElement {
    const meta = routeMeta(route);
    return h(
      'header',
      { className: 'room-intro' },
      h(
        'p',
        { className: 'room-eyebrow' },
        h('span', { className: 'room-number' }, meta.number),
        h('span', { className: 'room-slash' }, '/'),
        h('span', {}, meta.navLabelKo),
      ),
      h('h1', { id: 'room-title' }, meta.titleKo),
      h('p', { className: 'room-lede' }, meta.introKo),
    );
  }

  private navigate(route: Route, force = false): void {
    if (route === this.route && !force) {
      return;
    }
    const hash = routeHash(route);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
      return;
    }
    this.mountRoute(route);
  }

  private openChallenge(id: string): void {
    const challenge = getChallenge(id);
    if (!challenge) {
      return;
    }
    const state = this.store.get();
    const completed = state.challenge.completed.includes(id);
    const prediction = state.challenge.predictions[id];
    const predicted =
      prediction !== undefined && Number(prediction) === challenge.prediction.correctIndex;
    if (!completed && !predicted) {
      this.navigate('challenges');
      this.announce('먼저 예측을 확인한 뒤 실험실을 열 수 있습니다.');
      return;
    }
    this.store.update((draft) => {
      draft.challenge.currentId = id;
    });
    const targetRoute = CONCEPT_ROOM[challenge.concept] as Route;
    this.navigate(targetRoute, true);
  }

  private exitChallenge(): void {
    this.store.update((draft) => {
      draft.challenge.currentId = null;
    });
    this.navigate('challenges');
  }

  private applyPreferences(state: ReturnType<Store['get']>): void {
    engine.setSilent(state.preferences.visualsOnly);
    engine.setClassCap(state.preferences.classVolumeCap);
    engine.setMasterVolume(state.preferences.masterVolume);
    document.documentElement.classList.toggle('reduce-motion', state.preferences.reducedMotion);
    document.documentElement.classList.toggle('visuals-only', state.preferences.visualsOnly);
    if (state.preferences.visualsOnly !== this.lastVisualsOnly) {
      this.currentRoom?.pause?.();
    }
    this.lastVisualsOnly = state.preferences.visualsOnly;
    this.updateAudioButton(engine.snapshot());
  }

  private updateAudioButton(snapshot: AudioSnapshot): void {
    const state = this.store.get();
    const silent = state.preferences.visualsOnly;
    let label: string;
    let title: string;
    let icon: 'volume' | 'speakerOff' = 'volume';
    let pulse = false;
    let disabled = false;
    let status: string;

    if (!snapshot.available) {
      label = '오디오 사용 불가';
      title = '이 브라우저는 Web Audio API를 지원하지 않습니다.';
      icon = 'speakerOff';
      disabled = true;
      status = 'unavailable';
    } else if (silent) {
      label = '시각 전용 모드';
      title = '소리 설정에서 시각 전용 모드를 끌 수 있습니다.';
      icon = 'speakerOff';
      status = 'silent';
    } else if (snapshot.state === 'running') {
      label = '오디오 켜짐';
      title = '오디오가 켜져 있습니다.';
      status = 'running';
    } else if (snapshot.state === 'suspended') {
      label = '오디오 다시 켜기';
      title = '탭을 다시 열었습니다. 눌러서 오디오를 재개하세요.';
      pulse = true;
      status = 'suspended';
    } else if (snapshot.state === 'closed') {
      label = '오디오 다시 켜기';
      title = '오디오가 종료되었습니다. 눌러서 다시 시작하세요.';
      pulse = true;
      status = 'closed';
    } else {
      label = '소리 켜기';
      title = '소리는 직접 누를 때만 시작됩니다.';
      pulse = state.preferences.safetyAcknowledged;
      status = 'idle';
    }

    if (snapshot.error && snapshot.state !== 'running') {
      label = '오디오 오류 · 다시 시도';
      title = snapshot.error;
      pulse = false;
    }

    this.audioButton.disabled = disabled;
    this.audioButton.dataset.audioState = status;
    this.audioButton.title = title;
    this.audioButton.setAttribute('aria-label', `${label}. ${title}`);
    this.audioButton.classList.toggle(
      'is-error',
      Boolean(snapshot.error && snapshot.state !== 'running'),
    );
    this.audioLabel.textContent = label;
    this.audioIcon.innerHTML = iconEl(icon, 18).innerHTML;
    setPulse(this.audioButton, pulse && !disabled && state.preferences.safetyAcknowledged);
    document.body.dataset.audioState = status;
  }

  private async handleAudioClick(): Promise<void> {
    if (this.store.get().preferences.visualsOnly) {
      this.openSettings();
      return;
    }
    const snapshot = engine.snapshot();
    if (!snapshot.available) {
      this.announce('이 브라우저는 Web Audio API를 지원하지 않습니다.');
      return;
    }
    const ok = await engine.start();
    this.updateAudioButton(engine.snapshot());
    this.announce(
      ok
        ? '오디오를 켰습니다. 재생 버튼을 눌러 소리를 들어 보세요.'
        : '오디오를 시작하지 못했습니다. 소리 설정을 확인해 주세요.',
    );
  }

  private openSettings(): void {
    openAudioSettingsDialog(this.store, (snapshot) => this.updateAudioButton(snapshot));
  }

  private showSafetyNotice(): void {
    if (this.store.get().preferences.safetyAcknowledged) {
      return;
    }
    openDialog({
      titleKo: '소리를 안전하게 사용하세요',
      descriptionKo:
        'WaveWorks는 소리를 직접 만들기 때문에, 처음 사용할 때 청력 보호 수칙을 확인해 두는 것이 좋습니다.',
      content: [
        h(
          'ul',
          { className: 'safety-list' },
          h(
            'li',
            {},
            h('strong', {}, '낮은 음량으로 시작하세요.'),
            ' 기본 음량은 18%이고 최대는 60%입니다.',
          ),
          h('li', {}, h('strong', {}, '이어폰은 특히 조심하세요.'), ' 큰 소리를 오래 듣지 마세요.'),
          h(
            'li',
            {},
            h('strong', {}, '소리는 직접 누를 때만 시작됩니다.'),
            ' 페이지를 열었다고 자동으로 재생되지 않습니다.',
          ),
          h(
            'li',
            {},
            h('strong', {}, '조용한 수업에서는 시각 전용 모드를 쓰세요.'),
            ' 소리 없이 파형과 숫자로 모든 도전을 할 수 있습니다.',
          ),
        ),
      ],
      confirmLabelKo: '안전 수칙 확인',
      pulse: true,
      onConfirm: () => {
        this.store.update((draft) => {
          draft.preferences.safetyAcknowledged = true;
        });
        this.updateAudioButton(engine.snapshot());
        this.announce('안전 수칙을 확인했습니다.');
      },
    });
  }

  private updateNav(): void {
    for (const [route, link] of this.navLinks) {
      const active = route === this.route;
      link.classList.toggle('is-active', active);
      if (active) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }

  private announce(message: string): void {
    window.cancelAnimationFrame(this.announcementFrame);
    this.announcer.textContent = '';
    this.announcementFrame = window.requestAnimationFrame(() => {
      this.announcer.textContent = message;
    });
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      saveProgress(this.store.get());
    }, 250);
  }

  private readonly flushSave = (): void => {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    saveProgress(this.store.get());
  };
}

function createRoom(route: Route, context: RoomContext): Room {
  switch (route) {
    case 'tone':
      return new ToneRoom(context);
    case 'harmonics':
      return new HarmonicsRoom(context);
    case 'chords':
      return new ChordsRoom(context);
    case 'rhythm':
      return new RhythmRoom(context);
    case 'challenges':
      return new ChallengesRoom(context);
    case 'teacher':
      return new TeacherRoom(context);
  }
}
