import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { resolveWorkspaceInvite, type WorkspaceInvitePreview } from '@/services/supabase/workspace';

interface WorkspaceInvitePageProps {
  inviteToken: string;
  onDismiss: () => void;
}

export function WorkspaceInvitePage({ inviteToken, onDismiss }: WorkspaceInvitePageProps) {
  const { joinWorkspaceByInvite, activeWorkspace, loading, clearFeedback } = useAuthStore();
  const [invite, setInvite] = useState<WorkspaceInvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      setPreviewLoading(true);
      setLocalError(null);

      try {
        const nextInvite = await resolveWorkspaceInvite(inviteToken);

        if (!cancelled) {
          if (!nextInvite) {
            setLocalError("Ce lien d'invitation est introuvable.");
          } else {
            setInvite(nextInvite);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLocalError(error instanceof Error ? error.message : "Impossible de verifier l'invitation.");
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }

    void loadInvite();

    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  async function handleAccept() {
    clearFeedback();
    setLocalError(null);

    try {
      const previousActiveWorkspace = activeWorkspace;
      const workspace = await joinWorkspaceByInvite(inviteToken);
      setSuccessMessage(
        previousActiveWorkspace && previousActiveWorkspace.id !== workspace.id
          ? `Vous avez rejoint ${workspace.name} sans quitter ${previousActiveWorkspace.name}.`
          : `Vous avez rejoint ${workspace.name}.`
      );
      onDismiss();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Impossible de rejoindre ce groupe.");
    }
  }

  const isExpired = invite?.status === 'expired';
  const isUnavailable = invite?.status === 'declined' || isExpired;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c0d10] px-4 text-[#f5f0ea]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[40%] h-[80%] w-[80%] rounded-full bg-orange-600/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[40%] h-[80%] w-[80%] rounded-full bg-amber-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md rounded-[1.8rem] border border-white/10 bg-white/5 p-8 shadow-[0_32px_64px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-orange-400">Invitation</p>
        <h1 className="mt-3 text-2xl font-black uppercase tracking-[0.2em] text-white">Rejoindre un groupe</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          Confirmez cette invitation pour ajouter ce groupe a votre espace FaderZero.
        </p>

        {previewLoading ? (
          <div className="mt-6 rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/60">
            Verification du lien...
          </div>
        ) : null}

        {!previewLoading && invite ? (
          <div className="mt-6 rounded-[1.2rem] border border-orange-500/20 bg-orange-500/10 p-4">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-white/45">Groupe cible</p>
            <p className="mt-2 text-lg font-semibold text-white">{invite.workspaceName}</p>
            <p className="mt-2 text-[0.72rem] uppercase tracking-[0.14em] text-orange-200">
              Statut du lien: {invite.status}
            </p>
          </div>
        ) : null}

        {(localError || successMessage) && (
          <div className="mt-5 space-y-2">
            {localError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-[0.78rem] text-red-300">
                {localError}
              </div>
            ) : null}
            {successMessage ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-[0.78rem] text-emerald-300">
                {successMessage}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={loading || previewLoading || !invite || isUnavailable}
            className="w-full rounded-2xl bg-white px-4 py-4 text-[0.72rem] font-black uppercase tracking-[0.2em] text-[#0c0d10] transition hover:bg-orange-500 hover:text-white disabled:bg-white/10 disabled:text-white/40"
          >
            {loading ? 'Connexion au groupe...' : 'Rejoindre ce groupe'}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full text-center text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/50 transition hover:text-white"
          >
            Continuer sans ce lien
          </button>
        </div>
      </div>
    </div>
  );
}
