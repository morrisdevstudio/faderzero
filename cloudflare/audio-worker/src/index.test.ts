import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import type { WorkerEnv } from './index';

const baseEnv = {
  ALLOWED_ORIGINS:
    'http://localhost:5173,https://faderzero.pages.dev,https://*.faderzero.pages.dev',
} as const;

const workspaceId = '11111111-1111-4111-8111-111111111111';
const reservationId = '22222222-2222-4222-8222-222222222222';
const validMp3Bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);

function makeAudioEnv() {
  // @ts-expect-error The test double implements only the R2 methods exercised by this Worker.
  return {
    ...baseEnv,
    URL_SIGNING_SECRET: 'test-signing-secret',
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_PUBLISHABLE_KEY: 'publishable-test-key',
    AUDIO_BUCKET: {
      put: vi.fn(async () => ({
        key: `workspaces/${workspaceId}/imports/test.mp3`,
        size: 4,
        httpEtag: '"etag"',
      })),
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
  } as WorkerEnv;
}

function mockSupabaseRole(role: 'owner' | 'admin' | 'member' | 'guest' | null, upload = false) {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ id: 'user-123' }))
    .mockResolvedValueOnce(Response.json(role ? [{ role }] : []));
  if (upload) fetchMock.mockResolvedValue(Response.json(null));
  vi.stubGlobal('fetch', fetchMock);
}

describe('audio Worker request boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    expect(env.AUDIO_BUCKET.put).toHaveBeenCalledOnce();
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
    expect(env.AUDIO_BUCKET.head).toHaveBeenCalledWith(key);
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
