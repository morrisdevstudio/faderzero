import { db, type FaderZeroDatabase } from '@/db/db';
import type { SongTimelineRecord, TimelineSectionRecord } from '@/db/schema';
import { enqueueMutation } from '@/db/syncQueueHelper';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';
import { useAuthStore } from '@/stores/authStore';

export interface SongTimelineBundle {
  timeline: SongTimelineRecord;
  sections: TimelineSectionRecord[];
}

export class SongTimelinesRepository {
  private readonly database: FaderZeroDatabase;

  constructor(database: FaderZeroDatabase = db) {
    this.database = database;
  }

  private workspaceId() {
    return useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
  }

  async getBySongId(songId: string): Promise<SongTimelineBundle | null> {
    const timeline = await this.database.songTimelines.where('songId').equals(songId).filter((item) => item.deletedAt === undefined).first();
    if (!timeline || timeline.workspaceId !== this.workspaceId()) return null;
    const sections = await this.database.timelineSections.where('timelineId').equals(timeline.id).filter((item) => item.deletedAt === undefined).sortBy('position');
    return { timeline, sections: sections.sort((left, right) => left.position - right.position || left.createdAt - right.createdAt) };
  }

  async listProgrammedSongIds(workspaceId: string) {
    return (await this.database.songTimelines.where('workspaceId').equals(workspaceId).toArray())
      .filter((item) => item.deletedAt === undefined)
      .map((item) => item.songId);
  }

  async listProgrammedAverageBpms(workspaceId: string) {
    const timelines = (await this.database.songTimelines.where('workspaceId').equals(workspaceId).toArray())
      .filter((item) => item.deletedAt === undefined);
    if (timelines.length === 0) return {};
    const timelineIds = new Set(timelines.map((item) => item.id));
    const sections = (await this.database.timelineSections.where('workspaceId').equals(workspaceId).toArray())
      .filter((item) => item.deletedAt === undefined && timelineIds.has(item.timelineId));
    const temposByTimeline = new Map<string, number[]>();
    for (const section of sections) {
      const tempos = temposByTimeline.get(section.timelineId) ?? [];
      tempos.push(section.tempo);
      temposByTimeline.set(section.timelineId, tempos);
    }
    const averages: Record<string, number> = {};
    for (const timeline of timelines) {
      const tempos = temposByTimeline.get(timeline.id);
      if (!tempos || tempos.length === 0) continue;
      averages[timeline.songId] = Math.round(tempos.reduce((sum, tempo) => sum + tempo, 0) / tempos.length);
    }
    return averages;
  }

  async create(songId: string, initialTempo = 120): Promise<SongTimelineBundle> {
    const song = await this.database.songs.get(songId);
    if (!song || song.workspaceId !== this.workspaceId()) throw new Error('Morceau introuvable.');
    const existing = await this.getBySongId(songId);
    if (existing) return existing;
    const timestamp = now();
    const timeline: SongTimelineRecord = {
      id: createId(), songId, workspaceId: song.workspaceId, startCountInBars: 1, volume: 0.75,
      createdAt: timestamp, updatedAt: timestamp, syncStatus: 'pending',
    };
    const section: TimelineSectionRecord = {
      id: createId(), timelineId: timeline.id, workspaceId: song.workspaceId, position: 0,
      name: 'Intro', bars: 4, tempo: Math.min(400, Math.max(20, Math.round(song.bpm ?? initialTempo))),
      numerator: 4, denominator: 4, tempoUnit: 'quarter', clickEnabled: true,
      accentFirstBeat: true, clickResolution: 'denominator', subdivision: 1, beatSounds: [[0], [1], [1], [1]], countInMode: 'none', countInBars: 0,
      createdAt: timestamp, updatedAt: timestamp, syncStatus: 'pending',
    };
    await this.database.transaction('rw', this.database.songTimelines, this.database.timelineSections, this.database.songs, this.database.syncQueue, async () => {
      await this.database.songTimelines.add(timeline);
      await this.database.timelineSections.add(section);
      await this.database.songs.put({ ...song, bpm: section.tempo, updatedAt: timestamp, syncStatus: 'pending' });
      await enqueueMutation(this.database, song.workspaceId, 'songTimeline', timeline.id, 'create', timeline);
      await enqueueMutation(this.database, song.workspaceId, 'timelineSection', section.id, 'create', section);
      await enqueueMutation(this.database, song.workspaceId, 'song', song.id, 'update', { bpm: section.tempo, updatedAt: timestamp }, song.serverVersion);
    });
    return { timeline, sections: [section] };
  }

  async updateTimeline(id: string, patch: Partial<Pick<SongTimelineRecord, 'startCountInBars' | 'volume'>>) {
    const current = await this.database.songTimelines.get(id);
    if (!current) throw new Error('Timeline introuvable.');
    const updated = { ...current, ...patch, updatedAt: now(), syncStatus: 'pending' as const };
    await this.database.transaction('rw', this.database.songTimelines, this.database.syncQueue, async () => {
      await this.database.songTimelines.put(updated);
      await enqueueMutation(this.database, updated.workspaceId, 'songTimeline', id, 'update', updated, current.serverVersion);
    });
    return updated;
  }

