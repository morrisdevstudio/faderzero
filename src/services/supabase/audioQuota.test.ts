import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/services/supabase/client', () => ({ supabase: { rpc } }));

import { getCachedAudioQuota, refreshAudioQuota } from './audioQuota';

describe('audio quota service', () => {
  beforeEach(() => {
    rpc.mockReset();
    localStorage.clear();
  });

  it('normalizes and caches a quota snapshot', async () => {
    rpc.mockResolvedValue({
      data: {
        unit: 'bytes',
        usedAmount: '1024',
        reservedAmount: 512,
        limitAmount: '5368709120',
        remainingAmount: '5368707584',
        percentUsed: '0.1',
      },
      error: null,
    });

    await expect(refreshAudioQuota('workspace-1')).resolves.toMatchObject({
      unit: 'bytes',
      usedAmount: 1024,
      reservedAmount: 512,
    });
    expect(getCachedAudioQuota('workspace-1')?.limitAmount).toBe(5368709120);
  });

  it('rejects malformed server data without caching it', async () => {
    rpc.mockResolvedValue({ data: { unit: 'bytes' }, error: null });

    await expect(refreshAudioQuota('workspace-2')).rejects.toThrow('quota audio invalide');
    expect(getCachedAudioQuota('workspace-2')).toBeNull();
  });
});
