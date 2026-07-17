export type SongStatus = 'Idee' | 'En cours' | 'Pret';
export type SetlistDisplayMode = 'all' | 'none' | 'per-song';

export interface SongRecord {
  id: string;
  workspaceId: string;
  title: string;
  artist?: string;
  lyrics: string;
  key?: string;
  bpm?: number;
  status: SongStatus;
  durationSeconds: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  serverVersion?: number;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface SetlistRecord {
  id: string;
  workspaceId: string;
  name: string;
  date?: string;
  notes?: string;
  closingAnnotation?: string;
  bpmDisplayMode?: SetlistDisplayMode;
  keyDisplayMode?: SetlistDisplayMode;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  serverVersion?: number;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface SetlistSongRecord {
  id: string;
  workspaceId: string;
  setlistId: string;
  songId: string;
  position: number;
  annotation?: string;
  noteShowBpm?: boolean;
  noteShowKey?: boolean;
  isDirectSegue?: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  serverVersion?: number;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface SongAssetRecord {
  id: string;
  workspaceId: string;
  songId?: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  serverVersion?: number;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface SyncQueueItem {
  id?: number;
  workspaceId: string;
  entityType: 'song' | 'setlist' | 'setlistSong' | 'songAsset';
  entityId: string;
  operation: 'create' | 'update' | 'soft_delete';
  payload: any;
  baseServerVersion?: number;
  status: 'pending' | 'processing' | 'failed' | 'conflict';
  queuedAt: number;
  retryCount?: number;
  lastTriedAt?: number;
  errorMessage?: string;
}

export interface SyncConflictRecord {
  id: string;
  workspaceId: string;
  entityType: 'song' | 'setlist' | 'setlistSong' | 'songAsset';
  entityId: string;
  localRecord: any;
  remoteRecord: any;
  resolvedAt?: number;
  detectedAt: number;
}

export interface SyncStateRecord {
  id: string;
  workspaceId: string;
  tableName: string;
  lastPulledVersion: number;
  lastPulledAt: number;
}

export interface DatabaseSchema {
  songs: SongRecord;
  setlists: SetlistRecord;
  setlistSongs: SetlistSongRecord;
  songAssets: SongAssetRecord;
  syncQueue: SyncQueueItem;
  syncConflicts: SyncConflictRecord;
  syncState: SyncStateRecord;
}

export interface CreateSongInput {
  title: string;
  artist?: string;
  lyrics?: string;
  key?: string;
  bpm?: number;
  status?: SongStatus;
  durationSeconds?: number;
  notes?: string;
}

export interface UpdateSongInput {
  title?: string;
  artist?: string;
  lyrics?: string;
  key?: string;
  bpm?: number;
  status?: SongStatus;
  durationSeconds?: number;
  notes?: string;
  deletedAt?: number;
}

export interface SongListOptions {
  query?: string;
  includeDeleted?: boolean;
}

export interface CreateSetlistInput {
  name: string;
  date?: string;
  notes?: string;
  closingAnnotation?: string;
  bpmDisplayMode?: SetlistDisplayMode;
  keyDisplayMode?: SetlistDisplayMode;
}

export interface UpdateSetlistInput {
  name?: string;
  date?: string;
  notes?: string;
  closingAnnotation?: string;
  bpmDisplayMode?: SetlistDisplayMode;
  keyDisplayMode?: SetlistDisplayMode;
  deletedAt?: number;
}

export interface SetlistListOptions {
  includeDeleted?: boolean;
}

export interface SetlistSummary {
  id: string;
  name: string;
  date?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  songCount: number;
  totalDurationSeconds: number;
}

export interface CreateSetlistSongInput {
  setlistId: string;
  songId: string;
  position: number;
}

export interface UpdateSetlistSongInput {
  position?: number;
  annotation?: string;
  noteShowBpm?: boolean;
  noteShowKey?: boolean;
  isDirectSegue?: boolean;
}

export interface SetlistSongDetail extends SetlistSongRecord {
  songTitle: string;
  songArtist?: string;
  songKey?: string;
  songBpm?: number;
}
