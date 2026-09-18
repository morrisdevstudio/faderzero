import { describe, expect, it } from 'vitest';
import { SongTimelinesRepository } from './songTimelinesRepository';
import { SongsRepository } from './songsRepository';
import { createTestDatabase, destroyTestDatabase } from '@/test/dbTestUtils';

describe('SongTimelinesRepository', () => {
  it('creates, edits and reorders a timeline while mirroring the first tempo', async () => {
    const database = await createTestDatabase('song-timelines');
    try {
      const songs = new SongsRepository(database);
      const repository = new SongTimelinesRepository(database);
      const song = await songs.create({ title: 'Progressive', bpm: 110 });
      const created = await repository.create(song.id);
      expect(created.sections[0]).toMatchObject({ name: 'Intro', tempo: 110, position: 0 });

      await repository.updateSection(created.sections[0]!.id, { tempo: 128, name: 'Départ' });
      expect((await songs.getById(song.id))?.bpm).toBe(128);

      const second = await repository.addSection(created.timeline.id);
      await repository.updateSection(second.id, { tempo: 90 });
      await repository.moveSection(second.id, -1);
      const reordered = await repository.getBySongId(song.id);
      expect(reordered?.sections.map((section) => section.id)).toEqual([second.id, created.sections[0]!.id]);
      expect(reordered?.sections.map((section) => section.position)).toEqual([0, 1]);
      expect((await songs.getById(song.id))?.bpm).toBe(90);
      expect((await database.syncQueue.toArray()).some((item) => item.entityType === 'timelineSection')).toBe(true);
    } finally {
      await destroyTestDatabase(database);
    }
  });

  it('keeps the source name when duplicating a section', async () => {
    const database = await createTestDatabase('song-timelines-duplicate');
    try {
      const songs = new SongsRepository(database);
      const repository = new SongTimelinesRepository(database);
      const song = await songs.create({ title: 'Copy', bpm: 100 });
      const created = await repository.create(song.id);
      const second = await repository.addSection(created.timeline.id);
      const third = await repository.addSection(created.timeline.id);
      await repository.deleteSection(second.id);
      const duplicate = await repository.addSection(created.timeline.id, created.sections[0]);
      const listed = await repository.getBySongId(song.id);
      expect(duplicate.name).toBe('Intro');
      expect(listed?.sections.map((section) => section.id)).toEqual([created.sections[0]!.id, third.id, duplicate.id]);
      expect(listed?.sections.map((section) => section.position)).toEqual([0, 2, 3]);
      const blank = await repository.addSection(created.timeline.id);
      expect(blank.name).toBe('Section 4');
      expect(blank.position).toBe(4);
    } finally {
      await destroyTestDatabase(database);
    }
  });

  it('returns the rounded average tempo of every programmed section', async () => {
    const database = await createTestDatabase('song-timelines-average-bpm');
    try {
      const songs = new SongsRepository(database);
      const repository = new SongTimelinesRepository(database);
      const song = await songs.create({ title: 'Moyenne', bpm: 135 });
      const created = await repository.create(song.id);
      await repository.updateSection(created.sections[0]!.id, { tempo: 128 });
      const second = await repository.addSection(created.timeline.id);
      await repository.updateSection(second.id, { tempo: 90 });
      const averages = await repository.listProgrammedAverageBpms(song.workspaceId);
      expect(averages).toEqual({ [song.id]: 109 });
    } finally {
      await destroyTestDatabase(database);
    }
  });
});
