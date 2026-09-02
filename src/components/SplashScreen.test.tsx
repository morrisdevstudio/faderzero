import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPLASH_ANIMATION_DURATION_MS, SplashScreen } from '@/components/SplashScreen';

describe('SplashScreen', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('termine après un cycle unique du fader', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const { container } = render(<SplashScreen onComplete={onComplete} />);
    const fader = container.querySelector('.animate-fader-cap');

    expect(fader).toBeInTheDocument();
    expect(container.querySelector('style')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Chargement de FaderZero' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(SPLASH_ANIMATION_DURATION_MS + 250);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('conserve le fader en haut sans relancer l’animation pour une transition de route', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const { container } = render(<SplashScreen animated={false} onComplete={onComplete} />);

    expect(container.querySelector('.completed-fader-cap')).toBeInTheDocument();
    expect(container.querySelector('.animate-fader-cap')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(SPLASH_ANIMATION_DURATION_MS + 250);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });
});
