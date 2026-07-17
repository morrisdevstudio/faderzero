import { describe, expect, it } from 'vitest';
import { applySyncImport, buildSyncExportPayload, previewSyncImport } from '@/features/sync/qrTransfer';
import { createTestDatabase, destroyTestDatabase } from '@/test/dbTestUtils';

describe('qrTransfer import', () => {
  it('imports songs, setlists and setlistSongs into the local database', async () => {
    const database = await createTestDatabase('sync-import');

    try {
      const exportPayload = await buildSyncExportPayload({
        songs: [
          {
            id: 'song-1',
            title: 'Song A',
            lyrics: 'Lyrics A',
            bpm: 120,
            status: 'Pret',
            durationSeconds: 245,
            createdAt: 1,
            updatedAt: 10,
          },
        ],
        setlists: [
          {
            id: 'set-1',
            name: 'Set A',
            createdAt: 2,
            updatedAt: 11,
          },
        ],
        setlistSongs: [
          {
            id: 'entry-1',
            setlistId: 'set-1',
            songId: 'song-1',
            position: 0,
            createdAt: 3,
            updatedAt: 12,
          },
        ],
      });

      const result = await applySyncImport(exportPayload, database);

      expect(result).toEqual({
        songsImported: 1,
        songsSkipped: 0,
        setlistsImported: 1,
        setlistsSkipped: 0,
        setlistSongsImported: 1,
        setlistSongsSkipped: 0,
      });
      expect(await database.songs.get('song-1')).toMatchObject({
        title: 'Song A',
        bpm: 120,
        status: 'Pret',
        durationSeconds: 245,
      });
      expect(await database.setlists.get('set-1')).toMatchObject({ name: 'Set A' });
      expect(await database.setlistSongs.get('entry-1')).toMatchObject({ setlistId: 'set-1', songId: 'song-1' });
    } finally {
      await destroyTestDatabase(database);
    }
  });

  it('skips older incoming records when newer local records already exist', async () => {
    const database = await createTestDatabase('sync-import-merge');

    try {
      await database.songs.add({
        id: 'song-1',
        workspaceId: 'default-workspace',
        title: 'Local Song',
        lyrics: 'Local',
        status: 'Idee',
        durationSeconds: 0,
        createdAt: 1,
        updatedAt: 50,
      });

      const exportPayload = await buildSyncExportPayload({
        songs: [
          {
            id: 'song-1',
            title: 'Remote Older Song',
            lyrics: 'Remote',
            createdAt: 1,
            updatedAt: 10,
          },
        ],
        setlists: [],
        setlistSongs: [],
      });

      const result = await applySyncImport(exportPayload, database);

      expect(result.songsImported).toBe(0);
      expect(result.songsSkipped).toBe(1);
      expect(await database.songs.get('song-1')).toMatchObject({ title: 'Local Song', updatedAt: 50 });
    } finally {
      await destroyTestDatabase(database);
    }
  });

  it('previews creates, updates and skips before import', async () => {
    const database = await createTestDatabase('sync-import-preview');

    try {
      await database.songs.add({
        id: 'song-1',
        workspaceId: 'default-workspace',
        title: 'Existing newer song',
        lyrics: 'Local',
        status: 'Idee',
        durationSeconds: 0,
        createdAt: 1,
        updatedAt: 100,
      });
      await database.setlists.add({
        id: 'set-1',
        workspaceId: 'default-workspace',
        name: 'Existing older setlist',
        createdAt: 1,
        updatedAt: 10,
      });
      await database.setlistSongs.add({
        id: 'entry-1',
        workspaceId: 'default-workspace',
        setlistId: 'set-1',
        songId: 'song-1',
        position: 0,
        createdAt: 1,
        updatedAt: 100,
      });

      const exportPayload = await buildSyncExportPayload({
        songs: [
          {
            id: 'song-1',
            title: 'Remote older song',
            lyrics: 'Remote',
            createdAt: 1,
            updatedAt: 20,
          },
          {
            id: 'song-2',
            title: 'Remote new song',
            lyrics: 'Remote new',
            status: 'En cours',
            durationSeconds: 180,
            createdAt: 2,
            updatedAt: 30,
          },
        ],
        setlists: [
          {
            id: 'set-1',
            name: 'Remote newer setlist',
            createdAt: 1,
            updatedAt: 20,
          },
        ],
        setlistSongs: [
          {
            id: 'entry-1',
            setlistId: 'set-1',
            songId: 'song-1',
            position: 0,
            createdAt: 1,
            updatedAt: 50,
          },
          {
            id: 'entry-2',
            setlistId: 'set-1',
            songId: 'song-2',
            position: 1,
            createdAt: 2,
            updatedAt: 50,
          },
        ],
      });

      const preview = await previewSyncImport(exportPayload, database);

      expect(preview).toEqual({
        songsToCreate: 1,
        songsToUpdate: 0,
        songsToSkip: 1,
        setlistsToCreate: 0,
        setlistsToUpdate: 1,
        setlistsToSkip: 0,
        setlistSongsToCreate: 1,
        setlistSongsToUpdate: 0,
        setlistSongsToSkip: 1,
      });
    } finally {
      await destroyTestDatabase(database);
    }
  });
});
