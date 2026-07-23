import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listTrashedItems, restoreTrashedContent, purgeExpiredTrash } from './trash';
import { supabase } from './client';
import * as audioQuotaModule from './audioQuota';

vi.mock('./client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('trash service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listTrashedItems formats trashed songs, setlists, and assets with 7-day expiration', async () => {
    const mockEq = vi.fn().mockReturnThis();
    const mockNot = vi.fn().mockReturnThis();
    const mockGte = vi.fn();

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'songs') {
        mockGte.mockResolvedValueOnce({
          data: [{ id: 's1', workspace_id: 'ws1', title: 'Chanson 1', deleted_at: new Date().toISOString() }],
        });
      } else if (table === 'setlists') {
        mockGte.mockResolvedValueOnce({
          data: [{ id: 'l1', workspace_id: 'ws1', name: 'Setlist 1', deleted_at: new Date().toISOString() }],
        });
      } else if (table === 'song_assets') {
        mockGte.mockResolvedValueOnce({
          data: [
            {
              id: 'a1',
              workspace_id: 'ws1',
              filename: 'demo.mp3',
              size_bytes: 1000,
              duration_seconds: 60,
              deleted_at: new Date().toISOString(),
            },
          ],
        });
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: mockEq,
        not: mockNot,
        gte: mockGte,
      } as any;
    });

    const items = await listTrashedItems('ws1');
    expect(items.length).toBe(3);
    expect(items.map(i => i.entityType)).toContain('song');
    expect(items.map(i => i.entityType)).toContain('setlist');
    expect(items.map(i => i.entityType)).toContain('songAsset');
  });

  it('restoreTrashedContent blocks restoration if group audio quota would be exceeded', async () => {
    vi.spyOn(audioQuotaModule, 'refreshAudioQuota').mockResolvedValueOnce({
      unit: 'bytes',
      usedAmount: 5 * 1024 * 1024 * 1024 - 100,
      reservedAmount: 0,
      limitAmount: 5 * 1024 * 1024 * 1024,
      remainingAmount: 100,
      percentUsed: 99.9,
    });

    const mockSingle = vi.fn().mockResolvedValue({
      data: { size_bytes: 1000, duration_seconds: 60 },
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    } as any);

    await expect(restoreTrashedContent('ws1', 'songAsset', 'a1')).rejects.toThrow(
      "quota d'espace de groupe"
    );
  });

  it('purgeExpiredTrash calculates count and respects dryRun flag', async () => {
    const mockLte = vi.fn().mockResolvedValue({
      data: [{ id: 'item-1' }],
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      lte: mockLte,
    } as any);

    const dryRunResult = await purgeExpiredTrash('ws1', true);
    expect(dryRunResult.dryRun).toBe(true);
    expect(dryRunResult.purgedCount).toBe(3);
  });
});
