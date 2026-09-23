import { supabase } from './client';
import type { StorageProviderId } from '@/services/storage/types';

export type StorageConnectionStatus =
  | 'connected'
  | 'authorization_expired'
  | 'full'
  | 'unavailable'
  | 'disconnected';

export interface WorkspaceStorageConnection {
  id: string;
  workspaceId: string;
  providerId: StorageProviderId;
  displayName: string | null;
  rootIdentifier: string | null;
  status: StorageConnectionStatus;
  isDefault: boolean;
  providerMetadata: Record<string, unknown>;
  quotaUsedBytes: number | null;
  quotaLimitBytes: number | null;
}

const storageConnectionFields = 'id, workspace_id, provider_id, display_name, root_identifier, status, is_default, provider_metadata, quota_used_bytes, quota_limit_bytes';

export async function listWorkspaceStorageConnections(workspaceId: string): Promise<WorkspaceStorageConnection[]> {
  const { data, error } = await supabase
    .from('workspace_storage_connections')
    .select(storageConnectionFields)
    .eq('workspace_id', workspaceId)
    .order('is_default', { ascending: false });
  if (error) throw error;
  return (data ?? []).flatMap(mapStorageConnection);
}

function mapStorageConnection(value: unknown): WorkspaceStorageConnection[] {
  if (!value || typeof value !== 'object') return [];
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.workspace_id !== 'string' ||
    !isStorageProviderId(row.provider_id) ||
    !isStorageConnectionStatus(row.status) ||
    typeof row.is_default !== 'boolean'
  ) return [];
  return [{
    id: row.id,
    workspaceId: row.workspace_id,
    providerId: row.provider_id,
    displayName: typeof row.display_name === 'string' ? row.display_name : null,
    rootIdentifier: typeof row.root_identifier === 'string' ? row.root_identifier : null,
    status: row.status,
    isDefault: row.is_default,
    providerMetadata: isRecord(row.provider_metadata) ? row.provider_metadata : {},
    quotaUsedBytes: numericOrNull(row.quota_used_bytes),
    quotaLimitBytes: numericOrNull(row.quota_limit_bytes),
  }];
}

export async function startGoogleDriveConnection(workspaceId: string): Promise<string> {
  const apiUrl = (import.meta.env.VITE_AUDIO_API_URL ?? '').replace(/\/$/, '');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!apiUrl || !token) throw new Error('Connexion requise pour configurer Google Drive.');
  const response = await fetch(`${apiUrl}/storage/google-drive/oauth/start`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(body) || typeof body.authorizationUrl !== 'string') {
    throw new Error('Impossible de démarrer la connexion Google Drive.');
  }
  return body.authorizationUrl;
}

export async function setDefaultStorageConnection(connectionId: string): Promise<void> {
  const { error } = await supabase.rpc('set_workspace_default_storage_connection', { p_connection_id: connectionId });
  if (error) throw error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numericOrNull(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function isStorageProviderId(value: unknown): value is StorageProviderId {
  return value === 'faderzero_r2' || value === 'google_drive' || value === 'dropbox' || value === 'onedrive' || value === 'webdav';
}

function isStorageConnectionStatus(value: unknown): value is StorageConnectionStatus {
  return value === 'connected' || value === 'authorization_expired' || value === 'full' || value === 'unavailable' || value === 'disconnected';
}
