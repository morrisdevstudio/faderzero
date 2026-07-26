const FORCED_OFFLINE_STORAGE_KEY = 'fz-forced-offline';

type ConnectivityListener = () => void;

const listeners = new Set<ConnectivityListener>();
let forcedOffline = readForcedOffline();

function readForcedOffline(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(FORCED_OFFLINE_STORAGE_KEY) === 'true';
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function isForcedOffline(): boolean {
  return forcedOffline;
}

export function setForcedOffline(nextForcedOffline: boolean) {
  if (forcedOffline === nextForcedOffline) return;

  forcedOffline = nextForcedOffline;
  try {
    localStorage.setItem(FORCED_OFFLINE_STORAGE_KEY, String(forcedOffline));
  } catch {
    // The in-memory state remains usable when storage is unavailable.
  }
  notifyListeners();
}

export function toggleForcedOffline(): boolean {
  setForcedOffline(!forcedOffline);
  return forcedOffline;
}

export function isAppOnline(): boolean {
  if (forcedOffline) return false;
  return typeof navigator === 'undefined' || navigator.onLine;
}

export function subscribeToConnectivity(listener: ConnectivityListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
