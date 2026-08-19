import { SetlistSongsRepository } from '@/db/repositories/setlistSongsRepository';
import { SongAssetsRepository } from '@/db/repositories/songAssetsRepository';
import { SongsRepository } from '@/db/repositories/songsRepository';
import { destroyTestDatabase, createTestDatabase } from '@/test/dbTestUtils';

describe('SongsRepository', () => {
  it('creates, lists, searches and soft deletes songs', async () => {
    const database = await createTestDatabase('songs-repository');
    const repository = new SongsRepository(database);
    const setlistSongsRepository = new SetlistSongsRepository(database);

    const firstSong = await repository.create({
      title: 'B Song',
      lyrics: 'second',
    });
    const secondSong = await repository.create({
      title: 'A Song',
      lyrics: 'first',
      notes: 'note',
    });
    expect(firstSong.status).toBe('Idee');
    expect(firstSong.durationSeconds).toBe(0);
    expect(firstSong.lyricsDocumentVersion).toBe(1);
    expect(firstSong.lyricsDocument?.content[0]?.attrs.sectionType).toBe('free');
    await setlistSongsRepository.create({
      setlistId: 'set-1',
      songId: firstSong.id,
      position: 0,
    });

    const listedSongs = await repository.list();
    expect(listedSongs.map((song) => song.title)).toEqual(['A Song', 'B Song']);

    const searchResults = await repository.list({ query: 'b so' });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.id).toBe(firstSong.id);

    const updatedSong = await repository.update(secondSong.id, {
      artist: 'FaderZero',
      bpm: 124,
      status: 'Pret',
      durationSeconds: 215,
    });
    expect(updatedSong.artist).toBe('FaderZero');
    expect(updatedSong.bpm).toBe(124);
    expect(updatedSong.status).toBe('Pret');
    expect(updatedSong.durationSeconds).toBe(215);
    expect(updatedSong.updatedAt).toBeGreaterThanOrEqual(updatedSong.createdAt);

    const legacyTextSong = await repository.update(secondSong.id, {
      lyrics: 'Texte libre mis à jour',
    });
    expect(legacyTextSong.lyricsDocument?.content[0]?.attrs.sectionType).toBe('free');
    expect(legacyTextSong.lyricsDocumentVersion).toBe(1);

    const structuredSong = await repository.update(secondSong.id, {
      lyricsDocument: {
        type: 'doc',
        content: [{
          type: 'songSection',
          attrs: { id: 'section-1', sectionType: 'chorus', label: 'Refrain' },
          content: [{
            type: 'paragraph',
            attrs: { id: 'paragraph-1' },
            content: [{ type: 'text', text: 'Tout recommence' }],
          }],
        }],
      },
    });
    expect(structuredSong.lyrics).toBe('[Refrain]\nTout recommence');

    await repository.softDelete(firstSong.id);

    const activeSongs = await repository.list();
    expect(activeSongs).toHaveLength(1);
    expect(activeSongs[0]?.id).toBe(secondSong.id);

    const allSongs = await repository.list({ includeDeleted: true });
    expect(allSongs).toHaveLength(2);
    expect(allSongs.find((song) => song.id === firstSong.id)?.deletedAt).toBeDefined();
    expect(await setlistSongsRepository.listBySetlistId('set-1')).toHaveLength(0);

    // Vérification de la file de synchronisation (syncQueue)
    const queue = await database.syncQueue.toArray();
    
    // B Song : créée puis soft-supprimée hors-ligne -> retirée de la queue
    // SetlistSong : créée puis soft-supprimée hors-ligne -> retirée de la queue
    // A Song : créée puis mise à jour -> la mutation de création a fusionné les mises à jour
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      entityType: 'song',
      entityId: secondSong.id,
      operation: 'create',
    });
    expect(queue[0]?.payload).toMatchObject({
      title: 'A Song',
      bpm: 124,
      status: 'Pret',
      durationSeconds: 215,
      lyrics: '[Refrain]\nTout recommence',
      lyricsDocumentVersion: 1,
    });

    await destroyTestDatabase(database);
  });

  it('returns audio and setlist counts in one library summary', async () => {
    const database = await createTestDatabase('songs-library-summary');
    const repository = new SongsRepository(database);
    const assetsRepository = new SongAssetsRepository(database);
    const setlistSongsRepository = new SetlistSongsRepository(database);
    const song = await repository.create({ title: 'Library song', lyrics: 'Couplet' });

    await assetsRepository.create({
      songId: song.id,
      storagePath: 'workspaces/default-workspace/songs/library-song/main.mp3',
      filename: 'main.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 1024,
    });
    await assetsRepository.create({
      songId: song.id,
      storagePath: 'workspaces/default-workspace/songs/library-song/alt.mp3',
      filename: 'alt.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 1024,
    });
    await setlistSongsRepository.create({ setlistId: 'set-a', songId: song.id, position: 0 });
    await setlistSongsRepository.create({ setlistId: 'set-b', songId: song.id, position: 0 });

    const summary = (await repository.listLibrarySummaries()).find((entry) => entry.song.id === song.id);
    expect(summary).toMatchObject({ audioCount: 2, setlistCount: 2 });

    await destroyTestDatabase(database);
  });

  it('restores a soft-deleted song', async () => {
    const database = await createTestDatabase('songs-repository-restore');
    const repository = new SongsRepository(database);

    const song = await repository.create({ title: 'Song to restore' });
    await repository.softDelete(song.id);
    expect(await repository.list()).toHaveLength(0);

    const restored = await repository.restore(song.id);
    expect(restored.deletedAt).toBeUndefined();
    const active = await repository.list();
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(song.id);

    await destroyTestDatabase(database);
  });
});
