import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { bookingRepository, BOOKING_STAGE_LABELS } from '@/db/repositories/bookingRepository';
import { FormDialog } from '@/components/FormDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { BookingNoteType, BookingStage, WorkspaceContactRecord } from '@/db/schema';
import { useAuthStore } from '@/stores/authStore';
import { canWriteWorkspace } from '@/services/supabase/workspace';
import { DateField } from '@/ui/components/DateField';
import { DateTimeField } from '@/ui/components/DateTimeField';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { FieldLabel } from '@/ui/components/FieldLabel';
import { FzIcon } from '@/ui/icons';
import { formatContactPhone } from '@/lib/contactUrls';
import { Button } from '@/ui/components/Button';
import { SelectField } from '@/ui/components/SelectField';
import { TextArea } from '@/ui/components/TextArea';
import { TextField } from '@/ui/components/TextField';
import { TimeField } from '@/ui/components/TimeField';
import { BookingOverview } from './BookingOverview';

type FollowUpKind = 'call' | 'email' | 'follow_up' | 'send_press_kit' | 'other';

const followUpLabels: Record<FollowUpKind, string> = {
  call: 'Appeler', email: 'Envoyer un e-mail', follow_up: 'Relancer', send_press_kit: 'Envoyer le dossier', other: 'Autre',
};
const noteTypes: Array<[BookingNoteType, string]> = [
  ['email_sent', 'E-mail envoyé'], ['call', 'Appel effectué'], ['message_sent', 'Message envoyé'], ['reply_received', 'Réponse reçue'], ['internal_decision', 'Décision interne'], ['free_note', 'Note libre'],
];
const editableStages: BookingStage[] = ['to_contact', 'contacted', 'in_discussion', 'option', 'confirmed'];
const displayStages: Array<[BookingStage, string]> = [
  ['to_contact', 'À contacter'],
  ['in_discussion', 'En discussion'],
  ['confirmed', 'Confirmé'],
];

