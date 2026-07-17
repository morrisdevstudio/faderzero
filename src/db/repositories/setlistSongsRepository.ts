import type { FaderZeroDatabase } from '@/db/db';
import { db } from '@/db/db';
import type {
  CreateSetlistSongInput,
  SetlistSongDetail,
  SetlistSongRecord,
  UpdateSetlistSongInput,
} from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';
import { useAuthStore } from '@/stores/authStore';
import { enqueueMutation } from '@/db/syncQueueHelper';

export class SetlistSongsRepository {
  private readonly database: FaderZeroDatabase;

  constructor(database: FaderZeroDatabase = db) {
    this.database = database;
  }

  private getActiveWorkspaceId(): string {
    return useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
  }

  async listBySetlistId(setlistId: string) {
    const workspaceId = this.getActiveWorkspaceId();
    const rows = await this.database.setlistSongs.where('setlistId').equals(setlistId).toArray();
    // Exclure les suppressions logiques de la liste active
    return rows
      .filter((row) => row.workspaceId === workspaceId)
      .filter((row) => row.deletedAt === undefined)
      .sort((left, right) => left.position - right.position);
  }

  async listDetailedBySetlistId(setlistId: string) {
    const workspaceId = this.getActiveWorkspaceId();
    const [entries, songs] = await Promise.all([
      this.listBySetlistId(setlistId),
      this.database.songs.where('workspaceId').equals(workspaceId).toArray(),
    ]);

    const songMap = new Map(songs.map((song) => [song.id, song]));

    return entries
      .map<SetlistSongDetail | null>((entry) => {
        const song = songMap.get(entry.songId);
        if (!song || song.deletedAt !== undefined) {
          return null;
        }

        const detail: SetlistSongDetail = {
          ...entry,
          songTitle: song.title,
        };

        if (song.artist !== undefined) {
          detail.songArtist = song.artist;
        }
        if (song.key !== undefined) {
          detail.songKey = song.key;
        }
        if (song.bpm !== undefined) {
          detail.songBpm = song.bpm;
        }

        return detail;
      })
      .filter((entry): entry is SetlistSongDetail => entry !== null);
  }

