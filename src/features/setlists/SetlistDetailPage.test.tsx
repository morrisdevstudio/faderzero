import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetlistDetailPage } from '@/features/setlists/SetlistDetailPage';

const detailData = vi.hoisted(() => ({
  liveQueryCall: 0,
  setlist: {
    id: 'setlist-test',
    workspaceId: 'workspace-test',
    name: 'Setlist test',
    createdAt: 1,
    updatedAt: 1,
  },
  entries: [{
    id: 'entry-test',
    workspaceId: 'workspace-test',
    setlistId: 'setlist-test',
    songId: 'song-test',
    songTitle: 'Chanson test',
    position: 0,
    createdAt: 1,
    updatedAt: 1,
  }],
  songs: [{
    id: 'song-test',
    workspaceId: 'workspace-test',
    title: 'Chanson test',
    lyrics: '',
    status: 'Idee',
    durationSeconds: 180,
    createdAt: 1,
    updatedAt: 1,
  }],
}));

const repositoryMocks = vi.hoisted(() => ({
  deleteEntry: vi.fn(),
  softDeleteSetlist: vi.fn(),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => {
    const values = [detailData.setlist, detailData.entries, detailData.songs];
    const value = values[detailData.liveQueryCall % values.length];
    detailData.liveQueryCall += 1;
    return value;
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({
    activeWorkspace: { id: 'workspace-test', role: 'admin' },
  }),
}));

vi.mock('@/db/repositories/setlistsRepository', () => ({
  setlistsRepository: {
    update: vi.fn(),
    softDelete: repositoryMocks.softDeleteSetlist,
  },
}));

vi.mock('@/db/repositories/setlistSongsRepository', () => ({
  setlistSongsRepository: {
    addSongToSetlist: vi.fn(),
    move: vi.fn(),
    update: vi.fn(),
    delete: repositoryMocks.deleteEntry,
  },
}));

vi.mock('@/db/repositories/songsRepository', () => ({
  songsRepository: {},
}));

vi.mock('@/features/setlists/setlistPdf', () => ({
  downloadSetlistPdf: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/setlists/setlist-test']}>
      <Routes>
        <Route path="/setlists/:setlistId" element={<SetlistDetailPage />} />
        <Route path="/setlists" element={<p>Liste des setlists</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SetlistDetailPage suppressions', () => {
  beforeEach(() => {
    detailData.liveQueryCall = 0;
    repositoryMocks.deleteEntry.mockReset().mockResolvedValue(undefined);
    repositoryMocks.softDeleteSetlist.mockReset().mockResolvedValue(undefined);
  });

  it('confirme le retrait d’une occurrence sans supprimer le morceau du répertoire', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Chanson test de la setlist' }));
    const dialog = screen.getByRole('dialog', { name: 'Retirer « Chanson test » ?' });
    expect(within(dialog).getByText(/restera disponible dans le répertoire/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirer' }));

    await waitFor(() => {
      expect(repositoryMocks.deleteEntry).toHaveBeenCalledWith('entry-test');
    });
  });

  it('rend la suppression de setlist accessible depuis le formulaire de modification', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    const editDialog = screen.getByRole('dialog', { name: 'Modifier la setlist' });
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Supprimer la setlist' }));

    const confirmDialog = screen.getByRole('dialog', { name: 'Voulez-vous supprimer cette setlist ?' });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => {
      expect(repositoryMocks.softDeleteSetlist).toHaveBeenCalledWith('setlist-test');
      expect(screen.getByText('Liste des setlists')).toBeInTheDocument();
    });
  });

  it('ferme la confirmation et affiche l’erreur si le retrait échoue', async () => {
    repositoryMocks.deleteEntry.mockRejectedValue(new Error('échec'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Chanson test de la setlist' }));
    const dialog = screen.getByRole('dialog', { name: 'Retirer « Chanson test » ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirer' }));

    expect(await screen.findByText('Impossible de retirer ce morceau de la setlist.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Retirer « Chanson test » ?' })).not.toBeInTheDocument();
  });
});
