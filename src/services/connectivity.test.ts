import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isAppOnline,
  isForcedOffline,
  setForcedOffline,
  subscribeToConnectivity,
  toggleForcedOffline,
} from '@/services/connectivity';

const STORAGE_KEY = 'fz-forced-offline';
const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');

describe('connectivity test mode', () => {
  beforeEach(() => {
    localStorage.clear();
    setForcedOffline(false);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    setForcedOffline(false);
    if (originalOnlineDescriptor) {
      Object.defineProperty(Navigator.prototype, 'onLine', originalOnlineDescriptor);
    }
  });

  it('persists and notifies the forced offline toggle', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToConnectivity(listener);

    expect(toggleForcedOffline()).toBe(true);
    expect(isForcedOffline()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
  });

  it('takes priority over an available browser connection and restores it when disabled', () => {
    expect(isAppOnline()).toBe(true);

    setForcedOffline(true);
    expect(isAppOnline()).toBe(false);

    setForcedOffline(false);
    expect(isAppOnline()).toBe(true);
  });
});
