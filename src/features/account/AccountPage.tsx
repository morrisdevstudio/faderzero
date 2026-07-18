import { useState, useEffect } from 'react';
import { FormDialog } from '@/components/FormDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAuthStore } from '@/stores/authStore';
import {
  createWorkspaceInviteLink,
  extractWorkspaceInviteToken,
  type Workspace,
} from '@/services/supabase/workspace';
import { useAudioCacheStore } from '@/features/audio/audioCacheStore';

const MIN_PASSWORD_LENGTH = 8;

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
    error,
    infoMessage,
    updatePassword,
    setActiveWorkspace,
    createWorkspace,
    joinWorkspaceByInvite,
    signOut,
    clearFeedback,
  } = useAuthStore();

  const cachedAssetIds = useAudioCacheStore((state) => state.cachedAssetIds);
  const checkCacheStatus = useAudioCacheStore((state) => state.checkCacheStatus);
  const clearCache = useAudioCacheStore((state) => state.clearCache);
  const [isConfirmClearCacheOpen, setIsConfirmClearCacheOpen] = useState(false);

  useEffect(() => {
    void checkCacheStatus();
  }, [checkCacheStatus]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [localPasswordError, setLocalPasswordError] = useState<string | null>(null);
  const [localWorkspaceError, setLocalWorkspaceError] = useState<string | null>(null);
  const [shareWorkspace, setShareWorkspace] = useState<Workspace | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [joinInviteValue, setJoinInviteValue] = useState('');
  const [joinInviteFeedback, setJoinInviteFeedback] = useState<string | null>(null);
  const [joinInviteLoading, setJoinInviteLoading] = useState(false);

  async function copyTextToClipboard(text: string) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        setInviteFeedback("Lien d'invitation copie dans le presse-papiers.");
        return true;
      } catch {
      }
    }

    const copied = fallbackCopyTextToClipboard(text);

    if (copied) {
      setInviteFeedback("Lien d'invitation copie dans le presse-papiers.");
      return true;
    }

    setInviteFeedback('Copie automatique indisponible ici. Maintenez le doigt ou faites un clic droit pour copier le lien.');
    return false;
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setLocalPasswordError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLocalPasswordError(null);
    clearFeedback();

    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    const normalizedName = workspaceName.trim();
    if (!normalizedName) {
      setLocalWorkspaceError('Donnez un nom a votre groupe.');
      return;
    }

    setLocalWorkspaceError(null);
    clearFeedback();

    try {
      await createWorkspace(normalizedName);
      setWorkspaceName('');
    } catch (err) {
      console.error(err);
    }
  }

  async function generateInviteLink(workspace: Workspace, options?: { copyImmediately?: boolean }) {
    setInviteLoading(true);
    setInviteFeedback(null);

    try {
      const invite = await createWorkspaceInviteLink(workspace.id);
      setInviteLink(invite.url);

      if (options?.copyImmediately) {
        await copyTextToClipboard(invite.url);
      }

      return invite.url;
    } catch (error) {
      setInviteFeedback(error instanceof Error ? error.message : "Impossible de generer un lien d'invitation.");
      return null;
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleOpenShareDialog(workspace: Workspace) {
    setShareWorkspace(workspace);
    setInviteLink(null);
    setInviteFeedback(null);
    await generateInviteLink(workspace, { copyImmediately: true });
  }

  async function handleCopyInviteLink() {
    if (!shareWorkspace) return;

    const nextLink = inviteLink ?? (await generateInviteLink(shareWorkspace));
    if (!nextLink) return;

    await copyTextToClipboard(nextLink);
  }

  function handleCloseShareDialog() {
    setShareWorkspace(null);
    setInviteLink(null);
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
          ? `Groupe ajoute: ${workspace.name}. Groupe actif conserve: ${previousActiveWorkspace.name}.`
          : `Groupe rejoint: ${workspace.name}.`
      );
    } catch (error) {
      setJoinInviteFeedback(error instanceof Error ? error.message : 'Impossible de rejoindre ce groupe.');
    } finally {
      setJoinInviteLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
        <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--fz-accent)]">Compte</p>
        <h1 className="mt-2 text-[1.45rem] font-black uppercase tracking-[0.18em] text-white">Espace personnel</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fz-text-muted)]">
          Gere ton acces, choisis ton groupe actif et cree de nouveaux espaces de travail.
        </p>
        <div className="mt-4 rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-3">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">Connecte avec</p>
          <p className="mt-1 text-sm font-semibold text-white">{session?.user.email ?? 'Adresse inconnue'}</p>
          {activeWorkspace ? (
            <p className="mt-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--fz-accent)]">
              Groupe actif: {activeWorkspace.name}
            </p>
          ) : null}
        </div>
      </section>

      {(error || infoMessage || localPasswordError || localWorkspaceError) && (
        <section className="space-y-2">
          {error && (
            <div className="rounded-[1rem] border border-red-500/20 bg-red-500/10 p-3 text-[0.78rem] text-red-300">
              {error}
            </div>
          )}
          {infoMessage && (
            <div className="rounded-[1rem] border border-emerald-500/20 bg-emerald-500/10 p-3 text-[0.78rem] text-emerald-300">
              {infoMessage}
            </div>
          )}
          {localPasswordError && (
            <div className="rounded-[1rem] border border-red-500/20 bg-red-500/10 p-3 text-[0.78rem] text-red-300">
              {localPasswordError}
            </div>
          )}
          {localWorkspaceError && (
            <div className="rounded-[1rem] border border-red-500/20 bg-red-500/10 p-3 text-[0.78rem] text-red-300">
              {localWorkspaceError}
            </div>
          )}
        </section>
      )}

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--fz-accent)]">Groupes</p>
            <h2 className="mt-2 text-lg font-black uppercase tracking-[0.16em] text-white">Changer de groupe</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/55">
            {workspaces.length} groupe{workspaces.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          {workspaces.length > 0 ? (
            workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspace?.id;

              return (
                <div
                  key={workspace.id}
                  className={[
                    'flex items-stretch gap-2 rounded-[1.2rem] border p-2 transition',
                    isActive
                      ? 'border-orange-400/40 bg-orange-500/12 shadow-[0_16px_36px_rgba(249,115,22,0.14)]'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => {
                      clearFeedback();
                      setActiveWorkspace(workspace);
                    }}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-[1rem] px-2 py-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{workspace.name}</p>
                      <p className="mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-white/40">
                        {isActive ? 'Groupe actuellement utilise' : 'Activer ce groupe'}
                      </p>
                    </div>
                    <span
                      className={[
                        'shrink-0 rounded-full px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em]',
                        isActive ? 'bg-orange-500 text-white' : 'border border-white/10 bg-black/20 text-white/55',
                      ].join(' ')}
                    >
                      {isActive ? 'Actif' : 'Switch'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleOpenShareDialog(workspace)}
                    aria-label={`Partager le groupe ${workspace.name}`}
                    className="flex h-auto min-h-[68px] w-14 shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-black/20 text-white/70 transition hover:border-orange-400/40 hover:bg-orange-500/16 hover:text-orange-100"
                  >
                    <ShareIcon />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="rounded-[1.2rem] border border-dashed border-white/12 bg-black/15 px-4 py-5 text-sm text-white/55">
              Aucun groupe pour le moment. Cree ton premier workspace juste en dessous.
            </div>
          )}
        </div>

        <form onSubmit={handleCreateWorkspace} className="mt-5 space-y-3 rounded-[1.2rem] border border-white/8 bg-black/15 p-4">
          <div>
            <label htmlFor="workspaceName" className="block text-[0.66rem] font-black uppercase tracking-[0.18em] text-white/55">
              Creer un groupe
            </label>
            <input
              id="workspaceName"
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Ex: FaderZero Live"
              disabled={loading}
              className="mt-2 w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 focus:border-orange-500/50 focus:bg-white/10 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !workspaceName.trim()}
            className="w-full rounded-[1rem] bg-white px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-[#0c0d10] transition hover:bg-orange-500 hover:text-white disabled:bg-white/10 disabled:text-white/35"
          >
            {loading ? 'Creation...' : 'Creer un nouveau groupe'}
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

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
        <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--fz-accent)]">Securite</p>
        <h2 className="mt-2 text-lg font-black uppercase tracking-[0.16em] text-white">Changer de mot de passe</h2>
        <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
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
              placeholder="Au moins 8 caracteres"
              disabled={loading}
              className="mt-2 w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 focus:border-orange-500/50 focus:bg-white/10 focus:outline-none"
            />
          </div>
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
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full rounded-[1rem] border border-orange-500/25 bg-orange-500/12 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-orange-200 transition hover:bg-orange-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35"
          >
            {loading ? 'Mise a jour...' : 'Mettre a jour le mot de passe'}
          </button>
        </form>
      </section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
        <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--fz-accent)]">Stockage</p>
        <h2 className="mt-2 text-lg font-black uppercase tracking-[0.16em] text-white">Gestion du cache</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fz-text-muted)]">
          Libere de l'espace sur cet appareil en supprimant les fichiers audio charges localement.
        </p>
        <div className="mt-3 rounded-[1.2rem] border border-white/8 bg-black/20 px-4 py-3">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-white/45">Fichiers audio caches</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {cachedAssetIds.size} morceau{cachedAssetIds.size > 1 ? 'x' : ''} cache{cachedAssetIds.size > 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsConfirmClearCacheOpen(true)}
          disabled={cachedAssetIds.size === 0}
          className="mt-4 w-full rounded-[1rem] border border-orange-500/25 bg-orange-500/10 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-orange-200 transition hover:bg-orange-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35"
        >
          Vider le cache audio
        </button>
      </section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
        <p className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-[var(--fz-accent)]">Session</p>
        <h2 className="mt-2 text-lg font-black uppercase tracking-[0.16em] text-white">Se deconnecter</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fz-text-muted)]">
          Deconnecte-toi de cet appareil. Tu pourras te reconnecter ensuite avec ton e-mail et ton mot de passe.
        </p>
        <button
          type="button"
          onClick={() => {
            clearFeedback();
            void signOut();
          }}
          disabled={loading}
          className="mt-4 w-full rounded-[1rem] border border-red-500/25 bg-red-500/10 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.18em] text-red-200 transition hover:bg-red-500/18 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35"
        >
          {loading ? 'Deconnexion...' : 'Log out'}
        </button>
      </section>

      {shareWorkspace ? (
        <FormDialog title={`Inviter dans ${shareWorkspace.name}`} onClose={handleCloseShareDialog}>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--fz-text-muted)]">
              Partage ce lien pour permettre a quelqu'un de rejoindre ce groupe sans quitter ses autres groupes.
            </p>

            <div className="rounded-[1.2rem] border border-orange-500/18 bg-orange-500/8 p-4">
              <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-orange-200/80">Lien d'invitation</p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  readOnly
                  value={inviteLink ?? ''}
                  placeholder={inviteLoading ? 'Generation du lien...' : 'Lien indisponible'}
                  className="min-w-0 flex-1 rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/80 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleCopyInviteLink()}
                  disabled={inviteLoading || !inviteLink}
                  aria-label="Copier le lien"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-white/8 text-white/75 transition hover:border-orange-400/40 hover:bg-orange-500/18 hover:text-white disabled:bg-white/5 disabled:text-white/30"
                >
                  <CopyIcon />
                </button>
              </div>
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
        isOpen={isConfirmClearCacheOpen}
        title="Vider le cache audio ?"
        description={`Voulez-vous vraiment supprimer les ${cachedAssetIds.size} morceaux caches sur cet appareil ? Vous devrez les telecharger a nouveau pour les ecouter hors ligne.`}
        confirmLabel="Vider le cache"
        isBusy={false}
        onCancel={() => setIsConfirmClearCacheOpen(false)}
        onConfirm={async () => {
          await clearCache();
          setIsConfirmClearCacheOpen(false);
        }}
      />
    </div>
  );
}
