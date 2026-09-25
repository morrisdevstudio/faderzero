import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import type { WorkerEnv } from './index';
import { handleGoogleDriveRequest } from './googleDrive';

const baseEnv = {
  ALLOWED_ORIGINS:
    'http://localhost:5173,http://192.168.1.23:5173,https://app.faderzero.com,https://faderzero.pages.dev,https://*.faderzero.pages.dev',
} as const;

const workspaceId = '11111111-1111-4111-8111-111111111111';
const reservationId = '22222222-2222-4222-8222-222222222222';
const validMp3Bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);

class TestFixedLengthStream extends TransformStream<Uint8Array, Uint8Array> {
  constructor(expectedLength: number) {
    super();
    Object.defineProperty(this.readable, 'expectedLength', { value: expectedLength });
  }
}

function makeAudioEnv() {
  // @ts-expect-error The test double implements only the R2 methods exercised by this Worker.
  return {
    ...baseEnv,
    URL_SIGNING_SECRET: 'test-signing-secret',
    SUPABASE_SECRET_KEY: 'service-role-test-key',
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_PUBLISHABLE_KEY: 'publishable-test-key',
    AUDIO_BUCKET: {
      put: vi.fn(async (_key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob) => {
        if (value instanceof ReadableStream) {
          await new Response(value).arrayBuffer();
        }
        return {
          key: `workspaces/${workspaceId}/imports/test.mp3`,
          size: 4,
          httpEtag: '"etag"',
        };
      }),
      head: vi.fn(async () => ({ key: 'test' })),
      get: vi.fn(async (_key: string, options?: { range?: Headers }) => {
        const rangeRequested = options?.range?.has('range') ?? false;
        return {
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(validMp3Bytes);
              controller.close();
            },
          }),
          size: validMp3Bytes.byteLength,
          httpEtag: '"etag"',
          ...(rangeRequested ? { range: { offset: 1, length: 2 } } : {}),
          writeHttpMetadata(headers: Headers) {
            headers.set('content-type', 'audio/mpeg');
          },
        };
      }),
      list: vi.fn(async () => ({ objects: [], truncated: false })),
    },
    AUDIO_BACKUP_BUCKET: {
      list: vi.fn(async () => ({ objects: [], truncated: false })),
    },
  } as WorkerEnv;
}

function mockSupabaseRole(role: 'owner' | 'admin' | 'member' | 'guest' | null, upload = false) {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ id: 'user-123' }))
    .mockResolvedValueOnce(Response.json(role ? [{ role }] : []))
    .mockResolvedValue(Response.json(null));
  if (upload) fetchMock.mockResolvedValue(Response.json(null));
  vi.stubGlobal('fetch', fetchMock);
}

