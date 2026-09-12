import { supabase } from '@/services/supabase/client';
import {
  createEpkAssetSignedUrl,
  getEpkTrackAudioUrl,
  listEpkDocuments,
  listEpkTracks,
  type EpkTrack,
} from '@/features/epk/epk';

export const MAX_EMAIL_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export type ContactEmailDeliveryMode = 'mailto' | 'native-files' | 'epk-link';
export type ShareableEpkAttachmentKind = 'document' | 'audio';

export interface ShareableEpkAttachment {
  id: string;
  kind: ShareableEpkAttachmentKind;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  loadFile: () => Promise<File>;
}

export interface PublishedEpkShareContent {
  epkName: string;
  publicUrl: string;
  hasUnpublishedChanges: boolean;
  attachments: ShareableEpkAttachment[];
}

type SnapshotAttachment = { id: string; assetId?: string };
type AssetMetadata = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
};

function snapshotItems(value: unknown, key: 'documents' | 'tracks'): SnapshotAttachment[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const items = (value as Record<string, unknown>)[key];
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string') return [];
    return [{ id: record.id, ...(typeof record.assetId === 'string' ? { assetId: record.assetId } : {}) }];
  });
}

function safeFilename(value: string, fallback: string) {
  const name = value.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return name || fallback;
}

async function fileFromUrl(url: string, filename: string, mimeType: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Téléchargement impossible (${response.status}).`);
  const blob = await response.blob();
  return new File([blob], filename, { type: mimeType || blob.type || 'application/octet-stream' });
}

async function assetMetadata(table: 'epk_assets' | 'song_assets', ids: string[]) {
  if (ids.length === 0) return new Map<string, AssetMetadata>();
  const { data, error } = await supabase
    .from(table)
    .select(table === 'epk_assets'
      ? 'id, original_filename, mime_type, size_bytes'
      : 'id, filename, mime_type, size_bytes')
    .in('id', ids);
  if (error) throw error;
  return new Map((data ?? []).flatMap((item) => {
    if (!item || typeof item.id !== 'string' || typeof item.mime_type !== 'string' || typeof item.size_bytes !== 'number') return [];
    const record = item as Record<string, unknown>;
    const filename = typeof record.original_filename === 'string'
      ? record.original_filename
      : typeof record.filename === 'string'
        ? record.filename
        : '';
    return [[item.id, { id: item.id, filename, mime_type: item.mime_type, size_bytes: item.size_bytes } satisfies AssetMetadata]];
  }));
}

function audioAssetId(track: EpkTrack) {
  return track.sourceType === 'SONG_ASSET' ? track.songAssetId : track.audioAssetId;
}

export async function listPublishedEpkShareContent(workspaceId: string): Promise<PublishedEpkShareContent | null> {
  const { data: epk, error } = await supabase
    .from('epks')
    .select('id, display_name, slug, status, draft_revision, published_revision, published_snapshot')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!epk || epk.status !== 'PUBLISHED' || !epk.published_snapshot) return null;

  const snapshotDocuments = snapshotItems(epk.published_snapshot, 'documents');
  const snapshotTracks = snapshotItems(epk.published_snapshot, 'tracks');
  const [documents, tracks] = await Promise.all([listEpkDocuments(epk.id), listEpkTracks(epk.id)]);
  const documentsById = new Map(documents.map((item) => [item.id, item]));
  const tracksById = new Map(tracks.filter((item) => item.visibility === 'PUBLIC').map((item) => [item.id, item]));

  const publishedDocuments = snapshotDocuments.flatMap((item) => {
    const current = documentsById.get(item.id);
    return current && current.assetId === item.assetId ? [current] : [];
  });
  const publishedTracks = snapshotTracks.flatMap((item) => {
    const current = tracksById.get(item.id);
    return current && audioAssetId(current) ? [current] : [];
  });

  const [documentMetadata, songMetadata, epkAudioMetadata] = await Promise.all([
    assetMetadata('epk_assets', publishedDocuments.map((item) => item.assetId)),
    assetMetadata('song_assets', publishedTracks.flatMap((item) => item.songAssetId ? [item.songAssetId] : [])),
    assetMetadata('epk_assets', publishedTracks.flatMap((item) => item.audioAssetId ? [item.audioAssetId] : [])),
  ]);

  const documentAttachments: ShareableEpkAttachment[] = publishedDocuments.flatMap((document) => {
    const metadata = documentMetadata.get(document.assetId);
    if (!metadata) return [];
    const fallbackExtension = metadata.mime_type === 'application/zip' ? '.zip' : '.pdf';
    const filename = safeFilename(metadata.filename || `${document.title}${fallbackExtension}`, `document${fallbackExtension}`);
    return [{
      id: `document:${document.id}`,
      kind: 'document',
      title: document.title,
      filename,
      mimeType: metadata.mime_type,
      sizeBytes: metadata.size_bytes,
      loadFile: async () => fileFromUrl(await createEpkAssetSignedUrl(document.assetId), filename, metadata.mime_type),
    }];
  });

  const audioAttachments: ShareableEpkAttachment[] = publishedTracks.flatMap((track) => {
    const id = audioAssetId(track);
    const metadata = track.sourceType === 'SONG_ASSET'
      ? songMetadata.get(id ?? '')
      : epkAudioMetadata.get(id ?? '');
    if (!metadata) return [];
    const filename = safeFilename(metadata.filename || `${track.title}.mp3`, 'audio.mp3');
    return [{
      id: `audio:${track.id}`,
      kind: 'audio',
      title: track.title,
      filename,
      mimeType: metadata.mime_type,
      sizeBytes: metadata.size_bytes,
      loadFile: async () => fileFromUrl(await getEpkTrackAudioUrl(track), filename, metadata.mime_type),
    }];
  });

  return {
    epkName: epk.display_name,
    publicUrl: `https://faderzero.com/${epk.slug}`,
    hasUnpublishedChanges: Number(epk.draft_revision ?? 0) !== Number(epk.published_revision ?? 0),
    attachments: [...documentAttachments, ...audioAttachments],
  };
}

export function totalAttachmentBytes(attachments: ShareableEpkAttachment[]) {
  return attachments.reduce((total, attachment) => total + attachment.sizeBytes, 0);
}

export function selectContactEmailDeliveryMode(files: File[], selectedBytes: number): ContactEmailDeliveryMode {
  if (files.length === 0 && selectedBytes === 0) return 'mailto';
  if (selectedBytes > MAX_EMAIL_ATTACHMENT_BYTES) return 'epk-link';
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files })
      ? 'native-files'
      : 'epk-link';
  } catch {
    return 'epk-link';
  }
}

export function buildContactMailto(input: {
  email: string;
  subject: string;
  body: string;
  epkUrl?: string;
}) {
  const body = input.epkUrl
    ? `${input.body.trimEnd()}\n\nDossier de presse : ${input.epkUrl}`
    : input.body;
  return `mailto:${encodeURIComponent(input.email)}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(body)}`;
}
