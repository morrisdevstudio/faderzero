import { strFromU8, strToU8, unzip, zip } from 'fflate';
import type { SongAssetRecord, SongAssetType, SongRecord } from '@/db/schema';
import { songsRepository } from '@/db/repositories/songsRepository';
import { songAssetsRepository } from '@/db/repositories/songAssetsRepository';
import { uploadSongAsset } from '@/services/supabase/storage';
import { refreshAudioQuota } from '@/services/supabase/audioQuota';
import { listWorkspaceStorageConnections } from '@/services/supabase/workspaceStorage';
import {
  FADERZERO_ARCHIVE_FORMAT,
  FADERZERO_ARCHIVE_VERSION,
  type ArchiveAssetV1,
  type ArchiveProgress,
  type ArchiveSongV1,
  type FaderZeroArchiveV1,
  type ImportConflictPolicy,
  type ImportPreview,
  type ImportPreviewAsset,
  type ImportPreviewIssue,
  type ImportPreviewSong,
  type ImportReport,
} from './types';

const MANIFEST_PATH = 'faderzero.json';
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_ENTRIES = 20_000;
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'webm']);
const LYRICS_NAMES = new Set(['lyrics.txt', 'paroles.txt', 'lyrics.md', 'paroles.md']);

export interface CreateArchiveOptions {
  workspaceId: string;
  songs: SongRecord[];
  assets: SongAssetRecord[];
  includeAudio: boolean;
  readAudio?: (asset: SongAssetRecord) => Promise<Blob>;
  onProgress?: (progress: ArchiveProgress) => void;
}

export interface AnalyzeArchiveOptions {
  existingSongs?: SongRecord[];
  existingAssets?: SongAssetRecord[];
  onProgress?: (progress: ArchiveProgress) => void;
}

