import type { FaderZeroDatabase } from './db';
import type { SyncQueueItem } from './schema';
import { now } from '@/lib/now';

export async function enqueueMutation(
  database: FaderZeroDatabase,
  workspaceId: string,
  entityType: SyncQueueItem['entityType'],
  entityId: string,
  operation: SyncQueueItem['operation'],
  payload: any,
  baseServerVersion?: number
): Promise<'queued' | 'removed_from_queue' | 'updated'> {
  const timestamp = now();

  const existing = await database.syncQueue
    .where('entityId')
    .equals(entityId)
    .filter(
      (item) =>
        item.entityType === entityType &&
        item.workspaceId === workspaceId &&
        (item.status === 'pending' || item.status === 'failed')
    )
    .first();

  if (existing) {
    if (operation === 'soft_delete') {
      if (existing.operation === 'create') {
        await database.syncQueue.delete(existing.id!);
        return 'removed_from_queue';
      }

      await database.syncQueue.update(existing.id!, (item) => {
        item.operation = 'soft_delete';
        item.payload = { ...existing.payload, ...payload };
        item.queuedAt = timestamp;
        item.retryCount = 0;
        item.status = 'pending';
        delete item.errorMessage;
        delete item.lastTriedAt;
      });
      return 'updated';
    }

    if (operation === 'update') {
      await database.syncQueue.update(existing.id!, (item) => {
        item.payload = { ...existing.payload, ...payload };
        item.queuedAt = timestamp;
        item.retryCount = 0;
        item.status = 'pending';
        delete item.errorMessage;
        delete item.lastTriedAt;
      });
      return 'updated';
    }
  }

  const item: SyncQueueItem = {
    workspaceId,
    entityType,
    entityId,
    operation,
    payload,
    status: 'pending',
    queuedAt: timestamp,
  };

  if (baseServerVersion !== undefined) {
    item.baseServerVersion = baseServerVersion;
  }

  await database.syncQueue.add(item);
  return 'queued';
}