function dueLabel(timestamp: number) {
  const delta = timestamp - Date.now();
  if (delta < 0) return 'En retard';
  if (delta < 86400000) return "Aujourd’hui";
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function targetDateLabel(lead: { targetDate?: string | undefined; targetPeriodStart?: string | undefined; targetPeriodEnd?: string | undefined }) {
  if (lead.targetDate) return new Date(`${lead.targetDate}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  if (lead.targetPeriodStart && lead.targetPeriodEnd) return `Du ${new Date(`${lead.targetPeriodStart}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${new Date(`${lead.targetPeriodEnd}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  if (lead.targetPeriodStart) return `À partir du ${new Date(`${lead.targetPeriodStart}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return 'Date à préciser';
}

function ContactActionIcon({ type }: { type: 'phone' | 'email' | 'social' }) {
  const icon = type === 'phone' ? 'phone' : type === 'email' ? 'email' : 'external-link';
  return <FzIcon name={icon} usageId={`booking-detail.contact-${type}`} size="md" />;
}

function followUpFromForm(data: FormData) {
  const kind = String(data.get('followUpKind') || 'follow_up') as FollowUpKind;
  const custom = String(data.get('followUpCustom') || '').trim();
  return kind === 'other' ? custom : followUpLabels[kind];
}

function FollowUpFields({ includeSummary = false }: { includeSummary?: boolean }) {
  return <>
    <label className="block"><span className="fz-field-label">Prochaine action <span className="text-rose-300">*</span></span>
      <SelectField required name="followUpKind" aria-label="Prochaine action" defaultValue="follow_up">
        {Object.entries(followUpLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </SelectField>
    </label>
    <label className="block"><span className="fz-field-label">Précision si nécessaire</span>
      <TextField name="followUpCustom" placeholder="Ex. rappeler après le festival" />
    </label>
    <label className="block"><span className="fz-field-label">Quand ? <span className="text-rose-300">*</span></span>
      <DateTimeField required name="nextActionAt" aria-label="Date et heure de la prochaine action" />
    </label>
    {includeSummary ? <label className="block"><span className="fz-field-label">Résumé de l’échange <span className="text-rose-300">*</span></span>
      <TextArea required name="summary" placeholder="Ce qui a été décidé ou appris…" />
    </label> : null}
  </>;
}

function ContactForm({ contact }: { contact?: WorkspaceContactRecord }) {
  return <>
    <div><FieldLabel htmlFor="booking-detail-contact-name" required>Nom du contact</FieldLabel><TextField id="booking-detail-contact-name" required name="name" defaultValue={contact?.name} placeholder="Ex. Camille Martin" /></div>
    <div><FieldLabel htmlFor="booking-detail-contact-organization" required>Structure, salle ou association</FieldLabel><TextField id="booking-detail-contact-organization" required name="organization" defaultValue={contact?.organization} placeholder="Ex. Le Chabada" /></div>
    <div><FieldLabel htmlFor="booking-detail-contact-role">Rôle</FieldLabel><TextField id="booking-detail-contact-role" name="role" defaultValue={contact?.role} placeholder="Programmation, régie…" /></div>
    <div><FieldLabel htmlFor="booking-detail-contact-city">Ville</FieldLabel><TextField id="booking-detail-contact-city" name="city" defaultValue={contact?.city} placeholder="Ville" /></div>
    <div><FieldLabel htmlFor="booking-detail-contact-phone" required>Téléphone</FieldLabel><TextField id="booking-detail-contact-phone" required name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={formatContactPhone(contact?.phone)} onChange={(event) => { event.currentTarget.value = formatContactPhone(event.currentTarget.value); }} placeholder="06 00 00 00 00" /></div>
    <div><FieldLabel htmlFor="booking-detail-contact-email">E-mail</FieldLabel><TextField id="booking-detail-contact-email" name="email" type="email" defaultValue={contact?.email} placeholder="contact@exemple.fr" /></div>
    <div><FieldLabel htmlFor="booking-detail-contact-website">Site web</FieldLabel><TextField id="booking-detail-contact-website" name="website" defaultValue={contact?.website} placeholder="site.com" /></div>
    <div><FieldLabel htmlFor="booking-detail-contact-instagram">Instagram</FieldLabel><TextField id="booking-detail-contact-instagram" name="instagramUrl" defaultValue={contact?.instagramUrl} placeholder="@profil ou lien complet" /></div>
    <div><FieldLabel htmlFor="booking-detail-contact-facebook">Facebook</FieldLabel><TextField id="booking-detail-contact-facebook" name="facebookUrl" defaultValue={contact?.facebookUrl} placeholder="profil ou lien complet" /></div>
  </>;
}

export function BookingPage() {
  const { bookingId } = useParams<{ bookingId?: string }>();
  return bookingId ? <BookingDetail bookingId={bookingId} /> : <BookingOverview />;
}

function contactInputFromForm(data: FormData) {
  return {
    name: String(data.get('name') || ''),
    organization: String(data.get('organization') || '') || undefined,
    role: String(data.get('role') || '') || undefined,
    city: String(data.get('city') || '') || undefined,
    phone: String(data.get('phone') || '') || undefined,
    email: String(data.get('email') || '') || undefined,
    website: String(data.get('website') || '') || undefined,
    instagramUrl: String(data.get('instagramUrl') || '') || undefined,
    facebookUrl: String(data.get('facebookUrl') || '') || undefined,
  };
}

function BookingDetail({ bookingId }: { bookingId: string }) {
  const navigate = useNavigate();
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const selectedId = bookingId;
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [isLoggingExchange, setIsLoggingExchange] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isLinkingContact, setIsLinkingContact] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<WorkspaceContactRecord | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isContactDeleteConfirmOpen, setIsContactDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leads = useLiveQuery(() => bookingRepository.listLeads(activeWorkspace?.id), [activeWorkspace?.id]) ?? [];
  const workspaceContacts = useLiveQuery(() => bookingRepository.listWorkspaceContacts(activeWorkspace?.id), [activeWorkspace?.id]) ?? [];
  const selected = leads.find((lead) => lead.id === selectedId) ?? null;
  const notes = useLiveQuery(() => selectedId ? bookingRepository.listNotes(selectedId) : Promise.resolve([]), [selectedId]) ?? [];
  const contacts = useLiveQuery(() => selectedId ? bookingRepository.listLeadContacts(selectedId) : Promise.resolve([]), [selectedId]) ?? [];
  const availableContacts = workspaceContacts.filter((contact) => !contacts.some((linked) => linked.id === contact.id));

  async function saveLead(form: HTMLFormElement) {
    if (!selected) return; const data = new FormData(form); setError(null);
    try {
      await bookingRepository.updateLead(selected.id, {
        venueName: String(data.get('venueName') || ''), city: String(data.get('city') || '') || undefined,
        targetDate: String(data.get('targetDate') || '') || undefined, targetPeriodStart: String(data.get('periodStart') || '') || undefined,
        stage: String(data.get('stage')) as BookingStage,
        summary: String(data.get('summary') || '') || undefined,
      });
      setIsEditingLead(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de modifier la salle.'); }
  }

  async function logExchange(form: HTMLFormElement) {
    if (!selected) return; const data = new FormData(form); setError(null);
    try {
      await bookingRepository.addNote(selected.id, {
        type: String(data.get('type')) as BookingNoteType,
        summary: String(data.get('summary') || ''),
        nextAction: followUpFromForm(data),
        nextActionAt: new Date(String(data.get('nextActionAt'))).getTime(),
      });
      setIsLoggingExchange(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer l’échange.'); }
  }

  async function createContact(form: HTMLFormElement) {
    if (!selected) return; const data = new FormData(form); setError(null);
    try {
      const contact = await bookingRepository.createWorkspaceContact(contactInputFromForm(data));
      await bookingRepository.linkContact(selected.id, contact.id);
      setIsAddingContact(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible d’ajouter le contact.'); }
  }

  async function updateContact(form: HTMLFormElement) {
    if (!contactToEdit) return; const data = new FormData(form); setError(null);
    try {
      await bookingRepository.updateWorkspaceContact(contactToEdit.id, contactInputFromForm(data));
      setContactToEdit(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de modifier le contact.'); }
  }

  async function linkContact(contactId: string) {
    if (!selected) return; setError(null);
    try { await bookingRepository.linkContact(selected.id, contactId); setIsLinkingContact(false); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de lier le contact.'); }
  }

  async function unlinkContact(contactId: string) {
    if (!selected) return; setError(null);
    try { await bookingRepository.unlinkContact(selected.id, contactId); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de retirer le contact.'); }
  }

  async function deleteContact() {
    if (!contactToEdit) return;
    setError(null);
    try {
      await bookingRepository.deleteWorkspaceContact(contactToEdit.id);
      setIsContactDeleteConfirmOpen(false);
      setContactToEdit(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de supprimer le contact.'); }
  }

  async function addToCalendar(form: HTMLFormElement) {
    if (!selected) return; setError(null);
    try {
      const scheduledAt = new Date(`${String(new FormData(form).get('date'))}T${String(new FormData(form).get('time'))}`).getTime();
      await bookingRepository.confirmLead(selected.id, scheduledAt);
      setIsCalendarOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible d’ajouter le concert au calendrier.'); }
  }

  async function deleteSelected() {
    if (!selected) return; setError(null);
    try { await bookingRepository.archiveLead(selected.id); setIsDeleteConfirmOpen(false); setIsEditingLead(false); navigate('/booking'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de supprimer cette salle.'); }
  }

  async function updateStage(stage: BookingStage) {
    if (!selected || !canWrite || selected.stage === stage) return;
    setError(null);
    try { await bookingRepository.updateLead(selected.id, { stage }); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de modifier le statut.'); }
  }

  if (selected) {
    return <section className="space-y-6 pb-6">
      <DetailHeader
        title={selected.venueName}
        subtitle={`${selected.city || 'Ville non renseignée'} · ${targetDateLabel(selected)}`}
        onBack={() => navigate('/booking')}
        backLabel="Retour au booking"
        actions={canWrite ? (
          <button type="button" onClick={() => setIsEditingLead(true)} aria-label="Modifier la salle">
            <FzIcon name="edit" usageId="booking-detail.edit" size="md" />
          </button>
        ) : undefined}
      />

      {error && <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p>}

      <section aria-labelledby="booking-stage-heading" className="space-y-3"><div className="flex items-center justify-between gap-3"><p id="booking-stage-heading" className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Statut de la prospection</p>{selected.eventId ? <span className="text-xs font-bold text-emerald-200">Au calendrier</span> : selected.stage === 'confirmed' && canWrite ? <button type="button" onClick={() => setIsCalendarOpen(true)} className="rounded-lg bg-emerald-400/15 px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/22">Ajouter au calendrier</button> : null}</div><div className="grid grid-cols-3 gap-2">{displayStages.map(([stage, label]) => <button key={stage} type="button" aria-pressed={selected.stage === stage} disabled={!canWrite} onClick={() => void updateStage(stage)} className={`min-h-11 rounded-xl border px-2 text-xs font-black leading-tight transition ${selected.stage === stage ? 'border-rose-400/35 bg-rose-500/18 text-white shadow-[0_10px_24px_rgba(255,58,99,0.12)]' : 'border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/[0.07]'} disabled:cursor-default`}>{label}</button>)}</div></section>

      <section aria-labelledby="contacts-heading" className="space-y-3"><div className="flex items-center justify-between gap-3"><p id="contacts-heading" className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Contacts</p>{canWrite && <div className="flex gap-2"><button type="button" onClick={() => setIsLinkingContact(true)} className="rounded-lg bg-white/6 px-3 py-2 text-xs font-black text-white transition hover:bg-white/12">Lier</button><button type="button" onClick={() => setIsAddingContact(true)} className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-black text-white transition hover:bg-rose-400">Ajouter</button></div>}</div><div className="space-y-2">{contacts.map((contact, index) => { const socialUrl = contact.instagramUrl || contact.facebookUrl; const initials = contact.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); return <article key={contact.id} className="fz-card flex min-h-14 items-center gap-3 rounded-2xl p-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400/75 to-rose-700/75 text-xs font-black text-white">{initials || '?'}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{contact.name}</p><p className="mt-0.5 truncate text-xs text-[var(--fz-text-muted)]">{contact.role || 'Contact'}{index === 0 ? ' · contact principal' : ''}</p></div><div className="flex shrink-0 gap-1.5"><a href={contact.phone ? `tel:${contact.phone}` : undefined} aria-label={`Appeler ${contact.name}`} aria-disabled={!contact.phone} className={`flex h-11 w-11 items-center justify-center rounded-xl ${contact.phone ? 'bg-white/[0.07] text-white transition hover:bg-white/[0.14]' : 'cursor-not-allowed bg-white/[0.03] text-white/25'}`} onClick={(event) => { if (!contact.phone) event.preventDefault(); }}><ContactActionIcon type="phone" /></a><a href={contact.email ? `mailto:${contact.email}` : undefined} aria-label={`Envoyer un e-mail à ${contact.name}`} aria-disabled={!contact.email} className={`flex h-11 w-11 items-center justify-center rounded-xl ${contact.email ? 'bg-white/[0.07] text-white transition hover:bg-white/[0.14]' : 'cursor-not-allowed bg-white/[0.03] text-white/25'}`} onClick={(event) => { if (!contact.email) event.preventDefault(); }}><ContactActionIcon type="email" /></a>{canWrite && <button type="button" onClick={() => setContactToEdit(contact)} aria-label={`Modifier ${contact.name}`} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.07] text-sm text-white/80 transition hover:bg-white/[0.14]">•••</button>}</div>{socialUrl && <a href={socialUrl} target="_blank" rel="noreferrer" aria-label={`Ouvrir le réseau social de ${contact.name}`} className="sr-only"><ContactActionIcon type="social" /></a>}</article>; })}{contacts.length === 0 && <p className="fz-card rounded-2xl p-4 text-sm text-white/60">Aucun contact lié. Ajoute la personne à relancer.</p>}</div></section>

      <section aria-labelledby="global-notes-heading" className="space-y-2"><p id="global-notes-heading" className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Notes globales</p><div className="fz-card rounded-2xl p-4"><p className={`whitespace-pre-wrap text-sm leading-6 ${selected.summary ? 'text-white/85' : 'text-white/45'}`}>{selected.summary || 'Aucune note globale pour cette salle.'}</p>{canWrite && <button type="button" onClick={() => setIsEditingLead(true)} className="mt-3 text-xs font-black text-rose-200 underline decoration-rose-300/40 underline-offset-4">Modifier les notes</button>}</div></section>

      <section aria-labelledby="timeline-heading" className="space-y-3"><div className="flex items-center justify-between gap-3"><p id="timeline-heading" className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Timeline</p>{canWrite && <button type="button" onClick={() => setIsLoggingExchange(true)} className="rounded-lg bg-white/8 px-3 py-2 text-xs font-black text-white transition hover:bg-white/14">Ajouter une note</button>}</div><div className="space-y-3 border-l border-white/10 pl-4"><article className="relative fz-card rounded-2xl p-3 before:absolute before:-left-[1.35rem] before:top-4 before:h-3 before:w-3 before:rounded-full before:border before:border-rose-300/50 before:bg-[var(--fz-bg)]"><p className="text-xs font-black text-rose-200">À venir · {dueLabel(selected.nextActionAt)}</p><p className="mt-1 text-sm font-bold text-white">{selected.nextAction}</p><p className={`mt-2 text-[0.68rem] ${selected.nextActionAt < Date.now() ? 'text-rose-200' : 'text-white/45'}`}>{new Date(selected.nextActionAt).toLocaleString('fr-FR')}</p></article>{notes.map((note) => <article key={note.id} className="relative fz-card rounded-2xl p-3 before:absolute before:-left-[1.35rem] before:top-4 before:h-3 before:w-3 before:rounded-full before:border before:border-white/20 before:bg-[var(--fz-bg-elevated)]"><p className="text-xs font-black text-rose-200">{noteTypes.find(([type]) => type === note.type)?.[1]}</p><p className="mt-1 text-sm leading-6 text-white/85">{note.summary}</p><p className="mt-2 text-[0.68rem] text-white/45">{new Date(note.occurredAt).toLocaleString('fr-FR')}</p></article>)}{notes.length === 0 && <p className="text-sm text-white/50">Aucun échange consigné pour le moment.</p>}</div></section>

      {isLoggingExchange && <FormDialog title="Consigner un échange" onClose={() => setIsLoggingExchange(false)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void logExchange(event.currentTarget); }} className="space-y-3"><label className="block"><span className="fz-field-label">Type d’échange</span><SelectField name="type" aria-label="Type d’échange" defaultValue="call">{noteTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField></label><FollowUpFields includeSummary /><button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Enregistrer</button></form></FormDialog>}
      {isAddingContact && <FormDialog title="Nouveau contact" onClose={() => setIsAddingContact(false)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void createContact(event.currentTarget); }} className="space-y-3">{error && <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p>}<ContactForm /><button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Ajouter le contact</button></form></FormDialog>}
      {contactToEdit && <FormDialog title="Modifier le contact" onClose={() => setContactToEdit(null)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void updateContact(event.currentTarget); }} className="space-y-3">{error && <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p>}<ContactForm contact={contactToEdit} /><Button type="submit" variant="primary" fullWidth>Enregistrer</Button><Button variant="secondary" fullWidth onClick={() => { void unlinkContact(contactToEdit.id); setContactToEdit(null); }}>Retirer de cette salle</Button><Button variant="danger" fullWidth onClick={() => setIsContactDeleteConfirmOpen(true)}>Supprimer le contact</Button></form></FormDialog>}
      {isLinkingContact && <FormDialog title="Lier un contact" onClose={() => setIsLinkingContact(false)} placement="bottom"><div className="space-y-2">{availableContacts.map((contact) => <button key={contact.id} type="button" onClick={() => void linkContact(contact.id)} className="w-full rounded-xl bg-white/6 p-4 text-left transition hover:bg-white/12"><p className="font-black">{contact.name}</p><p className="mt-1 text-xs text-white/55">{contact.role || contact.email || contact.phone || 'Sans coordonnées'}</p></button>)}{availableContacts.length === 0 && <p className="text-sm text-white/60">Aucun autre contact disponible dans le carnet.</p>}</div></FormDialog>}
      {isCalendarOpen && <FormDialog title="Ajouter le concert au calendrier" onClose={() => setIsCalendarOpen(false)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void addToCalendar(event.currentTarget); }} className="space-y-4"><p className="text-sm text-white/65">{selected.venueName}{selected.city ? ` · ${selected.city}` : ''}</p><label className="block"><span className="fz-field-label">Date</span><DateField required name="date" aria-label="Date du concert" defaultValue={selected.targetDate} /></label><label className="block"><span className="fz-field-label">Heure</span><TimeField required name="time" aria-label="Heure du concert" defaultValue="20:00" /></label><button className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-white">Créer le concert</button></form></FormDialog>}
      {isEditingLead && <FormDialog title="Détails de la salle" onClose={() => setIsEditingLead(false)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void saveLead(event.currentTarget); }} className="space-y-3"><TextField required name="venueName" aria-label="Salle ou organisateur" defaultValue={selected.venueName} /><TextField name="city" aria-label="Ville" defaultValue={selected.city} placeholder="Ville" /><label className="block"><span className="fz-field-label">Date cible</span><DateField required name="targetDate" aria-label="Date cible" defaultValue={selected.targetDate} /></label><label className="block"><span className="fz-field-label">Statut</span><SelectField name="stage" aria-label="Statut" defaultValue={selected.stage}>{editableStages.map((stage) => <option key={stage} value={stage}>{BOOKING_STAGE_LABELS[stage]}</option>)}</SelectField></label><label className="block"><span className="fz-field-label">Notes globales</span><TextArea name="summary" defaultValue={selected.summary} placeholder="Objectif, contexte et informations utiles…" /></label><div className="grid grid-cols-2 gap-2"><button className="rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Enregistrer</button><button type="button" onClick={() => setIsDeleteConfirmOpen(true)} className="rounded-xl bg-rose-500/15 px-4 py-3 text-xs font-black uppercase tracking-widest text-rose-200">Supprimer</button></div></form></FormDialog>}
      <ConfirmDialog isOpen={isDeleteConfirmOpen} title="Supprimer cette salle ?" description="Les relances et l’historique associés ne seront plus visibles." confirmLabel="Supprimer" onConfirm={() => void deleteSelected()} onCancel={() => setIsDeleteConfirmOpen(false)} />
      <ConfirmDialog isOpen={isContactDeleteConfirmOpen} title="Supprimer ce contact ?" description="Le contact sera retiré du carnet et de toutes ses propositions liées." confirmLabel="Supprimer" onConfirm={() => void deleteContact()} onCancel={() => setIsContactDeleteConfirmOpen(false)} />
    </section>;
  }

  return null;
}
