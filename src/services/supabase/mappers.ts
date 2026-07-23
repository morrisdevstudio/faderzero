import type {
  SongRecord,
  SetlistRecord,
  SetlistSongRecord,
  SongAssetRecord,
  EventRecord,
} from '@/db/schema';

export interface DbSong {
  id: string;
  workspace_id: string;
  title: string;
  artist: string | null;
  lyrics: string;
  key: string | null;
  bpm: number | null;
  status: string;
  duration_seconds: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_updated_at: string | null;
  deleted_at: string | null;
  server_version: number;
  last_modified_by: string | null;
}

export interface DbSetlist {
  id: string;
  workspace_id: string;
  name: string;
  date: string | null;
  notes: string | null;
  closing_annotation: string | null;
  bpm_display_mode?: 'all' | 'none' | 'per-song' | null;
  key_display_mode?: 'all' | 'none' | 'per-song' | null;
  created_at: string;
  updated_at: string;
  client_updated_at: string | null;
  deleted_at: string | null;
  server_version: number;
  last_modified_by: string | null;
}

export interface DbSetlistSong {
  id: string;
  workspace_id: string;
  setlist_id: string;
  song_id: string;
  position: number;
  annotation: string | null;
  note_show_bpm: boolean;
  note_show_key: boolean;
  is_direct_segue: boolean;
  created_at: string;
  updated_at: string;
  client_updated_at: string | null;
  deleted_at: string | null;
  server_version: number;
  last_modified_by: string | null;
}

export interface DbSongAsset {
  id: string;
  workspace_id: string;
  song_id: string | null;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: string | number;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
  client_updated_at: string | null;
  deleted_at: string | null;
  server_version: number;
  last_modified_by: string | null;
}

export interface DbEvent {
  id: string;
  workspace_id: string;
  title: string;
  event_type: 'rehearsal' | 'concert' | 'meeting' | 'other';
  start_at: string;
  end_at: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_updated_at: string | null;
  deleted_at: string | null;
  server_version: number;
  last_modified_by: string | null;
}

export function mapTimestampToMs(timestamptz: string | null | undefined): number | undefined {
  if (!timestamptz) return undefined;
  return new Date(timestamptz).getTime();
}

export function mapMsToTimestamp(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined) return null;
  return new Date(ms).toISOString();
}

export function toLocalSong(dbSong: DbSong): SongRecord {
  const logicalUpdatedAt = mapTimestampToMs(dbSong.client_updated_at) ?? mapTimestampToMs(dbSong.updated_at)!;
  const song: SongRecord = {
    id: dbSong.id,
    workspaceId: dbSong.workspace_id,
    title: dbSong.title,
    lyrics: dbSong.lyrics,
    status: dbSong.status as any,
    durationSeconds: dbSong.duration_seconds,
    createdAt: mapTimestampToMs(dbSong.created_at)!,
    updatedAt: logicalUpdatedAt,
    syncStatus: 'synced',
  };

  if (dbSong.artist) song.artist = dbSong.artist;
  if (dbSong.key) song.key = dbSong.key;
  if (dbSong.bpm !== null && dbSong.bpm !== undefined) song.bpm = dbSong.bpm;
  if (dbSong.notes) song.notes = dbSong.notes;

  const deletedAt = mapTimestampToMs(dbSong.deleted_at);
  if (deletedAt !== undefined) song.deletedAt = deletedAt;

  if (dbSong.server_version !== undefined) {
    song.serverVersion = dbSong.server_version;
  }

  return song;
}

export function toDbSong(song: SongRecord): Omit<DbSong, 'server_version' | 'last_modified_by'> {
  return {
    id: song.id,
    workspace_id: song.workspaceId,
    title: song.title,
    artist: song.artist || null,
    lyrics: song.lyrics,
    key: song.key || null,
    bpm: song.bpm ?? null,
    status: song.status,
    duration_seconds: song.durationSeconds,
    notes: song.notes || null,
    created_at: mapMsToTimestamp(song.createdAt)!,
    updated_at: mapMsToTimestamp(song.updatedAt)!,
    client_updated_at: mapMsToTimestamp(song.updatedAt),
    deleted_at: mapMsToTimestamp(song.deletedAt),
  };
}

