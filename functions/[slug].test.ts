import { describe, expect, it, vi } from 'vitest';
import { onRequestGet } from './[slug]';

describe('public EPK Pages Function', () => {
  it('embeds only the published snapshot and prevents HTML caching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      display_name: 'Kicked To Heaven', slug: 'kickedtoheaven', status: 'PUBLISHED', published_revision: 7,
      published_snapshot: { name: 'Kicked To Heaven', slug: 'kickedtoheaven', heroPublicKey: 'epks/kicked/hero.webp', genres: [], accentColor: '#ff3a63', sectionOrder: [], hiddenSections: [], editorial: {}, tracks: [], videos: [], photos: [], documents: [], contacts: [], links: [] },
    }])));
    vi.stubGlobal('fetch', fetchMock);
    const response = await onRequestGet({
      request: new Request('https://faderzero.com/kickedtoheaven'), params: { slug: 'kickedtoheaven' },
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'secret' },
      next: async () => new Response('<html><head></head><body></body></html>'),
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-fz-epk-revision')).toBe('7');
    expect(response.headers.get('content-security-policy')).toContain("script-src 'self' 'nonce-");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const html = await response.text();
    expect(html).toContain('window.__FZ_EPK_MODEL__');
    expect(html).toContain('https://media.faderzero.com/epks/kicked/hero.webp');
    expect(html).toContain('https://faderzero.com/kickedtoheaven');
    expect(response.headers.get('content-security-policy')).toContain('https://i.ytimg.com');
  });

  it('returns a small verification response for the editor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      display_name: 'Kicked To Heaven', slug: 'kickedtoheaven', status: 'PUBLISHED', published_revision: 7, published_snapshot: {},
    }]))));
    const response = await onRequestGet({
      request: new Request('https://faderzero.com/kickedtoheaven?verify=7'), params: { slug: 'kickedtoheaven' },
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'secret' }, next: async () => new Response('unused'),
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('x-fz-epk-revision')).toBe('7');
  });

  it('keeps the JSON representation available for public integrations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      display_name: 'Kicked To Heaven', slug: 'kickedtoheaven', status: 'PUBLISHED', published_revision: 7, published_snapshot: { name: 'Kicked To Heaven' },
    }]))));
    const response = await onRequestGet({
      request: new Request('https://faderzero.pages.dev/kickedtoheaven?view=epk&format=json'), params: { slug: 'kickedtoheaven' },
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'secret' }, next: async () => new Response('unused'),
    });
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toMatchObject({ name: 'Kicked To Heaven' });
  });

  it('falls back to same-origin preview URLs when the snapshot has no public keys', async () => {
    const heroId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const previewId = 'fc1fdb33-f7c8-4506-8812-d9df05cb9f1d';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      display_name: 'Kicked To Heaven', slug: 'kickedtoheaven', status: 'PUBLISHED', published_revision: 0,
      hero_asset_id: heroId,
      published_snapshot: {
        name: 'Kicked To Heaven', slug: 'kickedtoheaven', genres: [], accentColor: '#ff3a63',
        sectionOrder: [], hiddenSections: [], editorial: {}, tracks: [], videos: [],
        photos: [{ id: '2c8aae7a-f045-47e2-a9fa-37a373132402', previewAssetId: previewId }],
        documents: [], contacts: [], links: [],
      },
    }]))));
    const response = await onRequestGet({
      request: new Request('https://faderzero.com/kickedtoheaven?format=json'), params: { slug: 'kickedtoheaven' },
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'secret' },
      next: async () => new Response('unused'),
    });
    const body = await response.json() as { heroUrl?: string; photos: Array<{ previewUrl?: string }> };
    expect(body.heroUrl).toBe(`/media/preview/${heroId}`);
    expect(body.photos[0]?.previewUrl).toBe(`/media/preview/${previewId}`);
  });

  it('keeps unpublished EPKs explicitly unavailable to crawlers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      display_name: 'Kicked To Heaven', slug: 'kickedtoheaven', status: 'DRAFT', published_revision: 0, published_snapshot: {},
    }]))));
    const response = await onRequestGet({
      request: new Request('https://faderzero.com/kickedtoheaven'), params: { slug: 'kickedtoheaven' },
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'secret' }, next: async () => new Response('unused'),
    });
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('noindex');
  });
});
