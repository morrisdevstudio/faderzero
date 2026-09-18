import { useEffect, useRef } from 'react';
import {
  consumeIgnoredBackLayerPop,
  ignoreNextBackLayerPopState,
  registerBackLayer,
  shouldSuppressBackLayerDismiss,
} from '@/navigation/inAppBack';

let nextLayerToken = 1;

export function useBackLayer(active: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    let token: number | undefined;
    let unregister = () => {};

    function handlePop() {
      if (consumeIgnoredBackLayerPop()) {
        return;
      }
      unregister();
      unregister = () => {};
      if (!shouldSuppressBackLayerDismiss()) {
        onCloseRef.current();
      }
    }

    window.addEventListener('popstate', handlePop);

    // React Strict Mode remounts effects in the same turn. Delay pushState so
    // the discarded mount never pairs pushState with history.back(). Chromium
    // delivers that back() as a late popstate that would close the dialog.
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      token = nextLayerToken;
      nextLayerToken += 1;
      const currentState = window.history.state && typeof window.history.state === 'object'
        ? window.history.state as Record<string, unknown>
        : {};
      window.history.pushState({ ...currentState, fzBackLayer: token }, '');
      unregister = registerBackLayer(() => {
        onCloseRef.current();
      });
    });

    return () => {
      cancelled = true;
      window.removeEventListener('popstate', handlePop);
      unregister();
      unregister = () => {};
      const state = window.history.state as { fzBackLayer?: number } | null;
      if (token !== undefined && !shouldSuppressBackLayerDismiss() && state?.fzBackLayer === token) {
        ignoreNextBackLayerPopState();
        window.history.back();
      }
    };
  }, [active]);
}
