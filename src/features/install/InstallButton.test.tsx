import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallButton } from './InstallButton';
import { InstallProvider } from './InstallProvider';

const matchMedia = vi.fn();

function renderInstallButton() {
  return render(<InstallProvider><InstallButton /></InstallProvider>);
}

describe('InstallButton', () => {
  beforeEach(() => {
    matchMedia.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
  });

  it('ouvre le guide générique quand aucune installation native n’est disponible', () => {
    renderInstallButton();

    fireEvent.click(screen.getByRole('button', { name: 'Installer' }));

    expect(screen.getByRole('dialog', { name: 'Installer FaderZero' })).toBeInTheDocument();
    expect(screen.getByText('Appuyez sur les trois points en haut à droite.')).toBeInTheDocument();
  });

  it('bascule vers le guide manuel quand l’installation native est refusée', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    });
    renderInstallButton();

    fireEvent(window, event);
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Installer' }));
      expect(screen.getByRole('button', { name: 'Installer maintenant' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Installer maintenant' }));

    await waitFor(() => {
      expect(prompt).toHaveBeenCalledOnce();
      expect(screen.getByText('L’installation automatique n’a pas abouti. Suivez ces étapes manuelles.')).toBeInTheDocument();
    });
  });

  it('masque le bouton après une installation réussie', async () => {
    renderInstallButton();

    fireEvent(window, new Event('appinstalled'));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Installer' })).not.toBeInTheDocument());
  });
});
