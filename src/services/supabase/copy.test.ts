import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copySongToWorkspace, listAvailableTargetWorkspaces } from './copy';
import { supabase } from './client';
import * as workspaceModule from './workspace';
import * as audioQuotaModule from './audioQuota';
import * as authModule from './auth';

vi.mock('./client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('copy service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authModule, 'getSession').mockResolvedValue({
      user: { id: 'user-1' },
    } as any);
  });

  it('listAvailableTargetWorkspaces excludes current workspace and read-only guest workspaces', async () => {
    vi.spyOn(workspaceModule, 'getUserWorkspaces').mockResolvedValue([
      { id: 'ws1', name: 'Ws 1', role: 'admin', type: 'group', createdBy: 'u1', createdAt: '', updatedAt: '' },
      { id: 'ws2', name: 'Ws 2', role: 'member', type: 'group', createdBy: 'u2', createdAt: '', updatedAt: '' },
      { id: 'ws3', name: 'Ws 3', role: 'guest', type: 'group', createdBy: 'u3', createdAt: '', updatedAt: '' },
    ]);

    const targets = await listAvailableTargetWorkspaces('ws1');
    expect(targets.map(t => t.id)).toEqual(['ws2']);
  });

  it('copySongToWorkspace calls RPC copy_song_to_workspace with parameters', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ data: [] }),
    } as any);

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        song_id: 'new-song-1',
        title: 'Ma chanson (copie 1)',
        target_workspace_id: 'ws2',
        include_audio: false,
      },
      error: null,
    } as any);

    const result = await copySongToWorkspace('song-1', 'ws2', { includeAudio: false });
    expect(result.songId).toBe('new-song-1');
    expect(result.title).toBe('Ma chanson (copie 1)');
    expect(supabase.rpc).toHaveBeenCalledWith('copy_song_to_workspace', {
      p_song_id: 'song-1',
      p_target_workspace_id: 'ws2',
      p_include_audio: false,
    });
  });

  it('copySongToWorkspace blocks copy if target audio quota would be exceeded', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({
        data: [{ size_bytes: 100000, duration_seconds: 120 }],
      }),
    } as any);

    vi.spyOn(audioQuotaModule, 'refreshAudioQuota').mockResolvedValueOnce({
      unit: 'bytes',
      usedAmount: 5 * 1024 * 1024 * 1024 - 10,
      reservedAmount: 0,
      limitAmount: 5 * 1024 * 1024 * 1024,
      remainingAmount: 10,
      percentUsed: 99.9,
    });

    await expect(copySongToWorkspace('song-1', 'ws2', { includeAudio: true })).rejects.toThrow(
      "l'espace de destination n'a pas assez de quota audio"
    );
  });
});
