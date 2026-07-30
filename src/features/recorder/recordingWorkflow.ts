import { songAssetsRepository } from '@/db/repositories/songAssetsRepository';
import {
  linkPendingAudioUpload,
  type AudioUploadResult,
} from '@/services/audio/pendingUploads';

export type RecordingDestination =
  | { type: 'existingSong'; songId: string }
  | { type: 'newSong'; title: string }
  | { type: 'orphan' };

interface LinkStagedRecordingDependencies {
  linkUploadedAsset: (assetId: string, songId: string) => Promise<unknown>;
  linkPendingUpload: (
    pendingUploadId: string,
    songId: string,
    fallback: { workspaceId: string; filename: string }
  ) => Promise<void>;
}

const defaultDependencies: LinkStagedRecordingDependencies = {
  linkUploadedAsset: (assetId, songId) => songAssetsRepository.linkToSong(assetId, songId),
  linkPendingUpload: linkPendingAudioUpload,
};

export async function linkStagedRecording(
  uploadResult: AudioUploadResult,
  songId: string,
  fallback: { workspaceId: string; filename: string },
  dependencies: LinkStagedRecordingDependencies = defaultDependencies
): Promise<void> {
  if (uploadResult.status === 'uploaded') {
    await dependencies.linkUploadedAsset(uploadResult.assetId, songId);
    return;
  }

  await dependencies.linkPendingUpload(uploadResult.pendingUploadId, songId, fallback);
}
