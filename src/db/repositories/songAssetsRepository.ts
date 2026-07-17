import type { FaderZeroDatabase } from '@/db/db';
import { db } from '@/db/db';
import type { SongAssetRecord, SongRecord } from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';
import { useAuthStore } from '@/stores/authStore';
import { enqueueMutation } from '@/db/syncQueueHelper';

export class SongAssetsRepository {
  private readonly database: FaderZeroDatabase;

  constructor(database: FaderZeroDatabase = db) {
    this.database = database;
  }

  private getActiveWorkspaceId(): string {
    return useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
  }

  async listBySongId(songId: string, includeDeleted = false) {
    const assets = await this.database.songAssets.where('songId').equals(songId).toArray();
    return assets
      .filter((asset) => includeDeleted || asset.deletedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async listImportedTracks(): Promise<Array<SongAssetRecord & { song?: SongRecord }>> {
    const workspaceId = this.getActiveWorkspaceId();
    const [assets, songs] = await Promise.all([
      this.database.songAssets.where('workspaceId').equals(workspaceId).toArray(),
      this.database.songs.where('workspaceId').equals(workspaceId).toArray(),
    ]);
    const songsById = new Map(
      songs
        .filter((song) => song.deletedAt === undefined)
        .map((song) => [song.id, song] as const)
    );

    return assets
      .filter((asset) => asset.deletedAt === undefined)
      .map((asset) => {
        const song = asset.songId ? songsById.get(asset.songId) : undefined;
        return song ? { ...asset, song } : asset;
      })
      .sort((left, right) => right.createdAt - left.createdAt);
  }

  async listUnlinkedTracks() {
    const tracks = await this.listImportedTracks();
    return tracks.filter((track) => track.songId === undefined);
  }

  async getById(id: string) {
    return this.database.songAssets.get(id);
  }

  async create(input: {
    id?: string;
    songId?: string;
    storagePath: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds?: number;
  }) {
    const timestamp = now();
    const workspaceId = this.getActiveWorkspaceId();

    const asset: SongAssetRecord = {
      id: input.id || createId(),
      workspaceId,
      storagePath: input.storagePath,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    if (input.songId !== undefined) {
      asset.songId = input.songId;
    }

    if (input.durationSeconds !== undefined) {
      asset.durationSeconds = input.durationSeconds;
    }

    await this.database.transaction('rw', this.database.songAssets, this.database.syncQueue, async () => {
      await this.database.songAssets.add(asset);
      await enqueueMutation(
        this.database,
        workspaceId,
        'songAsset',
        asset.id,
        'create',
        {
          songId: asset.songId,
          storagePath: asset.storagePath,
          filename: asset.filename,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          durationSeconds: asset.durationSeconds,
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
        }
      );
    });

    return asset;
  }

  async linkToSong(assetId: string, songId: string) {
    const existing = await this.database.songAssets.get(assetId);
    if (!existing) {
      throw new Error(`Song asset not found: ${assetId}`);
    }

    const timestamp = now();
    const linkedAsset: SongAssetRecord = {
      ...existing,
      songId,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    await this.database.transaction('rw', this.database.songAssets, this.database.syncQueue, async () => {
      await this.database.songAssets.put(linkedAsset);
      await enqueueMutation(
        this.database,
        linkedAsset.workspaceId,
        'songAsset',
        linkedAsset.id,
        'update',
        {
          songId,
          updatedAt: timestamp,
        },
        existing.serverVersion
      );
    });

    return linkedAsset;
  }

  async softDelete(id: string) {
    const existing = await this.database.songAssets.get(id);
    if (!existing) {
      throw new Error(`Song asset not found: ${id}`);
    }

    const timestamp = now();
    const deletedAsset: SongAssetRecord = {
      ...existing,
      deletedAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    await this.database.transaction('rw', this.database.songAssets, this.database.syncQueue, async () => {
      await this.database.songAssets.put(deletedAsset);
      await enqueueMutation(
        this.database,
        deletedAsset.workspaceId,
        'songAsset',
        deletedAsset.id,
        'soft_delete',
        { deletedAt: timestamp },
        existing.serverVersion
      );
    });

    return deletedAsset;
  }
}

export const songAssetsRepository = new SongAssetsRepository();
