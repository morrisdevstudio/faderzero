import Dexie, { type EntityTable } from 'dexie';
import type {
  DatabaseSchema,
  SetlistRecord,
  SetlistSongRecord,
  SongRecord,
  SongAssetRecord,
  SyncQueueItem,
  SyncConflictRecord,
  SyncStateRecord,
} from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';

export const FADERZERO_DB_NAME = 'faderzero-pwa';

const version1Stores = {
  songs: 'id, title, updatedAt',
  setlists: 'id, name, updatedAt',
  setlistSongs: 'id, setlistId, songId, [setlistId+position], updatedAt',
} satisfies Record<string, string>;

const version2Stores = {
  songs: 'id, title, updatedAt, deletedAt',
  setlists: 'id, name, updatedAt, deletedAt',
  setlistSongs: 'id, setlistId, songId, [setlistId+position], updatedAt',
} satisfies Record<string, string>;

const version3Stores = {
  songs: 'id, title, updatedAt, deletedAt, status',
  setlists: 'id, name, updatedAt, deletedAt',
  setlistSongs: 'id, setlistId, songId, [setlistId+position], updatedAt',
} satisfies Record<string, string>;

const version4Stores = {
  songs: 'id, title, updatedAt, deletedAt, status',
  setlists: 'id, name, updatedAt, deletedAt',
  setlistSongs: 'id, setlistId, songId, [setlistId+position], updatedAt',
} satisfies Record<string, string>;

const version5Stores = {
  songs: 'id, title, updatedAt, deletedAt, status',
  setlists: 'id, name, updatedAt, deletedAt',
  setlistSongs: 'id, setlistId, songId, [setlistId+position], updatedAt',
} satisfies Record<string, string>;

const version6Stores = {
  songs: 'id, title, updatedAt, deletedAt, status',
  setlists: 'id, name, updatedAt, deletedAt',
  setlistSongs: 'id, setlistId, songId, [setlistId+position], updatedAt',
} satisfies Record<string, string>;

  const version7Stores = {
  songs: 'id, title, updatedAt, deletedAt, status, workspaceId, syncStatus',
  setlists: 'id, name, updatedAt, deletedAt, workspaceId, syncStatus',
  setlistSongs: 'id, setlistId, songId, [setlistId+position], updatedAt, deletedAt, workspaceId, syncStatus',
  songAssets: 'id, songId, workspaceId, updatedAt, deletedAt, syncStatus',
  syncQueue: '++id, status, queuedAt, entityType, entityId, workspaceId',
  syncConflicts: 'id, workspaceId, entityId, detectedAt',
  syncState: 'id, workspaceId, tableName',
  } satisfies Record<keyof DatabaseSchema, string>;

const version8Stores = version7Stores;

export class FaderZeroDatabase extends Dexie {
  songs!: EntityTable<SongRecord, 'id'>;
  setlists!: EntityTable<SetlistRecord, 'id'>;
  setlistSongs!: EntityTable<SetlistSongRecord, 'id'>;
  songAssets!: EntityTable<SongAssetRecord, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;
  syncConflicts!: EntityTable<SyncConflictRecord, 'id'>;
  syncState!: EntityTable<SyncStateRecord, 'id'>;

  constructor(name = FADERZERO_DB_NAME) {
    super(name);

    this.version(1).stores(version1Stores);

    this.version(2)
      .stores(version2Stores)
      .upgrade(async (transaction) => {
        const timestamp = now();

        await transaction
          .table<SongRecord, string>('songs')
          .toCollection()
          .modify((song) => {
            song.id ||= createId();
            song.title ||= '';
            song.lyrics ||= '';
            song.createdAt ||= song.updatedAt || timestamp;
            song.updatedAt ||= song.createdAt || timestamp;
          });

        await transaction
          .table<SetlistRecord, string>('setlists')
          .toCollection()
          .modify((setlist) => {
            setlist.id ||= createId();
            setlist.name ||= '';
            setlist.createdAt ||= setlist.updatedAt || timestamp;
            setlist.updatedAt ||= setlist.createdAt || timestamp;
          });

        await transaction
          .table<SetlistSongRecord, string>('setlistSongs')
          .toCollection()
          .modify((setlistSong) => {
            setlistSong.id ||= createId();
            setlistSong.position ||= 0;
            setlistSong.createdAt ||= setlistSong.updatedAt || timestamp;
            setlistSong.updatedAt ||= setlistSong.createdAt || timestamp;
          });
      });

    this.version(3)
      .stores(version3Stores)
      .upgrade(async (transaction) => {
        await transaction
          .table<SongRecord, string>('songs')
          .toCollection()
          .modify((song) => {
            song.status ||= 'Idee';
            song.durationSeconds ||= 0;
          });
      });

    this.version(4)
      .stores(version4Stores)
      .upgrade(async (transaction) => {
        await transaction
          .table<SetlistSongRecord, string>('setlistSongs')
          .toCollection()
          .modify((setlistSong) => {
            setlistSong.noteShowBpm ||= false;
            setlistSong.noteShowKey ||= false;
          });
      });

    this.version(5)
      .stores(version5Stores)
      .upgrade(async (transaction) => {
        await transaction
          .table<SetlistSongRecord, string>('setlistSongs')
          .toCollection()
          .modify((setlistSong) => {
            setlistSong.isDirectSegue ||= false;
          });
      });

    this.version(6)
      .stores(version6Stores)
      .upgrade(async (transaction) => {
        await transaction
          .table<SetlistRecord, string>('setlists')
          .toCollection()
          .modify((setlist) => {
            if (setlist.closingAnnotation === undefined) {
              return;
            }
          });
      });

    this.version(7)
      .stores(version7Stores)
      .upgrade(async (transaction) => {
        const defaultWorkspaceId = 'default-workspace';

        await transaction
          .table<SongRecord, string>('songs')
          .toCollection()
          .modify((song) => {
            song.workspaceId ||= defaultWorkspaceId;
            song.syncStatus ||= 'synced';
            song.serverVersion ||= 1;
          });

        await transaction
          .table<SetlistRecord, string>('setlists')
          .toCollection()
          .modify((setlist) => {
            setlist.workspaceId ||= defaultWorkspaceId;
            setlist.syncStatus ||= 'synced';
            setlist.serverVersion ||= 1;
          });

        await transaction
          .table<SetlistSongRecord, string>('setlistSongs')
          .toCollection()
          .modify((setlistSong) => {
            setlistSong.workspaceId ||= defaultWorkspaceId;
            setlistSong.syncStatus ||= 'synced';
            setlistSong.serverVersion ||= 1;
            delete (setlistSong as any).deletedAt;
          });
      });

    this.version(8)
      .stores(version8Stores)
      .upgrade(async (transaction) => {
        await transaction
          .table<SetlistRecord, string>('setlists')
          .toCollection()
          .modify((setlist) => {
            setlist.bpmDisplayMode ||= 'per-song';
            setlist.keyDisplayMode ||= 'per-song';
          });
      });
  }
}

export function createDatabase(name = FADERZERO_DB_NAME) {
  return new FaderZeroDatabase(name);
}

export const db = createDatabase();
