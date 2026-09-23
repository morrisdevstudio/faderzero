import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  compressAudioForUpload: vi.fn(),
  createAsset: vi.fn(),
  createStorageReadUrl: vi.fn(),
  getActiveDatabase: vi.fn(),
  repositoryDatabases: [] as unknown[],
  uploadStorageObject: vi.fn(),
}));

vi.mock('@/lib/createId', () => ({ createId: () => 'asset-1' }));
vi.mock('@/db/db', () => ({
  getActiveDatabase: mocks.getActiveDatabase,
}));
vi.mock('@/db/repositories/songAssetsRepository', () => ({
  SongAssetsRepository: class {
    constructor(database: unknown) {
      mocks.repositoryDatabases.push(database);
    }

    create = mocks.createAsset;
  },
  songAssetsRepository: { create: mocks.createAsset },
}));
vi.mock('@/services/storage', () => ({
  createStorageReadUrl: mocks.createStorageReadUrl,
  uploadStorageObject: mocks.uploadStorageObject,
}));
vi.mock('@/features/songs/audioCompression', () => ({
  buildCompressedFileName: (filename: string) => filename.replace(/\.[^.]+$/, '.mp3'),
  compressAudioForUpload: mocks.compressAudioForUpload,
}));

import { uploadSongAsset } from './storage';

describe('uploadSongAsset storage provider flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.repositoryDatabases.length = 0;
    mocks.getActiveDatabase.mockReturnValue({ name: 'database-a' });
    mocks.uploadStorageObject.mockResolvedValue(undefined);
    mocks.compressAudioForUpload.mockResolvedValue(
      new File(['compressed'], 'track.mp3', { type: 'audio/mpeg' })
    );
    mocks.createAsset.mockResolvedValue({ id: 'asset-1' });
    mockAudioDuration(120);
  });

  it('uploads through the workspace provider before creating local metadata', async () => {
    await expect(
      uploadSongAsset('workspace-1', 'song-1', new File(['source'], 'track.wav'))
    ).resolves.toBe('asset-1');

    expect(mocks.uploadStorageObject).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      logicalKey: 'workspaces/workspace-1/songs/song-1/asset-1.mp3',
      sizeBytes: 10,
      mimeType: 'audio/mpeg',
      durationSeconds: 120,
      contentHash: expect.any(String),
    }, expect.any(File));
    expect(mocks.createAsset).toHaveBeenCalledOnce();
    expect(mocks.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'workspace-1' })
    );
    expect(mocks.uploadStorageObject.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createAsset.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(mocks.compressAudioForUpload).toHaveBeenCalledWith(
      expect.any(File),
      undefined,
      { normalizePeak: false }
    );
  });

  it('keeps the original database and workspace when the active context changes during upload', async () => {
    const originalDatabase = { name: 'database-a' };
    const nextDatabase = { name: 'database-b' };
    mocks.getActiveDatabase.mockReturnValue(originalDatabase);
    mocks.uploadStorageObject.mockImplementationOnce(async () => {
      mocks.getActiveDatabase.mockReturnValue(nextDatabase);
    });

    await uploadSongAsset('workspace-1', undefined, new File(['source'], 'voice.webm'), {
      durationSeconds: 6,
    });

    expect(mocks.getActiveDatabase).toHaveBeenCalledOnce();
    expect(mocks.repositoryDatabases).toEqual([originalDatabase]);
    expect(mocks.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        storagePath: 'workspaces/workspace-1/imports/asset-1.mp3',
      })
    );
  });

  it('forwards peak normalization to MP3 conversion', async () => {
    await uploadSongAsset('workspace-1', undefined, new File(['source'], 'voice.webm'), {
      normalizePeak: true,
    });

    expect(mocks.compressAudioForUpload).toHaveBeenCalledWith(
      expect.any(File),
      undefined,
      { normalizePeak: true }
    );
  });

  it('uses a known recorder duration when WebM metadata is unavailable', async () => {
    await uploadSongAsset('workspace-1', undefined, new File(['source'], 'voice.webm'), {
      durationSeconds: 6,
    });

    expect(mocks.uploadStorageObject).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'workspace-1', sizeBytes: 10, durationSeconds: 6 }),
      expect.any(File),
    );
    expect(mocks.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: 6 })
    );
  });

  it('does not create metadata when the provider upload fails', async () => {
    mocks.uploadStorageObject.mockRejectedValueOnce(new Error('R2 unavailable'));

    await expect(
      uploadSongAsset('workspace-1', undefined, new File(['source'], 'track.wav'))
    ).rejects.toThrow('R2 unavailable');

    expect(mocks.createAsset).not.toHaveBeenCalled();
  });

  it('does not create metadata when the provider rejects its reservation', async () => {
    mocks.uploadStorageObject.mockRejectedValueOnce(new Error('audio quota exceeded'));

    await expect(
      uploadSongAsset('workspace-1', undefined, new File(['source'], 'track.wav'))
    ).rejects.toThrow('audio quota exceeded');

    expect(mocks.uploadStorageObject).toHaveBeenCalledOnce();
    expect(mocks.createAsset).not.toHaveBeenCalled();
  });
});

function mockAudioDuration(duration: number) {
  const listeners = new Map<string, EventListener>();
  const audio = {
    duration,
    preload: '',
    addEventListener: (name: string, listener: EventListener) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
    set src(_value: string) {
      queueMicrotask(() => listeners.get('loadedmetadata')?.(new Event('loadedmetadata')));
    },
  } as unknown as HTMLAudioElement;

  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-audio');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(document, 'createElement').mockReturnValue(audio);
}
