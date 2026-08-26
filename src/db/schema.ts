import type { SongDocumentV1 } from '@/db/songDocument';

export type SongStatus = 'Idee' | 'En cours' | 'Pret';
export type SetlistDisplayMode = 'all' | 'none' | 'per-song';

export interface SongRecord {
  id: string;
  workspaceId: string;
  title: string;
  artist?: string;
  lyrics: string;
  lyricsDocument?: SongDocumentV1;
  lyricsDocumentVersion?: 1;
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

export interface PendingAudioUploadRecord {
  id: string;
  workspaceId: string;
  songId?: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  fileBlob: Blob;
  status: 'pending' | 'uploading' | 'failed';
  queuedAt: number;
  updatedAt: number;
  lastTriedAt?: number;
  errorMessage?: string;
  normalizePeak?: boolean;
  durationSeconds?: number;
}


export type EventType = 'rehearsal' | 'concert' | 'meeting' | 'other';
export type BookingStage = 'to_contact' | 'contacted' | 'in_discussion' | 'option' | 'confirmed' | 'closed';
export type BookingPriority = 'low' | 'normal' | 'high';
export type BookingNoteType = 'email_sent' | 'call' | 'message_sent' | 'reply_received' | 'internal_decision' | 'free_note';

export interface PersonalContactRecord {
  id: string;
  ownerId: string;
  name: string;
  organization?: string | undefined;
  role?: string | undefined;
  city?: string | undefined;
  website?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  instagramUrl?: string | undefined;
  facebookUrl?: string | undefined;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  serverVersion?: number;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface WorkspaceContactRecord extends Omit<PersonalContactRecord, 'ownerId'> {
  workspaceId: string;
}

export interface BookingLeadRecord {
  id: string;
  workspaceId: string;
  venueName: string;
  city?: string | undefined;
  stage: BookingStage;
  priority: BookingPriority;
  targetDate?: string | undefined;
  targetPeriodStart?: string | undefined;
  targetPeriodEnd?: string | undefined;
  ownerId: string;
  nextAction: string;
  nextActionAt: number;
  feeAmount?: number | undefined;
  feeCurrency?: string | undefined;
  summary?: string | undefined;
  closeReason?: string | undefined;
  eventId?: string | undefined;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  serverVersion?: number;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface BookingNoteRecord {
  id: string;
  workspaceId: string;
  leadId: string;
  authorId: string;
  type: BookingNoteType;
  occurredAt: number;
  summary: string;
  result?: string | undefined;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  serverVersion?: number;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface BookingLeadContactRecord {
  id: string;
  workspaceId: string;
  leadId: string;
  contactId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  serverVersion?: number;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface EventRecord {
  id: string;
  workspaceId: string;
  title: string;
  eventType: EventType;
  startAt: number; // timestamp in ms
  endAt?: number;   // timestamp in ms
  location?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  serverVersion?: number;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface EventContactRecord {
  id: string;
  workspaceId: string;
  eventId: string;
  contactId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  serverVersion?: number;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface SyncQueueItem {
  id?: number;
  workspaceId: string;
  entityType: LocalEntityType;
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
  entityType: LocalEntityType;
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

export type LocalEntityType = 'song' | 'setlist' | 'setlistSong' | 'songAsset' | 'event' | 'eventContact' | 'personalContact' | 'workspaceContact' | 'bookingLead' | 'bookingNote' | 'bookingLeadContact';

export interface LocalMigrationJournalRecord {
  id: string;
  userId: string;
  sourceDatabaseName: string;
  workspaceFingerprint: string;
  status: 'in-progress' | 'completed' | 'failed';
  completedTables: string[];
  sourceCounts: Record<string, number>;
  copiedCounts: Record<string, number>;
  recoveryCount: number;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  errorMessage?: string;
}

export interface RecoveryItemRecord {
  id: string;
  entityType: LocalEntityType;
  entityId: string;
  sourceWorkspaceId: string;
  reason: 'default-workspace' | 'missing-workspace';
  payload: SongRecord | SetlistRecord | SetlistSongRecord | SongAssetRecord | EventRecord;
  status: 'pending' | 'recovered';
  createdAt: number;
  recoveredAt?: number;
  recoveredWorkspaceId?: string;
}

export interface DatabaseSchema {
  events: EventRecord;
  eventContacts: EventContactRecord;
  personalContacts: PersonalContactRecord;
  workspaceContacts: WorkspaceContactRecord;
  bookingLeads: BookingLeadRecord;
  bookingNotes: BookingNoteRecord;
  bookingLeadContacts: BookingLeadContactRecord;
  songs: SongRecord;
  setlists: SetlistRecord;
  setlistSongs: SetlistSongRecord;
  songAssets: SongAssetRecord;
  pendingAudioUploads: PendingAudioUploadRecord;
  syncQueue: SyncQueueItem;
  syncConflicts: SyncConflictRecord;
  syncState: SyncStateRecord;
  localMigrationJournal: LocalMigrationJournalRecord;
  recoveryItems: RecoveryItemRecord;
}

export interface CreateSongInput {
  title: string;
  artist?: string;
  lyrics?: string;
  lyricsDocument?: SongDocumentV1;
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
  lyricsDocument?: SongDocumentV1;
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


export interface CreateEventInput {
  title: string;
  eventType?: EventType;
  startAt: number;
  endAt?: number;
  location?: string;
  notes?: string;
}

export interface UpdateEventInput {
  title?: string;
  eventType?: EventType;
  startAt?: number;
  endAt?: number;
  location?: string;
  notes?: string;
  deletedAt?: number;
}
