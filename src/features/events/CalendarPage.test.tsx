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
});
