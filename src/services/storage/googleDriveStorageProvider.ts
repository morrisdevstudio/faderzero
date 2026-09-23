import { supabase } from '@/services/supabase/client';
import { StorageProviderError, type StorageProvider, type StorageUploadSession } from './types';

const apiUrl = (import.meta.env.VITE_AUDIO_API_URL ?? '').replace(/\/$/, '');

async function authenticatedRequest(path: string, body: Record<string, unknown>): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!apiUrl || !token) throw new StorageProviderError('connection_unavailable', 'Connexion Supabase requise.', 'google_drive');
  return fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function responseRecord(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== 'object' || Array.isArray(body)) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : 'Google Drive est temporairement indisponible.';
    throw new StorageProviderError(response.status === 507 ? 'quota_exceeded' : 'provider_unavailable', message, 'google_drive');
  }
  return body as Record<string, unknown>;
}

function assertGoogleSession(session: StorageUploadSession): asserts session is StorageUploadSession & { resumableSessionUri: string } {
  if (session.providerId !== 'google_drive' || !session.resumableSessionUri) {
    throw new StorageProviderError('invalid_upload', 'Session Google Drive invalide.', 'google_drive');
  }
}

export const googleDriveStorageProvider: StorageProvider = {
  id: 'google_drive',
  capabilities: new Set(['resumable_upload', 'read', 'download', 'delete', 'quota', 'health']),

  async createUploadSession(request) {
    const payload = {
      workspaceId: request.workspaceId,
      logicalKey: request.logicalKey,
      objectKind: request.objectKind ?? 'audio',
      mimeType: request.mimeType,
      sizeBytes: request.sizeBytes,
    };
    let response = await authenticatedRequest('/storage/google-drive/upload-sessions', {
      ...payload,
      ...(request.resumeSessionId ? { sessionId: request.resumeSessionId } : {}),
    });
    if (request.resumeSessionId && (response.status === 409 || response.status === 410)) {
      response = await authenticatedRequest('/storage/google-drive/upload-sessions', payload);
    }
    const body = await responseRecord(response);
    if (typeof body.sessionId !== 'string' || typeof body.resumableSessionUri !== 'string') {
      throw new StorageProviderError('invalid_upload', 'Session Google Drive incomplète.', 'google_drive');
    }
    return {
      providerId: 'google_drive',
      sessionId: body.sessionId,
      workspaceId: request.workspaceId,
      logicalKey: request.logicalKey,
      resumableSessionUri: body.resumableSessionUri,
      ...(typeof body.confirmedBytes === 'number' ? { confirmedBytes: body.confirmedBytes } : {}),
      ...(typeof body.completedPhysicalIdentifier === 'string' ? { completedPhysicalIdentifier: body.completedPhysicalIdentifier } : {}),
      ...(typeof body.expiresAt === 'string' ? { expiresAt: body.expiresAt } : {}),
    };
  },

  async upload(session, body) {
    assertGoogleSession(session);
    if (session.completedPhysicalIdentifier) return { physicalIdentifier: session.completedPhysicalIdentifier };
    const offset = session.confirmedBytes ?? 0;
    const uploadBody = offset > 0 ? body.slice(offset) : body;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!apiUrl || !token) throw new StorageProviderError('connection_unavailable', 'Connexion Supabase requise.', 'google_drive');
    const response = await fetch(`${apiUrl}/storage/google-drive/upload-sessions/${encodeURIComponent(session.sessionId)}/content`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': body.type || 'application/octet-stream',
        'content-range': `bytes ${offset}-${body.size - 1}/${body.size}`,
      },
      body: uploadBody,
    });
    const result = await responseRecord(response);
    if (typeof result.physicalIdentifier !== 'string') throw new StorageProviderError('invalid_upload', 'Réponse d’envoi Google Drive invalide.', 'google_drive');
    return { physicalIdentifier: result.physicalIdentifier };
  },

  async finalizeUpload(session, receipt, request) {
    assertGoogleSession(session);
    if (!receipt) throw new StorageProviderError('invalid_upload', 'Résultat d’envoi Google Drive manquant.', 'google_drive');
    const body = await responseRecord(await authenticatedRequest('/storage/google-drive/uploads/finalize', {
      sessionId: session.sessionId,
      physicalIdentifier: receipt.physicalIdentifier,
      ...(request?.contentHash ? { contentHash: request.contentHash } : {}),
    }));
    if (typeof body.physicalKey !== 'string') throw new StorageProviderError('invalid_upload', 'Finalisation Google Drive invalide.', 'google_drive');
    return {
      providerId: 'google_drive',
      physicalKey: body.physicalKey,
      ...(typeof body.storageObjectId === 'string' ? { storageObjectId: body.storageObjectId } : {}),
    };
  },

  async abortUpload() {
    // Google ne fournit pas de suppression de session résumable. Elle expire automatiquement.
  },

  async createReadUrl(workspaceId, logicalKey) {
    const body = await responseRecord(await authenticatedRequest('/storage/read-session', { workspaceId, logicalKey, download: false }));
    if (typeof body.url !== 'string') throw new StorageProviderError('provider_unavailable', 'Adresse de lecture invalide.', 'google_drive');
    return body.url;
  },

  async createDownloadUrl(workspaceId, logicalKey) {
    const body = await responseRecord(await authenticatedRequest('/storage/read-session', { workspaceId, logicalKey, download: true }));
    if (typeof body.url !== 'string') throw new StorageProviderError('provider_unavailable', 'Adresse de téléchargement invalide.', 'google_drive');
    return body.url;
  },

  async deleteObject(workspaceId, logicalKey) {
    const response = await authenticatedRequest('/storage/delete', { workspaceId, logicalKey });
    if (!response.ok && response.status !== 202) await responseRecord(response);
  },

  async getQuota(workspaceId) {
    const body = await responseRecord(await authenticatedRequest('/storage/quota', { workspaceId }));
    return {
      unit: 'bytes',
      usedAmount: Number(body.usedAmount ?? 0),
      reservedAmount: Number(body.reservedAmount ?? 0),
      limitAmount: Number(body.limitAmount ?? 0),
      remainingAmount: Number(body.remainingAmount ?? 0),
    };
  },

  async checkHealth() {
    return Boolean(apiUrl);
  },
};
