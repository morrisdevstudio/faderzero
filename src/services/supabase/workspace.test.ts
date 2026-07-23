import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptWorkspaceInvite,
  buildWorkspaceInviteUrl,
  createWorkspace,
  createWorkspaceInviteLink,
  getUserWorkspaces,
  listWorkspaceInvites,
  listWorkspaceMembersWithProfiles,
  canAdministerWorkspace,
  canWriteWorkspace,
  extractWorkspaceInviteToken,
  leaveWorkspace,
  removeWorkspaceMember,
  revokeWorkspaceInvite,
  resolveWorkspaceInvite,
  setWorkspaceMemberRole,
  normalizeWorkspaceType,
} from './workspace';

const { insertMock, selectMock, singleMock, maybeSingleMock, eqMock, rpcMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  eqMock: vi.fn(),
  rpcMock: vi.fn(),
}));

const fromBuilder = {
  insert: insertMock,
  select: selectMock,
  single: singleMock,
  maybeSingle: maybeSingleMock,
  eq: eqMock,
};

vi.mock('./client', () => ({
  supabase: {
    from: vi.fn(() => fromBuilder),
    rpc: rpcMock,
  },
}));

vi.mock('./auth', () => ({
  getSession: vi.fn(async () => ({
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  })),
}));

describe('workspace invite helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockReturnValue(fromBuilder);
    selectMock.mockReturnValue(fromBuilder);
    singleMock.mockReset();
    maybeSingleMock.mockReset();
    eqMock.mockReset();
    rpcMock.mockReset();
    window.history.replaceState({}, '', '/account');
  });

  it('considère un ancien workspace sans type comme un groupe', () => {
    expect(normalizeWorkspaceType(undefined)).toBe('group');
    expect(normalizeWorkspaceType('personal')).toBe('personal');
  });

  it('builds an invite URL on the current origin', () => {
    expect(buildWorkspaceInviteUrl('invite-abc')).toBe(`${window.location.origin}/account?invite=invite-abc`);
  });

  it('extracts the invite token from a full shared URL', () => {
    expect(extractWorkspaceInviteToken('https://faderzero.test/account?invite=invite-abc')).toBe('invite-abc');
  });

  it('accepts a raw token when the user pastes only the token', () => {
    expect(extractWorkspaceInviteToken('invite-abc')).toBe('invite-abc');
  });

  it('creates an invite through the server RPC and returns the share URL', async () => {
    rpcMock.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          invite_id: 'invite-id',
          token: 'invite-secret',
          role: 'guest',
          expires_at: '2026-07-23T12:00:00.000Z',
        },
        error: null,
      }),
    });

    const invite = await createWorkspaceInviteLink('workspace-123', 'guest');

    expect(invite).toEqual({
      id: 'invite-id',
      token: 'invite-secret',
      url: `${window.location.origin}/account?invite=invite-secret`,
      role: 'guest',
      expiresAt: '2026-07-23T12:00:00.000Z',
    });
    expect(rpcMock).toHaveBeenCalledWith('create_workspace_invite', {
      p_workspace_id: 'workspace-123',
      p_role: 'guest',
    });
  });

  it('lists and revokes active invitations through RPCs', async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [{
          invite_id: 'invite-id',
          role: 'member',
          created_at: '2026-07-22T10:00:00.000Z',
          expires_at: '2026-07-23T10:00:00.000Z',
        }],
        error: null,
      })
      .mockResolvedValueOnce({ data: 'invite-id', error: null });

    await expect(listWorkspaceInvites('workspace-123')).resolves.toEqual([{
      id: 'invite-id',
      role: 'member',
      createdAt: '2026-07-22T10:00:00.000Z',
      expiresAt: '2026-07-23T10:00:00.000Z',
    }]);
    await revokeWorkspaceInvite('invite-id');

    expect(rpcMock).toHaveBeenNthCalledWith(2, 'revoke_workspace_invite', {
      p_invite_id: 'invite-id',
    });
  });

  it('creates a workspace and its admin membership through the transactional RPC', async () => {
    rpcMock.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'workspace-new',
          name: 'New band',
          created_by: 'user-123',
          created_at: '2026-07-20T20:00:00.000Z',
          updated_at: '2026-07-20T20:00:00.000Z',
          workspace_type: 'group',
          role: 'admin',
        },
        error: null,
      }),
    });

    await expect(createWorkspace('  New   band  ')).resolves.toMatchObject({
      id: 'workspace-new',
      name: 'New band',
      role: 'admin',
      type: 'group',
    });

    expect(rpcMock).toHaveBeenCalledWith('create_workspace', { p_name: 'New band' });
  });

  it('loads each workspace with the authenticated user role', async () => {
    eqMock.mockResolvedValue({
      data: [{
        role: 'guest',
        workspace: {
          id: 'workspace-guest',
          name: 'Guest band',
          created_by: 'user-456',
          created_at: '2026-07-20T20:00:00.000Z',
          updated_at: '2026-07-20T21:00:00.000Z',
          workspace_type: 'personal',
        },
      }],
      error: null,
    });

    await expect(getUserWorkspaces()).resolves.toEqual([{
      id: 'workspace-guest',
      name: 'Guest band',
      createdBy: 'user-456',
      createdAt: '2026-07-20T20:00:00.000Z',
      updatedAt: '2026-07-20T21:00:00.000Z',
      role: 'guest',
      type: 'personal',
    }]);
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-123');
  });

  it('loads group members using the deployed profile column names', async () => {
    eqMock.mockResolvedValue({
      data: [{
        id: 'membership-123',
        workspace_id: 'workspace-123',
        user_id: 'user-123',
        role: 'admin',
        created_at: '2026-07-23T10:00:00.000Z',
        updated_at: '2026-07-23T10:00:00.000Z',
        profile: { display_name: 'Yann', avatar_path: 'avatars/user-123.png' },
      }],
      error: null,
    });

    await expect(listWorkspaceMembersWithProfiles('workspace-123')).resolves.toEqual([{
      id: 'membership-123',
      workspaceId: 'workspace-123',
      userId: 'user-123',
      pseudo: 'Yann',
      avatarUrl: 'avatars/user-123.png',
      role: 'admin',
      createdAt: '2026-07-23T10:00:00.000Z',
      updatedAt: '2026-07-23T10:00:00.000Z',
    }]);

    expect(selectMock).toHaveBeenCalledWith(
      'id, workspace_id, user_id, role, created_at, updated_at, profile:profiles(display_name, avatar_path)',
    );
  });

  it('keeps guests read-only while members and admins can write', () => {
    expect(canWriteWorkspace('guest')).toBe(false);
    expect(canWriteWorkspace('member')).toBe(true);
    expect(canWriteWorkspace('admin')).toBe(true);
    expect(canWriteWorkspace(undefined)).toBe(false);
    expect(canAdministerWorkspace('guest')).toBe(false);
    expect(canAdministerWorkspace('member')).toBe(false);
    expect(canAdministerWorkspace('admin')).toBe(true);
  });

  it('maps the invite preview returned by the RPC', async () => {
    rpcMock.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          workspace_id: 'workspace-123',
          workspace_name: 'Band',
          status: 'pending',
          role: 'guest',
          expires_at: '2026-08-01T12:00:00.000Z',
        },
        error: null,
      }),
    });

    await expect(resolveWorkspaceInvite('invite-abc')).resolves.toEqual({
      workspaceId: 'workspace-123',
      workspaceName: 'Band',
      status: 'pending',
      role: 'guest',
      expiresAt: '2026-08-01T12:00:00.000Z',
    });
  });

  it('maps the accepted workspace returned by the RPC', async () => {
    rpcMock.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'workspace-123',
          name: 'Band',
          created_by: 'user-123',
          created_at: '2026-07-06T10:00:00.000Z',
          updated_at: '2026-07-06T10:00:00.000Z',
        },
        error: null,
      }),
    });

    await expect(acceptWorkspaceInvite('invite-abc')).resolves.toEqual({
      id: 'workspace-123',
      name: 'Band',
      createdBy: 'user-123',
      createdAt: '2026-07-06T10:00:00.000Z',
      updatedAt: '2026-07-06T10:00:00.000Z',
      role: 'guest',
      type: 'group',
    });
  });

  it('humanizes invite not found errors', async () => {
    rpcMock.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'INVITE_NOT_FOUND' },
      }),
    });

    await expect(acceptWorkspaceInvite('missing')).rejects.toThrow("Ce lien d'invitation est introuvable.");
  });

  it('humanizes expired invite errors', async () => {
    rpcMock.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'INVITE_EXPIRED' },
      }),
    });

    await expect(acceptWorkspaceInvite('expired')).rejects.toThrow("Ce lien d'invitation a expire.");
  });

  it('humanizes unavailable invite errors', async () => {
    rpcMock.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'INVITE_UNAVAILABLE' },
      }),
    });

    await expect(acceptWorkspaceInvite('used')).rejects.toThrow("Ce lien d'invitation n'est plus disponible.");
  });

  it('humanizes auth required errors', async () => {
    rpcMock.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'AUTH_REQUIRED' },
      }),
    });

    await expect(acceptWorkspaceInvite('private')).rejects.toThrow('Connectez-vous pour rejoindre ce groupe.');
  });

  it('changes a member role through the transactional RPC', async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: 'membership-123',
        workspace_id: 'workspace-123',
        user_id: 'user-456',
        role: 'guest',
        created_at: '2026-07-20T20:00:00.000Z',
        updated_at: '2026-07-20T21:00:00.000Z',
      },
      error: null,
    });

    await expect(setWorkspaceMemberRole('workspace-123', 'user-456', 'guest')).resolves.toEqual({
      id: 'membership-123',
      workspaceId: 'workspace-123',
      userId: 'user-456',
      role: 'guest',
      createdAt: '2026-07-20T20:00:00.000Z',
      updatedAt: '2026-07-20T21:00:00.000Z',
    });
  });

  it('removes and leaves memberships only through RPCs', async () => {
    rpcMock.mockResolvedValue({ data: 'membership-123', error: null });

    await removeWorkspaceMember('workspace-123', 'user-456');
    await leaveWorkspace('workspace-123');

    expect(rpcMock).toHaveBeenNthCalledWith(1, 'remove_workspace_member', {
      p_workspace_id: 'workspace-123',
      p_user_id: 'user-456',
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'leave_workspace', {
      p_workspace_id: 'workspace-123',
    });
  });

  it('falls back to details and code when message is missing', async () => {
    rpcMock.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { details: 'row missing', code: 'PGRST116' },
      }),
    });

    await expect(acceptWorkspaceInvite('mystery')).rejects.toThrow('row missing | PGRST116');
  });
});
