import type { FaderZeroDatabase } from '@/db/db';
import { db } from '@/db/db';
import type { PendingAudioUploadRecord } from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';
import { songAssetsRepository } from '@/db/repositories/songAssetsRepository';
import {
  uploadSongAsset,
  type SongAssetUploadProgress,
} from '@/services/supabase/storage';
import { isAppOnline } from '@/services/connectivity';

export type AudioUploadResult =
  | { status: 'uploaded'; assetId: string }
  | { status: 'queued'; pendingUploadId: string };

interface QueueAudioUploadInput {
  workspaceId: string;
  songId?: string;
  file: File;
  filename: string;
  normalizePeak?: boolean;
}

interface ProcessPendingUploadsOptions {
  database?: FaderZeroDatabase;
  upload?: typeof uploadSongAsset;
}

interface UploadOrQueueOptions {
  filename: string;
  normalizePeak?: boolean;
  onProgress?: (progress: SongAssetUploadProgress) => void;
  database?: FaderZeroDatabase;
  upload?: typeof uploadSongAsset;
  isOnline?: () => boolean;
}

const processingByWorkspace = new Map<string, Promise<void>>();

export async function queueAudioUpload(
  input: QueueAudioUploadInput,
  database: FaderZeroDatabase = db
): Promise<PendingAudioUploadRecord> {
  await ensureStorageCapacity(input.file.size);

  const duplicate = await database.pendingAudioUploads
    .where('workspaceId')
    .equals(input.workspaceId)
    .filter((item) => item.filename === input.filename)
    .first();
  if (duplicate) {
    throw new Error(`Une piste nommee ${input.filename} est deja en attente d'envoi.`);
  }

  const timestamp = now();
  const record: PendingAudioUploadRecord = {
    id: createId(),
    workspaceId: input.workspaceId,
    filename: input.filename,
    originalFilename: input.file.name,
    mimeType: input.file.type || 'application/octet-stream',
    sizeBytes: input.file.size,
    fileBlob: input.file.slice(0, input.file.size, input.file.type),
    status: 'pending',
    queuedAt: timestamp,
    updatedAt: timestamp,
  };
  if (input.songId !== undefined) {
    record.songId = input.songId;
  }
  if (input.normalizePeak === true) {
    record.normalizePeak = true;
  }

  try {
    await database.pendingAudioUploads.add(record);
  } catch (error) {
    if (isStorageQuotaError(error)) {
      throw new Error("L'appareil n'a pas assez d'espace pour conserver cet audio hors ligne.");
    }
    throw error;
  }

  void requestPersistentStorage();
  return record;
}

export async function uploadOrQueueSongAsset(
  workspaceId: string,
  songId: string | undefined,
  file: File,
  options: UploadOrQueueOptions
): Promise<AudioUploadResult> {
  const database = options.database ?? db;
  const upload = options.upload ?? uploadSongAsset;
  const isOnline = options.isOnline ?? isAppOnline;

  if (isOnline()) {
    try {
      const assetId = await upload(workspaceId, songId, file, {
        filename: options.filename,
        normalizePeak: options.normalizePeak ?? false,
        ...(options.onProgress ? { onProgress: options.onProgress } : {}),
      });
      return { status: 'uploaded', assetId };
    } catch (error) {
      if (!isNetworkUploadError(error, isOnline())) {
        throw error;
      }
    }
  }

  const pending = await queueAudioUpload(
    {
      workspaceId,
      ...(songId !== undefined ? { songId } : {}),
      file,
      filename: options.filename,
      normalizePeak: options.normalizePeak ?? false,
    },
    database
  );
  return { status: 'queued', pendingUploadId: pending.id };
}

export async function processPendingAudioUploads(
  workspaceId: string,
  options: ProcessPendingUploadsOptions = {}
): Promise<void> {
  const current = processingByWorkspace.get(workspaceId);
  if (current) {
    return current;
  }

  const processing = processPendingAudioUploadsInternal(workspaceId, options).finally(() => {
    processingByWorkspace.delete(workspaceId);
  });
  processingByWorkspace.set(workspaceId, processing);
  return processing;
}