export function toLocalSetlist(dbSetlist: DbSetlist): SetlistRecord {
  const logicalUpdatedAt =
    mapTimestampToMs(dbSetlist.client_updated_at) ?? mapTimestampToMs(dbSetlist.updated_at)!;
  const setlist: SetlistRecord = {
    id: dbSetlist.id,
    workspaceId: dbSetlist.workspace_id,
    name: dbSetlist.name,
    createdAt: mapTimestampToMs(dbSetlist.created_at)!,
    updatedAt: logicalUpdatedAt,
    syncStatus: 'synced',
  };

  if (dbSetlist.date) setlist.date = dbSetlist.date;
  if (dbSetlist.notes) setlist.notes = dbSetlist.notes;
  if (dbSetlist.closing_annotation) {
    setlist.closingAnnotation = dbSetlist.closing_annotation;
  }
  setlist.bpmDisplayMode = dbSetlist.bpm_display_mode ?? 'per-song';
  setlist.keyDisplayMode = dbSetlist.key_display_mode ?? 'per-song';

  const deletedAt = mapTimestampToMs(dbSetlist.deleted_at);
  if (deletedAt !== undefined) setlist.deletedAt = deletedAt;

  if (dbSetlist.server_version !== undefined) {
    setlist.serverVersion = dbSetlist.server_version;
  }

  return setlist;
}

export function toDbSetlist(setlist: SetlistRecord): Omit<DbSetlist, 'server_version' | 'last_modified_by'> {
  return {
    id: setlist.id,
    workspace_id: setlist.workspaceId,
    name: setlist.name,
    date: setlist.date || null,
    notes: setlist.notes || null,
    closing_annotation: setlist.closingAnnotation || null,
    bpm_display_mode: setlist.bpmDisplayMode ?? 'per-song',
    key_display_mode: setlist.keyDisplayMode ?? 'per-song',
    created_at: mapMsToTimestamp(setlist.createdAt)!,
    updated_at: mapMsToTimestamp(setlist.updatedAt)!,
    client_updated_at: mapMsToTimestamp(setlist.updatedAt),
    deleted_at: mapMsToTimestamp(setlist.deletedAt),
  };
}

export function toLocalSetlistSong(dbSetlistSong: DbSetlistSong): SetlistSongRecord {
  const logicalUpdatedAt =
    mapTimestampToMs(dbSetlistSong.client_updated_at) ?? mapTimestampToMs(dbSetlistSong.updated_at)!;
  const setlistSong: SetlistSongRecord = {
    id: dbSetlistSong.id,
    workspaceId: dbSetlistSong.workspace_id,
    setlistId: dbSetlistSong.setlist_id,
    songId: dbSetlistSong.song_id,
    position: dbSetlistSong.position,
    noteShowBpm: dbSetlistSong.note_show_bpm,
    noteShowKey: dbSetlistSong.note_show_key,
    isDirectSegue: dbSetlistSong.is_direct_segue,
    createdAt: mapTimestampToMs(dbSetlistSong.created_at)!,
    updatedAt: logicalUpdatedAt,
    syncStatus: 'synced',
  };

  if (dbSetlistSong.annotation) setlistSong.annotation = dbSetlistSong.annotation;

  const deletedAt = mapTimestampToMs(dbSetlistSong.deleted_at);
  if (deletedAt !== undefined) setlistSong.deletedAt = deletedAt;

  if (dbSetlistSong.server_version !== undefined) {
    setlistSong.serverVersion = dbSetlistSong.server_version;
  }

  return setlistSong;
}

export function toDbSetlistSong(
  setlistSong: SetlistSongRecord
): Omit<DbSetlistSong, 'server_version' | 'last_modified_by'> {
  return {
    id: setlistSong.id,
    workspace_id: setlistSong.workspaceId,
    setlist_id: setlistSong.setlistId,
    song_id: setlistSong.songId,
    position: setlistSong.position,
    annotation: setlistSong.annotation || null,
    note_show_bpm: setlistSong.noteShowBpm ?? false,
    note_show_key: setlistSong.noteShowKey ?? false,
    is_direct_segue: setlistSong.isDirectSegue ?? false,
    created_at: mapMsToTimestamp(setlistSong.createdAt)!,
    updated_at: mapMsToTimestamp(setlistSong.updatedAt)!,
    client_updated_at: mapMsToTimestamp(setlistSong.updatedAt),
    deleted_at: mapMsToTimestamp(setlistSong.deletedAt),
  };
}

