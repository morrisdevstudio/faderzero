import type { FaderZeroDatabase } from '@/db/db';
import { db } from '@/db/db';
import type {
  CreateSetlistInput,
  SetlistListOptions,
  SetlistRecord,
  SetlistSummary,
  UpdateSetlistInput,
} from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';
import { useAuthStore } from '@/stores/authStore';
import { enqueueMutation } from '@/db/syncQueueHelper';

export class SetlistsRepository {
  private readonly database: FaderZeroDatabase;

  constructor(database: FaderZeroDatabase = db) {
    this.database = database;
  }

  private getActiveWorkspaceId(): string {
    return useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
  }

  async list(options: SetlistListOptions = {}) {
    const workspaceId = this.getActiveWorkspaceId();
    const setlists = await this.database.setlists.where('workspaceId').equals(workspaceId).toArray();

    return setlists
      .filter((setlist) => options.includeDeleted || setlist.deletedAt === undefined)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async listSummaries(options: SetlistListOptions = {}) {
    const workspaceId = this.getActiveWorkspaceId();
    const [setlists, setlistSongs, songs] = await Promise.all([
      this.list(options),
      this.database.setlistSongs.where('workspaceId').equals(workspaceId).toArray(),
      this.database.songs.where('workspaceId').equals(workspaceId).toArray(),
    ]);

    const activeSongDurations = new Map(
      songs
        .filter((song) => song.deletedAt === undefined)
        .map((song) => [song.id, song.durationSeconds] as const),
    );
    const counts = new Map<string, number>();
    const totalDurations = new Map<string, number>();
    for (const setlistSong of setlistSongs) {
      if (setlistSong.deletedAt !== undefined) {
        continue;
      }
      const duration = activeSongDurations.get(setlistSong.songId);
      if (duration === undefined) {
        continue;
      }

      counts.set(setlistSong.setlistId, (counts.get(setlistSong.setlistId) ?? 0) + 1);
      totalDurations.set(
        setlistSong.setlistId,
        (totalDurations.get(setlistSong.setlistId) ?? 0) + duration,
      );
    }

    return setlists.map<SetlistSummary>((setlist) => ({
      ...setlist,
      songCount: counts.get(setlist.id) ?? 0,
      totalDurationSeconds: totalDurations.get(setlist.id) ?? 0,
    }));
  }

  async getById(id: string) {
    const setlist = await this.database.setlists.get(id);
    if (!setlist) {
      return undefined;
    }

    return setlist.workspaceId === this.getActiveWorkspaceId() ? setlist : undefined;
  }

  async create(input: CreateSetlistInput) {
    const timestamp = now();
    const workspaceId = this.getActiveWorkspaceId();

    const setlist: SetlistRecord = {
      id: createId(),
      workspaceId,
      name: input.name.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
      bpmDisplayMode: 'per-song',
      keyDisplayMode: 'per-song',
    };

    const date = input.date?.trim();
    const notes = input.notes?.trim();
    const closingAnnotation = input.closingAnnotation?.trim();

    if (date) {
      setlist.date = date;
    }
    if (notes) {
      setlist.notes = notes;
    }
    if (closingAnnotation) {
      setlist.closingAnnotation = closingAnnotation;
    }

    await this.database.transaction('rw', this.database.setlists, this.database.syncQueue, async () => {
      await this.database.setlists.add(setlist);
      await enqueueMutation(
        this.database,
        workspaceId,
        'setlist',
        setlist.id,
        'create',
        {
          name: setlist.name,
          date: setlist.date,
          notes: setlist.notes,
          closingAnnotation: setlist.closingAnnotation,
          bpmDisplayMode: setlist.bpmDisplayMode,
          keyDisplayMode: setlist.keyDisplayMode,
          createdAt: setlist.createdAt,
          updatedAt: setlist.updatedAt,
        }
      );
    });

    return setlist;
  }

  async update(id: string, updates: UpdateSetlistInput) {
    const existingSetlist = await this.database.setlists.get(id);
    if (!existingSetlist) {
      throw new Error(`Setlist not found: ${id}`);
    }

    const timestamp = now();
    const nextSetlist: SetlistRecord = { 
      ...existingSetlist, 
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    const payload: any = { updatedAt: timestamp };

    if (updates.name !== undefined) {
      nextSetlist.name = updates.name.trim();
      payload.name = nextSetlist.name;
    }
    if (updates.deletedAt !== undefined) {
      nextSetlist.deletedAt = updates.deletedAt;
      payload.deletedAt = nextSetlist.deletedAt;
    }
    if (updates.date !== undefined) {
      const date = updates.date.trim();
      if (date) {
        nextSetlist.date = date;
        payload.date = date;
      } else {
        delete nextSetlist.date;
        payload.date = null;
      }
    }
    if (updates.notes !== undefined) {
      const notes = updates.notes.trim();
      if (notes) {
        nextSetlist.notes = notes;
        payload.notes = notes;
      } else {
        delete nextSetlist.notes;
        payload.notes = null;
      }
    }
    if (updates.closingAnnotation !== undefined) {
      const closingAnnotation = updates.closingAnnotation.trim();
      if (closingAnnotation) {
        nextSetlist.closingAnnotation = closingAnnotation;
        payload.closingAnnotation = closingAnnotation;
      } else {
        delete nextSetlist.closingAnnotation;
        payload.closingAnnotation = null;
      }
    }
    if (updates.bpmDisplayMode !== undefined) {
      nextSetlist.bpmDisplayMode = updates.bpmDisplayMode;
      payload.bpmDisplayMode = updates.bpmDisplayMode;
    }
    if (updates.keyDisplayMode !== undefined) {
      nextSetlist.keyDisplayMode = updates.keyDisplayMode;
      payload.keyDisplayMode = updates.keyDisplayMode;
    }

    await this.database.transaction('rw', this.database.setlists, this.database.syncQueue, async () => {
      await this.database.setlists.put(nextSetlist);
      await enqueueMutation(
        this.database,
        nextSetlist.workspaceId,
        'setlist',
        nextSetlist.id,
        'update',
        payload,
        existingSetlist.serverVersion
      );
    });

    return nextSetlist;
  }

  async softDelete(id: string) {
    const existingSetlist = await this.database.setlists.get(id);
    if (!existingSetlist) {
      throw new Error(`Setlist not found: ${id}`);
    }

    const timestamp = now();
    const deletedSetlist: SetlistRecord = {
      ...existingSetlist,
      deletedAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    await this.database.transaction(
      'rw',
      this.database.setlists,
      this.database.setlistSongs,
      this.database.syncQueue,
      async () => {
        // 1. Soft delete de la setlist
        await this.database.setlists.put(deletedSetlist);
        await enqueueMutation(
          this.database,
          deletedSetlist.workspaceId,
          'setlist',
          deletedSetlist.id,
          'soft_delete',
          { deletedAt: timestamp },
          existingSetlist.serverVersion
        );

        // 2. Soft delete des liaisons setlistSongs associées
        const relatedEntries = await this.database.setlistSongs.where('setlistId').equals(id).toArray();
        for (const entry of relatedEntries) {
          if (entry.deletedAt === undefined) {
            await this.database.setlistSongs.put({
              ...entry,
              deletedAt: timestamp,
              syncStatus: 'pending',
              updatedAt: timestamp,
            });
            await enqueueMutation(
              this.database,
              entry.workspaceId,
              'setlistSong',
              entry.id,
              'soft_delete',
              { deletedAt: timestamp },
              entry.serverVersion
            );
          }
        }
      }
    );

    return deletedSetlist;
  }
}

export const setlistsRepository = new SetlistsRepository();
