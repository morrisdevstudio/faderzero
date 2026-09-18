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
  toDbPersonalContact, toLocalPersonalContact, toDbWorkspaceContact, toLocalWorkspaceContact, toDbEventContact, toLocalEventContact,
  toDbBookingLead, toLocalBookingLead, toDbBookingNote, toLocalBookingNote, toDbBookingLeadContact, toLocalBookingLeadContact,
  toDbSongTimeline, toLocalSongTimeline, toDbTimelineSection, toLocalTimelineSection,
  mapTimestampToMs,
} from './mappers';

const ENTITY_CONFIGS = {
  song: {
    dbTable: 'songs',
    localTable: 'songs',
    toDb: toDbSong,
    toLocal: toLocalSong,
    scope: 'workspace',
  },
  setlist: {
    dbTable: 'setlists',
    localTable: 'setlists',
    toDb: toDbSetlist,
    toLocal: toLocalSetlist,
    scope: 'workspace',
  },
  setlistSong: {
    dbTable: 'setlist_songs',
    localTable: 'setlistSongs',
    toDb: toDbSetlistSong,
    toLocal: toLocalSetlistSong,
    scope: 'workspace',
  },
  songAsset: {
    dbTable: 'song_assets',
    localTable: 'songAssets',
    toDb: toDbSongAsset,
    toLocal: toLocalSongAsset,
    scope: 'workspace',
  },
  songTimeline: {
    dbTable: 'song_timelines', localTable: 'songTimelines',
    toDb: toDbSongTimeline, toLocal: toLocalSongTimeline, scope: 'workspace',
  },
  timelineSection: {
    dbTable: 'timeline_sections', localTable: 'timelineSections',
    toDb: toDbTimelineSection, toLocal: toLocalTimelineSection, scope: 'workspace',
  },
  event: {
    dbTable: 'events',
    localTable: 'events',
    toDb: toDbEvent,
    toLocal: toLocalEvent,
    scope: 'workspace',
  },
  eventContact: { dbTable: 'event_contacts', localTable: 'eventContacts', toDb: toDbEventContact, toLocal: toLocalEventContact, scope: 'workspace' },
  personalContact: { dbTable: 'personal_contacts', localTable: 'personalContacts', toDb: toDbPersonalContact, toLocal: toLocalPersonalContact, scope: 'owner' },
  workspaceContact: { dbTable: 'workspace_contacts', localTable: 'workspaceContacts', toDb: toDbWorkspaceContact, toLocal: toLocalWorkspaceContact, scope: 'workspace' },
  bookingLead: { dbTable: 'booking_leads', localTable: 'bookingLeads', toDb: toDbBookingLead, toLocal: toLocalBookingLead, scope: 'workspace' },
  bookingNote: { dbTable: 'booking_notes', localTable: 'bookingNotes', toDb: toDbBookingNote, toLocal: toLocalBookingNote, scope: 'workspace' },
  bookingLeadContact: { dbTable: 'booking_lead_contacts', localTable: 'bookingLeadContacts', toDb: toDbBookingLeadContact, toLocal: toLocalBookingLeadContact, scope: 'workspace' },
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

async function hasUnresolvedCreateDependency(mutation: SyncQueueItem): Promise<boolean> {
  const dependencies: Array<{ entityType: SyncQueueItem['entityType']; entityId: string }> = [];
  if (mutation.entityType === 'bookingLeadContact') {
    dependencies.push(
      { entityType: 'bookingLead', entityId: String(mutation.payload.leadId) },
      { entityType: 'workspaceContact', entityId: String(mutation.payload.contactId) },
    );
  } else if (mutation.entityType === 'bookingNote') {
    dependencies.push({ entityType: 'bookingLead', entityId: String(mutation.payload.leadId) });
  } else if (mutation.entityType === 'eventContact') {
    dependencies.push(
      { entityType: 'event', entityId: String(mutation.payload.eventId) },
      { entityType: 'workspaceContact', entityId: String(mutation.payload.contactId) },
    );
  } else if (mutation.entityType === 'songTimeline') {
    dependencies.push({ entityType: 'song', entityId: String(mutation.payload.songId) });
  } else if (mutation.entityType === 'timelineSection') {
    dependencies.push({ entityType: 'songTimeline', entityId: String(mutation.payload.timelineId) });
  }

  for (const dependency of dependencies) {
    const pendingParent = await db.syncQueue
      .where('entityId')
      .equals(dependency.entityId)
      .filter((item) => item.workspaceId === mutation.workspaceId && item.entityType === dependency.entityType && item.operation === 'create')
      .first();
    if (pendingParent) return true;
  }
  return false;
}

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === '23505' || /duplicate key value violates unique constraint/i.test(error.message ?? '');
}