  async addSection(timelineId: string, template?: TimelineSectionRecord) {
    const timeline = await this.database.songTimelines.get(timelineId);
    if (!timeline) throw new Error('Timeline introuvable.');
    const sections = await this.database.timelineSections.where('timelineId').equals(timelineId).filter((item) => item.deletedAt === undefined).sortBy('position');
    const timestamp = now();
    const nextPosition = sections.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    const section: TimelineSectionRecord = {
      id: createId(), timelineId, workspaceId: timeline.workspaceId, position: nextPosition,
      name: template?.name?.trim() || `Section ${sections.length + 1}`, bars: template?.bars ?? 4, tempo: template?.tempo ?? sections.at(-1)?.tempo ?? 120,
      numerator: template?.numerator ?? 4, denominator: template?.denominator ?? 4, tempoUnit: template?.tempoUnit ?? 'quarter',
      clickEnabled: template?.clickEnabled ?? true, accentFirstBeat: template?.accentFirstBeat ?? true,
      clickResolution: template?.clickResolution ?? 'denominator', subdivision: template?.subdivision ?? 1,
      beatSounds: template?.beatSounds?.map((beat) => [...beat]) ?? Array.from({ length: template?.numerator ?? 4 }, (_, index) => [index === 0 ? 0 : 1]), countInMode: template?.countInMode ?? 'none',
      countInBars: template?.countInBars ?? 0, createdAt: timestamp, updatedAt: timestamp, syncStatus: 'pending',
      ...(template?.color ? { color: template.color } : {}),
    };
    await this.database.transaction('rw', this.database.timelineSections, this.database.syncQueue, async () => {
      await this.database.timelineSections.add(section);
      await enqueueMutation(this.database, section.workspaceId, 'timelineSection', section.id, 'create', section);
    });
    return section;
  }

  async updateSection(id: string, patch: Partial<Omit<TimelineSectionRecord, 'id' | 'timelineId' | 'workspaceId' | 'createdAt'>>) {
    const current = await this.database.timelineSections.get(id);
    if (!current) throw new Error('Section introuvable.');
    const timestamp = now();
    const updated = { ...current, ...patch, updatedAt: timestamp, syncStatus: 'pending' as const };
    const timeline = await this.database.songTimelines.get(current.timelineId);
    const song = timeline ? await this.database.songs.get(timeline.songId) : undefined;
    await this.database.transaction('rw', this.database.timelineSections, this.database.songs, this.database.syncQueue, async () => {
      await this.database.timelineSections.put(updated);
      await enqueueMutation(this.database, updated.workspaceId, 'timelineSection', id, 'update', updated, current.serverVersion);
      if (updated.position === 0 && song && song.bpm !== updated.tempo) {
        const nextSong = { ...song, bpm: updated.tempo, updatedAt: timestamp, syncStatus: 'pending' as const };
        await this.database.songs.put(nextSong);
        await enqueueMutation(this.database, song.workspaceId, 'song', song.id, 'update', { bpm: updated.tempo, updatedAt: timestamp }, song.serverVersion);
      }
    });
    return updated;
  }

  async moveSection(id: string, direction: -1 | 1) {
    const current = await this.database.timelineSections.get(id);
    if (!current) return;
    const sections = await this.database.timelineSections.where('timelineId').equals(current.timelineId).filter((item) => item.deletedAt === undefined).sortBy('position');
    const index = sections.findIndex((item) => item.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= sections.length) return;

    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(targetIndex, 0, moved);

    const timestamp = now();
    const normalized = reordered.map((section, position) => ({
      ...section,
      position,
      updatedAt: timestamp,
      syncStatus: 'pending' as const,
    }));
    const first = normalized[0];
    const timeline = await this.database.songTimelines.get(current.timelineId);
    const song = timeline ? await this.database.songs.get(timeline.songId) : undefined;

    await this.database.transaction('rw', this.database.timelineSections, this.database.songs, this.database.syncQueue, async () => {
      await this.database.timelineSections.bulkPut(normalized);
      for (const section of normalized) {
        const previous = sections.find((item) => item.id === section.id);
        if (previous?.position === section.position) continue;
        await enqueueMutation(this.database, section.workspaceId, 'timelineSection', section.id, 'update', section, previous?.serverVersion);
      }
      if (first && song && song.bpm !== first.tempo) {
        const nextSong = { ...song, bpm: first.tempo, updatedAt: timestamp, syncStatus: 'pending' as const };
        await this.database.songs.put(nextSong);
        await enqueueMutation(this.database, song.workspaceId, 'song', song.id, 'update', { bpm: first.tempo, updatedAt: timestamp }, song.serverVersion);
      }
    });
  }

  async deleteSection(id: string) {
    const current = await this.database.timelineSections.get(id);
    if (!current) return;
    const sections = await this.database.timelineSections.where('timelineId').equals(current.timelineId).filter((item) => item.deletedAt === undefined).toArray();
    if (sections.length <= 1) throw new Error('Une timeline doit conserver au moins une section.');
    const timestamp = now();
    const archived = { ...current, deletedAt: timestamp, updatedAt: timestamp, syncStatus: 'pending' as const };
    await this.database.transaction('rw', this.database.timelineSections, this.database.syncQueue, async () => {
      await this.database.timelineSections.put(archived);
      await enqueueMutation(this.database, archived.workspaceId, 'timelineSection', id, 'soft_delete', archived, current.serverVersion);
    });
  }
}

export const songTimelinesRepository = new SongTimelinesRepository();
