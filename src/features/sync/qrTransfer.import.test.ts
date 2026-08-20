import { describe, expect, it } from 'vitest';
import { applySyncImport, buildSyncExportPayload, collectSyncExportData, previewSyncImport } from '@/features/sync/qrTransfer';
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
      const [importedSong] = await database.songs.toArray();
      const [importedSetlist] = await database.setlists.toArray();
      const [importedSetlistSong] = await database.setlistSongs.toArray();
      expect(importedSong?.id).not.toBe('song-1');
      expect(importedSong).toMatchObject({
        title: 'Song A',
        bpm: 120,
        status: 'Pret',
        durationSeconds: 245,
        lyricsDocumentVersion: 1,
      });
      expect(importedSong?.lyricsDocument?.content[0]?.attrs.sectionType).toBe('free');
      expect(importedSetlist?.id).not.toBe('set-1');
      expect(importedSetlist).toMatchObject({ name: 'Set A' });
      expect(importedSetlistSong?.id).not.toBe('entry-1');
      expect(importedSetlistSong).toMatchObject({ setlistId: importedSetlist?.id, songId: importedSong?.id });
    } finally {
      await destroyTestDatabase(database);
    }
  });

  it('regenerates colliding IDs without overwriting local records', async () => {
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

      expect(result.songsImported).toBe(1);
      expect(result.songsSkipped).toBe(0);
      expect(await database.songs.get('song-1')).toMatchObject({ title: 'Local Song', updatedAt: 50 });
      expect(await database.songs.count()).toBe(2);
      expect((await database.songs.toArray()).find((song) => song.id !== 'song-1')).toMatchObject({ title: 'Remote Older Song' });
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

      const preview = await previewSyncImport(exportPayload, database, 'default-workspace');

      expect(preview).toEqual({
        songsToCreate: 2,
        songsToUpdate: 0,
        songsToSkip: 0,
        setlistsToCreate: 1,
        setlistsToUpdate: 0,
        setlistsToSkip: 0,
        setlistSongsToCreate: 2,
        setlistSongsToUpdate: 0,
        setlistSongsToSkip: 0,
        songIdCollisions: 1,
        setlistIdCollisions: 1,
        setlistSongIdCollisions: 1,
        idsRegenerated: 5,
      });
    } finally {
      await destroyTestDatabase(database);
    }
  });

  it('detects duplicate song titles across workspace during preview', async () => {
    const database = await createTestDatabase('sync-import-duplicates');

    try {
      await database.songs.add({
        id: 's-local-1',
        workspaceId: 'ws-1',
        title: 'Wonderwall',
        lyrics: 'Local version',
        status: 'Idee',
        durationSeconds: 100,
        createdAt: 1,
        updatedAt: 1,
      });

      const exportPayload = await buildSyncExportPayload({
        songs: [
          { id: 's-remote-1', title: 'Wonderwall', lyrics: 'Remote version', createdAt: 2, updatedAt: 2 },
          { id: 's-remote-2', title: 'Champagne Supernova', lyrics: 'Other song', createdAt: 2, updatedAt: 2 },
        ],
        setlists: [],
        setlistSongs: [],
      });

      const preview = await previewSyncImport(exportPayload, database, 'ws-1');
      expect(preview.duplicateTitles).toEqual(['Wonderwall']);
    } finally {
      await destroyTestDatabase(database);
    }
  });

  it('selectively collects songs and setlists based on selection filter', async () => {
    const database = await createTestDatabase('sync-export-selection');

    try {
      await database.songs.bulkAdd([
        { id: 'song-1', workspaceId: 'ws-1', title: 'Song 1', lyrics: 'L1', status: 'Idee', durationSeconds: 100, createdAt: 1, updatedAt: 1 },
        { id: 'song-2', workspaceId: 'ws-1', title: 'Song 2', lyrics: 'L2', status: 'Idee', durationSeconds: 200, createdAt: 2, updatedAt: 2 },
        { id: 'song-3', workspaceId: 'ws-1', title: 'Song 3', lyrics: 'L3', status: 'Idee', durationSeconds: 300, createdAt: 3, updatedAt: 3 },
      ]);
      await database.setlists.bulkAdd([
        { id: 'set-1', workspaceId: 'ws-1', name: 'Setlist 1', createdAt: 1, updatedAt: 1 },
        { id: 'set-2', workspaceId: 'ws-1', name: 'Setlist 2', createdAt: 2, updatedAt: 2 },
      ]);
      await database.setlistSongs.bulkAdd([
        { id: 'ss-1', workspaceId: 'ws-1', setlistId: 'set-1', songId: 'song-1', position: 0, createdAt: 1, updatedAt: 1 },
        { id: 'ss-2', workspaceId: 'ws-1', setlistId: 'set-2', songId: 'song-2', position: 0, createdAt: 2, updatedAt: 2 },
      ]);

      // Test 1: Only Setlist 1 (should automatically include Song 1)
      const dataSetlist1 = await collectSyncExportData(database, { workspaceId: 'ws-1', setlistIds: ['set-1'] });
      expect(dataSetlist1.setlists).toHaveLength(1);
      expect(dataSetlist1.setlists[0]?.id).toBe('set-1');
      expect(dataSetlist1.songs).toHaveLength(1);
      expect(dataSetlist1.songs[0]?.id).toBe('song-1');
      expect(dataSetlist1.setlistSongs).toHaveLength(1);

      // Test 2: Setlist 1 + standalone Song 3
      const dataCombined = await collectSyncExportData(database, { workspaceId: 'ws-1', setlistIds: ['set-1'], songIds: ['song-3'] });
      expect(dataCombined.setlists).toHaveLength(1);
      expect(dataCombined.songs).toHaveLength(2);
      expect(dataCombined.songs.map((s) => s.id).sort()).toEqual(['song-1', 'song-3']);

      // Test 3: Only Song 2
      const dataSongOnly = await collectSyncExportData(database, { workspaceId: 'ws-1', songIds: ['song-2'] });
      expect(dataSongOnly.setlists).toHaveLength(0);
      expect(dataSongOnly.songs).toHaveLength(1);
      expect(dataSongOnly.songs[0]?.id).toBe('song-2');
      expect(dataSongOnly.setlistSongs).toHaveLength(0);
    } finally {
      await destroyTestDatabase(database);
    }
  });

  it('imports into a target workspace and enqueues syncQueue items', async () => {
    const database = await createTestDatabase('sync-import-workspace');

    try {
      const exportPayload = await buildSyncExportPayload({
        songs: [{ id: 's1', title: 'Song 1', lyrics: 'L', createdAt: 1, updatedAt: 1 }],
        setlists: [{ id: 'set1', name: 'Set 1', createdAt: 1, updatedAt: 1 }],
        setlistSongs: [{ id: 'ss1', setlistId: 'set1', songId: 's1', position: 0, createdAt: 1, updatedAt: 1 }],
      });

      const result = await applySyncImport(exportPayload, database, 'target-ws-123');
      expect(result.songsImported).toBe(1);
      expect(result.setlistsImported).toBe(1);

      const songs = await database.songs.where('workspaceId').equals('target-ws-123').toArray();
      expect(songs).toHaveLength(1);
      expect(songs[0]?.workspaceId).toBe('target-ws-123');

      const queueItems = await database.syncQueue.where('workspaceId').equals('target-ws-123').toArray();
      expect(queueItems).toHaveLength(3); // 1 song, 1 setlist, 1 setlistSong
    } finally {
      await destroyTestDatabase(database);
    }
  });
});
