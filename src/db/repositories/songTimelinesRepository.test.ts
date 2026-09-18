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
      expect(created.timeline.volume).toBe(1);
      expect(created.timeline.countInSound).toBe('click');
      expect(created.sections[0]).toMatchObject({ name: 'Intro', tempo: 110, position: 0 });

      await repository.updateTimeline(created.timeline.id, { countInSound: 'voice' });
      expect((await repository.getBySongId(song.id))?.timeline.countInSound).toBe('voice');

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

  it('hides a disabled structure from programmed tempos and restores the first section on re-enable', async () => {
    const database = await createTestDatabase('song-timelines-disable');
    try {
      const songs = new SongsRepository(database);
      const repository = new SongTimelinesRepository(database);
      const song = await songs.create({ title: 'Unique', bpm: 110 });
      const created = await repository.create(song.id);
      await repository.updateSection(created.sections[0]!.id, { tempo: 128 });
      await songs.update(song.id, { bpm: 96 });
      await repository.updateTimeline(created.timeline.id, { enabled: false });

      expect((await repository.listProgrammedAverageBpms(song.workspaceId))[song.id]).toBeUndefined();
      expect(await repository.listInactiveStructureSongIds(song.workspaceId)).toEqual([song.id]);
      expect((await songs.getById(song.id))?.bpm).toBe(96);

      await repository.updateSection(created.sections[0]!.id, { tempo: 140 });
      expect((await songs.getById(song.id))?.bpm).toBe(96);

      await repository.updateTimeline(created.timeline.id, { enabled: true });
      expect((await songs.getById(song.id))?.bpm).toBe(140);
      expect((await repository.listProgrammedAverageBpms(song.workspaceId))[song.id]).toBe(140);
    } finally {
      await destroyTestDatabase(database);
    }
  });
});
