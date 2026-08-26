import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const copyMocks = vi.hoisted(() => ({
  listAvailableTargetWorkspaces: vi.fn(),
  copyWorkspaceContactToWorkspace: vi.fn(),
}));

vi.mock('@/services/supabase/copy', () => ({ listAvailableTargetWorkspaces: copyMocks.listAvailableTargetWorkspaces }));
vi.mock('@/db/repositories/bookingRepository', () => ({ bookingRepository: { copyWorkspaceContactToWorkspace: copyMocks.copyWorkspaceContactToWorkspace } }));

import { CopyContactModal } from './CopyContactModal';

const contact = {
  id: 'contact-1', workspaceId: 'workspace-1', name: 'Clara Martin', organization: 'Le Chabada',
  createdAt: 1, updatedAt: 1, syncStatus: 'synced' as const,
};

describe('CopyContactModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copyMocks.listAvailableTargetWorkspaces.mockResolvedValue([{ id: 'workspace-2', name: 'The Band', type: 'group' }]);
    copyMocks.copyWorkspaceContactToWorkspace.mockResolvedValue({ id: 'contact-copy' });
  });

  it('copies a contact only to another writable workspace', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<CopyContactModal contact={contact} availableWorkspaces={[{ id: 'workspace-2', name: 'The Band', type: 'group', role: 'admin', createdBy: 'user-1', createdAt: '', updatedAt: '' }]} isOpen onClose={onClose} onSuccess={onSuccess} />);

    expect(screen.getByRole('dialog', { name: 'Copier vers un autre espace' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Espace de destination')).toHaveValue('workspace-2'));
    fireEvent.click(screen.getByRole('button', { name: 'Copier le contact' }));

    await waitFor(() => expect(copyMocks.copyWorkspaceContactToWorkspace).toHaveBeenCalledWith('contact-1', 'workspace-2'));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('uses cached writable workspaces when offline', async () => {
    copyMocks.listAvailableTargetWorkspaces.mockRejectedValueOnce(new Error('offline'));
    render(<CopyContactModal contact={contact} availableWorkspaces={[{ id: 'workspace-2', name: 'The Band', type: 'group', role: 'member', createdBy: 'user-1', createdAt: '', updatedAt: '' }]} isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Espace de destination')).toHaveValue('workspace-2'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copier le contact' }));
    await waitFor(() => expect(copyMocks.copyWorkspaceContactToWorkspace).toHaveBeenCalledWith('contact-1', 'workspace-2'));
  });
});
