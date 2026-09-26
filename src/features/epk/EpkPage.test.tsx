import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EpkPage } from './EpkPage';
import { DEFAULT_EPK_EDITORIAL, DEFAULT_EPK_SECTION_ORDER } from './epkPresentation';

const mocks = vi.hoisted(() => ({
  epk: null as any,
  workspace: {
    id: 'workspace-group',
    name: 'Groupe Test',
    role: 'owner',
    type: 'group',
  },
  createEpk: vi.fn(),
  getEpk: vi.fn(),
  saveEpk: vi.fn(),
  publishEpkDraft: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      activeWorkspace: mocks.workspace,
    }),
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

vi.mock('@/services/supabase/workspace', () => ({
  canAdministerWorkspace: (role: string) => role === 'owner' || role === 'admin',
}));

vi.mock('@/services/supabase/workspaceStorage', () => ({
  hasConnectedWorkspaceStorage: () => Promise.resolve(true),
}));

vi.mock('./epk', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('./epk');
  return {
    ...actual,
    getEpk: (...args: unknown[]) => mocks.getEpk(...args),
    createEpk: (...args: unknown[]) => mocks.createEpk(...args),
    saveEpk: (...args: unknown[]) => mocks.saveEpk(...args),
    publishEpkDraft: (...args: unknown[]) => mocks.publishEpkDraft(...args),
    listAvailableEpkTracks: () => Promise.resolve([]),
    listEpkTracks: () => Promise.resolve([]),
    listEpkVideos: () => Promise.resolve([]),
    listEpkPhotos: () => Promise.resolve([]),
    listEpkDocuments: () => Promise.resolve([]),
    listEpkContacts: () => Promise.resolve([]),
    listEpkLinks: () => Promise.resolve([]),
  };
});

function renderEpkPage() {
  return render(
    <MemoryRouter initialEntries={['/account/epk']}>
      <Routes>
        <Route path="/account/epk" element={<EpkPage />} />
        <Route path="/account" element={<div>Page Paramètres</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EpkPage - Empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.epk = null;
    mocks.workspace = {
      id: 'workspace-group',
      name: 'Groupe Test',
      role: 'owner',
      type: 'group',
    };
    mocks.getEpk.mockResolvedValue(null);
    mocks.createEpk.mockResolvedValue({
      id: 'epk-1',
      workspaceId: 'workspace-group',
      slug: 'groupe-test',
      displayName: 'Groupe Test',
      status: 'DRAFT',
      genres: [],
      theme: 'default',
    });
  });

  it('affiche un état vide clair avec le bouton Créer l’EPK et la présentation', async () => {
    renderEpkPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Kit de presse public (EPK)' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: 'EPK public' })).toBeInTheDocument();
    expect(screen.getByText('Morceaux et vidéos')).toBeInTheDocument();
    expect(screen.getByText('Bio et photos de presse')).toBeInTheDocument();
    expect(screen.getByText('Contacts pros et documents')).toBeInTheDocument();

    const createButton = screen.getByRole('button', { name: 'Créer l’EPK' });
    expect(createButton).toBeInTheDocument();
  });

  it('appelle createEpk lors du clic sur Créer l’EPK', async () => {
    renderEpkPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Créer l’EPK' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Créer l’EPK' }));

    await waitFor(() => {
      expect(mocks.createEpk).toHaveBeenCalledWith('workspace-group', 'Groupe Test');
    });
  });

  it('permet de revenir aux paramètres via le bouton retour', async () => {
    renderEpkPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retour' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));

    await waitFor(() => {
      expect(screen.getByText('Page Paramètres')).toBeInTheDocument();
    });
  });

  it('bloque l’accès aux non-administrateurs', async () => {
    mocks.workspace = {
      id: 'workspace-group',
      name: 'Groupe Test',
      role: 'member',
      type: 'group',
    };

    renderEpkPage();

    expect(screen.getByText('L’EPK public est réservé aux administrateurs d’un groupe.')).toBeInTheDocument();
  });
});

const draftEpk = {
  id: 'epk-1',
  workspaceId: 'workspace-group',
  displayName: 'Groupe Test',
  slug: 'groupe-test',
  status: 'DRAFT' as const,
  genres: ['Rock'],
  theme: 'stage-dark' as const,
  draftRevision: 0,
  editorial: DEFAULT_EPK_EDITORIAL,
  sectionOrder: [...DEFAULT_EPK_SECTION_ORDER],
  hiddenSections: [],
};

describe('EpkPage - Publication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspace = { id: 'workspace-group', name: 'Groupe Test', role: 'owner', type: 'group' };
    mocks.getEpk.mockResolvedValue(draftEpk);
    mocks.saveEpk.mockResolvedValue(draftEpk);
  });

  async function openEditor(): Promise<void> {
    renderEpkPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier la page EPK' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publier la page' }));
  }

  it('affiche la raison renvoyée par la base au lieu du message générique', async () => {
    mocks.publishEpkDraft.mockRejectedValue(new Error('{"code":"P0001","message":"EPK_MEDIA_MISSING"}'));

    await openEditor();

    await waitFor(() => {
      expect(screen.getByText('Un média de l’EPK n’est plus disponible. Retire-le puis relance la publication.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Publication impossible.')).not.toBeInTheDocument();
  });

  it('refuse de publier un EPK sans nom public sans appeler le serveur', async () => {
    mocks.getEpk.mockResolvedValue({ ...draftEpk, displayName: '' });

    await openEditor();

    await waitFor(() => {
      expect(screen.getByText('Le nom public du groupe est requis.')).toBeInTheDocument();
    });
    expect(mocks.saveEpk).not.toHaveBeenCalled();
    expect(mocks.publishEpkDraft).not.toHaveBeenCalled();
  });
});
