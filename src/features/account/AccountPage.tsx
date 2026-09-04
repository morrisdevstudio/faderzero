import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/ui/components/Button';
import { ContentRow } from '@/ui/components/ContentRow';
import { PageHeader } from '@/ui/components/PageHeader';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { StatusPill } from '@/ui/components/StatusPill';
import { readSettingsView, settingsParent, settingsTitles, settingsUrl, type SettingsTab, type SettingsView } from './settingsNavigation';
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
import { hasGoogleIdentity } from '@/services/supabase/auth';
import { TrashModal } from '@/features/trash/TrashModal';
import { AudioQuotaBanner } from '@/features/audio/AudioQuotaBanner';
import { SyncTab } from '@/features/sync/SyncTab';
import { useWorkspaceBadgeColors, WORKSPACE_COLOR_OPTIONS } from '@/services/workspaceColors';
import { isAppOnline } from '@/services/connectivity';
import { PasswordField } from '@/ui/components/PasswordField';
import { SelectField } from '@/ui/components/SelectField';
import { TextField } from '@/ui/components/TextField';
import { FzIcon } from '@/ui/icons';

const INVITE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin: 'Administrateur',
  member: 'Membre',
  guest: 'Invité',
};

function getWorkspaceInitials(name?: string): string {
  if (!name) return 'ME';
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed.toUpperCase();
  const words = trimmed.split(/\s+/);
  const [firstWord = '', secondWord = ''] = words;
  if (firstWord && secondWord) {
    return (firstWord.charAt(0) + secondWord.charAt(0)).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function MemberAvatar({ member }: { member: WorkspaceMember }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const generated = getGeneratedAvatar(member.pseudo || 'Membre', member.userId);

  useEffect(() => {
    let active = true;
    setAvatarUrl(null);
    setAvatarError(false);
    if (!member.avatarUrl) return () => { active = false; };

    void getProfileAvatarUrl(member.avatarUrl)
      .then((url) => {
        if (active && url) {
          setAvatarUrl(url);
          setAvatarError(false);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [member.avatarUrl]);

  return (
    <div
      className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 text-xs font-bold text-white shadow-sm"
      style={{ backgroundColor: `hsl(${generated.hue} 72% 42%)` }}
    >
      {avatarUrl && !avatarError ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setAvatarError(true)}
        />
      ) : (
        generated.initials
      )}
    </div>
  );
}

function WorkspaceMemberList({
  workspace,
  canAdmin,
  onMemberRoleChange,
  onRemoveMember,
}: {
  workspace: Workspace;
  canAdmin: boolean;
  onMemberRoleChange: (userId: string, newRole: WorkspaceRole) => void;
  onRemoveMember: (member: WorkspaceMember) => void;
}) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listWorkspaceMembersWithProfiles(workspace.id)
      .then((data) => {
        if (active) setMembers(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error && err.message.includes('NetworkError')
              ? 'Indisponible hors-ligne'
              : 'Impossible de charger les membres'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace.id]);

  if (loading) {
    return <p className="text-xs text-white/40">Chargement des membres...</p>;
  }

  if (error) {
    return <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">{error}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/50">
        Membres du groupe ({members.length})
      </p>
      {members.map((m) => (
        <div key={m.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 p-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <MemberAvatar member={m} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{m.pseudo}</p>
              <span className="text-[9px] uppercase font-bold text-amber-400/90">{INVITE_ROLE_LABELS[m.role]}</span>
            </div>
          </div>
          {canAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-28">
                <SelectField
                  aria-label={`Rôle de ${m.pseudo}`}
                  value={m.role}
                  onChange={(e) => onMemberRoleChange(m.userId, e.target.value as WorkspaceRole)}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Membre</option>
                  <option value="guest">Invité</option>
                </SelectField>
              </div>
              <button
                type="button"
                onClick={() => onRemoveMember(m)}
                className="rounded-lg p-1 text-red-400 hover:bg-red-500/20"
                title="Retirer le membre"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="18" y1="8" x2="23" y2="13" />
                  <line x1="23" y1="8" x2="18" y2="13" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function formatInviteRemaining(expiresAt: string): string {
  const remainingMilliseconds = new Date(expiresAt).getTime() - Date.now();
  if (remainingMilliseconds <= 0) return 'Expiré';
  const remainingMinutes = Math.max(1, Math.ceil(remainingMilliseconds / 60000));
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
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

interface AccountPageProps {
  defaultTab?: SettingsTab;
}

export function AccountPage({ defaultTab }: AccountPageProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const accountDeletionToken = getAccountDeletionToken(location.search);
  const requestedView = readSettingsView(location.search, defaultTab, Boolean(accountDeletionToken));

  const {
    session,
    workspaces,
    activeWorkspace,
    loading,
    linkGoogleIdentity,
    updatePassword,
    completePasswordRecovery,
    requestEmailChange,
    requestAccountDeletion,
    deleteCurrentAccount,
    createWorkspace,
    joinWorkspaceByInvite,
    setActiveWorkspace,
    signOut,
    clearFeedback,
  } = useAuthStore();

  const { getBadgeColor, setBadgeColor, getBadgeText, setBadgeText } = useWorkspaceBadgeColors();

  const workspaceId = new URLSearchParams(location.search).get('workspace');
  const selectedWorkspace = workspaces.find((ws) => ws.id === workspaceId);
  const needsGroup = requestedView === 'group' || requestedView.startsWith('group-');
  const needsPersonal = requestedView === 'personal';
  const workspaceMissing = (needsGroup && selectedWorkspace?.type !== 'group') || (needsPersonal && selectedWorkspace?.type !== 'personal');
  const view: SettingsView = workspaceMissing ? 'home'
    : requestedView === 'group-admin' && selectedWorkspace && !canAdministerWorkspace(selectedWorkspace.role) ? 'group'
    : requestedView;
  const openView = (next: SettingsView, id?: string) => navigate(settingsUrl(next, location.search, id));

  useEffect(() => {
    if (loading) return;
    if (view !== requestedView) {
      navigate(settingsUrl(view, location.search, selectedWorkspace?.id), { replace: true });
      return;
    }
    if ((needsGroup || needsPersonal) && selectedWorkspace && selectedWorkspace.id !== activeWorkspace?.id) {
      clearFeedback();
      setActiveWorkspace(selectedWorkspace);
    }
  }, [view, requestedView, loading, location.search, navigate, selectedWorkspace, activeWorkspace?.id, needsGroup, needsPersonal, clearFeedback, setActiveWorkspace]);


  const cachedAssetIds = useAudioCacheStore((state) => state.cachedAssetIds);
  const checkCacheStatus = useAudioCacheStore((state) => state.checkCacheStatus);
  const clearCache = useAudioCacheStore((state) => state.clearCache);
  const [isConfirmClearCacheOpen, setIsConfirmClearCacheOpen] = useState(false);
  const [isConfirmDeletionRequestOpen, setIsConfirmDeletionRequestOpen] = useState(false);
  const [isConfirmFinalDeletionOpen, setIsConfirmFinalDeletionOpen] = useState(false);
  const [localDeletionError, setLocalDeletionError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [localProfileError, setLocalProfileError] = useState<string | null>(null);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Group Management & Trash
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ member: WorkspaceMember; workspaceId: string } | null>(null);
  const [memberRemovalLoading, setMemberRemovalLoading] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingBadgeText, setEditingBadgeText] = useState<{
    workspaceId: string;
    value: string;
    previousValue: string;
  } | null>(null);
  const [groupNameDuplicateWarning, setGroupNameDuplicateWarning] = useState<string | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [trashWorkspaceId, setTrashWorkspaceId] = useState<string | null>(null);
  const [groupActionError, setGroupActionError] = useState<string | null>(null);
  const [workspaceToSoftDelete, setWorkspaceToSoftDelete] = useState<Workspace | null>(null);

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
    if (!session?.user.id) {
      setGoogleLinked(false);
      return;
    }
    void hasGoogleIdentity().then(setGoogleLinked).catch(() => setGoogleLinked(false));
  }, [session?.user.id]);

  useEffect(() => {
    let active = true;
    setAvatarUrl(null);
    setAvatarLoadError(false);
    if (!profile?.avatarPath) return () => { active = false; };

    void getProfileAvatarUrl(profile.avatarPath)
      .then((signedUrl) => {
        if (active) {
          setAvatarUrl(signedUrl);
          setAvatarLoadError(false);
        }
      })
      .catch((avatarError: unknown) => {
        if (active) {
          setLocalProfileError(avatarError instanceof Error ? avatarError.message : "Impossible de charger l'avatar.");
        }
      });

    return () => { active = false; };
  }, [profile?.avatarPath]);



  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [localEmailError, setLocalEmailError] = useState<string | null>(null);
  const isPasswordRecovery = new URLSearchParams(location.search).get('reset-password') === '1';
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceFeedback, setWorkspaceFeedback] = useState('');
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
    setAvatarLoadError(false);
    setProfileLoading(true);
    try {
      const updatedProfile = await uploadCurrentProfileAvatar(file);
      setProfile(updatedProfile);
      setAvatarLoadError(false);
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
        navigate('/', { replace: true });
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

  async function handleLinkGoogle() {
    if (loading || googleLinked) return;
    clearFeedback();
    try {
      await linkGoogleIdentity();
    } catch (identityError) {
      setLocalProfileError(identityError instanceof Error ? identityError.message : 'Impossible d’associer Google.');
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
      navigate('/', { replace: true });
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
    setWorkspaceFeedback('');
    clearFeedback();
    try {
      if (isAppOnline()) {
        const isAvailable = await checkWorkspaceNameAvailable(normalizedName);
        if (!isAvailable) {
          setLocalWorkspaceError('Un groupe portant ce nom existe déjà.');
          return;
        }
      }
      await createWorkspace(normalizedName);
      setWorkspaceFeedback('Groupe créé.');
      setWorkspaceName('');
    } catch (err: any) {
      setLocalWorkspaceError(err.message || 'Echec de création de groupe.');
    }
  }

  async function handleUpdateGroupName(workspaceId: string, name: string) {
    setGroupActionError(null);
    try {
      if (isAppOnline()) {
        const isAvailable = await checkWorkspaceNameAvailable(name, workspaceId);
        if (!isAvailable) {
          setGroupNameDuplicateWarning('Ce nom de groupe est déjà utilisé.');
          return;
        }
      }
      setGroupNameDuplicateWarning(null);
      await updateWorkspaceGroup(workspaceId, { name });
      await useAuthStore.getState().refreshWorkspaceAccess();
    } catch (err: any) {
      setGroupActionError(err.message || 'Echec de mise à jour du nom.');
    }
  }

  async function handleMemberRoleChange(workspaceId: string, userId: string, newRole: WorkspaceRole) {
    setGroupActionError(null);
    try {
      await setWorkspaceMemberRole(workspaceId, userId, newRole);
    } catch (err: any) {
      setGroupActionError(err.message || 'Modification du rôle impossible.');
    }
  }

  async function handleRemoveMember(workspaceId: string, userId: string): Promise<boolean> {
    setGroupActionError(null);
    try {
      await removeWorkspaceMember(workspaceId, userId);
      return true;
    } catch (err: any) {
      setGroupActionError(err.message || 'Impossible de retirer ce membre.');
      return false;
    }
  }

  async function handleLeaveGroup(workspaceId: string) {
    setGroupActionError(null);
    try {
      await leaveWorkspace(workspaceId);
      await useAuthStore.getState().refreshWorkspaceAccess();
    } catch (err: any) {
      setGroupActionError(err.message || 'Impossible de quitter le groupe.');
    }
  }

  async function handleSoftDeleteGroup(workspaceId: string) {
    setGroupActionError(null);
    try {
      await softDeleteWorkspace(workspaceId);
      await useAuthStore.getState().refreshWorkspaceAccess();
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
  const newPasswordRequirements = getPasswordRequirements(newPassword);
  function menuRow(title: string, next: SettingsView, icon: string, subtitle?: string, id?: string) {
    return <ContentRow mode="button" title={title} subtitle={subtitle} leading={<FzIcon name={icon} usageId={'account.menu.' + next} />} trailing={<FzIcon name="next" usageId="account.menu.next" />} onClick={() => openView(next, id)} />;
  }

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-6">
      {view === 'home' ? <PageHeader icon={<FzIcon name="settings" usageId="account.header" size="xl" />} title="Paramètres" />
        : view === 'sync' ? <Button variant="ghost" leadingIcon={<FzIcon name="back" usageId="account.sync.back" />} onClick={() => openView('home')}>Retour aux paramètres</Button>
        : <DetailHeader title={view === 'group' ? selectedWorkspace?.name ?? 'Groupe' : isPasswordRecovery && view === 'password' ? 'Nouveau mot de passe' : settingsTitles[view]} subtitle={view.startsWith('group-') ? selectedWorkspace?.name : undefined} leading={view === 'group' && selectedWorkspace ? <span aria-label={`Badge de ${selectedWorkspace.name}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ backgroundColor: getBadgeColor(selectedWorkspace.id, selectedWorkspace.type).hex }}>{getBadgeText(selectedWorkspace.id, selectedWorkspace.name)}</span> : undefined} onBack={() => openView(settingsParent(view), selectedWorkspace?.id)} backLabel={settingsParent(view) === 'group' ? 'Retour au groupe' : settingsParent(view) === 'security' ? 'Retour à la sécurité' : settingsParent(view) === 'add-group' ? 'Retour à Ajouter un groupe' : 'Retour aux paramètres'} />}

      {view === 'home' && <>
        <section aria-labelledby="settings-groups"><h2 id="settings-groups" className="fz-field-label">Groupes</h2>
          {workspaces.filter(ws => ws.type === 'group').map(ws => <ContentRow key={ws.id} mode="button" title={ws.name} aria-label={'Réglages de ' + ws.name} leading={<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ backgroundColor: getBadgeColor(ws.id, ws.type).hex }}>{getBadgeText(ws.id, ws.name)}</span>} status={activeWorkspace?.id === ws.id ? <StatusPill label="Actif" tone="accent" /> : undefined} trailing={<FzIcon name="next" usageId="account.group.open" />} onClick={() => { clearFeedback(); setActiveWorkspace(ws); openView('group', ws.id); }} />)}
          {loading ? <p role="status" className="py-3 text-sm text-[var(--fz-text-muted)]">Chargement des groupes…</p> : !workspaces.some(ws => ws.type === 'group') ? <p className="py-3 text-sm text-[var(--fz-text-muted)]">Tu n’as pas encore de groupe.</p> : null}
          {menuRow('Ajouter un groupe', 'add-group', 'add')}
        </section>
        <section aria-labelledby="settings-account"><h2 id="settings-account" className="fz-field-label">Mon compte</h2>
          {menuRow('Profil', 'profile', 'user-round', 'Photo et pseudo')}
          {menuRow('Connexion et sécurité', 'security', 'settings', 'E-mail, Google et mot de passe')}
          {workspaces.filter(ws => ws.type === 'personal').map(ws => <ContentRow key={ws.id} mode="button" title="Mon espace" leading={<FzIcon name="folder" usageId="account.menu.personal" />} trailing={<FzIcon name="next" usageId="account.personal.open" />} onClick={() => openView('personal', ws.id)} />)}
        </section>
        <section aria-labelledby="settings-data"><h2 id="settings-data" className="fz-field-label">Données</h2>
          {menuRow('Synchronisation', 'sync', 'cable')}
        </section>
      </>}
      {view === 'security' && <section aria-label="Connexion et sécurité">
        {menuRow('Adresse e-mail', 'email', 'email')}
        {menuRow('Connexion Google', 'google', 'user-round')}
        {menuRow('Mot de passe', 'password', 'settings')}
        <Button variant="ghost" onClick={() => openView('delete-account')}>Supprimer mon compte</Button>
      </section>}
      {view === 'add-group' && <section aria-label="Ajouter un groupe">
        {menuRow('Créer un groupe', 'create-group', 'add')}
        {menuRow('Rejoindre un groupe', 'join-group', 'users')}
      </section>}
      {view === 'group' && selectedWorkspace && <section aria-label="Réglages du groupe">
        {menuRow('Identité du groupe', 'group-identity', 'settings', 'Nom et badge', selectedWorkspace.id)}
        {menuRow('Membres et invitations', 'group-members', 'users', undefined, selectedWorkspace.id)}
        {canAdministerWorkspace(selectedWorkspace.role) && <>
          <ContentRow mode="button" title="Kit de presse public" subtitle="Gérer l’EPK" leading={<FzIcon name="file-text" usageId="account.menu.epk" />} trailing={<FzIcon name="next" usageId="account.epk.open" />} onClick={() => { setActiveWorkspace(selectedWorkspace); navigate('/account/epk'); }} />
          {menuRow('Administration', 'group-admin', 'wrench', 'Stockage et gestion du groupe', selectedWorkspace.id)}
        </>}
      </section>}
      {view === 'profile' && (<section className="space-y-3"><div className="space-y-4">
              {localProfileError && <p className="text-xs text-red-400">{localProfileError}</p>}

              <form onSubmit={handleProfileSubmit} className="space-y-3">
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
                    {avatarUrl && !avatarLoadError ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setAvatarLoadError(true)}
                      />
                    ) : (
                      generatedAvatar?.initials ?? '…'
                    )}
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
                    <label htmlFor="profileDisplayName" className="fz-field-label">
                      Pseudo public
                    </label>
                    <TextField
                      id="profileDisplayName"
                      type="text"
                      minLength={2}
                      maxLength={30}
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      disabled={profileLoading || !profile}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={profileLoading || !profile || displayName.trim() === profile.displayName}
                  variant="primary" fullWidth
                >
                  {profileLoading ? 'Enregistrement...' : 'Enregistrer le pseudo'}
                </Button>
                {profileFeedback ? <p className="mt-2 text-[0.75rem] text-emerald-300">{profileFeedback}</p> : null}
              </form>


            </div>
          </section>)}
{view === 'email' && (<section className="space-y-3">              {session?.user.email && (
                <div className="pt-3 border-t border-white/10">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">E-mail privé — visible uniquement ici</p>
                  <p className="mt-1 text-sm font-semibold text-white">{session.user.email}</p>
                </div>
              )}<p className="text-sm text-[var(--fz-text-muted)]">Le changement sera effectif uniquement après confirmation depuis l’ancienne et la nouvelle adresse.</p><div className="space-y-4">
              {localEmailError && <p className="mt-2 text-xs text-red-400">{localEmailError}</p>}
              <form onSubmit={handleEmailSubmit} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="newEmail" className="fz-field-label">
                    Nouvelle adresse e-mail
                  </label>
                  <TextField
                    id="newEmail"
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="nouvelle@adresse.fr"
                    disabled={loading}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || !newEmail.trim()}
                  variant="primary" fullWidth
                >
                  {loading ? 'Demande...' : 'Demander le changement'}
                </Button>
              </form>
            </div>
          </section>)}
{view === 'google' && (<section className="space-y-3">{localProfileError && <p role="alert" className="text-sm text-red-400">{localProfileError}</p>}
<p className="text-sm text-[var(--fz-text-muted)]">{googleLinked ? 'Google est associé à ce compte.' : 'Associez Google pour pouvoir vous connecter avec ce compte Google.'}</p>
<div className="space-y-4">
              <Button
                type="button"
                onClick={() => void handleLinkGoogle()}
                disabled={loading || googleLinked}
                variant="secondary" fullWidth
              >
                {googleLinked ? 'Google associé' : loading ? 'Redirection…' : 'Associer Google'}
              </Button>
            </div>
          </section>)}
{view === 'password' && (<section className="space-y-3"><p className="text-sm text-[var(--fz-text-muted)]">Toutes les sessions seront révoquées après la modification.</p><div className="space-y-4">
              {localPasswordError && <p className="mt-2 text-xs text-red-400">{localPasswordError}</p>}
              <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
                {!isPasswordRecovery ? (
                  <div>
                    <label htmlFor="currentPassword" className="fz-field-label">
                      Mot de passe actuel
                    </label>
                    <PasswordField
                      id="currentPassword"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      disabled={loading}
                    />
                  </div>
                ) : null}
                <div>
                  <label htmlFor="newPassword" className="fz-field-label">
                    Nouveau mot de passe
                  </label>
                  <PasswordField
                    id="newPassword"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Au moins 8 caractères"
                    disabled={loading}
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
                  <label htmlFor="confirmNewPassword" className="fz-field-label">
                    Confirmer le nouveau mot de passe
                  </label>
                  <PasswordField
                    id="confirmNewPassword"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Retapez le mot de passe"
                    disabled={loading}
                    showPasswordLabel="Afficher la confirmation du nouveau mot de passe"
                    hidePasswordLabel="Masquer la confirmation du nouveau mot de passe"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || (!isPasswordRecovery && !currentPassword) || !newPassword || !confirmPassword}
                  variant="primary" fullWidth
                >
                  {loading ? 'Mise à jour...' : 'Mettre a jour le mot de passe'}
                </Button>
              </form>
            </div>
          </section>)}
{view === 'home' && (<section className="space-y-3"><p className="text-sm text-[var(--fz-text-muted)]">Ferme ta session sur cet appareil. Tes données locales et morceaux en cache restent conservés.</p><div className="space-y-4">
              <Button
                type="button"
                onClick={() => void signOut()}
                disabled={loading}
                variant="ghost" fullWidth
              >
                Se déconnecter
              </Button>
            </div>
          </section>)}
{view === 'delete-account' && (<section className="space-y-3"><div className="space-y-4">
              {localDeletionError && <p className="mt-2 text-xs text-red-400">{localDeletionError}</p>}
              {accountDeletionToken ? (
                <>
                  <p className="mt-2 text-sm leading-relaxed text-red-100/75">
                    Le lien e-mail a été ouvert. La confirmation finale supprimera Mon espace et votre identité, mais conservera les groupes partagés.
                  </p>
                  <Button
                    type="button"
                    onClick={() => setIsConfirmFinalDeletionOpen(true)}
                    disabled={loading}
                    variant="danger" fullWidth
                  >
                    Supprimer définitivement
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--fz-text-muted)]">
                    La demande est impossible si vous êtes le dernier administrateur d’un groupe. Un lien valable une heure sera envoyé par e-mail.
                  </p>
                  <Button
                    type="button"
                    onClick={() => setIsConfirmDeletionRequestOpen(true)}
                    disabled={loading}
                    variant="danger" fullWidth
                  >
                    Envoyer le lien de suppression
                  </Button>
                </>
              )}
            </div>
          </section>)}
      {(view === 'personal' || view === 'group-identity' || view === 'group-members' || view === 'group-admin') && selectedWorkspace && <section className="space-y-4">
        {groupActionError && <p role="alert" className="text-sm text-red-400">{groupActionError}</p>}
        {workspaces.filter(ws => ws.id === selectedWorkspace.id).map(ws => {
          const badgeColor = getBadgeColor(ws.id, ws.type);
          return <div key={ws.id} className="space-y-4">                          {ws.type === 'group' && view === 'group-identity' && canAdministerWorkspace(ws.role) ? <div className="space-y-2"><label htmlFor={`workspaceName-${ws.id}`} className="fz-field-label">Nom du groupe</label><div className="flex gap-2"><div className="min-w-0 flex-1"><TextField id={`workspaceName-${ws.id}`} type="text" value={editingWorkspaceId === ws.id ? editingGroupName : ws.name} onFocus={() => { setEditingWorkspaceId(ws.id); setEditingGroupName(ws.name); }} onChange={(event) => { setEditingWorkspaceId(ws.id); setEditingGroupName(event.target.value); }} /></div><Button type="button" onClick={() => void handleUpdateGroupName(ws.id, editingGroupName)} variant="secondary">Enregistrer</Button></div>{groupNameDuplicateWarning && editingWorkspaceId === ws.id ? <p className="text-xs text-amber-400">{groupNameDuplicateWarning}</p> : null}</div> : null}

                          {ws.type !== 'group' || view === 'group-admin' ? <AudioQuotaBanner workspace={ws} isOnline={true} action={ws.type === 'group' && canAdministerWorkspace(ws.role) ? <button type="button" aria-label={`Ouvrir la corbeille de ${ws.name}`} onClick={() => { setTrashWorkspaceId(ws.id); setIsTrashOpen(true); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 transition hover:bg-amber-500/20"><FzIcon name="delete" usageId="account.group.storage.trash" /></button> : undefined} /> : null}

                          {/* Pastille Color Selector */}
                          {ws.type !== 'group' || view === 'group-identity' ? <div className="space-y-2">
                            <p className="fz-field-label">
                              Couleur de la pastille
                            </p>
                            <div className="flex flex-wrap items-center gap-2.5 pt-1">
                              {WORKSPACE_COLOR_OPTIONS.map((colorOption) => {
                                const isSelected = badgeColor.id === colorOption.id;
                                return (
                                  <button
                                    key={colorOption.id}
                                    type="button"
                                    onClick={() => setBadgeColor(ws.id, colorOption.id)}
                                    title={colorOption.name}
                                    aria-label={`Couleur ${colorOption.name}`}
                                    className={[
                                      'h-11 w-11 rounded-full border-2 transition-all flex items-center justify-center',
                                      isSelected
                                        ? 'border-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.4)] ring-2 ring-white/50'
                                        : 'border-transparent hover:scale-105 opacity-80 hover:opacity-100',
                                    ].join(' ')}
                                    style={{ backgroundColor: colorOption.hex }}
                                  >
                                    {isSelected && (
                                      <svg className="h-3.5 w-3.5 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div> : null}

                          {/* Pastille Badge Text Input */}
                          {ws.type !== 'group' || view === 'group-identity' ? <div className="space-y-1.5 pt-1">
                            <label htmlFor={`workspaceBadgeText-${ws.id}`} className="fz-field-label">
                              Texte du badge (3 lettres max)
                            </label>
                            <div className="max-w-[140px]">
                            <TextField
                              id={`workspaceBadgeText-${ws.id}`}
                              type="text"
                              maxLength={3}
                              value={editingBadgeText?.workspaceId === ws.id
                                ? editingBadgeText.value
                                : getBadgeText(ws.id, ws.name)}
                              onFocus={() => {
                                const previousValue = getBadgeText(ws.id, ws.name);
                                setEditingBadgeText({ workspaceId: ws.id, value: previousValue, previousValue });
                              }}
                              onChange={(event) => setEditingBadgeText((current) => current?.workspaceId === ws.id
                                ? { ...current, value: event.target.value.toUpperCase().slice(0, 3) }
                                : current)}
                              onBlur={() => {
                                const current = editingBadgeText;
                                if (current?.workspaceId !== ws.id) return;
                                setBadgeText(ws.id, current.value.trim() || current.previousValue);
                                setEditingBadgeText(null);
                              }}
                              placeholder={getWorkspaceInitials(ws.name)}
                            />
                            </div>
                          </div> : null}

                          {/* Workspace Administration & Tools (Accessible to all workspaces) */}
                          <div className="space-y-3 pt-2 border-t border-white/10">
                            {ws.type !== 'group' ? <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-white/80">
                                Contenus
                              </h4>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setTrashWorkspaceId(ws.id);
                                    setIsTrashOpen(true);
                                  }}
                                  variant="secondary"
                                >
                                  Corbeille
                                </Button>
                              </div>
                            </div> : null}

                            {ws.type === 'group' && (
                              <>
                                {view === 'group-members' ? <div className="space-y-3"><div className="flex items-center justify-between gap-3"><p className="fz-field-label">Membres</p>{canAdministerWorkspace(ws.role) ? <Button type="button" onClick={() => void handleOpenShareDialog(ws)} variant="secondary">Inviter des membres</Button> : null}</div><WorkspaceMemberList workspace={ws} canAdmin={canAdministerWorkspace(ws.role)} onMemberRoleChange={(userId, role) => void handleMemberRoleChange(ws.id, userId, role)} onRemoveMember={(m) => setMemberToRemove({ member: m, workspaceId: ws.id })} /><Button type="button" onClick={() => void handleLeaveGroup(ws.id)} variant="danger" fullWidth>Quitter le groupe</Button></div> : null}

                                {view === 'group-admin' ? <div className="flex gap-2 pt-2">
                                  {canAdministerWorkspace(ws.role) && (
                                    <Button
                                      onClick={() => setWorkspaceToSoftDelete(ws)}
                                      variant="danger"
                                    >
                                      Supprimer le groupe
                                    </Button>
                                  )}
                                </div> : null}
                              </>
                            )}
                          </div></div>;
        })}
      </section>}
      {view === 'create-group' && <section>              <form onSubmit={handleCreateWorkspace} className="space-y-3">
                <TextField
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Nom du groupe"
                  disabled={loading}
                />
                {localWorkspaceError && <p className="text-xs text-red-400">{localWorkspaceError}</p>}
                <Button
                  type="submit"
                  disabled={loading || !workspaceName.trim()}
                  variant="primary" fullWidth
                >
                  {loading ? 'Création...' : 'Créer un nouveau groupe'}
                </Button>
              </form>{workspaceFeedback && <p role="status" className="mt-3 text-sm text-emerald-300">{workspaceFeedback}</p>}</section>}
      {view === 'join-group' && <section>              <form onSubmit={handleJoinWorkspaceWithLink} className="mt-5 pt-5 border-t border-white/10 space-y-3">
                <div>
                  <label htmlFor="workspaceInviteLink" className="fz-field-label">
                    Rejoindre un groupe avec un lien
                  </label>
                  <TextField
                    id="workspaceInviteLink"
                    type="text"
                    value={joinInviteValue}
                    onChange={(e) => setJoinInviteValue(e.target.value)}
                    placeholder="Collez ici un lien d'invitation"
                    disabled={loading || joinInviteLoading}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || joinInviteLoading || !joinInviteValue.trim()}
                  variant="primary" fullWidth
                >
                  {joinInviteLoading ? 'Connexion...' : 'Ajouter ce groupe'}
                </Button>
                {joinInviteFeedback ? (
                  <p className="text-[0.75rem] text-white/70">{joinInviteFeedback}</p>
                ) : null}
              </form></section>}
      {view === 'sync' && <SyncTab />}

      {/* Share Dialog */}
      {shareWorkspace ? (
        <FormDialog title={`Inviter dans ${shareWorkspace.name}`} onClose={handleCloseShareDialog}>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--fz-text-muted)]">
              Les liens expirent après 24 heures et ne peuvent être utilisés qu’une fois.
            </p>

            <div className="rounded-[1.2rem] border border-orange-500/18 bg-orange-500/8 p-4">
              <label htmlFor="inviteRole" className="fz-field-label">
                Rôle attribué
              </label>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <SelectField
                    id="inviteRole"
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}
                    disabled={inviteLoading}
                  >
                    <option value="admin">Administrateur</option>
                    <option value="member">Membre</option>
                    <option value="guest">Invité</option>
                  </SelectField>
                </div>
                <Button
                  type="button"
                  onClick={() => void generateInviteLink(shareWorkspace, inviteRole)}
                  disabled={inviteLoading}
                  variant="secondary"
                >
                  {inviteLoading ? 'Création...' : 'Créer'}
                </Button>
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
                      <Button
                        type="button"
                        onClick={() => setInviteToRevoke(invite)}
                        variant="danger"
                      >
                        Révoquer
                      </Button>
                    </div>
                  </div>
                  {!inviteLinks[invite.id] ? (
                    <p className="mt-2 text-[0.66rem] text-white/35">Secret non conservé : créez un nouveau lien pour le copier.</p>
                  ) : null}
                </div>
              ))}
            </div>

            {inviteFeedback ? <p className="text-[0.75rem] text-white/70">{inviteFeedback}</p> : null}

            <Button
              type="button"
              onClick={handleCloseShareDialog}
              variant="secondary" fullWidth
            >
              Fermer
            </Button>
          </div>
        </FormDialog>
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(memberToRemove)}
        title="Retirer ce membre ?"
        description={`Voulez-vous vraiment retirer ${memberToRemove?.member.pseudo || 'ce membre'} du groupe ? Cette personne perdra immédiatement l'accès au contenu partagé.`}
        confirmLabel="Retirer"
        isBusy={memberRemovalLoading}
        onCancel={() => setMemberToRemove(null)}
        onConfirm={async () => {
          if (!memberToRemove) return;
          setMemberRemovalLoading(true);
          try {
            const removed = await handleRemoveMember(memberToRemove.workspaceId, memberToRemove.member.userId);
            if (removed) setMemberToRemove(null);
          } finally {
            setMemberRemovalLoading(false);
          }
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(workspaceToSoftDelete)}
        title="Placer le groupe en corbeille ?"
        description={`Voulez-vous vraiment placer le groupe "${workspaceToSoftDelete?.name || ''}" en corbeille ? Ses éléments seront conservés et vous pourrez le restaurer ultérieurement depuis la corbeille.`}
        confirmLabel="Placer en corbeille"
        isBusy={loading}
        onCancel={() => setWorkspaceToSoftDelete(null)}
        onConfirm={async () => {
          if (!workspaceToSoftDelete) return;
          try {
            await handleSoftDeleteGroup(workspaceToSoftDelete.id);
            setWorkspaceToSoftDelete(null);
          } catch {}
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
      {(trashWorkspaceId || activeWorkspace?.id) && (
        <TrashModal
          workspaceId={trashWorkspaceId || activeWorkspace?.id || 'personal'}
          isOpen={isTrashOpen}
          onClose={() => {
            setIsTrashOpen(false);
            setTrashWorkspaceId(null);
          }}
        />
      )}
    </div>
  );
}
