import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { Button } from '@/ui/components/Button';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { TextField } from '@/ui/components/TextField';
import { TextArea } from '@/ui/components/TextArea';
import { SelectField } from '@/ui/components/SelectField';
import { useAuthStore } from '@/stores/authStore';
import { canAdministerWorkspace } from '@/services/supabase/workspace';
import { addEpkContact, addEpkLink, addEpkVideo, createEpk, deleteEpkContact, deleteEpkLink, deleteEpkVideo, getEpk, getEpkCompleteness, listEpkContacts, listEpkLinks, listEpkVideos, saveEpk, setEpkStatus, type EpkContact, type EpkContactRole, type EpkLink, type EpkLinkKind, type EpkRecord, type EpkTheme, type EpkVideo, type EpkVideoType } from './epk';

const THEMES: Array<{ value: EpkTheme; label: string }> = [
  { value: 'stage-dark', label: 'Noir scène' }, { value: 'midnight-blue', label: 'Bleu nuit' }, { value: 'press-ivory', label: 'Ivoire presse' }, { value: 'fader-red', label: 'Rouge FaderZero' },
];

export function EpkPage() {
  const navigate = useNavigate();
  const workspace = useAuthStore((state) => state.activeWorkspace);
  const [epk, setEpk] = useState<EpkRecord | null>(null);
  const [genresText, setGenresText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [contacts, setContacts] = useState<EpkContact[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRole, setContactRole] = useState<EpkContactRole>('BAND');
  const [videos, setVideos] = useState<EpkVideo[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoType, setVideoType] = useState<EpkVideoType>('LIVE');
  const [links, setLinks] = useState<EpkLink[]>([]);
  const [linkKind, setLinkKind] = useState<EpkLinkKind>('WEBSITE');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const isAdmin = workspace?.type === 'group' && canAdministerWorkspace(workspace.role);

  useEffect(() => {
    let active = true;
    if (!workspace || !isAdmin) { setLoading(false); return; }
    void getEpk(workspace.id).then((value) => {
      if (!active) return;
      setEpk(value); setGenresText(value?.genres.join(', ') ?? '');
      if (value) {
        void Promise.all([listEpkContacts(value.id), listEpkVideos(value.id), listEpkLinks(value.id)]).then(([contactItems, videoItems, linkItems]) => {
          if (!active) return;
          setContacts(contactItems); setVideos(videoItems); setLinks(linkItems);
        });
      }
    }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : 'Impossible de charger l’EPK.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin, workspace]);

  async function createDraft() {
    if (!workspace) return;
    setSaving(true); setMessage(null);
    try { const value = await createEpk(workspace.id, workspace.name); setEpk(value); setGenresText(''); setMessage('Brouillon EPK créé.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Création impossible.'); }
    finally { setSaving(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!epk) return;
    const formData = new FormData(event.currentTarget);
    const nextEpk: EpkRecord = {
      ...epk,
      displayName: String(formData.get('displayName') ?? ''),
      slug: String(formData.get('slug') ?? ''),
      genres: String(formData.get('genres') ?? '').split(',').map((genre) => genre.trim()).filter(Boolean),
      city: String(formData.get('city') ?? ''),
      country: String(formData.get('country') ?? ''),
      tagline: String(formData.get('tagline') ?? ''),
      theme: String(formData.get('theme') ?? 'stage-dark') as EpkTheme,
    };
    setSaving(true); setMessage(null);
    try {
      const value = await saveEpk(nextEpk);
      setEpk(value); setGenresText(value.genres.join(', ')); setMessage('Section identité enregistrée.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  }
  async function togglePublication() {
    if (!epk) return;
    setSaving(true); setMessage(null);
    try { const value = await setEpkStatus(epk.id, epk.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'); setEpk(value); setMessage(value.status === 'PUBLISHED' ? 'EPK publié.' : 'EPK dépublié.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Publication impossible : complétez les champs requis.'); }
    finally { setSaving(false); }
  }
  async function savePresentation() {
    if (!epk) return;
    setSaving(true); setMessage(null);
    try { const value = await saveEpk(epk); setEpk(value); setMessage('Présentation enregistrée.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  }
  async function addContact() {
    if (!epk) return;
    setSaving(true); setMessage(null);
    try { const contact = await addEpkContact(epk.id, { name: contactName, email: contactEmail, role: contactRole }, contacts.length); setContacts((items) => [...items, contact]); setContactName(''); setContactEmail(''); setMessage('Contact ajouté.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout du contact impossible.'); }
    finally { setSaving(false); }
  }
  async function removeContact(contact: EpkContact) {
    setSaving(true); setMessage(null);
    try { await deleteEpkContact(contact.id); setContacts((items) => items.filter((item) => item.id !== contact.id)); setMessage('Contact supprimé.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); }
    finally { setSaving(false); }
  }
  async function addVideo() {
    if (!epk) return;
    setSaving(true); setMessage(null);
    try { const video = await addEpkVideo(epk.id, { url: videoUrl, title: videoTitle, videoType }, videos.length); setVideos((items) => [...items, video]); setVideoUrl(''); setVideoTitle(''); setMessage('Vidéo ajoutée.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout de la vidéo impossible.'); }
    finally { setSaving(false); }
  }
  async function removeVideo(video: EpkVideo) {
    setSaving(true); setMessage(null);
    try { await deleteEpkVideo(video.id); setVideos((items) => items.filter((item) => item.id !== video.id)); setMessage('Vidéo supprimée.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); }
    finally { setSaving(false); }
  }
  async function addLink() {
    if (!epk) return;
    setSaving(true); setMessage(null);
    try { const link = await addEpkLink(epk.id, { kind: linkKind, label: linkLabel, url: linkUrl }, links.length); setLinks((items) => [...items, link]); setLinkUrl(''); setLinkLabel(''); setMessage('Lien ajouté.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout du lien impossible.'); }
    finally { setSaving(false); }
  }
  async function removeLink(link: EpkLink) {
    setSaving(true); setMessage(null);
    try { await deleteEpkLink(link.id); setLinks((items) => items.filter((item) => item.id !== link.id)); setMessage('Lien supprimé.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); }
    finally { setSaving(false); }
  }

  if (!isAdmin) return <div className="p-4 text-sm text-white/65">L’EPK public est réservé aux administrateurs d’un groupe.</div>;
  if (loading) return <div className="p-4 text-sm text-white/65">Chargement de l’EPK…</div>;
  if (!epk) return <div className="space-y-4"><DetailHeader title="EPK public" onBack={() => navigate('/account?tab=groupe')} backLabel="Retour aux paramètres" /><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-white/70">Créez un brouillon pour préparer votre kit de presse public.</p><Button variant="primary" fullWidth loading={saving} onClick={() => void createDraft()}>Créer l’EPK</Button>{message ? <p className="mt-3 text-sm text-amber-300">{message}</p> : null}</div></div>;

  return <div className="space-y-5 pb-6"><DetailHeader title="EPK public" subtitle={epk.status === 'PUBLISHED' ? 'Publié' : 'Brouillon'} onBack={() => navigate('/account?tab=groupe')} backLabel="Retour aux paramètres" />
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-white">Complétude</p><p className="text-sm text-amber-300">{getEpkCompleteness(epk, contacts.length)} %</p></div><p className="text-xs text-white/55">Ajoutez une image ou un média principal et un contact pour publier.</p><Button variant={epk.status === 'PUBLISHED' ? 'secondary' : 'primary'} fullWidth loading={saving} onClick={() => void togglePublication()}>{epk.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}</Button></section>
    <form className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4" onSubmit={(event) => void save(event)}><h2 className="text-base font-black text-white">Identité</h2>
      <div><FieldLabel htmlFor="epk-name" required>Nom public</FieldLabel><TextField id="epk-name" name="displayName" value={epk.displayName} onChange={(event) => setEpk({ ...epk, displayName: event.target.value })} /></div>
      <div><FieldLabel htmlFor="epk-slug" required>Slug</FieldLabel><TextField id="epk-slug" name="slug" value={epk.slug} onChange={(event) => setEpk({ ...epk, slug: event.target.value })} /><p className="mt-1 text-xs text-white/45">faderzero.com/{epk.slug}</p></div>
      <div><FieldLabel htmlFor="epk-genres" required>Genres</FieldLabel><TextField id="epk-genres" name="genres" value={genresText} onChange={(event) => setGenresText(event.target.value)} placeholder="Rock, indie" /><p className="mt-1 text-xs text-white/45">Séparez les genres par une virgule.</p></div>
      <div className="grid grid-cols-2 gap-3"><div><FieldLabel htmlFor="epk-city" required>Ville</FieldLabel><TextField id="epk-city" name="city" value={epk.city ?? ''} onChange={(event) => setEpk({ ...epk, city: event.target.value })} /></div><div><FieldLabel htmlFor="epk-country" optional>Pays</FieldLabel><TextField id="epk-country" name="country" value={epk.country ?? ''} onChange={(event) => setEpk({ ...epk, country: event.target.value })} /></div></div>
      <div><FieldLabel htmlFor="epk-tagline" optional>Accroche</FieldLabel><TextArea id="epk-tagline" name="tagline" rows={2} value={epk.tagline ?? ''} onChange={(event) => setEpk({ ...epk, tagline: event.target.value })} /></div>
      <div><FieldLabel htmlFor="epk-theme">Thème</FieldLabel><SelectField id="epk-theme" name="theme" value={epk.theme} onChange={(event) => setEpk({ ...epk, theme: event.target.value as EpkTheme })}>{THEMES.map((theme) => <option key={theme.value} value={theme.value}>{theme.label}</option>)}</SelectField></div>
      <Button type="submit" variant="secondary" fullWidth loading={saving}>Enregistrer l’identité</Button>{message ? <p role="status" className="text-sm text-amber-300">{message}</p> : null}
    </form>
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4"><h2 className="text-base font-black text-white">Présentation</h2><div><FieldLabel htmlFor="epk-short-bio" optional>Bio courte</FieldLabel><TextArea id="epk-short-bio" rows={4} value={epk.shortBio ?? ''} onChange={(event) => setEpk({ ...epk, shortBio: event.target.value })} /></div><div><FieldLabel htmlFor="epk-full-bio" optional>Bio complète</FieldLabel><TextArea id="epk-full-bio" rows={7} value={epk.fullBio ?? ''} onChange={(event) => setEpk({ ...epk, fullBio: event.target.value })} /><p className="mt-1 text-xs text-white/45">La page publique replie ce texte derrière « Lire la suite ».</p></div><Button variant="secondary" fullWidth loading={saving} onClick={() => void savePresentation()}>Enregistrer la présentation</Button></section>
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4"><h2 className="text-base font-black text-white">Contacts</h2>{contacts.map((contact) => <div key={contact.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3"><div className="min-w-0"><p className="font-semibold text-white">{contact.name}</p><p className="truncate text-xs text-white/55">{contact.email ?? contact.phone ?? contact.whatsapp}</p></div><Button variant="danger" loading={saving} onClick={() => void removeContact(contact)}>Supprimer</Button></div>)}<div className="space-y-3 border-t border-white/10 pt-4"><div><FieldLabel htmlFor="epk-contact-name" required>Nom</FieldLabel><TextField id="epk-contact-name" value={contactName} onChange={(event) => setContactName(event.target.value)} /></div><div><FieldLabel htmlFor="epk-contact-role">Rôle</FieldLabel><SelectField id="epk-contact-role" value={contactRole} onChange={(event) => setContactRole(event.target.value as EpkContactRole)}><option value="BAND">Groupe</option><option value="BOOKING">Booking</option><option value="MANAGEMENT">Management</option><option value="TECH">Technique</option><option value="PRESS">Presse</option><option value="PRODUCTION">Production</option><option value="OTHER">Autre</option></SelectField></div><div><FieldLabel htmlFor="epk-contact-email" required>E-mail</FieldLabel><TextField id="epk-contact-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></div><Button variant="secondary" fullWidth loading={saving} onClick={() => void addContact()}>Ajouter le contact</Button></div></section>
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4"><h2 className="text-base font-black text-white">Vidéos</h2>{videos.map((video) => <div key={video.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3"><div className="min-w-0"><p className="font-semibold text-white">{video.title || `${video.provider} · ${video.videoType}`}</p><p className="truncate text-xs text-white/55">{video.providerVideoId}</p></div><Button variant="danger" loading={saving} onClick={() => void removeVideo(video)}>Supprimer</Button></div>)}<div className="space-y-3 border-t border-white/10 pt-4"><div><FieldLabel htmlFor="epk-video-url" required>URL YouTube ou Vimeo</FieldLabel><TextField id="epk-video-url" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} /></div><div><FieldLabel htmlFor="epk-video-title" optional>Titre</FieldLabel><TextField id="epk-video-title" value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)} /></div><div><FieldLabel htmlFor="epk-video-type">Type</FieldLabel><SelectField id="epk-video-type" value={videoType} onChange={(event) => setVideoType(event.target.value as EpkVideoType)}><option value="LIVE">Live</option><option value="LIVE_SESSION">Session live</option><option value="MUSIC_VIDEO">Clip</option><option value="INTERVIEW">Interview</option><option value="OTHER">Autre</option></SelectField></div><Button variant="secondary" fullWidth loading={saving} onClick={() => void addVideo()}>Ajouter la vidéo</Button></div></section>
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4"><h2 className="text-base font-black text-white">Liens</h2>{links.map((link) => <div key={link.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3"><div className="min-w-0"><p className="font-semibold text-white">{link.label || link.kind}</p><p className="truncate text-xs text-white/55">{link.url}</p></div><Button variant="danger" loading={saving} onClick={() => void removeLink(link)}>Supprimer</Button></div>)}<div className="space-y-3 border-t border-white/10 pt-4"><div><FieldLabel htmlFor="epk-link-kind">Type</FieldLabel><SelectField id="epk-link-kind" value={linkKind} onChange={(event) => setLinkKind(event.target.value as EpkLinkKind)}><option value="WEBSITE">Site web</option><option value="SPOTIFY">Spotify</option><option value="APPLE_MUSIC">Apple Music</option><option value="DEEZER">Deezer</option><option value="YOUTUBE">YouTube</option><option value="INSTAGRAM">Instagram</option><option value="FACEBOOK">Facebook</option><option value="TIKTOK">TikTok</option><option value="CUSTOM">Personnalisé</option></SelectField></div><div><FieldLabel htmlFor="epk-link-label" optional>Libellé</FieldLabel><TextField id="epk-link-label" value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} /></div><div><FieldLabel htmlFor="epk-link-url" required>URL https</FieldLabel><TextField id="epk-link-url" type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} /></div><Button variant="secondary" fullWidth loading={saving} onClick={() => void addLink()}>Ajouter le lien</Button></div></section>
    <section className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-white/55">Les photos, documents et pistes audio seront ajoutés dans les prochaines sections du back-office.</section>
  </div>;
}
