import { useRef, useState, type ReactNode } from 'react';
import { FormDialog } from '@/components/FormDialog';
import { Button } from '@/ui/components/Button';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { SelectField } from '@/ui/components/SelectField';
import { TextArea } from '@/ui/components/TextArea';
import { TextField } from '@/ui/components/TextField';
import { BrandIcon, FzIcon } from '@/ui/icons';
import { brandByLabel, brandForLink, normalizeBrandLabel } from './epkBrands';
import type { AvailableEpkTrack, EpkContact, EpkDocument, EpkDocumentType, EpkLink, EpkPhoto, EpkRecord, EpkTrack, EpkVideo, EpkVideoType } from './epk';
import { DEFAULT_EPK_SECTION_ORDER, type EpkFact, type EpkSectionId } from './epkPresentation';

const labels: Record<EpkSectionId, string> = { banniere: 'Bannière', bio: 'Biographie', musique: 'Musique', medias: 'Médias', espacePro: 'Espace Pro', contact: 'Contact' };
const accentSwatches = [['#ff3a63', 'Rose FaderZero', 'bg-[#ff3a63]'], ['#f97316', 'Orange', 'bg-orange-500'], ['#facc15', 'Jaune', 'bg-yellow-400'], ['#4ade80', 'Vert', 'bg-green-400'], ['#2dd4bf', 'Turquoise', 'bg-teal-400'], ['#38bdf8', 'Bleu ciel', 'bg-sky-400'], ['#818cf8', 'Indigo', 'bg-indigo-400'], ['#c084fc', 'Violet', 'bg-purple-400']] as const;
const platforms = ['Spotify', 'Apple Music', 'YouTube Music', 'Deezer', 'SoundCloud', 'Bandcamp', 'Amazon Music', 'Tidal', 'Qobuz'];
const socials = ['Instagram', 'Facebook', 'YouTube', 'X', 'TikTok', 'LinkedIn'];
const retiredSocials = ['Twitch'];
const factIcons: Array<{ value: EpkFact['icon']; label: string }> = [
  { value: 'location', label: 'Localisation' },
  { value: 'music', label: 'Musique' },
  { value: 'users', label: 'Formation' },
  { value: 'calendar', label: 'Calendrier' },
];

type Props = {
  epk: EpkRecord; onChange: (next: EpkRecord) => void; onSave: () => void; onPublish: () => void; onUnpublish: () => void; onViewPublished: () => void; saving: boolean;
  tracks: EpkTrack[]; availableTracks: AvailableEpkTrack[]; videos: EpkVideo[]; photos: EpkPhoto[]; photoPreviewUrls: Record<string, string>; documents: EpkDocument[]; contacts: EpkContact[]; links: EpkLink[];
  onAddTrack: (id: string, title: string) => void; onRemoveTrack: (item: EpkTrack) => void; onAddVideo: (url: string, title: string, type: EpkVideoType) => void; onRemoveVideo: (item: EpkVideo) => void;
  heroPreviewUrl?: string; onUploadHero: (file: File) => void; onRemoveHero: () => void; onUploadPhoto: (file: File) => void; onRemovePhoto: (item: EpkPhoto) => void; onUploadDocument: (file: File, title: string, type: EpkDocumentType) => void; onRemoveDocument: (item: EpkDocument) => void;
  onAddContact: (name: string, role: string, email?: string, phone?: string) => void; onUpdateContact?: ((id: string, name: string, role: string, email?: string, phone?: string) => void) | undefined; onRemoveContact: (item: EpkContact) => void; onAddLink: (name: string, url: string) => void; onUpdateLink?: ((id: string, name: string, url: string) => void) | undefined; onRemoveLink: (item: EpkLink) => void;
};