export async function createFaderZeroArchive(options: CreateArchiveOptions): Promise<Blob> {
  const activeSongs = options.songs.filter((song) => song.workspaceId === options.workspaceId && song.deletedAt === undefined);
  const assetsBySong = new Map<string, SongAssetRecord[]>();
  for (const asset of options.assets) {
    if (asset.workspaceId !== options.workspaceId || asset.deletedAt !== undefined || !asset.songId) continue;
    const list = assetsBySong.get(asset.songId) ?? [];
    list.push(asset);
    assetsBySong.set(asset.songId, list);
  }

  const usedFolders = new Set<string>();
  const entries: Record<string, Uint8Array> = {};
  const archiveSongs: ArchiveSongV1[] = [];
  let processedBytes = 0;
  const totalBytes = options.includeAudio
    ? options.assets.filter((asset) => asset.workspaceId === options.workspaceId && asset.deletedAt === undefined).reduce((sum, asset) => sum + asset.sizeBytes, 0)
    : 0;

  for (const [index, song] of activeSongs.entries()) {
    const folder = uniqueFolderName(song.title, usedFolders);
    const archiveAssets: ArchiveAssetV1[] = [];
    const songAssets = (assetsBySong.get(song.id) ?? []).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
    for (const asset of songAssets) {
      const safeFilename = sanitizeFilename(asset.filename || 'audio.mp3');
      const relativePath = `songs/${folder}/audio/${uniqueAssetName(safeFilename, archiveAssets)}`;
      let contentHash = asset.contentHash;
      if (options.includeAudio) {
        if (!options.readAudio) throw new Error('La lecture des fichiers audio est requise pour un export complet.');
        const blob = await options.readAudio(asset);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        contentHash ??= await sha256(bytes);
        entries[relativePath] = bytes;
        processedBytes += bytes.byteLength;
      }
      archiveAssets.push({
        id: asset.id,
        ...(options.includeAudio ? { path: relativePath } : {}),
        filename: asset.filename,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        ...(asset.durationSeconds !== undefined ? { durationSeconds: asset.durationSeconds } : {}),
        assetType: asset.assetType ?? 'other',
        ...(asset.label ? { label: asset.label } : {}),
        ...(asset.recordedAt ? { recordedAt: asset.recordedAt } : {}),
        sortOrder: asset.sortOrder ?? 0,
        ...(contentHash ? { contentHash } : {}),
      });
    }

    const archiveSong: ArchiveSongV1 = {
      originId: song.id,
      folder,
      title: song.title,
      ...(song.artist ? { artist: song.artist } : {}),
      lyrics: song.lyrics,
      ...(song.lyricsDocument ? { lyricsDocument: song.lyricsDocument } : {}),
      ...(song.key ? { key: song.key } : {}),
      ...(song.bpm !== undefined ? { bpm: song.bpm } : {}),
      status: song.status,
      durationSeconds: song.durationSeconds,
      ...(song.notes ? { notes: song.notes } : {}),
      assets: archiveAssets,
    };
    archiveSongs.push(archiveSong);
    entries[`songs/${folder}/song.json`] = jsonBytes(archiveSong);
    entries[`songs/${folder}/lyrics.txt`] = strToU8(song.lyrics);
    if (song.lyricsDocument) entries[`songs/${folder}/lyrics.faderzero.json`] = jsonBytes(song.lyricsDocument);
    options.onProgress?.({ phase: 'preparation', progress: Math.round(((index + 1) / Math.max(activeSongs.length, 1)) * 90), label: `Préparation de ${song.title}`, currentSong: song.title, processedBytes, totalBytes });
  }

  const manifest: FaderZeroArchiveV1 = {
    format: FADERZERO_ARCHIVE_FORMAT,
    version: FADERZERO_ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    sourceWorkspaceId: options.workspaceId,
    includesAudio: options.includeAudio,
    songs: archiveSongs,
  };
  entries[MANIFEST_PATH] = jsonBytes(manifest);
  options.onProgress?.({ phase: 'finalization', progress: 95, label: 'Création de l’archive', processedBytes, totalBytes });
  const zipped = await zipEntries(entries, options.includeAudio ? 1 : 6);
  options.onProgress?.({ phase: 'finalization', progress: 100, label: 'Archive prête', processedBytes, totalBytes });
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}

export async function analyzeArchiveFile(file: File, options: AnalyzeArchiveOptions = {}): Promise<ImportPreview> {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('Cette archive dépasse la taille maximale prise en charge.');
  options.onProgress?.({ phase: 'analysis', progress: 5, label: 'Ouverture de l’archive' });
  let entries: Record<string, Uint8Array>;
  try {
    entries = await unzipEntries(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error('Cette archive est illisible ou endommagée.');
  }
  return analyzeEntries(entries, options);
}

export async function analyzeFolderFiles(files: File[], options: AnalyzeArchiveOptions = {}): Promise<ImportPreview> {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    const path = normalizeSafePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
    entries[path] = new Uint8Array(await file.arrayBuffer());
  }
  return analyzeEntries(entries, options);
}

