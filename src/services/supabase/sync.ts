import { supabase } from './client';
import { db } from '@/db/db';
import { now } from '@/lib/now';
import type { SyncQueueItem } from '@/db/schema';
import {
  toDbSong,
  toLocalSong,
  toDbSetlist,
  toLocalSetlist,
  toDbSetlistSong,
  toLocalSetlistSong,
  toDbSongAsset,
  toLocalSongAsset,
  toDbEvent,
  toLocalEvent,
  mapTimestampToMs,
} from './mappers';

const ENTITY_CONFIGS = {
  song: {
    dbTable: 'songs',
    localTable: 'songs',
    toDb: toDbSong,
    toLocal: toLocalSong,
  },
  setlist: {
    dbTable: 'setlists',
    localTable: 'setlists',
    toDb: toDbSetlist,
    toLocal: toLocalSetlist,
  },
  setlistSong: {
    dbTable: 'setlist_songs',
    localTable: 'setlistSongs',
    toDb: toDbSetlistSong,
    toLocal: toLocalSetlistSong,
  },
  songAsset: {
    dbTable: 'song_assets',
    localTable: 'songAssets',
    toDb: toDbSongAsset,
    toLocal: toLocalSongAsset,
  },
  event: {
    dbTable: 'events',
    localTable: 'events',
    toDb: toDbEvent,
    toLocal: toLocalEvent,
  },
} as const;

const DEFAULT_RETRY_DELAY_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_PROCESSING_STALE_AFTER_MS = 30000;

export interface PushPendingMutationsOptions {
  includeFailed?: boolean;
  retryDelayMs?: number;
  maxRetries?: number;
  processingStaleAfterMs?: number;
}

