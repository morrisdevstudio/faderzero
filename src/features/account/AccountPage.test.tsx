import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { AccountPage } from '@/features/account/AccountPage';
import { useAuthStore } from '@/stores/authStore';
import type { Workspace } from '@/services/supabase/workspace';
import type { Session } from '@supabase/supabase-js';

const workspaceMocks = vi.hoisted(() => ({
  listWorkspaceInvites: vi.fn(),
  revokeWorkspaceInvite: vi.fn(),
  checkWorkspaceNameAvailable: vi.fn(),
}));

const profileMocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  updateCurrentProfileDisplayName: vi.fn(),
  getProfileAvatarUrl: vi.fn(),
  uploadCurrentProfileAvatar: vi.fn(),
}));

vi.mock('@/services/supabase/workspace', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/supabase/workspace')>();
  return {
    ...actual,
    listWorkspaceInvites: workspaceMocks.listWorkspaceInvites,
    revokeWorkspaceInvite: workspaceMocks.revokeWorkspaceInvite,
    checkWorkspaceNameAvailable: workspaceMocks.checkWorkspaceNameAvailable,
  };
});

vi.mock('@/services/supabase/profile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/supabase/profile')>();
  return {
    ...actual,
    getCurrentProfile: profileMocks.getCurrentProfile,
    updateCurrentProfileDisplayName: profileMocks.updateCurrentProfileDisplayName,
    getProfileAvatarUrl: profileMocks.getProfileAvatarUrl,
    uploadCurrentProfileAvatar: profileMocks.uploadCurrentProfileAvatar,
  };
});

const adminWorkspace: Workspace = {
  id: 'workspace-test',
  name: 'Groupe test',
  createdBy: 'user-test',
  createdAt: '2026-07-20T20:00:00.000Z',
  updatedAt: '2026-07-20T20:00:00.000Z',
  role: 'admin',
  type: 'group',
};

const userSession: Session = {
  access_token: 'test-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'user-test',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-22T10:00:00.000Z',
    email: 'private@example.test',
  },
};

const profile = {
  id: 'user-test',
  displayName: 'Yann',
  avatarPath: null,
  avatarUpdatedAt: null,
  createdAt: '2026-07-22T10:00:00.000Z',
  updatedAt: '2026-07-22T10:00:00.000Z',
};

