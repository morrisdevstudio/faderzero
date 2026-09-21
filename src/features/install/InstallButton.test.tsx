import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallBanner } from './InstallButton';
import { InstallProvider } from './InstallProvider';

const matchMedia = vi.fn();
const originalUserAgent = navigator.userAgent;
const originalVendor = navigator.vendor;

function renderInstallBanner() {
  return render(<InstallProvider><InstallBanner /></InstallProvider>);
}

function setNavigator(userAgent: string, vendor = 'Google Inc.') {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent });
  Object.defineProperty(navigator, 'vendor', { configurable: true, value: vendor });
}

describe('InstallBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setNavigator('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36');
    matchMedia.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUserAgent });
    Object.defineProperty(navigator, 'vendor', { configurable: true, value: originalVendor });
  });

  it('appears and opens the native prompt when Chromium makes installation available', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    });
    renderInstallBanner();

    fireEvent(window, event);

    await waitFor(() => expect(screen.getByRole('button', { name: /^Installer/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Installer/ }));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
  });

  it('does not appear in standalone mode', () => {
    matchMedia.mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderInstallBanner();

    expect(screen.queryByLabelText('Installation de FaderZero')).not.toBeInTheDocument();
  });

  it('opens iOS instructions when Safari cannot provide a native prompt', () => {
    setNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', 'Apple Computer, Inc.');
    renderInstallBanner();

    fireEvent.click(screen.getByRole('button', { name: /^Installer/ }));

    expect(screen.getByRole('dialog', { name: 'Installer sur iPhone ou iPad' })).toBeInTheDocument();
    expect(screen.getByText('Touchez le bouton Partager de Safari.')).toBeInTheDocument();
    expect(screen.getByText('Choisissez Sur l’écran d’accueil.')).toBeInTheDocument();
  });

  it('keeps the banner hidden for seven days after dismissal', () => {
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    });
    const { unmount } = renderInstallBanner();
    fireEvent(window, event);
    fireEvent.click(screen.getByRole('button', { name: 'Masquer la bannière d’installation pendant 7 jours' }));
    expect(screen.queryByLabelText('Installation de FaderZero')).not.toBeInTheDocument();

    unmount();
    renderInstallBanner();
    expect(screen.queryByLabelText('Installation de FaderZero')).not.toBeInTheDocument();
  });

  it('hides immediately after a successful native installation', async () => {
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    renderInstallBanner();
    fireEvent(window, event);

    await waitFor(() => fireEvent.click(screen.getByRole('button', { name: /^Installer/ })));
    await waitFor(() => expect(screen.queryByLabelText('Installation de FaderZero')).not.toBeInTheDocument());
  });
});
