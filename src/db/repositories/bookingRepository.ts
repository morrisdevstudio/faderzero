import { db } from '@/db/db';
import type {
  BookingLeadContactRecord,
  BookingLeadRecord,
  BookingNoteRecord,
  BookingNoteType,
  BookingPriority,
  BookingStage,
  PersonalContactRecord,
  WorkspaceContactRecord,
} from '@/db/schema';
import { enqueueMutation } from '@/db/syncQueueHelper';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';
import { formatContactPhone, normalizeFacebookUrl, normalizeInstagramUrl, normalizeWebsiteUrl } from '@/lib/contactUrls';
import { useAuthStore } from '@/stores/authStore';
import { eventsRepository } from '@/db/repositories/eventsRepository';

const ACTIVE_STAGES: BookingStage[] = ['to_contact', 'contacted', 'in_discussion', 'option', 'confirmed'];

export type CreateBookingLeadInput = {
  venueName: string;
  city?: string | undefined;
  stage?: BookingStage | undefined;
  priority?: BookingPriority | undefined;
  targetDate?: string | undefined;
  targetPeriodStart?: string | undefined;
  targetPeriodEnd?: string | undefined;
  ownerId?: string | undefined;
  nextAction: string;
  nextActionAt: number;
  feeAmount?: number | undefined;
  feeCurrency?: string | undefined;
  summary?: string | undefined;
};

export type CreateWorkspaceContactInput = Pick<
  WorkspaceContactRecord,
  'name' | 'organization' | 'role' | 'city' | 'website' | 'email' | 'phone' | 'instagramUrl' | 'facebookUrl'
>;

export interface BookingLeadOverview extends BookingLeadRecord {
  contactIds: string[];
  contactNames: string[];
}

export interface WorkspaceContactOverview extends WorkspaceContactRecord {
  linkedLeads: BookingLeadRecord[];
}

export const BOOKING_STAGE_LABELS: Record<BookingStage, string> = {
  to_contact: 'À contacter', contacted: 'Contacté', in_discussion: 'En échange', option: 'Option', confirmed: 'Confirmé', closed: 'Clos',
};

function workspaceIdOrThrow() {
  const id = useAuthStore.getState().activeWorkspace?.id;
  if (!id) throw new Error('Aucun groupe actif');
  return id;
}

function userIdOrThrow() {
  const id = useAuthStore.getState().session?.user.id;
  if (!id) throw new Error('Utilisateur non connecté');
  return id;
}

function validateLead(lead: Pick<BookingLeadRecord, 'stage' | 'nextAction' | 'nextActionAt' | 'closeReason' | 'targetDate' | 'targetPeriodStart'>) {
  if (ACTIVE_STAGES.includes(lead.stage) && (!lead.nextAction.trim() || !lead.nextActionAt)) {
    throw new Error('Une prospection active doit avoir une prochaine action datée.');
  }
  if (lead.stage === 'closed' && !lead.closeReason?.trim()) throw new Error('Un motif est requis pour clôturer une prospection.');
  if (!lead.targetDate && !lead.targetPeriodStart) throw new Error('Ajoutez une date ou une période cible.');
}

function buildLead(input: CreateBookingLeadInput, workspaceId: string, timestamp: number): BookingLeadRecord {
  const lead: BookingLeadRecord = {
    id: createId(),
    workspaceId,
    venueName: input.venueName.trim(),
    city: input.city?.trim() || undefined,
    stage: input.stage ?? 'to_contact',
    priority: input.priority ?? 'normal',
    targetDate: input.targetDate,
    targetPeriodStart: input.targetPeriodStart,
    targetPeriodEnd: input.targetPeriodEnd,
    ownerId: input.ownerId ?? userIdOrThrow(),
    nextAction: input.nextAction.trim(),
    nextActionAt: input.nextActionAt,
    feeAmount: input.feeAmount,
    feeCurrency: input.feeCurrency,
    summary: input.summary?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    serverVersion: 1,
    syncStatus: 'pending',
  };
  validateLead(lead);
  return lead;
}

