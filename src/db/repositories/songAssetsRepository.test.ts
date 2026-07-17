import { describe, expect, it } from 'vitest';
import { SongAssetsRepository } from '@/db/repositories/songAssetsRepository';
import { createTestDatabase, destroyTestDatabase } from '@/test/dbTestUtils';

describe('SongAssetsRepository', () => {
  it('creates, lists and soft deletes song assets', async () => {
    const database = await createTestDatabase('song-assets-repository');
    const repository = new SongAssetsRepository(database);
    await database.songs.add({
      id: 'song-xyz',
      workspaceId: 'default-workspace',
      title: 'Song xyz',
      lyrics: '',
      status: 'Idee',
      durationSeconds: 0,
      createdAt: 1,
      updatedAt: 1,
    });

    // 1. Creation d'un asset
    const asset = await repository.create({
      songId: 'song-xyz',
      storagePath: 'workspaces/default-workspace/songs/song-xyz/asset-123.mp3',
      filename: 'backing_track.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 1048576,
    });

    expect(asset.id).toBeDefined();
    expect(asset.songId).toBe('song-xyz');
    expect(asset.syncStatus).toBe('pending');

    const importedTracks = await repository.listImportedTracks();
    expect(importedTracks).toHaveLength(1);
    expect(importedTracks[0]?.song?.title).toBe('Song xyz');

    // 2. Listing
    const activeAssets = await repository.listBySongId('song-xyz');
    expect(activeAssets).toHaveLength(1);
    expect(activeAssets[0]?.filename).toBe('backing_track.mp3');

    // Vérification de la syncQueue
    const queue = await database.syncQueue.toArray();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      entityType: 'songAsset',
      entityId: asset.id,
      operation: 'create',
    });

    // 3. Soft Delete
    await repository.softDelete(asset.id);

    const activeAfterDelete = await repository.listBySongId('song-xyz');
    expect(activeAfterDelete).toHaveLength(0);

    const allAssets = await repository.listBySongId('song-xyz', true);
    expect(allAssets).toHaveLength(1);
    expect(allAssets[0]?.deletedAt).toBeDefined();

    // Vérification que la mutation a été nettoyée de la file car créée puis supprimée hors-ligne
    const queueAfterDelete = await database.syncQueue.toArray();
    expect(queueAfterDelete).toHaveLength(0);

    await destroyTestDatabase(database);
  });

  it('keeps imported audio unlinked until it is associated with a song', async () => {
    const database = await createTestDatabase('song-assets-unlinked');
    const repository = new SongAssetsRepository(database);
    await database.songs.add({
      id: 'song-link-target',
      workspaceId: 'default-workspace',
      title: 'Target song',
      lyrics: '',
      status: 'Idee',
      durationSeconds: 0,
      createdAt: 1,
      updatedAt: 1,
    });

    const asset = await repository.create({
      storagePath: 'workspaces/default-workspace/imports/asset-free.mp3',
      filename: 'free_track.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 2048,
    });

    expect(asset.songId).toBeUndefined();
    expect(await repository.listBySongId('song-link-target')).toHaveLength(0);
    expect(await repository.listUnlinkedTracks()).toHaveLength(1);

    const linkedAsset = await repository.linkToSong(asset.id, 'song-link-target');
    expect(linkedAsset.songId).toBe('song-link-target');
    expect(await repository.listUnlinkedTracks()).toHaveLength(0);
    expect(await repository.listBySongId('song-link-target')).toHaveLength(1);

    await destroyTestDatabase(database);
  });
});
