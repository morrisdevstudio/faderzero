import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SongsPage } from './SongsPage';

const mocks = vi.hoisted(() => ({
  songs: [] as Array<Record<string, unknown>>,
  songSummaries: [] as Array<Record<string, unknown>>,
  importedTracks: [] as Array<Record<string, unknown>>,
  pendingUploads: [] as Array<Record<string, unknown>>,
  canWrite: true,
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (querier: () => unknown) => {
    try {
      return querier();
    } catch {
      return [];
    }
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      activeWorkspace: { id: 'workspace-1', role: mocks.canWrite ? 'owner' : 'viewer' },
    }),
}));

vi.mock('@/services/supabase/workspace', () => ({
  canWriteWorkspace: () => mocks.canWrite,
}));

vi.mock('@/db/repositories/songsRepository', () => ({
  songsRepository: {
    list: () => mocks.songs,
    listLibrarySummaries: () => mocks.songSummaries,
    create: vi.fn(),
  },
}));

vi.mock('@/db/repositories/songAssetsRepository', () => ({
  songAssetsRepository: {
    listImportedTracks: () => mocks.importedTracks,
  },
}));

vi.mock('@/db/db', () => ({
  db: {
    pendingAudioUploads: {
      where: () => ({
        equals: () => ({
          sortBy: () => mocks.pendingUploads,
        }),
      }),
    },
  },
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

function renderPage() {
  return render(
    <MemoryRouter>
      <SongsPage />
    </MemoryRouter>,
  );
}

describe('SongsPage component', () => {
  beforeEach(() => {
    mocks.canWrite = true;
    mocks.songs = [];
    mocks.songSummaries = [];
    mocks.importedTracks = [];
    mocks.pendingUploads = [];
  });

  it('affiche le PageHeader et la liste des morceaux avec tri', () => {
    mocks.songs = [
      { id: 'song-b', title: 'Bravo', status: 'idea', updatedAt: 200 },
      { id: 'song-a', title: 'Alpha', status: 'live', updatedAt: 100 },
    ];
    mocks.songSummaries = [
      {
        song: {
          id: 'song-b',
          title: 'Bravo',
          status: 'idea',
          bpm: 120,
          key: 'Am',
          durationSeconds: 180,
          updatedAt: 200,
        },
        primaryAsset: null,
        totalAssets: 0,
      },
      {
        song: {
          id: 'song-a',
          title: 'Alpha',
          status: 'live',
          bpm: 100,
          key: 'C',
          durationSeconds: 210,
          updatedAt: 100,
        },
        primaryAsset: null,
        totalAssets: 0,
      },
    ];

    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Morceaux' })).toBeInTheDocument();
    expect(document.querySelector('[data-icon-usage="page-header.songs"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer un morceau' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importer des fichiers audio' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Rechercher dans les morceaux' })).toBeInTheDocument();

    const linksBeforeSort = screen.getAllByRole('link');
    expect(within(linksBeforeSort[0]!).getByRole('heading', { name: 'Bravo' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trier les morceaux' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'A → Z' }));

    const linksAfterSort = screen.getAllByRole('link');
    expect(within(linksAfterSort[0]!).getByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
  });

  it('conserve les permissions et masque les boutons d’action en mode lecture seule', () => {
    mocks.canWrite = false;
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Morceaux' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Créer un morceau' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Importer des fichiers audio' })).not.toBeInTheDocument();
  });

  it('ouvre la modale de création et utilise le style fz-field-label', () => {
    mocks.songs = [{ id: 'song-1', title: 'Test', status: 'idea', updatedAt: 100 }];
    mocks.songSummaries = [
      {
        song: { id: 'song-1', title: 'Test', status: 'idea', updatedAt: 100 },
        primaryAsset: null,
        totalAssets: 0,
      },
    ];

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Créer un morceau' }));

    expect(screen.getByText('Titre')).toHaveClass('fz-field-label');
  });
});
