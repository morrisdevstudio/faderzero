import { createId } from '@/lib/createId';
import { songAssetsRepository } from '@/db/repositories/songAssetsRepository';
import { createAudioSignedUrl, uploadAudioObject } from '@/services/audio/r2Client';
import { supabase } from '@/services/supabase/client';
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
}

export async function uploadSongAsset(
  workspaceId: string,
  songId: string | undefined,
  file: File,
  options: UploadSongAssetOptions = {}
): Promise<string> {
  const durationSeconds = await getAudioDurationSeconds(file);
  const uploadFile = await compressAudioForUpload(file, options.onProgress);
  const filename = buildCompressedFileName(options.filename ?? file.name);
  const assetId = createId();
  const storagePath = songId
    ? `workspaces/${workspaceId}/songs/${songId}/${assetId}.mp3`
    : `workspaces/${workspaceId}/imports/${assetId}.mp3`;
  const { data: reservationId, error: reservationError } = await supabase.rpc('reserve_audio_upload', {
    p_workspace_id: workspaceId,
    p_requested_bytes: uploadFile.size,
    p_requested_seconds: durationSeconds ?? null,
  });
  if (reservationError || typeof reservationId !== 'string') {
    throw reservationError ?? new Error('Reservation audio invalide.');
  }
  options.onProgress?.({ phase: 'upload', progress: 10, label: 'Envoi vers le stockage' });

  try {
    await uploadAudioObject(storagePath, uploadFile, reservationId);
  } catch (error) {
    await supabase.rpc('release_audio_upload_reservation', { p_reservation_id: reservationId });
    throw error;
  }
  options.onProgress?.({ phase: 'upload', progress: 88, label: "Finalisation de l'upload" });

  const { error: completionError } = await supabase.rpc('complete_audio_upload_reservation', {
    p_reservation_id: reservationId,
    p_storage_path: storagePath,
  });
  if (completionError) {
    throw completionError;
  }

  // 2. Création de l'enregistrement de métadonnées local (qui alimente la file syncQueue)
  await songAssetsRepository.create({
    id: assetId,
    ...(songId !== undefined ? { songId } : {}),
    storagePath,
    filename,
    mimeType: uploadFile.type || 'audio/mpeg',
    sizeBytes: uploadFile.size,
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
  });
  options.onProgress?.({ phase: 'upload', progress: 100, label: 'Upload termine' });

  return assetId;
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
  return createAudioSignedUrl(asset.storagePath);
}
