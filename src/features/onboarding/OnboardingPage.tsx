import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  completeCurrentProfileOnboarding,
  getCurrentProfile,
  getGeneratedAvatar,
  getProfileAvatarUrl,
  normalizeDisplayName,
  updateCurrentProfileDisplayName,
  uploadCurrentProfileAvatar,
  type Profile,
} from '@/services/supabase/profile';
import { createWorkspaceInviteLink, type Workspace } from '@/services/supabase/workspace';
import { startGoogleDriveConnection } from '@/services/supabase/workspaceStorage';
import { Button } from '@/ui/components/Button';
import { TextField } from '@/ui/components/TextField';
import { FaderLogo } from '@/ui/components/FaderLogo';
import { FzIcon } from '@/ui/icons';

type Step = 'identity' | 'choice' | 'group-name' | 'storage' | 'invite' | 'done';

interface PersistedSetup {
  step: Exclude<Step, 'identity' | 'choice'>;
  workspaceId: string;
}

const SETUP_STORAGE_KEY = 'faderzero_group_setup';

function readPersistedSetup(): PersistedSetup | null {
  try {
    const value = JSON.parse(localStorage.getItem(SETUP_STORAGE_KEY) ?? 'null');
    if (!value || typeof value.workspaceId !== 'string' || !['storage', 'invite', 'done'].includes(value.step)) return null;
    return value as PersistedSetup;
  } catch {
    return null;
  }
}

function writePersistedSetup(value: PersistedSetup | null) {
  try {
    if (!value) localStorage.removeItem(SETUP_STORAGE_KEY);
    else localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(value));
  } catch {}
}

function getOAuthResult() {
  const search = new URLSearchParams(window.location.search);
  const workspaceId = search.get('workspace');
  const result = search.get('storage');
  return workspaceId && result ? { workspaceId, result } : null;
}

