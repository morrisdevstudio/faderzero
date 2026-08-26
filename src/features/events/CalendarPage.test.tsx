import type { ReactNode } from 'react';
import { fireEvent, render as renderWithTestingLibrary, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const eventMocks = vi.hoisted(() => ({
  listAll: vi.fn(),
}));

vi.mock('@/db/repositories/eventsRepository', () => ({
  eventsRepository: eventMocks,
}));

vi.mock('@/db/repositories/bookingRepository', () => ({
  bookingRepository: {
    listLeads: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    workspaces: [],
    session: { user: { id: 'user-1' } },
  }),
}));

import { CalendarPage } from '@/features/events/CalendarPage';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Route actuelle">{location.pathname}</output>;
}

function render(children: ReactNode) {
  return renderWithTestingLibrary(
    <MemoryRouter>
      {children}
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('CalendarPage scroll collapse', () => {
  beforeEach(() => {
    eventMocks.listAll.mockReset().mockResolvedValue([]);
  });

  it('collapses on the first downward scroll intent even when scrolling is unavailable', () => {
    render(<CalendarPage />);

    fireEvent.wheel(window, { deltaY: 48 });
    expect(screen.getByRole('button', { name: 'Déplier le calendrier' })).toBeInTheDocument();

    fireEvent.wheel(window, { deltaY: -48 });
    expect(screen.getByRole('button', { name: 'Réduire le calendrier' })).toBeInTheDocument();
  });

  it('collapses after a meaningful touch move', () => {
    render(<CalendarPage />);

    fireEvent.touchStart(window, { touches: [{ clientY: 200 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 148 }] });

    expect(screen.getByRole('button', { name: 'Déplier le calendrier' })).toBeInTheDocument();
  });

  it('changes month when the calendar is swiped horizontally', () => {
    render(<CalendarPage />);

    const calendar = screen.getByTestId('calendar-card');
    const initialMonth = screen.getByRole('heading', { level: 2 }).textContent;

    fireEvent.touchStart(calendar, { touches: [{ clientX: 240, clientY: 100 }] });
    fireEvent.touchMove(calendar, { touches: [{ clientX: 120, clientY: 105 }] });
    fireEvent.touchEnd(calendar, { changedTouches: [{ clientX: 120, clientY: 105 }] });

    expect(screen.getByRole('heading', { level: 2 })).not.toHaveTextContent(initialMonth ?? '');
    expect(screen.getByTestId('calendar-month-grid')).toHaveAttribute('data-transition-direction', 'next');

    fireEvent.touchStart(calendar, { touches: [{ clientX: 120, clientY: 100 }] });
    fireEvent.touchEnd(calendar, { changedTouches: [{ clientX: 240, clientY: 105 }] });

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(initialMonth ?? '');
    expect(screen.getByTestId('calendar-month-grid')).toHaveAttribute('data-transition-direction', 'previous');
  });

  it('navigates weeks with arrows and swipe when calendar is collapsed', () => {
    render(<CalendarPage />);

    // Collapse calendar to week view
    fireEvent.click(screen.getByRole('button', { name: 'Réduire le calendrier' }));
    expect(screen.getByRole('button', { name: 'Déplier le calendrier' })).toBeInTheDocument();

    const prevWeekButton = screen.getByRole('button', { name: 'Semaine précédente' });
    const nextWeekButton = screen.getByRole('button', { name: 'Semaine suivante' });
    expect(prevWeekButton).toBeInTheDocument();
    expect(nextWeekButton).toBeInTheDocument();

    // Click next week
    fireEvent.click(nextWeekButton);
    expect(screen.getByTestId('calendar-week-grid')).toHaveAttribute('data-transition-direction', 'next');

    // Click previous week
    fireEvent.click(prevWeekButton);
    expect(screen.getByTestId('calendar-week-grid')).toHaveAttribute('data-transition-direction', 'previous');

    // Swipe horizontally on week view
    const calendar = screen.getByTestId('calendar-card');
    fireEvent.touchStart(calendar, { touches: [{ clientX: 240, clientY: 100 }] });
    fireEvent.touchEnd(calendar, { changedTouches: [{ clientX: 120, clientY: 105 }] });
    expect(screen.getByTestId('calendar-week-grid')).toHaveAttribute('data-transition-direction', 'next');

    fireEvent.touchStart(calendar, { touches: [{ clientX: 120, clientY: 100 }] });
    fireEvent.touchEnd(calendar, { changedTouches: [{ clientX: 240, clientY: 105 }] });
    expect(screen.getByTestId('calendar-week-grid')).toHaveAttribute('data-transition-direction', 'previous');
  });

  it('keeps the month view open for a small wheel gesture', () => {
    render(<CalendarPage />);

    fireEvent.wheel(window, { deltaY: 24 });

    expect(screen.getByTestId('calendar-month-grid').parentElement!).toHaveAttribute('data-expanded', 'true');
  });

  it('ouvre Booking par navigation interne sans recharger la PWA', () => {
    render(<CalendarPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la prospection' }));

    expect(screen.getByRole('status', { name: 'Route actuelle' })).toHaveTextContent('/booking');
  });

  it('ignores touch gestures when a dialog is open', () => {
    render(
      <div>
        <div role="dialog" aria-modal="true" aria-label="Test Dialog" />
        <CalendarPage />
      </div>,
    );

    const calendar = screen.getByTestId('calendar-card');
    const initialMonth = screen.getByRole('heading', { level: 2 }).textContent;

    // Horizontal swipe on calendar
    fireEvent.touchStart(calendar, { touches: [{ clientX: 240, clientY: 100 }] });
    fireEvent.touchEnd(calendar, { changedTouches: [{ clientX: 120, clientY: 105 }] });

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(initialMonth ?? '');

    // Vertical swipe on window
    fireEvent.touchStart(window, { touches: [{ clientY: 200 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 148 }] });

    expect(screen.queryByRole('button', { name: 'Déplier le calendrier' })).not.toBeInTheDocument();
  });

  it('affiche le détail d’un événement dans une fiche lisible', async () => {
    const now = Date.now();
    eventMocks.listAll.mockResolvedValue([{
      id: 'event-labels',
      workspaceId: 'personal',
      title: 'Répétition test',
      eventType: 'rehearsal',
      startAt: now,
      endAt: now + 60 * 60 * 1000,
      location: 'Studio',
      notes: 'Préparer le rappel',
      createdAt: now,
      updatedAt: now,
    }]);

    render(<CalendarPage />);
    fireEvent.click(await screen.findByText('Répétition test'));

    expect(screen.getByRole('dialog', { name: 'Répétition test' })).toBeInTheDocument();
    ['Type', 'Date et heure', 'Lieu', 'Contacts'].forEach((label) => expect(screen.getByText(label)).toHaveClass('fz-field-label'));
    expect(screen.getByText('Aucun contact lié.')).toBeInTheDocument();
  });
});