async function processPendingAudioUploadsInternal(
  workspaceId: string,
  options: ProcessPendingUploadsOptions
): Promise<void> {
  const database = options.database ?? db;
  const upload = options.upload ?? uploadSongAsset;

  const interrupted = await database.pendingAudioUploads
    .where('workspaceId')
    .equals(workspaceId)
    .filter((item) => item.status === 'uploading')
    .toArray();
  await Promise.all(
    interrupted.map((item) =>
      database.pendingAudioUploads.update(item.id, {
        status: 'pending',
        updatedAt: now(),
      })
    )
  );

  const pending = await database.pendingAudioUploads
    .where('workspaceId')
    .equals(workspaceId)
    .filter((item) => item.status === 'pending')
    .sortBy('queuedAt');

  for (const item of pending) {
    if (!isAppOnline()) {
      return;
    }

    const triedAt = now();
    const claimed = await database.pendingAudioUploads.update(item.id, (record) => {
      if (record.status !== 'pending') {
        return false;
      }
      record.status = 'uploading';
      record.lastTriedAt = triedAt;
      record.updatedAt = triedAt;
      delete record.errorMessage;
    });
    if (claimed === 0) {
      continue;
    }

    try {
      const file = new File([item.fileBlob], item.originalFilename, { type: item.mimeType });
      await upload(item.workspaceId, item.songId, file, {
        filename: item.filename,
        normalizePeak: item.normalizePeak ?? false,
      });
      await database.pendingAudioUploads.delete(item.id);
    } catch (error) {
      const online = isAppOnline();
      const errorMessage = getErrorMessage(error);
      await database.pendingAudioUploads.update(item.id, {
        status: isNetworkUploadError(error, online) ? 'pending' : 'failed',
        errorMessage,
        lastTriedAt: triedAt,
        updatedAt: now(),
      });
      if (!online) {
        return;
      }
    }
  }
}

export async function retryPendingAudioUpload(id: string): Promise<void> {
  const item = await db.pendingAudioUploads.get(id);
  if (!item) return;
  await db.pendingAudioUploads.update(id, (record) => {
    record.status = 'pending';
    record.updatedAt = now();
    delete record.errorMessage;
  });
  if (isAppOnline()) {
    await processPendingAudioUploads(item.workspaceId);
  }
}

export async function removePendingAudioUpload(
  id: string,
  database: FaderZeroDatabase = db
): Promise<void> {
  await database.pendingAudioUploads.delete(id);
}

export async function linkPendingAudioUpload(
  id: string,
  songId: string,
  fallback?: { workspaceId: string; filename: string }
): Promise<void> {
  const updated = await db.pendingAudioUploads.update(id, {
    songId,
    updatedAt: now(),
  });
  if (updated > 0 || !fallback) return;

  const uploadedAsset = (await songAssetsRepository.listImportedTracks()).find(
    (asset) =>
      asset.workspaceId === fallback.workspaceId &&
      asset.filename === fallback.filename &&
      asset.songId === undefined
  );
  if (uploadedAsset) {
    await songAssetsRepository.linkToSong(uploadedAsset.id, songId);
  }
}

async function ensureStorageCapacity(requiredBytes: number): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return;
  const estimate = await navigator.storage.estimate().catch(() => null);
  if (
    estimate?.quota !== undefined &&
    estimate.usage !== undefined &&
    estimate.quota - estimate.usage < requiredBytes
  ) {
    throw new Error("L'appareil n'a pas assez d'espace pour conserver cet audio hors ligne.");
  }
}

async function requestPersistentStorage(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    await navigator.storage.persist().catch(() => false);
  }
}

function isNetworkUploadError(error: unknown, isOnline: boolean): boolean {
  if (!isOnline) return true;
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && (error.name === 'NetworkError' || error.name === 'AbortError')) {
    return true;
  }
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('failed to fetch') || message.includes('networkerror') || message.includes('network request failed');
}

function isStorageQuotaError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Impossible d'envoyer cette piste audio.";
}
