import { describe, expect, it, vi, beforeEach } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import type { SongAssetRecord, SongRecord } from '@/db/schema';

const mocks = vi.hoisted(() => ({
  createSong: vi.fn(), updateSong: vi.fn(), createAsset: vi.fn(), updateMetadata: vi.fn(), listAssets: vi.fn(),
  upload: vi.fn(), quota: vi.fn(), listConnections: vi.fn(),
}));

vi.mock('@/db/repositories/songsRepository', () => ({ songsRepository: { create: mocks.createSong, update: mocks.updateSong } }));
vi.mock('@/db/repositories/songAssetsRepository', () => ({ songAssetsRepository: { create: mocks.createAsset, updateMetadata: mocks.updateMetadata, listImportedTracks: mocks.listAssets } }));
vi.mock('@/services/supabase/storage', () => ({ uploadSongAsset: mocks.upload }));
vi.mock('@/services/supabase/audioQuota', () => ({ refreshAudioQuota: mocks.quota }));
vi.mock('@/services/supabase/workspaceStorage', () => ({ listWorkspaceStorageConnections: mocks.listConnections }));

import { analyzeArchiveFile, analyzeEntries, analyzeFolderFiles, createFaderZeroArchive, importPreview } from './archive';

const song: SongRecord = {
  id: 'song-1', workspaceId: 'workspace-1', title: 'Intro / Été', artist: 'Groupe', lyrics: 'Bonjour',
  key: 'C', bpm: 120, status: 'Pret', durationSeconds: 180, notes: 'Note', createdAt: 1, updatedAt: 1,
};
const asset: SongAssetRecord = {
  id: 'asset-1', workspaceId: 'workspace-1', songId: 'song-1', storagePath: 'workspaces/w/songs/s/a.mp3',
  filename: 'MASTER__2026-09-20__Final.mp3', mimeType: 'audio/mpeg', sizeBytes: 3, durationSeconds: 30,
  assetType: 'master', label: 'Final', recordedAt: '2026-09-20', sortOrder: 2, createdAt: 1, updatedAt: 1,
};

