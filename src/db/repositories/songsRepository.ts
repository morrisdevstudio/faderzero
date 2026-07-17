import type { FaderZeroDatabase } from '@/db/db';
import { db } from '@/db/db';
import type { CreateSongInput, SongListOptions, SongRecord, UpdateSongInput } from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';
import { useAuthStore } from '@/stores/authStore';
import { enqueueMutation } from '@/db/syncQueueHelper';

export class SongsRepository {
  private readonly database: FaderZeroDatabase;

  constructor(database: FaderZeroDatabase = db) {
    this.database = database;
  }

  private getActiveWorkspaceId(): string {
    return useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
  }

  async list(options: SongListOptions = {}) {
    const workspaceId = this.getActiveWorkspaceId();
    const query = options.query?.trim().toLocaleLowerCase();
    const songs = await this.database.songs.where('workspaceId').equals(workspaceId).toArray();

    return songs
      .filter((song) => options.includeDeleted || song.deletedAt === undefined)
      .filter((song) => {
        if (!query) {
          return true;
        }

        return song.title.toLocaleLowerCase().includes(query);
      })
      .sort((left, right) => left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' }));
  }

  async getById(id: string) {
    const song = await this.database.songs.get(id);
    if (!song) {
      return undefined;
    }

    return song.workspaceId === this.getActiveWorkspaceId() ? song : undefined;
  }

  async create(input: CreateSongInput) {
    const timestamp = now();
    const workspaceId = this.getActiveWorkspaceId();
    
    const song: SongRecord = {
      id: createId(),
      workspaceId,
      title: input.title.trim(),
      lyrics: input.lyrics ?? '',
      status: input.status ?? 'Idee',
      durationSeconds: input.durationSeconds ?? 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    const artist = input.artist?.trim();
    const key = input.key?.trim();
    const notes = input.notes?.trim();

    if (artist) {
      song.artist = artist;
    }
    if (key) {
      song.key = key;
    }
    if (input.bpm !== undefined) {
      song.bpm = input.bpm;
    }
    if (notes) {
      song.notes = notes;
    }

    await this.database.transaction('rw', this.database.songs, this.database.syncQueue, async () => {
      await this.database.songs.add(song);
      await enqueueMutation(
        this.database,
        workspaceId,
        'song',
        song.id,
        'create',
        {
          title: song.title,
          lyrics: song.lyrics,
          status: song.status,
          durationSeconds: song.durationSeconds,
          artist: song.artist,
          key: song.key,
          bpm: song.bpm,
          notes: song.notes,
          createdAt: song.createdAt,
          updatedAt: song.updatedAt,
        }
      );
    });

    return song;
  }

  async update(id: string, updates: UpdateSongInput) {
    const existingSong = await this.database.songs.get(id);
    if (!existingSong) {
      throw new Error(`Song not found: ${id}`);
    }

    const timestamp = now();
    const nextSong: SongRecord = { 
      ...existingSong, 
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    const payload: any = { updatedAt: timestamp };

    if (updates.title !== undefined) {
      nextSong.title = updates.title.trim();
      payload.title = nextSong.title;
    }
    if (updates.lyrics !== undefined) {
      nextSong.lyrics = updates.lyrics;
      payload.lyrics = nextSong.lyrics;
    }
    if (updates.bpm !== undefined) {
      nextSong.bpm = updates.bpm;
      payload.bpm = nextSong.bpm;
    }
    if (updates.status !== undefined) {
      nextSong.status = updates.status;
      payload.status = nextSong.status;
    }
    if (updates.durationSeconds !== undefined) {
      nextSong.durationSeconds = updates.durationSeconds;
      payload.durationSeconds = nextSong.durationSeconds;
    }
    if (updates.deletedAt !== undefined) {
      nextSong.deletedAt = updates.deletedAt;
      payload.deletedAt = nextSong.deletedAt;
    }
    if (updates.artist !== undefined) {
      const artist = updates.artist.trim();
      if (artist) {
        nextSong.artist = artist;
        payload.artist = artist;
      } else {
        delete nextSong.artist;
        payload.artist = null;
      }
    }
    if (updates.key !== undefined) {
      const key = updates.key.trim();
      if (key) {
        nextSong.key = key;
        payload.key = key;
      } else {
        delete nextSong.key;
        payload.key = null;
      }
    }
    if (updates.notes !== undefined) {
      const notes = updates.notes.trim();
      if (notes) {
        nextSong.notes = notes;
        payload.notes = notes;
      } else {
        delete nextSong.notes;
        payload.notes = null;
      }
    }

    await this.database.transaction('rw', this.database.songs, this.database.syncQueue, async () => {
      await this.database.songs.put(nextSong);
      await enqueueMutation(
        this.database,
        nextSong.workspaceId,
        'song',
        nextSong.id,
        'update',
        payload,
        existingSong.serverVersion
      );
    });

    return nextSong;
  }

  async softDelete(id: string) {
    const existingSong = await this.database.songs.get(id);
    if (!existingSong) {
      throw new Error(`Song not found: ${id}`);
    }

    const timestamp = now();
    const deletedSong: SongRecord = {
      ...existingSong,
      deletedAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    await this.database.transaction(
      'rw',
      this.database.songs,
      this.database.setlistSongs,
      this.database.syncQueue,
      async () => {
        // 1. Soft delete du morceau
        await this.database.songs.put(deletedSong);
        await enqueueMutation(
          this.database,
          deletedSong.workspaceId,
          'song',
          deletedSong.id,
          'soft_delete',
          { deletedAt: timestamp },
          existingSong.serverVersion
        );

        // 2. Soft delete des liaisons setlistSongs associées
        const relatedEntries = await this.database.setlistSongs.where('songId').equals(id).toArray();
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

    return deletedSong;
  }

  async countActive() {
    const songs = await this.list();
    return songs.length;
  }
}

export const songsRepository = new SongsRepository();
