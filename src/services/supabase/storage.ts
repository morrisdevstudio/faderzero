import { createId } from '@/lib/createId';
import { getActiveDatabase } from '@/db/db';
import { SongAssetsRepository, songAssetsRepository } from '@/db/repositories/songAssetsRepository';
import { createStorageReadUrl, uploadStorageObject } from '@/services/storage';
import {
  buildCompressedFileName,
  compressAudioForUpload,
  type AudioCompressionProgress,
} from '@/features/songs/audioCompression';

export type SongAssetUploadProgress =
  | AudioCompressionProgress
  | {
      phase: 'upload';
      progress: number;
      label: string;
    };

export interface UploadSongAssetOptions {
  onProgress?: (progress: SongAssetUploadProgress) => void;
  filename?: string;
  normalizePeak?: boolean;
  durationSeconds?: number;
  contentHash?: string;
  targetProviderId?: import('@/services/storage').StorageProviderId;
  resumeSessionId?: string;
  onStorageSession?: (session: import('@/services/storage').StorageUploadSession) => void | Promise<void>;
}

export async function uploadSongAsset(
  workspaceId: string,
  songId: string | undefined,
  file: File,
  options: UploadSongAssetOptions = {}
): Promise<string> {
  const database = getActiveDatabase();
  const durationSeconds = options.durationSeconds ?? await getAudioDurationSeconds(file);
  const uploadFile = await compressAudioForUpload(file, options.onProgress, {
    normalizePeak: options.normalizePeak ?? false,
  });
  const contentHash = options.contentHash ?? await sha256File(uploadFile);
  const filename = buildCompressedFileName(options.filename ?? file.name);
  const assetId = createId();
  const storagePath = songId
    ? `workspaces/${workspaceId}/songs/${songId}/${assetId}.mp3`
    : `workspaces/${workspaceId}/imports/${assetId}.mp3`;
  options.onProgress?.({ phase: 'upload', progress: 10, label: 'Envoi vers le stockage' });
  const location = await uploadStorageObject({
    workspaceId,
    logicalKey: storagePath,
    sizeBytes: uploadFile.size,
    mimeType: uploadFile.type || 'audio/mpeg',
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    contentHash,
    ...(options.targetProviderId ? { targetProviderId: options.targetProviderId } : {}),
    ...(options.resumeSessionId ? { resumeSessionId: options.resumeSessionId } : {}),
    ...(options.onStorageSession ? { onSessionCreated: options.onStorageSession } : {}),
  }, uploadFile);
  options.onProgress?.({ phase: 'upload', progress: 88, label: "Finalisation de l'upload" });

  // 2. Création de l'enregistrement de métadonnées local (qui alimente la file syncQueue)
  await new SongAssetsRepository(database).create({
    id: assetId,
    workspaceId,
    ...(songId !== undefined ? { songId } : {}),
    storagePath,
    ...(location?.storageObjectId ? { storageObjectId: location.storageObjectId } : {}),
    filename,
    mimeType: uploadFile.type || 'audio/mpeg',
    sizeBytes: uploadFile.size,
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    contentHash,
  });
  options.onProgress?.({ phase: 'upload', progress: 100, label: 'Upload termine' });

  return assetId;
}

async function sha256File(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function getAudioDurationSeconds(file: File): Promise<number | undefined> {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const duration = await new Promise<number | undefined>((resolve) => {
      const audio = document.createElement('audio');

      function cleanup() {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('error', handleError);
      }

      function handleLoadedMetadata() {
        cleanup();
        const nextDuration = Number.isFinite(audio.duration) ? Math.max(0, Math.round(audio.duration)) : undefined;
        resolve(nextDuration);
      }

      function handleError() {
        cleanup();
        resolve(undefined);
      }

      audio.preload = 'metadata';
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('error', handleError);
      audio.src = objectUrl;
    });

    return duration;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function getSongAssetPlaybackUrl(
  _workspaceId: string,
  assetId: string
): Promise<string> {
  const asset = await songAssetsRepository.getById(assetId);
  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  // Génération par le Worker d'une URL R2 signée temporaire (durée de cinq minutes)
  return createStorageReadUrl(asset.workspaceId, asset.storagePath);
}
