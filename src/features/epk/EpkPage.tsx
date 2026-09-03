import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { Button } from '@/ui/components/Button';
import { FzIcon } from '@/ui/icons';
import { useAuthStore } from '@/stores/authStore';
import { canAdministerWorkspace } from '@/services/supabase/workspace';
import { addEpkContact, addEpkDocument, addEpkLink, addEpkPhoto, addEpkTrack, addEpkVideo, createEpk, createEpkAssetSignedUrl, deleteEpkContact, deleteEpkDocument, deleteEpkHeroImage, deleteEpkLink, deleteEpkPhoto, deleteEpkTrack, deleteEpkVideo, getEpk, getEpkTrackAudioUrl, listAvailableEpkTracks, listEpkContacts, listEpkDocuments, listEpkLinks, listEpkPhotos, listEpkTracks, listEpkVideos, publishEpkDraft, saveEpk, updateEpkContact, updateEpkLink, uploadEpkHeroImage, type AvailableEpkTrack, type EpkContact, type EpkDocument, type EpkDocumentType, type EpkLink, type EpkPhoto, type EpkRecord, type EpkTrack, type EpkVideo, type EpkVideoType } from './epk';
import { EpkPublicView } from './EpkPublicView';
import { EpkEditorFields } from './EpkEditorFields';
import { DEFAULT_EPK_ACCENT, DEFAULT_EPK_EDITORIAL, DEFAULT_EPK_SECTION_ORDER, type EpkPublicModel } from './epkPresentation';