describe('audio Worker request boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('FixedLengthStream', TestFixedLengthStream);
  });

  it('allows a Cloudflare Pages preview origin', async () => {
    const response = await worker.fetch(
      new Request('https://audio.example/health', {
        headers: { origin: 'https://preview-123.faderzero.pages.dev' },
      }),
      makeAudioEnv(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://preview-123.faderzero.pages.dev',
    );
  });

  it('allows the LAN development origin used by mobile devices', async () => {
    const response = await worker.fetch(
      new Request('https://audio.example/health', {
        headers: { origin: 'http://192.168.1.23:5173' },
      }),
      makeAudioEnv(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://192.168.1.23:5173');
  });

  it('rejects a lookalike Pages origin', async () => {
    const response = await worker.fetch(
      new Request('https://audio.example/health', {
        headers: { origin: 'https://faderzero.pages.dev.attacker.example' },
      }),
      makeAudioEnv(),
    );

    expect(response.status).toBe(403);
  });

  it('allows members to upload audio', async () => {
    mockSupabaseRole('member', true);
    const env = makeAudioEnv();
    const response = await worker.fetch(
      new Request(`https://audio.example/objects/workspaces/${workspaceId}/imports/test.mp3`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'audio/mpeg',
          'content-length': '4',
          'x-audio-reservation-id': reservationId,
        },
        body: validMp3Bytes,
      }),
      env,
    );

    expect(response.status).toBe(201);
    expect(env.AUDIO_BUCKET.put).toHaveBeenCalledWith(
      `workspaces/${workspaceId}/imports/test.mp3`,
      expect.objectContaining({ expectedLength: validMp3Bytes.byteLength }),
      expect.any(Object),
    );
  });

  it('treats the legacy owner role as admin for uploads', async () => {
    mockSupabaseRole('owner', true);
    const env = makeAudioEnv();
    const response = await worker.fetch(
      new Request(`https://audio.example/objects/workspaces/${workspaceId}/imports/test.mp3`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'audio/mpeg',
          'content-length': '4',
          'x-audio-reservation-id': reservationId,
        },
        body: validMp3Bytes,
      }),
      env,
    );

    expect(response.status).toBe(201);
  });

  it('denies guest uploads before writing to R2', async () => {
    mockSupabaseRole('guest', true);
    const env = makeAudioEnv();
    const response = await worker.fetch(
      new Request(`https://audio.example/objects/workspaces/${workspaceId}/imports/test.mp3`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'audio/mpeg',
          'content-length': '4',
          'x-audio-reservation-id': reservationId,
        },
        body: validMp3Bytes,
      }),
      env,
    );

    expect(response.status).toBe(403);
    expect(env.AUDIO_BUCKET.put).not.toHaveBeenCalled();
  });

  it('rejects a truncated or non-MP3 upload before writing to R2', async () => {
    mockSupabaseRole('member', true);
    const env = makeAudioEnv();
    const response = await worker.fetch(
      new Request(`https://audio.example/objects/workspaces/${workspaceId}/imports/test.mp3`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'audio/mpeg',
          'content-length': '4',
          'x-audio-reservation-id': reservationId,
        },
        body: new Uint8Array([0, 1, 2, 3]),
      }),
      env,
    );

    expect(response.status).toBe(415);
    expect(env.AUDIO_BUCKET.put).not.toHaveBeenCalled();
  });

  it('requires a quota reservation before accepting an upload', async () => {
    mockSupabaseRole('member', true);
    const env = makeAudioEnv();
    const response = await worker.fetch(
      new Request(`https://audio.example/objects/workspaces/${workspaceId}/imports/test.mp3`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'audio/mpeg',
          'content-length': '4',
        },
        body: validMp3Bytes,
      }),
      env,
    );

    expect(response.status).toBe(400);
    expect(env.AUDIO_BUCKET.put).not.toHaveBeenCalled();
  });

  it('returns 429 when Supabase rejects the concurrent upload slot', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ id: 'user-123' }))
      .mockResolvedValueOnce(Response.json([{ role: 'member' }]))
      .mockResolvedValueOnce(Response.json(
        { message: 'audio upload concurrency exceeded' },
        { status: 400 },
      )));

    const response = await worker.fetch(
      new Request(`https://audio.example/objects/workspaces/${workspaceId}/imports/test.mp3`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'audio/mpeg',
          'content-length': '4',
          'x-audio-reservation-id': reservationId,
        },
        body: validMp3Bytes,
      }),
      makeAudioEnv(),
    );

    expect(response.status).toBe(429);
  });

  it('does not write to R2 when the simulated Class A budget is exhausted', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ id: 'user-123' }))
      .mockResolvedValueOnce(Response.json([{ role: 'member' }]))
      .mockResolvedValueOnce(Response.json(null))
      .mockResolvedValueOnce(Response.json(
        { message: 'R2_FREE_TIER_OPERATION_GUARDRAIL' },
        { status: 400 },
      ))
      .mockResolvedValue(Response.json(null)));
    const env = makeAudioEnv();

    const response = await worker.fetch(
      new Request(`https://audio.example/objects/workspaces/${workspaceId}/imports/test.mp3`, {
        method: 'PUT',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'audio/mpeg',
          'content-length': '4',
          'x-audio-reservation-id': reservationId,
        },
        body: validMp3Bytes,
      }),
      env,
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ code: 'R2_FREE_TIER_GUARDRAIL' });
    expect(env.AUDIO_BUCKET.put).not.toHaveBeenCalled();
  });

  it('allows guests to request playback URLs', async () => {
    mockSupabaseRole('guest');
    const env = makeAudioEnv();
    const key = `workspaces/${workspaceId}/imports/test.mp3`;
    const response = await worker.fetch(
      new Request('https://audio.example/signed-url', {
        method: 'POST',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ key }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(env.AUDIO_BUCKET.head).not.toHaveBeenCalled();
  });

  it('denies playback URLs to non-members', async () => {
    mockSupabaseRole(null);
    const response = await worker.fetch(
      new Request('https://audio.example/signed-url', {
        method: 'POST',
        headers: {
          authorization: 'Bearer token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ key: `workspaces/${workspaceId}/imports/test.mp3` }),
      }),
      makeAudioEnv(),
    );

    expect(response.status).toBe(403);
  });

  it('serves a five-minute signed range with hardened media headers', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    mockSupabaseRole('member');
    const env = makeAudioEnv();
    const key = `workspaces/${workspaceId}/imports/test.mp3`;
    const signedResponse = await worker.fetch(
      new Request('https://audio.example/signed-url', {
        method: 'POST',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        body: JSON.stringify({ key }),
      }),
      env,
    );
    const signedBody = await signedResponse.json<{ signedUrl: string }>();
    const signedUrl = new URL(signedBody.signedUrl);

    expect(Number(signedUrl.searchParams.get('expires'))).toBe(1_800_000_300);
    const mediaResponse = await worker.fetch(
      new Request(signedUrl, { headers: { range: 'bytes=1-2' } }),
      env,
    );

    expect(mediaResponse.status).toBe(206);
    expect(mediaResponse.headers.get('content-range')).toBe('bytes 1-2/4');
    expect(mediaResponse.headers.get('x-content-type-options')).toBe('nosniff');
    expect(mediaResponse.headers.get('cache-control')).toBe('private, no-store');
  });

  it('does not read R2 when the simulated Class B budget is exhausted', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ id: 'user-123' }))
      .mockResolvedValueOnce(Response.json([{ role: 'member' }]))
      .mockResolvedValueOnce(Response.json(
        { message: 'R2_FREE_TIER_OPERATION_GUARDRAIL' },
        { status: 400 },
      )));
    const env = makeAudioEnv();
    const key = `workspaces/${workspaceId}/imports/test.mp3`;
    const signedResponse = await worker.fetch(
      new Request('https://audio.example/signed-url', {
        method: 'POST',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        body: JSON.stringify({ key }),
      }),
      env,
    );
    const signedBody = await signedResponse.json<{ signedUrl: string }>();

    const response = await worker.fetch(new Request(signedBody.signedUrl), env);

    expect(response.status).toBe(429);
    expect(env.AUDIO_BUCKET.get).not.toHaveBeenCalled();
  });

  it('rejects a tampered signed playback URL', async () => {
    mockSupabaseRole('member');
    const env = makeAudioEnv();
    const signedResponse = await worker.fetch(
      new Request('https://audio.example/signed-url', {
        method: 'POST',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        body: JSON.stringify({ key: `workspaces/${workspaceId}/imports/test.mp3` }),
      }),
      env,
    );
    const signedBody = await signedResponse.json<{ signedUrl: string }>();
    const tamperedUrl = new URL(signedBody.signedUrl);
    tamperedUrl.searchParams.set('signature', '00'.repeat(32));

    const response = await worker.fetch(new Request(tamperedUrl), env);
    expect(response.status).toBe(403);
    expect(env.AUDIO_BUCKET.get).not.toHaveBeenCalled();
  });
});

