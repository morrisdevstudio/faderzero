import LZString from 'lz-string';
import { db, type FaderZeroDatabase } from '@/db/db';
import type { SetlistRecord, SetlistSongRecord, SongRecord, SongStatus } from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';

export const SYNC_PROTOCOL = 'faderzero-sync';
export const SYNC_PROTOCOL_VERSION = 1;
export const SYNC_SOURCE_APP = 'faderzero-pwa';
export const QR_CHUNK_SIZE = 250;
export const MAX_QR_FRAGMENTS = 128;
export const MAX_QR_COMPRESSED_LENGTH = 32_768;
export const MAX_QR_FRAGMENT_LENGTH = 2_048;
export const MAX_QR_DECOMPRESSED_LENGTH = 1_048_576;
export const MAX_QR_RECORDS_PER_TYPE = 2_000;
const MAX_DECOMPRESSION_RATIO = 100;
const MAX_ID_LENGTH = 128;
const MAX_SHORT_TEXT_LENGTH = 512;
const MAX_LONG_TEXT_LENGTH = 500_000;
const PAYLOAD_HASH_PATTERN = /^[a-f0-9]{64}$/;
const SONG_STATUSES = new Set<SongStatus>(['Idee', 'En cours', 'Pret']);

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
  songIdCollisions: number;
  setlistIdCollisions: number;
  setlistSongIdCollisions: number;
  idsRegenerated: number;
}

function compareNumbers(left: number, right: number) {
  return left - right;
}

function compareStrings(left: string, right: string) {
  return left.localeCompare(right);
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertExactKeys(value: Record<string, unknown>, allowedKeys: readonly string[], label: string) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error(`${label} contains unexpected fields.`);
  }
}

function assertString(value: unknown, label: string, maximumLength: number, allowEmpty = false): asserts value is string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0) || value.length > maximumLength) {
    throw new Error(`${label} is invalid.`);
  }
}

function assertOptionalString(value: unknown, label: string, maximumLength: number) {
  if (value !== undefined) {
    assertString(value, label, maximumLength, true);
  }
}

