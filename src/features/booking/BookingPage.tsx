import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { bookingRepository, BOOKING_STAGE_LABELS } from '@/db/repositories/bookingRepository';
import { FormDialog } from '@/components/FormDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { BookingNoteType, BookingStage, WorkspaceContactRecord } from '@/db/schema';
import { useAuthStore } from '@/stores/authStore';
import { canWriteWorkspace } from '@/services/supabase/workspace';
import { ContentRow } from '@/ui/components/ContentRow';
import { DateField } from '@/ui/components/DateField';
import { DateTimeField } from '@/ui/components/DateTimeField';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { FzIcon } from '@/ui/icons';
import { SelectField } from '@/ui/components/SelectField';
import { TextArea } from '@/ui/components/TextArea';
import { TextField } from '@/ui/components/TextField';
import { TimeField } from '@/ui/components/TimeField';

type Tab = 'due' | 'all' | 'confirmed';
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
  if (type === 'phone') return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.4 1.8.6 2.8.7a2 2 0 0 1 1.7 2.1Z" /></svg>;
  if (type === 'email') return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M14 3h7v7" /><path d="m21 3-9 9" /><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></svg>;
}

function followUpFromForm(data: FormData) {
  const kind = String(data.get('followUpKind') || 'follow_up') as FollowUpKind;
  const custom = String(data.get('followUpCustom') || '').trim();
  return kind === 'other' ? custom : followUpLabels[kind];
}

function focusFirstInvalidField(form: HTMLFormElement) {
  const field = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[required]'))
    .find((candidate) => !candidate.validity.valid);
  if (!field) return false;
  field.focus();
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
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
    <TextField required name="name" aria-label="Nom du contact" defaultValue={contact?.name} placeholder="Nom du contact" />
    <TextField name="role" aria-label="Rôle" defaultValue={contact?.role} placeholder="Rôle (programmation, régie…)" />
    <TextField name="phone" aria-label="Téléphone" type="tel" defaultValue={contact?.phone} placeholder="Téléphone" />
    <TextField name="email" aria-label="E-mail" type="email" defaultValue={contact?.email} placeholder="E-mail" />
    <TextField name="instagramUrl" aria-label="Lien Instagram" type="url" defaultValue={contact?.instagramUrl} placeholder="Lien Instagram" />
    <TextField name="facebookUrl" aria-label="Lien Facebook" type="url" defaultValue={contact?.facebookUrl} placeholder="Lien Facebook" />
  </>;
}

