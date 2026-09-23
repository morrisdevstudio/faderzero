import { beforeEach, describe, expect, it, vi } from 'vitest';

const select = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn(() => ({ select })));
vi.mock('./client', () => ({ supabase: { from } }));

import { listWorkspaceStorageConnections } from './workspaceStorage';

describe('workspace storage connections', () => {
  beforeEach(() => {
    from.mockClear();
    select.mockReset();
  });

  it('lists only valid storage connections with the default first', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{
        id: 'connection-1', workspace_id: 'workspace-1', provider_id: 'faderzero_r2',
        display_name: 'Faderzero Cloud', root_identifier: 'r2://faderzero',
        status: 'connected', is_default: true,
      }],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    select.mockReturnValue({ eq });

    await expect(listWorkspaceStorageConnections('workspace-1')).resolves.toEqual([{
      id: 'connection-1', workspaceId: 'workspace-1', providerId: 'faderzero_r2',
      displayName: 'Faderzero Cloud', rootIdentifier: 'r2://faderzero', status: 'connected', isDefault: true,
      providerMetadata: {}, quotaUsedBytes: null, quotaLimitBytes: null,
    }]);
    expect(from).toHaveBeenCalledWith('workspace_storage_connections');
    expect(eq).toHaveBeenCalledWith('workspace_id', 'workspace-1');
    expect(order).toHaveBeenCalledWith('is_default', { ascending: false });
  });

  it('drops malformed rows returned by the data API', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'bad' }], error: null });
    select.mockReturnValue({ eq: vi.fn(() => ({ order })) });

    await expect(listWorkspaceStorageConnections('workspace-1')).resolves.toEqual([]);
  });
});
