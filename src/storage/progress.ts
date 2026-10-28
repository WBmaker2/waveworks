import { STORAGE_KEY, STORAGE_VERSION } from '../audio/constants';
import type { AppState } from '../app/state';

interface StoredPayload {
  version: number;
  state: unknown;
}

export function loadProgress(): unknown {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    if (parsed.version !== STORAGE_VERSION || !('state' in parsed)) {
      return null;
    }
    return parsed.state;
  } catch {
    return null;
  }
}

export function saveProgress(state: AppState): void {
  try {
    const payload: StoredPayload = {
      version: STORAGE_VERSION,
      state: {
        ...state,
        route: 'tone',
        rhythm: { ...state.rhythm, playing: false },
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private browsing or a full quota should never break the lesson.
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