export function BookingPage() {
  const navigate = useNavigate();
  const { bookingId } = useParams<{ bookingId?: string }>();
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const session = useAuthStore((state) => state.session);
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const [tab, setTab] = useState<Tab>('due');
  const selectedId = bookingId ?? null;
  const [isAdding, setIsAdding] = useState(false);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [isLoggingExchange, setIsLoggingExchange] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isLinkingContact, setIsLinkingContact] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<WorkspaceContactRecord | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLeadFormError, setNewLeadFormError] = useState<string | null>(null);

  const leads = useLiveQuery(() => bookingRepository.listLeads(activeWorkspace?.id), [activeWorkspace?.id]) ?? [];
  const workspaceContacts = useLiveQuery(() => bookingRepository.listWorkspaceContacts(activeWorkspace?.id), [activeWorkspace?.id]) ?? [];
  const selected = leads.find((lead) => lead.id === selectedId) ?? null;
  const notes = useLiveQuery(() => selectedId ? bookingRepository.listNotes(selectedId) : Promise.resolve([]), [selectedId]) ?? [];
  const contacts = useLiveQuery(() => selectedId ? bookingRepository.listLeadContacts(selectedId) : Promise.resolve([]), [selectedId]) ?? [];
  const visible = useMemo(() => leads.filter((lead) => {
    if (tab === 'confirmed') return lead.stage === 'confirmed';
    if (tab === 'all') return lead.stage !== 'closed';
    return lead.stage !== 'closed' && lead.stage !== 'confirmed' && lead.nextActionAt <= Date.now();
  }), [leads, tab]);
  const availableContacts = workspaceContacts.filter((contact) => !contacts.some((linked) => linked.id === contact.id));

  async function createLead(form: HTMLFormElement) {
    const data = new FormData(form); setError(null);
    try {
      const nextActionAt = new Date(String(data.get('nextActionAt'))).getTime();
      const lead = await bookingRepository.createLead({
        venueName: String(data.get('venueName') || ''), city: String(data.get('city') || '') || undefined,
        targetDate: String(data.get('targetDate') || '') || undefined, targetPeriodStart: String(data.get('periodStart') || '') || undefined,
        nextAction: followUpFromForm(data), nextActionAt, ownerId: session?.user.id,
      });
      const contactName = String(data.get('contactName') || '').trim();
      if (contactName) {
        const contact = await bookingRepository.createWorkspaceContact({
          name: contactName,
          role: String(data.get('contactRole') || '').trim() || undefined,
          phone: String(data.get('contactPhone') || '').trim() || undefined,
          email: String(data.get('contactEmail') || '').trim() || undefined,
        });
        await bookingRepository.linkContact(lead.id, contact.id);
      }
      navigate(`/booking/${lead.id}`); setIsAdding(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de créer la salle.'); }
  }

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
      const contact = await bookingRepository.createWorkspaceContact({ name: String(data.get('name') || ''), role: String(data.get('role') || '') || undefined, phone: String(data.get('phone') || '') || undefined, email: String(data.get('email') || '') || undefined, instagramUrl: String(data.get('instagramUrl') || '') || undefined, facebookUrl: String(data.get('facebookUrl') || '') || undefined });
      await bookingRepository.linkContact(selected.id, contact.id);
      setIsAddingContact(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible d’ajouter le contact.'); }
  }

  async function updateContact(form: HTMLFormElement) {
    if (!contactToEdit) return; const data = new FormData(form); setError(null);
    try {
      await bookingRepository.updateWorkspaceContact(contactToEdit.id, { name: String(data.get('name') || ''), role: String(data.get('role') || '') || undefined, phone: String(data.get('phone') || '') || undefined, email: String(data.get('email') || '') || undefined, instagramUrl: String(data.get('instagramUrl') || '') || undefined, facebookUrl: String(data.get('facebookUrl') || '') || undefined });
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
      {contactToEdit && <FormDialog title="Modifier le contact" onClose={() => setContactToEdit(null)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void updateContact(event.currentTarget); }} className="space-y-3">{error && <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p>}<ContactForm contact={contactToEdit} /><button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Enregistrer</button><button type="button" onClick={() => { void unlinkContact(contactToEdit.id); setContactToEdit(null); }} className="w-full rounded-xl bg-rose-500/15 px-4 py-3 text-xs font-black uppercase tracking-widest text-rose-200">Retirer de cette salle</button></form></FormDialog>}
      {isLinkingContact && <FormDialog title="Lier un contact" onClose={() => setIsLinkingContact(false)} placement="bottom"><div className="space-y-2">{availableContacts.map((contact) => <button key={contact.id} type="button" onClick={() => void linkContact(contact.id)} className="w-full rounded-xl bg-white/6 p-4 text-left transition hover:bg-white/12"><p className="font-black">{contact.name}</p><p className="mt-1 text-xs text-white/55">{contact.role || contact.email || contact.phone || 'Sans coordonnées'}</p></button>)}{availableContacts.length === 0 && <p className="text-sm text-white/60">Aucun autre contact disponible dans le carnet.</p>}</div></FormDialog>}
      {isCalendarOpen && <FormDialog title="Ajouter le concert au calendrier" onClose={() => setIsCalendarOpen(false)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void addToCalendar(event.currentTarget); }} className="space-y-4"><p className="text-sm text-white/65">{selected.venueName}{selected.city ? ` · ${selected.city}` : ''}</p><label className="block"><span className="fz-field-label">Date</span><DateField required name="date" aria-label="Date du concert" defaultValue={selected.targetDate} /></label><label className="block"><span className="fz-field-label">Heure</span><TimeField required name="time" aria-label="Heure du concert" defaultValue="20:00" /></label><button className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-white">Créer le concert</button></form></FormDialog>}
      {isEditingLead && <FormDialog title="Détails de la salle" onClose={() => setIsEditingLead(false)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void saveLead(event.currentTarget); }} className="space-y-3"><TextField required name="venueName" aria-label="Salle ou organisateur" defaultValue={selected.venueName} /><TextField name="city" aria-label="Ville" defaultValue={selected.city} placeholder="Ville" /><label className="block"><span className="fz-field-label">Date cible</span><DateField required name="targetDate" aria-label="Date cible" defaultValue={selected.targetDate} /></label><label className="block"><span className="fz-field-label">Statut</span><SelectField name="stage" aria-label="Statut" defaultValue={selected.stage}>{editableStages.map((stage) => <option key={stage} value={stage}>{BOOKING_STAGE_LABELS[stage]}</option>)}</SelectField></label><label className="block"><span className="fz-field-label">Notes globales</span><TextArea name="summary" defaultValue={selected.summary} placeholder="Objectif, contexte et informations utiles…" /></label><div className="grid grid-cols-2 gap-2"><button className="rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Enregistrer</button><button type="button" onClick={() => setIsDeleteConfirmOpen(true)} className="rounded-xl bg-rose-500/15 px-4 py-3 text-xs font-black uppercase tracking-widest text-rose-200">Supprimer</button></div></form></FormDialog>}
      <ConfirmDialog isOpen={isDeleteConfirmOpen} title="Supprimer cette salle ?" description="Les relances et l’historique associés ne seront plus visibles." confirmLabel="Supprimer" onConfirm={() => void deleteSelected()} onCancel={() => setIsDeleteConfirmOpen(false)} />
    </section>;
  }

  return <section className="space-y-4 pb-6"><DetailHeader title="Booking" onBack={() => navigate('/calendar')} backLabel="Retour au calendrier" actions={canWrite ? <button type="button" onClick={() => setIsAdding(true)} aria-label="Ajouter une proposition"><FzIcon name="add" usageId="booking-header.add" size="md" /></button> : undefined} /><div className="grid grid-cols-3 gap-2">{([['due', 'À relancer'], ['all', 'Toutes'], ['confirmed', 'Confirmées']] as const).map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)} className={`rounded-xl px-2 py-2 text-xs font-black ${tab === value ? 'bg-white text-black' : 'bg-white/5 text-white/55'}`}>{label}</button>)}</div>{error && <p className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p>}<div className="divide-y divide-white/10">{visible.map((lead) => <ContentRow key={lead.id} mode="link" to={`/booking/${lead.id}`} title={lead.venueName} metadata={`${lead.city || 'Ville non renseignée'} · ${lead.nextAction}`} status={<span className={`text-[0.65rem] font-black ${lead.nextActionAt < Date.now() ? 'text-rose-300' : 'text-amber-200'}`}>{dueLabel(lead.nextActionAt)}</span>} />)}{visible.length === 0 && <div className="rounded-[1rem] bg-[var(--fz-bg-elevated)] p-6 text-center text-sm text-white/60">Aucune relance à faire dans cette vue.</div>}</div>{isAdding && <FormDialog title="Nouvelle proposition" onClose={() => setIsAdding(false)} placement="bottom"><form noValidate onInput={() => setNewLeadFormError(null)} onSubmit={(event) => { event.preventDefault(); if (focusFirstInvalidField(event.currentTarget)) { setNewLeadFormError('Complète les champs obligatoires indiqués par un astérisque.'); return; } void createLead(event.currentTarget); }} className="space-y-4">{newLeadFormError && <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{newLeadFormError}</p>}<label className="block"><span className="fz-field-label">Salle ou organisateur <span className="text-rose-300">*</span></span><TextField required name="venueName" aria-label="Salle ou organisateur" placeholder="Salle ou organisateur" /></label><label className="block"><span className="fz-field-label">Ville</span><TextField name="city" aria-label="Ville" placeholder="Ville" /></label><label className="block"><span className="fz-field-label">Date cible <span className="text-rose-300">*</span></span><DateField required name="targetDate" aria-label="Date cible" /></label><fieldset className="space-y-3 border-t border-white/10 pt-4"><legend className="text-xs font-black uppercase tracking-widest text-white/60">Contact (facultatif)</legend><label className="block"><span className="fz-field-label">Nom du contact</span><TextField name="contactName" aria-label="Nom du contact" placeholder="Nom du contact" /></label><label className="block"><span className="fz-field-label">Rôle</span><TextField name="contactRole" aria-label="Rôle du contact" placeholder="Programmation, régie…" /></label><label className="block"><span className="fz-field-label">Téléphone</span><TextField name="contactPhone" aria-label="Téléphone du contact" type="tel" placeholder="Téléphone" /></label><label className="block"><span className="fz-field-label">E-mail</span><TextField name="contactEmail" aria-label="E-mail du contact" type="email" placeholder="E-mail" /></label></fieldset><FollowUpFields /><p className="text-xs text-white/55"><span className="text-rose-300">*</span> Champs obligatoires</p><button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Créer la proposition</button></form></FormDialog>}</section>;
}
