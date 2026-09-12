import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishedEpkShareContent } from './contactEmailShare';

const shareMocks = vi.hoisted(() => ({
  listPublishedEpkShareContent: vi.fn(),
}));

vi.mock('./contactEmailShare', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./contactEmailShare')>()),
  listPublishedEpkShareContent: shareMocks.listPublishedEpkShareContent,
}));

import { ContactEmailComposer } from './ContactEmailComposer';

const publishedContent: PublishedEpkShareContent = {
  epkName: 'Night Drive',
  publicUrl: 'https://faderzero.com/night-drive',
  hasUnpublishedChanges: false,
  attachments: [{
    id: 'document:1',
    kind: 'document',
    title: 'Rider technique',
    filename: 'rider.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 3,
    loadFile: vi.fn(async () => new File(['pdf'], 'rider.pdf', { type: 'application/pdf' })),
  }],
};

describe('ContactEmailComposer', () => {
  const share = vi.fn(async () => undefined);
  const writeText = vi.fn(async () => undefined);

  beforeEach(() => {
    shareMocks.listPublishedEpkShareContent.mockResolvedValue(publishedContent);
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('préremplit le message, prépare le fichier et ouvre le partage natif', async () => {
    render(<StrictMode><ContactEmailComposer contact={{ name: 'Clara Martin', email: 'clara@example.test' }} workspaceId="workspace-1" workspaceName="Groupe" onClose={vi.fn()} /></StrictMode>);
    const dialog = screen.getByRole('dialog', { name: 'Envoyer un e-mail' });

    expect(within(dialog).getByText('clara@example.test')).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByLabelText('Objet')).toHaveValue('Dossier de presse — Groupe'));
    expect((within(dialog).getByLabelText('Message') as HTMLTextAreaElement).value).toContain('Bonjour Clara');

    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Rider technique/ }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Partager les fichiers' })).toBeEnabled());

    fireEvent.click(within(dialog).getByRole('button', { name: 'Copier' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('clara@example.test'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Partager les fichiers' }));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({
      files: [expect.objectContaining({ name: 'rider.pdf' })],
      title: 'Dossier de presse — Groupe',
    })));
  });

  it('force le lien EPK quand la sélection dépasse 20 Mo', async () => {
    shareMocks.listPublishedEpkShareContent.mockResolvedValue({
      ...publishedContent,
      attachments: [{ ...publishedContent.attachments[0]!, sizeBytes: 21 * 1024 * 1024 }],
    });
    render(<ContactEmailComposer contact={{ name: 'Clara Martin', email: 'clara@example.test' }} workspaceId="workspace-1" workspaceName="Groupe" onClose={vi.fn()} />);

    const checkbox = await screen.findByRole('checkbox', { name: /Rider technique/ });
    fireEvent.click(checkbox);
    expect(screen.getByText(/dépasse 20 Mo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir le client mail' })).toBeEnabled();
    expect(publishedContent.attachments[0]!.loadFile).not.toHaveBeenCalled();
  });

  it('explique comment activer les pièces jointes sans EPK publié', async () => {
    shareMocks.listPublishedEpkShareContent.mockResolvedValue(null);
    render(<ContactEmailComposer contact={{ name: 'Clara Martin', email: 'clara@example.test' }} workspaceId="workspace-1" workspaceName="Groupe" onClose={vi.fn()} />);

    expect(await screen.findByText(/Publie d’abord ton EPK/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir le client mail' })).toBeEnabled();
  });

  it('conserve le mail simple et affiche un état réseau explicite hors ligne', async () => {
    shareMocks.listPublishedEpkShareContent.mockRejectedValue(new Error('Lecture impossible.'));
    render(<ContactEmailComposer contact={{ name: 'Clara Martin', email: 'clara@example.test' }} workspaceId="workspace-1" workspaceName="Groupe" onClose={vi.fn()} />);

    expect(await screen.findByText(/Une connexion est requise/)).toBeInTheDocument();
    expect(screen.queryByText(/Publie d’abord ton EPK/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir le client mail' })).toBeEnabled();
  });

  it('bascule vers le lien EPK si le téléchargement du fichier échoue', async () => {
    const failedAttachment = { ...publishedContent.attachments[0]!, loadFile: vi.fn(async () => { throw new Error('offline'); }) };
    shareMocks.listPublishedEpkShareContent.mockResolvedValue({ ...publishedContent, attachments: [failedAttachment] });
    render(<ContactEmailComposer contact={{ name: 'Clara Martin', email: 'clara@example.test' }} workspaceId="workspace-1" workspaceName="Groupe" onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('checkbox', { name: /Rider technique/ }));
    expect(await screen.findByText(/Fichier indisponible/)).toBeInTheDocument();
    expect(screen.getByText(/envoyés via le lien/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir le client mail' })).toBeEnabled();
  });

  it('propose le lien EPK après un échec du partage natif', async () => {
    share.mockRejectedValueOnce(new Error('share failed'));
    render(<ContactEmailComposer contact={{ name: 'Clara Martin', email: 'clara@example.test' }} workspaceId="workspace-1" workspaceName="Groupe" onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('checkbox', { name: /Rider technique/ }));
    const shareButton = await screen.findByRole('button', { name: 'Partager les fichiers' });
    await waitFor(() => expect(shareButton).toBeEnabled());
    fireEvent.click(shareButton);

    expect(await screen.findByText(/partage des fichiers a échoué/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir le client mail' })).toBeEnabled();
  });
});
