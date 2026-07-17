import LZString from 'lz-string';
import { db, type FaderZeroDatabase } from '@/db/db';
import type { SetlistRecord, SetlistSongRecord, SongRecord, SongStatus } from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';

export const SYNC_PROTOCOL = 'faderzero-sync';
export const SYNC_PROTOCOL_VERSION = 1;
export const SYNC_SOURCE_APP = 'faderzero-pwa';
export const QR_CHUNK_SIZE = 250;

export interface SyncSongPayload {
  id: string;
  title: string;
  artist?: string;
  lyrics: string;
  key?: string;
  bpm?: number;
  status?: SongStatus;
  durationSeconds?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SyncSetlistPayload {
  id: string;
  name: string;
  date?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SyncSetlistSongPayload {
  id: string;
  setlistId: string;
  songId: string;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface SyncExportPayload {
  protocol: typeof SYNC_PROTOCOL;
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  exportedAt: number;
  sourceApp: typeof SYNC_SOURCE_APP;
  payloadHash: string;
  payload: {
    songs: SyncSongPayload[];
    setlists: SyncSetlistPayload[];
    setlistSongs: SyncSetlistSongPayload[];
  };
}

export interface SyncQrFragment {
  protocol: typeof SYNC_PROTOCOL;
  protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  transferId: string;
  index: number;
  total: number;
  payloadHash: string;
  chunk: string;
}

export interface PreparedSyncTransfer {
  transferId: string;
  payloadHash: string;
  exportedAt: number;
  compressedPayload: string;
  exportPayload: SyncExportPayload;
  fragments: SyncQrFragment[];
  qrValues: string[];
}

export interface SyncImportResult {
  songsImported: number;
  songsSkipped: number;
  setlistsImported: number;
  setlistsSkipped: number;
  setlistSongsImported: number;
  setlistSongsSkipped: number;
}

export interface SyncImportPreview {
  songsToCreate: number;
  songsToUpdate: number;
  songsToSkip: number;
  setlistsToCreate: number;
  setlistsToUpdate: number;
  setlistsToSkip: number;
  setlistSongsToCreate: number;
  setlistSongsToUpdate: number;
  setlistSongsToSkip: number;
}

function compareNumbers(left: number, right: number) {
  return left - right;
}

function compareStrings(left: string, right: string) {
  return left.localeCompare(right);
}

function toSyncSong(song: SongRecord): SyncSongPayload {
  return {
    id: song.id,
    title: song.title,
    lyrics: song.lyrics,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
    ...(song.artist ? { artist: song.artist } : {}),
    ...(song.key ? { key: song.key } : {}),
    ...(song.bpm !== undefined ? { bpm: song.bpm } : {}),
    ...(song.status ? { status: song.status } : {}),
    ...(song.durationSeconds !== undefined ? { durationSeconds: song.durationSeconds } : {}),
    ...(song.notes ? { notes: song.notes } : {}),
  };
}

function toSyncSetlist(setlist: SetlistRecord): SyncSetlistPayload {
  return {
    id: setlist.id,
    name: setlist.name,
    createdAt: setlist.createdAt,
    updatedAt: setlist.updatedAt,
    ...(setlist.date ? { date: setlist.date } : {}),
    ...(setlist.notes ? { notes: setlist.notes } : {}),
  };
}

function toSyncSetlistSong(setlistSong: SetlistSongRecord): SyncSetlistSongPayload {
  return {
    id: setlistSong.id,
    setlistId: setlistSong.setlistId,
    songId: setlistSong.songId,
    position: setlistSong.position,
    createdAt: setlistSong.createdAt,
    updatedAt: setlistSong.updatedAt,
  };
}

export async function collectSyncExportData(database: FaderZeroDatabase = db) {
  const [allSongs, allSetlists, setlistSongs] = await Promise.all([
    database.songs.toArray(),
    database.setlists.toArray(),
    database.setlistSongs.toArray(),
  ]);
  const songs = allSongs.filter((song) => song.deletedAt === undefined);
  const setlists = allSetlists.filter((setlist) => setlist.deletedAt === undefined);

  const activeSongIds = new Set(songs.map((song) => song.id));
  const activeSetlistIds = new Set(setlists.map((setlist) => setlist.id));

  const filteredSetlistSongs = setlistSongs.filter(
    (entry) => activeSongIds.has(entry.songId) && activeSetlistIds.has(entry.setlistId),
  );

  return {
    songs: songs.sort((left, right) => compareStrings(left.id, right.id)).map(toSyncSong),
    setlists: setlists.sort((left, right) => compareStrings(left.id, right.id)).map(toSyncSetlist),
    setlistSongs: filteredSetlistSongs
      .sort((left, right) => {
        const bySetlist = compareStrings(left.setlistId, right.setlistId);
        if (bySetlist !== 0) {
          return bySetlist;
        }

        const byPosition = compareNumbers(left.position, right.position);
        if (byPosition !== 0) {
          return byPosition;
        }

        return compareStrings(left.id, right.id);
      })
      .map(toSyncSetlistSong),
  };
}

export async function createPayloadHash(payload: SyncExportPayload['payload']) {
  const input = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildSyncExportPayload(
  payload: SyncExportPayload['payload'],
  exportedAt = now(),
): Promise<SyncExportPayload> {
  const payloadHash = await createPayloadHash(payload);

  return {
    protocol: SYNC_PROTOCOL,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    exportedAt,
    sourceApp: SYNC_SOURCE_APP,
    payloadHash,
    payload,
  };
}

export function fragmentCompressedPayload(
  compressedPayload: string,
  payloadHash: string,
  transferId = createId(),
  chunkSize = QR_CHUNK_SIZE,
): SyncQrFragment[] {
  const rawChunks: string[] = [];

  for (let index = 0; index < compressedPayload.length; index += chunkSize) {
    rawChunks.push(compressedPayload.slice(index, index + chunkSize));
  }

  const total = rawChunks.length;

  return rawChunks.map((chunk, index) => ({
    protocol: SYNC_PROTOCOL,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    transferId,
    index: index + 1,
    total,
    payloadHash,
    chunk,
  }));
}

export function serializeSyncQrFragment(fragment: SyncQrFragment) {
  return JSON.stringify(fragment);
}

export function deserializeSyncQrFragment(value: string) {
  return JSON.parse(value) as SyncQrFragment;
}

export async function prepareSyncTransfer() {
  const payload = await collectSyncExportData();
  const exportPayload = await buildSyncExportPayload(payload);
  const compressedPayload = LZString.compressToEncodedURIComponent(JSON.stringify(exportPayload));
  const fragments = fragmentCompressedPayload(compressedPayload, exportPayload.payloadHash);

  return {
    transferId: fragments[0]?.transferId ?? createId(),
    payloadHash: exportPayload.payloadHash,
    exportedAt: exportPayload.exportedAt,
    compressedPayload,
    exportPayload,
    fragments,
    qrValues: fragments.map(serializeSyncQrFragment),
  } satisfies PreparedSyncTransfer;
}

export async function reconstructSyncExportPayload(
  fragments: Array<SyncQrFragment | string>,
): Promise<SyncExportPayload> {
  if (fragments.length === 0) {
    throw new Error('No fragments provided.');
  }

  const parsedFragments = fragments.map((fragment) =>
    typeof fragment === 'string' ? deserializeSyncQrFragment(fragment) : fragment,
  );
  const [firstFragment] = parsedFragments;
  if (!firstFragment) {
    throw new Error('No fragments provided.');
  }

  const sortedFragments = [...parsedFragments].sort((left, right) => compareNumbers(left.index, right.index));

  if (
    sortedFragments.some(
      (fragment) =>
        fragment.protocol !== SYNC_PROTOCOL ||
        fragment.protocolVersion !== SYNC_PROTOCOL_VERSION ||
        fragment.transferId !== firstFragment.transferId ||
        fragment.total !== firstFragment.total ||
        fragment.payloadHash !== firstFragment.payloadHash,
    )
  ) {
    throw new Error('Inconsistent fragment metadata.');
  }

  if (sortedFragments.length !== firstFragment.total) {
    throw new Error('Missing fragments for reconstruction.');
  }

  const compressedPayload = sortedFragments.map((fragment) => fragment.chunk).join('');
  const decompressedPayload = LZString.decompressFromEncodedURIComponent(compressedPayload);

  if (!decompressedPayload) {
    throw new Error('Unable to decompress QR payload.');
  }

  const exportPayload = JSON.parse(decompressedPayload) as SyncExportPayload;

  if (exportPayload.protocol !== SYNC_PROTOCOL || exportPayload.protocolVersion !== SYNC_PROTOCOL_VERSION) {
    throw new Error('Unexpected sync protocol.');
  }

  const recalculatedPayloadHash = await createPayloadHash(exportPayload.payload);
  if (recalculatedPayloadHash !== firstFragment.payloadHash || recalculatedPayloadHash !== exportPayload.payloadHash) {
    throw new Error('Payload hash mismatch.');
  }

  return exportPayload;
}

function shouldImportRecord(existingUpdatedAt: number | undefined, incomingUpdatedAt: number) {
  return existingUpdatedAt === undefined || incomingUpdatedAt >= existingUpdatedAt;
}

export async function applySyncImport(
  exportPayload: SyncExportPayload,
  database: FaderZeroDatabase = db,
): Promise<SyncImportResult> {
  const result: SyncImportResult = {
    songsImported: 0,
    songsSkipped: 0,
    setlistsImported: 0,
    setlistsSkipped: 0,
    setlistSongsImported: 0,
    setlistSongsSkipped: 0,
  };

  await database.transaction('rw', database.songs, database.setlists, database.setlistSongs, async () => {
    const existingSongs = new Map((await database.songs.toArray()).map((song) => [song.id, song]));
    const existingSetlists = new Map((await database.setlists.toArray()).map((setlist) => [setlist.id, setlist]));
    const existingSetlistSongs = new Map((await database.setlistSongs.toArray()).map((entry) => [entry.id, entry]));

    const songsToPut: SongRecord[] = [];
    for (const song of exportPayload.payload.songs) {
      const existingSong = existingSongs.get(song.id);
      if (!shouldImportRecord(existingSong?.updatedAt, song.updatedAt)) {
        result.songsSkipped += 1;
        continue;
      }

      songsToPut.push({
        ...song,
        workspaceId: 'default-workspace',
        status: song.status ?? 'Idee',
        durationSeconds: song.durationSeconds ?? 0,
      });
      result.songsImported += 1;
    }

    const setlistsToPut: SetlistRecord[] = [];
    for (const setlist of exportPayload.payload.setlists) {
      const existingSetlist = existingSetlists.get(setlist.id);
      if (!shouldImportRecord(existingSetlist?.updatedAt, setlist.updatedAt)) {
        result.setlistsSkipped += 1;
        continue;
      }

      setlistsToPut.push({
        ...setlist,
        workspaceId: 'default-workspace',
      });
      result.setlistsImported += 1;
    }

    const incomingSongIds = new Set(exportPayload.payload.songs.map((song) => song.id));
    const incomingSetlistIds = new Set(exportPayload.payload.setlists.map((setlist) => setlist.id));

    const setlistSongsToPut: SetlistSongRecord[] = [];
    for (const setlistSong of exportPayload.payload.setlistSongs) {
      if (!incomingSongIds.has(setlistSong.songId) || !incomingSetlistIds.has(setlistSong.setlistId)) {
        result.setlistSongsSkipped += 1;
        continue;
      }

      const existingSetlistSong = existingSetlistSongs.get(setlistSong.id);
      if (!shouldImportRecord(existingSetlistSong?.updatedAt, setlistSong.updatedAt)) {
        result.setlistSongsSkipped += 1;
        continue;
      }

      setlistSongsToPut.push({
        ...setlistSong,
        workspaceId: 'default-workspace',
      });
      result.setlistSongsImported += 1;
    }

    if (songsToPut.length > 0) {
      await database.songs.bulkPut(songsToPut);
    }
    if (setlistsToPut.length > 0) {
      await database.setlists.bulkPut(setlistsToPut);
    }
    if (setlistSongsToPut.length > 0) {
      await database.setlistSongs.bulkPut(setlistSongsToPut);
    }
  });

  return result;
}

export async function previewSyncImport(
  exportPayload: SyncExportPayload,
  database: FaderZeroDatabase = db,
): Promise<SyncImportPreview> {
  const existingSongs = new Map((await database.songs.toArray()).map((song) => [song.id, song]));
  const existingSetlists = new Map((await database.setlists.toArray()).map((setlist) => [setlist.id, setlist]));
  const existingSetlistSongs = new Map((await database.setlistSongs.toArray()).map((entry) => [entry.id, entry]));

  const preview: SyncImportPreview = {
    songsToCreate: 0,
    songsToUpdate: 0,
    songsToSkip: 0,
    setlistsToCreate: 0,
    setlistsToUpdate: 0,
    setlistsToSkip: 0,
    setlistSongsToCreate: 0,
    setlistSongsToUpdate: 0,
    setlistSongsToSkip: 0,
  };

  for (const song of exportPayload.payload.songs) {
    const existingSong = existingSongs.get(song.id);
    if (!existingSong) {
      preview.songsToCreate += 1;
    } else if (shouldImportRecord(existingSong.updatedAt, song.updatedAt)) {
      preview.songsToUpdate += 1;
    } else {
      preview.songsToSkip += 1;
    }
  }

  for (const setlist of exportPayload.payload.setlists) {
    const existingSetlist = existingSetlists.get(setlist.id);
    if (!existingSetlist) {
      preview.setlistsToCreate += 1;
    } else if (shouldImportRecord(existingSetlist.updatedAt, setlist.updatedAt)) {
      preview.setlistsToUpdate += 1;
    } else {
      preview.setlistsToSkip += 1;
    }
  }

  const incomingSongIds = new Set(exportPayload.payload.songs.map((song) => song.id));
  const incomingSetlistIds = new Set(exportPayload.payload.setlists.map((setlist) => setlist.id));

  for (const setlistSong of exportPayload.payload.setlistSongs) {
    if (!incomingSongIds.has(setlistSong.songId) || !incomingSetlistIds.has(setlistSong.setlistId)) {
      preview.setlistSongsToSkip += 1;
      continue;
    }

    const existingSetlistSong = existingSetlistSongs.get(setlistSong.id);
    if (!existingSetlistSong) {
      preview.setlistSongsToCreate += 1;
    } else if (shouldImportRecord(existingSetlistSong.updatedAt, setlistSong.updatedAt)) {
      preview.setlistSongsToUpdate += 1;
    } else {
      preview.setlistSongsToSkip += 1;
    }
  }

  return preview;
}
