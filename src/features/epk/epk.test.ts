import { describe, expect, it } from 'vitest';
import { getEpkCompleteness, normalizeEpkSlug, parseEpkVideoUrl, validateEpkDraft, type EpkRecord } from './epk';

describe('EPK helpers', () => {
  it('normalizes accented public slugs', () => {
    expect(normalizeEpkSlug(' Les Étoiles Noires! ')).toBe('les-etoiles-noires');
  });

  it('rejects reserved slugs and invalid genres', () => {
    expect(validateEpkDraft({ displayName: 'Fader', slug: 'home', genres: ['Rock'] })).toBe('Ce slug est indisponible.');
    expect(validateEpkDraft({ displayName: 'Fader', slug: 'fader', genres: ['', 'Rock'] })).toContain('genres');
  });

  it('calculates the confirmed weighted completion baseline', () => {
    const epk: EpkRecord = { id: 'epk', workspaceId: 'workspace', displayName: 'Fader', slug: 'fader', status: 'DRAFT', genres: ['Rock'], city: 'Paris', theme: 'stage-dark', heroAssetId: 'asset' };
    expect(getEpkCompleteness(epk, 1)).toBe(55);
  });

  it('accepts canonical YouTube and Vimeo video URLs only', () => {
    expect(parseEpkVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ provider: 'YOUTUBE', providerVideoId: 'dQw4w9WgXcQ' });
    expect(parseEpkVideoUrl('https://vimeo.com/123456789')).toEqual({ provider: 'VIMEO', providerVideoId: '123456789' });
    expect(parseEpkVideoUrl('https://example.com/video')).toBeNull();
  });
});