export function OnboardingPage({ startGroupCreation = false }: { startGroupCreation?: boolean }) {
  const navigate = useNavigate();
  const { workspaces, createWorkspace, setActiveWorkspace } = useAuthStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState<Step>(startGroupCreation ? 'group-name' : 'identity');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void getCurrentProfile().then(async (current) => {
      if (!active) return;
      setProfile(current);
      setDisplayName(current.displayName);
      const imageUrl = await getProfileAvatarUrl(current.avatarPath);
      if (active) setAvatarUrl(imageUrl);

      const persisted = readPersistedSetup();
      const oauthResult = getOAuthResult();
      const workspaceId = oauthResult?.workspaceId ?? persisted?.workspaceId;
      const currentWorkspace = workspaces.find((item) => item.id === workspaceId) ?? null;
      if (currentWorkspace) {
        setWorkspace(currentWorkspace);
        setActiveWorkspace(currentWorkspace);
        setStep(oauthResult?.result === 'connected' ? 'invite' : persisted?.step ?? 'storage');
        if (oauthResult?.result === 'connected') setMessage('Google Drive est connecté. Tu peux maintenant inviter ton groupe.');
        else if (oauthResult) setError('La connexion Google Drive n’a pas abouti. Tu peux réessayer ou continuer sans stockage.');
        window.history.replaceState({}, '', window.location.pathname);
      } else if (current.onboardingCompletedAt && !startGroupCreation) {
        navigate('/home', { replace: true });
      }
    }).catch(() => { if (active) setError('Impossible de charger ton profil.'); });
    return () => { active = false; };
  }, [navigate, setActiveWorkspace, startGroupCreation, workspaces]);

  const generatedAvatar = profile ? getGeneratedAvatar(displayName || profile.displayName, profile.id) : null;

  async function saveIdentity() {
    setBusy(true); setError(null);
    try {
      const nextProfile = await updateCurrentProfileDisplayName(normalizeDisplayName(displayName));
      setProfile(nextProfile);
      setStep('choice');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer le pseudo.');
    } finally { setBusy(false); }
  }

  async function selectSong() {
    setBusy(true); setError(null);
    try {
      await completeCurrentProfileOnboarding();
      writePersistedSetup(null);
      const personal = workspaces.find((item) => item.type === 'personal');
      if (personal) setActiveWorkspace(personal);
      navigate('/songs/new/write', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de terminer l’accueil.');
    } finally { setBusy(false); }
  }

  async function createGroup() {
    if (!groupName.trim()) return;
    setBusy(true); setError(null);
    try {
      const nextWorkspace = await createWorkspace(groupName.trim());
      setWorkspace(nextWorkspace);
      writePersistedSetup({ step: 'storage', workspaceId: nextWorkspace.id });
      setStep('storage');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de créer le groupe.');
    } finally { setBusy(false); }
  }

  function continueWithoutStorage() {
    if (!workspace) return;
    writePersistedSetup({ step: 'invite', workspaceId: workspace.id });
    setStep('invite');
    setMessage('Le groupe peut déjà utiliser le texte et les liens. Tu pourras connecter Google Drive plus tard.');
  }

  async function connectGoogleDrive() {
    if (!workspace) return;
    setBusy(true); setError(null);
    try {
      window.location.assign(await startGoogleDriveConnection(workspace.id, 'onboarding'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de démarrer la connexion Google Drive.');
      setBusy(false);
    }
  }

  async function createInvite() {
    if (!workspace) return;
    setBusy(true); setError(null);
    try {
      const invite = await createWorkspaceInviteLink(workspace.id, 'member');
      setInviteUrl(invite.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de créer le lien d’invitation.');
    } finally { setBusy(false); }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage('Lien d’invitation copié.');
    } catch { setError('Impossible de copier le lien.'); }
  }

  async function shareInvite() {
    if (!inviteUrl) return;
    if (navigator.share) {
      try { await navigator.share({ title: `Rejoins ${workspace?.name ?? 'mon groupe'} sur FaderZero`, url: inviteUrl }); }
      catch {}
    } else await copyInvite();
  }

  async function finish(next: 'song' | 'epk' | 'members' | 'home') {
    if (!workspace) return;
    setBusy(true); setError(null);
    try {
      await completeCurrentProfileOnboarding();
      writePersistedSetup(null);
      setActiveWorkspace(workspace);
      const destinations = {
        song: '/songs/new/write', epk: '/account/epk', members: `/account?view=group-members&workspace=${workspace.id}`, home: '/home',
      } as const;
      navigate(destinations[next], { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de terminer la création du groupe.');
    } finally { setBusy(false); }
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const nextProfile = await uploadCurrentProfileAvatar(file);
      setProfile(nextProfile);
      setAvatarUrl(await getProfileAvatarUrl(nextProfile.avatarPath));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible d’ajouter cette photo.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--fz-bg)] px-4 py-8 text-[var(--fz-text)]">
      <section className="w-full max-w-md space-y-6 rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="flex justify-center"><div role="img" aria-label="FaderZero"><FaderLogo className="h-[54px] w-[147px] text-white" preserveAspectRatio="none" /></div></div>
        <p className="text-center text-xs font-black uppercase tracking-[0.18em] text-white/45">Étape {step === 'identity' ? '1' : step === 'choice' ? '2' : step === 'group-name' ? '3' : step === 'storage' ? '4' : step === 'invite' ? '5' : '6'} sur 6</p>
        {error ? <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</p> : null}
        {message ? <p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</p> : null}

        {step === 'identity' ? <section className="space-y-5"><div className="text-center"><h1 className="text-2xl font-black">Ton profil FaderZero</h1><p className="mt-2 text-sm text-white/60">Choisis le nom que ton groupe verra.</p></div><div className="flex items-center gap-4"><button type="button" onClick={() => inputRef.current?.click()} aria-label="Ajouter une photo de profil" className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 text-lg font-black text-white" style={{ backgroundColor: `hsl(${generatedAvatar?.hue ?? 24} 72% 42%)` }}>{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : generatedAvatar?.initials}</button><input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadAvatar(event.target.files?.[0])} /><div className="min-w-0 flex-1"><label htmlFor="onboardingPseudo" className="fz-field-label">Pseudo</label><TextField id="onboardingPseudo" value={displayName} minLength={2} maxLength={30} autoComplete="nickname" onChange={(event) => setDisplayName(event.target.value)} /></div></div><p className="text-xs text-white/50">La photo est facultative. Sans photo, la pastille affiche tes initiales.</p><Button variant="primary" size="lg" fullWidth loading={busy} onClick={() => void saveIdentity()}>Continuer</Button></section> : null}

        {step === 'choice' ? <section className="space-y-4"><div className="text-center"><h1 className="text-2xl font-black">Par quoi veux-tu commencer ?</h1><p className="mt-2 text-sm text-white/60">Tu pourras toujours faire l’autre ensuite.</p></div><Button variant="primary" size="lg" fullWidth loading={busy} leadingIcon={<FzIcon name="music" usageId="onboarding.choice.song" size="sm" />} onClick={() => void selectSong()}>Créer un morceau</Button><Button variant="secondary" size="lg" fullWidth leadingIcon={<FzIcon name="users" usageId="onboarding.choice.group" size="sm" />} onClick={() => setStep('group-name')}>Créer un groupe</Button></section> : null}

        {step === 'group-name' ? <section className="space-y-5"><div><h1 className="text-2xl font-black">Crée ton groupe</h1><p className="mt-2 text-sm text-white/60">Son nom est visible par toutes les personnes invitées.</p></div><div><label htmlFor="onboardingGroupName" className="fz-field-label">Nom du groupe</label><TextField id="onboardingGroupName" value={groupName} autoComplete="organization" placeholder="Ex. Les Satellites" onChange={(event) => setGroupName(event.target.value)} /></div><Button variant="primary" size="lg" fullWidth loading={busy} disabled={!groupName.trim()} onClick={() => void createGroup()}>Créer le groupe</Button><Button variant="ghost" fullWidth onClick={() => setStep('choice')}>Retour</Button></section> : null}

        {step === 'storage' ? <section className="space-y-5"><div><h1 className="text-2xl font-black">Où stocker les fichiers ?</h1><p className="mt-2 text-sm text-white/60">Google Drive sera le stockage commun de {workspace?.name}.</p></div><article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-start gap-3"><FzIcon name="folder" usageId="onboarding.storage.drive" size="lg" /><div><h2 className="font-bold">Google Drive</h2><p className="mt-1 text-sm text-white/60">Connexion gratuite, dossier privé créé automatiquement pour le groupe.</p></div></div><Button className="mt-4" variant="primary" fullWidth loading={busy} onClick={() => void connectGoogleDrive()}>Connecter Google Drive</Button></article><article className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 opacity-60"><h2 className="font-bold">FaderZero Cloud</h2><p className="mt-1 text-sm text-white/60">À venir pour les nouveaux groupes.</p></article><div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-50"><p className="font-bold">Continuer sans stockage</p><p className="mt-1 text-amber-100/80">Le groupe pourra utiliser le texte et les liens. Les audios, photos et documents resteront indisponibles jusqu’à la connexion d’un stockage.</p><Button className="mt-4" variant="secondary" fullWidth onClick={continueWithoutStorage}>Ignorer pour le moment</Button></div></section> : null}

        {step === 'invite' ? <section className="space-y-5"><div><h1 className="text-2xl font-black">Invite ton groupe</h1><p className="mt-2 text-sm text-white/60">Un lien suffit pour rejoindre {workspace?.name}.</p></div>{inviteUrl ? <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="break-all text-sm text-white/80">{inviteUrl}</p><div className="grid grid-cols-2 gap-3"><Button variant="secondary" fullWidth onClick={() => void copyInvite()}>Copier</Button><Button variant="primary" fullWidth onClick={() => void shareInvite()}>Partager</Button></div></div> : <Button variant="primary" size="lg" fullWidth loading={busy} leadingIcon={<FzIcon name="users" usageId="onboarding.invite.create" size="sm" />} onClick={() => void createInvite()}>Créer un lien d’invitation</Button>}<Button variant="ghost" fullWidth onClick={() => { if (workspace) { writePersistedSetup({ step: 'done', workspaceId: workspace.id }); setStep('done'); } }}>Continuer sans inviter</Button>{inviteUrl ? <Button variant="secondary" fullWidth onClick={() => { if (workspace) { writePersistedSetup({ step: 'done', workspaceId: workspace.id }); setStep('done'); } }}>Continuer</Button> : null}</section> : null}

        {step === 'done' ? <section className="space-y-4"><div className="text-center"><h1 className="text-2xl font-black">{workspace?.name} est prêt</h1><p className="mt-2 text-sm text-white/60">Choisis ta première action.</p></div><Button variant="primary" size="lg" fullWidth leadingIcon={<FzIcon name="music" usageId="onboarding.done.song" size="sm" />} loading={busy} onClick={() => void finish('song')}>Créer un morceau</Button><Button variant="secondary" size="lg" fullWidth leadingIcon={<FzIcon name="file-text" usageId="onboarding.done.epk" size="sm" />} onClick={() => void finish('epk')}>Créer un EPK</Button><Button variant="secondary" size="lg" fullWidth leadingIcon={<FzIcon name="users" usageId="onboarding.done.members" size="sm" />} onClick={() => void finish('members')}>Inviter des membres</Button><Button variant="ghost" fullWidth onClick={() => void finish('home')}>Explorer le groupe</Button></section> : null}
      </section>
    </main>
  );
}
