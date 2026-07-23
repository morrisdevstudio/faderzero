import { supabase } from './client';
import { getSession } from './auth';

export interface Workspace {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  logoUrl?: string | null;
  role: WorkspaceRole;
  type: WorkspaceType;
}

export type WorkspaceRole = 'admin' | 'member' | 'guest';
export type WorkspaceType = 'personal' | 'group';

export function normalizeWorkspaceType(type: unknown): WorkspaceType {
  return type === 'personal' ? 'personal' : 'group';
}

export function normalizeWorkspaceRole(role: unknown): WorkspaceRole {
  if (role === 'owner' || role === 'admin') return 'admin';
  if (role === 'member') return 'member';
  return 'guest';
}

export function canWriteWorkspace(role: WorkspaceRole | null | undefined): boolean {
  return role === 'admin' || role === 'member';
}

export function canAdministerWorkspace(role: WorkspaceRole | null | undefined): boolean {
  return role === 'admin';
}

export function normalizeWorkspaceName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ');
}

export async function checkWorkspaceNameAvailable(name: string, excludeWorkspaceId?: string): Promise<boolean> {
  const normalized = normalizeWorkspaceName(name);
  if (!normalized) return false;
  try {
    const { data, error } = await supabase.rpc('check_workspace_name_available', {
      p_name: normalized,
      p_exclude_workspace_id: excludeWorkspaceId || null,
    });
    if (error) return true;
    return Boolean(data);
  } catch {
    return true;
  }
}

export interface WorkspaceInviteLink {
  id: string;
  token: string;
  url: string;
  role: WorkspaceRole;
  expiresAt: string;
}

export interface WorkspaceInviteSummary {
  id: string;
  role: WorkspaceRole;
  createdAt: string;
  expiresAt: string;
}

export interface WorkspaceInvitePreview {
  workspaceId: string;
  workspaceName: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  role: WorkspaceRole;
  expiresAt: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  pseudo?: string;
  avatarUrl?: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

function stringifyWorkspaceError(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as Record<string, unknown>;
  const parts = [candidate.message, candidate.details, candidate.hint, candidate.code, candidate.error_description]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  if (parts.length > 0) {
    return parts.join(' | ');
  }

  try {
    return JSON.stringify(candidate);
  } catch {
    return null;
  }
}

function normalizeWorkspaceError(error: unknown): Error {
  const normalizedMessage = stringifyWorkspaceError(error) ?? (error instanceof Error ? error.message : null);

  if (normalizedMessage) {
    if (
      normalizedMessage.includes('permission denied for table workspaces') ||
      normalizedMessage.includes('permission denied for table workspace_members')
    ) {
      return new Error(
        "La base Supabase n'autorise pas encore l'acces aux tables workspace pour le role authenticated. Executez `pwa/supabase/sql/05_fix_workspace_permissions.sql` dans Supabase Studio, puis rechargez la PWA."
      );
    }

    if (normalizedMessage.includes('AUTH_REQUIRED')) {
      return new Error('Connectez-vous pour rejoindre ce groupe.');
    }

    if (normalizedMessage.includes('INVITE_NOT_FOUND')) {
      return new Error("Ce lien d'invitation est introuvable.");
    }

    if (normalizedMessage.includes('INVITE_EXPIRED')) {
      return new Error("Ce lien d'invitation a expire.");
    }

    if (normalizedMessage.includes('INVITE_UNAVAILABLE')) {
      return new Error("Ce lien d'invitation n'est plus disponible.");
    }

    if (normalizedMessage.includes('INVITE_ROLE_LIMIT_REACHED')) {
      return new Error("Cinq liens sont deja actifs pour ce role. Revoquez-en un avant d'en creer un autre.");
    }

    if (normalizedMessage.includes('WORKSPACE_ADMIN_REQUIRED')) {
      return new Error("Seul un administrateur peut gerer les invitations de ce groupe.");
    }

    if (normalizedMessage.includes('INVALID_INVITE_ROLE')) {
      return new Error("Le role choisi pour cette invitation n'est pas valide.");
    }

    return new Error(normalizedMessage);
  }

  return new Error('Erreur workspace inconnue.');
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error('User must be authenticated to create a workspace');
  }
  const userId = session.user.id;

