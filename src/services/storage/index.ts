import { r2StorageProvider } from './r2StorageProvider';
import { googleDriveStorageProvider } from './googleDriveStorageProvider';
import type { StorageLocation, StorageProvider, StorageProviderId, StorageUploadRequest } from './types';
import { listWorkspaceStorageConnections } from '@/services/supabase/workspaceStorage';
import { StorageProviderError } from './types';

const providers = new Map<StorageProviderId, StorageProvider>([
  [r2StorageProvider.id, r2StorageProvider],
  [googleDriveStorageProvider.id, googleDriveStorageProvider],
]);

export function getStorageProvider(providerId: StorageProviderId): StorageProvider {
  const provider = providers.get(providerId);
  if (!provider) {
    throw new StorageProviderError('provider_unavailable', 'Ce fournisseur de stockage n’est pas encore disponible.', providerId);
  }
  return provider;
}

export async function getWorkspaceStorageProvider(workspaceId: string, requestedProviderId?: StorageProviderId): Promise<StorageProvider> {
  const connections = await listWorkspaceStorageConnections(workspaceId);
  const connection = requestedProviderId
    ? connections.find((item) => item.providerId === requestedProviderId && item.status === 'connected')
    : connections.find((item) => item.isDefault && item.status === 'connected');
  if (!connection) {
    throw new StorageProviderError(
      'connection_unavailable',
      'Le stockage de ce groupe doit être configuré par un administrateur avant l’envoi de fichiers.',
    );
  }
  return getStorageProvider(connection.providerId);
}

export async function uploadStorageObject(request: StorageUploadRequest, body: Blob): Promise<StorageLocation> {
  const provider = await getWorkspaceStorageProvider(request.workspaceId, request.targetProviderId);
  const session = await provider.createUploadSession(request);
  await request.onSessionCreated?.(session);
  let receipt;
  try {
    receipt = await provider.upload(session, body);
  } catch (error) {
    await provider.abortUpload(session).catch(() => undefined);
    throw error;
  }
  return provider.finalizeUpload(session, receipt, request);
}

export async function createStorageReadUrl(workspaceId: string, logicalKey: string): Promise<string> {
  return createUnifiedReadUrl(workspaceId, logicalKey, false);
}

export async function createStorageDownloadUrl(workspaceId: string, logicalKey: string): Promise<string> {
  return createUnifiedReadUrl(workspaceId, logicalKey, true);
}

async function createUnifiedReadUrl(workspaceId: string, logicalKey: string, download: boolean): Promise<string> {
  const apiUrl = (import.meta.env.VITE_AUDIO_API_URL ?? '').replace(/\/$/, '');
  const { data } = await (await import('@/services/supabase/client')).supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!apiUrl || !token) throw new StorageProviderError('connection_unavailable', 'Connexion requise pour accéder au fichier.');
  const response = await fetch(`${apiUrl}/storage/read-session`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, logicalKey, download }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== 'object' || typeof (body as { url?: unknown }).url !== 'string') {
    throw new StorageProviderError('provider_unavailable', 'Le fichier est temporairement indisponible.');
  }
  return (body as { url: string }).url;
}

export async function deleteStorageObject(workspaceId: string, logicalKey: string): Promise<void> {
  const apiUrl = (import.meta.env.VITE_AUDIO_API_URL ?? '').replace(/\/$/, '');
  const { data } = await (await import('@/services/supabase/client')).supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!apiUrl || !token) throw new StorageProviderError('connection_unavailable', 'Connexion requise pour supprimer le fichier.');
  const response = await fetch(`${apiUrl}/storage/delete`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, logicalKey }),
  });
  if (!response.ok && response.status !== 202) {
    throw new StorageProviderError('provider_unavailable', 'La suppression physique sera réessayée ultérieurement.');
  }
}

export type {
  StorageCapability,
  StorageLocation,
  StorageProvider,
  StorageProviderId,
  StorageQuota,
  StorageUploadRequest,
  StorageUploadSession,
  StorageUploadReceipt,
} from './types';

export { StorageProviderError } from './types';
