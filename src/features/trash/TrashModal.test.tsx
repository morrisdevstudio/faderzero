import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TrashModal } from './TrashModal';

const trashMocks = vi.hoisted(() => ({
  listTrashedItems: vi.fn(),
  restoreTrashedContent: vi.fn(),
}));

vi.mock('@/services/supabase/trash', () => trashMocks);

describe('TrashModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trashMocks.listTrashedItems.mockResolvedValue([
      {
        id: 'song-1',
        workspaceId: 'workspace-1',
        entityType: 'song',
        title: 'Born to Rock',
        deletedAt: '2026-08-16T12:00:00.000Z',
        expiresAt: '2026-08-23T12:00:00.000Z',
      },
    ]);
    trashMocks.restoreTrashedContent.mockResolvedValue(undefined);
  });

  it('utilise le dialogue canonique et charge les contenus supprimés', async () => {
    render(<TrashModal workspaceId="workspace-1" isOpen onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: 'Corbeille des contenus' })).toBeInTheDocument();
    expect(await screen.findByText('Born to Rock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fermer la corbeille' })).toHaveFocus();
    expect(trashMocks.listTrashedItems).toHaveBeenCalledWith('workspace-1');
  });

  it('restaure un contenu et recharge la liste', async () => {
    const onItemRestored = vi.fn();
    render(
      <TrashModal
        workspaceId="workspace-1"
        isOpen
        onClose={() => {}}
        onItemRestored={onItemRestored}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Restaurer' }));

    await waitFor(() => {
      expect(trashMocks.restoreTrashedContent).toHaveBeenCalledWith('workspace-1', 'song', 'song-1');
      expect(trashMocks.listTrashedItems).toHaveBeenCalledTimes(2);
      expect(onItemRestored).toHaveBeenCalledOnce();
    });
  });
});
