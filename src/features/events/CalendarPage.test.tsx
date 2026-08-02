import { fireEvent, render, screen } from '@testing-library/react';
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
  beforeEach(() => {
    eventMocks.listAll.mockReset().mockResolvedValue([]);
  });

  it('collapses on the first downward scroll intent even when scrolling is unavailable', () => {
    render(<CalendarPage />);

    fireEvent.wheel(window, { deltaY: 1 });
    expect(screen.getByRole('button', { name: 'Déplier le calendrier' })).toBeInTheDocument();

    fireEvent.wheel(window, { deltaY: -1 });
    expect(screen.getByRole('button', { name: 'Réduire le calendrier' })).toBeInTheDocument();
  });

  it('collapses after a meaningful touch move', () => {
    render(<CalendarPage />);

    fireEvent.touchStart(window, { touches: [{ clientY: 200 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 187 }] });

    expect(screen.getByRole('button', { name: 'Déplier le calendrier' })).toBeInTheDocument();
  });

  it('changes month when the calendar is swiped horizontally', () => {
    render(<CalendarPage />);

    const calendar = screen.getByTestId('calendar-card');
    const initialMonth = screen.getByRole('heading', { level: 2 }).textContent;

    fireEvent.touchStart(calendar, { touches: [{ clientX: 240, clientY: 100 }] });
    fireEvent.touchEnd(calendar, { changedTouches: [{ clientX: 120, clientY: 105 }] });

    expect(screen.getByRole('heading', { level: 2 })).not.toHaveTextContent(initialMonth ?? '');
    expect(screen.getByTestId('calendar-month-grid')).toHaveAttribute('data-transition-direction', 'next');

    fireEvent.touchStart(calendar, { touches: [{ clientX: 120, clientY: 100 }] });
    fireEvent.touchEnd(calendar, { changedTouches: [{ clientX: 240, clientY: 105 }] });

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(initialMonth ?? '');
    expect(screen.getByTestId('calendar-month-grid')).toHaveAttribute('data-transition-direction', 'previous');
  });
});
