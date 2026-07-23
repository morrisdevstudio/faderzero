import { beforeEach, describe, expect, it, vi } from 'vitest';

const deletionMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSession: vi.fn(),
  signInWithOtp: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  assertSupabaseConfig: vi.fn(),
  supabase: {
    rpc: deletionMocks.rpc,
    auth: {
      getSession: deletionMocks.getSession,
      signInWithOtp: deletionMocks.signInWithOtp,
    },
  },
}));

import {
  deleteCurrentAccount,
  getAccountDeletionBlockers,
  getAccountDeletionToken,
  requestAccountDeletion,
} from '@/services/supabase/accountDeletion';

describe('suppression de compte', () => {
  beforeEach(() => {
    deletionMocks.rpc.mockReset();
    deletionMocks.getSession.mockReset();
    deletionMocks.signInWithOtp.mockReset();
  });

  it('retourne les groupes qui bloquent la suppression', async () => {
    deletionMocks.rpc.mockResolvedValue({
      data: [{ workspace_id: 'group-1', workspace_name: 'Groupe bloquant' }],
      error: null,
    });
    await expect(getAccountDeletionBlockers()).resolves.toEqual([
      { workspaceId: 'group-1', workspaceName: 'Groupe bloquant' },
    ]);
  });

  it('demande au serveur un token brut et l’envoie uniquement dans le lien magique', async () => {
    const token = 'b'.repeat(64);
    deletionMocks.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockReturnValueOnce({
        single: vi.fn().mockResolvedValue({
          data: { token, expires_at: '2026-07-22T14:00:00.000Z' },
          error: null,
        }),
      });
    deletionMocks.getSession.mockResolvedValue({
      data: { session: { user: { email: 'compte@example.test' } } },
      error: null,
    });
    deletionMocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });

    await requestAccountDeletion();

    const requestCall = deletionMocks.rpc.mock.calls[1]!;
    expect(requestCall[0]).toBe('create_account_deletion_request');
    expect(requestCall).toHaveLength(1);
    const emailOptions = deletionMocks.signInWithOtp.mock.calls[0]![0];
    expect(emailOptions.email).toBe('compte@example.test');
    expect(emailOptions.options.shouldCreateUser).toBe(false);
    const confirmationUrl = new URL(emailOptions.options.emailRedirectTo);
    expect(confirmationUrl.searchParams.get('delete-account')).toBe(token);
  });

  it('valide le token de confirmation avant la RPC destructive', async () => {
    const token = 'a'.repeat(64);
    deletionMocks.rpc.mockResolvedValue({ data: true, error: null });

    await deleteCurrentAccount(token);

    expect(deletionMocks.rpc).toHaveBeenCalledWith('delete_current_account', { p_token: token });
    expect(getAccountDeletionToken(`?delete-account=${token}`)).toBe(token);
    await expect(deleteCurrentAccount('invalide')).rejects.toThrow('Lien de suppression invalide');
  });
});
