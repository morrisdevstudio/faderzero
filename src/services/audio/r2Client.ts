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

  async function uploadObject(key: string, file: Blob): Promise<void> {
    const accessToken = await dependencies.getAccessToken();
    const response = await dependencies.fetch(`${apiUrl}/objects/${encodeObjectKey(key)}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': file.type || 'audio/mpeg',
      },
      body: file,
    });

    if (!response.ok) {
      throw await createApiError(response, 'Upload R2 impossible');
    }
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

  return { uploadObject, createSignedUrl };
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

export async function uploadAudioObject(key: string, file: Blob): Promise<void> {
  assertAudioApiConfig();
  await r2AudioClient.uploadObject(key, file);
}

export async function createAudioSignedUrl(key: string): Promise<string> {
  assertAudioApiConfig();
  return r2AudioClient.createSignedUrl(key);
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
