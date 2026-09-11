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

  it("affiche le texte cliquable 'Ajouter une note' quand il n'y a pas de note", () => {
    renderSongDetail();

    const addNoteButton = screen.getByRole('button', { name: 'Ajouter une note' });
    expect(addNoteButton).toBeInTheDocument();
  });

  it("ouvre le dialogue d'ajout de note et enregistre la nouvelle note", async () => {
    renderSongDetail();

    const addNoteButton = screen.getByRole('button', { name: 'Ajouter une note' });
    fireEvent.click(addNoteButton);

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

  it("affiche la section Notes et n'affiche pas le bouton quand des notes existent", () => {
    mocks.currentSong = {
      ...mocks.currentSong,
      notes: 'Notes existantes du morceau',
    };

    renderSongDetail();

    expect(screen.queryByRole('button', { name: 'Ajouter une note' })).not.toBeInTheDocument();
    expect(screen.getByText('Notes existantes du morceau')).toBeInTheDocument();
  });

  it("n'affiche pas le bouton 'Ajouter une note' si l'utilisateur n'a pas les droits d'écriture", () => {
    mocks.canWrite = false;

    renderSongDetail();

    expect(screen.queryByRole('button', { name: 'Ajouter une note' })).not.toBeInTheDocument();
  });
});
