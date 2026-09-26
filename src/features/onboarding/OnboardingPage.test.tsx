import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const profileMocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getGeneratedAvatar: vi.fn(() => ({ initials: 'YA', hue: 20 })),
  getProfileAvatarUrl: vi.fn(),
  normalizeDisplayName: vi.fn((value: string) => value.trim()),
  updateCurrentProfileDisplayName: vi.fn(),
  uploadCurrentProfileAvatar: vi.fn(),
  completeCurrentProfileOnboarding: vi.fn(),
}));
const workspaceMocks = vi.hoisted(() => ({ createWorkspaceInviteLink: vi.fn() }));
const storageMocks = vi.hoisted(() => ({ startGoogleDriveConnection: vi.fn() }));
const authMocks = vi.hoisted(() => ({ createWorkspace: vi.fn(), setActiveWorkspace: vi.fn() }));

vi.mock('@/services/supabase/profile', () => profileMocks);
vi.mock('@/services/supabase/workspace', () => workspaceMocks);
vi.mock('@/services/supabase/workspaceStorage', () => storageMocks);
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    workspaces: [
      { id: 'personal-1', name: 'Mon espace', type: 'personal', role: 'admin' },
      { id: 'group-1', name: 'Les Satellites', type: 'group', role: 'admin' },
    ],
    ...authMocks,
  }),
}));

import { OnboardingPage } from './OnboardingPage';

const profile = {
  id: 'user-1', displayName: 'Yann', avatarPath: null, avatarUpdatedAt: null,
  onboardingCompletedAt: null, createdAt: '2026-09-26T00:00:00.000Z', updatedAt: '2026-09-26T00:00:00.000Z',
};
const group = { id: 'group-1', name: 'Les Satellites', type: 'group' as const, role: 'admin' as const, createdBy: 'user-1', createdAt: '', updatedAt: '' };

describe('OnboardingPage', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    Object.values(profileMocks).forEach((mock) => mock.mockReset());
    profileMocks.getCurrentProfile.mockResolvedValue(profile);
    profileMocks.getGeneratedAvatar.mockReturnValue({ initials: 'YA', hue: 20 });
    profileMocks.getProfileAvatarUrl.mockResolvedValue(null);
    profileMocks.normalizeDisplayName.mockImplementation((value: string) => value.trim());
    profileMocks.updateCurrentProfileDisplayName.mockResolvedValue(profile);
    profileMocks.completeCurrentProfileOnboarding.mockResolvedValue({ ...profile, onboardingCompletedAt: '2026-09-26T00:01:00.000Z' });
    workspaceMocks.createWorkspaceInviteLink.mockReset();
    storageMocks.startGoogleDriveConnection.mockReset();
    authMocks.createWorkspace.mockReset().mockResolvedValue(group);
    authMocks.setActiveWorkspace.mockReset();
  });

  it('conduit un nouveau compte du pseudo à la création d’un groupe sans stockage', async () => {
    render(<MemoryRouter><OnboardingPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Ton profil FaderZero' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Pseudo' }), { target: { value: ' Yann  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(profileMocks.updateCurrentProfileDisplayName).toHaveBeenCalledWith('Yann'));

    fireEvent.click(await screen.findByRole('button', { name: 'Créer un groupe' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom du groupe' }), { target: { value: 'Les Satellites' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le groupe' }));
    await waitFor(() => expect(authMocks.createWorkspace).toHaveBeenCalledWith('Les Satellites'));

    fireEvent.click(await screen.findByRole('button', { name: 'Ignorer pour le moment' }));
    expect(await screen.findByRole('heading', { name: 'Invite ton groupe' })).toBeInTheDocument();
    expect(screen.getByText(/Le groupe peut déjà utiliser le texte et les liens/i)).toBeInTheDocument();
  });

  it('démarre Google Drive avec le contexte du tunnel', async () => {
    storageMocks.startGoogleDriveConnection.mockResolvedValue('https://accounts.google.test/authorize');
    render(<MemoryRouter><OnboardingPage startGroupCreation /></MemoryRouter>);

    fireEvent.change(await screen.findByRole('textbox', { name: 'Nom du groupe' }), { target: { value: 'Les Satellites' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le groupe' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Connecter Google Drive' }));

    await waitFor(() => expect(storageMocks.startGoogleDriveConnection).toHaveBeenCalledWith('group-1', 'onboarding'));
  });
});
