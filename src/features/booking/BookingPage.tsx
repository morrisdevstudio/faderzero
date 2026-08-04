import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { bookingRepository, BOOKING_STAGE_LABELS } from '@/db/repositories/bookingRepository';
import { FormDialog } from '@/components/FormDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { BookingNoteType } from '@/db/schema';
import { useAuthStore } from '@/stores/authStore';
import { canWriteWorkspace } from '@/services/supabase/workspace';

type Tab = 'due' | 'all' | 'confirmed';
type SocialNetwork = 'instagram' | 'facebook';
const noteTypes: Array<[BookingNoteType, string]> = [['email_sent', 'E-mail envoyé'], ['call', 'Appel effectué'], ['message_sent', 'Message envoyé'], ['reply_received', 'Réponse reçue'], ['internal_decision', 'Décision interne'], ['free_note', 'Note libre']];

function dueLabel(timestamp: number) { const delta = timestamp - Date.now(); if (delta < 0) return 'En retard'; if (delta < 86400000) return "Aujourd’hui"; return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }

function PlusIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}

export function BookingPage() {
  const activeWorkspace = useAuthStore((state) => state.activeWorkspace);
  const session = useAuthStore((state) => state.session);
  const canWrite = canWriteWorkspace(activeWorkspace?.role);
  const [tab, setTab] = useState<Tab>('due'); const [selectedId, setSelectedId] = useState<string | null>(null); const [isAdding, setIsAdding] = useState(false); const [isEditing, setIsEditing] = useState(false); const [isEditingNotes, setIsEditingNotes] = useState(false); const [isSocialsOpen, setIsSocialsOpen] = useState(false); const [socialToEdit, setSocialToEdit] = useState<SocialNetwork | null>(null); const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false); const [isDeleting, setIsDeleting] = useState(false); const [error, setError] = useState<string | null>(null);
  const noteHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socialHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leads = useLiveQuery(() => bookingRepository.listLeads(activeWorkspace?.id), [activeWorkspace?.id]) ?? [];
  const selected = leads.find((lead) => lead.id === selectedId) ?? null;
  const notes = useLiveQuery(() => selectedId ? bookingRepository.listNotes(selectedId) : Promise.resolve([]), [selectedId]) ?? [];
  const contacts = useLiveQuery(() => selectedId ? bookingRepository.listLeadContacts(selectedId) : Promise.resolve([]), [selectedId]) ?? [];
  const visible = useMemo(() => leads.filter((lead) => tab === 'confirmed' ? lead.stage === 'confirmed' : tab === 'due' ? lead.stage !== 'closed' : true), [leads, tab]);

  async function createLead(form: HTMLFormElement) {
    const data = new FormData(form); setError(null);
    try {
      const lead = await bookingRepository.createLead({
        venueName: String(data.get('venueName') || ''), city: String(data.get('city') || ''),
        targetDate: String(data.get('targetDate') || '') || undefined, targetPeriodStart: String(data.get('periodStart') || '') || undefined,
        targetPeriodEnd: String(data.get('periodEnd') || '') || undefined, nextAction: String(data.get('nextAction') || ''),
        nextActionAt: Date.now(), ownerId: session?.user.id,
        summary: String(data.get('note') || '') || undefined,
      });
      const contactName = String(data.get('contactName') || '').trim();
      if (contactName) {
        const contact = await bookingRepository.createWorkspaceContact({
          name: contactName,
          phone: String(data.get('contactPhone') || '').trim() || undefined,
          email: String(data.get('contactEmail') || '').trim() || undefined,
          role: String(data.get('contactOther') || '').trim() || undefined,
        });
        await bookingRepository.linkContact(lead.id, contact.id);
      }
      setSelectedId(lead.id); setIsAdding(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de créer la prospection.'); }
  }
  async function addNote(form: HTMLFormElement) {
    if (!selected) return; const data = new FormData(form); setError(null);
    try { await bookingRepository.addNote(selected.id, { type: String(data.get('type')) as BookingNoteType, summary: String(data.get('summary') || ''), nextAction: String(data.get('nextAction') || '') || undefined, nextActionAt: data.get('nextActionAt') ? new Date(String(data.get('nextActionAt'))).getTime() : undefined }); form.reset(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible d’ajouter la note.'); }
  }
  async function updateLead(form: HTMLFormElement) {
    if (!selected) return; const data = new FormData(form); setError(null);
    try {
      await bookingRepository.updateLead(selected.id, {
        venueName: String(data.get('venueName') || ''), city: String(data.get('city') || '') || undefined,
        targetDate: String(data.get('targetDate') || '') || undefined, targetPeriodStart: String(data.get('periodStart') || '') || undefined,
        nextAction: String(data.get('nextAction') || ''), summary: String(data.get('note') || '') || undefined,
      });
      setIsEditing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de modifier la prospection.'); }
  }
  async function updateNotes(form: HTMLFormElement) {
    if (!selected) return; setError(null);
    try { await bookingRepository.updateLead(selected.id, { summary: String(new FormData(form).get('note') || '') || undefined }); setIsEditingNotes(false); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de modifier les notes.'); }
  }
  function startNotesEdit() {
    if (!canWrite) return;
    noteHoldTimer.current = setTimeout(() => { setIsEditingNotes(true); noteHoldTimer.current = null; }, 550);
  }
  function cancelNotesEdit() { if (noteHoldTimer.current) { clearTimeout(noteHoldTimer.current); noteHoldTimer.current = null; } }
  async function updateSocial(form: HTMLFormElement) {
    const contact = contacts[0]; const network = socialToEdit; if (!contact || !network) return; setError(null);
    try { await bookingRepository.updateWorkspaceContact(contact.id, { [network === 'instagram' ? 'instagramUrl' : 'facebookUrl']: String(new FormData(form).get('url') || '').trim() || undefined }); setSocialToEdit(null); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de modifier le réseau.'); }
  }
  function startSocialEdit(network: SocialNetwork) {
    if (!canWrite || !contacts[0]) return;
    socialHoldTimer.current = setTimeout(() => { setSocialToEdit(network); socialHoldTimer.current = null; }, 550);
  }
  function cancelSocialEdit() { if (socialHoldTimer.current) { clearTimeout(socialHoldTimer.current); socialHoldTimer.current = null; } }
  async function deleteSelected() {
    if (!selected) return; setIsDeleting(true); setError(null);
    try { await bookingRepository.archiveLead(selected.id); setIsDeleteConfirmOpen(false); setIsEditing(false); setSelectedId(null); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de supprimer la proposition.'); } finally { setIsDeleting(false); }
  }
  async function confirmSelected() {
    if (!selected) return; setError(null);
    try { await bookingRepository.confirmLead(selected.id); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de confirmer la prospection.'); }
  }

  if (selected) {
    const primaryContact = contacts[0];
    return <section className="space-y-4 pb-4">
      <button type="button" onClick={() => setSelectedId(null)} className="text-xs font-black uppercase tracking-widest text-white/55">← Prospection</button>
      <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xl font-black">{selected.venueName}</p><p className="mt-1 text-sm text-white/55">{selected.city || 'Ville non renseignée'}</p></div><span className="rounded-full bg-rose-400/15 px-2.5 py-1 text-[0.65rem] font-black uppercase text-rose-100">{BOOKING_STAGE_LABELS[selected.stage]}</span></div><div className="mt-5 rounded-2xl bg-black/20 p-3"><p className="text-[0.62rem] font-black uppercase tracking-widest text-white/45">Prochaine action</p><p className="mt-1 font-bold">{selected.nextAction}</p><p className="mt-1 text-xs text-amber-200">{dueLabel(selected.nextActionAt)} · {new Date(selected.nextActionAt).toLocaleString('fr-FR')}</p></div>{canWrite && <button type="button" onClick={() => setIsEditing(true)} className="mt-4 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10">Modifier la proposition</button>}{canWrite && !selected.eventId && <button type="button" onClick={() => void confirmSelected()} className="mt-2 w-full rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-100">Créer le concert confirmé</button>}{selected.eventId && <p className="mt-4 text-xs font-bold text-emerald-200">Concert lié au calendrier</p>}</article>
      <button type="button" onPointerDown={startNotesEdit} onPointerUp={cancelNotesEdit} onPointerCancel={cancelNotesEdit} onPointerLeave={cancelNotesEdit} onContextMenu={(event) => event.preventDefault()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setIsEditingNotes(true); }} aria-label="Notes, maintenir appuyé pour modifier" className="w-full rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-rose-300/35 hover:bg-rose-400/8"><p className="text-[0.62rem] font-black uppercase tracking-widest text-white/45">Notes</p><p className="mt-2 whitespace-pre-wrap text-sm text-white/80">{selected.summary || 'Aucune note.'}</p></button>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-3"><p className="px-1 pb-3 text-sm font-black">{primaryContact?.name || 'Aucun contact lié'}</p><div className="grid grid-cols-3 gap-2"><a href={primaryContact?.phone ? `tel:${primaryContact.phone}` : undefined} aria-disabled={!primaryContact?.phone} className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-xs font-bold text-white transition ${primaryContact?.phone ? 'hover:border-rose-300/45 hover:bg-rose-400/10' : 'pointer-events-none opacity-35'}`}><span className="text-lg leading-none">☎</span><span className="mt-1">Appel</span></a><a href={primaryContact?.email ? `mailto:${primaryContact.email}` : undefined} aria-disabled={!primaryContact?.email} className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-xs font-bold text-white transition ${primaryContact?.email ? 'hover:border-rose-300/45 hover:bg-rose-400/10' : 'pointer-events-none opacity-35'}`}><span className="text-lg leading-none">✉</span><span className="mt-1">E-mail</span></a><button type="button" onClick={() => setIsSocialsOpen(true)} className="flex min-h-16 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-xs font-bold text-white transition hover:border-rose-300/45 hover:bg-rose-400/10"><span className="text-lg leading-none">◎</span><span className="mt-1">Réseaux</span></button></div></section>
      {isSocialsOpen && <FormDialog title="Réseaux" onClose={() => setIsSocialsOpen(false)} placement="bottom">{primaryContact ? <div className="space-y-3"><p className="text-sm text-white/55">Maintenez un réseau appuyé pour modifier son lien.</p>{(['instagram', 'facebook'] as const).map((network) => { const value = network === 'instagram' ? primaryContact.instagramUrl : primaryContact.facebookUrl; const label = network === 'instagram' ? 'Instagram' : 'Facebook'; return <button key={network} type="button" onPointerDown={() => startSocialEdit(network)} onPointerUp={cancelSocialEdit} onPointerCancel={cancelSocialEdit} onPointerLeave={cancelSocialEdit} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSocialToEdit(network); }} className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-rose-300/45 hover:bg-rose-400/8"><p className="font-black">{label}</p><p className="mt-1 truncate text-sm text-white/55">{value || 'Non renseigné'}</p></button>; })}</div> : <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-white/55">Ajoutez d’abord un contact à cette prospection pour renseigner ses réseaux.</p>}</FormDialog>}
      {socialToEdit && primaryContact && <FormDialog title={`Modifier ${socialToEdit === 'instagram' ? 'Instagram' : 'Facebook'}`} onClose={() => setSocialToEdit(null)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void updateSocial(event.currentTarget); }} className="space-y-4"><label className="block text-xs text-white/55">Lien {socialToEdit === 'instagram' ? 'Instagram' : 'Facebook'}<input autoFocus aria-label={`Lien ${socialToEdit === 'instagram' ? 'Instagram' : 'Facebook'}`} name="url" type="url" defaultValue={socialToEdit === 'instagram' ? primaryContact.instagramUrl : primaryContact.facebookUrl} placeholder="https://…" className="fz-input mt-1 text-sm"/></label><button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Enregistrer</button></form></FormDialog>}
      {isEditingNotes && <FormDialog title="Modifier les notes" onClose={() => setIsEditingNotes(false)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void updateNotes(event.currentTarget); }} className="space-y-4"><textarea aria-label="Notes" name="note" defaultValue={selected.summary} placeholder="Contexte, conditions, informations utiles…" className="fz-input min-h-36 text-sm"/><button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Enregistrer</button></form></FormDialog>}
      {isEditing && <FormDialog title="Modifier la proposition" onClose={() => setIsEditing(false)} placement="bottom"><form onSubmit={(event) => { event.preventDefault(); void updateLead(event.currentTarget); }} className="space-y-3"><div className="flex justify-end"><button type="button" onClick={() => setIsDeleteConfirmOpen(true)} aria-label="Supprimer la proposition" title="Supprimer la proposition" className="flex h-10 w-10 items-center justify-center rounded-xl text-rose-300 transition hover:bg-rose-500/15 hover:text-rose-100"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" /></svg></button></div><input required aria-label="Salle ou organisateur" name="venueName" defaultValue={selected.venueName} className="fz-input text-sm"/><input aria-label="Ville" name="city" defaultValue={selected.city} className="fz-input text-sm"/><label className="block text-xs text-white/55">Date cible<input name="targetDate" type="date" defaultValue={selected.targetDate} className="fz-input mt-1 text-sm"/></label><label className="block text-xs text-white/55">Ou début de période<input name="periodStart" type="date" defaultValue={selected.targetPeriodStart} className="fz-input mt-1 text-sm"/></label><label className="block text-xs text-white/55">Notes<textarea aria-label="Notes" name="note" defaultValue={selected.summary} placeholder="Contexte, conditions, informations utiles…" className="fz-input mt-1 min-h-24 text-sm"/></label><input required aria-label="Prochaine action" name="nextAction" defaultValue={selected.nextAction} className="fz-input text-sm"/><button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Enregistrer</button></form></FormDialog>}
      <ConfirmDialog isOpen={isDeleteConfirmOpen} title="Supprimer cette proposition ?" description="Elle sera retirée de la prospection. Vous pourrez la restaurer depuis la synchronisation si nécessaire." confirmLabel="Supprimer" isBusy={isDeleting} onConfirm={deleteSelected} onCancel={() => setIsDeleteConfirmOpen(false)} />
      {error && <p className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p>}<section><h2 className="px-1 text-sm font-black uppercase tracking-widest text-white/60">Historique</h2><div className="mt-3 space-y-2">{notes.map((note) => <article key={note.id} className="rounded-2xl border border-white/8 bg-black/20 p-3"><p className="text-xs font-black text-rose-200">{noteTypes.find(([type]) => type === note.type)?.[1]}</p><p className="mt-1 text-sm">{note.summary}</p><p className="mt-2 text-[0.68rem] text-white/40">{new Date(note.occurredAt).toLocaleString('fr-FR')}</p></article>)}{notes.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/45">Aucun échange noté pour le moment.</p>}</div></section>{canWrite && <form id="booking-note-form" onSubmit={(event) => { event.preventDefault(); void addNote(event.currentTarget); }} className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4"><h2 className="font-black">Ajouter une note</h2><select name="type" defaultValue="email_sent" className="fz-input text-sm">{noteTypes.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select><textarea required name="summary" placeholder="Résumé de l’échange" className="fz-input min-h-20 text-sm"/><input name="nextAction" placeholder="Prochaine action" className="fz-input text-sm"/><input name="nextActionAt" type="datetime-local" className="fz-input text-sm"/><button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Enregistrer</button></form>}</section>;
  }

  return <section className="space-y-4 pb-4">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><button type="button" onClick={() => window.history.back()} aria-label="Retour" className="flex h-10 w-10 items-center justify-center text-white/80 transition hover:text-white"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg></button><h1 className="text-2xl font-black">Booking</h1></div>{canWrite && <button type="button" onClick={() => setIsAdding(true)} aria-label="Ajouter une prospection" className="fz-button-primary h-11 w-11 shrink-0 p-0"><PlusIcon /></button>}</div>
    <div className="grid grid-cols-3 gap-2">{([['due', 'À faire'], ['all', 'Toutes'], ['confirmed', 'Confirmées']] as const).map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)} className={`rounded-xl px-2 py-2 text-xs font-black ${tab === value ? 'bg-white text-black' : 'bg-white/5 text-white/55'}`}>{label}</button>)}</div>
    {isAdding && <FormDialog title="Nouveau booking" onClose={() => setIsAdding(false)} placement="bottom">
      <form onSubmit={(event) => { event.preventDefault(); void createLead(event.currentTarget); }} className="space-y-4">
        <div className="space-y-3"><input required aria-label="Salle ou organisateur" name="venueName" placeholder="Salle ou organisateur" className="fz-input text-sm"/><input aria-label="Ville" name="city" placeholder="Ville" className="fz-input text-sm"/><label className="block text-xs text-white/55">Date cible<input name="targetDate" type="date" className="fz-input mt-1 text-sm"/></label><label className="block text-xs text-white/55">Ou début de période<input name="periodStart" type="date" className="fz-input mt-1 text-sm"/></label></div>
        <fieldset className="space-y-3 border-t border-white/10 pt-4"><legend className="px-0 text-xs font-black uppercase tracking-widest text-white/55">Contact</legend><input aria-label="Nom du contact" name="contactName" placeholder="Nom" className="fz-input text-sm"/><input aria-label="Téléphone du contact" name="contactPhone" type="tel" placeholder="Téléphone" className="fz-input text-sm"/><input aria-label="E-mail du contact" name="contactEmail" type="email" placeholder="E-mail" className="fz-input text-sm"/><input aria-label="Autre information du contact" name="contactOther" placeholder="Autre (rôle, organisation…)" className="fz-input text-sm"/></fieldset>
        <label className="block text-xs text-white/55">Notes<textarea aria-label="Notes" name="note" placeholder="Contexte, conditions, informations utiles…" className="fz-input mt-1 min-h-24 text-sm"/></label>
        <div className="border-t border-white/10 pt-4"><input required aria-label="Prochaine action" name="nextAction" placeholder="Prochaine action" className="fz-input text-sm"/></div>
        <button className="w-full rounded-xl bg-rose-500 px-4 py-3 text-xs font-black uppercase tracking-widest">Créer</button>
      </form>
    </FormDialog>}
    {error && <p className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{error}</p>}<div className="space-y-2">{visible.map((lead) => <button key={lead.id} onClick={() => setSelectedId(lead.id)} className="w-full rounded-2xl border border-white/8 bg-white/5 p-4 text-left transition hover:bg-white/10"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black">{lead.venueName}</p><p className="mt-1 text-xs text-white/50">{lead.city || 'Ville non renseignée'} · {lead.nextAction}</p></div><span className={`shrink-0 text-[0.65rem] font-black ${lead.nextActionAt < Date.now() ? 'text-rose-300' : 'text-amber-200'}`}>{dueLabel(lead.nextActionAt)}</span></div></button>)}{visible.length === 0 && <div className="rounded-3xl border border-dashed border-white/12 p-6 text-center text-sm text-white/45">Aucune prospection dans cette vue.</div>}</div>
  </section>;
}