  const normalizedName = normalizeWorkspaceName(name);
  if (!normalizedName) {
    throw new Error('Le nom du groupe ne peut pas etre vide.');
  }

  const { data: workspaceData, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: normalizedName,
      created_by: userId,
    })
    .select()
    .single();

  if (wsError) throw normalizeWorkspaceError(wsError);

  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceData.id,
      user_id: userId,
      role: 'admin',
    });

  if (memberError) {
    await supabase.from('workspaces').delete().eq('id', workspaceData.id);
    throw normalizeWorkspaceError(memberError);
  }

  return {
    id: workspaceData.id,
    name: workspaceData.name,
    createdBy: workspaceData.created_by,
    createdAt: workspaceData.created_at,
    updatedAt: workspaceData.updated_at,
    role: 'admin',
    type: 'group',
  };
}

export async function updateWorkspaceGroup(
  workspaceId: string,
  updates: { name?: string; logoUrl?: string | null }
): Promise<Workspace> {
  const payload: Record<string, any> = {};
  if (updates.name !== undefined) {
    const normalized = normalizeWorkspaceName(updates.name);
    if (!normalized) {
      throw new Error('Le nom du groupe ne peut pas etre vide.');
    }
    payload.name = normalized;
  }
  if (updates.logoUrl !== undefined) {
    payload.logo_url = updates.logoUrl;
  }

  const { data, error } = await supabase
    .from('workspaces')
    .update(payload)
    .eq('id', workspaceId)
    .select()
    .single();

  if (error) throw normalizeWorkspaceError(error);

  return {
    id: data.id,
    name: data.name,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    role: 'admin',
    type: normalizeWorkspaceType(data.workspace_type),
  };
}

export async function softDeleteWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_workspace', {
    p_workspace_id: workspaceId,
  });
  if (error) throw normalizeWorkspaceError(error);
}

export async function restoreWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_workspace', {
    p_workspace_id: workspaceId,
  });
  if (error) throw normalizeWorkspaceError(error);
}

export async function getUserWorkspaces(): Promise<Workspace[]> {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('User must be authenticated to list workspaces');
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, workspace:workspaces(*)')
    .eq('user_id', session.user.id);

  if (error) throw normalizeWorkspaceError(error);

  return (data || []).flatMap((membership: any) => {
    const workspace = Array.isArray(membership.workspace) ? membership.workspace[0] : membership.workspace;
    if (!workspace || workspace.deleted_at) return [];

    return [{
      id: workspace.id,
      name: workspace.name,
      createdBy: workspace.created_by,
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at,
      role: normalizeWorkspaceRole(membership.role),
      type: normalizeWorkspaceType(workspace.workspace_type),
    }];
  });
}

export function buildWorkspaceInviteUrl(token: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('invite', token);
  return url.toString();
}

export function extractWorkspaceInviteToken(value: string): string | null {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue);
    const inviteToken = url.searchParams.get('invite');
    return inviteToken?.trim() || null;
  } catch {
    return normalizedValue;
  }
}

function mapWorkspaceRow(row: any): Workspace {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    role: normalizeWorkspaceRole(row.role),
    type: normalizeWorkspaceType(row.workspace_type),
  };
}