function assertFiniteNumber(value: unknown, label: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} is invalid.`);
  }
}

function assertInteger(value: unknown, label: string, minimum: number, maximum: number): asserts value is number {
  assertFiniteNumber(value, label, minimum, maximum);
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
}

function assertIdentifier(value: unknown, label: string): asserts value is string {
  assertString(value, label, MAX_ID_LENGTH);
}

function validateSongPayload(value: unknown, index: number): asserts value is SyncSongPayload {
  const label = `payload.songs[${index}]`;
  assertRecord(value, label);
  assertExactKeys(value, ['id', 'title', 'artist', 'lyrics', 'key', 'bpm', 'status', 'durationSeconds', 'notes', 'createdAt', 'updatedAt'], label);
  assertIdentifier(value.id, `${label}.id`);
  assertString(value.title, `${label}.title`, MAX_SHORT_TEXT_LENGTH);
  assertOptionalString(value.artist, `${label}.artist`, MAX_SHORT_TEXT_LENGTH);
  assertString(value.lyrics, `${label}.lyrics`, MAX_LONG_TEXT_LENGTH, true);
  assertOptionalString(value.key, `${label}.key`, 32);
  if (value.bpm !== undefined) assertFiniteNumber(value.bpm, `${label}.bpm`, 1, 400);
  if (value.status !== undefined && (typeof value.status !== 'string' || !SONG_STATUSES.has(value.status as SongStatus))) {
    throw new Error(`${label}.status is invalid.`);
  }
  if (value.durationSeconds !== undefined) assertFiniteNumber(value.durationSeconds, `${label}.durationSeconds`, 0, 86_400);
  assertOptionalString(value.notes, `${label}.notes`, MAX_LONG_TEXT_LENGTH);
  assertFiniteNumber(value.createdAt, `${label}.createdAt`);
  assertFiniteNumber(value.updatedAt, `${label}.updatedAt`);
}

function validateSetlistPayload(value: unknown, index: number): asserts value is SyncSetlistPayload {
  const label = `payload.setlists[${index}]`;
  assertRecord(value, label);
  assertExactKeys(value, ['id', 'name', 'date', 'notes', 'createdAt', 'updatedAt'], label);
  assertIdentifier(value.id, `${label}.id`);
  assertString(value.name, `${label}.name`, MAX_SHORT_TEXT_LENGTH);
  assertOptionalString(value.date, `${label}.date`, 64);
  assertOptionalString(value.notes, `${label}.notes`, MAX_LONG_TEXT_LENGTH);
  assertFiniteNumber(value.createdAt, `${label}.createdAt`);
  assertFiniteNumber(value.updatedAt, `${label}.updatedAt`);
}

function validateSetlistSongPayload(value: unknown, index: number): asserts value is SyncSetlistSongPayload {
  const label = `payload.setlistSongs[${index}]`;
  assertRecord(value, label);
  assertExactKeys(value, ['id', 'setlistId', 'songId', 'position', 'createdAt', 'updatedAt'], label);
  assertIdentifier(value.id, `${label}.id`);
  assertIdentifier(value.setlistId, `${label}.setlistId`);
  assertIdentifier(value.songId, `${label}.songId`);
  assertInteger(value.position, `${label}.position`, 0, MAX_QR_RECORDS_PER_TYPE - 1);
  assertFiniteNumber(value.createdAt, `${label}.createdAt`);
  assertFiniteNumber(value.updatedAt, `${label}.updatedAt`);
}

function assertUniqueIds(records: Array<{ id: string }>, label: string) {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) {
      throw new Error(`${label} contains duplicate identifiers.`);
    }
    ids.add(record.id);
  }
}

function validateExportPayload(value: unknown): SyncExportPayload {
  assertRecord(value, 'QR payload');
  assertExactKeys(value, ['protocol', 'protocolVersion', 'exportedAt', 'sourceApp', 'payloadHash', 'payload'], 'QR payload');
  if (value.protocol !== SYNC_PROTOCOL || value.protocolVersion !== SYNC_PROTOCOL_VERSION || value.sourceApp !== SYNC_SOURCE_APP) {
    throw new Error('Unexpected sync protocol.');
  }
  assertFiniteNumber(value.exportedAt, 'QR payload exportedAt');
  if (typeof value.payloadHash !== 'string' || !PAYLOAD_HASH_PATTERN.test(value.payloadHash)) {
    throw new Error('QR payload hash is invalid.');
  }
  assertRecord(value.payload, 'QR payload data');
  assertExactKeys(value.payload, ['songs', 'setlists', 'setlistSongs'], 'QR payload data');
  const { songs, setlists, setlistSongs } = value.payload;
  if (!Array.isArray(songs) || !Array.isArray(setlists) || !Array.isArray(setlistSongs) ||
      songs.length > MAX_QR_RECORDS_PER_TYPE || setlists.length > MAX_QR_RECORDS_PER_TYPE || setlistSongs.length > MAX_QR_RECORDS_PER_TYPE) {
    throw new Error('QR payload exceeds allowed record limits.');
  }
  songs.forEach(validateSongPayload);
  setlists.forEach(validateSetlistPayload);
  setlistSongs.forEach(validateSetlistSongPayload);
  assertUniqueIds(songs, 'Songs');
  assertUniqueIds(setlists, 'Setlists');
  assertUniqueIds(setlistSongs, 'Setlist songs');

  const songIds = new Set(songs.map((song) => song.id));
  const setlistIds = new Set(setlists.map((setlist) => setlist.id));
  if (setlistSongs.some((entry) => !songIds.has(entry.songId) || !setlistIds.has(entry.setlistId))) {
    throw new Error('QR payload contains invalid relationships.');
  }

  return value as unknown as SyncExportPayload;
}

function validateQrFragment(value: unknown): SyncQrFragment {
  assertRecord(value, 'QR fragment');
  assertExactKeys(value, ['protocol', 'protocolVersion', 'transferId', 'index', 'total', 'payloadHash', 'chunk'], 'QR fragment');
  if (value.protocol !== SYNC_PROTOCOL || value.protocolVersion !== SYNC_PROTOCOL_VERSION) {
    throw new Error('Unexpected QR fragment protocol.');
  }
  assertIdentifier(value.transferId, 'QR fragment transferId');
  assertInteger(value.index, 'QR fragment index', 1, MAX_QR_FRAGMENTS);
  assertInteger(value.total, 'QR fragment total', 1, MAX_QR_FRAGMENTS);
  if (value.index > value.total) {
    throw new Error('QR fragment index exceeds total.');
  }
  if (typeof value.payloadHash !== 'string' || !PAYLOAD_HASH_PATTERN.test(value.payloadHash)) {
    throw new Error('QR fragment hash is invalid.');
  }
  assertString(value.chunk, 'QR fragment chunk', QR_CHUNK_SIZE);
  return value as unknown as SyncQrFragment;
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
  if (value.length === 0 || value.length > MAX_QR_FRAGMENT_LENGTH) {
    throw new Error('QR fragment exceeds the allowed size.');
  }

  return validateQrFragment(JSON.parse(value) as unknown);
}

export async function prepareSyncTransfer() {
  const payload = await collectSyncExportData();
  const exportPayload = await buildSyncExportPayload(payload);
  const compressedPayload = LZString.compressToEncodedURIComponent(JSON.stringify(exportPayload));
  const fragments = fragmentCompressedPayload(compressedPayload, exportPayload.payloadHash);

  if (compressedPayload.length > MAX_QR_COMPRESSED_LENGTH || fragments.length > MAX_QR_FRAGMENTS) {
    throw new Error('Sync export is too large for QR transfer.');
  }

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
  if (fragments.length > MAX_QR_FRAGMENTS) {
    throw new Error('Too many QR fragments.');
  }

  const parsedFragments = fragments.map((fragment) =>
    typeof fragment === 'string' ? deserializeSyncQrFragment(fragment) : validateQrFragment(fragment),
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
  if (sortedFragments.some((fragment, index) => fragment.index !== index + 1)) {
    throw new Error('Invalid QR fragment boundaries.');
  }

  const compressedPayload = sortedFragments.map((fragment) => fragment.chunk).join('');
  if (compressedPayload.length > MAX_QR_COMPRESSED_LENGTH) {
    throw new Error('QR transfer exceeds the allowed size.');
  }
  const decompressedPayload = LZString.decompressFromEncodedURIComponent(compressedPayload);

  if (!decompressedPayload) {
    throw new Error('Unable to decompress QR payload.');
  }

  if (decompressedPayload.length > MAX_QR_DECOMPRESSED_LENGTH ||
      decompressedPayload.length > compressedPayload.length * MAX_DECOMPRESSION_RATIO) {
    throw new Error('Decompressed QR payload exceeds the allowed size.');
  }

  const exportPayload = validateExportPayload(JSON.parse(decompressedPayload) as unknown);

  const recalculatedPayloadHash = await createPayloadHash(exportPayload.payload);
  if (recalculatedPayloadHash !== firstFragment.payloadHash || recalculatedPayloadHash !== exportPayload.payloadHash) {
    throw new Error('Payload hash mismatch.');
  }

  return exportPayload;
}

function createUniqueImportId(usedIds: Set<string>) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = createId();
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
  }

  throw new Error('Unable to allocate a unique import identifier.');
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
    const existingSongIds = new Set(await database.songs.toCollection().primaryKeys() as string[]);
    const existingSetlistIds = new Set(await database.setlists.toCollection().primaryKeys() as string[]);
    const existingSetlistSongIds = new Set(await database.setlistSongs.toCollection().primaryKeys() as string[]);
    const songIdMap = new Map<string, string>();
    const setlistIdMap = new Map<string, string>();

    const songsToAdd: SongRecord[] = exportPayload.payload.songs.map((song) => {
      const id = createUniqueImportId(existingSongIds);
      songIdMap.set(song.id, id);
      return {
        ...song,
        id,
        workspaceId: 'default-workspace',
        status: song.status ?? 'Idee',
        durationSeconds: song.durationSeconds ?? 0,
      };
    });

    const setlistsToAdd: SetlistRecord[] = exportPayload.payload.setlists.map((setlist) => {
      const id = createUniqueImportId(existingSetlistIds);
      setlistIdMap.set(setlist.id, id);
      return {
        ...setlist,
        id,
        workspaceId: 'default-workspace',
      };
    });

    const setlistSongsToAdd: SetlistSongRecord[] = exportPayload.payload.setlistSongs.map((setlistSong) => {
      const songId = songIdMap.get(setlistSong.songId);
      const setlistId = setlistIdMap.get(setlistSong.setlistId);
      if (!songId || !setlistId) {
        throw new Error('QR payload contains invalid relationships.');
      }

      return {
        ...setlistSong,
        id: createUniqueImportId(existingSetlistSongIds),
        songId,
        setlistId,
        workspaceId: 'default-workspace',
      };
    });

    if (songsToAdd.length > 0) {
      await database.songs.bulkAdd(songsToAdd);
    }
    if (setlistsToAdd.length > 0) {
      await database.setlists.bulkAdd(setlistsToAdd);
    }
    if (setlistSongsToAdd.length > 0) {
      await database.setlistSongs.bulkAdd(setlistSongsToAdd);
    }

    result.songsImported = songsToAdd.length;
    result.setlistsImported = setlistsToAdd.length;
    result.setlistSongsImported = setlistSongsToAdd.length;
  });

  return result;
}

export async function previewSyncImport(
  exportPayload: SyncExportPayload,
  database: FaderZeroDatabase = db,
): Promise<SyncImportPreview> {
  const existingSongIds = new Set(await database.songs.toCollection().primaryKeys() as string[]);
  const existingSetlistIds = new Set(await database.setlists.toCollection().primaryKeys() as string[]);
  const existingSetlistSongIds = new Set(await database.setlistSongs.toCollection().primaryKeys() as string[]);

  const preview: SyncImportPreview = {
    songsToCreate: exportPayload.payload.songs.length,
    songsToUpdate: 0,
    songsToSkip: 0,
    setlistsToCreate: exportPayload.payload.setlists.length,
    setlistsToUpdate: 0,
    setlistsToSkip: 0,
    setlistSongsToCreate: exportPayload.payload.setlistSongs.length,
    setlistSongsToUpdate: 0,
    setlistSongsToSkip: 0,
    songIdCollisions: exportPayload.payload.songs.filter((song) => existingSongIds.has(song.id)).length,
    setlistIdCollisions: exportPayload.payload.setlists.filter((setlist) => existingSetlistIds.has(setlist.id)).length,
    setlistSongIdCollisions: exportPayload.payload.setlistSongs.filter((entry) => existingSetlistSongIds.has(entry.id)).length,
    idsRegenerated: exportPayload.payload.songs.length + exportPayload.payload.setlists.length + exportPayload.payload.setlistSongs.length,
  };

  return preview;
}
