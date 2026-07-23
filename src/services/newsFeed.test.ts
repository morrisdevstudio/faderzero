import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getWorkspaceNewsFeed } from './newsFeed';
import { db } from '@/db/db';

vi.mock('@/db/db', () => ({
  db: {
    songs: {
      where: vi.fn(),
    },
    songAssets: {
      where: vi.fn(),
    },
  },
}));

describe('newsFeed service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getWorkspaceNewsFeed sorts songs by creation date and detects audio assets', async () => {
    const mockSongs = [
      { id: 's1', workspaceId: 'ws1', title: 'First Song', createdAt: 1000 },
      { id: 's2', workspaceId: 'ws1', title: 'Newest Song', createdAt: 2000, copiedFromSongId: 's0', originalAuthor: 'Alice' },
    ];

    const mockAssets = [
      { id: 'a2', workspaceId: 'ws1', songId: 's2', filename: 'song2.mp3', durationSeconds: 180 },
    ];

    vi.mocked(db.songs.where).mockReturnValue({
      equals: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockSongs),
      }),
    } as any);

    vi.mocked(db.songAssets.where).mockReturnValue({
      equals: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockAssets),
      }),
    } as any);

    const feed = await getWorkspaceNewsFeed('ws1', 3);

    expect(feed.length).toBe(2);
    expect(feed[0]!.title).toBe('Newest Song');
    expect(feed[0]!.isCopy).toBe(true);
    expect(feed[0]!.originalAuthor).toBe('Alice');
    expect(feed[0]!.hasAudio).toBe(true);

    expect(feed[1]!.title).toBe('First Song');
    expect(feed[1]!.hasAudio).toBe(false);
  });
});