export async function analyzeEntries(rawEntries: Record<string, Uint8Array>, options: AnalyzeArchiveOptions = {}): Promise<ImportPreview> {
  const entryNames = Object.keys(rawEntries);
  if (entryNames.length > MAX_ENTRIES) throw new Error('Cette archive contient trop de fichiers.');
  const entries: Record<string, Uint8Array> = {};
  let unpackedBytes = 0;
  for (const rawName of entryNames) {
    if (rawName.replaceAll('\\', '/').endsWith('/')) continue;
    const name = normalizeSafePath(rawName);
    const entry = rawEntries[rawName];
    if (!entry) continue;
    unpackedBytes += entry.byteLength;
    if (unpackedBytes > MAX_ARCHIVE_BYTES) throw new Error('Le contenu décompressé dépasse la taille maximale prise en charge.');
    entries[name] = entry;
  }

  const manifestBytes = entries[MANIFEST_PATH];
  let archive: FaderZeroArchiveV1 | undefined;
  let songs: ArchiveSongV1[];
  if (manifestBytes) {
    const parsed = parseJson(manifestBytes, 'Le manifeste de l’archive est illisible.');
    archive = validateManifest(parsed);
    songs = archive.songs;
  } else {
    songs = inferSongsFromFolder(entries);
  }

  const existingSongs = options.existingSongs?.filter((song) => song.deletedAt === undefined) ?? [];
  const existingAssets = options.existingAssets?.filter((asset) => asset.deletedAt === undefined) ?? [];
  const existingHashes = new Set(existingAssets.flatMap((asset) => asset.contentHash ? [asset.contentHash] : []));
  const previewSongs: ImportPreviewSong[] = [];
  const globalIssues: ImportPreviewIssue[] = [];
  let totalAudioBytes = 0;
  let bytesToUpload = 0;
  let durationSecondsToUpload = 0;

  for (const [songIndex, song] of songs.entries()) {
    const issues: ImportPreviewIssue[] = [];
    const existing = findExistingSong(song, existingSongs);
    if (!song.title.trim()) issues.push(issue('error', 'missing-title', 'Le morceau n’a pas de titre.'));
    if (!song.lyrics.trim()) issues.push(issue('warning', 'missing-lyrics', 'Aucune parole détectée.'));
    if (song.bpm === undefined) issues.push(issue('warning', 'missing-bpm', 'BPM inconnu.'));
    const previewAssets: ImportPreviewAsset[] = [];

    for (const asset of song.assets) {
      const assetIssues: ImportPreviewIssue[] = [];
      if (asset.assetType === 'other') assetIssues.push(issue('warning', 'proposed-audio-type', `Type proposé pour ${asset.filename} : Autre.`, asset.path));
      const bytes = asset.path ? entries[normalizeSafePath(asset.path)] : undefined;
      if (archive?.includesAudio && !bytes) assetIssues.push(issue('error', 'missing-file', `Fichier audio manquant : ${asset.filename}`, asset.path));
      if (bytes && asset.contentHash) {
        const actualHash = await sha256(bytes);
        if (actualHash !== asset.contentHash) assetIssues.push(issue('error', 'hash-mismatch', `Le fichier ${asset.filename} a été altéré.`, asset.path));
      }
      const alreadyPresent = Boolean(asset.contentHash && existingHashes.has(asset.contentHash));
      totalAudioBytes += asset.sizeBytes;
      if (bytes && !alreadyPresent && !assetIssues.some((value) => value.severity === 'error')) {
        bytesToUpload += bytes.byteLength;
        durationSecondsToUpload += asset.durationSeconds ?? 0;
      }
      previewAssets.push({ ...asset, valid: !assetIssues.some((value) => value.severity === 'error'), alreadyPresent, issues: assetIssues });
    }
    previewSongs.push({ ...song, valid: !issues.some((value) => value.severity === 'error'), ...(existing ? { existingSongId: existing.id } : {}), decision: existing ? 'update' : 'create', issues, assets: previewAssets });
    options.onProgress?.({ phase: 'analysis', progress: Math.round(((songIndex + 1) / Math.max(songs.length, 1)) * 100), label: `Analyse de ${song.title || song.folder}`, currentSong: song.title || song.folder });
  }

  if (previewSongs.length === 0) globalIssues.push(issue('error', 'no-songs', 'Aucun morceau exploitable n’a été trouvé.'));
  return { ...(archive ? { archive } : {}), songs: previewSongs, issues: globalIssues, totalAudioBytes, bytesToUpload, durationSecondsToUpload, sourceEntries: entries };
}

export function setConflictPolicy(preview: ImportPreview, policy: ImportConflictPolicy): ImportPreview {
  return { ...preview, songs: preview.songs.map((song) => song.existingSongId ? { ...song, decision: policy } : song) };
}

