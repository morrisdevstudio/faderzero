import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { pushPendingMutations, pullRemoteChanges } from './sync';
import { supabase } from './client';
import { createTestDatabase, destroyTestDatabase } from '@/test/dbTestUtils';
import type { FaderZeroDatabase } from '@/db/db';
import { now } from '@/lib/now';

let activeTestDb: FaderZeroDatabase;

vi.mock('@/db/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/db/db')>();
  return {
    ...original,
    db: new Proxy(
      {},
      {
        get(_target, prop) {
          return (activeTestDb as any)[prop];
        },
      }
    ),
  };
});

const singleMock = vi.fn();
const maybeSingleMock = vi.fn();
const selectMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const gtMock = vi.fn();
const orderMock = vi.fn();

const queryBuilder = {
  select: selectMock,
  insert: insertMock,
  update: updateMock,
  eq: eqMock,
  gt: gtMock,
  order: orderMock,
  maybeSingle: maybeSingleMock,
  single: singleMock,
};

selectMock.mockReturnValue(queryBuilder);
insertMock.mockReturnValue(queryBuilder);
updateMock.mockReturnValue(queryBuilder);
eqMock.mockReturnValue(queryBuilder);
gtMock.mockReturnValue(queryBuilder);
orderMock.mockReturnValue(queryBuilder);
maybeSingleMock.mockReturnValue(queryBuilder);
singleMock.mockReturnValue(queryBuilder);

vi.mock('./client', () => {
  return {
    supabase: {
      from: vi.fn().mockImplementation(() => queryBuilder),
    },
  };
});

function makeRemoteSongRow(overrides: Partial<Record<string, unknown>> = {}) {
  const baseTimestamp = '2026-07-10T12:00:00.000Z';
  return {
    id: 'song-id',
    workspace_id: 'test-workspace-123',
    title: 'Remote Song',
    lyrics: 'lyrics',
    status: 'Pret',
    duration_seconds: 180,
    created_at: baseTimestamp,
    updated_at: baseTimestamp,
    client_updated_at: baseTimestamp,
    deleted_at: null,
    server_version: 2,
    last_modified_by: 'user-2',
    ...overrides,
  };
}

