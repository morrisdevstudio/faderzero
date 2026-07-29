import { useRef } from 'react';

interface UseLongPressOptions {
  threshold?: number;
  onLongPress: () => void;
  onClick?: () => void;
}

export function useLongPress({
  threshold = 400,
  onLongPress,
  onClick,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    isLongPressRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      clearTimer();
      if (typeof window !== 'undefined' && 'vibrate' in window.navigator) {
        try {
          window.navigator.vibrate(40);
        } catch {
          // ignore
        }
      }
      onLongPress();
    }, threshold);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPosRef.current) return;
    const distance = Math.hypot(
      e.clientX - startPosRef.current.x,
      e.clientY - startPosRef.current.y
    );
    if (distance > 10) {
      clearTimer();
    }
  };

  const handlePointerUp = () => {
    clearTimer();
  };

  const handlePointerCancel = () => {
    clearTimer();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      return;
    }
    onClick?.();
  };

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onPointerLeave: handlePointerCancel,
    onClick: handleClick,
  };
}
