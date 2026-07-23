import { useState, useEffect, useRef } from 'react';
import { FormDialog } from '@/components/FormDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAuthStore } from '@/stores/authStore';
import {
  createWorkspaceInviteLink,
  canAdministerWorkspace,
  extractWorkspaceInviteToken,
  listWorkspaceInvites,
  revokeWorkspaceInvite,
  listWorkspaceMembersWithProfiles,
  setWorkspaceMemberRole,
  removeWorkspaceMember,
  leaveWorkspace,
  updateWorkspaceGroup,
  checkWorkspaceNameAvailable,
  softDeleteWorkspace,
  type Workspace,
  type WorkspaceInviteSummary,
  type WorkspaceRole,
  type WorkspaceMember,
} from '@/services/supabase/workspace';
import { useAudioCacheStore } from '@/features/audio/audioCacheStore';
import {
  getCurrentProfile,
  getGeneratedAvatar,
  getProfileAvatarUrl,
  normalizeDisplayName,
  updateCurrentProfileDisplayName,
  uploadCurrentProfileAvatar,
  type Profile,
} from '@/services/supabase/profile';
import { assertValidPassword, getPasswordRequirements } from '@/services/supabase/passwordPolicy';
import { getAccountDeletionToken } from '@/services/supabase/accountDeletion';
import { TrashModal } from '@/features/trash/TrashModal';
import { AudioQuotaBanner } from '@/features/audio/AudioQuotaBanner';

const INVITE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin: 'Administrateur',
  member: 'Membre',
  guest: 'Invité',
};

function formatInviteRemaining(expiresAt: string): string {
  const remainingMilliseconds = new Date(expiresAt).getTime() - Date.now();
  if (remainingMilliseconds <= 0) return 'Expiré';
  const remainingMinutes = Math.max(1, Math.ceil(remainingMilliseconds / 60000));
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function ShareIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 3.9" />
      <path d="M15.4 6.6L8.6 10.5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function fallbackCopyTextToClipboard(text: string) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.width = '1px';
  textArea.style.height = '1px';
  textArea.style.padding = '0';
  textArea.style.border = '0';
  textArea.style.opacity = '0';
  textArea.style.pointerEvents = 'none';

  document.body.appendChild(textArea);

  const selection = document.getSelection();
  const originalRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(textArea);

  if (selection) {
    selection.removeAllRanges();
    if (originalRange) {
      selection.addRange(originalRange);
    }
  }
  return copied;
}

