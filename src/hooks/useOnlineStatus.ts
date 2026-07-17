import { useState, useEffect } from 'react';

const STORAGE_KEY = 'fz-last-online-status';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== 'undefined') {
      const lastStatus = localStorage.getItem(STORAGE_KEY);
      if (lastStatus === 'offline') return false;
    }
    return navigator.onLine;
  });

  useEffect(() => {
    let active = true;

    async function checkConnectivity(isInitial = false) {
      if (!navigator.onLine) {
        if (active) {
          setIsOnline(false);
          localStorage.setItem(STORAGE_KEY, 'offline');
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
      } catch (err) {
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
      clearInterval(intervalId);
    };
  }, []);

  return isOnline;
}
