import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copySongToWorkspace, listAvailableTargetWorkspaces } from './copy';
import { supabase } from './client';
import * as workspaceModule from './workspace';
import * as audioQuotaModule from './audioQuota';
import * as authModule from './auth';

const storageMocks = vi.hoisted(() => ({
  createStorageReadUrl: vi.fn(),
  uploadStorageObject: vi.fn(),
  deleteStorageObject: vi.fn(),
}));

vi.mock('@/services/storage', () => storageMocks);
vi.mock('@/lib/createId', () => ({ createId: vi.fn(() => 'target-asset-1') }));

vi.mock('./client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('copy service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.deleteStorageObject.mockResolvedValue(undefined);
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
      p_duplicate_audio: false,
    });
  });

  it('copySongToWorkspace blocks copy if target audio quota would be exceeded', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({
        data: [{ duration_seconds: 120 }],
      }),
    } as any);

    vi.spyOn(audioQuotaModule, 'refreshAudioQuota').mockResolvedValueOnce({
      unit: 'seconds',
      usedAmount: 40 * 60 * 60 - 10,
      reservedAmount: 0,
      limitAmount: 40 * 60 * 60,
      remainingAmount: 10,
      percentUsed: 99.9,
    });

    await expect(copySongToWorkspace('song-1', 'ws2', { includeAudio: true })).rejects.toThrow(
      "l'espace de destination a dépassé sa limite d'audio"
    );
  });

  it('copies each selected audio file into an independent target storage object', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'song_assets') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({
            data: [{
              workspace_id: 'source-workspace', storage_path: 'workspaces/source/songs/song-1/source.mp3',
              filename: 'source.mp3', mime_type: 'audio/mpeg', size_bytes: 4, duration_seconds: 12,
              asset_type: 'demo', label: 'Maquette', recorded_at: null, sort_order: 2, content_hash: 'hash',
            }],
          }),
          insert,
          delete: vi.fn().mockReturnThis(),
        } as any;
      }
      return { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() } as any;
    });
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { song_id: 'target-song', title: 'Copie', target_workspace_id: 'ws2', include_audio: true }, error: null,
    } as any);
    vi.spyOn(audioQuotaModule, 'refreshAudioQuota').mockResolvedValue({
      unit: 'seconds', usedAmount: 0, reservedAmount: 0, limitAmount: 144000, remainingAmount: 144000, percentUsed: 0,
    });
    storageMocks.createStorageReadUrl.mockResolvedValue('https://source.example/audio');
    storageMocks.uploadStorageObject.mockResolvedValue({ providerId: 'google_drive', physicalKey: 'target', storageObjectId: 'storage-object-1' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })));

    await copySongToWorkspace('song-1', 'ws2', { includeAudio: true });

    expect(storageMocks.createStorageReadUrl).toHaveBeenCalledWith('source-workspace', 'workspaces/source/songs/song-1/source.mp3');
    expect(storageMocks.uploadStorageObject).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'ws2', logicalKey: 'workspaces/ws2/songs/target-song/target-asset-1.mp3', contentHash: 'hash',
    }), expect.any(Blob));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      workspace_id: 'ws2', song_id: 'target-song', storage_path: 'workspaces/ws2/songs/target-song/target-asset-1.mp3',
      storage_object_id: 'storage-object-1', filename: 'source.mp3', asset_type: 'demo', sort_order: 2,
    }));
  });
});