describe('AccountPage invitations', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/account');
    workspaceMocks.listWorkspaceInvites.mockReset();
    workspaceMocks.revokeWorkspaceInvite.mockReset();
    workspaceMocks.checkWorkspaceNameAvailable.mockReset().mockResolvedValue(true);
    profileMocks.getCurrentProfile.mockReset();
    profileMocks.updateCurrentProfileDisplayName.mockReset();
    profileMocks.getProfileAvatarUrl.mockReset();
    profileMocks.uploadCurrentProfileAvatar.mockReset();
    useAuthStore.setState({
      session: null,
      workspaces: [adminWorkspace],
      activeWorkspace: adminWorkspace,
      loading: false,
      error: null,
      infoMessage: null,
    });
  });

  it('affiche un avatar généré et enregistre le pseudo du profil', async () => {
    profileMocks.getCurrentProfile.mockResolvedValue(profile);
    profileMocks.updateCurrentProfileDisplayName.mockResolvedValue({
      ...profile,
      displayName: 'Élodie !',
    });
    useAuthStore.setState({ session: userSession });

    render(<AccountPage />);

    const input = await screen.findByRole('textbox', { name: 'Pseudo public' });
    expect(input).toHaveValue('Yann');
    expect(screen.getByRole('button', { name: "Changer l'avatar de Yann" })).toHaveTextContent('YA');
    expect(screen.getByText('private@example.test')).toBeInTheDocument();
    expect(screen.getByText('E-mail privé — visible uniquement ici')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '  Élodie !  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le pseudo' }));

    await waitFor(() => {
      expect(profileMocks.updateCurrentProfileDisplayName).toHaveBeenCalledWith('Élodie !');
      expect(screen.getByText('Pseudo mis à jour.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: "Changer l'avatar de Élodie !" })).toHaveTextContent('ÉL');
  });

  it("ouvre le sélecteur au clic et affiche l'avatar téléversé", async () => {
    profileMocks.getCurrentProfile.mockResolvedValue(profile);
    profileMocks.uploadCurrentProfileAvatar.mockResolvedValue({
      ...profile,
      avatarPath: 'user-test/avatar.webp',
    });
    profileMocks.getProfileAvatarUrl.mockResolvedValue('https://storage.test/avatar.webp');
    useAuthStore.setState({ session: userSession });

    render(<AccountPage />);
    const avatarButton = await screen.findByRole('button', { name: "Changer l'avatar de Yann" });
    const fileInput = screen.getByLabelText('Choisir une photo de profil');
    const clickSpy = vi.spyOn(fileInput, 'click');
    fireEvent.click(avatarButton);
    expect(clickSpy).toHaveBeenCalledOnce();

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(profileMocks.uploadCurrentProfileAvatar).toHaveBeenCalledWith(file));
    await waitFor(() => {
      expect(document.querySelector('img[src="https://storage.test/avatar.webp"]')).toBeInTheDocument();
    });
    expect(screen.getByText('Avatar mis à jour.')).toBeInTheDocument();
  });

  it("n'affiche aucune action de partage pour Mon espace", () => {
    const personalWorkspace: Workspace = {
      ...adminWorkspace,
      id: 'personal-workspace',
      name: 'Mon espace',
      type: 'personal',
    };
    useAuthStore.setState({
      workspaces: [personalWorkspace],
      activeWorkspace: personalWorkspace,
    });

    render(<AccountPage />);

    expect(screen.getByText('0 groupe')).toBeInTheDocument();
    expect(screen.getByText('Accueil personnel actif')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Partager le groupe Mon espace' })).not.toBeInTheDocument();
  });

  it('sécurise les changements d’e-mail et de mot de passe', async () => {
    const updatePassword = vi.fn().mockResolvedValue(undefined);
    const requestEmailChange = vi.fn().mockResolvedValue(undefined);
    profileMocks.getCurrentProfile.mockResolvedValue(profile);
    useAuthStore.setState({
      session: userSession,
      updatePassword,
      requestEmailChange,
    });

    render(<AccountPage />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Nouvelle adresse e-mail' }), {
      target: { value: 'Nouvelle@Example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Demander le changement' }));

    await waitFor(() => {
      expect(requestEmailChange).toHaveBeenCalledWith('nouvelle@example.test');
    });

    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: 'Ancien123' } });
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'Nouveau123' } });
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'Nouveau123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mettre a jour le mot de passe' }));

    await waitFor(() => {
      expect(updatePassword).toHaveBeenCalledWith('Ancien123', 'Nouveau123');
    });
  });

  it('demande une confirmation avant l’envoi du lien de suppression', async () => {
    const requestAccountDeletion = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ requestAccountDeletion });
    render(<AccountPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le lien de suppression' }));
    const dialog = screen.getByRole('dialog', { name: 'Envoyer le lien de suppression ?' });
    expect(requestAccountDeletion).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer le lien' }));

    await waitFor(() => {
      expect(requestAccountDeletion).toHaveBeenCalledTimes(1);
    });
  });

  it("retire immédiatement de l'interface une invitation révoquée", async () => {
    workspaceMocks.listWorkspaceInvites.mockResolvedValue([{
      id: 'invite-to-revoke',
      role: 'member',
      createdAt: '2026-07-22T10:00:00.000Z',
      expiresAt: '2099-07-23T10:00:00.000Z',
    }]);
    workspaceMocks.revokeWorkspaceInvite.mockResolvedValue(undefined);

    render(<AccountPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Partager le groupe Groupe test' }));
    const revokeButton = await screen.findByRole('button', { name: 'Révoquer' });
    fireEvent.click(revokeButton);

    const confirmation = screen.getByRole('dialog', { name: 'Révoquer ce lien ?' });
    const confirmationOverlay = confirmation.parentElement;
    expect(confirmationOverlay?.parentElement).toBe(document.body);
    expect(confirmationOverlay).toHaveClass('z-[60]');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Révoquer' }));

    await waitFor(() => {
      expect(workspaceMocks.revokeWorkspaceInvite).toHaveBeenCalledWith('invite-to-revoke');
      expect(screen.queryByRole('button', { name: 'Révoquer' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('Aucun lien actif.')).toBeInTheDocument();
    expect(screen.getByText('Invitation révoquée.')).toBeInTheDocument();
  });

  it('cr?e un nouveau groupe et met ? jour les espaces de travail', async () => {
    const createWorkspace = vi.fn().mockImplementation(async (name: string) => {
      const newWs: Workspace = {
        id: 'workspace-new',
        name,
        createdBy: 'user-test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        role: 'admin',
        type: 'group',
      };
      useAuthStore.setState((state) => ({
        workspaces: [newWs, ...state.workspaces],
        activeWorkspace: newWs,
      }));
    });

    useAuthStore.setState({ createWorkspace });

    render(<AccountPage />);

    const input = screen.getByPlaceholderText('Nom du groupe');
    fireEvent.change(input, { target: { value: 'Nouveau Groupe Rock' } });
    fireEvent.click(screen.getByRole('button', { name: /Cr.er un nouveau groupe/i }));

    await waitFor(() => {
      expect(createWorkspace).toHaveBeenCalledWith('Nouveau Groupe Rock');
    });
    expect(input).toHaveValue('');
  });
});
