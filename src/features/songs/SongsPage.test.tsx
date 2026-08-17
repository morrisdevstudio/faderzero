import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SongsPage } from './SongsPage';

const songsPageMocks = vi.hoisted(() => ({
  songs: [] as Array<Record<string, unknown>>,
  canWrite: true,
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => songsPageMocks.songs,
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    activeWorkspace: { id: 'workspace-1', role: songsPageMocks.canWrite ? 'owner' : 'viewer' },
  }),
}));

vi.mock('@/services/supabase/workspace', () => ({
  canWriteWorkspace: () => songsPageMocks.canWrite,
}));

vi.mock('@/db/repositories/songsRepository', () => ({
  songsRepository: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SongsPage />
    </MemoryRouter>,
  );
}

describe('SongsPage header', () => {
  beforeEach(() => {
    songsPageMocks.canWrite = true;
    songsPageMocks.songs = [];
  });

  it('compose PageHeader avec les outils sans modifier le tri', () => {
    songsPageMocks.songs = [
      { id: 'song-b', title: 'Bravo', status: 'idea', updatedAt: 2 },
      { id: 'song-a', title: 'Alpha', status: 'idea', updatedAt: 1 },
    ];
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Répertoire' })).toBeInTheDocument();
    expect(document.querySelector('[data-icon-usage="page-header.songs"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nouvelle chanson' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Rechercher dans le répertoire' })).toBeInTheDocument();

    const linksBeforeSort = screen.getAllByRole('link');
    expect(within(linksBeforeSort[0]!).getByRole('heading', { name: 'Alpha' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trier le répertoire' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Z → A' }));

    const linksAfterSort = screen.getAllByRole('link');
    expect(within(linksAfterSort[0]!).getByRole('heading', { name: 'Bravo' })).toBeInTheDocument();
  });

  it('conserve les permissions et masque les outils lorsque la liste est vide', () => {
    songsPageMocks.canWrite = false;
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Répertoire' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nouvelle chanson' })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByText('Votre repertoire est vide')).toBeInTheDocument();
  });
});