export function toLocalSongAsset(dbSongAsset: DbSongAsset): SongAssetRecord {
  const logicalUpdatedAt =
    mapTimestampToMs(dbSongAsset.client_updated_at) ?? mapTimestampToMs(dbSongAsset.updated_at)!;
  const songAsset: SongAssetRecord = {
    id: dbSongAsset.id,
    workspaceId: dbSongAsset.workspace_id,
    storagePath: dbSongAsset.storage_path,
    filename: dbSongAsset.filename,
    mimeType: dbSongAsset.mime_type,
    sizeBytes: Number(dbSongAsset.size_bytes),
    createdAt: mapTimestampToMs(dbSongAsset.created_at)!,
    updatedAt: logicalUpdatedAt,
    syncStatus: 'synced',
  };

  if (dbSongAsset.song_id !== null) {
    songAsset.songId = dbSongAsset.song_id;
  }

  if (dbSongAsset.duration_seconds !== null && dbSongAsset.duration_seconds !== undefined) {
    songAsset.durationSeconds = dbSongAsset.duration_seconds;
  }

  const deletedAt = mapTimestampToMs(dbSongAsset.deleted_at);
  if (deletedAt !== undefined) songAsset.deletedAt = deletedAt;

  if (dbSongAsset.server_version !== undefined) {
    songAsset.serverVersion = dbSongAsset.server_version;
  }

  return songAsset;
}

export function toDbSongAsset(
  songAsset: SongAssetRecord
): Omit<DbSongAsset, 'server_version' | 'last_modified_by'> {
  return {
    id: songAsset.id,
    workspace_id: songAsset.workspaceId,
    song_id: songAsset.songId ?? null,
    storage_path: songAsset.storagePath,
    filename: songAsset.filename,
    mime_type: songAsset.mimeType,
    size_bytes: songAsset.sizeBytes,
    duration_seconds: songAsset.durationSeconds || null,
    created_at: mapMsToTimestamp(songAsset.createdAt)!,
    updated_at: mapMsToTimestamp(songAsset.updatedAt)!,
    client_updated_at: mapMsToTimestamp(songAsset.updatedAt),
    deleted_at: mapMsToTimestamp(songAsset.deletedAt),
  };
}

export function toLocalEvent(dbEvent: DbEvent): EventRecord {
  const event: EventRecord = {
    id: dbEvent.id,
    workspaceId: dbEvent.workspace_id,
    title: dbEvent.title,
    eventType: dbEvent.event_type,
    startAt: mapTimestampToMs(dbEvent.start_at)!,
    createdAt: mapTimestampToMs(dbEvent.created_at)!,
    updatedAt: mapTimestampToMs(dbEvent.client_updated_at) ?? mapTimestampToMs(dbEvent.updated_at)!,
    syncStatus: 'synced',
    serverVersion: dbEvent.server_version,
  };
  const endAt = mapTimestampToMs(dbEvent.end_at);
  const deletedAt = mapTimestampToMs(dbEvent.deleted_at);
  if (endAt !== undefined) event.endAt = endAt;
  if (dbEvent.location) event.location = dbEvent.location;
  if (dbEvent.notes) event.notes = dbEvent.notes;
  if (deletedAt !== undefined) event.deletedAt = deletedAt;
  return event;
}

export function toDbEvent(event: EventRecord): Omit<DbEvent, 'server_version' | 'last_modified_by'> {
  return {
    id: event.id,
    workspace_id: event.workspaceId,
    title: event.title,
    event_type: event.eventType,
    start_at: mapMsToTimestamp(event.startAt)!,
    end_at: mapMsToTimestamp(event.endAt),
    location: event.location ?? null,
    notes: event.notes ?? null,
    created_at: mapMsToTimestamp(event.createdAt)!,
    updated_at: mapMsToTimestamp(event.updatedAt)!,
    client_updated_at: mapMsToTimestamp(event.updatedAt),
    deleted_at: mapMsToTimestamp(event.deletedAt),
  };
}
