import { describe, expect, it, vi } from 'vitest';
import { linkStagedRecording } from './recordingWorkflow';

describe('linkStagedRecording', () => {
  it('links an uploaded asset to its destination song', async () => {
    const linkUploadedAsset = vi.fn().mockResolvedValue(undefined);
    const linkPendingUpload = vi.fn().mockResolvedValue(undefined);

    await linkStagedRecording(
      { status: 'uploaded', assetId: 'asset-1' },
      'song-1',
      { workspaceId: 'workspace-1', filename: 'Idee.mp3' },
      { linkUploadedAsset, linkPendingUpload }
    );

    expect(linkUploadedAsset).toHaveBeenCalledWith('asset-1', 'song-1');
    expect(linkPendingUpload).not.toHaveBeenCalled();
  });

  it('updates an offline upload while preserving its orphan fallback', async () => {
    const linkUploadedAsset = vi.fn().mockResolvedValue(undefined);
    const linkPendingUpload = vi.fn().mockResolvedValue(undefined);
    const fallback = { workspaceId: 'workspace-1', filename: 'Idee.mp3' };

    await linkStagedRecording(
      { status: 'queued', pendingUploadId: 'pending-1' },
      'song-1',
      fallback,
      { linkUploadedAsset, linkPendingUpload }
    );

    expect(linkPendingUpload).toHaveBeenCalledWith('pending-1', 'song-1', fallback);
    expect(linkUploadedAsset).not.toHaveBeenCalled();
  });
});
