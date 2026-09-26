import { describe, expect, it, vi } from 'vitest';
import { createEpk, createEpkAssetSignedUrl, deleteEpkHeroImage, epkHasUnpublishedChanges, epkUnpublishedLeavePrompt, getEpkCompleteness, getEpkLiveStatus, normalizeEpkSlug, parseEpkVideoUrl, validateEpkDraft, type EpkRecord } from './epk';
import { DEFAULT_EPK_ACCENT, DEFAULT_EPK_EDITORIAL, DEFAULT_EPK_SECTION_ORDER } from './epkPresentation';

const supabaseMock = vi.hoisted(() => ({ updates: [] as Record<string, unknown>[], inserts: [] as Record<string, unknown>[], selects: [] as { table: string; columns: string }[] }));

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      update(payload: Record<string, unknown>) {
        supabaseMock.updates.push({ table, ...payload });
        return { eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'epk', workspace_id: 'workspace', display_name: 'Fader', slug: 'fader', status: 'PUBLISHED', genres: ['Rock'], theme: 'stage-dark' }, error: null }) }) }) };
      },
      insert(payload: Record<string, unknown>) {
        supabaseMock.inserts.push({ table, ...payload });
        return { select: () => ({ single: async () => ({ data: { id: 'epk', workspace_id: 'workspace', display_name: 'Fader', slug: 'fader', status: 'DRAFT', genres: [], theme: 'stage-dark', ...payload }, error: null }) }) };
      },
      select: (columns?: string) => {
        supabaseMock.selects.push({ table, columns: String(columns) });
        const row = table === 'epks'
          ? { data: { workspace_id: 'workspace' }, error: null }
          : { data: { storage_path: 'workspaces/workspace/epks/e/hero.webp' }, error: null };
        return { eq: () => ({ maybeSingle: async () => row, single: async () => row }) };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));

vi.mock('@/services/audio/r2Client', () => ({
  createAudioSignedUrl: vi.fn(),
  deleteEpkObject: vi.fn(async () => undefined),
  uploadAudioObject: vi.fn(),
  uploadEpkObject: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  createStorageReadUrl: vi.fn(async () => 'https://media.example/signed'),
  deleteStorageObject: vi.fn(async () => undefined),
  uploadStorageObject: vi.fn(),
}));

vi.mock('@/services/storage', () => storageMocks);

describe('EPK helpers', () => {
  it('normalizes accented public slugs', () => {
    expect(normalizeEpkSlug(' Les Étoiles Noires! ')).toBe('les-etoiles-noires');
  });

  it('initializes a new EPK with database-valid section defaults', async () => {
    await createEpk('workspace', 'Fader');

    expect(supabaseMock.inserts.at(-1)).toMatchObject({
      table: 'epks',
      workspace_id: 'workspace',
      display_name: 'Fader',
      slug: 'fader',
      genres: [],
      accent_color: DEFAULT_EPK_ACCENT,
      section_order: DEFAULT_EPK_SECTION_ORDER,
      hidden_sections: [],
      editorial_content: DEFAULT_EPK_EDITORIAL,
    });
  });

  it('detects unpublished editor changes and leave-prompt copy', () => {
    expect(epkHasUnpublishedChanges(false, { status: 'DRAFT', draftRevision: 1, publishedRevision: 0 })).toBe(false);
    expect(epkHasUnpublishedChanges(true, { status: 'DRAFT', draftRevision: 1, publishedRevision: 0 })).toBe(true);
    expect(epkHasUnpublishedChanges(false, { status: 'PUBLISHED', draftRevision: 3, publishedRevision: 2 })).toBe(true);
    expect(epkHasUnpublishedChanges(false, { status: 'PUBLISHED', draftRevision: 2, publishedRevision: 2 })).toBe(false);
    expect(epkUnpublishedLeavePrompt('PUBLISHED').confirmLabel).toBe('Mettre à jour');
    expect(epkUnpublishedLeavePrompt('DRAFT').confirmLabel).toBe('Publier');
  });

  it('reports the published state and connectivity in the live EPK header', () => {
    const draft = { status: 'DRAFT' as const, draftRevision: 1, publishedRevision: 0 };
    const published = { status: 'PUBLISHED' as const, draftRevision: 2, publishedRevision: 2 };

    expect(getEpkLiveStatus(true, false, draft)).toMatchObject({ label: 'Brouillon', tone: 'default' });
    expect(getEpkLiveStatus(true, true, published)).toMatchObject({ label: 'Publiée · modifiée', tone: 'accent' });
    expect(getEpkLiveStatus(true, false, published)).toMatchObject({ label: 'En ligne · à jour', tone: 'success' });
    expect(getEpkLiveStatus(false, false, published)).toMatchObject({ label: 'Hors ligne', tone: 'default' });
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

  it('signs a banner media URL without the ambiguous epks embed', async () => {
    const url = await createEpkAssetSignedUrl('asset');

    const queries = supabaseMock.selects.slice(-2).map((query) => query.columns);
    expect(queries.join(' ')).not.toContain('(');
    expect(queries).toEqual(['storage_path, epk_id', 'workspace_id']);
    expect(storageMocks.createStorageReadUrl).toHaveBeenCalledWith('workspace', 'workspaces/workspace/epks/e/hero.webp');
    expect(url).toBe('https://media.example/signed');
  });
});
