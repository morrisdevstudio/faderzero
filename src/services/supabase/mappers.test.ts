import { describe, expect, it } from 'vitest';
import {
  mapTimestampToMs,
  mapMsToTimestamp,
  toLocalSong,
  toDbSong,
  toLocalSetlist,
  toDbSetlist,
  toLocalSetlistSong,
  toDbSetlistSong,
  toLocalSongAsset,
  toDbSongAsset,
  type DbSong,
  type DbSetlist,
  type DbSetlistSong,
  type DbSongAsset,
} from './mappers';

describe('supabase mappers', () => {
  describe('timestamp conversion helpers', () => {
    it('converts ISO-8601 string to ms', () => {
      const iso = '2026-06-28T19:57:00.000Z';
      const ms = new Date(iso).getTime();
      expect(mapTimestampToMs(iso)).toBe(ms);
    });

    it('returns undefined for empty timestamptz values', () => {
      expect(mapTimestampToMs(null)).toBeUndefined();
      expect(mapTimestampToMs(undefined)).toBeUndefined();
      expect(mapTimestampToMs('')).toBeUndefined();
    });

    it('converts ms to ISO-8601 string', () => {
      const ms = 1782676620000;
      const expectedIso = new Date(ms).toISOString();
      expect(mapMsToTimestamp(ms)).toBe(expectedIso);
    });

    it('returns null for empty ms values', () => {
      expect(mapMsToTimestamp(null)).toBeNull();
      expect(mapMsToTimestamp(undefined)).toBeNull();
    });
  });

  describe('songs mapper', () => {
    it('converts DbSong to SongRecord and vice versa', () => {
      const dbSong: DbSong = {
        id: 'song-abc',
        workspace_id: 'work-123',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        lyrics: 'Is this real life?',
        key: 'Bb',
        bpm: 72,
        status: 'Pret',
        duration_seconds: 355,
        notes: 'Intro on piano',
        created_at: '2026-06-28T19:00:00.000Z',
        updated_at: '2026-06-28T19:05:00.000Z',
        client_updated_at: '2026-06-28T19:05:00.000Z',
        deleted_at: null,
        server_version: 42,
        last_modified_by: 'user-xyz',
      };

      const localSong = toLocalSong(dbSong);

      expect(localSong).toEqual({
        id: 'song-abc',
        workspaceId: 'work-123',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        lyrics: 'Is this real life?',
        key: 'Bb',
        bpm: 72,
        status: 'Pret',
        durationSeconds: 355,
        notes: 'Intro on piano',
        createdAt: mapTimestampToMs('2026-06-28T19:00:00.000Z')!,
        updatedAt: mapTimestampToMs('2026-06-28T19:05:00.000Z')!,
        deletedAt: undefined,
        serverVersion: 42,
        syncStatus: 'synced',
      });

      const convertedBack = toDbSong(localSong);

      expect(convertedBack).toEqual({
        id: 'song-abc',
        workspace_id: 'work-123',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        lyrics: 'Is this real life?',
        key: 'Bb',
        bpm: 72,
        status: 'Pret',
        duration_seconds: 355,
        notes: 'Intro on piano',
        created_at: '2026-06-28T19:00:00.000Z',
        updated_at: '2026-06-28T19:05:00.000Z',
        client_updated_at: '2026-06-28T19:05:00.000Z',
        deleted_at: null,
      });
    });
  });

  describe('setlists mapper', () => {
    it('converts DbSetlist to SetlistRecord and vice-versa', () => {
      const dbSetlist: DbSetlist = {
        id: 'setlist-abc',
        workspace_id: 'work-123',
        name: 'Gig Summer',
        date: '2026-07-28',
        notes: 'Outdoor festival',
        closing_annotation: 'Goodbye!',
        bpm_display_mode: 'all',
        key_display_mode: 'per-song',
        created_at: '2026-06-28T19:00:00.000Z',
        updated_at: '2026-06-28T19:05:00.000Z',
        client_updated_at: '2026-06-28T19:05:00.000Z',
        deleted_at: null,
        server_version: 12,
        last_modified_by: 'user-xyz',
      };

      const localSetlist = toLocalSetlist(dbSetlist);

      expect(localSetlist).toEqual({
        id: 'setlist-abc',
        workspaceId: 'work-123',
        name: 'Gig Summer',
        date: '2026-07-28',
        notes: 'Outdoor festival',
        closingAnnotation: 'Goodbye!',
        bpmDisplayMode: 'all',
        keyDisplayMode: 'per-song',
        createdAt: mapTimestampToMs('2026-06-28T19:00:00.000Z')!,
        updatedAt: mapTimestampToMs('2026-06-28T19:05:00.000Z')!,
        deletedAt: undefined,
        serverVersion: 12,
        syncStatus: 'synced',
      });

      const convertedBack = toDbSetlist(localSetlist);

      expect(convertedBack).toEqual({
        id: 'setlist-abc',
        workspace_id: 'work-123',
        name: 'Gig Summer',
        date: '2026-07-28',
        notes: 'Outdoor festival',
        closing_annotation: 'Goodbye!',
        bpm_display_mode: 'all',
        key_display_mode: 'per-song',
        created_at: '2026-06-28T19:00:00.000Z',
        updated_at: '2026-06-28T19:05:00.000Z',
        client_updated_at: '2026-06-28T19:05:00.000Z',
        deleted_at: null,
      });
    });
  });

  describe('setlist songs mapper', () => {
    it('converts DbSetlistSong to SetlistSongRecord and vice-versa', () => {
      const dbSetlistSong: DbSetlistSong = {
        id: 'link-abc',
        workspace_id: 'work-123',
        setlist_id: 'set-abc',
        song_id: 'song-abc',
        position: 3,
        annotation: 'direct segue',
        note_show_bpm: true,
        note_show_key: false,
        is_direct_segue: true,
        created_at: '2026-06-28T19:00:00.000Z',
        updated_at: '2026-06-28T19:05:00.000Z',
        client_updated_at: '2026-06-28T19:05:00.000Z',
        deleted_at: null,
        server_version: 7,
        last_modified_by: 'user-xyz',
      };

      const localSetlistSong = toLocalSetlistSong(dbSetlistSong);

      expect(localSetlistSong).toEqual({
        id: 'link-abc',
        workspaceId: 'work-123',
        setlistId: 'set-abc',
        songId: 'song-abc',
        position: 3,
        annotation: 'direct segue',
        noteShowBpm: true,
        noteShowKey: false,
        isDirectSegue: true,
        createdAt: mapTimestampToMs('2026-06-28T19:00:00.000Z')!,
        updatedAt: mapTimestampToMs('2026-06-28T19:05:00.000Z')!,
        deletedAt: undefined,
        serverVersion: 7,
        syncStatus: 'synced',
      });

      const convertedBack = toDbSetlistSong(localSetlistSong);

      expect(convertedBack).toEqual({
        id: 'link-abc',
        workspace_id: 'work-123',
        setlist_id: 'set-abc',
        song_id: 'song-abc',
        position: 3,
        annotation: 'direct segue',
        note_show_bpm: true,
        note_show_key: false,
        is_direct_segue: true,
        created_at: '2026-06-28T19:00:00.000Z',
        updated_at: '2026-06-28T19:05:00.000Z',
        client_updated_at: '2026-06-28T19:05:00.000Z',
        deleted_at: null,
      });
    });
  });

  describe('song assets mapper', () => {
    it('converts DbSongAsset to SongAssetRecord and vice-versa', () => {
      const dbSongAsset: DbSongAsset = {
        id: 'asset-abc',
        workspace_id: 'work-123',
        song_id: 'song-abc',
        storage_path: 'workspaces/work-123/songs/song-abc/asset-abc.mp3',
        filename: 'guitar_track.mp3',
        mime_type: 'audio/mpeg',
        size_bytes: '1048576',
        duration_seconds: 180,
        created_at: '2026-06-28T19:00:00.000Z',
        updated_at: '2026-06-28T19:05:00.000Z',
        client_updated_at: '2026-06-28T19:05:00.000Z',
        deleted_at: null,
        server_version: 5,
        last_modified_by: 'user-xyz',
      };

      const localSongAsset = toLocalSongAsset(dbSongAsset);

      expect(localSongAsset).toEqual({
        id: 'asset-abc',
        workspaceId: 'work-123',
        songId: 'song-abc',
        storagePath: 'workspaces/work-123/songs/song-abc/asset-abc.mp3',
        filename: 'guitar_track.mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: 1048576,
        durationSeconds: 180,
        createdAt: mapTimestampToMs('2026-06-28T19:00:00.000Z')!,
        updatedAt: mapTimestampToMs('2026-06-28T19:05:00.000Z')!,
        deletedAt: undefined,
        serverVersion: 5,
        syncStatus: 'synced',
      });

      const convertedBack = toDbSongAsset(localSongAsset);

      expect(convertedBack).toEqual({
        id: 'asset-abc',
        workspace_id: 'work-123',
        song_id: 'song-abc',
        storage_path: 'workspaces/work-123/songs/song-abc/asset-abc.mp3',
        filename: 'guitar_track.mp3',
        mime_type: 'audio/mpeg',
        size_bytes: 1048576,
        duration_seconds: 180,
        created_at: '2026-06-28T19:00:00.000Z',
        updated_at: '2026-06-28T19:05:00.000Z',
        client_updated_at: '2026-06-28T19:05:00.000Z',
        deleted_at: null,
      });
    });

    it('keeps song assets unlinked when song_id is null', () => {
      const dbSongAsset: DbSongAsset = {
        id: 'asset-free',
        workspace_id: 'work-123',
        song_id: null,
        storage_path: 'workspaces/work-123/imports/asset-free.mp3',
        filename: 'free_track.mp3',
        mime_type: 'audio/mpeg',
        size_bytes: 2048,
        duration_seconds: null,
        created_at: '2026-06-28T19:00:00.000Z',
        updated_at: '2026-06-28T19:05:00.000Z',
        client_updated_at: '2026-06-28T19:05:00.000Z',
        deleted_at: null,
        server_version: 6,
        last_modified_by: null,
      };

      const localSongAsset = toLocalSongAsset(dbSongAsset);
      expect(localSongAsset.songId).toBeUndefined();
      expect(toDbSongAsset(localSongAsset).song_id).toBeNull();
    });
  });
});