export function EpkEditorFields(props: Props) {
  const { epk, onChange, saving } = props;
  const [addDialog, setAddDialog] = useState<'fact' | 'track' | 'video' | 'document' | null>(null); const [contactDialogOpen, setContactDialogOpen] = useState(false); const [editingContact, setEditingContact] = useState<EpkContact | null>(null); const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const updateSections = (sectionOrder: EpkSectionId[], hiddenSections = epk.hiddenSections ?? []) => onChange({ ...epk, sectionOrder, hiddenSections });
  const move = (index: number, direction: -1 | 1) => { const next = [...(epk.sectionOrder ?? DEFAULT_EPK_SECTION_ORDER)]; const target = index + direction; if (index === 0 || target < 1 || target >= next.length) return; [next[index], next[target]] = [next[target]!, next[index]!]; updateSections(next); };
  const updateFacts = (facts: EpkRecord['editorial']['facts']) => onChange({ ...epk, editorial: { ...epk.editorial, facts } });
  const socialLinks = props.links.filter((link) => socials.some((name) => (link.label || link.kind).toLowerCase() === name.toLowerCase()));
  const retiredSocialLinks = props.links.filter((link) => retiredSocials.some((name) => (link.label || link.kind).toLowerCase() === name.toLowerCase()));
  const platformLinks = props.links.filter((link) => !socialLinks.includes(link) && !retiredSocialLinks.includes(link));
  return <><div className="space-y-5">
    <div className="space-y-2"><Button variant="primary" fullWidth loading={saving} onClick={props.onSave}>Enregistrer les modifications</Button><Button variant="secondary" fullWidth loading={saving} onClick={props.onPublish}>{saving ? 'Publication…' : epk.status === 'PUBLISHED' ? 'Mettre à jour la page publique' : 'Publier la page'}</Button>{epk.status === 'PUBLISHED' ? <><Button variant="secondary" fullWidth disabled={saving} onClick={props.onViewPublished}>Voir la page publiée</Button><Button variant="danger" fullWidth disabled={saving} onClick={props.onUnpublish}>Retirer la page publique</Button></> : null}</div>
    <Section title="URL et couleur d’accent"><div><p className="fz-field-label">URL</p><div className="flex min-h-12 items-center gap-2"><p className="min-w-0 flex-1 truncate text-base text-white">faderzero.com/{epk.slug}</p><EditIconButton label="Modifier l’URL" usageId="epk.url.edit" disabled={saving} onClick={() => setUrlDialogOpen(true)} /></div></div><fieldset><legend className="fz-field-label">Couleur d’accent</legend><div className="mt-2 grid grid-cols-4 gap-2">{accentSwatches.map(([value, label, className]) => <button key={value} type="button" aria-label={label} aria-pressed={(epk.accentColor ?? '#ff3a63') === value} onClick={() => onChange({ ...epk, accentColor: value })} className={`h-11 w-11 rounded-full border-2 ${className} ${(epk.accentColor ?? '#ff3a63') === value ? 'border-white ring-2 ring-white/35' : 'border-transparent'}`} />)}</div></fieldset></Section>
    <Section title="Structure des sections"><div className="space-y-2">{(epk.sectionOrder ?? DEFAULT_EPK_SECTION_ORDER).map((section, index) => { const visible = !(epk.hiddenSections ?? []).includes(section); return <div key={section} className="flex items-center gap-2 rounded-xl border border-white/10 p-2"><span className="w-6 text-center text-xs text-white/45">{index + 1}</span><strong className="min-w-0 flex-1 text-sm">{labels[section]}</strong><button type="button" aria-label={visible ? `Masquer ${labels[section]}` : `Afficher ${labels[section]}`} disabled={section === 'banniere'} onClick={() => updateSections(epk.sectionOrder ?? DEFAULT_EPK_SECTION_ORDER, visible ? [...(epk.hiddenSections ?? []), section] : (epk.hiddenSections ?? []).filter((value) => value !== section))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 disabled:opacity-30"><FzIcon name={visible ? 'show-password' : 'hide-password'} usageId={`epk.structure.${section}.visibility`} /></button><Button variant="ghost" size="sm" disabled={index <= 1} onClick={() => move(index, -1)}>↑</Button><Button variant="ghost" size="sm" disabled={section === 'banniere' || index === (epk.sectionOrder ?? DEFAULT_EPK_SECTION_ORDER).length - 1} onClick={() => move(index, 1)}>↓</Button></div>; })}</div><Button variant="secondary" fullWidth onClick={() => updateSections([...DEFAULT_EPK_SECTION_ORDER], [])}>Réinitialiser l’ordre</Button></Section>
    <Section title="Bannière"><Field id="name" label="Nom du groupe" value={epk.displayName} onChange={(displayName) => onChange({ ...epk, displayName })} /><Field id="style" label="Style musical" value={epk.genres.join(' · ')} onChange={(value) => onChange({ ...epk, genres: value.split('·').map((item) => item.trim()).filter(Boolean) })} /><Field id="tagline" label="Phrase d’accroche" value={epk.tagline ?? ''} onChange={(tagline) => onChange({ ...epk, tagline })} /><HeroImageField assetId={epk.heroAssetId} previewUrl={props.heroPreviewUrl} disabled={saving} onPick={props.onUploadHero} onRemove={props.onRemoveHero} /></Section>
    <Section title="Biographie"><Field id="bio-title" label="Titre" value={epk.editorial.bioTitle} onChange={(bioTitle) => onChange({ ...epk, editorial: { ...epk.editorial, bioTitle } })} /><div><FieldLabel htmlFor="epk-bio-text">Texte de biographie</FieldLabel><TextArea id="epk-bio-text" rows={7} value={epk.fullBio ?? ''} onChange={(event) => onChange({ ...epk, fullBio: event.target.value })} /></div><Collection title="En bref">{epk.editorial.facts.map((fact, index) => <Card key={fact.id} onRemove={() => updateFacts(epk.editorial.facts.filter((_, itemIndex) => itemIndex !== index))} disabled={saving}><Field id={`fact-title-${fact.id}`} label="Titre" value={fact.title} onChange={(title) => updateFacts(epk.editorial.facts.map((item, itemIndex) => itemIndex === index ? { ...item, title } : item))} /><Field id={`fact-value-${fact.id}`} label="Valeur" value={fact.value} onChange={(value) => updateFacts(epk.editorial.facts.map((item, itemIndex) => itemIndex === index ? { ...item, value } : item))} /><FactIconPicker id={`epk-fact-icon-${fact.id}`} value={fact.icon} onChange={(icon) => updateFacts(epk.editorial.facts.map((item, itemIndex) => itemIndex === index ? { ...item, icon } : item))} /></Card>)}<Button variant="primary" fullWidth leadingIcon={<FzIcon name="add" usageId="epk.facts.add" />} disabled={saving} onClick={() => setAddDialog('fact')}>Ajouter un élément</Button></Collection></Section>
    <Section title="Musique"><Field id="music-title" label="Titre" value={epk.editorial.musicTitle} onChange={(musicTitle) => onChange({ ...epk, editorial: { ...epk.editorial, musicTitle } })} /><Collection title="Pistes audio">{props.tracks.map((track) => <Card key={track.id} onRemove={() => props.onRemoveTrack(track)} disabled={saving}><p className="font-semibold">{track.title}</p></Card>)}<Button variant="primary" fullWidth leadingIcon={<FzIcon name="add" usageId="epk.tracks.add" />} disabled={saving || !props.availableTracks.some((track) => track.songId && track.isSynced && !props.tracks.some((item) => item.songAssetId === track.id))} onClick={() => setAddDialog('track')}>Ajouter une piste</Button></Collection><Links title="Plateformes de streaming" dialogTitle="Ajouter une plateforme" names={platforms} items={platformLinks} onAdd={props.onAddLink} onUpdate={props.onUpdateLink} onRemove={props.onRemoveLink} saving={saving} /></Section>
    <Section title="Médias"><Collection title="Vidéos YouTube" count={`${props.videos.length}/2`}>{props.videos.map((video) => <VideoCard key={video.id} video={video} onRemove={() => props.onRemoveVideo(video)} disabled={saving} />)}<Button variant="primary" fullWidth leadingIcon={<FzIcon name="add" usageId="epk.videos.add" />} disabled={saving || props.videos.length >= 2} onClick={() => setAddDialog('video')}>Ajouter une vidéo</Button></Collection><Collection title="Photos" count={`${props.photos.length}/10`}>{props.photos.map((photo) => <PhotoCard key={photo.id} photo={photo} previewUrl={props.photoPreviewUrls[photo.previewAssetId]} onRemove={() => props.onRemovePhoto(photo)} disabled={saving} />)}<PhotoUploadButton disabled={saving || props.photos.length >= 10} onPick={props.onUploadPhoto} /></Collection></Section>
    <Section title="Espace Pro"><Field id="pro-title" label="Titre" value={epk.editorial.proTitle} onChange={(proTitle) => onChange({ ...epk, editorial: { ...epk.editorial, proTitle } })} /><div><FieldLabel htmlFor="epk-pro-description">Description</FieldLabel><TextArea id="epk-pro-description" rows={3} value={epk.editorial.proDescription} onChange={(event) => onChange({ ...epk, editorial: { ...epk.editorial, proDescription: event.target.value } })} /></div><Collection title="Fichiers professionnels">{props.documents.map((document) => <Card key={document.id} onRemove={() => props.onRemoveDocument(document)} disabled={saving}><p className="font-semibold">{document.title}</p><p className="text-xs text-white/55">{document.documentType}</p></Card>)}<Button variant="primary" fullWidth leadingIcon={<FzIcon name="add" usageId="epk.documents.add" />} disabled={saving} onClick={() => setAddDialog('document')}>Ajouter un fichier</Button></Collection></Section>
    <Section title="Contact"><Field id="contact-title" label="Titre" value={epk.editorial.contactTitle} onChange={(contactTitle) => onChange({ ...epk, editorial: { ...epk.editorial, contactTitle } })} /><Collection title="Contacts">{props.contacts.map((contact) => <Card key={contact.id} onRemove={() => props.onRemoveContact(contact)} onEdit={props.onUpdateContact ? () => setEditingContact(contact) : undefined} disabled={saving}><p className="font-semibold">{contact.name}</p><p className="text-sm text-white/65">{contact.role ? `${contact.role} · ` : ''}{[contact.email, contact.phone, contact.whatsapp].filter(Boolean).join(' · ')}</p></Card>)}<Button variant="primary" fullWidth leadingIcon={<FzIcon name="add" usageId="epk.contacts.add" />} disabled={saving} onClick={() => setContactDialogOpen(true)}>Ajouter un contact</Button></Collection><Links title="Réseaux sociaux" dialogTitle="Ajouter un réseau social" names={socials} items={socialLinks} onAdd={props.onAddLink} onUpdate={props.onUpdateLink} onRemove={props.onRemoveLink} saving={saving} /></Section>
  </div>{urlDialogOpen ? <EpkUrlDialog slug={epk.slug} saving={saving} onClose={() => setUrlDialogOpen(false)} onSubmit={(slug) => onChange({ ...epk, slug })} /> : null}{addDialog === 'fact' ? <FactFormDialog saving={saving} onClose={() => setAddDialog(null)} onAdd={(fact) => updateFacts([...epk.editorial.facts, fact])} /> : null}{addDialog === 'track' ? <TrackFormDialog saving={saving} tracks={props.availableTracks.filter((track) => track.isSynced && !props.tracks.some((item) => item.songAssetId === track.id))} onClose={() => setAddDialog(null)} onAdd={props.onAddTrack} /> : null}{addDialog === 'video' ? <VideoFormDialog saving={saving} onClose={() => setAddDialog(null)} onAdd={props.onAddVideo} /> : null}{addDialog === 'document' ? <DocumentFormDialog saving={saving} onClose={() => setAddDialog(null)} onUpload={props.onUploadDocument} /> : null}{contactDialogOpen || editingContact ? <ContactFormDialog saving={saving} initialContact={editingContact} onClose={() => { setContactDialogOpen(false); setEditingContact(null); }} onAdd={(name, role, email, phone) => { if (editingContact && props.onUpdateContact) { props.onUpdateContact(editingContact.id, name, role, email, phone); } else { props.onAddContact(name, role, email, phone); } }} /> : null}</>;
}

function Field({ id, label, value, onChange, type = 'text', required = false, optional = false, name, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: 'text' | 'url' | 'email' | 'tel'; required?: boolean; optional?: boolean; name?: string; placeholder?: string }) { return <div><FieldLabel htmlFor={`epk-${id}`} required={required} optional={optional}>{label}</FieldLabel><TextField id={`epk-${id}`} name={name} type={type} value={value} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></div>; }
export function EpkUrlDialog({ slug, saving, onClose, onSubmit }: { slug: string; saving: boolean; onClose: () => void; onSubmit: (slug: string) => void }) { const [nextSlug, setNextSlug] = useState(slug); const submit = () => { if (!nextSlug.trim()) return; onSubmit(nextSlug.trim()); onClose(); }; return <FormDialog title="Modifier l’URL" closeDisabled={saving} onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }}><div><FieldLabel htmlFor="epk-url-slug" required>URL</FieldLabel><p className="mb-2 text-sm text-[var(--fz-text-muted)]">faderzero.com/</p><TextField id="epk-url-slug" value={nextSlug} required autoComplete="off" onChange={(event) => setNextSlug(event.target.value)} /></div><Button type="submit" variant="primary" fullWidth loading={saving} disabled={!nextSlug.trim()}>Enregistrer les modifications</Button></form></FormDialog>; }
export function ContactFormDialog({ saving, initialContact, onClose, onAdd, onSubmit }: { saving: boolean; initialContact?: EpkContact | null; onClose: () => void; onAdd?: (name: string, role: string, email?: string, phone?: string) => void; onSubmit?: (name: string, role: string, email?: string, phone?: string) => void }) {
  const [name, setName] = useState(initialContact?.name ?? '');
  const [role, setRole] = useState(initialContact?.role ?? '');
  const [email, setEmail] = useState(initialContact?.email ?? '');
  const [phone, setPhone] = useState(initialContact?.phone ?? '');
  const isEditing = Boolean(initialContact);
  const submit = () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || (!trimmedEmail && !trimmedPhone)) return;
    const submitFn = onSubmit ?? onAdd;
    submitFn?.(trimmedName, role.trim(), trimmedEmail || undefined, trimmedPhone || undefined);
    onClose();
  };
  return (
    <FormDialog title={isEditing ? 'Modifier le contact' : 'Ajouter un contact'} closeLabel={isEditing ? 'Fermer la modification du contact' : 'Fermer l’ajout de contact'} closeDisabled={saving} onClose={onClose}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <Field id="contact-name" label="Nom" value={name} required onChange={setName} />
        <Field id="contact-role" label="Rôle" value={role} onChange={setRole} placeholder="Programmation, régie…" />
        <Field
          id="contact-email"
          name="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="contact@exemple.fr"
        />
        <Field
          id="contact-phone"
          name="phone"
          label="Téléphone"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="06 00 00 00 00"
        />
        <Button type="submit" variant="primary" fullWidth loading={saving} disabled={!name.trim() || (!email.trim() && !phone.trim())}>
          {isEditing ? 'Enregistrer les modifications' : 'Ajouter le contact'}
        </Button>
      </form>
    </FormDialog>
  );
}
export function FactFormDialog({ saving, onClose, onAdd }: { saving: boolean; onClose: () => void; onAdd: (fact: EpkFact) => void }) { const [title, setTitle] = useState(''); const [value, setValue] = useState(''); const [icon, setIcon] = useState<EpkFact['icon']>('location'); return <FormDialog title="Ajouter un élément" closeDisabled={saving} onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!value.trim()) return; onAdd({ id: `fact-${Date.now()}`, title: title.trim(), value: value.trim(), icon }); onClose(); }}><Field id="new-fact-title" label="Titre" value={title} optional onChange={setTitle} /><Field id="new-fact-value" label="Valeur" value={value} required onChange={setValue} /><FactIconPicker id="epk-new-fact-icon" value={icon} onChange={setIcon} /><Button type="submit" variant="primary" fullWidth loading={saving} disabled={!value.trim()}>Ajouter l’élément</Button></form></FormDialog>; }
export function TrackFormDialog({ saving, tracks, onClose, onAdd }: { saving: boolean; tracks: AvailableEpkTrack[]; onClose: () => void; onAdd: (id: string, title: string) => void }) { const [displayTitle, setDisplayTitle] = useState(''); const [songId, setSongId] = useState(''); const [trackId, setTrackId] = useState(''); const songs = Array.from(new Map(tracks.flatMap((track) => track.songId && track.songTitle ? [[track.songId, track.songTitle] as const] : [])).entries()); const songTracks = tracks.filter((track) => track.songId === songId); const selectSong = (nextSongId: string) => { setSongId(nextSongId); setTrackId(''); const songTitle = songs.find(([id]) => id === nextSongId)?.[1]; if (!displayTitle.trim() && songTitle) setDisplayTitle(songTitle); }; return <FormDialog title="Ajouter une piste" closeDisabled={saving} onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!displayTitle.trim() || !songId || !trackId) return; onAdd(trackId, displayTitle.trim()); onClose(); }}><Field id="new-track-title" label="Titre affiché" value={displayTitle} required onChange={setDisplayTitle} /><div><FieldLabel htmlFor="epk-new-track-song" required>Chanson du répertoire</FieldLabel><SelectField id="epk-new-track-song" value={songId} required onChange={(event) => selectSong(event.target.value)}><option value="">Choisir une chanson…</option>{songs.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</SelectField></div><div><FieldLabel htmlFor="epk-new-track-audio" required>Audio de la chanson</FieldLabel><SelectField id="epk-new-track-audio" value={trackId} required disabled={!songId} onChange={(event) => setTrackId(event.target.value)}><option value="">Choisir un audio…</option>{songTracks.map((track) => <option key={track.id} value={track.id}>{track.filename}</option>)}</SelectField></div><Button type="submit" variant="primary" fullWidth loading={saving} disabled={!displayTitle.trim() || !songId || !trackId}>Ajouter la piste</Button></form></FormDialog>; }
export function VideoFormDialog({ saving, onClose, onAdd }: { saving: boolean; onClose: () => void; onAdd: (url: string, title: string, type: EpkVideoType) => void }) { const [title, setTitle] = useState(''); const [url, setUrl] = useState(''); return <FormDialog title="Ajouter une vidéo" closeDisabled={saving} onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!url.trim()) return; onAdd(url.trim(), title.trim(), 'MUSIC_VIDEO'); onClose(); }}><Field id="new-video-title" label="Titre" value={title} optional onChange={setTitle} /><Field id="new-video-url" label="URL YouTube" type="url" value={url} required onChange={setUrl} /><Button type="submit" variant="primary" fullWidth loading={saving} disabled={!url.trim()}>Ajouter la vidéo</Button></form></FormDialog>; }
const linkPlaceholders: Record<string, string> = {
  Instagram: 'https://instagram.com/nomdugroupe',
  Facebook: 'https://facebook.com/nomdugroupe',
  YouTube: 'https://youtube.com/@nomdugroupe',
  X: 'https://x.com/nomdugroupe',
  TikTok: 'https://tiktok.com/@nomdugroupe',
  LinkedIn: 'https://linkedin.com/in/...',
  Spotify: 'https://open.spotify.com/artist/...',
  'Apple Music': 'https://music.apple.com/...',
  Deezer: 'https://deezer.com/...',
};

