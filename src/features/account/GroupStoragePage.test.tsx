import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Workspace } from '@/services/supabase/workspace';
import { GroupStoragePage } from './GroupStoragePage';

const storageMocks = vi.hoisted(() => ({
  listWorkspaceStorageConnections: vi.fn(),
  setDefaultStorageConnection: vi.fn(),
  startGoogleDriveConnection: vi.fn(),
  transferWorkspaceStorage: vi.fn(),
}));

vi.mock('@/services/supabase/workspaceStorage', () => ({
  listWorkspaceStorageConnections: storageMocks.listWorkspaceStorageConnections,
  setDefaultStorageConnection: storageMocks.setDefaultStorageConnection,
  startGoogleDriveConnection: storageMocks.startGoogleDriveConnection,
}));

vi.mock('@/services/storage/storageTransfer', () => ({
  transferWorkspaceStorage: storageMocks.transferWorkspaceStorage,
}));

const workspace: Workspace = {
  id: 'workspace-1',
  name: 'Summers',
  createdBy: 'user-1',
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-25T10:00:00.000Z',
  role: 'admin',
  type: 'group',
};

describe('GroupStoragePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.listWorkspaceStorageConnections.mockResolvedValue([
      {
        id: 'google-1', workspaceId: workspace.id, providerId: 'google_drive', displayName: 'admin@example.test', rootIdentifier: 'folder-1',
        status: 'connected', isDefault: true, providerMetadata: {}, quotaUsedBytes: null, quotaLimitBytes: null,
      },
      {
        id: 'r2-1', workspaceId: workspace.id, providerId: 'faderzero_r2', displayName: 'Faderzero Cloud', rootIdentifier: 'r2://faderzero',
        status: 'connected', isDefault: false, providerMetadata: {}, quotaUsedBytes: null, quotaLimitBytes: null,
      },
    ]);
  });

  it('indique Google Drive comme destination et ne présente pas les échecs de transfert comme un succès', async () => {
    storageMocks.transferWorkspaceStorage.mockResolvedValue({ copied: 0, failed: [{ logicalKey: 'songs/test.mp3', message: 'Lecture impossible' }], completedAt: '2026-09-25T10:00:00.000Z' });

    render(<GroupStoragePage workspace={workspace} />);

    await screen.findByText('Google Drive');
    expect(screen.getAllByText('Nouveaux fichiers')).toHaveLength(2);
    expect(screen.getByText('Fichiers existants')).toHaveClass('bg-white/10');
    expect(screen.getByText('Fichiers existants accessibles')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Transférer les fichiers restants' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Aucun fichier n’a pu être transféré, 1 échec(s).');
    });
    expect(screen.getByRole('alert')).toHaveClass('text-rose-200');
  });
});
