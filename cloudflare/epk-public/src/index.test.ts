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
  it('forwards an absent slug to Cloudflare Pages', async () => {
    const fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://epk.example/unknown-group'), env);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renders only published public fields and defers video embeds until a click', async () => {
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
    expect(html).toContain('data-embed="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(html).not.toContain('<iframe src=');
    expect(html).toContain('Public track');
    expect(html).not.toContain('Unlisted track');
  });
});