export async function importPreview(
  workspaceId: string,
  preview: ImportPreview,
  onProgress?: (progress: ArchiveProgress) => void
): Promise<ImportReport> {
  const report: ImportReport = { analyzed: preview.songs.length, created: 0, updated: 0, ignored: 0, audioUploaded: 0, audioReused: 0, errors: [] };
  const validSongs = preview.songs.filter((song) => song.valid);
  const connections = await listWorkspaceStorageConnections(workspaceId);
  const defaultConnection = connections.find((connection) => connection.isDefault && connection.status === 'connected');
  if (defaultConnection?.providerId === 'faderzero_r2') {
    const quota = await refreshAudioQuota(workspaceId);
    if (preview.durationSecondsToUpload > quota.remainingAmount) {
      const missing = preview.durationSecondsToUpload - quota.remainingAmount;
      throw new Error(`Quota audio insuffisant : il manque ${Math.ceil(missing / 60)} min pour envoyer ${formatBytes(preview.bytesToUpload)}.`);
    }
  }
  const existingAssets = await songAssetsRepository.listImportedTracks();
  const assetByHash = new Map(existingAssets.flatMap((asset) => asset.contentHash ? [[asset.contentHash, asset] as const] : []));

  for (const [index, item] of validSongs.entries()) {
    if (item.decision === 'ignore') {
      report.ignored += 1;
      continue;
    }
    onProgress?.({ phase: 'upload', progress: Math.round((index / Math.max(validSongs.length, 1)) * 100), label: `Import de ${item.title}`, currentSong: item.title });
    try {
      let songId: string;
      const input = {
        title: item.title,
        lyrics: item.lyrics,
        status: item.status,
        durationSeconds: item.durationSeconds,
        ...(item.artist ? { artist: item.artist } : {}),
        ...(item.lyricsDocument ? { lyricsDocument: item.lyricsDocument } : {}),
        ...(item.key ? { key: item.key } : {}),
        ...(item.bpm !== undefined ? { bpm: item.bpm } : {}),
        ...(item.notes ? { notes: item.notes } : {}),
      };
      if (item.decision === 'update' && item.existingSongId) {
        await songsRepository.update(item.existingSongId, input);
        songId = item.existingSongId;
        report.updated += 1;
      } else {
        const created = await songsRepository.create(input);
        songId = created.id;
        report.created += 1;
      }

      for (const asset of item.assets.filter((value) => value.valid)) {
        try {
          const reused = asset.contentHash ? assetByHash.get(asset.contentHash) : undefined;
          if (reused) {
            await songAssetsRepository.create({
              workspaceId,
              songId,
              storagePath: reused.storagePath,
              ...(reused.audioFileId ? { audioFileId: reused.audioFileId } : {}),
              filename: asset.filename,
              mimeType: asset.mimeType,
              sizeBytes: asset.sizeBytes,
              ...(asset.durationSeconds !== undefined ? { durationSeconds: asset.durationSeconds } : {}),
              assetType: asset.assetType,
              ...(asset.label ? { label: asset.label } : {}),
              ...(asset.recordedAt ? { recordedAt: asset.recordedAt } : {}),
              sortOrder: asset.sortOrder,
              ...(asset.contentHash ? { contentHash: asset.contentHash } : {}),
            });
            report.audioReused += 1;
            continue;
          }
          if (!asset.path) continue;
          const bytes = preview.sourceEntries[normalizeSafePath(asset.path)];
          if (!bytes) continue;
          const file = new File([bytes as BlobPart], asset.filename, { type: asset.mimeType });
          const assetId = await uploadSongAsset(workspaceId, songId, file, { filename: asset.filename, ...(asset.durationSeconds !== undefined ? { durationSeconds: asset.durationSeconds } : {}), ...(asset.contentHash ? { contentHash: asset.contentHash } : {}), onProgress: (step) => onProgress?.({ phase: 'upload', progress: step.progress, label: step.label, currentSong: item.title }) });
          await songAssetsRepository.updateMetadata(assetId, { assetType: asset.assetType, sortOrder: asset.sortOrder, ...(asset.label ? { label: asset.label } : {}), ...(asset.recordedAt ? { recordedAt: asset.recordedAt } : {}), ...(asset.contentHash ? { contentHash: asset.contentHash } : {}) });
          report.audioUploaded += 1;
        } catch (error) {
          report.errors.push({ song: item.title, file: asset.filename, message: errorMessage(error) });
        }
      }
    } catch (error) {
      report.errors.push({ song: item.title, message: errorMessage(error) });
    }
  }
  onProgress?.({ phase: 'finalization', progress: 100, label: 'Import terminé' });
  return report;
}

