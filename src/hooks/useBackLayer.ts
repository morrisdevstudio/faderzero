import { useEffect, useRef } from 'react';
import { registerBackLayer, shouldSuppressBackLayerDismiss } from '@/navigation/inAppBack';

let nextLayerToken = 1;

export function useBackLayer(active: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) {
      return;
    }

    const token = nextLayerToken;
    nextLayerToken += 1;
    const currentState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state as Record<string, unknown>
      : {};
    window.history.pushState({ ...currentState, fzBackLayer: token }, '');

    const unregister = registerBackLayer(() => {
      onCloseRef.current();
    });

    function handlePop() {
      unregister();
      if (!shouldSuppressBackLayerDismiss()) {
        onCloseRef.current();
      }
    }

    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      unregister();
      const state = window.history.state as { fzBackLayer?: number } | null;
      if (!shouldSuppressBackLayerDismiss() && state?.fzBackLayer === token) {
        window.history.back();
      }
    };
  }, [active]);
}