describe('Google Drive storage boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('FixedLengthStream', TestFixedLengthStream);
  });

  it('allows the browser preflight for a resumable upload', async () => {
    const response = await worker.fetch(new Request('https://audio.example/storage/google-drive/upload-sessions', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://app.faderzero.com',
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'authorization,content-type,content-range',
      },
    }), makeAudioEnv());
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.faderzero.com');
    expect(response.headers.get('access-control-allow-methods')).toContain('PUT');
    expect(response.headers.get('access-control-allow-headers')).toContain('content-range');
  });

  it('does not store an overlong logical key in Google Drive app properties', async () => {
    const logicalKey = `workspaces/${workspaceId}/songs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.mp3`;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'user-123' });
      if (url.includes('/workspace_members')) return Response.json([{ role: 'member' }]);
      if (url.includes('/workspace_storage_connections') && !url.includes('/rpc/')) return Response.json([{
        id: workspaceId, workspace_id: workspaceId, root_identifier: 'root-folder',
        provider_metadata: { folders: { audio: 'audio-folder' } }, status: 'connected', is_default: true,
      }]);
      if (url.includes('/rpc/get_storage_connection_secret')) return Response.json([{
        encrypted_credentials: btoa(String.fromCharCode(1, ...new Uint8Array(12), ...new Uint8Array(17))),
      }]);
      if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'google-access-token' });
      if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
        const metadata = JSON.parse(String(init?.body));
        expect(metadata.appProperties).toEqual({ faderzeroWorkspaceId: workspaceId });
        return new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test' } });
      }
      if (url.includes('/rpc/create_storage_upload_session')) return Response.json(reservationId);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn(async () => new Uint8Array(32).buffer),
        importKey: vi.fn(async () => ({})),
        decrypt: vi.fn(async () => new TextEncoder().encode(JSON.stringify({ refreshToken: 'refresh-token' })).buffer),
      },
    });
    const response = await handleGoogleDriveRequest(new Request('https://audio.example/storage/google-drive/upload-sessions', {
      method: 'POST',
      headers: { authorization: 'Bearer user-token', 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId, logicalKey, objectKind: 'audio', mimeType: 'audio/mpeg', sizeBytes: 4 }),
    }), { ...makeAudioEnv(), GOOGLE_OAUTH_CLIENT_ID: 'client', GOOGLE_OAUTH_CLIENT_SECRET: 'secret', GOOGLE_TOKEN_ENCRYPTION_KEY: 'key' });
    expect(response?.status).toBe(201);
  });

  it('streams upload content through the authenticated Worker', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'user-123' });
      if (url.includes('/rpc/get_storage_upload_session')) return Response.json({
        id: reservationId, workspace_id: workspaceId, connection_id: workspaceId,
        user_id: 'user-123', logical_key: 'workspaces/test/audio.mp3',
        object_kind: 'audio', mime_type: 'audio/mpeg', size_bytes: 4,
        provider_session_uri: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test',
        status: 'created',
      });
      if (url.includes('/workspace_members')) return Response.json([{ role: 'member' }]);
      if (url.includes('/workspace_storage_connections') && !url.includes('/rpc/')) return Response.json([{
        id: workspaceId, workspace_id: workspaceId, root_identifier: 'root-folder', provider_metadata: {}, status: 'connected',
      }]);
      if (url.includes('/rpc/get_storage_connection_secret')) return Response.json([{
        encrypted_credentials: btoa(String.fromCharCode(1, ...new Uint8Array(12), ...new Uint8Array(17))),
      }]);
      if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'google-access-token' });
      if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
        expect(init?.method).toBe('PUT');
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer google-access-token');
        expect(new Headers(init?.headers).get('content-range')).toBe('bytes 0-3/4');
        expect(await new Response(init?.body).arrayBuffer()).toEqual(validMp3Bytes.buffer);
        return Response.json({ id: 'drive-file-1' });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn(async () => new Uint8Array(32).buffer),
        importKey: vi.fn(async () => ({})),
        decrypt: vi.fn(async () => new TextEncoder().encode(JSON.stringify({ refreshToken: 'refresh-token' })).buffer),
      },
    });
    const response = await handleGoogleDriveRequest(new Request(`https://audio.example/storage/google-drive/upload-sessions/${reservationId}/content`, {
      method: 'PUT',
      headers: {
        authorization: 'Bearer user-token', 'content-type': 'audio/mpeg',
        'content-range': 'bytes 0-3/4',
      },
      body: validMp3Bytes,
    }), { ...makeAudioEnv(), GOOGLE_OAUTH_CLIENT_ID: 'client', GOOGLE_OAUTH_CLIENT_SECRET: 'secret', GOOGLE_TOKEN_ENCRYPTION_KEY: 'key' });
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ physicalIdentifier: 'drive-file-1' });
  });

  it('does not forward an upload for a guest', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'user-123' });
      if (url.includes('/rpc/get_storage_upload_session')) return Response.json({
        id: reservationId, workspace_id: workspaceId, connection_id: workspaceId,
        user_id: 'user-123', logical_key: 'workspaces/test/audio.mp3',
        object_kind: 'audio', mime_type: 'audio/mpeg', size_bytes: 4,
        provider_session_uri: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test',
        status: 'created',
      });
      if (url.includes('/workspace_members')) return Response.json([{ role: 'guest' }]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleGoogleDriveRequest(new Request(`https://audio.example/storage/google-drive/upload-sessions/${reservationId}/content`, {
      method: 'PUT',
      headers: {
        authorization: 'Bearer user-token', 'content-type': 'audio/mpeg',
        'content-range': 'bytes 0-3/4',
      },
      body: validMp3Bytes,
    }), makeAudioEnv());
    expect(response?.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('recovers the receipt of a completed resumable upload', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'user-123' });
      if (url.includes('/workspace_members')) return Response.json([{ role: 'member' }]);
      if (url.includes('/rpc/get_storage_upload_session')) return Response.json({
        id: reservationId, workspace_id: workspaceId, connection_id: workspaceId,
        user_id: 'user-123', logical_key: `workspaces/${workspaceId}/imports/test.mp3`,
        object_kind: 'audio', mime_type: 'audio/mpeg', size_bytes: 4,
        provider_session_uri: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test',
        status: 'created',
      });
      if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) return Response.json({ id: 'drive-file-1' });
      throw new Error(`Unexpected request: ${url}`);
    }));
    const response = await handleGoogleDriveRequest(new Request('https://audio.example/storage/google-drive/upload-sessions', {
      method: 'POST',
      headers: { authorization: 'Bearer user-token', 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceId, logicalKey: `workspaces/${workspaceId}/imports/test.mp3`,
        objectKind: 'audio', mimeType: 'audio/mpeg', sizeBytes: 4, sessionId: reservationId,
      }),
    }), makeAudioEnv());
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({ completedPhysicalIdentifier: 'drive-file-1', confirmedBytes: 4 });
  });

  it('creates an admin-only OAuth request with PKCE and the minimal scope', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'user-123' });
      if (url.includes('/workspace_members')) return Response.json([{ role: 'admin' }]);
      if (url.includes('/rpc/create_google_drive_oauth_state')) return Response.json(null);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const env = {
      ...makeAudioEnv(),
      GOOGLE_OAUTH_CLIENT_ID: 'google-client', GOOGLE_OAUTH_CLIENT_SECRET: 'google-secret',
      GOOGLE_OAUTH_REDIRECT_URI: 'https://faderzero-audio-api.admin-morris-studio.workers.dev/storage/google-drive/oauth/callback',
      GOOGLE_TOKEN_ENCRYPTION_KEY: 'encryption-secret', APP_URL: 'https://app.faderzero.com',
    } as WorkerEnv;
    const response = await handleGoogleDriveRequest(new Request('https://audio.example/storage/google-drive/oauth/start', {
      method: 'POST', headers: { authorization: 'Bearer user-token', 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId }),
    }), env);
    const body = await response!.json() as { authorizationUrl: string };
    const authorization = new URL(body.authorizationUrl);
    expect(response?.status).toBe(200);
    expect(authorization.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
    expect(authorization.searchParams.get('access_type')).toBe('offline');
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorization.searchParams.get('state')).toBeTruthy();
  });

  it('refuses OAuth setup when the client ID is missing', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'user-123' });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleGoogleDriveRequest(new Request('https://audio.example/storage/google-drive/oauth/start', {
      method: 'POST', headers: { authorization: 'Bearer user-token' },
    }), makeAudioEnv());
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({ error: 'Google Drive OAuth unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the Drive connection active when Google reports an invalid OAuth client', async () => {
    const plaintext = new TextEncoder().encode(JSON.stringify({ refreshToken: 'refresh-token' }));
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'user-123' });
      if (url.includes('/workspace_members')) return Response.json([{ role: 'member' }]);
      if (url.includes('/workspace_storage_connections') && !url.includes('/rpc/')) return Response.json([{
        id: reservationId, workspace_id: workspaceId, root_identifier: 'root-folder',
        provider_metadata: {}, status: 'connected',
      }]);
      if (url.includes('/rpc/get_storage_connection_secret')) return Response.json([{
        encrypted_credentials: btoa(String.fromCharCode(1, ...new Uint8Array(12), ...new Uint8Array(17))),
      }]);
      if (url === 'https://oauth2.googleapis.com/token') return Response.json({ error: 'invalid_client' }, { status: 401 });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn(async () => new Uint8Array(32).buffer),
        importKey: vi.fn(async () => ({})),
        decrypt: vi.fn(async () => plaintext.buffer),
      },
    });
    const env = { ...makeAudioEnv(), GOOGLE_OAUTH_CLIENT_ID: 'client', GOOGLE_OAUTH_CLIENT_SECRET: 'secret', GOOGLE_TOKEN_ENCRYPTION_KEY: 'key' } as WorkerEnv;
    const response = await handleGoogleDriveRequest(new Request('https://audio.example/storage/health', {
      method: 'POST', headers: { authorization: 'Bearer user-token', 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId }),
    }), env);
    expect(response?.status).toBe(200);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });

  it('refuses OAuth setup to a regular member', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ id: 'user-123' }))
      .mockResolvedValueOnce(Response.json([{ role: 'member' }])));
    const env = {
      ...makeAudioEnv(), GOOGLE_OAUTH_CLIENT_ID: 'client', GOOGLE_OAUTH_CLIENT_SECRET: 'secret',
      GOOGLE_OAUTH_REDIRECT_URI: 'https://faderzero-audio-api.admin-morris-studio.workers.dev/storage/google-drive/oauth/callback', GOOGLE_TOKEN_ENCRYPTION_KEY: 'key', APP_URL: 'https://app.faderzero.com',
    } as WorkerEnv;
    const response = await handleGoogleDriveRequest(new Request('https://audio.example/storage/google-drive/oauth/start', {
      method: 'POST', headers: { authorization: 'Bearer user-token', 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId }),
    }), env);
    expect(response?.status).toBe(403);
  });
});