export interface PushPendingMutationsReport {
  processedCount: number;
  failedCount: number;
  recoveredCount: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRemoteLogicalUpdatedAt(remoteRow: Record<string, unknown>) {
  return (
    mapTimestampToMs((remoteRow.client_updated_at as string | null | undefined) ?? null) ??
    mapTimestampToMs((remoteRow.updated_at as string | null | undefined) ?? null) ??
    0
  );
}

async function reviveStaleProcessingMutations(
  workspaceId: string,
  staleAfterMs: number
): Promise<number> {
  const cutoff = now() - staleAfterMs;
  const staleItems = await db.syncQueue
    .where('workspaceId')
    .equals(workspaceId)
    .filter(
      (item) =>
        item.status === 'processing' && (item.lastTriedAt === undefined || item.lastTriedAt <= cutoff)
    )
    .toArray();

  for (const item of staleItems) {
    await db.syncQueue.update(item.id!, {
      status: 'pending',
      errorMessage: 'Synchronisation interrompue. Nouvelle tentative programmee.',
    });
  }

  return staleItems.length;
}

async function fetchRemoteRow(tableName: string, entityId: string) {
  const { data, error } = await supabase.from(tableName).select('*').eq('id', entityId).maybeSingle();

  if (error) {
    throw error;
  }

  return data as Record<string, unknown> | null;
}

async function adoptRemoteRow(
  workspaceId: string,
  mutation: SyncQueueItem,
  remoteRow: Record<string, unknown>,
  config: (typeof ENTITY_CONFIGS)[SyncQueueItem['entityType']]
) {
  await db.table(config.localTable).put(config.toLocal(remoteRow as never));
  await db.syncQueue.delete(mutation.id!);
  await updateStateCheckpoint(workspaceId, config.localTable, Number(remoteRow.server_version));
}

async function applyMutation(
  workspaceId: string,
  mutation: SyncQueueItem,
  config: (typeof ENTITY_CONFIGS)[SyncQueueItem['entityType']]
) {
  const localTable = db.table(config.localTable);

  if (mutation.operation === 'create') {
    const localRecord = await localTable.get(mutation.entityId);
    if (!localRecord) {
      throw new Error(`Local record not found for create: ${mutation.entityType}/${mutation.entityId}`);
    }

    const dbPayload = config.toDb(localRecord as never) as Record<string, unknown>;
    const { data: remoteRow, error: insertError } = await supabase
      .from(config.dbTable)
      .insert(dbPayload)
      .select()
      .single();

    if (insertError) {
      const existingRemoteRow = await fetchRemoteRow(config.dbTable, mutation.entityId);
      if (existingRemoteRow) {
        await adoptRemoteRow(workspaceId, mutation, existingRemoteRow, config);
        return;
      }

      throw insertError;
    }

    await localTable.put(config.toLocal(remoteRow));
    await db.syncQueue.delete(mutation.id!);
    await updateStateCheckpoint(workspaceId, config.localTable, Number(remoteRow.server_version));
    return;
  }

  const remoteRow = await fetchRemoteRow(config.dbTable, mutation.entityId);

  if (!remoteRow) {
    await handleConflict(workspaceId, mutation, null);
    return;
  }

  const serverVersion = Number(remoteRow.server_version);
  const remoteLogicalUpdatedAt = getRemoteLogicalUpdatedAt(remoteRow);
  const localRecord = await localTable.get(mutation.entityId);

  if (!localRecord) {
    throw new Error(`Local record not found for update: ${mutation.entityType}/${mutation.entityId}`);
  }

  const localLogicalUpdatedAt =
    typeof (localRecord as { updatedAt?: unknown }).updatedAt === 'number'
      ? ((localRecord as { updatedAt: number }).updatedAt ?? 0)
      : 0;

  if (mutation.baseServerVersion !== undefined && mutation.baseServerVersion !== serverVersion) {
    if (localLogicalUpdatedAt <= remoteLogicalUpdatedAt) {
      await adoptRemoteRow(workspaceId, mutation, remoteRow, config);
      return;
    }
  }

  const dbPayload = config.toDb(localRecord as never) as Record<string, unknown>;
  const { data: updatedRow, error: updateError } = await supabase
    .from(config.dbTable)
    .update(dbPayload)
    .eq('id', mutation.entityId)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  await localTable.put(config.toLocal(updatedRow));
  await db.syncQueue.delete(mutation.id!);
  await updateStateCheckpoint(workspaceId, config.localTable, Number(updatedRow.server_version));
}

export async function pushPendingMutations(
  workspaceId: string,
  options: PushPendingMutationsOptions = {}
): Promise<PushPendingMutationsReport> {
  const includeFailed = options.includeFailed ?? false;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const processingStaleAfterMs = options.processingStaleAfterMs ?? DEFAULT_PROCESSING_STALE_AFTER_MS;
  const recoveredCount = await reviveStaleProcessingMutations(workspaceId, processingStaleAfterMs);

  const mutations = await db.syncQueue
    .where('workspaceId')
    .equals(workspaceId)
    .filter((item) => item.status === 'pending' || (includeFailed && item.status === 'failed'))
    .toArray();

  mutations.sort((a, b) => a.queuedAt - b.queuedAt);

  let processedCount = 0;
  let failedCount = 0;

  for (const mutation of mutations) {
    const config = ENTITY_CONFIGS[mutation.entityType];
    if (!config) continue;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        await db.syncQueue.update(mutation.id!, (item) => {
          item.status = 'processing';
          item.retryCount = attempt;
          item.lastTriedAt = now();
          delete item.errorMessage;
        });

        await applyMutation(workspaceId, mutation, config);
        processedCount += 1;
        break;
      } catch (err: any) {
        const errorMessage = err?.message || 'Unknown error';
        const isLastAttempt = attempt === maxRetries;
        console.error(`[Push Error] Mutation ${mutation.id} failed on attempt ${attempt}:`, err);

        if (isLastAttempt) {
          failedCount += 1;
          await db.syncQueue.update(mutation.id!, {
            status: 'failed',
            errorMessage,
            lastTriedAt: now(),
            retryCount: attempt,
          });
          break;
        }

        if (retryDelayMs > 0) {
          await sleep(retryDelayMs);
        }
      }
    }
  }

  return {
    processedCount,
    failedCount,
    recoveredCount,
  };
}

async function handleConflict(workspaceId: string, mutation: SyncQueueItem, remoteRecord: any) {
  const config = ENTITY_CONFIGS[mutation.entityType];
  const localRecord = await db.table(config.localTable).get(mutation.entityId);

  await db.transaction('rw', db.syncQueue, db.syncConflicts, db.table(config.localTable), async () => {
    await db.syncConflicts.put({
      id: mutation.entityId,
      workspaceId,
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      localRecord,
      remoteRecord,
      detectedAt: now(),
    });

    await db.syncQueue.update(mutation.id!, { status: 'conflict' });

    if (localRecord) {
      await db.table(config.localTable).update(mutation.entityId, { syncStatus: 'conflict' });
    }
  });
}

