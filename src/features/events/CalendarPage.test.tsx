import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const eventMocks = vi.hoisted(() => ({
  listAll: vi.fn(),
}));

vi.mock('@/db/repositories/eventsRepository', () => ({
  eventsRepository: eventMocks,
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    workspaces: [],
    session: { user: { id: 'user-1' } },
  }),
}));

import { CalendarPage } from '@/features/events/CalendarPage';

describe('CalendarPage scroll collapse', () => {
  let intersectionCallback: IntersectionObserverCallback;
  const observe = vi.fn();
  const disconnect = vi.fn();

  beforeEach(() => {
    eventMocks.listAll.mockReset().mockResolvedValue([]);
    observe.mockReset();
    disconnect.mockReset();

    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '0px';
      thresholds = [0];
    }

    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  });

  it('utilise une sentinelle pour replier le calendrier sans écouteur scroll', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    render(<CalendarPage />);

    expect(observe).toHaveBeenCalledWith(document.querySelector('[data-calendar-collapse-sentinel]'));
    expect(addEventListenerSpy).not.toHaveBeenCalledWith('scroll', expect.any(Function), expect.anything());

    act(() => {
      intersectionCallback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(screen.getByRole('button', { name: 'Déplier le calendrier' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Déplier le calendrier' }));
    expect(screen.getByRole('button', { name: 'Réduire le calendrier' })).toBeInTheDocument();

    act(() => {
      intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(screen.getByRole('button', { name: 'Réduire le calendrier' })).toBeInTheDocument();

    addEventListenerSpy.mockRestore();
  });
});
