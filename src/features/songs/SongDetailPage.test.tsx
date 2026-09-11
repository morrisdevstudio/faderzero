import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SongDetailPage } from './SongDetailPage';

const mocks = vi.hoisted(() => ({
  canWrite: true,
  currentSong: null as any,
  assets: [] as any[],
  pendingAudioUploads: [] as any[],
  unlinkedTracks: [] as any[],
  updateSong: vi.fn(),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (querier: () => unknown) => {
    try {
      const result = querier();
      if (result instanceof Promise) {
        return false;
      }
      return result;
    } catch {
      return undefined;
    }
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      activeWorkspace: { id: 'workspace-1', role: mocks.canWrite ? 'owner' : 'viewer' },
      workspaces: [{ id: 'workspace-1', role: mocks.canWrite ? 'owner' : 'viewer' }],
      setActiveWorkspace: vi.fn(),
    }),
}));

vi.mock('@/services/supabase/workspace', () => ({
  canWriteWorkspace: () => mocks.canWrite,
}));

vi.mock('@/db/repositories/songsRepository', () => ({
  songsRepository: {
    getById: () => mocks.currentSong,
    update: (...args: unknown[]) => mocks.updateSong(...args),
  },
}));

vi.mock('@/db/repositories/songAssetsRepository', () => ({
  songAssetsRepository: {
    listBySongId: () => mocks.assets,
    listUnlinkedTracks: () => mocks.unlinkedTracks,
    listImportedTracks: () => [],
  },
}));

vi.mock('@/db/db', () => ({
  db: {
    songs: {
      get: () => Promise.resolve(mocks.currentSong),
    },
    pendingAudioUploads: {
      where: () => ({
        equals: () => ({
          filter: () => ({
            sortBy: () => Promise.resolve(mocks.pendingAudioUploads),
          }),
        }),
      }),
    },
  },
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

vi.mock('@/features/audio/audioPlayerStore', () => ({
  useAudioPlayerStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      playQueue: vi.fn(),
      stop: vi.fn(),
      currentIndex: -1,
      queue: [],
      status: 'idle',
    }),
}));

vi.mock('@/features/audio/audioCacheStore', () => ({
  useAudioCacheStore: () => ({
    cachedAssetIds: new Set<string>(),
    downloadingAssetIds: new Set<string>(),
    downloadAsset: vi.fn(),
    removeAsset: vi.fn(),
    checkCacheStatus: vi.fn(),
  }),
}));

vi.mock('@/stores/undoToastStore', () => ({
  useUndoToastStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      showUndoToast: vi.fn(),
    }),
}));

function renderSongDetail(songId = 'song-1') {
  return render(
    <MemoryRouter initialEntries={[`/songs/${songId}`]}>
      <Routes>
        <Route path="/songs/:songId" element={<SongDetailPage />} />
        <Route path="/songs/:songId/write" element={<div>Éditeur de paroles</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SongDetailPage - Notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canWrite = true;
    mocks.assets = [];
    mocks.pendingAudioUploads = [];
    mocks.unlinkedTracks = [];
    mocks.updateSong.mockResolvedValue(undefined);
    mocks.currentSong = {
      id: 'song-1',
      workspaceId: 'workspace-1',
      title: 'Chanson sans note',
      status: 'Idee',
      lyrics: 'Paroles du morceau',
      key: 'Am',
      bpm: 120,
      durationSeconds: 180,
      notes: '',
      updatedAt: 1000,
    };
  });

  it("affiche les sections vides avec leurs actions d'édition", () => {
    mocks.currentSong = {
      ...mocks.currentSong,
      lyrics: '',
    };

    renderSongDetail();

    expect(screen.getByText('Aucune note pour le moment.')).toBeInTheDocument();
    expect(screen.getByText('Aucune parole pour le moment.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier les notes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier les paroles' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajouter une note' })).not.toBeInTheDocument();
  });

  it("ouvre le dialogue de notes et enregistre la nouvelle note", async () => {
    renderSongDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Modifier les notes' }));

    expect(screen.getByRole('dialog', { name: 'Ajouter une note' })).toBeInTheDocument();

    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    fireEvent.change(textarea, { target: { value: 'Nouvelle note de répétition' } });

    const submitButton = screen.getByRole('button', { name: 'Enregistrer' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.updateSong).toHaveBeenCalledWith('song-1', {
        notes: 'Nouvelle note de répétition',
      });
    });
  });

  it("préremplit le dialogue quand des notes existent", () => {
    mocks.currentSong = {
      ...mocks.currentSong,
      notes: 'Notes existantes du morceau',
    };

    renderSongDetail();

    expect(screen.getByText('Notes existantes du morceau')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier les notes' }));
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Notes existantes du morceau');
  });

  it("ouvre l'éditeur de paroles depuis le crayon", () => {
    renderSongDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Modifier les paroles' }));

    expect(screen.getByText('Éditeur de paroles')).toBeInTheDocument();
  });

  it("place le prompteur immédiatement à gauche du bouton de modification des paroles", () => {
    renderSongDetail();

    const prompterLink = screen.getByRole('link', { name: 'Ouvrir cette chanson dans le prompteur' });
    const editLyricsButton = screen.getByRole('button', { name: 'Modifier les paroles' });

    expect(prompterLink).toHaveAttribute('href', '/prompter/play?songId=song-1');
    expect(prompterLink.nextElementSibling).toBe(editLyricsButton);
  });

  it.each([
    ["Modifier l'état", 'Statut de création'],
    ['Modifier la tonalité', 'Sélectionner la Tonalité'],
    ['Modifier le tempo', 'Sélectionner le tempo'],
    ['Modifier la durée', 'Sélectionner la durée'],
  ])('ouvre directement le sélecteur de %s', (buttonName, dialogName) => {
    renderSongDetail();

    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    expect(screen.getByRole('dialog', { name: dialogName })).toBeInTheDocument();
  });

  it("masque les crayons si l'utilisateur n'a pas les droits d'écriture", () => {
    mocks.canWrite = false;

    renderSongDetail();

    expect(screen.queryByRole('button', { name: 'Modifier les notes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier les paroles' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir cette chanson dans le prompteur' })).toBeInTheDocument();
    expect(screen.getByText('Aucune note pour le moment.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier le tempo' })).toBeDisabled();
  });
});
