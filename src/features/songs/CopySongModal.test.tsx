import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CopySongModal } from './CopySongModal';

const copyMocks = vi.hoisted(() => ({
  listAvailableTargetWorkspaces: vi.fn(),
  copySongToWorkspace: vi.fn(),
}));

vi.mock('@/services/supabase/copy', () => copyMocks);

describe('CopySongModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copyMocks.listAvailableTargetWorkspaces.mockResolvedValue([
      { id: 'workspace-2', name: 'The Band', type: 'group' },
    ]);
    copyMocks.copySongToWorkspace.mockResolvedValue({ songId: 'song-copy' });
  });

  it('charge les destinations dans le dialogue canonique', async () => {
    render(
      <CopySongModal
        songId="song-1"
        songTitle="Born to Rock"
        currentWorkspaceId="workspace-1"
        isOpen
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Copier vers un autre espace' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'The Band (Groupe)' })).toBeInTheDocument();
    expect(copyMocks.listAvailableTargetWorkspaces).toHaveBeenCalledWith('workspace-1');
  });

  it('copie le morceau avec l’option audio et conserve les callbacks', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(
      <CopySongModal
        songId="song-1"
        songTitle="Born to Rock"
        currentWorkspaceId="workspace-1"
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    await screen.findByRole('option', { name: 'The Band (Groupe)' });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Copier la chanson' }));

    await waitFor(() => {
      expect(copyMocks.copySongToWorkspace).toHaveBeenCalledWith('song-1', 'workspace-2', { includeAudio: true });
      expect(onSuccess).toHaveBeenCalledWith({ songId: 'song-copy' });
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