function buildWorkspaceContact(input: CreateWorkspaceContactInput, workspaceId: string, timestamp: number): WorkspaceContactRecord {
  return {
    id: createId(),
    workspaceId,
    ...input,
    name: input.name.trim(),
    organization: input.organization?.trim() || undefined,
    role: input.role?.trim() || undefined,
    city: input.city?.trim() || undefined,
    website: normalizeWebsiteUrl(input.website),
    email: input.email?.trim() || undefined,
    phone: formatContactPhone(input.phone) || undefined,
    instagramUrl: normalizeInstagramUrl(input.instagramUrl),
    facebookUrl: normalizeFacebookUrl(input.facebookUrl),
    createdAt: timestamp,
    updatedAt: timestamp,
    serverVersion: 1,
    syncStatus: 'pending',
  };
}

export const bookingRepository = {
  async listLeads(workspaceId = workspaceIdOrThrow()) {
    const leads = await db.bookingLeads.where('workspaceId').equals(workspaceId).filter((item) => item.deletedAt === undefined).toArray();
    return leads.sort((a, b) => a.nextActionAt - b.nextActionAt);
  },

  async listLeadOverviews(workspaceId = workspaceIdOrThrow()): Promise<BookingLeadOverview[]> {
    const [leads, contacts, links] = await Promise.all([
      this.listLeads(workspaceId),
      this.listWorkspaceContacts(workspaceId),
      db.bookingLeadContacts.where('workspaceId').equals(workspaceId).filter((item) => item.deletedAt === undefined).toArray(),
    ]);
    const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
    const contactIdsByLead = new Map<string, string[]>();
    for (const link of links) {
      const current = contactIdsByLead.get(link.leadId) ?? [];
      current.push(link.contactId);
      contactIdsByLead.set(link.leadId, current);
    }
    return leads.map((lead) => {
      const contactIds = contactIdsByLead.get(lead.id) ?? [];
      return {
        ...lead,
        contactIds,
        contactNames: contactIds.flatMap((contactId) => {
          const contact = contactsById.get(contactId);
          return contact ? [contact.name] : [];
        }),
      };
    });
  },

  async listContactOverviews(workspaceId = workspaceIdOrThrow()): Promise<WorkspaceContactOverview[]> {
    const [contacts, leads, links] = await Promise.all([
      this.listWorkspaceContacts(workspaceId),
      this.listLeads(workspaceId),
      db.bookingLeadContacts.where('workspaceId').equals(workspaceId).filter((item) => item.deletedAt === undefined).toArray(),
    ]);
    const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
    const leadIdsByContact = new Map<string, string[]>();
    for (const link of links) {
      const current = leadIdsByContact.get(link.contactId) ?? [];
      current.push(link.leadId);
      leadIdsByContact.set(link.contactId, current);
    }
    return contacts.map((contact) => ({
      ...contact,
      linkedLeads: (leadIdsByContact.get(contact.id) ?? []).flatMap((leadId) => {
        const lead = leadsById.get(leadId);
        return lead ? [lead] : [];
      }),
    }));
  },

  async getLead(id: string) { return db.bookingLeads.get(id); },

  async createLead(input: CreateBookingLeadInput) {
    const timestamp = now(); const workspaceId = workspaceIdOrThrow();
    const lead = buildLead(input, workspaceId, timestamp);
    await db.transaction('rw', db.bookingLeads, db.syncQueue, async () => { await db.bookingLeads.add(lead); await enqueueMutation(db, workspaceId, 'bookingLead', lead.id, 'create', lead); });
    return lead;
  },

  async createLeadWithContact(input: CreateBookingLeadInput, contactChoice?: { existingContactId: string } | { newContact: CreateWorkspaceContactInput }) {
    const timestamp = now();
    const workspaceId = workspaceIdOrThrow();
    const lead = buildLead(input, workspaceId, timestamp);
    let contact: WorkspaceContactRecord | undefined;

    await db.transaction('rw', db.workspaceContacts, db.bookingLeads, db.bookingLeadContacts, db.syncQueue, async () => {
      if (contactChoice && 'existingContactId' in contactChoice) {
        contact = await db.workspaceContacts.get(contactChoice.existingContactId);
        if (!contact || contact.deletedAt || contact.workspaceId !== workspaceId) throw new Error('Contact introuvable dans ce groupe');
      } else if (contactChoice && 'newContact' in contactChoice) {
        contact = buildWorkspaceContact(contactChoice.newContact, workspaceId, timestamp);
        await db.workspaceContacts.add(contact);
        await enqueueMutation(db, workspaceId, 'workspaceContact', contact.id, 'create', contact);
      }

      await db.bookingLeads.add(lead);
      await enqueueMutation(db, workspaceId, 'bookingLead', lead.id, 'create', lead);

      if (contact) {
        const link: BookingLeadContactRecord = {
          id: createId(), workspaceId, leadId: lead.id, contactId: contact.id,
          createdAt: timestamp, updatedAt: timestamp, serverVersion: 1, syncStatus: 'pending',
        };
        await db.bookingLeadContacts.add(link);
        await enqueueMutation(db, workspaceId, 'bookingLeadContact', link.id, 'create', link);
      }
    });

    return { lead, contact };
  },

  async updateLead(id: string, patch: Partial<BookingLeadRecord>) {
    const existing = await db.bookingLeads.get(id); if (!existing) throw new Error('Prospection introuvable');
    const updated: BookingLeadRecord = { ...existing, ...patch, venueName: patch.venueName?.trim() ?? existing.venueName, nextAction: patch.nextAction?.trim() ?? existing.nextAction, summary: patch.summary?.trim() || undefined, updatedAt: now(), syncStatus: 'pending' };
    validateLead(updated);
    await db.transaction('rw', db.bookingLeads, db.syncQueue, async () => { await db.bookingLeads.put(updated); await enqueueMutation(db, updated.workspaceId, 'bookingLead', id, patch.deletedAt ? 'soft_delete' : 'update', updated, existing.serverVersion); });
    return updated;
  },

  async archiveLead(id: string) { return this.updateLead(id, { deletedAt: now() }); },

  async confirmLead(id: string, scheduledAt?: number) {
    const lead = await db.bookingLeads.get(id); if (!lead) throw new Error('Prospection introuvable');
    if (!lead.targetDate) throw new Error('Une date précise est requise pour créer le concert dans le calendrier.');
    const startAt = scheduledAt ?? new Date(`${lead.targetDate}T20:00:00`).getTime();
    const location = [lead.venueName, lead.city].filter(Boolean).join(', ');
    const eventInput = { title: lead.venueName, eventType: 'concert' as const, startAt };
    const event = await eventsRepository.create({ ...eventInput, ...(location ? { location } : {}), ...(lead.summary ? { notes: lead.summary } : {}) }, lead.workspaceId);
    return this.updateLead(id, { stage: 'confirmed', eventId: event.id });
  },

  async listNotes(leadId: string) { return (await db.bookingNotes.where('leadId').equals(leadId).filter((item) => item.deletedAt === undefined).toArray()).sort((a, b) => b.occurredAt - a.occurredAt); },

  async addNote(leadId: string, input: { type: BookingNoteType; occurredAt?: number | undefined; summary: string; result?: string | undefined; nextAction?: string | undefined; nextActionAt?: number | undefined }) {
    const lead = await db.bookingLeads.get(leadId); if (!lead) throw new Error('Prospection introuvable');
    const timestamp = now(); const note: BookingNoteRecord = { id: createId(), workspaceId: lead.workspaceId, leadId, authorId: userIdOrThrow(), type: input.type, occurredAt: input.occurredAt ?? timestamp, summary: input.summary.trim(), result: input.result?.trim() || undefined, createdAt: timestamp, updatedAt: timestamp, serverVersion: 1, syncStatus: 'pending' };
    await db.transaction('rw', db.bookingNotes, db.bookingLeads, db.syncQueue, async () => { await db.bookingNotes.add(note); await enqueueMutation(db, lead.workspaceId, 'bookingNote', note.id, 'create', note); if (input.nextAction && input.nextActionAt) { const updated = { ...lead, nextAction: input.nextAction.trim(), nextActionAt: input.nextActionAt, updatedAt: timestamp, syncStatus: 'pending' as const }; await db.bookingLeads.put(updated); await enqueueMutation(db, lead.workspaceId, 'bookingLead', lead.id, 'update', updated, lead.serverVersion); } });
    return note;
  },

  async listWorkspaceContacts(workspaceId = workspaceIdOrThrow()) { return (await db.workspaceContacts.where('workspaceId').equals(workspaceId).filter((item) => item.deletedAt === undefined).toArray()).sort((a, b) => a.name.localeCompare(b.name)); },

  async createWorkspaceContact(input: CreateWorkspaceContactInput) {
    const timestamp = now(); const workspaceId = workspaceIdOrThrow(); const contact = buildWorkspaceContact(input, workspaceId, timestamp);
    await db.transaction('rw', db.workspaceContacts, db.syncQueue, async () => { await db.workspaceContacts.add(contact); await enqueueMutation(db, workspaceId, 'workspaceContact', contact.id, 'create', contact); }); return contact;
  },

  async copyWorkspaceContactToWorkspace(id: string, targetWorkspaceId: string) {
    const source = await db.workspaceContacts.get(id);
    if (!source || source.deletedAt) throw new Error('Contact introuvable');
    if (source.workspaceId === targetWorkspaceId) throw new Error('Choisissez un autre espace de destination.');
    const contact = buildWorkspaceContact({
      name: source.name,
      organization: source.organization,
      role: source.role,
      city: source.city,
      website: source.website,
      email: source.email,
      phone: source.phone,
      instagramUrl: source.instagramUrl,
      facebookUrl: source.facebookUrl,
    }, targetWorkspaceId, now());
    await db.transaction('rw', db.workspaceContacts, db.syncQueue, async () => {
      await db.workspaceContacts.add(contact);
      await enqueueMutation(db, targetWorkspaceId, 'workspaceContact', contact.id, 'create', contact);
    });
    return contact;
  },

  async updateWorkspaceContact(id: string, patch: Partial<WorkspaceContactRecord>) {
    const existing = await db.workspaceContacts.get(id); if (!existing) throw new Error('Contact introuvable');
    const updated: WorkspaceContactRecord = {
      ...existing,
      ...patch,
      name: patch.name?.trim() ?? existing.name,
      website: 'website' in patch ? normalizeWebsiteUrl(patch.website) : existing.website,
      instagramUrl: 'instagramUrl' in patch ? normalizeInstagramUrl(patch.instagramUrl) : existing.instagramUrl,
      facebookUrl: 'facebookUrl' in patch ? normalizeFacebookUrl(patch.facebookUrl) : existing.facebookUrl,
      phone: 'phone' in patch ? formatContactPhone(patch.phone) || undefined : existing.phone,
      updatedAt: now(),
      syncStatus: 'pending',
    };
    await db.transaction('rw', db.workspaceContacts, db.syncQueue, async () => { await db.workspaceContacts.put(updated); await enqueueMutation(db, updated.workspaceId, 'workspaceContact', id, patch.deletedAt ? 'soft_delete' : 'update', updated, existing.serverVersion); });
    return updated;
  },

  async deleteWorkspaceContact(id: string) {
    const contact = await db.workspaceContacts.get(id);
    if (!contact || contact.deletedAt) return;
    const timestamp = now();
    const archivedContact: WorkspaceContactRecord = { ...contact, deletedAt: timestamp, updatedAt: timestamp, syncStatus: 'pending' };
    const links = await db.bookingLeadContacts.where('workspaceId').equals(contact.workspaceId)
      .filter((link) => link.contactId === id && link.deletedAt === undefined)
      .toArray();

    await db.transaction('rw', db.workspaceContacts, db.bookingLeadContacts, db.syncQueue, async () => {
      for (const link of links) {
        const archivedLink: BookingLeadContactRecord = { ...link, deletedAt: timestamp, updatedAt: timestamp, syncStatus: 'pending' };
        await db.bookingLeadContacts.put(archivedLink);
        await enqueueMutation(db, contact.workspaceId, 'bookingLeadContact', link.id, 'soft_delete', archivedLink, link.serverVersion);
      }
      await db.workspaceContacts.put(archivedContact);
      await enqueueMutation(db, contact.workspaceId, 'workspaceContact', contact.id, 'soft_delete', archivedContact, contact.serverVersion);
    });
  },

  async listPersonalContacts() { const ownerId = userIdOrThrow(); return (await db.personalContacts.where('ownerId').equals(ownerId).filter((item) => item.deletedAt === undefined).toArray()).sort((a, b) => a.name.localeCompare(b.name)); },

  async createPersonalContact(input: Pick<PersonalContactRecord, 'name' | 'organization' | 'role' | 'city' | 'website' | 'email' | 'phone' | 'instagramUrl' | 'facebookUrl'>) {
    const timestamp = now(); const ownerId = userIdOrThrow(); const contact: PersonalContactRecord = {
      id: createId(), ownerId, ...input, name: input.name.trim(),
      website: normalizeWebsiteUrl(input.website),
      instagramUrl: normalizeInstagramUrl(input.instagramUrl),
      facebookUrl: normalizeFacebookUrl(input.facebookUrl),
      createdAt: timestamp, updatedAt: timestamp, serverVersion: 1, syncStatus: 'pending',
    };
    await db.transaction('rw', db.personalContacts, db.syncQueue, async () => { await db.personalContacts.add(contact); await enqueueMutation(db, `user:${ownerId}`, 'personalContact', contact.id, 'create', contact); }); return contact;
  },

  async importPersonalContact(id: string) { const contact = await db.personalContacts.get(id); if (!contact) throw new Error('Contact introuvable'); return this.createWorkspaceContact(contact); },

  async listLeadContacts(leadId: string) {
    const links = await db.bookingLeadContacts.where('leadId').equals(leadId).filter((item) => item.deletedAt === undefined).toArray();
    const contacts = await Promise.all(links.map((link) => db.workspaceContacts.get(link.contactId)));
    return contacts.filter((contact): contact is WorkspaceContactRecord => Boolean(contact && contact.deletedAt === undefined));
  },

  async linkContact(leadId: string, contactId: string) {
    const lead = await db.bookingLeads.get(leadId); if (!lead) throw new Error('Prospection introuvable');
    const exists = await db.bookingLeadContacts.where('[leadId+contactId]').equals([leadId, contactId]).first(); if (exists && !exists.deletedAt) return exists;
    const timestamp = now(); const link: BookingLeadContactRecord = { id: createId(), workspaceId: lead.workspaceId, leadId, contactId, createdAt: timestamp, updatedAt: timestamp, serverVersion: 1, syncStatus: 'pending' };
    await db.transaction('rw', db.bookingLeadContacts, db.syncQueue, async () => { await db.bookingLeadContacts.add(link); await enqueueMutation(db, lead.workspaceId, 'bookingLeadContact', link.id, 'create', link); }); return link;
  },

  async unlinkContact(leadId: string, contactId: string) {
    const link = await db.bookingLeadContacts.where('[leadId+contactId]').equals([leadId, contactId]).first();
    if (!link || link.deletedAt) return;
    const archived: BookingLeadContactRecord = { ...link, deletedAt: now(), updatedAt: now(), syncStatus: 'pending' };
    await db.transaction('rw', db.bookingLeadContacts, db.syncQueue, async () => {
      await db.bookingLeadContacts.put(archived);
      await enqueueMutation(db, archived.workspaceId, 'bookingLeadContact', archived.id, 'soft_delete', archived, link.serverVersion);
    });
  },
};
