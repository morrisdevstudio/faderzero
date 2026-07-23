import {
  activateDatabase,
  createDatabase,
  getActiveDatabase,
  getLegacyDatabase,
  type FaderZeroDatabase,
} from '@/db/db';
import type {
  LocalEntityType,
  LocalMigrationJournalRecord,
  RecoveryItemRecord,
  SongAssetRecord,
  SongRecord,
  SetlistRecord,
  SetlistSongRecord,
  SyncConflictRecord,
  SyncQueueItem,
  SyncStateRecord,
} from '@/db/schema';
import { now } from '@/lib/now';

const MIGRATION_ID = 'legacy-global-v9';
const USER_DATABASE_PREFIX = 'faderzero-pwa-user-';
const DOMAIN_TABLES = ['songs', 'setlists', 'setlistSongs', 'songAssets'] as const;
const SYNC_TABLES = ['syncQueue', 'syncConflicts', 'syncState'] as const;
const ALL_MIGRATION_TABLES = [...DOMAIN_TABLES, ...SYNC_TABLES] as const;

type DomainTableName = (typeof DOMAIN_TABLES)[number];
type MigrationTableName = (typeof ALL_MIGRATION_TABLES)[number];
type DomainRecord = SongRecord | SetlistRecord | SetlistSongRecord | SongAssetRecord;

const ENTITY_TYPE_BY_TABLE: Record<DomainTableName, LocalEntityType> = {
  songs: 'song',
  setlists: 'setlist',
  setlistSongs: 'setlistSong',
  songAssets: 'songAsset',
};

export interface LocalMigrationReport {
  databaseName: string;
  sourceCounts: Record<string, number>;
  copiedCounts: Record<string, number>;
  recoveryCount: number;
  resumed: boolean;
}

export interface LocalMigrationOptions {
  afterTable?: (tableName: MigrationTableName) => void | Promise<void>;
}

function workspaceFingerprint(workspaceIds: ReadonlySet<string>) {
  return [...workspaceIds].sort().join('|');
}

export function getUserDatabaseName(userId: string) {
  return `${USER_DATABASE_PREFIX}${encodeURIComponent(userId)}`;
}

function isAmbiguousWorkspaceId(workspaceId: unknown) {
  return typeof workspaceId !== 'string' || workspaceId.length === 0 || workspaceId === 'default-workspace';
}

interface IdTable<T extends { id: string }> {
  bulkGet: (keys: string[]) => Promise<Array<T | undefined>>;
  bulkPut: (records: T[]) => Promise<unknown>;
}

async function putMissingById<T extends { id: string }>(target: IdTable<T>, records: T[]) {
  if (records.length === 0) return 0;
  const existingIds = new Set((await target.bulkGet(records.map((record) => record.id))).flatMap((record) => record ? [record.id] : []));
  const missingRecords = records.filter((record) => !existingIds.has(record.id));
  if (missingRecords.length > 0) {
    await target.bulkPut(missingRecords);
  }
  return records.length;
}

async function copyQueueItems(target: FaderZeroDatabase, records: SyncQueueItem[]) {
  let copiedCount = 0;
  for (const sourceItem of records) {
    const existing = await target.syncQueue
      .where('entityId')
      .equals(sourceItem.entityId)
      .filter((item) =>
        item.workspaceId === sourceItem.workspaceId &&
        item.entityType === sourceItem.entityType &&
        item.operation === sourceItem.operation
      )
      .first();
    if (!existing) {
      const { id: _legacyId, ...item } = sourceItem;
      await target.syncQueue.add(item);
    }
    copiedCount += 1;
  }
  return copiedCount;
}

async function upsertRecoveryItems(
  target: FaderZeroDatabase,
  tableName: DomainTableName,
  records: DomainRecord[],
) {
  const createdAt = now();
  for (const record of records) {
    const id = `${ENTITY_TYPE_BY_TABLE[tableName]}:${record.id}`;
    if (await target.recoveryItems.get(id)) continue;
    const sourceWorkspaceId = typeof record.workspaceId === 'string' ? record.workspaceId : '';
    await target.recoveryItems.put({
      id,
      entityType: ENTITY_TYPE_BY_TABLE[tableName],
      entityId: record.id,
      sourceWorkspaceId,
      reason: sourceWorkspaceId === 'default-workspace' ? 'default-workspace' : 'missing-workspace',
      payload: structuredClone(record),
      status: 'pending',
      createdAt,
    });
  }
}

