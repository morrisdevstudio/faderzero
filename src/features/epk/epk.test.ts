import { describe, expect, it, vi } from 'vitest';
import { deleteEpkHeroImage, getEpkCompleteness, normalizeEpkSlug, parseEpkVideoUrl, validateEpkDraft, type EpkRecord } from './epk';
import { DEFAULT_EPK_EDITORIAL } from './epkPresentation';

const supabaseMock = vi.hoisted(() => ({ updates: [] as Record<string, unknown>[] }));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      update(payload: Record<string, unknown>) {
        supabaseMock.updates.push({ table, ...payload });
        return { eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'epk', workspace_id: 'workspace', display_name: 'Fader', slug: 'fader', status: 'PUBLISHED', genres: ['Rock'], theme: 'stage-dark' }, error: null }) }) }) };
      },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { storage_path: 'workspaces/w/epks/e/hero.webp' }, error: null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));

vi.mock('@/services/audio/r2Client', () => ({
  createAudioSignedUrl: vi.fn(),
  deleteEpkObject: vi.fn(async () => undefined),
  uploadEpkObject: vi.fn(),
}));

describe('EPK helpers', () => {
  it('normalizes accented public slugs', () => {
    expect(normalizeEpkSlug(' Les Étoiles Noires! ')).toBe('les-etoiles-noires');
  });

  it('rejects reserved slugs and invalid genres', () => {
    expect(validateEpkDraft({ displayName: 'Fader', slug: 'home', genres: ['Rock'] })).toBe('Ce slug est indisponible.');
    expect(validateEpkDraft({ displayName: 'Fader', slug: 'fader', genres: ['', 'Rock'] })).toContain('genres');
  });

  it('calculates the confirmed weighted completion baseline', () => {
    const epk: EpkRecord = { id: 'epk', workspaceId: 'workspace', displayName: 'Fader', slug: 'fader', status: 'DRAFT', genres: ['Rock'], city: 'Paris', theme: 'stage-dark', heroAssetId: 'asset', editorial: DEFAULT_EPK_EDITORIAL };
    expect(getEpkCompleteness(epk, 1)).toBe(55);
  });

  it('keeps a published EPK online when its banner is deleted', async () => {
    const epk: EpkRecord = { id: 'epk', workspaceId: 'workspace', displayName: 'Fader', slug: 'fader', status: 'PUBLISHED', genres: ['Rock'], city: 'Paris', theme: 'stage-dark', heroAssetId: 'asset', featuredType: 'IMAGE', featuredId: 'asset', editorial: DEFAULT_EPK_EDITORIAL };

    await deleteEpkHeroImage(epk);

    expect(supabaseMock.updates.some((update) => 'status' in update)).toBe(false);
    expect(supabaseMock.updates[0]).toMatchObject({ table: 'epks', hero_asset_id: null, featured_id: null });
  });

  it('accepts canonical YouTube and Vimeo video URLs only', () => {
    expect(parseEpkVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ provider: 'YOUTUBE', providerVideoId: 'dQw4w9WgXcQ' });
    expect(parseEpkVideoUrl('https://vimeo.com/123456789')).toEqual({ provider: 'VIMEO', providerVideoId: '123456789' });
    expect(parseEpkVideoUrl('https://example.com/video')).toBeNull();
  });
});
