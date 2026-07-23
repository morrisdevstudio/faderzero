import { db } from '@/db/db';
import type { SongAssetRecord } from '@/db/schema';

export interface NewsFeedItem {
  id: string;
  songId: string;
  workspaceId: string;
  title: string;
  artist?: string;
  createdAt: number;
  isCopy: boolean;
  originalAuthor?: string;
  hasAudio: boolean;
  audioDurationSeconds?: number;
}

export async function getWorkspaceNewsFeed(
  workspaceId: string,
  limit: number = 3
): Promise<NewsFeedItem[]> {
  const songs = await db.songs
    .where('workspaceId')
    .equals(workspaceId)
    .filter((song) => song.deletedAt === undefined)
    .toArray();

  // Sort by creation date descending (immutable arrival order)
  songs.sort((a, b) => b.createdAt - a.createdAt);

  const topSongs = songs.slice(0, limit);
  if (topSongs.length === 0) return [];

  const songIds = topSongs.map((s) => s.id);
  const assets = await db.songAssets
    .where('workspaceId')
    .equals(workspaceId)
    .filter((asset) => asset.deletedAt === undefined && asset.songId !== undefined && songIds.includes(asset.songId))
    .toArray();

  const assetsBySongId = new Map<string, SongAssetRecord>();
  for (const asset of assets) {
    if (asset.songId && !assetsBySongId.has(asset.songId)) {
      assetsBySongId.set(asset.songId, asset);
    }
  }

  return topSongs.map((song) => {
    const asset = assetsBySongId.get(song.id);
    const item: NewsFeedItem = {
      id: song.id,
      songId: song.id,
      workspaceId: song.workspaceId,
      title: song.title || 'Sans titre',
      createdAt: song.createdAt,
      isCopy: Boolean((song as any).copiedFromSongId),
      hasAudio: Boolean(asset),
    };
    if (song.artist) item.artist = song.artist;
    if ((song as any).originalAuthor) item.originalAuthor = (song as any).originalAuthor;
    if (asset?.durationSeconds !== undefined) item.audioDurationSeconds = asset.durationSeconds;
    return item;
  });
}
