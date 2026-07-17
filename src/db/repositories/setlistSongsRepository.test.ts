import { SetlistSongsRepository } from '@/db/repositories/setlistSongsRepository';
import { destroyTestDatabase, createTestDatabase } from '@/test/dbTestUtils';

describe('SetlistSongsRepository', () => {
  it('stores duplicate songs in the same setlist and keeps order by position', async () => {
    const database = await createTestDatabase('setlist-songs-repository');
    const repository = new SetlistSongsRepository(database);

    const secondEntry = await repository.create({
      setlistId: 'set-1',
      songId: 'song-1',
      position: 2,
    });
    await repository.create({
      setlistId: 'set-1',
      songId: 'song-1',
      position: 1,
    });
    await repository.create({
      setlistId: 'set-1',
      songId: 'song-2',
      position: 3,
    });

    const orderedRows = await repository.listBySetlistId('set-1');
    expect(orderedRows.map((row) => row.position)).toEqual([1, 2, 3]);
    expect(orderedRows.filter((row) => row.songId === 'song-1')).toHaveLength(2);

    const updatedRow = await repository.update(secondEntry.id, { position: 0 });
    expect(updatedRow.position).toBe(0);

    const annotatedRow = await repository.update(secondEntry.id, {
      annotation: 'Intro batterie',
      noteShowBpm: true,
      noteShowKey: true,
      isDirectSegue: true,
    });
    expect(annotatedRow.annotation).toBe('Intro batterie');
    expect(annotatedRow.noteShowBpm).toBe(true);
    expect(annotatedRow.noteShowKey).toBe(true);
    expect(annotatedRow.isDirectSegue).toBe(true);

    const reorderedRows = await repository.listBySetlistId('set-1');
    expect(reorderedRows.map((row) => row.position)).toEqual([0, 1, 3]);

    const movedRows = await repository.move(updatedRow.id, 1);
    expect(movedRows.map((row) => row.position)).toEqual([0, 1, 2]);
    expect(movedRows[1]?.songId).toBe('song-1');

    await repository.deleteBySongId('song-1');
    const remainingRows = await repository.listBySetlistId('set-1');
    expect(remainingRows).toHaveLength(1);
    expect(remainingRows[0]?.songId).toBe('song-2');

    await destroyTestDatabase(database);
  });

  it('adds and removes songs while keeping contiguous positions', async () => {
    const database = await createTestDatabase('setlist-songs-add-remove');
    const repository = new SetlistSongsRepository(database);

    const firstEntry = await repository.addSongToSetlist('set-2', 'song-a');
    const secondEntry = await repository.addSongToSetlist('set-2', 'song-a');
    await repository.addSongToSetlist('set-2', 'song-b');

    expect(firstEntry.position).toBe(0);
    expect(secondEntry.position).toBe(1);

    await repository.delete(secondEntry.id);

    const rows = await repository.listBySetlistId('set-2');
    expect(rows.map((row) => row.position)).toEqual([0, 1]);
    expect(rows.map((row) => row.songId)).toEqual(['song-a', 'song-b']);

    await destroyTestDatabase(database);
  });

  it('clears direct segue on the first song after reordering', async () => {
    const database = await createTestDatabase('setlist-songs-first-no-segue');
    const repository = new SetlistSongsRepository(database);

    await repository.addSongToSetlist('set-3', 'song-a');
    const secondEntry = await repository.addSongToSetlist('set-3', 'song-b');
    await repository.update(secondEntry.id, { isDirectSegue: true });

    const movedRows = await repository.move(secondEntry.id, -1);
    expect(movedRows[0]?.id).toBe(secondEntry.id);
    expect(movedRows[0]?.isDirectSegue).toBe(false);

    await destroyTestDatabase(database);
  });
});
