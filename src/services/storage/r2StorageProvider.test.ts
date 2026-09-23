import { describe, expect, it, vi } from 'vitest';
import { createR2StorageProvider } from './r2StorageProvider';

function createDependencies() {
  return {
    reserveUpload: vi.fn(async () => 'reservation-1'),
    uploadObject: vi.fn(async () => undefined),
    completeUpload: vi.fn(async () => undefined),
    releaseUpload: vi.fn(async () => undefined),
    createReadUrl: vi.fn(async () => 'https://audio.example/signed'),
    getQuota: vi.fn(async () => ({
      unit: 'seconds' as const,
      usedAmount: 12,
      reservedAmount: 3,
      limitAmount: 60,
      remainingAmount: 45,
      percentUsed: 25,
    })),
    checkHealth: vi.fn(async () => true),
  };
}

describe('R2 storage provider', () => {
  it('creates, uploads and finalizes a common storage session', async () => {
    const dependencies = createDependencies();
    const provider = createR2StorageProvider(dependencies);
    const body = new Blob(['audio'], { type: 'audio/mpeg' });
    const session = await provider.createUploadSession({
      workspaceId: 'workspace-1',
      logicalKey: 'workspaces/workspace-1/imports/asset.mp3',
      sizeBytes: body.size,
      mimeType: body.type,
      durationSeconds: 42,
    });

    await provider.upload(session, body);
    await expect(provider.finalizeUpload(session)).resolves.toEqual({
      providerId: 'faderzero_r2',
      physicalKey: 'workspaces/workspace-1/imports/asset.mp3',
    });

    expect(dependencies.reserveUpload).toHaveBeenCalledWith('workspace-1', body.size, 42);
    expect(dependencies.uploadObject).toHaveBeenCalledWith(session.logicalKey, body, 'reservation-1');
    expect(dependencies.completeUpload).toHaveBeenCalledWith('reservation-1', session.logicalKey);
  });

  it('releases an aborted reservation', async () => {
    const dependencies = createDependencies();
    const provider = createR2StorageProvider(dependencies);
    const session = await provider.createUploadSession({
      workspaceId: 'workspace-1',
      logicalKey: 'workspaces/workspace-1/imports/asset.mp3',
      sizeBytes: 10,
      mimeType: 'audio/mpeg',
    });

    await provider.abortUpload(session);

    expect(dependencies.releaseUpload).toHaveBeenCalledWith('reservation-1');
  });

  it('surfaces unsupported capabilities through the shared error contract', async () => {
    const provider = createR2StorageProvider(createDependencies());

    await expect(provider.deleteObject('workspace-1', 'asset.mp3')).rejects.toMatchObject({
      code: 'capability_unavailable',
      providerId: 'faderzero_r2',
    });
  });
});
