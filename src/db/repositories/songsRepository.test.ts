import { SetlistSongsRepository } from '@/db/repositories/setlistSongsRepository';
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
    });

    await destroyTestDatabase(database);
  });
});
