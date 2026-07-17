import { SetlistSongsRepository } from '@/db/repositories/setlistSongsRepository';
import { SetlistsRepository } from '@/db/repositories/setlistsRepository';
import { SongsRepository } from '@/db/repositories/songsRepository';
import { destroyTestDatabase, createTestDatabase } from '@/test/dbTestUtils';

describe('SetlistsRepository', () => {
  it('creates, updates and soft deletes setlists', async () => {
    const database = await createTestDatabase('setlists-repository');
    const repository = new SetlistsRepository(database);
    const setlistSongsRepository = new SetlistSongsRepository(database);
    const songsRepository = new SongsRepository(database);

    const olderSetlist = await repository.create({
      name: 'Older Set',
    });
    const newerSetlist = await repository.create({
      name: 'Newer Set',
      notes: 'festival',
    });
    const firstSong = await songsRepository.create({
      title: 'Song 1',
      durationSeconds: 120,
    });
    const secondSong = await songsRepository.create({
      title: 'Song 2',
      durationSeconds: 185,
    });
    await setlistSongsRepository.create({
      setlistId: newerSetlist.id,
      songId: firstSong.id,
      position: 0,
    });
    await setlistSongsRepository.create({
      setlistId: newerSetlist.id,
      songId: secondSong.id,
      position: 1,
    });

    let setlists = await repository.list();
    expect(setlists[0]?.id).toBe(newerSetlist.id);
    expect(setlists[1]?.id).toBe(olderSetlist.id);

    let summaries = await repository.listSummaries({ includeDeleted: true });
    let newerSummary = summaries.find((summary) => summary.id === newerSetlist.id);
    expect(newerSummary?.songCount).toBe(2);
    expect(newerSummary?.totalDurationSeconds).toBe(305);

    const updatedSetlist = await repository.update(olderSetlist.id, {
      notes: 'updated',
      date: '2026-06-25',
      closingAnnotation: 'Merci et bonne soiree',
    });
    expect(updatedSetlist.notes).toBe('updated');
    expect(updatedSetlist.date).toBe('2026-06-25');
    expect(updatedSetlist.closingAnnotation).toBe('Merci et bonne soiree');

    await repository.softDelete(newerSetlist.id);

    setlists = await repository.list();
    expect(setlists).toHaveLength(1);
    expect(setlists[0]?.id).toBe(olderSetlist.id);
    expect(await setlistSongsRepository.listBySetlistId(newerSetlist.id)).toHaveLength(0);

    summaries = await repository.listSummaries({ includeDeleted: true });
    const olderSummary = summaries.find((summary) => summary.id === olderSetlist.id);
    newerSummary = summaries.find((summary) => summary.id === newerSetlist.id);
    expect(olderSummary?.songCount).toBe(0);
    expect(olderSummary?.totalDurationSeconds).toBe(0);
    expect(newerSummary?.songCount).toBe(0);
    expect(newerSummary?.totalDurationSeconds).toBe(0);

    await destroyTestDatabase(database);
  });

  it('ignores deleted songs in summary count and total duration', async () => {
    const database = await createTestDatabase('setlists-summary-active-songs');
    const repository = new SetlistsRepository(database);
    const setlistSongsRepository = new SetlistSongsRepository(database);
    const songsRepository = new SongsRepository(database);

    const setlist = await repository.create({
      name: 'Active only',
    });
    const keptSong = await songsRepository.create({
      title: 'Kept',
      durationSeconds: 210,
    });
    const removedSong = await songsRepository.create({
      title: 'Removed',
      durationSeconds: 95,
    });

    await setlistSongsRepository.addSongToSetlist(setlist.id, keptSong.id);
    await setlistSongsRepository.addSongToSetlist(setlist.id, removedSong.id);
    await songsRepository.softDelete(removedSong.id);

    const summaries = await repository.listSummaries();
    const summary = summaries.find((item) => item.id === setlist.id);

    expect(summary?.songCount).toBe(1);
    expect(summary?.totalDurationSeconds).toBe(210);

    await destroyTestDatabase(database);
  });
});