export function EpkPage() {
  const navigate = useNavigate();
  const workspace = useAuthStore((state) => state.activeWorkspace);
  const [epk, setEpk] = useState<EpkRecord | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [contacts, setContacts] = useState<EpkContact[]>([]);
  const [videos, setVideos] = useState<EpkVideo[]>([]);
  const [links, setLinks] = useState<EpkLink[]>([]);
  const [photos, setPhotos] = useState<EpkPhoto[]>([]);
  const [documents, setDocuments] = useState<EpkDocument[]>([]);
  const [tracks, setTracks] = useState<EpkTrack[]>([]);
  const [availableTracks, setAvailableTracks] = useState<AvailableEpkTrack[]>([]);
  const [epkAssetUrls, setEpkAssetUrls] = useState<Record<string, string>>({});
  const [trackAudioUrls, setTrackAudioUrls] = useState<Record<string, string>>({});
  const autosaveTimer = useRef<number | null>(null);
  const isAdmin = workspace?.type === 'group' && canAdministerWorkspace(workspace.role);

  useEffect(() => {
    let active = true;
    if (!workspace || !isAdmin) { setLoading(false); return; }
    void getEpk(workspace.id).then((value) => {
      if (!active) return;
      setEpk(value);
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
    try { const value = await createEpk(workspace.id, workspace.name); setEpk(value); setMessage('Brouillon EPK créé.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Création impossible.'); }
    finally { setSaving(false); }
  }

  async function savePresentation() {
    if (!epk) return;
    setSaving(true); setMessage(null);
    try { await saveEpk(epk); setMessage('Présentation enregistrée.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  }
  async function publishPresentation() {
    if (!epk) return;
    setSaving(true); setMessage(null);
    try {
      const saved = await saveEpk(epk);
      const value = await publishEpkDraft(saved.id, saved.draftRevision ?? 0);
      setEpk(value);
      setMessage('Page publique mise à jour.');
    } catch (error) { setMessage(getEpkErrorMessage(error, 'Publication impossible.')); }
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
  useEffect(() => {
    const assetIds = [...new Set([epk?.heroAssetId, ...photos.map((photo) => photo.previewAssetId)].filter((id): id is string => Boolean(id)))];
    if (assetIds.length === 0) {
      setEpkAssetUrls({});
      return;
    }
    let active = true;
    void Promise.all(assetIds.map(async (assetId) => [assetId, await createEpkAssetSignedUrl(assetId)] as const))
      .then((items) => { if (active) setEpkAssetUrls(Object.fromEntries(items)); })
      .catch((error: unknown) => { if (active) setMessage(getEpkErrorMessage(error, 'Impossible d’afficher le média EPK.')); });
    return () => { active = false; };
  }, [epk?.heroAssetId, photos]);
  useEffect(() => {
    if (tracks.length === 0) {
      setTrackAudioUrls({});
      return;
    }
    let active = true;
    void Promise.all(tracks.map(async (track) => {
      try {
        const url = await getEpkTrackAudioUrl(track);
        return [track.id, url] as const;
      } catch {
        return null;
      }
    })).then((items) => {
      if (active) {
        const valid = items.filter((item): item is readonly [string, string] => item !== null);
        setTrackAudioUrls(Object.fromEntries(valid));
      }
    });
    return () => { active = false; };
  }, [tracks]);
  async function removeContact(contact: EpkContact) {
    setSaving(true); setMessage(null);
    try { await deleteEpkContact(contact.id); setContacts((items) => items.filter((item) => item.id !== contact.id)); setMessage('Contact supprimé.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); }
    finally { setSaving(false); }
  }
  async function removeVideo(video: EpkVideo) {
    setSaving(true); setMessage(null);
    try { await deleteEpkVideo(video.id); setVideos((items) => items.filter((item) => item.id !== video.id)); setMessage('Vidéo supprimée.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); }
    finally { setSaving(false); }
  }
  async function removeLink(link: EpkLink) {
    setSaving(true); setMessage(null);
    try { await deleteEpkLink(link.id); setLinks((items) => items.filter((item) => item.id !== link.id)); setMessage('Lien supprimé.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); }
    finally { setSaving(false); }
  }
  async function removePhoto(photo: EpkPhoto) { setSaving(true); setMessage(null); try { await deleteEpkPhoto(photo); setPhotos((items) => items.filter((item) => item.id !== photo.id)); setMessage('Photo supprimée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); } finally { setSaving(false); } }
  async function removeDocument(document: EpkDocument) { setSaving(true); setMessage(null); try { await deleteEpkDocument(document); setDocuments((items) => items.filter((item) => item.id !== document.id)); setMessage('Document supprimé.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); } finally { setSaving(false); } }
  async function removeTrack(track: EpkTrack) { setSaving(true); setMessage(null); try { await deleteEpkTrack(track.id); setTracks((items) => items.filter((item) => item.id !== track.id)); setMessage('Piste supprimée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); } finally { setSaving(false); } }
  async function uploadHero(file: File) { if (!epk) return; if (autosaveTimer.current !== null) { window.clearTimeout(autosaveTimer.current); autosaveTimer.current = null; } setSaving(true); setMessage(null); try { const value = await uploadEpkHeroImage(epk, file); setEpk(value); setMessage('Bannière importée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Import de la bannière impossible.'); } finally { setSaving(false); } }
  async function removeHero() { if (!epk?.heroAssetId) return; if (autosaveTimer.current !== null) { window.clearTimeout(autosaveTimer.current); autosaveTimer.current = null; } const wasPublished = epk.status === 'PUBLISHED'; setSaving(true); setMessage(null); try { const value = await deleteEpkHeroImage(epk); setEpk(value); setMessage(wasPublished ? 'Bannière supprimée. La page publique reste en ligne, sans bannière.' : 'Bannière supprimée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression de la bannière impossible.'); } finally { setSaving(false); } }
  async function addEditorPhoto(file: File) { if (!epk) return; setSaving(true); setMessage(null); try { const photo = await addEpkPhoto(epk, file, {}, photos.length); setPhotos((items) => [...items, photo]); setMessage('Photo ajoutée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout de la photo impossible.'); } finally { setSaving(false); } }
  async function addEditorDocument(file: File, title: string, type: EpkDocumentType) { if (!epk) return; setSaving(true); setMessage(null); try { const document = await addEpkDocument(epk, file, { title, documentType: type, documentUpdatedAt: new Date().toISOString().slice(0, 10) }, documents.length); setDocuments((items) => [...items, document]); setMessage('Fichier ajouté.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout du fichier impossible.'); } finally { setSaving(false); } }
  async function addEditorContact(name: string, role: string, email?: string, phone?: string) { if (!epk) return; setSaving(true); setMessage(null); try { const position = contacts.reduce((highest, c) => Math.max(highest, c.position), -1) + 1; const contact = await addEpkContact(epk.id, { name, ...(role.trim() ? { role: role.trim() } : {}), ...(email?.trim() ? { email: email.trim() } : {}), ...(phone?.trim() ? { phone: phone.trim() } : {}) }, position); setContacts((items) => [...items, contact]); setMessage('Contact ajouté.'); } catch (error) { setMessage(getEpkErrorMessage(error, 'Ajout du contact impossible.')); } finally { setSaving(false); } }
  async function updateEditorContact(contactId: string, name: string, role: string, email?: string, phone?: string) { if (!epk) return; setSaving(true); setMessage(null); try { const contact = await updateEpkContact(contactId, { name, ...(role.trim() ? { role: role.trim() } : { role: null }), ...(email?.trim() ? { email: email.trim() } : { email: null }), ...(phone?.trim() ? { phone: phone.trim() } : { phone: null }) }); setContacts((items) => items.map((item) => (item.id === contactId ? contact : item))); setMessage('Contact mis à jour.'); } catch (error) { setMessage(getEpkErrorMessage(error, 'Mise à jour du contact impossible.')); } finally { setSaving(false); } }
  async function addEditorLink(name: string, url: string) { if (!epk) return; setSaving(true); setMessage(null); try { const position = links.reduce((highest, link) => Math.max(highest, link.position), -1) + 1; const link = await addEpkLink(epk.id, { kind: 'CUSTOM', label: name, url }, position); setLinks((items) => [...items, link]); setMessage('Lien ajouté.'); } catch (error) { setMessage(getEpkErrorMessage(error, 'Ajout du lien impossible.')); } finally { setSaving(false); } }
  async function updateEditorLink(linkId: string, name: string, url: string) { if (!epk) return; setSaving(true); setMessage(null); try { const link = await updateEpkLink(linkId, { label: name, url }); setLinks((items) => items.map((item) => (item.id === linkId ? link : item))); setMessage('Lien mis à jour.'); } catch (error) { setMessage(getEpkErrorMessage(error, 'Mise à jour du lien impossible.')); } finally { setSaving(false); } }
  async function addEditorTrack(id: string, title: string) { if (!epk) return; const track = availableTracks.find((item) => item.id === id); if (!track) return; setSaving(true); setMessage(null); try { const value = await addEpkTrack(epk.id, track, tracks.length, title); setTracks((items) => [...items, value]); setMessage('Piste ajoutée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout de la piste impossible.'); } finally { setSaving(false); } }
  async function addEditorVideo(url: string, title: string, type: EpkVideoType) { if (!epk) return; setSaving(true); setMessage(null); try { const value = await addEpkVideo(epk.id, { url, title, videoType: type }, videos.length); setVideos((items) => [...items, value]); setMessage('Vidéo ajoutée.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ajout de la vidéo impossible.'); } finally { setSaving(false); } }

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
    ...(epk.heroAssetId && epkAssetUrls[epk.heroAssetId] ? { heroUrl: epkAssetUrls[epk.heroAssetId] } : {}),
    sectionOrder: epk.sectionOrder ?? DEFAULT_EPK_SECTION_ORDER,
    hiddenSections: epk.hiddenSections ?? [],
    editorial: epk.editorial ?? DEFAULT_EPK_EDITORIAL,
    videos: videos.map((video) => ({ id: video.id, ...(video.title ? { title: video.title } : {}), provider: video.provider, providerVideoId: video.providerVideoId })),
    tracks: tracks.map((track) => ({ id: track.id, title: track.title, ...(track.description ? { description: track.description } : {}), ...(trackAudioUrls[track.id] ? { audioUrl: trackAudioUrls[track.id] } : {}) })),
    photos: photos.flatMap((photo) => {
      const previewUrl = epkAssetUrls[photo.previewAssetId];
      return previewUrl ? [{ id: photo.id, previewUrl, ...(photo.caption ? { caption: photo.caption } : {}), ...(photo.credit ? { credit: photo.credit } : {}) }] : [];
    }),
    documents: documents.map((document) => ({ id: document.id, assetId: document.assetId, title: document.title, type: document.documentType, updatedAt: document.documentUpdatedAt })),
    contacts: contacts.map((contact) => ({ name: contact.name, ...(contact.role ? { role: contact.role } : {}), ...(contact.email ? { email: contact.email } : {}), ...(contact.phone ? { phone: contact.phone } : {}), ...(contact.whatsapp ? { whatsapp: contact.whatsapp } : {}) })),
    links: links.map((link) => ({ label: link.label || link.kind, url: link.url })),
  };
  if (showPreview) return <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#09090b]"><EpkLiveHeader subtitle="EPK · Aperçu" onBack={() => navigate('/account?tab=groupe')} backLabel="Retour aux paramètres" onEdit={() => setShowPreview(false)} /><main className="min-h-0 flex-1 overflow-y-auto"><EpkPublicView model={previewModel} /></main></div>;
  return <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#09090b]"><EpkLiveHeader subtitle="EPK · Éditeur" onBack={() => navigate('/account?tab=groupe')} backLabel="Quitter l’éditeur EPK" onPreview={() => setShowPreview(true)} /><main className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4"><div className="mx-auto w-full max-w-md"><EpkEditorFields epk={epk} onChange={updateDraft} onSave={() => void savePresentation()} onPublish={() => void publishPresentation()} saving={saving} tracks={tracks} availableTracks={availableTracks} videos={videos} photos={photos} {...(epk.heroAssetId && epkAssetUrls[epk.heroAssetId] ? { heroPreviewUrl: epkAssetUrls[epk.heroAssetId] } : {})} photoPreviewUrls={epkAssetUrls} documents={documents} contacts={contacts} links={links} onAddTrack={(id, title) => void addEditorTrack(id, title)} onRemoveTrack={(item) => void removeTrack(item)} onAddVideo={(url, title, type) => void addEditorVideo(url, title, type)} onRemoveVideo={(item) => void removeVideo(item)} onUploadHero={(file) => void uploadHero(file)} onRemoveHero={() => void removeHero()} onUploadPhoto={(file) => void addEditorPhoto(file)} onRemovePhoto={(item) => void removePhoto(item)} onUploadDocument={(file, title, type) => void addEditorDocument(file, title, type)} onRemoveDocument={(item) => void removeDocument(item)} onAddContact={(name, role, email, phone) => void addEditorContact(name, role, email, phone)} onUpdateContact={(id, name, role, email, phone) => void updateEditorContact(id, name, role, email, phone)} onRemoveContact={(item) => void removeContact(item)} onAddLink={(name, url) => void addEditorLink(name, url)} onUpdateLink={(id, name, url) => void updateEditorLink(id, name, url)} onRemoveLink={(item) => void removeLink(item)} />{message ? <p className="mt-3 text-center text-sm text-white/65" role="status">{message}</p> : null}</div></main></div>;
}

function EpkLiveHeader({ subtitle, onBack, backLabel, onPreview, onEdit }: { subtitle: string; onBack: () => void; backLabel: string; onPreview?: () => void; onEdit?: () => void }) {
  return <header className="sticky top-0 z-30 shrink-0 border-b border-white/10 bg-[var(--fz-bg)]/98 backdrop-blur-sm"><div className="mx-auto w-full max-w-md px-4 pb-2 pt-3"><div className="relative flex h-11 items-center"><button type="button" onClick={onBack} aria-label={backLabel} className="absolute left-0 z-10 flex h-11 w-11 items-center justify-center text-white/72 transition hover:text-white"><FzIcon name="close" usageId="epk.live.close" size="md" /></button><div className="pointer-events-none absolute inset-x-0 min-w-0 px-16 text-center"><p className="truncate text-[0.72rem] font-black uppercase tracking-[0.26em] text-[var(--fz-text-muted)]">FaderZero</p><p className="mt-1 truncate text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/55">{subtitle}</p></div>{onPreview ? <button type="button" onClick={onPreview} aria-label="Visualiser la page EPK" className="absolute right-0 z-10 flex h-11 w-11 items-center justify-center text-white/72 transition hover:text-white"><FzIcon name="show-password" usageId="epk.live.preview" size="md" /></button> : null}{onEdit ? <button type="button" onClick={onEdit} aria-label="Modifier la page EPK" className="absolute right-0 z-10 flex h-11 w-11 items-center justify-center text-white/72 transition hover:text-white"><FzIcon name="edit" usageId="epk.live.edit" size="md" /></button> : null}</div></div></header>;
}

const EPK_ERROR_MESSAGES: Record<string, string> = {
  EPK_FORBIDDEN: 'Vous n’administrez pas cet EPK.',
  EPK_DRAFT_CONFLICT: 'L’EPK a été modifié ailleurs. Rechargez la page avant de republier.',
  EPK_PUBLISH_NAME_MISSING: 'Renseignez le nom du groupe avant de publier.',
};

function getEpkErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message
    : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message
    : '';
  const known = Object.keys(EPK_ERROR_MESSAGES).find((code) => raw.includes(code));
  return known ? EPK_ERROR_MESSAGES[known]! : raw || fallback;
}
