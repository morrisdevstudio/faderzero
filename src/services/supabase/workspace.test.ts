import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptWorkspaceInvite,
  buildWorkspaceInviteUrl,
  createWorkspaceInviteLink,
  extractWorkspaceInviteToken,
  resolveWorkspaceInvite,
} from './workspace';

const { insertMock, selectMock, singleMock, rpcMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
  rpcMock: vi.fn(),
}));

const fromBuilder = {
  insert: insertMock,
  select: selectMock,
  single: singleMock,
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
    rpcMock.mockReset();
    window.history.replaceState({}, '', '/account');
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

  it('creates an invite row and returns the share URL', async () => {
    insertMock.mockResolvedValue({ error: null });

    const invite = await createWorkspaceInviteLink('workspace-123');

    expect(invite.token).toBeTypeOf('string');
    expect(invite.url).toContain('?invite=');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: 'workspace-123',
        email: 'test@example.com',
        status: 'pending',
      }),
    );
  });

  it('maps the invite preview returned by the RPC', async () => {
    rpcMock.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          workspace_id: 'workspace-123',
          workspace_name: 'Band',
          status: 'pending',
          expires_at: '2026-08-01T12:00:00.000Z',
        },
        error: null,
      }),
    });

    await expect(resolveWorkspaceInvite('invite-abc')).resolves.toEqual({
      workspaceId: 'workspace-123',
      workspaceName: 'Band',
      status: 'pending',
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
