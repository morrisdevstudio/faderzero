import { describe, expect, it } from 'vitest';
import { selectInitialWorkspace } from '@/stores/authStore';
import type { Workspace } from '@/services/supabase/workspace';

const groupWorkspace: Workspace = {
  id: 'group-1',
  name: 'Groupe historique',
  createdBy: 'user-1',
  createdAt: '2026-07-20T10:00:00.000Z',
  updatedAt: '2026-07-20T10:00:00.000Z',
  role: 'admin',
  type: 'group',
};

const personalWorkspace: Workspace = {
  ...groupWorkspace,
  id: 'personal-1',
  name: 'Mon espace',
  type: 'personal',
};

describe('sélection initiale du workspace', () => {
  it('ouvre toujours Mon espace quand il existe', () => {
    localStorage.setItem('faderzero_active_workspace_id', groupWorkspace.id);
    expect(selectInitialWorkspace([groupWorkspace, personalWorkspace])).toEqual(personalWorkspace);
  });

  it('reste compatible avec un ancien cache sans espace personnel', () => {
    localStorage.setItem('faderzero_active_workspace_id', groupWorkspace.id);
    expect(selectInitialWorkspace([groupWorkspace])).toEqual(groupWorkspace);
  });
});


describe('createWorkspace store action', () => {
  it('ajoute syst?matiquement le nouveau groupe ? la liste des workspaces', async () => {
    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.setState({
      session: {
        access_token: 'test',
        refresh_token: 'test',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'user-1', email: 'test@example.com' },
      } as never,
      workspaces: [personalWorkspace],
      activeWorkspace: personalWorkspace,
      loading: false,
    });

    const initialCount = useAuthStore.getState().workspaces.length;

    // Simulate creating workspace locally/offline
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await useAuthStore.getState().createWorkspace('Nouveau Groupe Test');

    const state = useAuthStore.getState();
    expect(state.workspaces.length).toBe(initialCount + 1);
    expect(state.workspaces.some((w) => w.name === 'Nouveau Groupe Test')).toBe(true);
    expect(state.activeWorkspace?.name).toBe('Nouveau Groupe Test');
  });
});
