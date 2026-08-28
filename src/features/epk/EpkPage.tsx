import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { Button } from '@/ui/components/Button';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { TextField } from '@/ui/components/TextField';
import { TextArea } from '@/ui/components/TextArea';
import { SelectField } from '@/ui/components/SelectField';
import { FzIcon } from '@/ui/icons';
import { useAuthStore } from '@/stores/authStore';
import { canAdministerWorkspace } from '@/services/supabase/workspace';
import { addEpkContact, addEpkDocument, addEpkLink, addEpkPhoto, addEpkTrack, addEpkVideo, createEpk, deleteEpkContact, deleteEpkDocument, deleteEpkLink, deleteEpkPhoto, deleteEpkTrack, deleteEpkVideo, getEpk, getEpkCompleteness, listAvailableEpkTracks, listEpkContacts, listEpkDocuments, listEpkLinks, listEpkPhotos, listEpkTracks, listEpkVideos, saveEpk, setEpkStatus, uploadEpkHeroImage, type AvailableEpkTrack, type EpkContact, type EpkContactRole, type EpkDocument, type EpkDocumentType, type EpkLink, type EpkLinkKind, type EpkPhoto, type EpkRecord, type EpkTrack, type EpkVideo, type EpkVideoType } from './epk';
import { EpkPublicView } from './EpkPublicView';
import { EpkEditorFields } from './EpkEditorFields';
import { DEFAULT_EPK_ACCENT, DEFAULT_EPK_EDITORIAL, DEFAULT_EPK_SECTION_ORDER, type EpkPublicModel } from './epkPresentation';

const ACCENT_SWATCHES = [
  { value: '#ff3a63', label: 'Rose FaderZero', className: 'bg-[#ff3a63]' }, { value: '#f97316', label: 'Orange', className: 'bg-orange-500' },
  { value: '#facc15', label: 'Jaune', className: 'bg-yellow-400' }, { value: '#4ade80', label: 'Vert', className: 'bg-green-400' },
  { value: '#2dd4bf', label: 'Turquoise', className: 'bg-teal-400' }, { value: '#38bdf8', label: 'Bleu ciel', className: 'bg-sky-400' },
  { value: '#818cf8', label: 'Indigo', className: 'bg-indigo-400' }, { value: '#c084fc', label: 'Violet', className: 'bg-purple-400' },
] as const;