async function copyMigrationTable(
  source: FaderZeroDatabase,
  target: FaderZeroDatabase,
  tableName: MigrationTableName,
  allowedWorkspaceIds: ReadonlySet<string>,
) {
  if (tableName === 'syncQueue') {
    const sourceRecords = (await source.syncQueue.toArray()).filter((record) => allowedWorkspaceIds.has(record.workspaceId));
    return { sourceCount: sourceRecords.length, copiedCount: await copyQueueItems(target, sourceRecords) };
  }

  if (tableName === 'syncConflicts') {
    const sourceRecords = (await source.syncConflicts.toArray()).filter((record) => allowedWorkspaceIds.has(record.workspaceId));
    return {
      sourceCount: sourceRecords.length,
      copiedCount: await putMissingById<SyncConflictRecord>(target.syncConflicts, sourceRecords),
    };
  }

  if (tableName === 'syncState') {
    const sourceRecords = (await source.syncState.toArray()).filter((record) => allowedWorkspaceIds.has(record.workspaceId));
    return {
      sourceCount: sourceRecords.length,
      copiedCount: await putMissingById<SyncStateRecord>(target.syncState, sourceRecords),
    };
  }

  const sourceRecords = await source.table<DomainRecord, string>(tableName).toArray();
  const attributableRecords = sourceRecords.filter((record) => allowedWorkspaceIds.has(record.workspaceId));
  const ambiguousRecords = sourceRecords.filter((record) => isAmbiguousWorkspaceId(record.workspaceId));
  await upsertRecoveryItems(target, tableName, ambiguousRecords);
  const copiedCount = await putMissingById(
    target.table<DomainRecord, string>(tableName),
    attributableRecords,
  );
  return { sourceCount: attributableRecords.length, copiedCount };
}

export async function migrateLegacyData(
  source: FaderZeroDatabase,
  target: FaderZeroDatabase,
  userId: string,
  allowedWorkspaceIds: ReadonlySet<string>,
  options: LocalMigrationOptions = {},
): Promise<LocalMigrationReport> {
  await source.open();
  await target.open();

  const fingerprint = workspaceFingerprint(allowedWorkspaceIds);
  const previousJournal = await target.localMigrationJournal.get(MIGRATION_ID);
  if (previousJournal?.status === 'completed' && previousJournal.workspaceFingerprint === fingerprint) {
    return {
      databaseName: target.name,
      sourceCounts: previousJournal.sourceCounts,
      copiedCounts: previousJournal.copiedCounts,
      recoveryCount: previousJournal.recoveryCount,
      resumed: false,
    };
  }

  const canResume = Boolean(previousJournal && previousJournal.workspaceFingerprint === fingerprint);
  const timestamp = now();
  const journal: LocalMigrationJournalRecord = canResume
    ? { ...previousJournal!, status: 'in-progress', updatedAt: timestamp }
    : {
        id: MIGRATION_ID,
        userId,
        sourceDatabaseName: source.name,
        workspaceFingerprint: fingerprint,
        status: 'in-progress',
        completedTables: [],
        sourceCounts: {},
        copiedCounts: {},
        recoveryCount: 0,
        startedAt: timestamp,
        updatedAt: timestamp,
      };

  delete journal.errorMessage;
  await target.localMigrationJournal.put(journal);

  try {
    for (const tableName of ALL_MIGRATION_TABLES) {
      if (journal.completedTables.includes(tableName)) continue;
      const counts = await copyMigrationTable(source, target, tableName, allowedWorkspaceIds);
      journal.sourceCounts[tableName] = counts.sourceCount;
      journal.copiedCounts[tableName] = counts.copiedCount;
      journal.completedTables = [...journal.completedTables, tableName];
      journal.recoveryCount = await target.recoveryItems.where('status').equals('pending').count();
      journal.updatedAt = now();
      await target.localMigrationJournal.put(journal);
      await options.afterTable?.(tableName);
    }

    journal.status = 'completed';
    journal.completedAt = now();
    journal.updatedAt = journal.completedAt;
    await target.localMigrationJournal.put(journal);
  } catch (error) {
    journal.status = 'failed';
    journal.errorMessage = error instanceof Error ? error.message : 'Migration locale interrompue';
    journal.updatedAt = now();
    await target.localMigrationJournal.put(journal);
    throw error;
  }

  return {
    databaseName: target.name,
    sourceCounts: journal.sourceCounts,
    copiedCounts: journal.copiedCounts,
    recoveryCount: journal.recoveryCount,
    resumed: canResume,
  };
}

