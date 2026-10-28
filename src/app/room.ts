import type { Store } from './store';
import type { Route } from './state';

export interface RoomContext {
  store: Store;
  navigate: (route: Route) => void;
  openChallenge: (id: string) => void;
  exitChallenge: () => void;
  announce: (message: string) => void;
}

export interface Room {
  element: HTMLElement;
  destroy(): void;
  pause?(): void;
}