describe('EPK publication media copy', () => {
  const epkId = '33333333-3333-4333-8333-333333333333';
  const assetId = '44444444-4444-4444-8444-444444444444';

  function publicationEnv() {
    const env = makeAudioEnv();
    env.EPK_PUBLIC_BUCKET = {
      head: vi.fn(async () => null),
      put: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    } as unknown as WorkerEnv['EPK_PUBLIC_BUCKET'];
    return env;
  }

  function mockPublicationReads(tracks: unknown[], assets: unknown[]) {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'user-123' });
      if (url.includes('/rest/v1/epks')) {
        return Response.json([{ id: epkId, workspace_id: workspaceId, draft_revision: 1, hero_asset_id: assetId }]);
      }
      if (url.includes('/rest/v1/workspace_members')) return Response.json([{ role: 'admin' }]);
      if (url.includes('/rest/v1/epk_assets')) return Response.json(assets);
      if (url.includes('/rest/v1/epk_tracks')) return Response.json(tracks);
      if (url.includes('/rest/v1/song_assets')) return Response.json([]);
      return Response.json([]);
    }));
  }

  it('copies an audio file stored in the EPK workspace', async () => {
    const storagePath = `workspaces/${workspaceId}/epks/${epkId}/${assetId}.jpg`;
    mockPublicationReads([], [{ id: assetId, storage_path: storagePath, mime_type: 'image/jpeg' }]);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'user-123' });
      if (url.includes('/rest/v1/epks')) {
        return Response.json([{ id: epkId, workspace_id: workspaceId, draft_revision: 1, hero_asset_id: assetId }]);
      }
      if (url.includes('/rest/v1/workspace_members')) return Response.json([{ role: 'admin' }]);
      if (url.includes('/rest/v1/epk_assets')) return Response.json([{ id: assetId, storage_path: storagePath, mime_type: 'image/jpeg' }]);
      if (url.includes('/rest/v1/rpc/publish_epk_with_media')) return Response.json({ id: epkId });
      return Response.json([]);
    });
    const env = publicationEnv();
    const response = await worker.fetch(new Request(`https://audio.example/epk-publications/${epkId}`, {
      method: 'POST',
      headers: { authorization: 'Bearer token', origin: 'https://app.faderzero.com', 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 1 }),
    }), env);

    expect(response.status).toBe(200);
    expect(env.AUDIO_BUCKET.get).toHaveBeenCalledWith(storagePath);
  });

  it('refuses to copy an audio file stored outside the EPK workspace', async () => {
    mockPublicationReads([], [{
      id: assetId,
      storage_path: 'workspaces/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/imports/stolen.mp3',
      mime_type: 'audio/mpeg',
    }]);
    const env = publicationEnv();
    const response = await worker.fetch(new Request(`https://audio.example/epk-publications/${epkId}`, {
      method: 'POST',
      headers: { authorization: 'Bearer token', origin: 'https://app.faderzero.com', 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 1 }),
    }), env);

    expect(response.status).toBe(422);
    expect(env.AUDIO_BUCKET.get).not.toHaveBeenCalled();
  });

  it('refuses a song id that is not a UUID before querying storage', async () => {
    mockPublicationReads([{ id: 'track-1', source_type: 'SONG_ASSET', song_asset_id: 'x)&or=(workspace_id.eq.victim)' }], []);
    const env = publicationEnv();
    const response = await worker.fetch(new Request(`https://audio.example/epk-publications/${epkId}`, {
      method: 'POST',
      headers: { authorization: 'Bearer token', origin: 'https://app.faderzero.com', 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 1 }),
    }), env);

    expect(response.status).toBe(422);
    const songLookup = vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes('/rest/v1/song_assets'));
    expect(songLookup).toBe(false);
  });
});

