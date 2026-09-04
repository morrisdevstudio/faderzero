import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const env = {
  SUPABASE_URL: 'https://supabase.example',
  SUPABASE_SECRET_KEY: 'service-role-test-key',
  MEDIA_SIGNING_SECRET: 'media-signing-test-key',
  MEDIA_BUCKET: {},
} as never;

afterEach(() => vi.unstubAllGlobals());

describe('EPK public worker', () => {
  it('redirects the apex to the visitor language and forwards language landing pages', async () => {
    const root = await worker.fetch(new Request('https://faderzero.com/', { headers: { 'accept-language': 'en-GB,en;q=0.9' } }), env);
    expect(root.headers.get('location')).toBe('https://faderzero.com/en');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html lang="en"><head><title>FaderZero PWA</title></head><body></body></html>', { headers: { etag: 'old', 'content-length': '5' } })));
    const landing = await worker.fetch(new Request('https://faderzero.com/fr'), env);
    expect(await landing.text()).toContain('https://faderzero.com/fr');
    expect(landing.headers.get('etag')).toBeNull();
  });

  it('forwards an EPK slug to the Pages shell in EPK mode', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response('<html><head></head><body></body></html>'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://faderzero.com/kickedtoheaven?verify=7'), env);

    expect(response.status).toBe(200);
    const forwardedRequest = fetchMock.mock.calls[0]?.[0] as Request;
    const forwardedUrl = new URL(forwardedRequest.url);
    expect(forwardedUrl.origin).toBe('https://faderzero.pages.dev');
    expect(forwardedUrl.pathname).toBe('/kickedtoheaven');
    expect(forwardedUrl.searchParams.get('view')).toBe('epk');
    expect(forwardedUrl.searchParams.get('verify')).toBe('7');
  });

  it('serves an image preview through the asset owning relation', async () => {
    const mediaBucket = {
      get: vi.fn(async () => ({ body: new Response('image').body, size: 5, httpEtag: 'etag', range: undefined })),
    };
    let requestedUrl = '';
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return Response.json([{ storage_path: 'workspaces/w/epks/e/image.jpg', mime_type: 'image/jpeg', kind: 'image_preview' }]);
    }));

    const response = await worker.fetch(new Request('https://faderzero.com/media/preview/00000000-0000-0000-0000-000000000001'), {
      SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SECRET_KEY: 'service-role-test-key',
      MEDIA_SIGNING_SECRET: 'media-signing-test-key',
      MEDIA_BUCKET: mediaBucket,
    } as never);

    expect(response.status).toBe(200);
    expect(requestedUrl).toContain('epks%21epk_assets_epk_id_fkey%21inner');
    expect(mediaBucket.get).toHaveBeenCalledWith('workspaces/w/epks/e/image.jpg', expect.anything());
    expect(response.headers.get('content-type')).toBe('image/jpeg');
  });

  it('streams a published song track without a signed session', async () => {
    const mediaBucket = {
      get: vi.fn(async () => ({ body: new Response('audio').body, size: 5, httpEtag: 'etag', range: undefined })),
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const requested = String(input);
      if (requested.includes('source_type=eq.EPK_ASSET')) return Response.json([]);
      if (requested.includes('source_type=eq.SONG_ASSET')) {
        return Response.json([{ song_assets: { storage_path: 'workspaces/w/songs/s/okay.mp3', mime_type: 'audio/mpeg' } }]);
      }
      return Response.json([]);
    }));

    const response = await worker.fetch(new Request('https://faderzero.com/api/public/kickedtoheaven/tracks/95864afa-bfe7-4ef4-9342-b340e569bc59/audio'), {
      ...env,
      MEDIA_BUCKET: mediaBucket,
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(mediaBucket.get).toHaveBeenCalledWith('workspaces/w/songs/s/okay.mp3', expect.anything());
  });

  it('resolves a stale snapshot track id via the live title', async () => {
    const staleId = '13c0bd29-2584-43c0-bcf5-067182171508';
    const liveId = '95864afa-bfe7-4ef4-9342-b340e569bc59';
    const mediaBucket = {
      get: vi.fn(async () => ({ body: new Response('audio').body, size: 5, httpEtag: 'etag', range: undefined })),
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const requested = String(input);
      if (requested.includes('/rest/v1/epks?')) {
        return Response.json([{ id: '11111111-1111-1111-1111-111111111111', published_snapshot: { tracks: [{ id: staleId, title: 'Okay' }] } }]);
      }
      if (requested.includes('source_type=eq.EPK_ASSET')) return Response.json([]);
      if (requested.includes(liveId) && requested.includes('source_type=eq.SONG_ASSET')) {
        return Response.json([{ song_assets: { storage_path: 'workspaces/w/songs/s/okay.mp3', mime_type: 'audio/mpeg' } }]);
      }
      if (requested.includes('source_type=eq.SONG_ASSET')) return Response.json([]);
      if (requested.includes('title=eq.Okay')) {
        return Response.json([{ id: liveId, title: 'Okay' }]);
      }
      return Response.json([]);
    }));

    const response = await worker.fetch(new Request(`https://faderzero.com/api/public/kickedtoheaven/tracks/${staleId}/audio`), {
      ...env,
      MEDIA_BUCKET: mediaBucket,
    } as never);

    expect(response.status).toBe(200);
    expect(mediaBucket.get).toHaveBeenCalledWith('workspaces/w/songs/s/okay.mp3', expect.anything());
  });

  it('refuses a stale snapshot id when several live tracks share the title', async () => {
    const staleId = '13c0bd29-2584-43c0-bcf5-067182171508';
    const mediaBucket = {
      get: vi.fn(async () => ({ body: new Response('audio').body, size: 5, httpEtag: 'etag', range: undefined })),
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const requested = String(input);
      if (requested.includes('/rest/v1/epks?')) {
        return Response.json([{ id: '11111111-1111-1111-1111-111111111111', published_snapshot: { tracks: [{ id: staleId, title: 'Okay' }] } }]);
      }
      if (requested.includes('title=eq.Okay')) {
        return Response.json([
          { id: '95864afa-bfe7-4ef4-9342-b340e569bc59', title: 'Okay' },
          { id: '22222222-2222-2222-2222-222222222222', title: 'Okay' },
        ]);
      }
      return Response.json([]);
    }));

    const response = await worker.fetch(new Request(`https://faderzero.com/api/public/kickedtoheaven/tracks/${staleId}/audio`), {
      ...env,
      MEDIA_BUCKET: mediaBucket,
    } as never);

    expect(response.status).toBe(404);
    expect(mediaBucket.get).not.toHaveBeenCalled();
  });
});
