import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  compressAudioForUpload: vi.fn(),
  createAsset: vi.fn(),
  rpc: vi.fn(),
  uploadAudioObject: vi.fn(),
}));

vi.mock('@/lib/createId', () => ({ createId: () => 'asset-1' }));
vi.mock('@/db/repositories/songAssetsRepository', () => ({
  songAssetsRepository: { create: mocks.createAsset },
}));
vi.mock('@/services/audio/r2Client', () => ({
  createAudioSignedUrl: vi.fn(),
  uploadAudioObject: mocks.uploadAudioObject,
}));
vi.mock('@/services/supabase/client', () => ({
  supabase: { rpc: mocks.rpc },
}));
vi.mock('@/features/songs/audioCompression', () => ({
  buildCompressedFileName: (filename: string) => filename.replace(/\.[^.]+$/, '.mp3'),
  compressAudioForUpload: mocks.compressAudioForUpload,
}));

import { uploadSongAsset } from './storage';

describe('uploadSongAsset quota reservation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.compressAudioForUpload.mockResolvedValue(
      new File(['compressed'], 'track.mp3', { type: 'audio/mpeg' })
    );
    mocks.createAsset.mockResolvedValue({ id: 'asset-1' });
    mockAudioDuration(120);
  });

  it('reserves quota, uploads, then finalizes before creating local metadata', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: 'reservation-1', error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(
      uploadSongAsset('workspace-1', 'song-1', new File(['source'], 'track.wav'))
    ).resolves.toBe('asset-1');

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'reserve_audio_upload', {
      p_workspace_id: 'workspace-1',
      p_requested_bytes: 10,
      p_requested_seconds: 120,
    });
    expect(mocks.uploadAudioObject).toHaveBeenCalledWith(
      'workspaces/workspace-1/songs/song-1/asset-1.mp3',
      expect.any(File),
      'reservation-1'
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'complete_audio_upload_reservation', {
      p_reservation_id: 'reservation-1',
      p_storage_path: 'workspaces/workspace-1/songs/song-1/asset-1.mp3',
    });
    expect(mocks.createAsset).toHaveBeenCalledOnce();
    expect(mocks.rpc.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.createAsset.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });

  it('releases the reservation when the R2 upload fails', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: 'reservation-1', error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    mocks.uploadAudioObject.mockRejectedValueOnce(new Error('R2 unavailable'));

    await expect(
      uploadSongAsset('workspace-1', undefined, new File(['source'], 'track.wav'))
    ).rejects.toThrow('R2 unavailable');

    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'release_audio_upload_reservation', {
      p_reservation_id: 'reservation-1',
    });
    expect(mocks.createAsset).not.toHaveBeenCalled();
  });

  it('does not upload when the quota reservation is rejected', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error('audio quota exceeded') });

    await expect(
      uploadSongAsset('workspace-1', undefined, new File(['source'], 'track.wav'))
    ).rejects.toThrow('audio quota exceeded');

    expect(mocks.uploadAudioObject).not.toHaveBeenCalled();
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