function mapWorkspaceMemberRow(row: any): WorkspaceMember {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: normalizeWorkspaceRole(row.role),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listWorkspaceMembersWithProfiles(workspaceId: string): Promise<WorkspaceMember[]> {
  try {
    const res = await supabase
      .from('workspace_members')
      .select('id, workspace_id, user_id, role, created_at, updated_at, profile:profiles(pseudo, avatar_url)')
      .eq('workspace_id', workspaceId);

    const data = res?.data;
    if (res?.error) throw normalizeWorkspaceError(res.error);

    const members = (data || []).map((row: any) => {
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        userId: row.user_id,
        role: normalizeWorkspaceRole(row.role),
        pseudo: profile?.pseudo || 'Membre',
        avatarUrl: profile?.avatar_url || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    const roleOrder: Record<WorkspaceRole, number> = {
      admin: 0,
      member: 1,
      guest: 2,
    };

    return members.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
  } catch {
    return [];
  }
}

export async function setWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<WorkspaceMember> {
  if (role !== 'admin') {
    const members = await listWorkspaceMembersWithProfiles(workspaceId);
    const admins = members.filter(m => m.role === 'admin');
    if (admins.length === 1 && admins.some(a => a.userId === userId)) {
      throw new Error('Impossible de retrograder le dernier administrateur du groupe.');
    }
  }

  const { data, error } = await supabase.rpc('set_workspace_member_role', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_role: role,
  });

  if (error) throw normalizeWorkspaceError(error);
  return mapWorkspaceMemberRow(data as any);
}

export async function removeWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
  const members = await listWorkspaceMembersWithProfiles(workspaceId);
  const admins = members.filter(m => m.role === 'admin');
  if (admins.length === 1 && admins.some(a => a.userId === userId)) {
    throw new Error('Impossible de retirer le dernier administrateur du groupe.');
  }

  const { error } = await supabase.rpc('remove_workspace_member', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
  });

  if (error) throw normalizeWorkspaceError(error);
}

export async function leaveWorkspace(workspaceId: string): Promise<void> {
  const session = await getSession();
  if (session?.user) {
    const members = await listWorkspaceMembersWithProfiles(workspaceId);
    const admins = members.filter(m => m.role === 'admin');
    if (admins.length === 1 && admins.some(a => a.userId === session.user.id)) {
      throw new Error('Le dernier administrateur ne peut pas quitter le groupe sans nommer un autre administrateur.');
    }
  }

  const { error } = await supabase.rpc('leave_workspace', {
    p_workspace_id: workspaceId,
  });

  if (error) throw normalizeWorkspaceError(error);
}

export async function createWorkspaceInviteLink(
  workspaceId: string,
  role: WorkspaceRole,
): Promise<WorkspaceInviteLink> {
  const { data, error } = await supabase
    .rpc('create_workspace_invite', {
      p_workspace_id: workspaceId,
      p_role: role,
    })
    .single();

  if (error) throw normalizeWorkspaceError(error);

  const inviteRow = data as any;
  return {
    id: inviteRow.invite_id,
    token: inviteRow.token,
    url: buildWorkspaceInviteUrl(inviteRow.token),
    role: normalizeWorkspaceRole(inviteRow.role),
    expiresAt: inviteRow.expires_at,
  };
}

export async function listWorkspaceInvites(workspaceId: string): Promise<WorkspaceInviteSummary[]> {
  const { data, error } = await supabase.rpc('list_workspace_invites', {
    p_workspace_id: workspaceId,
  });

  if (error) throw normalizeWorkspaceError(error);

  return ((data ?? []) as any[]).map((inviteRow) => ({
    id: inviteRow.invite_id,
    role: normalizeWorkspaceRole(inviteRow.role),
    createdAt: inviteRow.created_at,
    expiresAt: inviteRow.expires_at,
  }));
}

export async function revokeWorkspaceInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_workspace_invite', {
    p_invite_id: inviteId,
  });

  if (error) throw normalizeWorkspaceError(error);
}

export async function resolveWorkspaceInvite(token: string): Promise<WorkspaceInvitePreview | null> {
  const { data, error } = await supabase
    .rpc('get_workspace_invite_by_token', {
      invite_token: token,
    })
    .maybeSingle();
  const inviteRow = data as any;

  if (error) throw normalizeWorkspaceError(error);
  if (!inviteRow) return null;

  return {
    workspaceId: inviteRow.workspace_id,
    workspaceName: inviteRow.workspace_name,
    status: inviteRow.status,
    role: normalizeWorkspaceRole(inviteRow.role),
    expiresAt: inviteRow.expires_at,
  };
}

export async function acceptWorkspaceInvite(token: string): Promise<Workspace> {
  const { data, error } = await supabase
    .rpc('accept_workspace_invite', {
      invite_token: token,
    })
    .single();

  if (error) throw normalizeWorkspaceError(error);

  return mapWorkspaceRow(data as any);
}