export function downloadArchive(blob: Blob, filename = `faderzero-repertoire-${new Date().toISOString().slice(0, 10)}.zip`) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function validateManifest(value: unknown): FaderZeroArchiveV1 {
  if (!isRecord(value) || value.format !== FADERZERO_ARCHIVE_FORMAT) throw new Error('Ce fichier n’est pas une archive FaderZero.');
  if (value.version !== FADERZERO_ARCHIVE_VERSION) throw new Error('Cette archive utilise une version qui n’est pas encore prise en charge.');
  if (!Array.isArray(value.songs)) throw new Error('Le manifeste ne contient aucune liste de morceaux.');
  for (const song of value.songs) {
    if (!isRecord(song) || typeof song.folder !== 'string' || typeof song.title !== 'string' || !Array.isArray(song.assets)) throw new Error('Le manifeste contient un morceau invalide.');
    normalizeSafePath(`songs/${song.folder}`);
    for (const asset of song.assets) {
      if (!isRecord(asset) || typeof asset.filename !== 'string') throw new Error('Le manifeste contient un fichier audio invalide.');
      if (typeof asset.path === 'string') normalizeSafePath(asset.path);
    }
  }
  return value as unknown as FaderZeroArchiveV1;
}

function inferSongsFromFolder(entries: Record<string, Uint8Array>): ArchiveSongV1[] {
  const rootParts = Object.keys(entries).filter((path) => !path.endsWith('/')).map((path) => path.split('/'));
  const sharedRoot = rootParts[0]?.[0];
  const hasSharedRoot = Boolean(sharedRoot) && rootParts.every((parts) => parts.length > 2 && parts[0] === sharedRoot);
  const folders = new Map<string, Array<{ path: string; relative: string }>>();
  for (const path of Object.keys(entries)) {
    const parts = path.split('/');
    if (hasSharedRoot) parts.shift();
    if (parts.length < 2) continue;
    const folder = parts.shift()!;
    const list = folders.get(folder) ?? [];
    list.push({ path, relative: parts.join('/') });
    folders.set(folder, list);
  }
  return [...folders.entries()].map(([folder, files]) => {
    const lyricsFile = files.find((file) => LYRICS_NAMES.has(file.relative.toLocaleLowerCase()));
    const assets = files.filter((file) => AUDIO_EXTENSIONS.has(extension(file.relative))).map((file, index): ArchiveAssetV1 => {
      const filename = file.relative.split('/').pop()!;
      const [typePart = '', datePart = '', ...descriptionParts] = filename.replace(/\.[^.]+$/, '').split('__');
      const recordedAt = /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : undefined;
      const labelParts = recordedAt ? descriptionParts : [datePart, ...descriptionParts];
      const label = labelParts.filter(Boolean).join(' ').trim();
      return { id: `${folder}-${index}`, path: file.path, filename, mimeType: mimeFromExtension(extension(file.relative)), sizeBytes: entries[file.path]!.byteLength, assetType: inferAssetType(typePart), ...(recordedAt ? { recordedAt } : {}), ...(label ? { label } : {}), sortOrder: index };
    });
    return { folder, title: folder, lyrics: lyricsFile ? strFromU8(entries[lyricsFile.path]!) : '', status: 'Idee' as const, durationSeconds: 0, assets };
  }).filter((song) => song.assets.length > 0 || song.lyrics.length > 0);
}