export function AccountPage() {
  const {
    session,
    workspaces,
    activeWorkspace,
    loading,
    updatePassword,
    completePasswordRecovery,
    requestEmailChange,
    requestAccountDeletion,
    deleteCurrentAccount,
    createWorkspace,
    joinWorkspaceByInvite,
    signOut,
    clearFeedback,
  } = useAuthStore();

  const cachedAssetIds = useAudioCacheStore((state) => state.cachedAssetIds);
  const checkCacheStatus = useAudioCacheStore((state) => state.checkCacheStatus);
  const clearCache = useAudioCacheStore((state) => state.clearCache);
  const [isConfirmClearCacheOpen, setIsConfirmClearCacheOpen] = useState(false);
  const [isConfirmDeletionRequestOpen, setIsConfirmDeletionRequestOpen] = useState(false);
  const [isConfirmFinalDeletionOpen, setIsConfirmFinalDeletionOpen] = useState(false);
  const [localDeletionError, setLocalDeletionError] = useState<string | null>(null);
  const [accountDeletionToken] = useState(() => getAccountDeletionToken());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [localProfileError, setLocalProfileError] = useState<string | null>(null);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Group Management & Trash
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);
  const [memberRemovalLoading, setMemberRemovalLoading] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [groupNameDuplicateWarning, setGroupNameDuplicateWarning] = useState<string | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [groupActionError, setGroupActionError] = useState<string | null>(null);

  useEffect(() => {
    void checkCacheStatus();
  }, [checkCacheStatus]);

  useEffect(() => {
    if (!session?.user.id) {
      setProfile(null);
      setDisplayName('');
      return;
    }

    let active = true;
    setProfileLoading(true);
    setLocalProfileError(null);

    void getCurrentProfile()
      .then((currentProfile) => {
        if (!active) return;
        setProfile(currentProfile);
        setDisplayName(currentProfile.displayName);
      })
      .catch((profileError: unknown) => {
        if (!active) return;
        setLocalProfileError(profileError instanceof Error ? profileError.message : 'Impossible de charger le profil.');
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    let active = true;
    setAvatarUrl(null);
    if (!profile?.avatarPath) return () => { active = false; };

    void getProfileAvatarUrl(profile.avatarPath)
      .then((signedUrl) => {
        if (active) setAvatarUrl(signedUrl);
      })
      .catch((avatarError: unknown) => {
        if (active) {
          setLocalProfileError(avatarError instanceof Error ? avatarError.message : "Impossible de charger l'avatar.");
        }
      });

    return () => { active = false; };
  }, [profile?.avatarPath]);

  // Load workspace members
  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.type !== 'group') {
      setMembers([]);
      return;
    }

    let active = true;
    setMembersLoading(true);
    setEditingGroupName(activeWorkspace.name);

    void listWorkspaceMembersWithProfiles(activeWorkspace.id)
      .then((data) => {
        if (active) setMembers(data);
      })
      .catch((membersError: unknown) => {
        if (active) {
          setMembers([]);
          setGroupActionError(membersError instanceof Error ? membersError.message : 'Impossible de charger les membres du groupe.');
        }
      })
      .finally(() => {
        if (active) setMembersLoading(false);
      });

    return () => { active = false; };
  }, [activeWorkspace?.id]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [localEmailError, setLocalEmailError] = useState<string | null>(null);
  const [isPasswordRecovery] = useState(() => new URLSearchParams(window.location.search).get('reset-password') === '1');
  const [workspaceName, setWorkspaceName] = useState('');
  const [localPasswordError, setLocalPasswordError] = useState<string | null>(null);
  const [localWorkspaceError, setLocalWorkspaceError] = useState<string | null>(null);
  const [shareWorkspace, setShareWorkspace] = useState<Workspace | null>(null);
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [activeInvites, setActiveInvites] = useState<WorkspaceInviteSummary[]>([]);
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [inviteToRevoke, setInviteToRevoke] = useState<WorkspaceInviteSummary | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [joinInviteValue, setJoinInviteValue] = useState('');
  const [joinInviteFeedback, setJoinInviteFeedback] = useState<string | null>(null);
  const [joinInviteLoading, setJoinInviteLoading] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (profileLoading) return;
    setLocalProfileError(null);
    setProfileFeedback(null);
    try {
      const normalizedDisplayName = normalizeDisplayName(displayName);
      setProfileLoading(true);
      const updatedProfile = await updateCurrentProfileDisplayName(normalizedDisplayName);
      setProfile(updatedProfile);
      setDisplayName(updatedProfile.displayName);
      setProfileFeedback('Pseudo mis à jour.');
    } catch (profileError) {
      setLocalProfileError(profileError instanceof Error ? profileError.message : 'Impossible de modifier le profil.');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || profileLoading) return;
    setLocalProfileError(null);
    setProfileFeedback(null);
    setProfileLoading(true);
    try {
      const updatedProfile = await uploadCurrentProfileAvatar(file);
      setProfile(updatedProfile);
      setProfileFeedback('Avatar mis à jour.');
    } catch (avatarError) {
      setLocalProfileError(avatarError instanceof Error ? avatarError.message : "Impossible de modifier l'avatar.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function copyTextToClipboard(text: string) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        setInviteFeedback("Lien d'invitation copié dans le presse-papiers.");
        return true;
      } catch {}
    }
    const copied = fallbackCopyTextToClipboard(text);
    if (copied) {
      setInviteFeedback("Lien d'invitation copié dans le presse-papiers.");
      return true;
    }
    setInviteFeedback('Copie automatique indisponible ici. Maintenez le doigt ou faites un clic droit pour copier le lien.');
    return false;
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLocalPasswordError(null);
    clearFeedback();
    try {
      assertValidPassword(newPassword);
      if (newPassword !== confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas.');
      }
      if (isPasswordRecovery) {
        await completePasswordRecovery(newPassword);
        window.history.replaceState({}, '', '/');
      } else {
        if (!currentPassword) throw new Error('Saisissez votre mot de passe actuel.');
        await updatePassword(currentPassword, newPassword);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (passwordError) {
      setLocalPasswordError(passwordError instanceof Error ? passwordError.message : 'Impossible de modifier le mot de passe.');
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail === session?.user.email?.toLowerCase()) {
      setLocalEmailError('Saisissez une nouvelle adresse e-mail.');
      return;
    }
    setLocalEmailError(null);
    clearFeedback();
    try {
      await requestEmailChange(normalizedEmail);
      setNewEmail('');
    } catch (emailError) {
      setLocalEmailError(emailError instanceof Error ? emailError.message : 'Impossible de demander ce changement.');
    }
  }

  async function handleAccountDeletionRequest() {
    setLocalDeletionError(null);
    clearFeedback();
    try {
      await requestAccountDeletion();
      setIsConfirmDeletionRequestOpen(false);
    } catch (deletionError) {
      setLocalDeletionError(deletionError instanceof Error ? deletionError.message : 'Impossible de demander la suppression.');
      setIsConfirmDeletionRequestOpen(false);
    }
  }

  async function handleFinalAccountDeletion() {
    if (!accountDeletionToken) return;
    setLocalDeletionError(null);
    clearFeedback();
    try {
      await deleteCurrentAccount(accountDeletionToken);
      window.history.replaceState({}, '', '/');
    } catch (deletionError) {
      setLocalDeletionError(deletionError instanceof Error ? deletionError.message : 'Impossible de supprimer le compte.');
      setIsConfirmFinalDeletionOpen(false);
    }
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const normalizedName = workspaceName.trim();
    if (!normalizedName) {
      setLocalWorkspaceError('Donnez un nom à votre groupe.');
      return;
    }
    setLocalWorkspaceError(null);
    clearFeedback();
    try {
      if (navigator.onLine) {
        const isAvailable = await checkWorkspaceNameAvailable(normalizedName);
        if (!isAvailable) {
          setLocalWorkspaceError('Un groupe portant ce nom existe d�j�.');
          return;
        }
      }
      await createWorkspace(normalizedName);
      setWorkspaceName('');
    } catch (err: any) {
      setLocalWorkspaceError(err.message || 'Echec de création de groupe.');
    }
  }

  async function handleUpdateGroupName() {
    if (!activeWorkspace) return;
    setGroupActionError(null);
    try {
      const isAvailable = await checkWorkspaceNameAvailable(editingGroupName, activeWorkspace.id);
      if (!isAvailable) {
        setGroupNameDuplicateWarning('Ce nom de groupe est déjà utilisé.');
      } else {
        setGroupNameDuplicateWarning(null);
      }
      await updateWorkspaceGroup(activeWorkspace.id, { name: editingGroupName });
    } catch (err: any) {
      setGroupActionError(err.message || 'Echec de mise à jour du nom.');
    }
  }

  async function handleMemberRoleChange(userId: string, newRole: WorkspaceRole) {
    if (!activeWorkspace) return;
    setGroupActionError(null);
    try {
      await setWorkspaceMemberRole(activeWorkspace.id, userId, newRole);
      const updatedMembers = await listWorkspaceMembersWithProfiles(activeWorkspace.id);
      setMembers(updatedMembers);
    } catch (err: any) {
      setGroupActionError(err.message || 'Modification du rôle impossible.');
    }
  }

  async function handleRemoveMember(userId: string): Promise<boolean> {
    if (!activeWorkspace) return false;
    setGroupActionError(null);
    try {
      await removeWorkspaceMember(activeWorkspace.id, userId);
      const updatedMembers = await listWorkspaceMembersWithProfiles(activeWorkspace.id);
      setMembers(updatedMembers);
      return true;
    } catch (err: any) {
      setGroupActionError(err.message || 'Impossible de retirer ce membre.');
      return false;
    }
  }

  async function handleLeaveGroup() {
    if (!activeWorkspace) return;
    setGroupActionError(null);
    try {
      await leaveWorkspace(activeWorkspace.id);
    } catch (err: any) {
      setGroupActionError(err.message || 'Impossible de quitter le groupe.');
    }
  }

  async function handleSoftDeleteGroup() {
    if (!activeWorkspace) return;
    setGroupActionError(null);
    try {
      await softDeleteWorkspace(activeWorkspace.id);
    } catch (err: any) {
      setGroupActionError(err.message || 'Impossible de supprimer ce groupe.');
    }
  }

  async function loadActiveInvites(workspace: Workspace) {
    const invites = await listWorkspaceInvites(workspace.id);
    setActiveInvites(invites);
  }

  async function generateInviteLink(workspace: Workspace, role: WorkspaceRole) {
    setInviteLoading(true);
    setInviteFeedback(null);
    try {
      const invite = await createWorkspaceInviteLink(workspace.id, role);
      setInviteLinks((currentLinks) => ({ ...currentLinks, [invite.id]: invite.url }));
      await loadActiveInvites(workspace);
      await copyTextToClipboard(invite.url);
      return invite;
    } catch (error) {
      setInviteFeedback(error instanceof Error ? error.message : "Impossible de générer un lien d'invitation.");
      return null;
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleOpenShareDialog(workspace: Workspace) {
    if (!canAdministerWorkspace(workspace.role)) return;
    setShareWorkspace(workspace);
    setInviteRole('member');
    setActiveInvites([]);
    setInviteLinks({});
    setInviteFeedback(null);
    setInviteLoading(true);
    try {
      await loadActiveInvites(workspace);
    } catch (error) {
      setInviteFeedback(error instanceof Error ? error.message : 'Impossible de charger les invitations.');
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleCopyInviteLink(inviteId: string) {
    const inviteLink = inviteLinks[inviteId];
    if (!inviteLink) {
      setInviteFeedback('Ce secret n’est plus disponible. Créez un nouveau lien pour pouvoir le copier.');
      return;
    }
    await copyTextToClipboard(inviteLink);
  }

  function handleCloseShareDialog() {
    setShareWorkspace(null);
    setActiveInvites([]);
    setInviteLinks({});
    setInviteToRevoke(null);
    setInviteFeedback(null);
    setInviteLoading(false);
  }

  async function handleJoinWorkspaceWithLink(e: React.FormEvent) {
    e.preventDefault();
    if (joinInviteLoading || loading) return;
    const inviteToken = extractWorkspaceInviteToken(joinInviteValue);
    if (!inviteToken) {
      setJoinInviteFeedback("Collez un lien d'invitation valide.");
      return;
    }
    setJoinInviteLoading(true);
    setJoinInviteFeedback(null);
    clearFeedback();
    try {
      const previousActiveWorkspace = activeWorkspace;
      const workspace = await joinWorkspaceByInvite(inviteToken);
      setJoinInviteValue('');
      setJoinInviteFeedback(
        previousActiveWorkspace && previousActiveWorkspace.id !== workspace.id
          ? `Groupe ajouté: ${workspace.name}. Groupe actif conservé: ${previousActiveWorkspace.name}.`
          : `Groupe rejoint: ${workspace.name}.`
      );
    } catch (error) {
      setJoinInviteFeedback(error instanceof Error ? error.message : 'Impossible de rejoindre ce groupe.');
    } finally {
      setJoinInviteLoading(false);
    }
  }

  const generatedAvatar = profile
    ? getGeneratedAvatar(profile.displayName, profile.id)
    : null;
  const groupCount = workspaces.filter((workspace) => workspace.type === 'group').length;
  const newPasswordRequirements = getPasswordRequirements(newPassword);

  return (
    <div className="space-y-4">
      {/* Account Profile Section */}
      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
        <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--fz-accent)]">Compte</p>
        <h1 className="mt-2 text-[1.45rem] font-black uppercase tracking-[0.18em] text-white">Espace personnel</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fz-text-muted)]">
          Gère ton accès, choisis ton groupe actif et crée de nouveaux espaces de travail.
        </p>

        {localProfileError && <p className="mt-2 text-xs text-red-400">{localProfileError}</p>}

        <form onSubmit={handleProfileSubmit} className="mt-4 rounded-[1.2rem] border border-white/8 bg-black/20 p-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={profile ? `Changer l'avatar de ${profile.displayName}` : 'Changer l’avatar du profil'}
              title="Changer la photo de profil"
              onClick={() => avatarInputRef.current?.click()}
              disabled={profileLoading || !profile}
              className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 text-lg font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition hover:border-orange-400/70 focus:outline-none focus:ring-2 focus:ring-orange-400/60 disabled:opacity-45"
              style={{ backgroundColor: `hsl(${generatedAvatar?.hue ?? 24} 72% 42%)` }}
            >
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : generatedAvatar?.initials ?? '…'}
              <span className="absolute inset-x-0 bottom-0 bg-black/65 py-0.5 text-[0.5rem] uppercase tracking-wide">Photo</span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void handleAvatarChange(event)}
              className="sr-only"
              aria-label="Choisir une photo de profil"
              disabled={profileLoading || !profile}
            />
            <div className="min-w-0 flex-1">
              <label htmlFor="profileDisplayName" className="block text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">
                Pseudo public
              </label>
              <input
                id="profileDisplayName"
                type="text"
                minLength={2}
                maxLength={30}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                disabled={profileLoading || !profile}
                className="mt-2 w-full rounded-[0.9rem] border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white focus:border-orange-500/50 focus:bg-white/10 focus:outline-none disabled:opacity-45"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={profileLoading || !profile || displayName.trim() === profile.displayName}
            className="mt-3 w-full rounded-[0.9rem] border border-orange-500/25 bg-orange-500/12 px-4 py-2.5 text-[0.68rem] font-black uppercase tracking-[0.18em] text-orange-200 transition hover:bg-orange-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
          >
            {profileLoading ? 'Enregistrement...' : 'Enregistrer le pseudo'}
          </button>
          {profileFeedback ? <p className="mt-2 text-[0.75rem] text-emerald-300">{profileFeedback}</p> : null}
        </form>

        {session?.user.email && (
          <div className="mt-4 rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">E-mail privé — visible uniquement ici</p>
            <p className="mt-1 text-sm font-semibold text-white">{session.user.email}</p>
          </div>
        )}
      </section>

      {/* Active Workspace & Group Admin Section */}
      {activeWorkspace && (
        <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--fz-accent)]">Espace actif</p>
              <h1 className="mt-1 text-xl font-black uppercase tracking-[0.16em] text-white">{activeWorkspace.name}</h1>
              {activeWorkspace.type === 'personal' && (
                <p className="mt-1 text-xs text-white/50">Accueil personnel actif</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canAdministerWorkspace(activeWorkspace.role) && activeWorkspace.type === 'group' && (
                <button
                  type="button"
                  aria-label={`Partager le groupe ${activeWorkspace.name}`}
                  onClick={() => void handleOpenShareDialog(activeWorkspace)}
                  className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-300 hover:bg-orange-500/20 transition"
                >
                  <ShareIcon />
                  Partager
                </button>
              )}
              <button
                onClick={() => setIsTrashOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Corbeille
              </button>
            </div>
          </div>

          <div className="mt-4">
            <AudioQuotaBanner workspace={activeWorkspace} isOnline={true} />
          </div>

          {/* Group Administration Section */}
          {activeWorkspace.type === 'group' && (
            <div className="mt-6 space-y-4 border-t border-white/10 pt-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Administration du groupe</h2>

              {groupActionError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  {groupActionError}
                </div>
              )}

              {/* Group Name Editing */}
              {canAdministerWorkspace(activeWorkspace.role) && (
                <div className="rounded-xl border border-white/8 bg-black/20 p-4 space-y-3">
                  <label className="block text-[0.64rem] font-black uppercase tracking-[0.18em] text-white/50">
                    Nom du groupe
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingGroupName}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none"
                    />
                    <button
                      onClick={handleUpdateGroupName}
                      className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-400"
                    >
                      Enregistrer
                    </button>
                  </div>
                  {groupNameDuplicateWarning && (
                    <p className="text-xs text-amber-400">{groupNameDuplicateWarning}</p>
                  )}
                </div>
              )}

              {/* Member list sorted by role: Admin > Member > Guest */}
              <div className="space-y-2">
                <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-white/50">Membres du groupe ({members.length})</p>
                {membersLoading ? (
                  <p className="text-xs text-white/40">Chargement des membres...</p>
                ) : (
                  members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-white">
                          {m.pseudo?.charAt(0).toUpperCase() || 'M'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{m.pseudo}</p>
                          <span className="text-[10px] uppercase font-bold text-amber-400/90">{INVITE_ROLE_LABELS[m.role]}</span>
                        </div>
                      </div>

                      {canAdministerWorkspace(activeWorkspace.role) && (
                        <div className="flex items-center gap-2">
                          <select
                            value={m.role}
                            onChange={(e) => handleMemberRoleChange(m.userId, e.target.value as WorkspaceRole)}
                            className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-white"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Membre</option>
                            <option value="guest">Invité</option>
                          </select>
                          <button
                            onClick={() => setMemberToRemove(m)}
                            className="rounded-lg p-1 text-red-400 hover:bg-red-500/20"
                            title="Retirer le membre"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="8.5" cy="7" r="4" />
                              <line x1="18" y1="8" x2="23" y2="13" />
                              <line x1="23" y1="8" x2="18" y2="13" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Group actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleLeaveGroup}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white/70 hover:bg-white/10"
                >
                  Quitter le groupe
                </button>
                {canAdministerWorkspace(activeWorkspace.role) && (
                  <button
                    onClick={handleSoftDeleteGroup}
                    className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/20"
                  >
                    Placer le groupe en corbeille
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Workspaces Creation & Join Section */}
      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
        <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--fz-accent)]">Espaces de travail</p>
        <p className="mt-1 text-xs text-white/50">{groupCount} groupe{groupCount > 1 ? 's' : ''}</p>
        <h2 className="mt-2 text-lg font-black uppercase tracking-[0.16em] text-white">Créer un nouveau groupe</h2>
        <form onSubmit={handleCreateWorkspace} className="mt-4 space-y-3">
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Nom du groupe"
            disabled={loading}
            className="w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none"
          />
          {localWorkspaceError && <p className="text-xs text-red-400">{localWorkspaceError}</p>}
          <button
            type="submit"
            disabled={loading || !workspaceName.trim()}
            className="w-full rounded-[1rem] bg-white px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-[#0c0d10] hover:bg-orange-500 hover:text-white disabled:bg-white/10 disabled:text-white/35"
          >
            {loading ? 'Création...' : 'Créer un nouveau groupe'}
          </button>
        </form>

        <form onSubmit={handleJoinWorkspaceWithLink} className="mt-5 space-y-3 rounded-[1.2rem] border border-white/8 bg-black/15 p-4">
          <div>
            <label htmlFor="workspaceInviteLink" className="block text-[0.66rem] font-black uppercase tracking-[0.18em] text-white/55">
              Rejoindre un groupe avec un lien
            </label>
            <input
              id="workspaceInviteLink"
              type="text"
              value={joinInviteValue}
              onChange={(e) => setJoinInviteValue(e.target.value)}
              placeholder="Collez ici un lien d'invitation"
              disabled={loading || joinInviteLoading}
              className="mt-2 w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 focus:border-orange-500/50 focus:bg-white/10 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || joinInviteLoading || !joinInviteValue.trim()}
            className="w-full rounded-[1rem] border border-orange-500/25 bg-orange-500/12 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-orange-200 transition hover:bg-orange-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35"
          >
            {joinInviteLoading ? 'Connexion...' : 'Ajouter ce groupe'}
          </button>
          {joinInviteFeedback ? (
            <p className="text-[0.75rem] text-white/70">{joinInviteFeedback}</p>
          ) : null}
        </form>
      </section>

      {/* Identity / Email Change Section */}
      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
        <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--fz-accent)]">Identité</p>
        <h2 className="mt-2 text-lg font-black uppercase tracking-[0.16em] text-white">Changer d’adresse e-mail</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fz-text-muted)]">
          Le changement sera effectif uniquement après confirmation depuis l’ancienne et la nouvelle adresse.
        </p>
        {localEmailError && <p className="mt-2 text-xs text-red-400">{localEmailError}</p>}
        <form onSubmit={handleEmailSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="newEmail" className="block text-[0.66rem] font-black uppercase tracking-[0.18em] text-white/55">
              Nouvelle adresse e-mail
            </label>
            <input
              id="newEmail"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="nouvelle@adresse.fr"
              disabled={loading}
              className="mt-2 w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 focus:border-orange-500/50 focus:bg-white/10 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !newEmail.trim()}
            className="w-full rounded-[1rem] border border-orange-500/25 bg-orange-500/12 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-orange-200 transition hover:bg-orange-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35"
          >
            {loading ? 'Demande...' : 'Demander le changement'}
          </button>
        </form>
      </section>

      {/* Security / Password Change Section */}
      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
        <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--fz-accent)]">Sécurité</p>
        <h2 className="mt-2 text-lg font-black uppercase tracking-[0.16em] text-white">
          {isPasswordRecovery ? 'Définir un nouveau mot de passe' : 'Changer de mot de passe'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fz-text-muted)]">
          Toutes les sessions seront révoquées après la modification.
        </p>
        {localPasswordError && <p className="mt-2 text-xs text-red-400">{localPasswordError}</p>}
        <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
          {!isPasswordRecovery ? (
            <div>
              <label htmlFor="currentPassword" className="block text-[0.66rem] font-black uppercase tracking-[0.18em] text-white/55">
                Mot de passe actuel
              </label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={loading}
                className="mt-2 w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-orange-500/50 focus:bg-white/10 focus:outline-none"
              />
            </div>
          ) : null}
          <div>
            <label htmlFor="newPassword" className="block text-[0.66rem] font-black uppercase tracking-[0.18em] text-white/55">
              Nouveau mot de passe
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Au moins 8 caractères"
              disabled={loading}
              className="mt-2 w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 focus:border-orange-500/50 focus:bg-white/10 focus:outline-none"
            />
          </div>
          <ul className="grid grid-cols-2 gap-2 text-[0.68rem]" aria-label="Règles du nouveau mot de passe">
            {[
              ['8 caractères', newPasswordRequirements.minimumLength],
              ['Une majuscule', newPasswordRequirements.uppercase],
              ['Une minuscule', newPasswordRequirements.lowercase],
              ['Un chiffre', newPasswordRequirements.digit],
            ].map(([label, valid]) => (
              <li key={String(label)} className={valid ? 'text-emerald-300' : 'text-white/40'}>
                {valid ? '✓' : '○'} {label}
              </li>
            ))}
          </ul>
          <div>
            <label htmlFor="confirmNewPassword" className="block text-[0.66rem] font-black uppercase tracking-[0.18em] text-white/55">
              Confirmer le nouveau mot de passe
            </label>
            <input
              id="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Retapez le mot de passe"
              disabled={loading}
              className="mt-2 w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 focus:border-orange-500/50 focus:bg-white/10 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || (!isPasswordRecovery && !currentPassword) || !newPassword || !confirmPassword}
            className="w-full rounded-[1rem] border border-orange-500/25 bg-orange-500/12 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-orange-200 transition hover:bg-orange-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35"
          >
            {loading ? 'Mise à jour...' : 'Mettre a jour le mot de passe'}
          </button>
        </form>
      </section>

      {/* Sign Out Section */}
      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
        <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--fz-accent)]">Session</p>
        <h2 className="mt-2 text-lg font-black uppercase tracking-[0.16em] text-white">Déconnexion</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fz-text-muted)]">
          Ferme ta session sur cet appareil. Tes données locales et morceaux en cache restent conservés.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={loading}
          className="mt-4 w-full rounded-[1rem] border border-white/15 bg-white/5 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-white transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
        >
          Se déconnecter
        </button>
      </section>

      {/* Account Deletion Section */}
      <section className="rounded-[1.6rem] border border-red-500/20 bg-red-500/[0.055] p-5">
        <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-red-300">Zone sensible</p>
        <h2 className="mt-2 text-lg font-black uppercase tracking-[0.16em] text-white">Supprimer le compte</h2>
        {localDeletionError && <p className="mt-2 text-xs text-red-400">{localDeletionError}</p>}
        {accountDeletionToken ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-red-100/75">
              Le lien e-mail a été ouvert. La confirmation finale supprimera Mon espace et votre identité, mais conservera les groupes partagés.
            </p>
            <button
              type="button"
              onClick={() => setIsConfirmFinalDeletionOpen(true)}
              disabled={loading}
              className="mt-4 w-full rounded-[1rem] border border-red-400/35 bg-red-500/18 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-red-100 transition hover:bg-red-500/28 disabled:opacity-40"
            >
              Supprimer définitivement
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fz-text-muted)]">
              La demande est impossible si vous êtes le dernier administrateur d’un groupe. Un lien valable une heure sera envoyé par e-mail.
            </p>
            <button
              type="button"
              onClick={() => setIsConfirmDeletionRequestOpen(true)}
              disabled={loading}
              className="mt-4 w-full rounded-[1rem] border border-red-500/25 bg-red-500/10 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-red-200 transition hover:bg-red-500/18 disabled:opacity-40"
            >
              Envoyer le lien de suppression
            </button>
          </>
        )}
      </section>

      {/* Share Dialog */}
      {shareWorkspace ? (
        <FormDialog title={`Inviter dans ${shareWorkspace.name}`} onClose={handleCloseShareDialog}>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--fz-text-muted)]">
              Les liens expirent après 24 heures et ne peuvent être utilisés qu’une fois.
            </p>

            <div className="rounded-[1.2rem] border border-orange-500/18 bg-orange-500/8 p-4">
              <label htmlFor="inviteRole" className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-orange-200/80">
                Rôle attribué
              </label>
              <div className="mt-3 flex gap-2">
                <select
                  id="inviteRole"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}
                  disabled={inviteLoading}
                  className="min-w-0 flex-1 rounded-[1rem] border border-white/10 bg-[#18191d] px-4 py-3 text-sm text-white focus:border-orange-500/50 focus:outline-none"
                >
                  <option value="admin">Administrateur</option>
                  <option value="member">Membre</option>
                  <option value="guest">Invité</option>
                </select>
                <button
                  type="button"
                  onClick={() => void generateInviteLink(shareWorkspace, inviteRole)}
                  disabled={inviteLoading}
                  className="rounded-[1rem] bg-orange-500 px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white transition hover:bg-orange-400 disabled:opacity-40"
                >
                  {inviteLoading ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-white/50">Liens actifs</p>
              {activeInvites.length === 0 && !inviteLoading ? (
                <p className="rounded-[1rem] border border-dashed border-white/10 p-4 text-sm text-white/45">Aucun lien actif.</p>
              ) : null}
              {activeInvites.map((invite) => (
                <div key={invite.id} className="rounded-[1rem] border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{INVITE_ROLE_LABELS[invite.role]}</p>
                      <p className="mt-1 text-[0.68rem] text-white/45">Expire dans {formatInviteRemaining(invite.expiresAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyInviteLink(invite.id)}
                        aria-label="Copier le lien"
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70"
                      >
                        <CopyIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteToRevoke(invite)}
                        className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-[0.65rem] font-black uppercase text-red-200"
                      >
                        Révoquer
                      </button>
                    </div>
                  </div>
                  {!inviteLinks[invite.id] ? (
                    <p className="mt-2 text-[0.66rem] text-white/35">Secret non conservé : créez un nouveau lien pour le copier.</p>
                  ) : null}
                </div>
              ))}
            </div>

            {inviteFeedback ? <p className="text-[0.75rem] text-white/70">{inviteFeedback}</p> : null}

            <button
              type="button"
              onClick={handleCloseShareDialog}
              className="w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/8 hover:text-white"
            >
              Fermer
            </button>
          </div>
        </FormDialog>
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(memberToRemove)}
        title="Retirer ce membre ?"
        description={`Voulez-vous vraiment retirer ${memberToRemove?.pseudo || 'ce membre'} du groupe ? Cette personne perdra immédiatement l'accès au contenu partagé.`}
        confirmLabel="Retirer"
        isBusy={memberRemovalLoading}
        onCancel={() => setMemberToRemove(null)}
        onConfirm={async () => {
          if (!memberToRemove) return;
          setMemberRemovalLoading(true);
          try {
            const removed = await handleRemoveMember(memberToRemove.userId);
            if (removed) setMemberToRemove(null);
          } finally {
            setMemberRemovalLoading(false);
          }
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(inviteToRevoke)}
        title="Révoquer ce lien ?"
        description="Le lien cessera immédiatement de fonctionner. Les autres invitations et les membres existants seront conservés."
        confirmLabel="Révoquer"
        isBusy={inviteLoading}
        onCancel={() => setInviteToRevoke(null)}
        onConfirm={async () => {
          if (!inviteToRevoke || !shareWorkspace) return;
          const revokedInviteId = inviteToRevoke.id;
          setInviteLoading(true);
          try {
            await revokeWorkspaceInvite(revokedInviteId);
            setActiveInvites((currentInvites) => currentInvites.filter((invite) => invite.id !== revokedInviteId));
            setInviteLinks((currentLinks) => {
              const nextLinks = { ...currentLinks };
              delete nextLinks[revokedInviteId];
              return nextLinks;
            });
            setInviteToRevoke(null);
            setInviteFeedback('Invitation révoquée.');
          } catch (error) {
            setInviteFeedback(error instanceof Error ? error.message : 'Impossible de révoquer cette invitation.');
          } finally {
            setInviteLoading(false);
          }
        }}
      />

      <ConfirmDialog
        isOpen={isConfirmDeletionRequestOpen}
        title="Envoyer le lien de suppression ?"
        description="Aucune donnée ne sera supprimée maintenant. Vous devrez ouvrir le lien reçu par e-mail puis confirmer une dernière fois."
        confirmLabel="Envoyer le lien"
        isBusy={loading}
        onCancel={() => setIsConfirmDeletionRequestOpen(false)}
        onConfirm={handleAccountDeletionRequest}
      />

      <ConfirmDialog
        isOpen={isConfirmFinalDeletionOpen}
        title="Supprimer définitivement le compte ?"
        description="Cette action est irréversible : Mon espace et son contenu seront supprimés. Les groupes partagés et leurs contenus seront conservés."
        confirmLabel="Supprimer définitivement"
        isBusy={loading}
        onCancel={() => setIsConfirmFinalDeletionOpen(false)}
        onConfirm={handleFinalAccountDeletion}
      />

      <ConfirmDialog
        isOpen={isConfirmClearCacheOpen}
        title="Vider le cache audio ?"
        description={`Voulez-vous vraiment supprimer les ${cachedAssetIds.size} morceaux cachés sur cet appareil ? Vous devrez les télécharger à nouveau pour les écouter hors ligne.`}
        confirmLabel="Vider le cache"
        isBusy={false}
        onCancel={() => setIsConfirmClearCacheOpen(false)}
        onConfirm={async () => {
          await clearCache();
          setIsConfirmClearCacheOpen(false);
        }}
      />

      {/* Trash Modal */}
      {activeWorkspace && (
        <TrashModal
          workspaceId={activeWorkspace.id}
          isOpen={isTrashOpen}
          onClose={() => setIsTrashOpen(false)}
        />
      )}
    </div>
  );
}