describe('audio Worker R2 audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reserves Class A before listing both buckets and records their storage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(null));
    vi.stubGlobal('fetch', fetchMock);
    const env = makeAudioEnv();
    let auditTask: Promise<unknown> | undefined;
    const ctx = {
      waitUntil(task: Promise<unknown>) {
        auditTask = task;
      },
    } as ExecutionContext;

    await worker.scheduled({} as ScheduledController, env, ctx);
    await auditTask;

    expect(env.AUDIO_BUCKET.list).toHaveBeenCalledOnce();
    expect(env.AUDIO_BACKUP_BUCKET.list).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toContain('/rpc/record_r2_storage_observation');
  });

  it('does not list either bucket when the Class A reservation is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(
      { message: 'R2_FREE_TIER_OPERATION_GUARDRAIL' },
      { status: 400 },
    )));
    const env = makeAudioEnv();
    let auditTask: Promise<unknown> | undefined;
    const ctx = {
      waitUntil(task: Promise<unknown>) {
        auditTask = task;
      },
    } as ExecutionContext;

    await worker.scheduled({} as ScheduledController, env, ctx);
    await expect(auditTask).rejects.toThrow('R2_FREE_TIER_OPERATION_GUARDRAIL');

    expect(env.AUDIO_BUCKET.list).not.toHaveBeenCalled();
    expect(env.AUDIO_BACKUP_BUCKET.list).not.toHaveBeenCalled();
  });
});