  async create(input: CreateSetlistSongInput) {
    const timestamp = now();
    const workspaceId = this.getActiveWorkspaceId();

    const setlistSong: SetlistSongRecord = {
      id: createId(),
      workspaceId,
      setlistId: input.setlistId,
      songId: input.songId,
      position: input.position,
      noteShowBpm: false,
      noteShowKey: false,
      isDirectSegue: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    await this.database.transaction('rw', this.database.setlistSongs, this.database.syncQueue, async () => {
      await this.database.setlistSongs.add(setlistSong);
      await enqueueMutation(
        this.database,
        workspaceId,
        'setlistSong',
        setlistSong.id,
        'create',
        {
          setlistId: setlistSong.setlistId,
          songId: setlistSong.songId,
          position: setlistSong.position,
          noteShowBpm: setlistSong.noteShowBpm,
          noteShowKey: setlistSong.noteShowKey,
          isDirectSegue: setlistSong.isDirectSegue,
          createdAt: setlistSong.createdAt,
          updatedAt: setlistSong.updatedAt,
        }
      );
    });

    return setlistSong;
  }

  async addSongToSetlist(setlistId: string, songId: string) {
    const existingEntries = await this.listBySetlistId(setlistId);
    const nextPosition =
      existingEntries.length === 0
        ? 0
        : Math.max(...existingEntries.map((entry) => entry.position)) + 1;

    return this.create({
      setlistId,
      songId,
      position: nextPosition,
    });
  }

  async update(id: string, updates: UpdateSetlistSongInput) {
    const existingSetlistSong = await this.database.setlistSongs.get(id);
    if (!existingSetlistSong) {
      throw new Error(`Setlist song not found: ${id}`);
    }

    const timestamp = now();
    const nextSetlistSong: SetlistSongRecord = {
      ...existingSetlistSong,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    const payload: any = { updatedAt: timestamp };

    if (updates.position !== undefined) {
      nextSetlistSong.position = updates.position;
      payload.position = updates.position;
    }
    if (updates.noteShowBpm !== undefined) {
      nextSetlistSong.noteShowBpm = updates.noteShowBpm;
      payload.noteShowBpm = updates.noteShowBpm;
    }
    if (updates.noteShowKey !== undefined) {
      nextSetlistSong.noteShowKey = updates.noteShowKey;
      payload.noteShowKey = updates.noteShowKey;
    }
    if (updates.isDirectSegue !== undefined) {
      nextSetlistSong.isDirectSegue = updates.isDirectSegue;
      payload.isDirectSegue = updates.isDirectSegue;
    }
    if (updates.annotation !== undefined) {
      const annotation = updates.annotation.trim();
      if (annotation) {
        nextSetlistSong.annotation = annotation;
        payload.annotation = annotation;
      } else {
        delete nextSetlistSong.annotation;
        payload.annotation = null;
      }
    }

    await this.database.transaction('rw', this.database.setlistSongs, this.database.syncQueue, async () => {
      await this.database.setlistSongs.put(nextSetlistSong);
      await enqueueMutation(
        this.database,
        nextSetlistSong.workspaceId,
        'setlistSong',
        nextSetlistSong.id,
        'update',
        payload,
        existingSetlistSong.serverVersion
      );
    });

    return nextSetlistSong;
  }

  async delete(id: string) {
    const existingSetlistSong = await this.database.setlistSongs.get(id);
    if (!existingSetlistSong) {
      return;
    }

    const timestamp = now();
    const deletedEntry: SetlistSongRecord = {
      ...existingSetlistSong,
      deletedAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    await this.database.transaction('rw', this.database.setlistSongs, this.database.syncQueue, async () => {
      // 1. Soft delete de la liaison setlistSong
      await this.database.setlistSongs.put(deletedEntry);
      await enqueueMutation(
        this.database,
        deletedEntry.workspaceId,
        'setlistSong',
        deletedEntry.id,
        'soft_delete',
        { deletedAt: timestamp },
        existingSetlistSong.serverVersion
      );

      // 2. Reindexation de la setlist suite à la suppression
      await this.reindexSetlist(existingSetlistSong.setlistId);
    });
  }

  async deleteBySetlistId(setlistId: string) {
    const rows = await this.database.setlistSongs.where('setlistId').equals(setlistId).toArray();
    const timestamp = now();

    await this.database.transaction('rw', this.database.setlistSongs, this.database.syncQueue, async () => {
      for (const row of rows) {
        if (row.deletedAt === undefined) {
          await this.database.setlistSongs.put({
            ...row,
            deletedAt: timestamp,
            syncStatus: 'pending',
            updatedAt: timestamp,
          });
          await enqueueMutation(
            this.database,
            row.workspaceId,
            'setlistSong',
            row.id,
            'soft_delete',
            { deletedAt: timestamp },
            row.serverVersion
          );
        }
      }
    });
  }

  async deleteBySongId(songId: string) {
    const rows = await this.database.setlistSongs.where('songId').equals(songId).toArray();
    const affectedSetlistIds = [...new Set(rows.map((row) => row.setlistId))];
    const timestamp = now();

    await this.database.transaction('rw', this.database.setlistSongs, this.database.syncQueue, async () => {
      // 1. Soft delete de toutes les occurrences du morceau dans toutes les setlists
      for (const row of rows) {
        if (row.deletedAt === undefined) {
          await this.database.setlistSongs.put({
            ...row,
            deletedAt: timestamp,
            syncStatus: 'pending',
            updatedAt: timestamp,
          });
          await enqueueMutation(
            this.database,
            row.workspaceId,
            'setlistSong',
            row.id,
            'soft_delete',
            { deletedAt: timestamp },
            row.serverVersion
          );
        }
      }

      // 2. Réindexer chaque setlist impactée
      for (const setlistId of affectedSetlistIds) {
        await this.reindexSetlist(setlistId);
      }
    });
  }

  async move(setlistSongId: string, direction: -1 | 1) {
    const entry = await this.database.setlistSongs.get(setlistSongId);
    if (!entry || entry.deletedAt !== undefined) {
      throw new Error(`Setlist song not found: ${setlistSongId}`);
    }

    const orderedEntries = await this.listBySetlistId(entry.setlistId);
    const currentIndex = orderedEntries.findIndex((item) => item.id === setlistSongId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedEntries.length) {
      return orderedEntries;
    }

    const reorderedEntries = [...orderedEntries];
    const [movedEntry] = reorderedEntries.splice(currentIndex, 1);
    if (!movedEntry) {
      return orderedEntries;
    }
    reorderedEntries.splice(targetIndex, 0, movedEntry);

    return this.persistOrderedPositions(entry.setlistId, reorderedEntries);
  }

  private async reindexSetlist(setlistId: string) {
    const orderedEntries = await this.listBySetlistId(setlistId);
    await this.persistOrderedPositions(setlistId, orderedEntries);
  }

  private async persistOrderedPositions(setlistId: string, orderedEntries: SetlistSongRecord[]) {
    const timestamp = now();
    const normalizedEntries = orderedEntries.map((entry, index) => ({
      ...entry,
      position: index,
      isDirectSegue: index === 0 ? false : (entry.isDirectSegue ?? false),
      updatedAt: timestamp,
      syncStatus: 'pending' as const,
    }));

    await this.database.transaction('rw', this.database.setlistSongs, this.database.syncQueue, async () => {
      await this.database.setlistSongs.bulkPut(normalizedEntries);
      
      // Enregistrer les mutations de réindexation
      for (const entry of normalizedEntries) {
        await enqueueMutation(
          this.database,
          entry.workspaceId,
          'setlistSong',
          entry.id,
          'update',
          {
            position: entry.position,
            isDirectSegue: entry.isDirectSegue,
            updatedAt: timestamp,
          },
          entry.serverVersion
        );
      }
    });

    return this.listBySetlistId(setlistId);
  }
}

export const setlistSongsRepository = new SetlistSongsRepository();