export async function activateUserData(userId: string, workspaceIds: Iterable<string>) {
  const allowedWorkspaceIds = new Set(workspaceIds);
  const expectedDatabaseName = getUserDatabaseName(userId);
  const current = getActiveDatabase();
  const target = current.name === expectedDatabaseName ? current : createDatabase(expectedDatabaseName);
  const report = await migrateLegacyData(getLegacyDatabase(), target, userId, allowedWorkspaceIds);
  const previous = getActiveDatabase();
  activateDatabase(target);
  if (previous !== getLegacyDatabase() && previous !== target) previous.close();
  return report;
}

export async function purgeWorkspaceData(workspaceId: string, database = getActiveDatabase()) {
  await database.transaction(
    'rw',
    [
      database.songs,
      database.setlists,
      database.setlistSongs,
      database.songAssets,
      database.syncQueue,
      database.syncConflicts,
      database.syncState,
    ],
    async () => {
      await Promise.all([
        database.songs.where('workspaceId').equals(workspaceId).delete(),
        database.setlists.where('workspaceId').equals(workspaceId).delete(),
        database.setlistSongs.where('workspaceId').equals(workspaceId).delete(),
        database.songAssets.where('workspaceId').equals(workspaceId).delete(),
        database.syncQueue.where('workspaceId').equals(workspaceId).delete(),
        database.syncConflicts.where('workspaceId').equals(workspaceId).delete(),
        database.syncState.where('workspaceId').equals(workspaceId).delete(),
      ]);
    },
  );
}

export async function purgeRevokedWorkspaceData(
  allowedWorkspaceIds: ReadonlySet<string>,
  database = getActiveDatabase(),
) {
  const workspaceIds = new Set<string>();
  for (const tableName of ALL_MIGRATION_TABLES) {
    const keys = await database.table(tableName).orderBy('workspaceId').uniqueKeys();
    for (const key of keys) {
      if (typeof key === 'string' && key !== 'default-workspace') workspaceIds.add(key);
    }
  }
  const revokedWorkspaceIds = [...workspaceIds].filter((workspaceId) => !allowedWorkspaceIds.has(workspaceId));
  for (const workspaceId of revokedWorkspaceIds) {
    await purgeWorkspaceData(workspaceId, database);
  }
  return revokedWorkspaceIds;
}

function tableForEntity(database: FaderZeroDatabase, entityType: LocalEntityType) {
  if (entityType === 'song') return database.songs;
  if (entityType === 'setlist') return database.setlists;
  if (entityType === 'setlistSong') return database.setlistSongs;
  return database.songAssets;
}

export async function recoverPendingItems(personalWorkspaceId: string, database = getActiveDatabase()) {
  const items = await database.recoveryItems.where('status').equals('pending').toArray();
  if (items.length === 0) return 0;

  const orderedItems = [...items].sort(
    (left, right) => DOMAIN_TABLES.indexOf(tableNameForEntity(left.entityType)) - DOMAIN_TABLES.indexOf(tableNameForEntity(right.entityType)),
  );

  await database.transaction(
    'rw',
    [
      database.songs,
      database.setlists,
      database.setlistSongs,
      database.songAssets,
      database.syncQueue,
      database.recoveryItems,
    ],
    async () => {
      for (const item of orderedItems) {
        const record = {
          ...structuredClone(item.payload),
          workspaceId: personalWorkspaceId,
          syncStatus: 'pending' as const,
        } as unknown as DomainRecord;
        delete record.serverVersion;
        await tableForEntity(database, item.entityType).put(record as never);
        const existingMutation = await database.syncQueue
          .where('entityId')
          .equals(item.entityId)
          .filter((mutation) => mutation.workspaceId === personalWorkspaceId && mutation.entityType === item.entityType)
          .first();
        if (!existingMutation) {
          await database.syncQueue.add({
            workspaceId: personalWorkspaceId,
            entityType: item.entityType,
            entityId: item.entityId,
            operation: 'create',
            payload: record,
            status: 'pending',
            queuedAt: now(),
          });
        }
        await database.recoveryItems.update(item.id, {
          status: 'recovered',
          recoveredAt: now(),
          recoveredWorkspaceId: personalWorkspaceId,
        });
      }
    },
  );
  return items.length;
}

function tableNameForEntity(entityType: LocalEntityType): DomainTableName {
  if (entityType === 'song') return 'songs';
  if (entityType === 'setlist') return 'setlists';
  if (entityType === 'setlistSong') return 'setlistSongs';
  return 'songAssets';
}

export async function getPendingRecoveryItems(database = getActiveDatabase()): Promise<RecoveryItemRecord[]> {
  return database.recoveryItems.where('status').equals('pending').toArray();
}
