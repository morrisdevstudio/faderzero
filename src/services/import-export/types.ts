import type { SongAssetType, SongStatus } from '@/db/schema';
import type { SongDocumentV1 } from '@/db/songDocument';

export const FADERZERO_ARCHIVE_FORMAT = 'faderzero-song-library' as const;
export const FADERZERO_ARCHIVE_VERSION = 1 as const;

export interface ArchiveAssetV1 {
  id: string;
  path?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  assetType: SongAssetType;
  label?: string;
  recordedAt?: string;
  sortOrder: number;
  contentHash?: string;
}

export interface ArchiveSongV1 {
  originId?: string;
  folder: string;
  title: string;
  artist?: string;
  lyrics: string;
  lyricsDocument?: SongDocumentV1;
  key?: string;
  bpm?: number;
  status: SongStatus;
  durationSeconds: number;
  notes?: string;
  assets: ArchiveAssetV1[];
}

export interface FaderZeroArchiveV1 {
  format: typeof FADERZERO_ARCHIVE_FORMAT;
  version: typeof FADERZERO_ARCHIVE_VERSION;
  exportedAt: string;
  sourceWorkspaceId?: string;
  includesAudio: boolean;
  songs: ArchiveSongV1[];
}

export type ImportConflictPolicy = 'update' | 'create' | 'ignore';

export interface ImportPreviewIssue {
  severity: 'warning' | 'error';
  code: string;
  message: string;
  path?: string;
}

export interface ImportPreviewAsset extends ArchiveAssetV1 {
  valid: boolean;
  alreadyPresent: boolean;
  issues: ImportPreviewIssue[];
}

export interface ImportPreviewSong extends Omit<ArchiveSongV1, 'assets'> {
  valid: boolean;
  existingSongId?: string;
  decision: ImportConflictPolicy;
  issues: ImportPreviewIssue[];
  assets: ImportPreviewAsset[];
}

export interface ImportPreview {
  archive?: FaderZeroArchiveV1;
  songs: ImportPreviewSong[];
  issues: ImportPreviewIssue[];
  totalAudioBytes: number;
  bytesToUpload: number;
  durationSecondsToUpload: number;
  sourceEntries: Record<string, Uint8Array>;
}

export interface ImportReport {
  analyzed: number;
  created: number;
  updated: number;
  ignored: number;
  audioUploaded: number;
  audioReused: number;
  errors: Array<{ song: string; file?: string; message: string }>;
}

export type ArchiveProgress = {
  phase: 'analysis' | 'preparation' | 'upload' | 'finalization';
  progress: number;
  label: string;
  currentSong?: string;
  processedBytes?: number;
  totalBytes?: number;
};
