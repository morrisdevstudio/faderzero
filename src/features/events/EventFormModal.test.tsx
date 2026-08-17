import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EventFormModal } from './EventFormModal';

const eventFormMocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

vi.mock('@/db/repositories/eventsRepository', () => ({
  eventsRepository: eventFormMocks,
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    workspaces: [{ id: 'workspace-1', name: 'The Band', type: 'group' }],
    activeWorkspace: { id: 'workspace-1', name: 'The Band', type: 'group' },
  }),
}));

describe('EventFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventFormMocks.create.mockResolvedValue(undefined);
    eventFormMocks.update.mockResolvedValue(undefined);
    eventFormMocks.softDelete.mockResolvedValue(undefined);
  });

  it('utilise le dialogue canonique et conserve la validation du titre', () => {
    render(<EventFormModal isOpen onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: 'Nouvel événement' })).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer' }).closest('form')!);

    expect(screen.getByRole('alert')).toHaveTextContent("Le titre de l'événement est requis.");
    expect(eventFormMocks.create).not.toHaveBeenCalled();
  });

  it('préserve la confirmation explicite avant suppression', async () => {
    const onClose = vi.fn();
    render(
      <EventFormModal
        isOpen
        event={{
          id: 'event-1',
          workspaceId: 'workspace-1',
          title: 'Répétition',
          eventType: 'rehearsal',
          startAt: new Date('2026-08-20T20:00:00').getTime(),
          endAt: new Date('2026-08-20T22:00:00').getTime(),
          createdAt: 1,
          updatedAt: 1,
        }}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    let confirmation = screen.getByRole('dialog', { name: 'Supprimer l’événement' });
    expect(confirmation).toBeInTheDocument();
    expect(within(confirmation).getByRole('button', { name: 'Annuler' })).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Modifier l’événement' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Supprimer l’événement' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Modifier l’événement' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    confirmation = screen.getByRole('dialog', { name: 'Supprimer l’événement' });

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => {
      expect(eventFormMocks.softDelete).toHaveBeenCalledWith('event-1');
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
