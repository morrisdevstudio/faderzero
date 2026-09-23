import { describe, expect, it, vi } from 'vitest';
import { assertStorageCapability, type StorageCapability, type StorageProvider } from './types';
import { storageProviderCatalog } from './providerCatalog';

function fakeProvider(): StorageProvider {
  return {
    id: 'webdav',
    capabilities: new Set(['resumable_upload', 'read', 'download', 'delete', 'quota', 'health']),
    createUploadSession: vi.fn(async (request) => ({ providerId: 'webdav' as const, sessionId: 'session-1', workspaceId: request.workspaceId, logicalKey: request.logicalKey })),
    upload: vi.fn(async () => ({ physicalIdentifier: 'physical-1' })),
    finalizeUpload: vi.fn(async () => ({ providerId: 'webdav' as const, physicalKey: 'physical-1', storageObjectId: 'object-1' })),
    abortUpload: vi.fn(async () => undefined),
    createReadUrl: vi.fn(async () => 'https://storage.example/read'),
    createDownloadUrl: vi.fn(async () => 'https://storage.example/download'),
    deleteObject: vi.fn(async () => undefined),
    getQuota: vi.fn(async () => ({ unit: 'bytes' as const, usedAmount: 1, reservedAmount: 0, limitAmount: 10, remainingAmount: 9 })),
    checkHealth: vi.fn(async () => true),
  };
}

describe('storage provider contract', () => {
  it('supports the complete workflow without feature-specific code', async () => {
    const provider = fakeProvider();
    const request = { workspaceId: 'workspace-1', logicalKey: 'workspaces/workspace-1/imports/a.mp3', sizeBytes: 5, mimeType: 'audio/mpeg' };
    const session = await provider.createUploadSession(request);
    const receipt = await provider.upload(session, new Blob(['audio']));
    await expect(provider.finalizeUpload(session, receipt, request)).resolves.toMatchObject({ storageObjectId: 'object-1' });
    await expect(provider.createReadUrl(request.workspaceId, request.logicalKey)).resolves.toContain('/read');
    await expect(provider.createDownloadUrl(request.workspaceId, request.logicalKey)).resolves.toContain('/download');
    await expect(provider.deleteObject(request.workspaceId, request.logicalKey)).resolves.toBeUndefined();
    await expect(provider.getQuota(request.workspaceId)).resolves.toMatchObject({ remainingAmount: 9 });
    await expect(provider.checkHealth()).resolves.toBe(true);
  });

  it('declares future providers without activating them', () => {
    expect(storageProviderCatalog.filter((provider) => !provider.available).map((provider) => provider.id)).toEqual(['dropbox', 'onedrive', 'webdav']);
  });

  it('returns the common error for a missing capability', () => {
    const provider = { ...fakeProvider(), capabilities: new Set<StorageCapability>() };
    expect(() => assertStorageCapability(provider, 'delete')).toThrow(expect.objectContaining({ code: 'capability_unavailable', providerId: 'webdav' }));
  });
});