export function EpkPage() {
  const navigate = useNavigate();
  const workspace = useAuthStore((state) => state.activeWorkspace);
  const [epk, setEpk] = useState<EpkRecord | null>(null);
  const [showPreview, setShowPreview] = useState(false);
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
  const [photos, setPhotos] = useState<EpkPhoto[]>([]);
  const [documents, setDocuments] = useState<EpkDocument[]>([]);
  const [tracks, setTracks] = useState<EpkTrack[]>([]);
  const [availableTracks, setAvailableTracks] = useState<AvailableEpkTrack[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCredit, setPhotoCredit] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentType, setDocumentType] = useState<EpkDocumentType>('TECH_RIDER');
  const [documentUpdatedAt, setDocumentUpdatedAt] = useState(new Date().toISOString().slice(0, 10));
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [linkKind, setLinkKind] = useState<EpkLinkKind>('WEBSITE');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const autosaveTimer = useRef<number | null>(null);
  const isAdmin = workspace?.type === 'group' && canAdministerWorkspace(workspace.role);

  useEffect(() => {
    let active = true;
    if (!workspace || !isAdmin) { setLoading(false); return; }
    void getEpk(workspace.id).then((value) => {
      if (!active) return;
      setEpk(value); setGenresText(value?.genres.join(', ') ?? '');
      if (value) {
        void Promise.all([listEpkContacts(value.id), listEpkVideos(value.id), listEpkLinks(value.id), listEpkPhotos(value.id), listEpkDocuments(value.id), listEpkTracks(value.id), listAvailableEpkTracks(value.workspaceId)]).then(([contactItems, videoItems, linkItems, photoItems, documentItems, trackItems, availableTrackItems]) => {
          if (!active) return;
          setContacts(contactItems); setVideos(videoItems); setLinks(linkItems); setPhotos(photoItems); setDocuments(documentItems); setTracks(trackItems); setAvailableTracks(availableTrackItems);
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
      theme: epk.theme,
      accentColor: epk.accentColor ?? DEFAULT_EPK_ACCENT,
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
    try { await saveEpk(epk); setMessage('Présentation enregistrée.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  }
  function updateDraft(next: EpkRecord) {
    setEpk(next);
    if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      setSaving(true); setMessage(null);
      void saveEpk(next).then(() => {
        setMessage('Brouillon enregistré.');
      }).catch((error: unknown) => setMessage(getEpkErrorMessage(error, 'Enregistrement du brouillon impossible.'))).finally(() => setSaving(false));
    }, 700);
  }
  useEffect(() => () => { if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current); }, []);
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
  async function addPhoto() { if (!epk || !photoFile) return; setSaving(true); setMessage(null); try { const photo = await addEpkPhoto(epk, photoFile, { credit: photoCredit }, photos.length); setPhotos((items) => [...items, photo]); setPhotoFile(null); setPhotoCredit(''); setMessage('Photo ajoutée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout de la photo impossible.'); } finally { setSaving(false); } }
  async function removePhoto(photo: EpkPhoto) { setSaving(true); setMessage(null); try { await deleteEpkPhoto(photo); setPhotos((items) => items.filter((item) => item.id !== photo.id)); setMessage('Photo supprimée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); } finally { setSaving(false); } }
  async function addDocument() { if (!epk || !documentFile) return; setSaving(true); setMessage(null); try { const document = await addEpkDocument(epk, documentFile, { title: documentTitle, documentType, documentUpdatedAt }, documents.length); setDocuments((items) => [...items, document]); setDocumentFile(null); setDocumentTitle(''); setMessage('Document ajouté.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout du document impossible.'); } finally { setSaving(false); } }
  async function removeDocument(document: EpkDocument) { setSaving(true); setMessage(null); try { await deleteEpkDocument(document); setDocuments((items) => items.filter((item) => item.id !== document.id)); setMessage('Document supprimé.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); } finally { setSaving(false); } }
  async function addTrack() { if (!epk) return; const track = availableTracks.find((item) => item.id === selectedTrackId); if (!track) return; setSaving(true); setMessage(null); try { const value = await addEpkTrack(epk.id, track, tracks.length); setTracks((items) => [...items, value]); setSelectedTrackId(''); setMessage('Piste audio ajoutée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout de la piste impossible.'); } finally { setSaving(false); } }
  async function removeTrack(track: EpkTrack) { setSaving(true); setMessage(null); try { await deleteEpkTrack(track.id); setTracks((items) => items.filter((item) => item.id !== track.id)); setMessage('Piste supprimée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); } finally { setSaving(false); } }
  async function uploadHero(file: File) { if (!epk) return; setSaving(true); setMessage(null); try { const value = await uploadEpkHeroImage(epk, file); setEpk(value); setMessage('Bannière importée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Import de la bannière impossible.'); } finally { setSaving(false); } }
  async function addEditorPhoto(file: File) { if (!epk) return; setSaving(true); setMessage(null); try { const photo = await addEpkPhoto(epk, file, {}, photos.length); setPhotos((items) => [...items, photo]); setMessage('Photo ajoutée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout de la photo impossible.'); } finally { setSaving(false); } }
  async function addEditorDocument(file: File, title: string, type: EpkDocumentType) { if (!epk) return; setSaving(true); setMessage(null); try { const document = await addEpkDocument(epk, file, { title, documentType: type, documentUpdatedAt: new Date().toISOString().slice(0, 10) }, documents.length); setDocuments((items) => [...items, document]); setMessage('Fichier ajouté.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout du fichier impossible.'); } finally { setSaving(false); } }
  async function addEditorContact(name: string, role: EpkContactRole, value: string, type: 'email' | 'phone') { if (!epk) return; setSaving(true); setMessage(null); try { const contact = await addEpkContact(epk.id, { name, role, ...(type === 'email' ? { email: value } : { phone: value }) }, contacts.length); setContacts((items) => [...items, contact]); setMessage('Contact ajouté.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout du contact impossible.'); } finally { setSaving(false); } }
  async function addEditorLink(name: string, url: string) { if (!epk) return; setSaving(true); setMessage(null); try { const link = await addEpkLink(epk.id, { kind: 'CUSTOM', label: name, url }, links.length); setLinks((items) => [...items, link]); setMessage('Lien ajouté.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout du lien impossible.'); } finally { setSaving(false); } }

  if (!isAdmin) return <div className="p-4 text-sm text-white/65">L’EPK public est réservé aux administrateurs d’un groupe.</div>;
  if (loading) return <div className="p-4 text-sm text-white/65">Chargement de l’EPK…</div>;
  if (!epk) return <div className="space-y-4"><DetailHeader title="EPK public" onBack={() => navigate('/account?tab=groupe')} backLabel="Retour aux paramètres" /><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-white/70">Créez un brouillon pour préparer votre kit de presse public.</p><Button variant="primary" fullWidth loading={saving} onClick={() => void createDraft()}>Créer l’EPK</Button>{message ? <p className="mt-3 text-sm text-amber-300">{message}</p> : null}</div></div>;

  const previewModel: EpkPublicModel = {
    name: epk.displayName,
    slug: epk.slug,
    ...(epk.tagline ? { tagline: epk.tagline } : {}),
    ...(epk.shortBio ? { shortBio: epk.shortBio } : {}),
    ...(epk.fullBio ? { fullBio: epk.fullBio } : {}),
    ...(epk.city ? { city: epk.city } : {}),
    ...(epk.country ? { country: epk.country } : {}),
    genres: epk.genres,
    accentColor: epk.accentColor ?? DEFAULT_EPK_ACCENT,
    ...(epk.heroAssetId ? { heroUrl: `/media/preview/${epk.heroAssetId}` } : {}),
    sectionOrder: epk.sectionOrder ?? DEFAULT_EPK_SECTION_ORDER,
    hiddenSections: epk.hiddenSections ?? [],
    editorial: epk.editorial ?? DEFAULT_EPK_EDITORIAL,
    videos: videos.map((video) => ({ id: video.id, ...(video.title ? { title: video.title } : {}), provider: video.provider, providerVideoId: video.providerVideoId })),
    tracks: tracks.map((track) => ({ id: track.id, title: track.title, ...(track.description ? { description: track.description } : {}) })),
    photos: photos.map((photo) => ({ id: photo.id, previewUrl: `/media/preview/${photo.previewAssetId}`, ...(photo.caption ? { caption: photo.caption } : {}), ...(photo.credit ? { credit: photo.credit } : {}) })),
    documents: documents.map((document) => ({ id: document.id, assetId: document.assetId, title: document.title, type: document.documentType, updatedAt: document.documentUpdatedAt })),
    contacts: contacts.map((contact) => ({ name: contact.name, role: contact.role, ...(contact.email ? { email: contact.email } : {}), ...(contact.phone ? { phone: contact.phone } : {}), ...(contact.whatsapp ? { whatsapp: contact.whatsapp } : {}) })),
    links: links.map((link) => ({ label: link.label || link.kind, url: link.url })),
  };
  if (showPreview) return <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#09090b]"><EpkLiveHeader subtitle="EPK · Aperçu" onBack={() => setShowPreview(false)} backLabel="Retour à l’éditeur" /><main className="min-h-0 flex-1 overflow-y-auto"><EpkPublicView model={previewModel} editing onEditSection={() => setShowPreview(false)} /></main></div>;
  return <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#09090b]"><EpkLiveHeader subtitle="EPK · Éditeur" onBack={() => navigate('/account?tab=groupe')} backLabel="Quitter l’éditeur EPK" onPreview={() => setShowPreview(true)} /><main className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4"><div className="mx-auto w-full max-w-md"><EpkEditorFields epk={epk} onChange={updateDraft} onSave={() => void savePresentation()} saving={saving} tracks={tracks} availableTracks={availableTracks} videos={videos} photos={photos} documents={documents} contacts={contacts} links={links} onAddTrack={(id) => { setSelectedTrackId(id); const track = availableTracks.find((item) => item.id === id); if (track) { setSaving(true); void addEpkTrack(epk.id, track, tracks.length).then((value) => setTracks((items) => [...items, value])).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Ajout de la piste impossible.')).finally(() => setSaving(false)); } }} onRemoveTrack={(item) => void removeTrack(item)} onAddVideo={(url, title, type) => { setVideoUrl(url); setVideoTitle(title); setVideoType(type); if (epk) { setSaving(true); void addEpkVideo(epk.id, { url, title, videoType: type }, videos.length).then((value) => setVideos((items) => [...items, value])).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Ajout de la vidéo impossible.')).finally(() => setSaving(false)); } }} onRemoveVideo={(item) => void removeVideo(item)} onUploadHero={(file) => void uploadHero(file)} onUploadPhoto={(file) => void addEditorPhoto(file)} onRemovePhoto={(item) => void removePhoto(item)} onUploadDocument={(file, title, type) => void addEditorDocument(file, title, type)} onRemoveDocument={(item) => void removeDocument(item)} onAddContact={(name, role, value, type) => void addEditorContact(name, role, value, type)} onRemoveContact={(item) => void removeContact(item)} onAddLink={(name, url) => void addEditorLink(name, url)} onRemoveLink={(item) => void removeLink(item)} />{message ? <p className="mt-3 text-center text-sm text-white/65" role="status">{message}</p> : null}<div hidden className="space-y-5 pb-6">
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-white">Complétude</p><p className="text-sm text-amber-300">{getEpkCompleteness(epk, contacts.length)} %</p></div><p className="text-xs text-white/55">Ajoutez une image ou un média principal et un contact pour publier.</p><Button variant="secondary" fullWidth onClick={() => setShowPreview(true)}>Voir l’aperçu</Button><Button variant={epk.status === 'PUBLISHED' ? 'secondary' : 'primary'} fullWidth loading={saving} onClick={() => void togglePublication()}>{epk.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}</Button></section>
    <form className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4" onSubmit={(event) => void save(event)}><details open><summary className="min-h-11 cursor-pointer list-none py-2 text-base font-black text-white">Réglages de la page</summary><div className="space-y-4 pt-3">
      <p className="fz-field-label">Organisation des sections</p><p className="text-sm leading-6 text-[var(--fz-text-muted)]">La bannière reste en première position ; la structure détaillée des sections est configurée juste après.</p>
      <div><FieldLabel htmlFor="epk-slug" required>Slug</FieldLabel><TextField id="epk-slug" name="slug" value={epk.slug} onChange={(event) => setEpk({ ...epk, slug: event.target.value })} /><p className="mt-1 text-xs text-white/45">faderzero.com/{epk.slug}</p></div>
      <fieldset><legend className="fz-field-label">Couleur d’accent</legend><div className="mt-2 grid grid-cols-4 gap-2">{ACCENT_SWATCHES.map((swatch) => <button key={swatch.value} type="button" aria-label={swatch.label} aria-pressed={(epk.accentColor ?? DEFAULT_EPK_ACCENT) === swatch.value} onClick={() => setEpk({ ...epk, accentColor: swatch.value })} className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 ${swatch.className} ${(epk.accentColor ?? DEFAULT_EPK_ACCENT) === swatch.value ? 'border-white ring-2 ring-white/35' : 'border-transparent'}`}><span className="sr-only">{swatch.label}</span></button>)}</div></fieldset>
      <div className="border-t border-white/10 pt-4"><p className="fz-field-label">Bannière</p></div>
      <div><FieldLabel htmlFor="epk-name" required>Titre</FieldLabel><TextField id="epk-name" name="displayName" value={epk.displayName} onChange={(event) => setEpk({ ...epk, displayName: event.target.value })} /></div>
      <div><FieldLabel htmlFor="epk-genres" required>Style musical</FieldLabel><TextField id="epk-genres" name="genres" value={genresText} onChange={(event) => setGenresText(event.target.value)} placeholder="Rock, indie" /><p className="mt-1 text-xs text-white/45">Séparez les styles par une virgule.</p></div>
      <div className="grid grid-cols-2 gap-3"><div><FieldLabel htmlFor="epk-city" required>Ville</FieldLabel><TextField id="epk-city" name="city" value={epk.city ?? ''} onChange={(event) => setEpk({ ...epk, city: event.target.value })} /></div><div><FieldLabel htmlFor="epk-country" optional>Pays</FieldLabel><TextField id="epk-country" name="country" value={epk.country ?? ''} onChange={(event) => setEpk({ ...epk, country: event.target.value })} /></div></div>
      <div><FieldLabel htmlFor="epk-tagline" optional>Phrase d’accroche</FieldLabel><TextArea id="epk-tagline" name="tagline" rows={2} value={epk.tagline ?? ''} onChange={(event) => setEpk({ ...epk, tagline: event.target.value })} /></div>
      <div><FieldLabel htmlFor="epk-hero-image">Image de bannière</FieldLabel><TextField id="epk-hero-image" value={epk.heroAssetId ?? ''} readOnly placeholder="Import d’image à venir" /><p className="mt-1 text-xs text-white/45">Recommandé : JPG, PNG ou WebP, paysage 2400 × 1350 px minimum, moins de 10 Mo.</p></div>
      <Button type="submit" variant="secondary" fullWidth loading={saving}>Enregistrer l’identité</Button>{message ? <p role="status" className="text-sm text-amber-300">{message}</p> : null}
    </div></details></form>
    <details className="rounded-2xl border border-white/10 bg-white/5 p-4"><summary className="min-h-11 cursor-pointer list-none py-2 text-base font-black text-white">Structure et textes de section</summary><div className="space-y-4 pt-3"><div><FieldLabel htmlFor="epk-bio-title">Titre bio</FieldLabel><TextField id="epk-bio-title" value={epk.editorial.bioTitle} onChange={(event) => setEpk({ ...epk, editorial: { ...epk.editorial, bioTitle: event.target.value } })} /></div><div><FieldLabel htmlFor="epk-music-title">Titre musique</FieldLabel><TextField id="epk-music-title" value={epk.editorial.musicTitle} onChange={(event) => setEpk({ ...epk, editorial: { ...epk.editorial, musicTitle: event.target.value } })} /></div><div><FieldLabel htmlFor="epk-pro-title">Titre espace pro</FieldLabel><TextField id="epk-pro-title" value={epk.editorial.proTitle} onChange={(event) => setEpk({ ...epk, editorial: { ...epk.editorial, proTitle: event.target.value } })} /></div><div><FieldLabel htmlFor="epk-pro-description">Description espace pro</FieldLabel><TextArea id="epk-pro-description" rows={3} value={epk.editorial.proDescription} onChange={(event) => setEpk({ ...epk, editorial: { ...epk.editorial, proDescription: event.target.value } })} /></div><div><FieldLabel htmlFor="epk-contact-title">Titre contact</FieldLabel><TextField id="epk-contact-title" value={epk.editorial.contactTitle} onChange={(event) => setEpk({ ...epk, editorial: { ...epk.editorial, contactTitle: event.target.value } })} /></div><Button variant="secondary" fullWidth loading={saving} onClick={() => void savePresentation()}>Enregistrer les textes</Button></div></details>
    <details className="rounded-2xl border border-white/10 bg-white/5 p-4"><summary className="min-h-11 cursor-pointer list-none py-2 text-base font-black text-white">Présentation</summary><div className="space-y-4 pt-3"><div><FieldLabel htmlFor="epk-short-bio" optional>Bio courte</FieldLabel><TextArea id="epk-short-bio" rows={4} value={epk.shortBio ?? ''} onChange={(event) => setEpk({ ...epk, shortBio: event.target.value })} /></div><div><FieldLabel htmlFor="epk-full-bio" optional>Bio complète</FieldLabel><TextArea id="epk-full-bio" rows={7} value={epk.fullBio ?? ''} onChange={(event) => setEpk({ ...epk, fullBio: event.target.value })} /><p className="mt-1 text-xs text-white/45">La page publique replie ce texte derrière « Lire la suite ».</p></div><Button variant="secondary" fullWidth loading={saving} onClick={() => void savePresentation()}>Enregistrer la présentation</Button></div></details>
    <details className="rounded-2xl border border-white/10 bg-white/5 p-4"><summary className="min-h-11 cursor-pointer list-none py-2 text-base font-black text-white">Contacts</summary><div className="space-y-4 pt-3">{contacts.map((contact) => <div key={contact.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3"><div className="min-w-0"><p className="font-semibold text-white">{contact.name}</p><p className="truncate text-xs text-white/55">{contact.email ?? contact.phone ?? contact.whatsapp}</p></div><Button variant="danger" loading={saving} onClick={() => void removeContact(contact)}>Supprimer</Button></div>)}<div className="space-y-3 border-t border-white/10 pt-4"><div><FieldLabel htmlFor="epk-contact-name" required>Nom</FieldLabel><TextField id="epk-contact-name" value={contactName} onChange={(event) => setContactName(event.target.value)} /></div><div><FieldLabel htmlFor="epk-contact-role">Rôle</FieldLabel><SelectField id="epk-contact-role" value={contactRole} onChange={(event) => setContactRole(event.target.value as EpkContactRole)}><option value="BAND">Groupe</option><option value="BOOKING">Booking</option><option value="MANAGEMENT">Management</option><option value="TECH">Technique</option><option value="PRESS">Presse</option><option value="PRODUCTION">Production</option><option value="OTHER">Autre</option></SelectField></div><div><FieldLabel htmlFor="epk-contact-email" required>E-mail</FieldLabel><TextField id="epk-contact-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></div><Button variant="secondary" fullWidth loading={saving} onClick={() => void addContact()}>Ajouter le contact</Button></div></div></details>
    <details className="rounded-2xl border border-white/10 bg-white/5 p-4"><summary className="min-h-11 cursor-pointer list-none py-2 text-base font-black text-white">Vidéos</summary><div className="space-y-4 pt-3">{videos.map((video) => <div key={video.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3"><div className="min-w-0"><p className="font-semibold text-white">{video.title || `${video.provider} · ${video.videoType}`}</p><p className="truncate text-xs text-white/55">{video.providerVideoId}</p></div><Button variant="danger" loading={saving} onClick={() => void removeVideo(video)}>Supprimer</Button></div>)}<div className="space-y-3 border-t border-white/10 pt-4"><div><FieldLabel htmlFor="epk-video-url" required>URL YouTube ou Vimeo</FieldLabel><TextField id="epk-video-url" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} /></div><div><FieldLabel htmlFor="epk-video-title" optional>Titre</FieldLabel><TextField id="epk-video-title" value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)} /></div><div><FieldLabel htmlFor="epk-video-type">Type</FieldLabel><SelectField id="epk-video-type" value={videoType} onChange={(event) => setVideoType(event.target.value as EpkVideoType)}><option value="LIVE">Live</option><option value="LIVE_SESSION">Session live</option><option value="MUSIC_VIDEO">Clip</option><option value="INTERVIEW">Interview</option><option value="OTHER">Autre</option></SelectField></div><Button variant="secondary" fullWidth loading={saving} onClick={() => void addVideo()}>Ajouter la vidéo</Button></div></div></details>
    <details className="rounded-2xl border border-white/10 bg-white/5 p-4"><summary className="min-h-11 cursor-pointer list-none py-2 text-base font-black text-white">Liens</summary><div className="space-y-4 pt-3">{links.map((link) => <div key={link.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3"><div className="min-w-0"><p className="font-semibold text-white">{link.label || link.kind}</p><p className="truncate text-xs text-white/55">{link.url}</p></div><Button variant="danger" loading={saving} onClick={() => void removeLink(link)}>Supprimer</Button></div>)}<div className="space-y-3 border-t border-white/10 pt-4"><div><FieldLabel htmlFor="epk-link-kind">Type</FieldLabel><SelectField id="epk-link-kind" value={linkKind} onChange={(event) => setLinkKind(event.target.value as EpkLinkKind)}><option value="WEBSITE">Site web</option><option value="SPOTIFY">Spotify</option><option value="APPLE_MUSIC">Apple Music</option><option value="DEEZER">Deezer</option><option value="YOUTUBE">YouTube</option><option value="INSTAGRAM">Instagram</option><option value="FACEBOOK">Facebook</option><option value="TIKTOK">TikTok</option><option value="CUSTOM">Personnalisé</option></SelectField></div><div><FieldLabel htmlFor="epk-link-label" optional>Libellé</FieldLabel><TextField id="epk-link-label" value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} /></div><div><FieldLabel htmlFor="epk-link-url" required>URL https</FieldLabel><TextField id="epk-link-url" type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} /></div><Button variant="secondary" fullWidth loading={saving} onClick={() => void addLink()}>Ajouter le lien</Button></div></div></details>
    <details className="rounded-2xl border border-white/10 bg-white/5 p-4"><summary className="min-h-11 cursor-pointer list-none py-2 text-base font-black text-white">Pistes audio</summary><div className="space-y-4 pt-3">{tracks.map((track) => <div key={track.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3"><p className="min-w-0 truncate text-sm font-semibold text-white">{track.title}</p><Button variant="danger" loading={saving} onClick={() => void removeTrack(track)}>Supprimer</Button></div>)}<div className="space-y-3 border-t border-white/10 pt-4"><SelectField aria-label="Piste audio" value={selectedTrackId} onChange={(event) => setSelectedTrackId(event.target.value)}><option value="">Choisir un audio importé</option>{availableTracks.filter((track) => !tracks.some((item) => item.songAssetId === track.id)).map((track) => <option key={track.id} value={track.id}>{track.songTitle || track.filename}</option>)}</SelectField><Button variant="secondary" fullWidth loading={saving} onClick={() => void addTrack()}>Ajouter la piste</Button></div></div></details>
    <details className="rounded-2xl border border-white/10 bg-white/5 p-4"><summary className="min-h-11 cursor-pointer list-none py-2 text-base font-black text-white">Photos</summary><div className="space-y-4 pt-3">{photos.map((photo) => <div key={photo.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3"><p className="min-w-0 truncate text-sm text-white/75">{photo.credit || 'Photo presse'}</p><Button variant="danger" loading={saving} onClick={() => void removePhoto(photo)}>Supprimer</Button></div>)}<div className="space-y-3 border-t border-white/10 pt-4"><input aria-label="Photo presse" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} /><TextField aria-label="Crédit photo" value={photoCredit} onChange={(event) => setPhotoCredit(event.target.value)} placeholder="Crédit photo (optionnel)" /><Button variant="secondary" fullWidth loading={saving} onClick={() => void addPhoto()}>Ajouter la photo</Button></div></div></details>
    <details className="rounded-2xl border border-white/10 bg-white/5 p-4"><summary className="min-h-11 cursor-pointer list-none py-2 text-base font-black text-white">Documents</summary><div className="space-y-4 pt-3">{documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{document.title}</p><p className="text-xs text-white/55">{document.documentType} · {document.documentUpdatedAt}</p></div><Button variant="danger" loading={saving} onClick={() => void removeDocument(document)}>Supprimer</Button></div>)}<div className="space-y-3 border-t border-white/10 pt-4"><input aria-label="Document PDF" type="file" accept="application/pdf" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} /><TextField aria-label="Titre du document" value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="Titre du document" /><SelectField aria-label="Type de document" value={documentType} onChange={(event) => setDocumentType(event.target.value as EpkDocumentType)}><option value="TECH_RIDER">Fiche technique</option><option value="STAGE_PLOT">Plan de scène</option><option value="HOSPITALITY_RIDER">Rider hospitality</option><option value="PRESS_KIT">Dossier de presse</option><option value="LOGO">Logo</option><option value="OTHER">Autre</option></SelectField><TextField aria-label="Date de mise à jour" type="text" value={documentUpdatedAt} onChange={(event) => setDocumentUpdatedAt(event.target.value)} /><Button variant="secondary" fullWidth loading={saving} onClick={() => void addDocument()}>Ajouter le document</Button></div></div></details>
  </div></div></main></div>;
}

function EpkLiveHeader({ subtitle, onBack, backLabel, onPreview }: { subtitle: string; onBack: () => void; backLabel: string; onPreview?: () => void }) {
  return <header className="sticky top-0 z-30 shrink-0 border-b border-white/10 bg-[var(--fz-bg)]/98 backdrop-blur-sm"><div className="mx-auto w-full max-w-md px-4 pb-2 pt-3"><div className="relative flex h-11 items-center"><button type="button" onClick={onBack} aria-label={backLabel} className="absolute left-0 z-10 flex h-11 w-11 items-center justify-center text-white/72 transition hover:text-white"><FzIcon name="close" usageId="epk.live.close" size="md" /></button><div className="pointer-events-none absolute inset-x-0 min-w-0 px-16 text-center"><p className="truncate text-[0.72rem] font-black uppercase tracking-[0.26em] text-[var(--fz-text-muted)]">FaderZero</p><p className="mt-1 truncate text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/55">{subtitle}</p></div>{onPreview ? <button type="button" onClick={onPreview} aria-label="Visualiser la page EPK" className="absolute right-0 z-10 flex h-11 w-11 items-center justify-center text-white/72 transition hover:text-white"><FzIcon name="show-password" usageId="epk.live.preview" size="md" /></button> : null}</div></div></header>;
}

function getEpkErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}
