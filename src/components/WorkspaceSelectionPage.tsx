import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { extractWorkspaceInviteToken } from '@/services/supabase/workspace';

export function WorkspaceSelectionPage() {
  const { workspaces, createWorkspace, joinWorkspaceByInvite, setActiveWorkspace, signOut, loading, error } = useAuthStore();
  const [newWsName, setNewWsName] = useState('');
  const [inviteLinkValue, setInviteLinkValue] = useState('');
  const [joinInviteFeedback, setJoinInviteFeedback] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(workspaces.length === 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newWsName.trim() || loading) return;
    try {
      await createWorkspace(newWsName.trim());
      setNewWsName('');
    } catch (err) {
      console.error(err);
    }
  }

  async function handleJoinWithLink(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    const inviteToken = extractWorkspaceInviteToken(inviteLinkValue);
    if (!inviteToken) {
      setJoinInviteFeedback("Collez un lien d'invitation valide.");
      return;
    }

    setJoinInviteFeedback(null);

    try {
      const workspace = await joinWorkspaceByInvite(inviteToken);
      setInviteLinkValue('');
      setJoinInviteFeedback(`Vous avez rejoint ${workspace.name}.`);
    } catch (err) {
      setJoinInviteFeedback(err instanceof Error ? err.message : 'Impossible de rejoindre ce groupe.');
      console.error(err);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c0d10] px-4 text-[#f5f0ea]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[40%] h-[80%] w-[80%] rounded-full bg-orange-600/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[40%] h-[80%] w-[80%] rounded-full bg-amber-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md rounded-[1.8rem] border border-white/10 bg-white/5 p-8 shadow-[0_32px_64px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="mb-8 text-center">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.15)]">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-white">Vos espaces</h1>
          <p className="mt-1 text-[0.72rem] uppercase tracking-[0.16em] text-white/50">Selectionnez ou creez votre espace</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-[0.75rem] text-red-400">
            {error}
          </div>
        )}

        {!showCreateForm && workspaces.length > 0 ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="mb-3 text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/60">Mon espace et mes groupes</p>
              <div className="max-h-[220px] space-y-2.5 overflow-y-auto pr-1">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => setActiveWorkspace(ws)}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-orange-500/50 hover:bg-white/10"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-white">{ws.name}</span>
                      <span className="mt-1 block text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white/40">
                        {ws.type === 'personal' ? 'Personnel' : 'Groupe'}
                      </span>
                    </span>
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-orange-400">Ouvrir -&gt;</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full rounded-2xl border border-dashed border-white/20 bg-transparent px-4 py-3.5 text-[0.72rem] font-black uppercase tracking-[0.2em] text-white transition hover:border-orange-500/50 hover:text-orange-400"
              >
                + Creer un nouveau groupe
              </button>
              <button
                onClick={() => signOut()}
                className="w-full py-2 text-center text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/40 transition hover:text-red-400"
              >
                Deconnexion
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label htmlFor="wsName" className="mb-2 block text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/60">
                  Nom du groupe / workspace
                </label>
                <input
                  id="wsName"
                  type="text"
                  required
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="Ex: Mon Super Groupe"
                  disabled={loading}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/20 transition focus:border-orange-500/50 focus:bg-white/10 focus:outline-none focus:ring-0"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading || !newWsName.trim()}
                  className="w-full rounded-2xl bg-white px-4 py-4 text-[0.72rem] font-black uppercase tracking-[0.2em] text-[#0c0d10] shadow-lg transition hover:bg-orange-500 hover:text-white disabled:bg-white/10 disabled:text-white/40"
                >
                  {loading ? 'Creation...' : 'Creer et rejoindre'}
                </button>
              </div>
            </form>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/35">ou</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleJoinWithLink} className="space-y-4 rounded-[1.4rem] border border-orange-500/15 bg-orange-500/8 p-4">
              <div>
                <label htmlFor="workspaceInviteLink" className="mb-2 block text-[0.68rem] font-black uppercase tracking-[0.18em] text-orange-200/80">
                  Rejoindre avec un lien
                </label>
                <input
                  id="workspaceInviteLink"
                  type="text"
                  value={inviteLinkValue}
                  onChange={(e) => setInviteLinkValue(e.target.value)}
                  placeholder="Collez ici votre lien d'invitation"
                  disabled={loading}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white placeholder-white/20 transition focus:border-orange-500/50 focus:bg-white/10 focus:outline-none focus:ring-0"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !inviteLinkValue.trim()}
                className="w-full rounded-2xl border border-orange-400/30 bg-orange-500/12 px-4 py-4 text-[0.72rem] font-black uppercase tracking-[0.2em] text-orange-100 transition hover:bg-orange-500/20 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/40"
              >
                {loading ? 'Connexion...' : 'Rejoindre via le lien'}
              </button>

              {joinInviteFeedback ? <p className="text-[0.75rem] text-white/70">{joinInviteFeedback}</p> : null}
            </form>

            {workspaces.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="w-full py-2 text-center text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/60 transition hover:text-white"
              >
                Annuler
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full py-2 text-center text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/40 transition hover:text-red-400"
              >
                Deconnexion
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
