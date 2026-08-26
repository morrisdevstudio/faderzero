import { useState } from 'react';
import { FormDialog } from '@/components/FormDialog';
import type { EventRecord, WorkspaceContactRecord } from '@/db/schema';
import { Button } from '@/ui/components/Button';
import { ContentRow } from '@/ui/components/ContentRow';
import { FzIcon } from '@/ui/icons';

const EVENT_TYPE_LABELS: Record<EventRecord['eventType'], string> = { rehearsal: 'Répétition', concert: 'Concert', meeting: 'Réunion', other: 'Autre' };

function detailDate(event: EventRecord) {
  const start = new Date(event.startAt);
  const date = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

interface EventDetailsDialogProps {
  event: EventRecord;
  contacts: WorkspaceContactRecord[];
  availableContacts: WorkspaceContactRecord[];
  canWrite: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddContact: (contactId: string) => Promise<void>;
  onRemoveContact: (contactId: string) => Promise<void>;
}

export function EventDetailsDialog({ event, contacts, availableContacts, canWrite, onClose, onEdit, onDelete, onAddContact, onRemoveContact }: EventDetailsDialogProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlinkedContacts = availableContacts.filter((contact) => !contacts.some((linked) => linked.id === contact.id));

  async function addContact(contactId: string) {
    setIsUpdating(true); setError(null);
    try { await onAddContact(contactId); setIsPickerOpen(false); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible d’ajouter ce contact.'); } finally { setIsUpdating(false); }
  }

  async function removeContact(contactId: string) {
    setIsUpdating(true); setError(null);
    try { await onRemoveContact(contactId); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de retirer ce contact.'); } finally { setIsUpdating(false); }
  }

  return <>
    <FormDialog title={event.title} closeLabel="Fermer l’événement" onClose={onClose} placement="bottom">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Detail label="Type" value={EVENT_TYPE_LABELS[event.eventType]} />
          <Detail label="Date et heure" value={detailDate(event)} />
          <Detail label="Lieu" value={event.location} />
          <Detail label="Fin" value={event.endAt ? new Date(event.endAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : undefined} />
        </div>
        {event.notes ? <div><p className="fz-field-label">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/80">{event.notes}</p></div> : null}
        <section aria-labelledby="event-contacts-heading">
          <div className="flex items-center justify-between gap-3"><h3 id="event-contacts-heading" className="fz-field-label">Contacts</h3>{canWrite ? <Button size="sm" onClick={() => setIsPickerOpen(true)}>Ajouter</Button> : null}</div>
          {error ? <p role="alert" className="mt-2 text-sm text-rose-200">{error}</p> : null}
          <div className="mt-2 divide-y divide-white/10">
            {contacts.map((contact) => <ContentRow key={contact.id} mode="controls" title={contact.name} subtitle={contact.organization} metadata={contact.role || contact.phone || contact.email || 'Sans coordonnées'} trailing={<div className="flex items-center gap-1"><a href={contact.phone ? `tel:${contact.phone}` : undefined} aria-label={`Appeler ${contact.name}`} className="flex h-11 w-11 items-center justify-center text-white"><FzIcon name="phone" usageId="event-detail.contact-phone" size="md" /></a>{canWrite ? <button type="button" disabled={isUpdating} onClick={() => void removeContact(contact.id)} aria-label={`Retirer ${contact.name}`} className="flex h-11 w-11 items-center justify-center text-white/60"><FzIcon name="close" usageId="event-detail.contact-remove" size="md" /></button> : null}</div>} />)}
            {contacts.length === 0 ? <p className="py-3 text-sm text-white/50">Aucun contact lié.</p> : null}
          </div>
        </section>
        {canWrite ? <div className="space-y-2"><Button variant="primary" fullWidth leadingIcon={<FzIcon name="edit" usageId="event-detail.edit" size="md" />} onClick={onEdit}>Modifier</Button><Button variant="danger" fullWidth onClick={onDelete}>Supprimer</Button></div> : null}
      </div>
    </FormDialog>
    {isPickerOpen ? <FormDialog title="Ajouter un contact" closeDisabled={isUpdating} onClose={() => setIsPickerOpen(false)} placement="bottom"><div className="divide-y divide-white/10">{unlinkedContacts.map((contact) => <ContentRow key={contact.id} mode="button" onClick={() => void addContact(contact.id)} title={contact.name} subtitle={contact.organization} metadata={contact.role || contact.phone || contact.email || 'Sans coordonnées'} />)}{unlinkedContacts.length === 0 ? <p className="py-3 text-sm text-white/50">Tous les contacts du groupe sont déjà liés.</p> : null}</div></FormDialog> : null}
  </>;
}

function Detail({ label, value }: { label: string; value?: string | undefined }) {
  return <div><p className="fz-field-label">{label}</p><p className={`mt-1 min-h-6 text-sm ${value ? 'text-white' : 'text-white/45'}`}>{value || 'Non renseigné'}</p></div>;
}
