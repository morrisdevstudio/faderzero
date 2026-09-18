import type { NavigateFunction } from 'react-router-dom';

export const HOME_FALLBACK = '/home';

interface RouterHistoryState {
  idx?: number;
  fzBackLayer?: number;
}

export interface HistoryIndexSource {
  index?: number;
}

let nextBackLayerId = 1;
let suppressBackLayerDismiss = false;
const backLayers: Array<{ id: number; dismiss: () => void }> = [];

function historyState(): RouterHistoryState {
  const state = window.history.state;
  return state && typeof state === 'object' ? (state as RouterHistoryState) : {};
}

export function hasInAppHistory(navigator?: HistoryIndexSource): boolean {
  if (typeof navigator?.index === 'number') {
    return navigator.index > 0;
  }
  const idx = historyState().idx;
  return typeof idx === 'number' && idx > 0;
}

export function registerBackLayer(dismiss: () => void): () => void {
  const id = nextBackLayerId;
  nextBackLayerId += 1;
  backLayers.push({ id, dismiss });
  return () => {
    const index = backLayers.findIndex((layer) => layer.id === id);
    if (index >= 0) {
      backLayers.splice(index, 1);
    }
  };
}

export function dismissTopBackLayer(): boolean {
  const top = backLayers[backLayers.length - 1];
  if (!top) {
    return false;
  }
  top.dismiss();
  return true;
}

export function goBackInApp(navigate: NavigateFunction, fallback: string, navigator?: HistoryIndexSource): void {
  if (dismissTopBackLayer()) {
    return;
  }
  void leaveScreen(navigate, fallback, navigator);
}

export async function leaveScreen(
  navigate: NavigateFunction,
  fallback: string,
  navigator?: HistoryIndexSource,
): Promise<void> {
  suppressBackLayerDismiss = true;
  try {
    while (historyState().fzBackLayer) {
      const token = historyState().fzBackLayer;
      await popHistoryOnce();
      if (historyState().fzBackLayer === token) {
        break;
      }
    }
  } finally {
    suppressBackLayerDismiss = false;
  }

  if (hasInAppHistory(navigator)) {
    navigate(-1);
    return;
  }
  navigate(fallback, { replace: true });
}

function popHistoryOnce(): Promise<void> {
  return new Promise((resolve) => {
    const onPop = () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('popstate', onPop);
      resolve();
    };
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('popstate', onPop);
      resolve();
    }, 0);
    window.addEventListener('popstate', onPop);
    window.history.back();
  });
}

export function shouldSuppressBackLayerDismiss(): boolean {
  return suppressBackLayerDismiss;
}

export function resetBackLayersForTests(): void {
  backLayers.length = 0;
  suppressBackLayerDismiss = false;
  nextBackLayerId = 1;
}
