import { supabase } from '@/services/supabase/client';

interface R2AudioClientDependencies {
  apiUrl: string;
  fetch: typeof globalThis.fetch;
  getAccessToken: () => Promise<string>;
}

interface SignedUrlResponse {
  signedUrl: string;
}

export function createR2AudioClient(dependencies: R2AudioClientDependencies) {
  const apiUrl = dependencies.apiUrl.replace(/\/$/, '');

  async function uploadObject(key: string, file: Blob, reservationId: string): Promise<void> {
    const accessToken = await dependencies.getAccessToken();
    const response = await dependencies.fetch(`${apiUrl}/objects/${encodeObjectKey(key)}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': file.type || 'audio/mpeg',
        'x-audio-reservation-id': reservationId,
      },
      body: file,
    });

    if (!response.ok) {
      throw await createApiError(response, 'Upload R2 impossible');
    }
  }

  async function uploadEpkObject(key: string, file: File, assetKind: 'image_preview' | 'image_original' | 'document'): Promise<void> {
    const accessToken = await dependencies.getAccessToken();
    const response = await dependencies.fetch(`${apiUrl}/objects/${encodeObjectKey(key)}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': file.type,
        'x-epk-asset-kind': assetKind,
      },
      body: file,
    });
    if (!response.ok) throw await createApiError(response, 'Upload du média EPK impossible');
  }

  async function deleteEpkObject(key: string): Promise<void> {
    const accessToken = await dependencies.getAccessToken();
    const response = await dependencies.fetch(`${apiUrl}/objects/${encodeObjectKey(key)}`, {
      method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw await createApiError(response, 'Suppression du média EPK impossible');
  }

  async function createSignedUrl(key: string): Promise<string> {
    const accessToken = await dependencies.getAccessToken();
    const response = await dependencies.fetch(`${apiUrl}/signed-url`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ key }),
    });

    if (!response.ok) {
      throw await createApiError(response, 'Lecture R2 impossible');
    }

    const body: unknown = await response.json();
    if (!isSignedUrlResponse(body)) {
      throw new Error('Réponse invalide du service audio R2.');
    }
    return body.signedUrl;
  }

  async function publishEpk(epkId: string, expectedRevision: number): Promise<unknown> {
    const accessToken = await dependencies.getAccessToken();
    const response = await dependencies.fetch(`${apiUrl}/epk-publications/${encodeURIComponent(epkId)}`, { method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision }) });
    if (!response.ok) throw await createApiError(response, 'Publication EPK impossible');
    return response.json();
  }

  return { uploadObject, uploadEpkObject, deleteEpkObject, createSignedUrl, publishEpk };
}

const r2AudioClient = createR2AudioClient({
  apiUrl: import.meta.env.VITE_AUDIO_API_URL ?? '',
  fetch: globalThis.fetch.bind(globalThis),
  getAccessToken: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    if (!data.session?.access_token) {
      throw new Error('Connexion Supabase requise pour accéder aux fichiers audio.');
    }
    return data.session.access_token;
  },
});

export async function uploadAudioObject(key: string, file: Blob, reservationId: string): Promise<void> {
  assertAudioApiConfig();
  await r2AudioClient.uploadObject(key, file, reservationId);
}

export async function uploadEpkObject(key: string, file: File, assetKind: 'image_preview' | 'image_original' | 'document'): Promise<void> {
  assertAudioApiConfig();
  await r2AudioClient.uploadEpkObject(key, file, assetKind);
}

export async function deleteEpkObject(key: string): Promise<void> {
  assertAudioApiConfig();
  await r2AudioClient.deleteEpkObject(key);
}

export async function createAudioSignedUrl(key: string): Promise<string> {
  assertAudioApiConfig();
  return r2AudioClient.createSignedUrl(key);
}

export async function publishEpkMedia(epkId: string, expectedRevision: number): Promise<unknown> {
  assertAudioApiConfig();
  return r2AudioClient.publishEpk(epkId, expectedRevision);
}

function assertAudioApiConfig(): void {
  if (!import.meta.env.VITE_AUDIO_API_URL) {
    throw new Error('Configuration R2 manquante : VITE_AUDIO_API_URL doit être renseignée.');
  }
}

function encodeObjectKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

async function createApiError(response: Response, fallback: string): Promise<Error> {
  const body: unknown = await response.json().catch(() => null);
  const message = isErrorResponse(body) ? body.error : `${fallback} (${response.status})`;
  return new Error(message);
}

function isErrorResponse(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string';
}

function isSignedUrlResponse(value: unknown): value is SignedUrlResponse {
  return typeof value === 'object' && value !== null && 'signedUrl' in value && typeof value.signedUrl === 'string';
}