async function updateStateCheckpoint(workspaceId: string, tableName: string, serverVersion: number) {
  const stateKey = `${workspaceId}:${tableName}`;
  const existingState = await db.syncState.get(stateKey);
  const currentVersion = existingState ? existingState.lastPulledVersion : 0;

  if (serverVersion > currentVersion) {
    await db.syncState.put({
      id: stateKey,
      workspaceId,
      tableName,
      lastPulledVersion: serverVersion,
      lastPulledAt: now(),
    });
  }
}

export async function pullRemoteChanges(workspaceId: string): Promise<void> {
  for (const [, config] of Object.entries(ENTITY_CONFIGS)) {
    const stateKey = `${workspaceId}:${config.localTable}`;
    const state = await db.syncState.get(stateKey);
    const lastPulledVersion = state ? state.lastPulledVersion : 0;

    try {
      const { data: remoteRows, error: pullError } = await supabase
        .from(config.dbTable)
        .select('*')
        .eq('workspace_id', workspaceId)
        .gt('server_version', lastPulledVersion)
        .order('server_version', { ascending: true });

      if (pullError) throw pullError;

      if (remoteRows && remoteRows.length > 0) {
        await db.transaction('rw', db.table(config.localTable), db.syncState, async () => {
          let blockedVersion: number | null = null;

          for (const row of remoteRows) {
            const localRecord = config.toLocal(row);
            const existingLocal = await db.table(config.localTable).get(row.id);
            const serverVersion = Number(row.server_version);

            if (
              existingLocal &&
              (existingLocal.syncStatus === 'pending' || existingLocal.syncStatus === 'conflict')
            ) {
              blockedVersion = blockedVersion === null ? serverVersion : Math.min(blockedVersion, serverVersion);
              continue;
            }

            await db.table(config.localTable).put(localRecord);
          }

          const maxVersion = Math.max(...remoteRows.map((r) => Number(r.server_version)));
          const lastSafeVersion = blockedVersion === null ? maxVersion : blockedVersion - 1;

          if (lastSafeVersion <= lastPulledVersion) {
            return;
          }

          await db.syncState.put({
            id: stateKey,
            workspaceId,
            tableName: config.localTable,
            lastPulledVersion: lastSafeVersion,
            lastPulledAt: now(),
          });
        });
      }
    } catch (err) {
      console.error(`[Pull Error] Table ${config.localTable} failed:`, err);
      throw err;
    }
  }
}

export async function resolveConflict(conflictId: string, resolution: 'local' | 'remote'): Promise<void> {
  const conflict = await db.syncConflicts.get(conflictId);
  if (!conflict) return;

  const config = ENTITY_CONFIGS[conflict.entityType];
  if (!config) return;

  if (resolution === 'local') {
    await db.table(config.localTable).update(conflict.entityId, { syncStatus: 'pending' });

    const queueItem = await db.syncQueue
      .where('entityId')
      .equals(conflict.entityId)
      .filter((item) => item.entityType === conflict.entityType && item.status === 'conflict')
      .first();

    if (queueItem) {
      const updatePayload: any = { status: 'pending' };
      if (conflict.remoteRecord) {
        updatePayload.baseServerVersion = Number(conflict.remoteRecord.serverVersion);
      }
      await db.syncQueue.update(queueItem.id!, updatePayload);
    }
  } else {
    if (conflict.remoteRecord) {
      await db.table(config.localTable).put(conflict.remoteRecord);
    } else {
      await db.table(config.localTable).delete(conflict.entityId);
    }

    const queueItem = await db.syncQueue
      .where('entityId')
      .equals(conflict.entityId)
      .filter((item) => item.entityType === conflict.entityType && item.status === 'conflict')
      .first();

    if (queueItem) {
      await db.syncQueue.delete(queueItem.id!);
    }
  }

  await db.syncConflicts.delete(conflictId);
}

