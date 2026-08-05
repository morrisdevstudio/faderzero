import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { bookingRepository, BOOKING_STAGE_LABELS } from '@/db/repositories/bookingRepository';
import { FormDialog } from '@/components/FormDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { BookingNoteType, BookingStage, WorkspaceContactRecord } from '@/db/schema';
import { useAuthStore } from '@/stores/authStore';
import { canWriteWorkspace } from '@/services/supabase/workspace';

type Tab = 'due' | 'all' | 'confirmed';
type FollowUpKind = 'call' | 'email' | 'follow_up' | 'send_press_kit' | 'other';

const followUpLabels: Record<FollowUpKind, string> = {
  call: 'Appeler', email: 'Envoyer un e-mail', follow_up: 'Relancer', send_press_kit: 'Envoyer le dossier', other: 'Autre',
};
const noteTypes: Array<[BookingNoteType, string]> = [
  ['email_sent', 'E-mail envoyé'], ['call', 'Appel effectué'], ['message_sent', 'Message envoyé'], ['reply_received', 'Réponse reçue'], ['internal_decision', 'Décision interne'], ['free_note', 'Note libre'],
];
const editableStages: BookingStage[] = ['to_contact', 'contacted', 'in_discussion', 'option', 'confirmed'];

function dueLabel(timestamp: number) {
  const delta = timestamp - Date.now();
  if (delta < 0) return 'En retard';
  if (delta < 86400000) return "Aujourd’hui";
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
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
    <label className="block text-xs text-white/60">Prochaine action <span className="text-rose-300">*</span>
      <select required name="followUpKind" defaultValue="follow_up" className="fz-input mt-1 text-sm">
        {Object.entries(followUpLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label className="block text-xs text-white/60">Précision si nécessaire
      <input name="followUpCustom" placeholder="Ex. rappeler après le festival" className="fz-input mt-1 text-sm" />
    </label>
    <label className="block text-xs text-white/60">Quand ? <span className="text-rose-300">*</span>
      <input required name="nextActionAt" type="datetime-local" className="fz-input mt-1 text-sm" />
    </label>
    {includeSummary ? <label className="block text-xs text-white/60">Résumé de l’échange <span className="text-rose-300">*</span>
      <textarea required name="summary" placeholder="Ce qui a été décidé ou appris…" className="fz-input mt-1 min-h-24 text-sm" />
    </label> : null}
  </>;
}

function ContactForm({ contact }: { contact?: WorkspaceContactRecord }) {
  return <>
    <input required name="name" aria-label="Nom du contact" defaultValue={contact?.name} placeholder="Nom du contact" className="fz-input text-sm" />
    <input name="role" aria-label="Rôle" defaultValue={contact?.role} placeholder="Rôle (programmation, régie…)" className="fz-input text-sm" />
    <input name="phone" aria-label="Téléphone" type="tel" defaultValue={contact?.phone} placeholder="Téléphone" className="fz-input text-sm" />
    <input name="email" aria-label="E-mail" type="email" defaultValue={contact?.email} placeholder="E-mail" className="fz-input text-sm" />
    <input name="instagramUrl" aria-label="Lien Instagram" defaultValue={contact?.instagramUrl} placeholder="Lien Instagram" className="fz-input text-sm" />
    <input name="facebookUrl" aria-label="Lien Facebook" defaultValue={contact?.facebookUrl} placeholder="Lien Facebook" className="fz-input text-sm" />
  </>;
}

export function BookingPage() {
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const session = useAuthStore((state) => state.session);
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const [tab, setTab] = useState<Tab>('due');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      setSelectedId(lead.id); setIsAdding(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de créer la salle.'); }
  }

  async function saveLead(form: HTMLFormElement) {
    if (!selected) return; const data = new FormData(form); setError(null);
    try {
      await bookingRepository.updateLead(selected.id, {
        venueName: String(data.get('venueName') || ''), city: String(data.get('city') || '') || undefined,
        targetDate: String(data.get('targetDate') || '') || undefined, targetPeriodStart: String(data.get('periodStart') || '') || undefined,
        stage: String(data.get('stage')) as BookingStage,
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
    try { await bookingRepository.archiveLead(selected.id); setIsDeleteConfirmOpen(false); setIsEditingLead(false); setSelectedId(null); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de supprimer cette salle.'); }
  }

  if (selected) {
    return <section className="space-y-6 pb-6">
      <header className="flex items-center gap-3 border-b border-white/8 pb-5">
        <button type="button" onClick={() => setSelectedId(null)} aria-label="Retour aux relances" className="flex h-11 w-11 shrink-0 items-center justify-center text-2xl text-white/75 transition hover:text-white">‹</button>
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-black">{selected.venueName}</h1><p className="mt-0.5 truncate text-sm text-[var(--fz-text-muted)]">{selected.city || 'Ville non renseignée'}</p></div>
        {canWrite && <button type="button" onClick={() => setIsEditingLead(true)} aria-label="Modifier la salle" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/6 text-xl text-white/80 transition hover:bg-white/12">•••</button>}
      </header>

      {error && <p className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p>}

      <section className="space-y-3"><p className="px-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">À faire maintenant</p><div className="rounded-[1rem] bg-[var(--fz-bg-elevated)] p-4"><p className="text-base font-black text-white">{selected.nextAction}</p><p className="mt-1 text-sm text-amber-200">{dueLabel(selected.nextActionAt)} · {new Date(selected.nextActionAt).toLocaleString('fr-FR')}</p>{canWrite && <button type="button" onClick={() => setIsLoggingExchange(true)} className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-black transition hover:bg-white/90">Consigner un échange</button>}</div></section>

      <section className="space-y-2"><p className="px-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Contacts</p><div className="space-y-2">{contacts.map((contact) => { const socialUrl = contact.instagramUrl || contact.facebookUrl; return <article key={contact.id} className="rounded-[1rem] bg-[var(--fz-bg-elevated)] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black">{contact.name}</p><p className="mt-0.5 truncate text-xs text-[var(--fz-text-muted)]">{contact.role || contact.email || contact.phone || 'Coordonnées à compléter'}</p></div>{canWrite && <div className="flex gap-1"><button type="button" onClick={() => setContactToEdit(contact)} aria-label={`Modifier ${contact.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/6 text-white/75 hover:bg-white/12">✎</button><button type="button" onClick={() => void unlinkContact(contact.id)} aria-label={`Retirer ${contact.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-300 hover:bg-rose-500/15">×</button></div>}</div><div className="mt-3 grid grid-cols-3 gap-2"><a href={contact.phone ? `tel:${contact.phone}` : undefined} aria-disabled={!contact.phone} className={`flex min-h-11 items-center justify-center rounded-xl bg-black/20 text-xs font-bold ${contact.phone ? 'text-white hover:bg-white/8' : 'pointer-events-none text-white/30'}`}>Appeler</a><a href={contact.email ? `mailto:${contact.email}` : undefined} aria-disabled={!contact.email} className={`flex min-h-11 items-center justify-center rounded-xl bg-black/20 text-xs font-bold ${contact.email ? 'text-white hover:bg-white/8' : 'pointer-events-none text-white/30'}`}>E-mail</a><a href={socialUrl} target="_blank" rel="noreferrer" aria-disabled={!socialUrl} className={`flex min-h-11 items-center justify-center rounded-xl bg-black/20 text-xs font-bold ${socialUrl ? 'text-white hover:bg-white/8' : 'pointer-events-none text-white/30'}`}>Réseaux</a></div></article>; })}{contacts.length === 0 && <p className="rounded-[1rem] bg-[var(--fz-bg-elevated)] p-4 text-sm text-white/60">Aucun contact lié. Ajoute la personne à relancer.</p>}</div>{canWrite && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setIsLinkingContact(true)} className="rounded-xl bg-white/6 px-3 py-3 text-xs font-black text-white transition hover:bg-white/12">Lier un contact</button><button type="button" onClick={() => setIsAddingContact(true)} className="rounded-xl bg-rose-500 px-3 py-3 text-xs font-black text-white transition hover:bg-rose-400">Nouveau contact</button></div>}</section>

      <section className="space-y-2"><p className="px-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Historique</p><div className="space-y-2">{notes.map((note) => <article key={note.id} className="rounded-[1rem] bg-[var(--fz-bg-elevated)] p-3"><p className="text-xs font-black text-rose-200">{noteTypes.find(([type]) => type === note.type)?.[1]}</p><p className="mt-1 text-sm text-white/85">{note.summary}</p><p className="mt-2 text-[0.68rem] text-white/45">{new Date(note.occurredAt).toLocaleString('fr-FR')}</p></article>)}{notes.length === 0 && <p className="rounded-[1rem] bg-[var(--fz-bg-elevated)] p-4 text-sm text-white/60">Aucun échange consigné pour le moment.</p>}</div></section>

      <section className="rounded-[1rem] bg-[var(--fz-bg-elevated)] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase text-[var(--fz-text-muted)]">Statut</p><p className="mt-1 text-sm font-black text-white">{BOOKING_STAGE_LABELS[selected.stage]}</p></div>{selected.eventId ? <span className="text-sm font-bold text-emerald-200">Au calendrier</span> : selected.stage === 'confirmed' && canWrite ? <button type="button" onClick={() => setIsCalendarOpen(true)} className="rounded-xl bg-emerald-400/15 px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/22">Ajouter au calendrier</button> : <span className="text-xs font-bold text-white/45">À confirmer</span>}</div></section>

      {isLoggingExchange && <FormDialog title="Consigner un échange" onClose={() => setIsLoggingExchange(false)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void logExchange(event.currentTarget); }} className="space-y-3"><label className="block text-xs text-white/60">Type d’échange<select name="type" defaultValue="call" className="fz-input mt-1 text-sm">{noteTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><FollowUpFields includeSummary /><button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Enregistrer</button></form></FormDialog>}
      {isAddingContact && <FormDialog title="Nouveau contact" onClose={() => setIsAddingContact(false)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void createContact(event.currentTarget); }} className="space-y-3">{error && <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p>}<ContactForm /><button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Ajouter le contact</button></form></FormDialog>}
      {contactToEdit && <FormDialog title="Modifier le contact" onClose={() => setContactToEdit(null)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void updateContact(event.currentTarget); }} className="space-y-3">{error && <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p>}<ContactForm contact={contactToEdit} /><button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Enregistrer</button></form></FormDialog>}
      {isLinkingContact && <FormDialog title="Lier un contact" onClose={() => setIsLinkingContact(false)} placement="bottom"><div className="space-y-2">{availableContacts.map((contact) => <button key={contact.id} type="button" onClick={() => void linkContact(contact.id)} className="w-full rounded-xl bg-white/6 p-4 text-left transition hover:bg-white/12"><p className="font-black">{contact.name}</p><p className="mt-1 text-xs text-white/55">{contact.role || contact.email || contact.phone || 'Sans coordonnées'}</p></button>)}{availableContacts.length === 0 && <p className="text-sm text-white/60">Aucun autre contact disponible dans le carnet.</p>}</div></FormDialog>}
      {isCalendarOpen && <FormDialog title="Ajouter le concert au calendrier" onClose={() => setIsCalendarOpen(false)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void addToCalendar(event.currentTarget); }} className="space-y-4"><p className="text-sm text-white/65">{selected.venueName}{selected.city ? ` · ${selected.city}` : ''}</p><label className="block text-xs text-white/60">Date<input required name="date" type="date" defaultValue={selected.targetDate} className="fz-input mt-1 text-sm" /></label><label className="block text-xs text-white/60">Heure<input required name="time" type="time" defaultValue="20:00" className="fz-input mt-1 text-sm" /></label><button className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-white">Créer le concert</button></form></FormDialog>}
      {isEditingLead && <FormDialog title="Détails de la salle" onClose={() => setIsEditingLead(false)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void saveLead(event.currentTarget); }} className="space-y-3"><input required name="venueName" aria-label="Salle ou organisateur" defaultValue={selected.venueName} className="fz-input text-sm" /><input name="city" aria-label="Ville" defaultValue={selected.city} placeholder="Ville" className="fz-input text-sm" /><label className="block text-xs text-white/60">Date cible<input required name="targetDate" type="date" defaultValue={selected.targetDate} className="fz-input mt-1 text-sm" /></label><label className="block text-xs text-white/60">Statut<select name="stage" defaultValue={selected.stage} className="fz-input mt-1 text-sm">{editableStages.map((stage) => <option key={stage} value={stage}>{BOOKING_STAGE_LABELS[stage]}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><button className="rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Enregistrer</button><button type="button" onClick={() => setIsDeleteConfirmOpen(true)} className="rounded-xl bg-rose-500/15 px-4 py-3 text-xs font-black uppercase tracking-widest text-rose-200">Supprimer</button></div></form></FormDialog>}
      <ConfirmDialog isOpen={isDeleteConfirmOpen} title="Supprimer cette salle ?" description="Les relances et l’historique associés ne seront plus visibles." confirmLabel="Supprimer" onConfirm={() => void deleteSelected()} onCancel={() => setIsDeleteConfirmOpen(false)} />
    </section>;
  }

  return <section className="space-y-4 pb-6"><div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-black">Contacts</h1><p className="mt-1 text-sm text-[var(--fz-text-muted)]">Les salles à relancer et leurs interlocuteurs.</p></div>{canWrite && <button type="button" onClick={() => setIsAdding(true)} aria-label="Ajouter une salle" className="fz-button-primary h-11 w-11 shrink-0 p-0 text-xl">+</button>}</div><div className="grid grid-cols-3 gap-2">{([['due', 'À relancer'], ['all', 'Toutes'], ['confirmed', 'Confirmées']] as const).map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)} className={`rounded-xl px-2 py-2 text-xs font-black ${tab === value ? 'bg-white text-black' : 'bg-white/5 text-white/55'}`}>{label}</button>)}</div>{error && <p className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p>}<div className="space-y-2">{visible.map((lead) => <button key={lead.id} onClick={() => setSelectedId(lead.id)} className="w-full rounded-[1rem] bg-[var(--fz-bg-elevated)] p-4 text-left transition hover:bg-white/8"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black">{lead.venueName}</p><p className="mt-1 truncate text-xs text-white/60">{lead.city || 'Ville non renseignée'} · {lead.nextAction}</p></div><span className={`shrink-0 text-[0.65rem] font-black ${lead.nextActionAt < Date.now() ? 'text-rose-300' : 'text-amber-200'}`}>{dueLabel(lead.nextActionAt)}</span></div></button>)}{visible.length === 0 && <div className="rounded-[1rem] bg-[var(--fz-bg-elevated)] p-6 text-center text-sm text-white/60">Aucune relance à faire dans cette vue.</div>}</div>{isAdding && <FormDialog title="Nouvelle salle" onClose={() => setIsAdding(false)} placement="bottom"><form noValidate onInput={() => setNewLeadFormError(null)} onSubmit={(event) => { event.preventDefault(); if (focusFirstInvalidField(event.currentTarget)) { setNewLeadFormError('Complète les champs obligatoires indiqués par un astérisque.'); return; } void createLead(event.currentTarget); }} className="space-y-3">{newLeadFormError && <p role="alert" className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{newLeadFormError}</p>}<label className="block text-xs text-white/60">Salle ou organisateur <span className="text-rose-300">*</span><input required name="venueName" aria-label="Salle ou organisateur" placeholder="Salle ou organisateur" className="fz-input mt-1 text-sm" /></label><label className="block text-xs text-white/60">Ville<input name="city" aria-label="Ville" placeholder="Ville" className="fz-input mt-1 text-sm" /></label><label className="block text-xs text-white/60">Date cible <span className="text-rose-300">*</span><input required name="targetDate" type="date" className="fz-input mt-1 text-sm" /></label><fieldset className="space-y-3 border-t border-white/10 pt-4"><legend className="text-xs font-black uppercase tracking-widest text-white/60">Contact (facultatif)</legend><input name="contactName" aria-label="Nom du contact" placeholder="Nom du contact" className="fz-input text-sm" /><input name="contactRole" aria-label="Rôle du contact" placeholder="Rôle (programmation, régie…)" className="fz-input text-sm" /><input name="contactPhone" aria-label="Téléphone du contact" type="tel" placeholder="Téléphone" className="fz-input text-sm" /><input name="contactEmail" aria-label="E-mail du contact" type="email" placeholder="E-mail" className="fz-input text-sm" /></fieldset><FollowUpFields /><p className="text-xs text-white/55"><span className="text-rose-300">*</span> Champs obligatoires</p><button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Créer la salle</button></form></FormDialog>}</section>;
}
