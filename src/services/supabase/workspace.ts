import { supabase } from './client';
import { getSession } from './auth';
import { createId } from '@/lib/createId';

export interface Workspace {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceInviteLink {
  token: string;
  url: string;
  expiresAt: string | null;
}

export interface WorkspaceInvitePreview {
  workspaceId: string;
  workspaceName: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: string | null;
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

  const { data: workspaceData, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: name.trim(),
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
      role: 'owner',
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
  };
}

export async function getUserWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase.from('workspaces').select('*');

  if (error) throw normalizeWorkspaceError(error);

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
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
  };
}

export async function createWorkspaceInviteLink(workspaceId: string): Promise<WorkspaceInviteLink> {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('User must be authenticated to create a workspace invite');
  }

  const token = createId();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  const { error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: workspaceId,
      email: session.user.email ?? '',
      token,
      status: 'pending',
      created_by: session.user.id,
      expires_at: expiresAt,
    });

  if (error) throw normalizeWorkspaceError(error);

  return {
    token,
    url: buildWorkspaceInviteUrl(token),
    expiresAt,
  };
}

export async function resolveWorkspaceInvite(token: string): Promise<WorkspaceInvitePreview | null> {
  const { data, error } = await supabase
    .rpc('get_workspace_invite_by_token', {
      invite_token: token,
    })
    .single();
  const inviteRow = data as any;

  if (error) throw normalizeWorkspaceError(error);
  if (!inviteRow) return null;

  return {
    workspaceId: inviteRow.workspace_id,
    workspaceName: inviteRow.workspace_name,
    status: inviteRow.status,
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
