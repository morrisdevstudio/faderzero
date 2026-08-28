import { db } from '@/db/db';
import type { CreateEventInput, EventContactRecord, EventRecord, UpdateEventInput, WorkspaceContactRecord } from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';
import { useAuthStore } from '@/stores/authStore';
import { enqueueMutation } from '@/db/syncQueueHelper';

export const eventsRepository = {
  async getById(id: string): Promise<EventRecord | undefined> {
    return db.events.get(id);
  },

  async listContacts(eventId: string): Promise<WorkspaceContactRecord[]> {
    const links = await db.eventContacts.where('eventId').equals(eventId).filter((link) => link.deletedAt === undefined).toArray();
    const contacts = await Promise.all(links.map((link) => db.workspaceContacts.get(link.contactId)));
    return contacts.filter((contact): contact is WorkspaceContactRecord => Boolean(contact && contact.deletedAt === undefined));
  },

  async linkContact(eventId: string, contactId: string): Promise<EventContactRecord> {
    const [event, contact] = await Promise.all([db.events.get(eventId), db.workspaceContacts.get(contactId)]);
    if (!event || event.deletedAt) throw new Error('Événement introuvable');
    if (!contact || contact.deletedAt || contact.workspaceId !== event.workspaceId) throw new Error('Contact introuvable dans ce groupe');
    const existing = await db.eventContacts.where('[eventId+contactId]').equals([eventId, contactId]).first();
    if (existing && !existing.deletedAt) return existing;
    const timestamp = now();
    const link: EventContactRecord = { id: existing?.id ?? createId(), workspaceId: event.workspaceId, eventId, contactId, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp, serverVersion: existing?.serverVersion ?? 1, syncStatus: 'pending' };
    await db.transaction('rw', db.eventContacts, db.syncQueue, async () => {
      await db.eventContacts.put(link);
      await enqueueMutation(db, event.workspaceId, 'eventContact', link.id, existing?.deletedAt ? 'update' : 'create', link, existing?.serverVersion);
    });
    return link;
  },

  async unlinkContact(eventId: string, contactId: string): Promise<void> {
    const link = await db.eventContacts.where('[eventId+contactId]').equals([eventId, contactId]).first();
    if (!link || link.deletedAt) return;
    const archived = { ...link, deletedAt: now(), updatedAt: now(), syncStatus: 'pending' as const };
    await db.transaction('rw', db.eventContacts, db.syncQueue, async () => {
      await db.eventContacts.put(archived);
      await enqueueMutation(db, link.workspaceId, 'eventContact', link.id, 'soft_delete', archived, link.serverVersion);
    });
  },

  async listByWorkspace(
    workspaceId?: string,
    options: { includeDeleted?: boolean } = {}
  ): Promise<EventRecord[]> {
    const targetWorkspaceId = workspaceId || useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
    let collection = db.events.where('workspaceId').equals(targetWorkspaceId);

    if (!options.includeDeleted) {
      collection = collection.filter((event) => event.deletedAt === undefined);
    }

    const items = await collection.toArray();
    return items.sort((a, b) => a.startAt - b.startAt);
  },

  async listByWorkspaces(
    workspaceIds: string[],
    options: { includeDeleted?: boolean } = {}
  ): Promise<EventRecord[]> {
    if (!workspaceIds || workspaceIds.length === 0) return [];
    let collection = db.events.where('workspaceId').anyOf(workspaceIds);
    if (!options.includeDeleted) {
      collection = collection.filter((event) => event.deletedAt === undefined);
    }
    const items = await collection.toArray();
    return items.sort((a, b) => a.startAt - b.startAt);
  },

  async listAll(
    options: { includeDeleted?: boolean } = {}
  ): Promise<EventRecord[]> {
    let collection = db.events.toCollection();
    if (!options.includeDeleted) {
      collection = collection.filter((event) => event.deletedAt === undefined);
    }
    const items = await collection.toArray();
    return items.sort((a, b) => a.startAt - b.startAt);
  },


  async listUpcoming(workspaceId?: string, limit: number = 3): Promise<EventRecord[]> {
    const targetWorkspaceId = workspaceId || useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
    const currentTime = Date.now();
    const items = await db.events
      .where('workspaceId')
      .equals(targetWorkspaceId)
      .filter((event) => event.deletedAt === undefined && (event.endAt ? event.endAt >= currentTime : event.startAt >= currentTime - 3600000))
      .toArray();

    return items.sort((a, b) => a.startAt - b.startAt).slice(0, limit);
  },

  async create(input: CreateEventInput, workspaceId?: string): Promise<EventRecord> {
    const timestamp = now();
    const targetWorkspaceId = workspaceId || useAuthStore.getState().activeWorkspace?.id || 'default-workspace';

    const newEvent: EventRecord = {
      id: createId(),
      workspaceId: targetWorkspaceId,
      title: input.title.trim(),
      eventType: input.eventType || 'rehearsal',
      startAt: input.startAt,
      createdAt: timestamp,
      updatedAt: timestamp,
      serverVersion: 1,
      syncStatus: 'pending',
    };

    const endAt = input.endAt;
    const location = input.location?.trim();
    const notes = input.notes?.trim();
    if (endAt !== undefined) newEvent.endAt = endAt;
    if (location) newEvent.location = location;
    if (notes) newEvent.notes = notes;

    await db.transaction('rw', db.events, db.syncQueue, async () => {
      await db.events.add(newEvent);
      await enqueueMutation(
        db,
        targetWorkspaceId,
        'event',
        newEvent.id,
        'create',
        newEvent,
      );
    });

    return newEvent;
  },

  async update(id: string, input: UpdateEventInput): Promise<EventRecord> {
    const existing = await db.events.get(id);
    if (!existing) {
      throw new Error('Événement introuvable');
    }

    const timestamp = now();
    const updated: EventRecord = {
      ...existing,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      eventType: input.eventType !== undefined ? input.eventType : existing.eventType,
      startAt: input.startAt !== undefined ? input.startAt : existing.startAt,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };
    if (input.endAt !== undefined) updated.endAt = input.endAt;
    if (input.location !== undefined) {
      const location = input.location.trim();
      if (location) updated.location = location;
      else delete updated.location;
    }
    if (input.notes !== undefined) {
      const notes = input.notes.trim();
      if (notes) updated.notes = notes;
      else delete updated.notes;
    }
    if (input.deletedAt !== undefined) updated.deletedAt = input.deletedAt;

    await db.transaction('rw', db.events, db.syncQueue, async () => {
      await db.events.put(updated);
      await enqueueMutation(
        db,
        updated.workspaceId,
        'event',
        updated.id,
        input.deletedAt !== undefined ? 'soft_delete' : 'update',
        updated,
        existing.serverVersion,
      );
    });

    return updated;
  },

  async softDelete(id: string): Promise<void> {
    await this.update(id, { deletedAt: now() });
  },

  async restore(id: string): Promise<EventRecord> {
    const existing = await db.events.get(id);
    if (!existing) {
      throw new Error('Événement introuvable');
    }

    const timestamp = now();
    const { deletedAt: _deletedAt, ...rest } = existing;
    const restored: EventRecord = {
      ...rest,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    await db.transaction('rw', db.events, db.syncQueue, async () => {
      await db.events.put(restored);
      await enqueueMutation(
        db,
        restored.workspaceId,
        'event',
        restored.id,
        'update',
        { ...restored, deleted_at: null },
        existing.serverVersion,
      );
    });

    return restored;
  },
};
