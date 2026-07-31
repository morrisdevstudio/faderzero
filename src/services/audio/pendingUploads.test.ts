import { describe, expect, it, vi } from 'vitest';
import { createTestDatabase, destroyTestDatabase } from '@/test/dbTestUtils';
import {
  processPendingAudioUploads,
  queueAudioUpload,
  removePendingAudioUpload,
  uploadOrQueueSongAsset,
} from '@/services/audio/pendingUploads';
import { setForcedOffline } from '@/services/connectivity';

describe('pending audio uploads', () => {
  it('stores an offline file and preserves its target song', async () => {
    const database = await createTestDatabase('pending-audio-offline');
    const file = new File(['audio-source'], 'take.wav', { type: 'audio/wav' });

    const result = await uploadOrQueueSongAsset('workspace-1', 'song-1', file, {
      filename: 'take.mp3',
      normalizePeak: true,
      durationSeconds: 6,
      database,
      isOnline: () => false,
      upload: vi.fn(),
    });

    expect(result.status).toBe('queued');
    const queued = await database.pendingAudioUploads.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      workspaceId: 'workspace-1',
      songId: 'song-1',
      filename: 'take.mp3',
      originalFilename: 'take.wav',
      sizeBytes: 12,
      status: 'pending',
      normalizePeak: true,
      durationSeconds: 6,
    });
    expect(queued[0]!.fileBlob).toBeDefined();

    await destroyTestDatabase(database);
  });

  it('queues an audio file without attempting upload while offline is forced', async () => {
    const database = await createTestDatabase('pending-audio-forced-offline');
    const upload = vi.fn();
    setForcedOffline(true);

    const result = await uploadOrQueueSongAsset(
      'workspace-forced-offline',
      'song-forced-offline',
      new File(['audio-source'], 'take.wav', { type: 'audio/wav' }),
      { filename: 'take.mp3', database, upload },
    );

    expect(result.status).toBe('queued');
    expect(upload).not.toHaveBeenCalled();

    setForcedOffline(false);
    await destroyTestDatabase(database);
  });

  it('uploads queued files once in creation order and removes them after success', async () => {
    const database = await createTestDatabase('pending-audio-retry');
    const interrupted = await queueAudioUpload(
      {
        workspaceId: 'workspace-2',
        file: new File(['first'], 'first.wav', { type: 'audio/wav' }),
        filename: 'first.mp3',
      },
      database
    );
    await database.pendingAudioUploads.update(interrupted.id, { status: 'uploading' });
    await queueAudioUpload(
      {
        workspaceId: 'workspace-2',
        songId: 'song-2',
        file: new File(['second'], 'second.wav', { type: 'audio/wav' }),
        filename: 'second.mp3',
        normalizePeak: true,
        durationSeconds: 9,
      },
      database
    );
    const upload = vi
      .fn()
      .mockResolvedValueOnce('asset-first')
      .mockResolvedValueOnce('asset-second');

    await processPendingAudioUploads('workspace-2', { database, upload });
    await processPendingAudioUploads('workspace-2', { database, upload });

    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls.map((call) => call[3]?.filename)).toEqual(['first.mp3', 'second.mp3']);
    expect(upload.mock.calls.map((call) => call[3]?.normalizePeak)).toEqual([false, true]);
    expect(upload.mock.calls.map((call) => call[3]?.durationSeconds)).toEqual([undefined, 9]);
    expect(await database.pendingAudioUploads.count()).toBe(0);

    await destroyTestDatabase(database);
  });

  it('keeps quota failures visible for a manual retry', async () => {
    const database = await createTestDatabase('pending-audio-failure');
    await queueAudioUpload(
      {
        workspaceId: 'workspace-3',
        file: new File(['audio'], 'large.wav', { type: 'audio/wav' }),
        filename: 'large.mp3',
      },
      database
    );

    await processPendingAudioUploads('workspace-3', {
      database,
      upload: vi.fn().mockRejectedValue(new Error('audio quota exceeded')),
    });

    expect(await database.pendingAudioUploads.toArray()).toEqual([
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'audio quota exceeded',
      }),
    ]);

    await destroyTestDatabase(database);
  });

  it('rejects a duplicate queued filename in the same workspace', async () => {
    const database = await createTestDatabase('pending-audio-duplicate');
    const input = {
      workspaceId: 'workspace-4',
      file: new File(['audio'], 'take.wav', { type: 'audio/wav' }),
      filename: 'take.mp3',
    };

    await queueAudioUpload(input, database);
    await expect(queueAudioUpload(input, database)).rejects.toThrow('deja en attente');

    await destroyTestDatabase(database);
  });

  it('removes a queued file when its upload is cancelled', async () => {
    const database = await createTestDatabase('pending-audio-cancel');
    const queued = await queueAudioUpload(
      {
        workspaceId: 'workspace-5',
        file: new File(['audio'], 'cancel.wav', { type: 'audio/wav' }),
        filename: 'cancel.mp3',
      },
      database
    );

    await removePendingAudioUpload(queued.id, database);

    expect(await database.pendingAudioUploads.count()).toBe(0);
    await destroyTestDatabase(database);
  });
});
