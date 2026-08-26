import { act, render, screen } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppContent } from '@/app/App';
import { SPLASH_ANIMATION_DURATION_MS } from '@/components/SplashScreen';
import { useAuthStore } from '@/stores/authStore';

vi.mock('@/app/router', () => ({
  AppRouter: () => <div>Accueil FaderZero</div>,
}));

vi.mock('@/services/supabase/inviteContext', () => ({
  clearPendingInviteToken: vi.fn(),
  readPendingInviteToken: () => null,
}));

vi.mock('@/services/supabase/client', () => ({
  getSupabaseConfigError: () => null,
}));

const session = {
  user: { id: 'user-test' },
} as Session;

const workspace = {
  id: 'workspace-test',
  name: 'Test workspace',
  createdBy: 'user-test',
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
  role: 'admin' as const,
  type: 'group' as const,
};

async function finishSplash(container: HTMLElement) {
  const fader = container.querySelector('.animate-fader-cap');
  expect(fader).toBeInTheDocument();
  await act(async () => {
    vi.advanceTimersByTime(SPLASH_ANIMATION_DURATION_MS + 250);
  });
}

describe('AppContent splash authentication gate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAuthStore.setState({
      session: null,
      activeWorkspace: null,
      workspaces: [],
      loading: false,
      initialized: true,
      error: null,
      infoMessage: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('termine le splash avant d’afficher l’accueil pour une session existante', async () => {
    useAuthStore.setState({ session, activeWorkspace: workspace });
    const { container } = render(<AppContent />);

    expect(screen.getByRole('status', { name: 'Chargement de FaderZero' })).toBeInTheDocument();
    expect(screen.queryByText('Accueil FaderZero')).not.toBeInTheDocument();

    await finishSplash(container);

    expect(screen.getByText('Accueil FaderZero')).toBeInTheDocument();
  });

  it('joue un nouveau splash complet après une connexion manuelle', async () => {
    const { container } = render(<AppContent />);
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument();

    act(() => {
      useAuthStore.setState({ session, activeWorkspace: workspace, loading: false });
    });

    expect(screen.getByRole('status', { name: 'Chargement de FaderZero' })).toBeInTheDocument();
    expect(screen.queryByText('Accueil FaderZero')).not.toBeInTheDocument();

    await finishSplash(container);

    expect(screen.getByText('Accueil FaderZero')).toBeInTheDocument();
  });

  it('attend aussi la fin du chargement des données authentifiées', async () => {
    useAuthStore.setState({ session, activeWorkspace: workspace, loading: true });
    const { container } = render(<AppContent />);

    await finishSplash(container);
    expect(screen.queryByText('Accueil FaderZero')).not.toBeInTheDocument();

    act(() => {
      useAuthStore.setState({ loading: false });
    });

    expect(screen.getByText('Accueil FaderZero')).toBeInTheDocument();
  });
});
