import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { act, fireEvent, render as renderUI, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { AccountPage } from '@/features/account/AccountPage';
import { useAuthStore } from '@/stores/authStore';
import type { Workspace } from '@/services/supabase/workspace';
import type { Session } from '@supabase/supabase-js';

const workspaceMocks = vi.hoisted(() => ({
  listWorkspaceInvites: vi.fn(),
  revokeWorkspaceInvite: vi.fn(),
  checkWorkspaceNameAvailable: vi.fn(),
  listWorkspaceMembersWithProfiles: vi.fn(),
  removeWorkspaceMember: vi.fn(),
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
    listWorkspaceMembersWithProfiles: workspaceMocks.listWorkspaceMembersWithProfiles,
    removeWorkspaceMember: workspaceMocks.removeWorkspaceMember,
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

function render(ui: ReactNode) { return renderUI(<BrowserRouter>{ui}</BrowserRouter>); }
function openProfile() { fireEvent.click(screen.getByRole('button', { name: /Profil Photo et pseudo/ })); }
function openSecurity() { fireEvent.click(screen.getByRole('button', { name: /Connexion et sécurité E-mail/ })); }
function openMembers() {
  fireEvent.click(screen.getByRole('button', { name: 'Réglages de Groupe test' }));
  fireEvent.click(screen.getByRole('button', { name: 'Membres et invitations' }));
}
const initialAuthState = useAuthStore.getState();
describe('AccountPage', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/account');
    workspaceMocks.listWorkspaceInvites.mockReset();
    workspaceMocks.revokeWorkspaceInvite.mockReset();
    workspaceMocks.checkWorkspaceNameAvailable.mockReset().mockResolvedValue(true);
    workspaceMocks.listWorkspaceMembersWithProfiles.mockReset().mockResolvedValue([]);
    workspaceMocks.removeWorkspaceMember.mockReset();
    profileMocks.getCurrentProfile.mockReset().mockResolvedValue(profile);
    profileMocks.updateCurrentProfileDisplayName.mockReset();
    profileMocks.getProfileAvatarUrl.mockReset();
    profileMocks.uploadCurrentProfileAvatar.mockReset();
    useAuthStore.setState({
      ...initialAuthState,
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

    openProfile();
    const input = await screen.findByRole('textbox', { name: 'Pseudo public' });
    expect(input).toHaveValue('Yann');
    expect(screen.getByText('Pseudo public')).toHaveClass('fz-field-label');
    expect(screen.getByRole('button', { name: "Changer l'avatar de Yann" })).toHaveTextContent('YA');
    expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();

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
    openProfile();
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
    window.history.replaceState({}, '', '/account?tab=groupe');
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

    fireEvent.click(screen.getByRole('button', { name: 'Mon espace' }));
    expect(screen.getByRole('heading', { name: 'Mon espace' })).toBeInTheDocument();
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

    openSecurity();
    fireEvent.click(screen.getByRole('button', { name: 'Adresse e-mail' }));
    expect(screen.getByText('private@example.test')).toBeInTheDocument();
    expect(screen.getByText('Nouvelle adresse e-mail')).toHaveClass('fz-field-label');

    fireEvent.change(screen.getByRole('textbox', { name: 'Nouvelle adresse e-mail' }), {
      target: { value: 'Nouvelle@Example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Demander le changement' }));

    await waitFor(() => {
      expect(requestEmailChange).toHaveBeenCalledWith('nouvelle@example.test');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retour à la sécurité' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mot de passe' }));
    expect(screen.getByText('Mot de passe actuel')).toHaveClass('fz-field-label');
    expect(screen.getByText('Nouveau mot de passe')).toHaveClass('fz-field-label');
    expect(screen.getByText('Confirmer le nouveau mot de passe')).toHaveClass('fz-field-label');
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

    openSecurity();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le lien de suppression' }));
    const dialog = screen.getByRole('dialog', { name: 'Envoyer le lien de suppression ?' });
    expect(requestAccountDeletion).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer le lien' }));

    await waitFor(() => {
      expect(requestAccountDeletion).toHaveBeenCalledTimes(1);
    });
  });

  it("retire immédiatement de l'interface une invitation révoquée", async () => {
    window.history.replaceState({}, '', '/account?tab=groupe');
    workspaceMocks.listWorkspaceInvites.mockResolvedValue([{
      id: 'invite-to-revoke',
      role: 'member',
      createdAt: '2026-07-22T10:00:00.000Z',
      expiresAt: '2099-07-23T10:00:00.000Z',
    }]);
    workspaceMocks.revokeWorkspaceInvite.mockResolvedValue(undefined);

    render(<AccountPage />);

    openMembers();
    fireEvent.click(screen.getByRole('button', { name: 'Inviter des membres' }));
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
    window.history.replaceState({}, '', '/account?tab=groupe');
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

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un groupe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer un groupe' }));
    const input = screen.getByPlaceholderText('Nom du groupe');
    fireEvent.change(input, { target: { value: 'Nouveau Groupe Rock' } });
    fireEvent.click(screen.getByRole('button', { name: /Cr.er un nouveau groupe/i }));

    await waitFor(() => {
      expect(createWorkspace).toHaveBeenCalledWith('Nouveau Groupe Rock');
    });
    expect(input).toHaveValue('');
  });

  it('affiche la photo d’un membre de groupe ou ses initiales générées', async () => {
    window.history.replaceState({}, '', '/account?tab=groupe');
    profileMocks.getProfileAvatarUrl.mockResolvedValue('https://storage.test/avatar-member.webp');
    workspaceMocks.listWorkspaceMembersWithProfiles.mockResolvedValue([{
      id: 'membership-yann',
      workspaceId: adminWorkspace.id,
      userId: 'user-yann',
      pseudo: 'Yann',
      role: 'admin',
      avatarUrl: 'user-yann/avatar.webp',
      createdAt: '2026-07-22T10:00:00.000Z',
      updatedAt: '2026-07-22T10:00:00.000Z',
    }]);

    render(<AccountPage />);

    openMembers();
    await waitFor(() => {
      expect(profileMocks.getProfileAvatarUrl).toHaveBeenCalledWith('user-yann/avatar.webp');
      expect(document.querySelector('img[src="https://storage.test/avatar-member.webp"]')).toBeInTheDocument();
    });
  });

  it('demande une confirmation avant de retirer un membre du groupe', async () => {
    window.history.replaceState({}, '', '/account?tab=groupe');
    workspaceMocks.listWorkspaceMembersWithProfiles.mockResolvedValue([{
      id: 'membership-guest',
      workspaceId: adminWorkspace.id,
      userId: 'user-guest',
      pseudo: 'Camille',
      role: 'guest',
      createdAt: '2026-07-22T10:00:00.000Z',
      updatedAt: '2026-07-22T10:00:00.000Z',
    }]);
    workspaceMocks.removeWorkspaceMember.mockResolvedValue(undefined);

    render(<AccountPage />);

    openMembers();
    const removeButton = await screen.findByTitle('Retirer le membre');
    fireEvent.click(removeButton);

    const confirmation = screen.getByRole('dialog', { name: 'Retirer ce membre ?' });
    expect(workspaceMocks.removeWorkspaceMember).not.toHaveBeenCalled();
    expect(within(confirmation).getByText(/Camille/)).toBeInTheDocument();

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Retirer' }));

    await waitFor(() => {
      expect(workspaceMocks.removeWorkspaceMember).toHaveBeenCalledWith(adminWorkspace.id, 'user-guest');
    });
  });

  it('affiche les groupes, le compte puis les données et ouvre la synchronisation', () => {
    render(<AccountPage />);
    expect(screen.getByRole('heading', { name: 'Paramètres' })).toBeInTheDocument();
    const sections = Array.from(document.querySelectorAll('section[aria-labelledby]')).map(section => section.getAttribute('aria-labelledby'));
    expect(sections).toEqual(['settings-groups', 'settings-account', 'settings-data']);
    expect(screen.getByRole('button', { name: 'Réglages de Groupe test' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Synchronisation' }));
    expect(screen.getByText('Synchronisation Cloud')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retour aux paramètres' }));
    expect(screen.getByRole('heading', { name: 'Paramètres' })).toBeInTheDocument();
  });

  it('affiche le bouton Corbeille pour l’espace personnel', async () => {
    const personalWorkspace: Workspace = {
      id: 'ws-personal',
      name: 'Mon Espace',
      createdBy: 'user-test',
      createdAt: '2026-07-20T20:00:00.000Z',
      updatedAt: '2026-07-20T20:00:00.000Z',
      role: 'admin',
      type: 'personal',
    };

    useAuthStore.setState({
      session: userSession,
      activeWorkspace: personalWorkspace,
      workspaces: [personalWorkspace],
    });

    render(<AccountPage defaultTab="groupe" />);

    fireEvent.click(screen.getByRole('button', { name: 'Mon espace' }));
    expect(screen.getByRole('button', { name: 'Corbeille' })).toBeInTheDocument();
  });

  it('affiche un état vide et permet de rejoindre un groupe avec un lien', async () => {
    const joinWorkspaceByInvite = vi.fn().mockResolvedValue(adminWorkspace);
    useAuthStore.setState({ workspaces: [], activeWorkspace: null, joinWorkspaceByInvite });
    render(<AccountPage />);
    expect(screen.getByText('Tu n’as pas encore de groupe.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un groupe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre un groupe' }));
    fireEvent.change(screen.getByLabelText('Rejoindre un groupe avec un lien'), { target: { value: 'https://example.test/account?invite=test-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter ce groupe' }));
    await waitFor(() => expect(joinWorkspaceByInvite).toHaveBeenCalledWith('test-token'));
    expect(screen.getByText(/Groupe rejoint/)).toBeInTheDocument();
  });

  it('ouvre le groupe choisi, avec les icônes de Mon espace et de l’EPK', () => {
    const otherGroup = { ...adminWorkspace, id: 'other', name: 'Autre groupe' };
    const personal = { ...adminWorkspace, id: 'personal', type: 'personal' as const };
    useAuthStore.setState({ workspaces: [adminWorkspace, otherGroup, personal] });
    render(<AccountPage />);
    expect(screen.getByRole('button', { name: 'Mon espace' }).querySelector('[data-icon-usage="account.menu.personal"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réglages de Autre groupe' }));
    expect(useAuthStore.getState().activeWorkspace?.id).toBe('other');
    expect(screen.getByRole('heading', { name: 'Autre groupe' })).toBeInTheDocument();
    const epk = screen.getByRole('button', { name: /Kit de presse public/ });
    expect(epk.querySelector('[data-icon-usage="account.menu.epk"]')).toBeInTheDocument();
    fireEvent.click(epk);
    expect(window.location.pathname).toBe('/account/epk');
    expect(useAuthStore.getState().activeWorkspace?.id).toBe('other');
  });

  it.each(['member', 'guest'] as const)('préserve les droits du rôle %s, même via un lien direct', () => {
    const workspace = { ...adminWorkspace, role: 'member' as const };
    useAuthStore.setState({ workspaces: [workspace], activeWorkspace: workspace });
    window.history.replaceState({}, '', '/account?view=group-admin&workspace=workspace-test');
    render(<AccountPage />);
    expect(screen.getByRole('heading', { name: 'Groupe test' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Administration/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kit de presse/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Membres et invitations' }));
    expect(screen.queryByRole('button', { name: 'Inviter des membres' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitter le groupe' })).toBeInTheDocument();
  });

  it('revient à l’accueil pour un groupe inconnu ou devenu inaccessible', () => {
    window.history.replaceState({}, '', '/account?view=group-members&workspace=unknown');
    render(<AccountPage />);
    expect(screen.getByRole('heading', { name: 'Paramètres' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réglages de Groupe test' }));
    act(() => useAuthStore.setState({ workspaces: [], activeWorkspace: null }));
    expect(screen.getByRole('heading', { name: 'Paramètres' })).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('restaure une sous-vue au rechargement et suit le retour navigateur', async () => {
    window.history.replaceState({}, '', '/account?view=group-identity&workspace=workspace-test&invite=keep');
    const mounted = render(<AccountPage />);
    expect(screen.getByRole('heading', { name: 'Identité du groupe' })).toBeInTheDocument();
    mounted.unmount();
    render(<AccountPage />);
    expect(screen.getByRole('heading', { name: 'Identité du groupe' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retour au groupe' }));
    expect(screen.getByRole('heading', { name: 'Groupe test' })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('invite')).toBe('keep');
    await act(async () => {
      window.history.back();
      await new Promise(resolve => setTimeout(resolve, 25));
    });
    expect(screen.getByRole('heading', { name: 'Identité du groupe' })).toBeInTheDocument();
  });

  it.each(['/sync', '/account?tab=sync'])('conserve %s et permet le retour vers /account', (url) => {
    window.history.replaceState({}, '', url);
    render(<AccountPage defaultTab="sync" />);
    expect(screen.getByText('Synchronisation Cloud')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retour aux paramètres' }));
    expect(window.location.pathname).toBe('/account');
  });

  it('ouvre directement la récupération du mot de passe et conserve sa validation', async () => {
    const completePasswordRecovery = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ completePasswordRecovery });
    window.history.replaceState({}, '', '/account?reset-password=1&view=profile');
    render(<AccountPage />);
    expect(screen.queryByLabelText('Mot de passe actuel')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'Nouveau123' } });
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'Different123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mettre a jour le mot de passe' }));
    expect(completePasswordRecovery).not.toHaveBeenCalled();
    expect(await screen.findByText('Les mots de passe ne correspondent pas.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'Nouveau123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mettre a jour le mot de passe' }));
    await waitFor(() => expect(completePasswordRecovery).toHaveBeenCalledWith('Nouveau123'));
  });

  it('ouvre un lien de suppression sans supprimer avant confirmation', async () => {
    const deleteCurrentAccount = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ deleteCurrentAccount });
    const token = 'a'.repeat(64);
    window.history.replaceState({}, '', '/account?delete-account=' + token);
    render(<AccountPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));
    expect(deleteCurrentAccount).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Supprimer définitivement le compte ?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer définitivement' }));
    await waitFor(() => expect(deleteCurrentAccount).toHaveBeenCalledWith(token));
  });

  it('affiche une erreur Google dans l’écran Google', async () => {
    useAuthStore.setState({ linkGoogleIdentity: vi.fn().mockRejectedValue(new Error('Association impossible')) });
    render(<AccountPage />);
    openSecurity();
    fireEvent.click(screen.getByRole('button', { name: 'Connexion Google' }));
    fireEvent.click(screen.getByRole('button', { name: 'Associer Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Association impossible');
  });
});
