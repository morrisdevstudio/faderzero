import { afterEach, describe, expect, it, vi } from 'vitest';

const dataMocks = vi.hoisted(() => ({
  from: vi.fn(),
  listEpkDocuments: vi.fn(),
  listEpkTracks: vi.fn(),
  createEpkAssetSignedUrl: vi.fn(),
  getEpkTrackAudioUrl: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({ supabase: { from: dataMocks.from } }));
vi.mock('@/features/epk/epk', () => ({
  listEpkDocuments: dataMocks.listEpkDocuments,
  listEpkTracks: dataMocks.listEpkTracks,
  createEpkAssetSignedUrl: dataMocks.createEpkAssetSignedUrl,
  getEpkTrackAudioUrl: dataMocks.getEpkTrackAudioUrl,
}));

import {
  MAX_EMAIL_ATTACHMENT_BYTES,
  buildContactMailto,
  listPublishedEpkShareContent,
  selectContactEmailDeliveryMode,
  totalAttachmentBytes,
  type ShareableEpkAttachment,
} from './contactEmailShare';

function attachment(sizeBytes: number): ShareableEpkAttachment {
  return {
    id: String(sizeBytes),
    kind: 'document',
    title: 'Rider',
    filename: 'rider.pdf',
    mimeType: 'application/pdf',
    sizeBytes,
    loadFile: vi.fn(),
  };
}

describe('contactEmailShare', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calcule la taille totale et bascule vers le lien au-delà de 20 Mo', () => {
    const attachments = [attachment(12 * 1024 * 1024), attachment(9 * 1024 * 1024)];
    expect(totalAttachmentBytes(attachments)).toBe(21 * 1024 * 1024);
    expect(selectContactEmailDeliveryMode([], totalAttachmentBytes(attachments))).toBe('epk-link');
    expect(MAX_EMAIL_ATTACHMENT_BYTES).toBe(20 * 1024 * 1024);
  });

  it('utilise le partage natif seulement si les vrais fichiers sont acceptés', () => {
    const canShare = vi.fn(() => true);
    vi.stubGlobal('navigator', { canShare });
    const files = [new File(['pdf'], 'rider.pdf', { type: 'application/pdf' })];

    expect(selectContactEmailDeliveryMode(files, files[0]!.size)).toBe('native-files');
    expect(canShare).toHaveBeenCalledWith({ files });

    canShare.mockReturnValue(false);
    expect(selectContactEmailDeliveryMode(files, files[0]!.size)).toBe('epk-link');
    expect(selectContactEmailDeliveryMode([], 0)).toBe('mailto');
  });

  it('encode le destinataire, les accents et le lien EPK dans le mailto', () => {
    const href = buildContactMailto({
      email: 'clara+booking@example.test',
      subject: 'Dossier de presse — Été',
      body: 'Bonjour Clara,\nVoici le dossier.',
      epkUrl: 'https://faderzero.com/groupe-test',
    });

    expect(href).toContain('mailto:clara%2Bbooking%40example.test');
    expect(decodeURIComponent(href)).toContain('subject=Dossier de presse — Été');
    expect(decodeURIComponent(href)).toContain('Dossier de presse : https://faderzero.com/groupe-test');
  });

  it('ne propose que les fichiers encore identiques au snapshot publié', async () => {
    dataMocks.from.mockImplementation((table: string) => ({
      select: vi.fn(() => {
        if (table === 'epks') {
          return { eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                id: 'epk-1', display_name: 'Night Drive', slug: 'night-drive', status: 'PUBLISHED',
                draft_revision: 3, published_revision: 2,
                published_snapshot: {
                  documents: [{ id: 'doc-1', assetId: 'asset-doc-1' }, { id: 'doc-stale', assetId: 'asset-old' }],
                  tracks: [{ id: 'track-1' }, { id: 'track-2' }],
                },
              },
              error: null,
            })),
          })) };
        }
        return { in: vi.fn(async (_column: string, ids: string[]) => ({
          data: table === 'song_assets'
            ? [{ id: 'asset-audio-1', filename: 'single.mp3', mime_type: 'audio/mpeg', size_bytes: 200 }]
            : [
              { id: 'asset-doc-1', original_filename: 'rider.pdf', mime_type: 'application/pdf', size_bytes: 100 },
              { id: 'asset-epk-audio', original_filename: 'live.mp3', mime_type: 'audio/mpeg', size_bytes: 300 },
            ].filter((item) => ids.includes(item.id)),
          error: null,
        })) };
      }),
    }));
    dataMocks.listEpkDocuments.mockResolvedValue([
      { id: 'doc-1', epkId: 'epk-1', assetId: 'asset-doc-1', title: 'Rider', icon: 'file-text', documentUpdatedAt: '2026-09-12', position: 0 },
      { id: 'doc-stale', epkId: 'epk-1', assetId: 'asset-new', title: 'Nouveau rider', icon: 'file-text', documentUpdatedAt: '2026-09-12', position: 1 },
    ]);
    dataMocks.listEpkTracks.mockResolvedValue([
      { id: 'track-1', epkId: 'epk-1', title: 'Single', visibility: 'PUBLIC', sourceType: 'SONG_ASSET', songAssetId: 'asset-audio-1', position: 0 },
      { id: 'track-2', epkId: 'epk-1', title: 'Live', visibility: 'PUBLIC', sourceType: 'EPK_ASSET', audioAssetId: 'asset-epk-audio', position: 1 },
    ]);

    const content = await listPublishedEpkShareContent('workspace-1');

    expect(content).toMatchObject({
      epkName: 'Night Drive',
      publicUrl: 'https://faderzero.com/night-drive',
      hasUnpublishedChanges: true,
    });
    expect(content?.attachments.map((item) => [item.kind, item.title, item.filename, item.sizeBytes])).toEqual([
      ['document', 'Rider', 'rider.pdf', 100],
      ['audio', 'Single', 'single.mp3', 200],
      ['audio', 'Live', 'live.mp3', 300],
    ]);
  });
});
