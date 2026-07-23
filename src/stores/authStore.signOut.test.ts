import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activateDatabase, createDatabase, type FaderZeroDatabase } from '@/db/db';

const authMocks = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  supabase: { auth: { onAuthStateChange: vi.fn() } },
}));

vi.mock('@/services/supabase/auth', () => ({
  getSession: vi.fn(),
  signOut: authMocks.signOut,
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  changePassword: vi.fn(),
  completePasswordRecovery: vi.fn(),
  requestEmailChange: vi.fn(),
  requestPasswordReset: vi.fn(),
  resendSignupConfirmation: vi.fn(),
}));

vi.mock('@/services/supabase/sync', () => ({
  pushPendingMutations: vi.fn(),
  pullRemoteChanges: vi.fn(),
}));

vi.mock('@/services/supabase/accountDeletion', () => ({
  deleteCurrentAccount: vi.fn(),
  requestAccountDeletion: vi.fn(),
}));

import { useAuthStore } from '@/stores/authStore';

describe('safe sign out', () => {
  let database: FaderZeroDatabase;

  beforeEach(async () => {
    database = createDatabase(`auth-signout-${Date.now()}-${Math.random()}`);
    await database.open();
    activateDatabase(database);
    authMocks.signOut.mockReset();
    authMocks.signOut.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    useAuthStore.setState({
      session: {
        access_token: 'local-test',
        refresh_token: 'local-test',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'user-a', email: 'user@example.test' },
      } as never,
      workspaces: [],
      activeWorkspace: null,
      loading: false,
      error: null,
    });
  });

  afterEach(async () => {
    database.close();
    await database.delete();
  });

  it('blocks an offline sign out while a mutation has not been secured', async () => {
    await database.syncQueue.add({
      workspaceId: 'workspace-a',
      entityType: 'song',
      entityId: 'song-a',
      operation: 'create',
      payload: {},
      status: 'pending',
      queuedAt: 1,
    });

    await expect(useAuthStore.getState().signOut()).rejects.toThrow('1 modification(s) locale(s)');
    expect(authMocks.signOut).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session?.user.id).toBe('user-a');
  });

  it('signs out offline when no local mutation is at risk', async () => {
    await expect(useAuthStore.getState().signOut()).resolves.toBeUndefined();
    expect(authMocks.signOut).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().session).toBeNull();
  });
});
