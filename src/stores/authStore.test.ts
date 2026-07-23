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