describe('Sync Engine', () => {
  let database: FaderZeroDatabase;
  const workspaceId = 'test-workspace-123';

  beforeEach(async () => {
    vi.clearAllMocks();
    database = await createTestDatabase('sync-engine-test');
    activeTestDb = database;
    selectMock.mockReturnValue(queryBuilder);
    insertMock.mockReturnValue(queryBuilder);
    updateMock.mockReturnValue(queryBuilder);
    eqMock.mockReturnValue(queryBuilder);
    gtMock.mockReturnValue(queryBuilder);
    orderMock.mockReturnValue(queryBuilder);
    maybeSingleMock.mockReturnValue(queryBuilder);
    singleMock.mockReturnValue(queryBuilder);
  });

  afterEach(async () => {
    await destroyTestDatabase(database);
  });

  describe('pushPendingMutations', () => {
    it('successfully pushes a new creation mutation and clears the queue', async () => {
      const songId = 'new-song-id';
      const timestamp = now();
      const localSong = {
        id: songId,
        workspaceId,
        title: 'Imagine',
        lyrics: 'Imagine all the people...',
        status: 'Pret' as const,
        durationSeconds: 180,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending' as const,
      };
      await database.songs.add(localSong);

      await database.syncQueue.add({
        workspaceId,
        entityType: 'song',
        entityId: songId,
        operation: 'create',
        payload: {
          title: 'Imagine',
          lyrics: 'Imagine all the people...',
          status: 'Pret',
          durationSeconds: 180,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        status: 'pending',
        queuedAt: timestamp,
      });

      const mockDbRow = makeRemoteSongRow({
        id: songId,
        title: 'Imagine',
        lyrics: 'Imagine all the people...',
        duration_seconds: 180,
        created_at: new Date(timestamp).toISOString(),
        updated_at: new Date(timestamp).toISOString(),
        client_updated_at: new Date(timestamp).toISOString(),
        server_version: 15,
      });

      singleMock.mockResolvedValueOnce({ data: mockDbRow, error: null } as any);

      const report = await pushPendingMutations(workspaceId, { retryDelayMs: 0 });

      expect(report).toEqual({ processedCount: 1, failedCount: 0, recoveredCount: 0 });
      expect(supabase.from).toHaveBeenCalledWith('songs');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: songId,
          workspace_id: workspaceId,
          duration_seconds: 180,
          created_at: new Date(timestamp).toISOString(),
          updated_at: new Date(timestamp).toISOString(),
          client_updated_at: new Date(timestamp).toISOString(),
        })
      );

      const queue = await database.syncQueue.toArray();
      expect(queue).toHaveLength(0);

      const syncedSong = await database.songs.get(songId);
      expect(syncedSong?.syncStatus).toBe('synced');
      expect(syncedSong?.serverVersion).toBe(15);

      const checkpoint = await database.syncState.get(`${workspaceId}:songs`);
      expect(checkpoint?.lastPulledVersion).toBe(15);
    });

    it('retries transient failures three times and marks the outbox item as failed', async () => {
      const songId = 'retry-song-id';
      const timestamp = now();
      await database.songs.add({
        id: songId,
        workspaceId,
        title: 'Retry Me',
        lyrics: 'Still here',
        status: 'Pret',
        durationSeconds: 120,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
      });

      await database.syncQueue.add({
        workspaceId,
        entityType: 'song',
        entityId: songId,
        operation: 'create',
        payload: { updatedAt: timestamp },
        status: 'pending',
        queuedAt: timestamp,
      });

      singleMock
        .mockResolvedValueOnce({ data: null, error: { message: 'timeout' } } as any)
        .mockResolvedValueOnce({ data: null, error: { message: 'timeout' } } as any)
        .mockResolvedValueOnce({ data: null, error: { message: 'timeout' } } as any);
      maybeSingleMock
        .mockResolvedValueOnce({ data: null, error: null } as any)
        .mockResolvedValueOnce({ data: null, error: null } as any)
        .mockResolvedValueOnce({ data: null, error: null } as any);

      const report = await pushPendingMutations(workspaceId, { retryDelayMs: 0 });

      expect(report.failedCount).toBe(1);
      expect(singleMock).toHaveBeenCalledTimes(3);

      const queue = await database.syncQueue.toArray();
      expect(queue).toHaveLength(1);
      expect(queue[0]?.status).toBe('failed');
      expect(queue[0]?.retryCount).toBe(3);
      expect(queue[0]?.errorMessage).toBe('timeout');
    });

    it('revives a stale processing mutation instead of leaving it stuck forever', async () => {
      const songId = 'stale-processing-song';
      const timestamp = now();
      await database.songs.add({
        id: songId,
        workspaceId,
        title: 'Recovered Song',
        lyrics: '',
        status: 'Pret',
        durationSeconds: 90,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
      });

      await database.syncQueue.add({
        workspaceId,
        entityType: 'song',
        entityId: songId,
        operation: 'create',
        payload: { updatedAt: timestamp },
        status: 'processing',
        queuedAt: timestamp,
      });

      const remoteRow = makeRemoteSongRow({
        id: songId,
        title: 'Recovered Song',
        created_at: new Date(timestamp).toISOString(),
        updated_at: new Date(timestamp).toISOString(),
        client_updated_at: new Date(timestamp).toISOString(),
        server_version: 9,
      });
      singleMock.mockResolvedValueOnce({ data: remoteRow, error: null } as any);

      const report = await pushPendingMutations(workspaceId, { retryDelayMs: 0, processingStaleAfterMs: 0 });

      expect(report.recoveredCount).toBe(1);
      expect(report.processedCount).toBe(1);
      expect(await database.syncQueue.toArray()).toHaveLength(0);
    });

    it('applies last write wins when the remote logical timestamp is newer', async () => {
      const songId = 'lww-song-id';
      const localTimestamp = new Date('2026-07-10T14:00:00.000Z').getTime();
      await database.songs.add({
        id: songId,
        workspaceId,
        title: 'Local 14h00',
        lyrics: '',
        status: 'Pret',
        durationSeconds: 120,
        createdAt: localTimestamp,
        updatedAt: localTimestamp,
        serverVersion: 3,
        syncStatus: 'pending',
      });

      await database.syncQueue.add({
        workspaceId,
        entityType: 'song',
        entityId: songId,
        operation: 'update',
        payload: { title: 'Local 14h00', updatedAt: localTimestamp },
        baseServerVersion: 3,
        status: 'pending',
        queuedAt: localTimestamp,
      });

      const remoteTimestamp = '2026-07-10T14:15:00.000Z';
      maybeSingleMock.mockResolvedValueOnce({
        data: makeRemoteSongRow({
          id: songId,
          title: 'Remote 14h15',
          server_version: 5,
          updated_at: '2026-07-10T16:00:00.000Z',
          client_updated_at: remoteTimestamp,
        }),
        error: null,
      } as any);

      const report = await pushPendingMutations(workspaceId, { retryDelayMs: 0 });

      expect(report).toEqual({ processedCount: 1, failedCount: 0, recoveredCount: 0 });
      expect(await database.syncQueue.toArray()).toHaveLength(0);
      expect(await database.syncConflicts.toArray()).toHaveLength(0);

      const song = await database.songs.get(songId);
      expect(song?.title).toBe('Remote 14h15');
      expect(song?.updatedAt).toBe(new Date(remoteTimestamp).getTime());
      expect(song?.serverVersion).toBe(5);
    });
  });

  describe('pullRemoteChanges', () => {
    it('pulls remote changes and keeps the checkpoint behind skipped pending rows', async () => {
      await database.syncState.put({
        id: `${workspaceId}:songs`,
        workspaceId,
        tableName: 'songs',
        lastPulledVersion: 10,
        lastPulledAt: now(),
      });

      const cleanSongId = 'clean-song';
      const pendingSongId = 'pending-song';

      await database.songs.add({
        id: cleanSongId,
        workspaceId,
        title: 'Clean Old',
        lyrics: '',
        status: 'Pret',
        durationSeconds: 150,
        createdAt: now(),
        updatedAt: now(),
        syncStatus: 'synced',
        serverVersion: 8,
      });

      await database.songs.add({
        id: pendingSongId,
        workspaceId,
        title: 'Local Changes',
        lyrics: '',
        status: 'Pret',
        durationSeconds: 150,
        createdAt: now(),
        updatedAt: now(),
        syncStatus: 'pending',
        serverVersion: 8,
      });

      const remoteRows = [
        makeRemoteSongRow({
          id: cleanSongId,
          title: 'Clean Remotely Updated',
          server_version: 11,
          client_updated_at: '2026-07-10T14:01:00.000Z',
        }),
        makeRemoteSongRow({
          id: pendingSongId,
          title: 'Remote Pending Winner',
          server_version: 12,
          client_updated_at: '2026-07-10T14:15:00.000Z',
        }),
      ];

      orderMock.mockResolvedValueOnce({ data: remoteRows, error: null } as any);

      await pullRemoteChanges(workspaceId);

      const cleanSong = await database.songs.get(cleanSongId);
      expect(cleanSong?.title).toBe('Clean Remotely Updated');
      expect(cleanSong?.serverVersion).toBe(11);

      const pendingSong = await database.songs.get(pendingSongId);
      expect(pendingSong?.title).toBe('Local Changes');
      expect(pendingSong?.syncStatus).toBe('pending');

      const checkpoint = await database.syncState.get(`${workspaceId}:songs`);
      expect(checkpoint?.lastPulledVersion).toBe(11);
    });
  });
});
