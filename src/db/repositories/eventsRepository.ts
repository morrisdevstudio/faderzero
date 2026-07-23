import { db } from '@/db/db';
import type { CreateEventInput, EventRecord, UpdateEventInput } from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';
import { useAuthStore } from '@/stores/authStore';
import { enqueueMutation } from '@/db/syncQueueHelper';

export const eventsRepository = {
  async getById(id: string): Promise<EventRecord | undefined> {
    return db.events.get(id);
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
};
