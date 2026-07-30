import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import type { SongDocumentV1 } from '@/db/songDocument';
import type { Workspace } from '@/services/supabase/workspace';
import { useAuthStore } from '@/stores/authStore';
import { SongWriterPage } from './SongWriterPage';

const repositoryMocks = vi.hoisted(() => ({
  create: vi.fn(),
  getById: vi.fn(),
}));

vi.mock('@/db/repositories/songsRepository', () => ({
  songsRepository: repositoryMocks,
}));

vi.mock('@/features/songs/editor/SongEditor', () => ({
  SongEditor: ({ onChange }: { onChange: (document: SongDocumentV1) => void }) => (
    <button
      type="button"
      onClick={() => onChange({
        type: 'doc',
        content: [{
          type: 'songSection',
          attrs: { id: 'section-1', sectionType: 'free', label: '' },
          content: [{
            type: 'paragraph',
            attrs: { id: 'paragraph-1' },
            content: [{ type: 'text', text: 'Une première ligne' }],
          }],
        }],
      })}
    >
      Écrire une ligne
    </button>
  ),
}));

const workspace: Workspace = {
  id: 'workspace-test',
  name: 'Groupe test',
  createdBy: 'user-test',
  createdAt: '2026-07-30T10:00:00.000Z',
  updatedAt: '2026-07-30T10:00:00.000Z',
  role: 'admin',
  type: 'group',
};

function renderDraftWriter() {
  return render(
    <MemoryRouter initialEntries={['/songs/new/write']}>
      <Routes>
        <Route path="/songs/:songId/write" element={<SongWriterPage />} />
        <Route path="/songs" element={<div>Répertoire test</div>} />
        <Route path="/songs/:songId" element={<div>Chanson enregistrée</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SongWriterPage draft flow', () => {
  beforeEach(() => {
    repositoryMocks.create.mockReset().mockResolvedValue({ id: 'draft-song' });
    repositoryMocks.getById.mockReset();
    useAuthStore.setState({ activeWorkspace: workspace });
  });

  it("quitte immédiatement sans créer de chanson quand l'éditeur est vide", async () => {
    renderDraftWriter();

    fireEvent.click(screen.getByRole('button', { name: 'Retour au morceau' }));

    expect(await screen.findByText('Répertoire test')).toBeInTheDocument();
    expect(repositoryMocks.create).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('propose un titre dans une popup visible et permet de quitter sans créer', async () => {
    renderDraftWriter();

    fireEvent.click(screen.getByRole('button', { name: 'Écrire une ligne' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retour au morceau' }));

    const dialog = screen.getByRole('dialog', { name: 'Enregistrer la chanson ?' });
    expect(dialog.parentElement?.parentElement?.parentElement).toBe(document.body);
    expect(dialog.parentElement?.parentElement).toHaveClass('pt-16');
    expect(screen.getByRole('textbox', { name: 'Titre' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Quitter sans enregistrer' }));

    expect(await screen.findByText('Répertoire test')).toBeInTheDocument();
    expect(repositoryMocks.create).not.toHaveBeenCalled();
  });

  it('crée la chanson uniquement après confirmation avec un titre', async () => {
    renderDraftWriter();

    fireEvent.click(screen.getByRole('button', { name: 'Écrire une ligne' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retour au morceau' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Titre' }), {
      target: { value: '  Ma nouvelle chanson  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(repositoryMocks.create).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Ma nouvelle chanson',
        lyricsDocument: expect.objectContaining({ type: 'doc' }),
      }));
    });
    expect(await screen.findByText('Chanson enregistrée')).toBeInTheDocument();
  });
});