function readSongId(record: unknown) {
  if (!record || typeof record !== 'object') return undefined;
  const songId = (record as { songId?: unknown }).songId;
  return typeof songId === 'string' ? songId : undefined;
}

async function fetchRemoteRow(tableName: string, entityId: string) {
  const { data, error } = await supabase.from(tableName).select('*').eq('id', entityId).maybeSingle();

  if (error) {
    throw error;
  }

  return data as Record<string, unknown> | null;
}

async function fetchRemoteSongTimelineBySongId(songId: string, workspaceId: string) {
  const { data, error } = await supabase
    .from('song_timelines')
    .select('*')
    .eq('song_id', songId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Record<string, unknown> | null;
}

async function adoptRemoteRow(
  mutation: SyncQueueItem,
  remoteRow: Record<string, unknown>,
  config: (typeof ENTITY_CONFIGS)[SyncQueueItem['entityType']]
) {
  await commitRemoteMutation(mutation, remoteRow, config);
}

async function adoptExistingSongTimelineForSong(
  mutation: SyncQueueItem,
  remoteRow: Record<string, unknown>,
  config: (typeof ENTITY_CONFIGS)['songTimeline'],
) {
  const remoteTimeline = config.toLocal(remoteRow as never);
  const localId = mutation.entityId;
  const remoteId = remoteTimeline.id;

  await db.transaction('rw', db.syncQueue, db.songTimelines, db.timelineSections, async () => {
    if (localId !== remoteId) {
      const localSections = await db.timelineSections.where('timelineId').equals(localId).toArray();
      const sectionIds = new Set(localSections.map((section) => section.id));
      if (localSections.length > 0) {
        await db.timelineSections.bulkDelete(localSections.map((section) => section.id));
      }
      await db.songTimelines.delete(localId);
      const queued = await db.syncQueue.where('workspaceId').equals(mutation.workspaceId).toArray();
      for (const item of queued) {
        if (item.id === mutation.id) continue;
        if (item.entityType === 'timelineSection' && sectionIds.has(item.entityId)) {
          await db.syncQueue.delete(item.id!);
        }
      }
    }
    if (!(await hasFollowUpMutation(mutation))) {
      await db.songTimelines.put(remoteTimeline);
    }
    await db.syncQueue.delete(mutation.id!);
  });
}

async function hasFollowUpMutation(mutation: SyncQueueItem) {
  return db.syncQueue
    .where('entityId')
    .equals(mutation.entityId)
    .filter(
      (item) =>
        item.id !== mutation.id &&
        item.workspaceId === mutation.workspaceId &&
        item.entityType === mutation.entityType &&
        (item.status === 'pending' || item.status === 'failed'),
    )
    .first();
}

async function commitRemoteMutation(
  mutation: SyncQueueItem,
  remoteRow: Record<string, unknown>,
  config: (typeof ENTITY_CONFIGS)[SyncQueueItem['entityType']],
) {
  const localTable = db.table(config.localTable);

  await db.transaction('rw', db.syncQueue, localTable, async () => {
    // A local edit can occur while the request is in flight. Its queued
    // follow-up is authoritative until it has been sent in a later cycle.
    if (!(await hasFollowUpMutation(mutation))) {
      await localTable.put(config.toLocal(remoteRow as never));
    }
    await db.syncQueue.delete(mutation.id!);
  });
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
        await adoptRemoteRow(mutation, existingRemoteRow, config);
        return;
      }

      if (mutation.entityType === 'songTimeline' && isUniqueViolation(insertError)) {
        const songId = readSongId(localRecord);
        if (songId) {
          const existingBySong = await fetchRemoteSongTimelineBySongId(songId, mutation.workspaceId);
          if (existingBySong) {
            await adoptExistingSongTimelineForSong(mutation, existingBySong, ENTITY_CONFIGS.songTimeline);
            return;
          }
        }
      }

      throw insertError;
    }

    await commitRemoteMutation(mutation, remoteRow, config);
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
      await adoptRemoteRow(mutation, remoteRow, config);
      return;
    }
  }

  const dbPayload = config.toDb(localRecord as never) as Record<string, unknown>;
  const { data: updatedRow, error: updateError } = await supabase
    .from(config.dbTable)
    .update(dbPayload)
    .eq('id', mutation.entityId)
    .eq('server_version', serverVersion)
    .select()
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!updatedRow) {
    await handleConflict(workspaceId, mutation, await fetchRemoteRow(config.dbTable, mutation.entityId));
    return;
  }

  await commitRemoteMutation(mutation, updatedRow, config);
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

  const createDependencyOrder: Partial<Record<SyncQueueItem['entityType'], number>> = {
    song: 0,
    songTimeline: 1,
    timelineSection: 2,
    workspaceContact: 0,
    bookingLead: 1,
    bookingLeadContact: 2,
    bookingNote: 2,
    eventContact: 2,
  };
  const deleteDependencyOrder: Partial<Record<SyncQueueItem['entityType'], number>> = {
    timelineSection: 0,
    songTimeline: 1,
    bookingLeadContact: 0,
    eventContact: 0,
    workspaceContact: 1,
  };
  mutations.sort((a, b) => {
    const chronologicalOrder = a.queuedAt - b.queuedAt;
    if (chronologicalOrder !== 0) return chronologicalOrder;
    if (a.operation === 'create' && b.operation === 'create') {
      return (createDependencyOrder[a.entityType] ?? 1) - (createDependencyOrder[b.entityType] ?? 1);
    }
    if (a.operation === 'soft_delete' && b.operation === 'soft_delete') {
      return (deleteDependencyOrder[a.entityType] ?? 1) - (deleteDependencyOrder[b.entityType] ?? 1);
    }
    return 0;
  });

  let processedCount = 0;
  let failedCount = 0;

  for (const mutation of mutations) {
    const config = ENTITY_CONFIGS[mutation.entityType];
    if (!config) continue;
    if (!(await db.syncQueue.get(mutation.id!))) continue;
    if (mutation.operation === 'create' && await hasUnresolvedCreateDependency(mutation)) continue;

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
  const localRemoteRecord = remoteRecord ? config.toLocal(remoteRecord) : null;

  await db.transaction('rw', db.syncQueue, db.syncConflicts, db.table(config.localTable), async () => {
    await db.syncConflicts.put({
      id: mutation.entityId,
      workspaceId,
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      localRecord,
      remoteRecord: localRemoteRecord,
      detectedAt: now(),
    });

    await db.syncQueue.update(mutation.id!, { status: 'conflict' });

    if (localRecord) {
      await db.table(config.localTable).update(mutation.entityId, { syncStatus: 'conflict' });
    }
  });
}

export async function pullRemoteChanges(workspaceId: string): Promise<void> {
  for (const [, config] of Object.entries(ENTITY_CONFIGS)) {
    const isUserScope = workspaceId.startsWith('user:');
    if ((config.scope === 'owner') !== isUserScope) continue;
    const stateKey = `${workspaceId}:${config.localTable}`;
    const state = await db.syncState.get(stateKey);
    const lastPulledVersion = state ? state.lastPulledVersion : 0;

    try {
      const scopeId = config.scope === 'owner' ? workspaceId.replace(/^user:/, '') : workspaceId;
      const scopeColumn = config.scope === 'owner' ? 'owner_id' : 'workspace_id';
      const { data: remoteRows, error: pullError } = await supabase
        .from(config.dbTable)
        .select('*')
        .eq(scopeColumn, scopeId)
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

export async function syncPersonalContacts(ownerId: string): Promise<void> {
  const scope = `user:${ownerId}`;
  await pushPendingMutations(scope);
  await pullRemoteChanges(scope);
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