describe('Archive FaderZero v1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSong.mockResolvedValue({ id: 'created-song' });
    mocks.listAssets.mockResolvedValue([]);
    mocks.quota.mockResolvedValue({ remainingAmount: 10_000 });
    mocks.listConnections.mockResolvedValue([{ providerId: 'faderzero_r2', isDefault: true, status: 'connected' }]);
    mocks.upload.mockResolvedValue('uploaded-asset');
  });

  it('exporte et réanalyse les données sans audio', async () => {
    const blob = await createFaderZeroArchive({ workspaceId: 'workspace-1', songs: [song], assets: [asset], includeAudio: false });
    const preview = await analyzeArchiveFile(new File([blob], 'backup.zip', { type: 'application/zip' }));

    expect(preview.archive?.version).toBe(1);
    expect(preview.archive?.includesAudio).toBe(false);
    expect(preview.songs[0]).toMatchObject({ title: 'Intro / Été', valid: true, decision: 'create' });
    expect(preview.songs[0]?.assets[0]).toMatchObject({ filename: asset.filename, assetType: 'master' });
    expect(preview.bytesToUpload).toBe(0);
  });

  it('conserve les audios et vérifie leur empreinte avant import', async () => {
    const blob = await createFaderZeroArchive({ workspaceId: 'workspace-1', songs: [song], assets: [asset], includeAudio: true, readAudio: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }) });
    const preview = await analyzeArchiveFile(new File([blob], 'backup.zip'));

    expect(preview.songs[0]?.assets[0]).toMatchObject({ valid: true, alreadyPresent: false });
    expect(preview.bytesToUpload).toBe(3);
    expect(preview.durationSecondsToUpload).toBe(30);
  });

  it('signale un audio altéré avant tout envoi', async () => {
    const blob = await createFaderZeroArchive({ workspaceId: 'workspace-1', songs: [song], assets: [asset], includeAudio: true, readAudio: async () => new Blob([new Uint8Array([1, 2, 3])]) });
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const audioPath = Object.keys(entries).find((path) => path.endsWith('.mp3'))!;
    entries[audioPath] = new Uint8Array([9, 9, 9]);
    const tampered = zipSync(entries);
    const preview = await analyzeArchiveFile(new File([tampered as BlobPart], 'tampered.zip'));

    expect(preview.songs[0]?.assets[0]?.valid).toBe(false);
    expect(preview.songs[0]?.assets[0]?.issues).toContainEqual(expect.objectContaining({ code: 'hash-mismatch' }));
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('refuse les chemins qui sortent de l’archive', async () => {
    await expect(analyzeEntries({ '../danger.mp3': new Uint8Array([1]) })).rejects.toThrow('Chemin dangereux');
  });

  it('refuse une version future sans tenter d’importer', async () => {
    const manifest = { format: 'faderzero-song-library', version: 99, exportedAt: new Date().toISOString(), includesAudio: false, songs: [] };
    const zipped = zipSync({ 'faderzero.json': strToU8(JSON.stringify(manifest)) });
    await expect(analyzeArchiveFile(new File([zipped as BlobPart], 'future.zip'))).rejects.toThrow('version qui n’est pas encore prise en charge');
    expect(mocks.createSong).not.toHaveBeenCalled();
  });

  it('comprend un dossier maison sans manifeste', async () => {
    const lyrics = new File(['Couplet'], 'paroles.txt');
    Object.defineProperty(lyrics, 'webkitRelativePath', { value: 'Catalogue/Nouveau titre/paroles.txt' });
    const audio = new File([new Uint8Array([1])], 'DEMO__idee.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(audio, 'webkitRelativePath', { value: 'Catalogue/Nouveau titre/DEMO__idee.mp3' });
    const preview = await analyzeFolderFiles([lyrics, audio]);

    expect(preview.songs[0]).toMatchObject({ title: 'Nouveau titre', lyrics: 'Couplet' });
    expect(preview.songs[0]?.assets[0]).toMatchObject({ assetType: 'demo', label: 'idee' });
  });

  it('n’écrit rien pendant l’analyse puis crée après confirmation', async () => {
    const blob = await createFaderZeroArchive({ workspaceId: 'workspace-1', songs: [song], assets: [], includeAudio: false });
    const preview = await analyzeArchiveFile(new File([blob], 'backup.zip'));
    expect(mocks.createSong).not.toHaveBeenCalled();

    const report = await importPreview('workspace-1', preview);
    expect(mocks.createSong).toHaveBeenCalledOnce();
    expect(report).toMatchObject({ created: 1, updated: 0, errors: [] });
  });

  it('bloque avant écriture quand le quota est insuffisant', async () => {
    mocks.quota.mockResolvedValue({ remainingAmount: 5 });
    const blob = await createFaderZeroArchive({ workspaceId: 'workspace-1', songs: [song], assets: [asset], includeAudio: true, readAudio: async () => new Blob([new Uint8Array([1, 2, 3])]) });
    const preview = await analyzeArchiveFile(new File([blob], 'backup.zip'));

    await expect(importPreview('workspace-1', preview)).rejects.toThrow('Quota audio insuffisant');
    expect(mocks.createSong).not.toHaveBeenCalled();
  });

  it('réutilise un audio de même empreinte sans nouvel envoi ni quota', async () => {
    const blob = await createFaderZeroArchive({ workspaceId: 'workspace-1', songs: [song], assets: [asset], includeAudio: true, readAudio: async () => new Blob([new Uint8Array([1, 2, 3])]) });
    const firstPreview = await analyzeArchiveFile(new File([blob], 'backup.zip'));
    const contentHash = firstPreview.songs[0]?.assets[0]?.contentHash;
    if (!contentHash) throw new Error('Empreinte absente du test');
    const existing = { ...asset, id: 'existing-asset', audioFileId: 'audio-file-1', contentHash };
    mocks.listAssets.mockResolvedValue([existing]);
    const preview = await analyzeArchiveFile(new File([blob], 'backup.zip'), { existingAssets: [existing] });

    expect(preview.bytesToUpload).toBe(0);
    const report = await importPreview('workspace-1', preview);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.createAsset).toHaveBeenCalledWith(expect.objectContaining({ audioFileId: 'audio-file-1', contentHash }));
    expect(report.audioReused).toBe(1);
  });
});
