import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type FaderZeroDatabase } from '@/db/db';
import {
  getUserDatabaseName,
  migrateLegacyData,
  purgeRevokedWorkspaceData,
  recoverPendingItems,
} from '@/db/userDataMigration';

const databases: FaderZeroDatabase[] = [];

async function testDatabase(name: string) {
  const database = createDatabase(`${name}-${Date.now()}-${Math.random()}`);
  databases.push(database);
  await database.open();
  return database;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => {
    database.close();
    await database.delete();
  }));
});

function song(id: string, workspaceId: string) {
  return {
    id,
    workspaceId,
    title: id,
    lyrics: '',
    status: 'Idee' as const,
    durationSeconds: 0,
    createdAt: 1,
    updatedAt: 1,
    syncStatus: 'synced' as const,
  };
}

describe('user local data migration', () => {
  it('resumes an interrupted copy without duplicating records', async () => {
    const source = await testDatabase('legacy');
    const target = await testDatabase('user');
    await source.songs.bulkPut([song('allowed', 'workspace-a'), song('ambiguous', 'default-workspace')]);

    await expect(migrateLegacyData(source, target, 'user-a', new Set(['workspace-a']), {
      afterTable: (tableName) => {
        if (tableName === 'songs') throw new Error('simulated interruption');
      },
    })).rejects.toThrow('simulated interruption');

    const interruptedJournal = await target.localMigrationJournal.get('legacy-global-v9');
    expect(interruptedJournal?.status).toBe('failed');
    expect(interruptedJournal?.completedTables).toContain('songs');

    const report = await migrateLegacyData(source, target, 'user-a', new Set(['workspace-a']));
    expect(report.resumed).toBe(true);
    expect(await target.songs.toArray()).toEqual([expect.objectContaining({ id: 'allowed' })]);
    expect(await target.recoveryItems.where('status').equals('pending').count()).toBe(1);
    expect((await target.localMigrationJournal.get('legacy-global-v9'))?.status).toBe('completed');
  });

  it('keeps two user databases isolated and leaves unauthorized rows in the legacy database', async () => {
    const source = await testDatabase('legacy-isolation');
    const firstUser = await testDatabase('first-user');
    const secondUser = await testDatabase('second-user');
    await source.songs.bulkPut([song('song-a', 'workspace-a'), song('song-b', 'workspace-b')]);

    await migrateLegacyData(source, firstUser, 'user-a', new Set(['workspace-a']));
    await migrateLegacyData(source, secondUser, 'user-b', new Set(['workspace-b']));

    expect((await firstUser.songs.toArray()).map(({ id }) => id)).toEqual(['song-a']);
    expect((await secondUser.songs.toArray()).map(({ id }) => id)).toEqual(['song-b']);
    expect(await source.songs.count()).toBe(2);
    expect(getUserDatabaseName('user/a')).toBe('faderzero-pwa-user-user%2Fa');
  });

  it('reattaches ambiguous rows to the personal workspace and queues their upload', async () => {
    const source = await testDatabase('legacy-recovery');
    const target = await testDatabase('target-recovery');
    await source.songs.put(song('ambiguous', 'default-workspace'));
    await migrateLegacyData(source, target, 'user-a', new Set(['personal-a']));

    await expect(recoverPendingItems('personal-a', target)).resolves.toBe(1);
    expect(await target.songs.get('ambiguous')).toEqual(expect.objectContaining({
      workspaceId: 'personal-a',
      syncStatus: 'pending',
    }));
    expect(await target.syncQueue.toArray()).toEqual([
      expect.objectContaining({ workspaceId: 'personal-a', entityId: 'ambiguous', operation: 'create' }),
    ]);
    expect(await target.recoveryItems.where('status').equals('pending').count()).toBe(0);
  });

  it('purges revoked workspace rows and their pending synchronization state', async () => {
    const database = await testDatabase('revocation');
    await database.songs.bulkPut([song('kept', 'workspace-a'), song('revoked', 'workspace-b')]);
    await database.syncQueue.add({
      workspaceId: 'workspace-b',
      entityType: 'song',
      entityId: 'revoked',
      operation: 'update',
      payload: {},
      status: 'pending',
      queuedAt: 1,
    });

    await expect(purgeRevokedWorkspaceData(new Set(['workspace-a']), database)).resolves.toEqual(['workspace-b']);
    expect((await database.songs.toArray()).map(({ id }) => id)).toEqual(['kept']);
    expect(await database.syncQueue.count()).toBe(0);
  });
});
