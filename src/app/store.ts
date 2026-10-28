import type { AppState } from './state';

export type StoreListener = (state: AppState) => void;

export class Store {
  private state: AppState;
  private readonly listeners = new Set<StoreListener>();

  constructor(initial: AppState) {
    this.state = initial;
  }

  get(): AppState {
    return this.state;
  }

  update(recipe: (draft: AppState) => void): void {
    const draft = structuredClone(this.state);
    recipe(draft);
    this.state = draft;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  replace(state: AppState): void {
    this.state = state;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
