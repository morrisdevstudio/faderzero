import { useState, useEffect } from 'react';
import { isAppOnline, isForcedOffline, subscribeToConnectivity } from '@/services/connectivity';

const STORAGE_KEY = 'fz-last-online-status';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== 'undefined') {
      const lastStatus = localStorage.getItem(STORAGE_KEY);
      if (lastStatus === 'offline') return false;
    }
    return isAppOnline();
  });

  useEffect(() => {
    let active = true;

    async function checkConnectivity(isInitial = false) {
      if (!isAppOnline()) {
        if (active) {
          setIsOnline(false);
          if (!isForcedOffline()) {
            localStorage.setItem(STORAGE_KEY, 'offline');
          }
        }
        return;
      }

      try {
        const controller = new AbortController();
        // Use a very short timeout for the initial load check to eliminate visual delay
        const timeoutDuration = isInitial ? 800 : 3000;
        const abortTimeout = setTimeout(() => controller.abort(), timeoutDuration);

        const response = await fetch(`/?t=${Date.now()}`, {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(abortTimeout);

        const nextStatus = response.ok || response.status < 400;
        if (active) {
          setIsOnline(nextStatus);
          localStorage.setItem(STORAGE_KEY, nextStatus ? 'online' : 'offline');
        }
      } catch {
        if (active) {
          setIsOnline(false);
          localStorage.setItem(STORAGE_KEY, 'offline');
        }
      }
    }

    function handleOnline() {
      void checkConnectivity();
    }

    function handleOffline() {
      if (active) {
        setIsOnline(false);
        localStorage.setItem(STORAGE_KEY, 'offline');
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const unsubscribe = subscribeToConnectivity(() => {
      void checkConnectivity();
    });

    // Initial check with true parameter to trigger short timeout
    void checkConnectivity(true);

    // Check periodically every 10 seconds to ensure status changes are caught
    const intervalId = setInterval(() => {
      void checkConnectivity();
    }, 10000);

    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  return isOnline;
}

export function useForcedOffline() {
  const [forcedOffline, setForcedOffline] = useState(isForcedOffline);

  useEffect(() => subscribeToConnectivity(() => setForcedOffline(isForcedOffline())), []);

  return forcedOffline;
}
