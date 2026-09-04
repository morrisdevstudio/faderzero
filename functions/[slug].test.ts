import { describe, expect, it, vi } from 'vitest';
import { onRequestGet } from './[slug]';

describe('public EPK Pages Function', () => {
  it('embeds only the published snapshot and prevents HTML caching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      display_name: 'Kicked To Heaven', slug: 'kickedtoheaven', published_revision: 7,
      published_snapshot: { name: 'Kicked To Heaven', slug: 'kickedtoheaven', genres: [], accentColor: '#ff3a63', sectionOrder: [], hiddenSections: [], editorial: {}, tracks: [], videos: [], photos: [], documents: [], contacts: [], links: [] },
    }])));
    vi.stubGlobal('fetch', fetchMock);
    const response = await onRequestGet({
      request: new Request('https://faderzero.com/kickedtoheaven'), params: { slug: 'kickedtoheaven' },
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'secret' },
      next: async () => new Response('<html><head></head><body></body></html>'),
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-fz-epk-revision')).toBe('7');
    expect(await response.text()).toContain('window.__FZ_EPK_MODEL__');
  });

  it('returns a small verification response for the editor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      display_name: 'Kicked To Heaven', slug: 'kickedtoheaven', published_revision: 7, published_snapshot: {},
    }]))));
    const response = await onRequestGet({
      request: new Request('https://faderzero.com/kickedtoheaven?verify=7'), params: { slug: 'kickedtoheaven' },
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'secret' }, next: async () => new Response('unused'),
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('x-fz-epk-revision')).toBe('7');
  });
});