export function LinkFormDialog({ title, names, saving, initialLink, onClose, onAdd, onSubmit }: { title: string; names: string[]; saving: boolean; initialLink?: EpkLink | null; onClose: () => void; onAdd?: (name: string, url: string) => void; onSubmit?: (name: string, url: string) => void }) {
  const initialName = initialLink ? (initialLink.label || initialLink.kind) : (names[0] ?? '');
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialLink?.url ?? '');
  const isEditing = Boolean(initialLink);
  const fieldLabel = title.toLowerCase().includes('plateforme') ? 'Plateforme' : 'Réseau';

  return (
    <FormDialog title={isEditing ? (fieldLabel === 'Plateforme' ? 'Modifier la plateforme' : 'Modifier le réseau social') : title} closeDisabled={saving} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name || !url.trim()) return;
          const submitFn = onSubmit ?? onAdd;
          submitFn?.(name, url.trim());
          onClose();
        }}
      >
        <fieldset>
          <legend className="fz-field-label mb-2">
            {fieldLabel} <span className="ml-1 text-[var(--fz-accent)]" aria-hidden="true">*</span>
          </legend>
          {names.length === 0 ? (
            <p className="py-2 text-sm text-white/50">Tous les éléments sont déjà ajoutés.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {names.map((option) => {
                const selected = option === name;
                const brand = brandByLabel[normalizeBrandLabel(option) as keyof typeof brandByLabel];
                return (
                  <button
                    key={option}
                    type="button"
                    aria-label={option}
                    aria-pressed={selected}
                    title={option}
                    onClick={() => setName(option)}
                    className={`flex min-h-12 items-center justify-center rounded-xl border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 ${
                      selected
                        ? 'border-[color:var(--fz-accent)] bg-[color:var(--fz-accent)]/15 text-[var(--fz-accent)] ring-2 ring-[var(--fz-accent)]/35'
                        : 'border-white/10 bg-white/5 text-white/65 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {brand ? <BrandIcon name={brand} /> : <span className="text-xs font-semibold">{option}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
        <Field id="new-link-url" label="URL" type="url" value={url} required onChange={setUrl} placeholder={linkPlaceholders[name] ?? 'https://...'} />
        <Button type="submit" variant="primary" fullWidth loading={saving} disabled={!name || !url.trim()}>
          {isEditing ? 'Enregistrer les modifications' : 'Ajouter'}
        </Button>
      </form>
    </FormDialog>
  );
}
export function ImageUploadDialog({ title, saving, onClose, onUpload }: { title: string; saving: boolean; onClose: () => void; onUpload: (file: File) => void }) { const inputRef = useRef<HTMLInputElement>(null); const [file, setFile] = useState<File | null>(null); return <FormDialog title={title} closeDisabled={saving} onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!file) return; onUpload(file); onClose(); }}><input ref={inputRef} className="sr-only" aria-label="Image à importer" type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Button variant="secondary" fullWidth disabled={saving} onClick={() => inputRef.current?.click()}>{file ? file.name : 'Choisir une image'}</Button><p className="text-xs text-[var(--fz-text-muted)]">JPEG, PNG ou WebP · 10 Mo maximum.</p><Button type="submit" variant="primary" fullWidth loading={saving} disabled={!file}>Importer</Button></form></FormDialog>; }
export function DocumentFormDialog({ saving, onClose, onUpload }: { saving: boolean; onClose: () => void; onUpload: (file: File, title: string, type: EpkDocumentType) => void }) { const inputRef = useRef<HTMLInputElement>(null); const [file, setFile] = useState<File | null>(null); const [title, setTitle] = useState(''); const [type, setType] = useState<EpkDocumentType>('TECH_RIDER'); return <FormDialog title="Ajouter un fichier" closeDisabled={saving} onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!file || !title.trim()) return; onUpload(file, title.trim(), type); onClose(); }}><Field id="new-document-title" label="Nom" value={title} required onChange={setTitle} /><div><FieldLabel htmlFor="epk-new-document-type" required>Type</FieldLabel><SelectField id="epk-new-document-type" value={type} required onChange={(event) => setType(event.target.value as EpkDocumentType)}>{['TECH_RIDER', 'STAGE_PLOT', 'HOSPITALITY_RIDER', 'PRESS_KIT', 'LOGO', 'OTHER'].map((option) => <option key={option} value={option}>{option}</option>)}</SelectField></div><FieldLabel as="span" required>Fichier PDF</FieldLabel><input ref={inputRef} className="sr-only" aria-label="Fichier PDF" type="file" accept="application/pdf" required disabled={saving} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Button variant="secondary" fullWidth disabled={saving} onClick={() => inputRef.current?.click()}>{file ? file.name : 'Choisir un PDF'}</Button><Button type="submit" variant="primary" fullWidth loading={saving} disabled={!file || !title.trim()}>Ajouter le fichier</Button></form></FormDialog>; }
export function FactIconPicker({ id, value, onChange }: { id: string; value: EpkFact['icon']; onChange: (value: EpkFact['icon']) => void }) { return <fieldset><legend className="fz-field-label">Icône</legend><div id={id} className="mt-2 grid grid-cols-4 gap-2">{factIcons.map((option) => { const selected = option.value === value; return <button key={option.value} type="button" aria-label={option.label} aria-pressed={selected} title={option.label} onClick={() => onChange(option.value)} className={`flex min-h-12 items-center justify-center rounded-xl border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 ${selected ? 'border-[color:var(--fz-accent)] bg-[color:var(--fz-accent)]/15 text-[var(--fz-accent)]' : 'border-white/10 bg-white/5 text-white/65 hover:border-white/25 hover:text-white'}`}><FzIcon name={option.value} usageId={`epk.fact-picker.${option.value}`} size="lg" /></button>; })}</div></fieldset>; }
export function EditIconButton({ label, usageId, disabled, onClick }: { label: string; usageId: string; disabled: boolean; onClick: () => void }) { return <Button variant="secondary" size="sm" loading={disabled} leadingIcon={<FzIcon name="edit" usageId={usageId} />} aria-label={label} title={label} onClick={onClick} />; }
export function DeleteIconButton({ label, usageId, disabled, onClick }: { label: string; usageId: string; disabled: boolean; onClick: () => void }) { return <Button variant="danger" size="sm" loading={disabled} leadingIcon={<FzIcon name="delete" usageId={usageId} />} aria-label={label} title={label} onClick={onClick} />; }
export function HeroImageField({ assetId, previewUrl, disabled, onPick, onRemove }: { assetId: string | undefined; previewUrl: string | undefined; disabled: boolean; onPick: (file: File) => void; onRemove: () => void }) { const [open, setOpen] = useState(false); const hasImage = Boolean(assetId); return <div className="space-y-2"><p className="fz-field-label">Image de bannière</p>{hasImage ? <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"><div className="aspect-video w-full bg-white/5">{previewUrl ? <img src={previewUrl} alt="Miniature de la bannière" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-white/45">Chargement de la miniature…</div>}</div><div className="flex gap-2 p-2"><Button variant="secondary" fullWidth disabled={disabled} leadingIcon={<FzIcon name="edit" usageId="epk.hero.modify" />} onClick={() => setOpen(true)}>Modifier</Button><DeleteIconButton label="Supprimer l’image de bannière" usageId="epk.hero.delete" disabled={disabled} onClick={onRemove} /></div></div> : <Button variant="primary" fullWidth disabled={disabled} leadingIcon={<FzIcon name="add" usageId="epk.hero.add" />} onClick={() => setOpen(true)}>Ajouter</Button>}<p className="text-xs text-[var(--fz-text-muted)]">JPEG, PNG ou WebP · 10 Mo maximum · compressée en WebP jusqu’à 2400 × 1350 px.</p>{open ? <ImageUploadDialog title={hasImage ? "Modifier la bannière" : "Ajouter une bannière"} saving={disabled} onClose={() => setOpen(false)} onUpload={onPick} /> : null}</div>; }
import { youtubeThumbnailUrl } from './epkMedia';

function PhotoUploadButton({ disabled, onPick }: { disabled: boolean; onPick: (file: File) => void }) { const [open, setOpen] = useState(false); return <><Button variant="primary" fullWidth leadingIcon={<FzIcon name="add" usageId="epk.photos.add" />} disabled={disabled} onClick={() => setOpen(true)}>Ajouter une photo</Button>{open ? <ImageUploadDialog title="Ajouter une photo" saving={disabled} onClose={() => setOpen(false)} onUpload={onPick} /> : null}</>; }
export function VideoCard({ video, onRemove, disabled }: { video: EpkVideo; onRemove: () => void; disabled: boolean }) { const thumbnailUrl = youtubeThumbnailUrl(video); const title = video.title || `${video.provider === 'YOUTUBE' ? 'YouTube' : 'Vimeo'} · ${video.providerVideoId}`; return <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"><div className="aspect-video w-full bg-white/5">{thumbnailUrl ? <img src={thumbnailUrl} alt={`Miniature de ${title}`} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-white/35"><FzIcon name="play" usageId="epk.videos.placeholder" size="xl" /></div>}</div><div className="flex min-h-16 items-center gap-3 p-2"><p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{title}</p><DeleteIconButton label={`Supprimer la vidéo ${title}`} usageId="epk.videos.delete" disabled={disabled} onClick={onRemove} /></div></div>; }
function PhotoCard({ photo, previewUrl, onRemove, disabled }: { photo: EpkPhoto; previewUrl: string | undefined; onRemove: () => void; disabled: boolean }) { return <div className="flex min-h-20 items-center gap-3 rounded-xl border border-white/10 p-2"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5">{previewUrl ? <img src={previewUrl} alt={photo.caption || photo.credit || 'Photo presse'} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-white/35"><FzIcon name="music" usageId="epk.photos.placeholder" /></div>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{photo.caption || 'Photo importée'}</p>{photo.credit ? <p className="mt-1 truncate text-xs text-white/55">{photo.credit}</p> : null}</div><DeleteIconButton label="Supprimer cette photo" usageId="epk.photos.delete" disabled={disabled} onClick={onRemove} /></div>; }
function Collection({ title, count, children }: { title: string; count?: string; children: ReactNode }) { return <div className="space-y-3"><div className="flex items-center justify-between"><p className="fz-field-label">{title}</p>{count ? <span className="text-xs text-[var(--fz-text-muted)]">{count}</span> : null}</div>{children}</div>; }
function Card({ children, onRemove, onEdit, disabled }: { children: ReactNode; onRemove: () => void; onEdit?: (() => void) | undefined; disabled: boolean }) { return <div className="flex items-start gap-3 rounded-xl border border-white/10 p-3"><div className="min-w-0 flex-1 space-y-3">{children}</div><div className="flex items-center gap-1.5 shrink-0">{onEdit ? <EditIconButton label="Modifier cet élément" usageId="epk.card.edit" disabled={disabled} onClick={onEdit} /> : null}<DeleteIconButton label="Supprimer cet élément" usageId="epk.collection.delete" disabled={disabled} onClick={onRemove} /></div></div>; }
export function Links({ title, dialogTitle, names, items, onAdd, onUpdate, onRemove, limit, saving }: { title: string; dialogTitle: string; names: string[]; items: EpkLink[]; onAdd: (name: string, url: string) => void; onUpdate?: ((id: string, name: string, url: string) => void) | undefined; onRemove: (item: EpkLink) => void; limit?: number | undefined; saving: boolean }) {
  const [dialogState, setDialogState] = useState<'add' | EpkLink | null>(null);
  const editingLink = typeof dialogState === 'object' && dialogState !== null ? dialogState : null;
  const insertedBrands = new Set(items.map((item) => normalizeBrandLabel(item.label || item.kind)));
  const availableNames = names.filter((name) => {
    const normalized = normalizeBrandLabel(name);
    if (editingLink && normalizeBrandLabel(editingLink.label || editingLink.kind) === normalized) {
      return true;
    }
    return !insertedBrands.has(normalized);
  });
  const isAllInserted = availableNames.length === 0;
  const isLimitReached = limit !== undefined && items.length >= limit;
  const count = limit ? `${items.length}/${limit}` : undefined;
  const showAddButton = !isAllInserted && !isLimitReached;

  return (
    <>
      <Collection title={title} {...(count ? { count } : {})}>
        {items.map((item) => {
          const brand = brandForLink(item);
          return (
            <Card key={item.id} onRemove={() => onRemove(item)} onEdit={onUpdate ? () => setDialogState(item) : undefined} disabled={saving}>
              <div className="flex items-center gap-2">
                {brand ? <BrandIcon name={brand} /> : null}
                <p className="font-semibold">{item.label || item.kind}</p>
              </div>
              <p className="truncate text-sm text-white/65">{item.url}</p>
            </Card>
          );
        })}
        {showAddButton ? (
          <Button
            variant="primary"
            fullWidth
            leadingIcon={<FzIcon name="add" usageId="epk.links.add" />}
            disabled={saving}
            onClick={() => setDialogState('add')}
          >
            Ajouter
          </Button>
        ) : null}
      </Collection>
      {dialogState !== null ? (
        <LinkFormDialog
          title={dialogTitle}
          names={availableNames}
          initialLink={editingLink}
          saving={saving}
          onClose={() => setDialogState(null)}
          onSubmit={(name, url) => {
            if (editingLink && onUpdate) {
              onUpdate(editingLink.id, name, url);
            } else {
              onAdd(name, url);
            }
          }}
        />
      ) : null}
    </>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) { return <details className="group rounded-2xl border border-white/10 bg-white/5 p-4" open><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-base font-black text-white"><span>{title}</span><FzIcon name="chevron-down" usageId="epk.section.toggle" className="shrink-0 transition-transform group-open:rotate-180" /></summary><div className="space-y-4 pt-3">{children}</div></details>; }