function findExistingSong(song: ArchiveSongV1, existing: SongRecord[]) {
  if (song.originId) {
    const byId = existing.find((candidate) => candidate.id === song.originId);
    if (byId) return byId;
  }
  const title = normalizeCompare(song.title);
  const artist = normalizeCompare(song.artist ?? '');
  return existing.find((candidate) => normalizeCompare(candidate.title) === title && normalizeCompare(candidate.artist ?? '') === artist)
    ?? existing.find((candidate) => normalizeCompare(candidate.title) === title);
}

function normalizeSafePath(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/i.test(normalized) || normalized.split('/').some((part) => part === '..' || part === '')) throw new Error(`Chemin dangereux dans l’archive : ${path}`);
  return normalized;
}

function uniqueFolderName(title: string, used: Set<string>) {
  const base = sanitizeFilename(title) || 'Sans titre';
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLocaleLowerCase())) candidate = `${base} (${suffix++})`;
  used.add(candidate.toLocaleLowerCase());
  return candidate;
}

function uniqueAssetName(filename: string, assets: ArchiveAssetV1[]) {
  const names = new Set(assets.map((asset) => asset.path?.split('/').pop()?.toLocaleLowerCase()));
  if (!names.has(filename.toLocaleLowerCase())) return filename;
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : '';
  let index = 2;
  while (names.has(`${stem} (${index})${ext}`.toLocaleLowerCase())) index += 1;
  return `${stem} (${index})${ext}`;
}

function sanitizeFilename(value: string) {
  const forbidden = '<>:"/\\|?*';
  return [...value]
    .map((character) => character.charCodeAt(0) < 32 || forbidden.includes(character) ? '_' : character)
    .join('')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 120);
}

function inferAssetType(filename: string): SongAssetType {
  const prefix = (filename.split('__', 1)[0] ?? '').toLocaleUpperCase();
  if (prefix === 'DEMO') return 'demo';
  if (prefix === 'REPETITION' || prefix === 'RÉPÉTITION' || prefix === 'REHEARSAL') return 'rehearsal';
  if (prefix === 'MIX') return 'mix';
  if (prefix === 'MASTER') return 'master';
  if (prefix === 'LIVE') return 'live';
  return 'other';
}

async function sha256(bytes: Uint8Array) {
  const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', source);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function jsonBytes(value: unknown) { return strToU8(`${JSON.stringify(value, null, 2)}\n`); }
function parseJson(bytes: Uint8Array, message: string) { try { return JSON.parse(strFromU8(bytes)) as unknown; } catch { throw new Error(message); } }
function extension(path: string) { return path.split('.').pop()?.toLocaleLowerCase() ?? ''; }
function mimeFromExtension(ext: string) { return ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : ext === 'flac' ? 'audio/flac' : ext === 'webm' ? 'audio/webm' : ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg'; }
function normalizeCompare(value: string) { return value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function issue(severity: ImportPreviewIssue['severity'], code: string, message: string, path?: string): ImportPreviewIssue { return { severity, code, message, ...(path ? { path } : {}) }; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Erreur inconnue'; }
function formatBytes(bytes: number) { return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} Go` : `${Math.ceil(bytes / 1024 ** 2)} Mo`; }

function zipEntries(entries: Record<string, Uint8Array>, level: 1 | 6): Promise<Uint8Array> {
  return new Promise((resolve, reject) => zip(entries, { level }, (error, data) => error ? reject(error) : resolve(data)));
}

function unzipEntries(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => unzip(bytes, (error, data) => error ? reject(error) : resolve(data)));
}
