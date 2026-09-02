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
    const frenchFirst = await worker.fetch(new Request('https://faderzero.com/', { headers: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' } }), env);
    expect(frenchFirst.headers.get('location')).toBe('https://faderzero.com/fr');
    expect((await worker.fetch(new Request('https://faderzero.com/'), env)).headers.get('location')).toBe('https://faderzero.com/fr');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html lang="en"><head><title>FaderZero PWA</title></head><body></body></html>', { headers: { etag: 'old', 'content-length': '5' } })));
    const landing = await worker.fetch(new Request('https://faderzero.com/fr'), env);
    expect(await landing.text()).toContain('https://faderzero.com/fr');
    expect(landing.headers.get('etag')).toBeNull();
  });

  it('forwards an absent slug to Cloudflare Pages', async () => {
    const fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://epk.example/unknown-group'), env);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renders only published public fields and embeds videos directly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([{
      id: '00000000-0000-0000-0000-000000000001', display_name: 'Les Étoiles', slug: 'les-etoiles', tagline: 'Rock spatial', short_bio: 'Bio courte', full_bio: 'Bio longue', city: 'Paris', country: 'France', genres: ['Rock'], theme: 'stage-dark', status: 'PUBLISHED', hero_asset_id: null,
      epk_contacts: [], epk_links: [], epk_photos: [], epk_documents: [], epk_tracks: [
        { id: '00000000-0000-0000-0000-000000000002', title: 'Public track', description: null, visibility: 'PUBLIC', position: 0, source_type: 'EPK_ASSET', audio_asset_id: '00000000-0000-0000-0000-000000000003' },
        { id: '00000000-0000-0000-0000-000000000004', title: 'Unlisted track', description: null, visibility: 'UNLISTED', position: 1, source_type: 'EPK_ASSET', audio_asset_id: '00000000-0000-0000-0000-000000000005' },
      ], epk_videos: [{ provider: 'YOUTUBE', provider_video_id: 'dQw4w9WgXcQ', title: 'Live', video_type: 'LIVE', position: 0 }],
    }])))

    const response = await worker.fetch(new Request('https://epk.example/les-etoiles'), env);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Les Étoiles');
    expect(html).toContain('<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(html).toContain('Public track');
    expect(html).not.toContain('Unlisted track');
  });

  it('serves an image preview through the asset owning relation', async () => {
    const mediaBucket = {
      get: vi.fn(async () => ({ body: new Blob(['image']), size: 5, httpEtag: 'etag', range: undefined })),
    };
    let requestedUrl = '';
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return Response.json([{ storage_path: 'workspaces/w/epks/e/image.jpg', mime_type: 'image/jpeg', kind: 'image_preview' }]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://epk.example/media/preview/00000000-0000-0000-0000-000000000001'), { SUPABASE_URL: 'https://supabase.example', SUPABASE_SECRET_KEY: 'service-role-test-key', MEDIA_SIGNING_SECRET: 'media-signing-test-key', MEDIA_BUCKET: mediaBucket } as never);

    expect(response.status).toBe(200);
    expect(requestedUrl).toContain('epks%21epk_assets_epk_id_fkey%21inner');
    expect(mediaBucket.get).toHaveBeenCalledWith('workspaces/w/epks/e/image.jpg', expect.anything());
  });

  it('renders snapshot with location, respects hiddenSections and sets comprehensive CSP headers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([{
      id: '00000000-0000-0000-0000-000000000001', display_name: 'Les Étoiles', slug: 'les-etoiles', genres: ['Rock'], theme: 'stage-dark', status: 'PUBLISHED', hero_asset_id: null,
      published_snapshot: {
        name: 'Les Étoiles',
        slug: 'les-etoiles',
        city: 'Lyon',
        country: 'France',
        genres: ['Indie Rock'],
        sectionOrder: ['bio', 'musique', 'medias', 'espacePro', 'contact'],
        hiddenSections: ['espacePro'],
        videos: [],
        tracks: [{ id: 't1', title: 'Piste 1' }],
        photos: [],
        documents: [{ id: 'd1', assetId: '00000000-0000-0000-0000-000000000099', title: 'Fiche technique', type: 'TECH_RIDER', updatedAt: '2026-08-28' }],
        contacts: [{ name: 'Manager', role: 'MANAGEMENT', email: 'm@example.com' }],
        links: [],
        editorial: { bioTitle: 'Biographie', musicTitle: 'Musique', proTitle: 'Espace Pro', proDescription: '', contactTitle: 'Contact', facts: [] },
      },
      epk_contacts: [], epk_links: [], epk_photos: [], epk_documents: [], epk_tracks: [], epk_videos: [],
    }])));

    const response = await worker.fetch(new Request('https://epk.example/les-etoiles'), env);
    const html = await response.text();
    const csp = response.headers.get('content-security-policy') ?? '';

    expect(response.status).toBe(200);
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("media-src 'self' blob:");
    expect(csp).toContain("connect-src 'self'");
    expect(html).toContain('Lyon · France');
    expect(html).toContain('Piste 1');
    expect(html).not.toContain('Fiche technique'); // espacePro was in hiddenSections!
  });
});
