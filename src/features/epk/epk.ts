import { supabase } from '@/services/supabase/client';
import { createId } from '@/lib/createId';
import { createAudioSignedUrl, deleteEpkObject, publishEpkMedia, uploadEpkObject } from '@/services/audio/r2Client';
import { db } from '@/db/db';
import { songAssetsRepository } from '@/db/repositories/songAssetsRepository';
import { getCachedAudioUrl } from '@/features/audio/audioCacheStore';
import { DEFAULT_EPK_ACCENT, DEFAULT_EPK_EDITORIAL, DEFAULT_EPK_SECTION_ORDER, EPK_SECTION_IDS, isEpkDocumentIcon, DEFAULT_EPK_DOCUMENT_ICON, normalizedEpkFactIcon, type EpkDocumentIcon, type EpkEditorialContent, type EpkPublicModel, type EpkSectionId } from './epkPresentation';
import { compressEpkImage, EPK_HERO_IMAGE_SIZE, EPK_PHOTO_IMAGE_SIZE } from './epkImage';

export type EpkStatus = 'DRAFT' | 'PUBLISHED';
export type EpkTheme = 'stage-dark' | 'midnight-blue' | 'press-ivory' | 'fader-red';
export type EpkVideoType = 'LIVE' | 'LIVE_SESSION' | 'MUSIC_VIDEO' | 'INTERVIEW' | 'OTHER';
export type EpkContactRole = string;
export type EpkLinkKind = 'SPOTIFY' | 'APPLE_MUSIC' | 'DEEZER' | 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'WEBSITE' | 'CUSTOM';

export interface EpkRecord {
  id: string;
  workspaceId: string;
  displayName: string;
  slug: string;
  status: EpkStatus;
  genres: string[];
  city?: string;
  country?: string;
  tagline?: string;
  shortBio?: string;
  fullBio?: string;
  theme: EpkTheme;
  heroAssetId?: string;
  logoAssetId?: string;
  featuredType?: 'VIDEO' | 'AUDIO' | 'IMAGE';
  featuredId?: string;
  publishedAt?: string;
  accentColor?: string;
  sectionOrder?: EpkSectionId[];
  hiddenSections?: EpkSectionId[];
  draftRevision?: number;
  publishedRevision?: number;
  editorial: EpkEditorialContent;
}

export interface EpkDraftDocument extends EpkPublicModel { revision: number; }
export interface EpkPublishedSnapshotV1 extends EpkPublicModel { version: 1; publishedAt: string; revision: number; }

export interface EpkContact {
  id: string;
  epkId: string;
  name: string;
  role?: string | undefined;
  organisation?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  position: number;
}

export interface EpkVideo {
  id: string;
  epkId: string;
  provider: 'YOUTUBE' | 'VIMEO';
  providerVideoId: string;
  title?: string;
  videoType: EpkVideoType;
  position: number;
}

export interface CreateEpkContactInput {
  name: string;
  role?: string | undefined;
  organisation?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
}

export interface EpkLink {
  id: string;
  epkId: string;
  kind: EpkLinkKind;
  label?: string;
  url: string;
  position: number;
}

export interface EpkPhoto { id: string; epkId: string; previewAssetId: string; originalAssetId: string; credit?: string; caption?: string; position: number; }
export interface EpkDocument { id: string; epkId: string; assetId: string; title: string; description?: string; icon: EpkDocumentIcon; documentUpdatedAt: string; position: number; }
export interface EpkTrack { id: string; epkId: string; title: string; description?: string; visibility: 'PUBLIC' | 'UNLISTED'; sourceType: 'SONG_ASSET' | 'EPK_ASSET'; songAssetId?: string; audioAssetId?: string; position: number; }
export interface AvailableEpkTrack { id: string; filename: string; songId?: string; songTitle?: string; isSynced: boolean; }

export interface CreateEpkVideoInput {
  url: string;
  title?: string;
  videoType: EpkVideoType;
}

export interface CreateEpkLinkInput {
  kind: EpkLinkKind;
  label?: string;
  url: string;
}

const RESERVED_SLUGS = new Set(['home', 'calendar', 'booking', 'songs', 'setlists', 'prompter', 'sync', 'metronome', 'account', 'api', 'assets', 'media', 'preview', 'internal']);

export function normalizeEpkSlug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function epkHasUnpublishedChanges(dirtyThisSession: boolean, epk: Pick<EpkRecord, 'status' | 'draftRevision' | 'publishedRevision'>): boolean {
  if (dirtyThisSession) return true;
  return epk.status === 'PUBLISHED' && (epk.draftRevision ?? 0) !== (epk.publishedRevision ?? 0);
}

export function epkUnpublishedLeavePrompt(status: EpkRecord['status']): { title: string; description: string; confirmLabel: string } {
  if (status === 'PUBLISHED') {
    return {
      title: 'Mettre à jour la page publique ?',
      description: 'Les modifications sont enregistrées en brouillon. Mettez à jour la page publique pour les rendre visibles.',
      confirmLabel: 'Mettre à jour',
    };
  }
  return {
    title: 'Publier la page ?',
    description: 'Les modifications sont enregistrées en brouillon. Publiez la page pour la rendre visible.',
    confirmLabel: 'Publier',
  };
}

export function validateEpkDraft(epk: Pick<EpkRecord, 'displayName' | 'slug' | 'genres'>): string | null {
  if (!epk.displayName.trim()) return 'Le nom public du groupe est requis.';
  if (!epk.slug || RESERVED_SLUGS.has(epk.slug)) return 'Ce slug est indisponible.';
  if (epk.genres.length > 5 || epk.genres.some((genre) => !genre.trim() || genre.trim().length > 40)) return 'Ajoutez entre un et cinq genres de 40 caractères maximum.';
  return null;
}

function toRecord(row: Record<string, unknown>): EpkRecord {
  const record: EpkRecord = {
    id: String(row.id), workspaceId: String(row.workspace_id), displayName: String(row.display_name ?? ''), slug: String(row.slug ?? ''),
    status: row.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT', genres: Array.isArray(row.genres) ? row.genres.filter((item): item is string => typeof item === 'string') : [],
    theme: row.theme === 'midnight-blue' || row.theme === 'press-ivory' || row.theme === 'fader-red' ? row.theme : 'stage-dark',
    accentColor: typeof row.accent_color === 'string' && /^#[0-9a-f]{6}$/i.test(row.accent_color) ? row.accent_color : DEFAULT_EPK_ACCENT,
    sectionOrder: Array.isArray(row.section_order) ? row.section_order.filter((item): item is EpkSectionId => typeof item === 'string' && EPK_SECTION_IDS.includes(item as EpkSectionId)) : [...DEFAULT_EPK_SECTION_ORDER],
    hiddenSections: Array.isArray(row.hidden_sections) ? row.hidden_sections.filter((item): item is EpkSectionId => typeof item === 'string' && EPK_SECTION_IDS.includes(item as EpkSectionId)) : [],
    draftRevision: Number(row.draft_revision ?? 0), editorial: toEditorial(row.editorial_content),
  };
  if (typeof row.city === 'string') record.city = row.city;
  if (typeof row.country === 'string') record.country = row.country;
  if (typeof row.tagline === 'string') record.tagline = row.tagline;
  if (typeof row.short_bio === 'string') record.shortBio = row.short_bio;
  if (typeof row.full_bio === 'string') record.fullBio = row.full_bio;
  if (typeof row.hero_asset_id === 'string') record.heroAssetId = row.hero_asset_id;
  if (typeof row.logo_asset_id === 'string') record.logoAssetId = row.logo_asset_id;
  if (row.featured_type === 'VIDEO' || row.featured_type === 'AUDIO' || row.featured_type === 'IMAGE') record.featuredType = row.featured_type;
  if (typeof row.featured_id === 'string') record.featuredId = row.featured_id;
  if (typeof row.published_at === 'string') record.publishedAt = row.published_at;
  if (typeof row.published_revision === 'number') record.publishedRevision = row.published_revision;
  return record;
}

function toEditorial(value: unknown): EpkEditorialContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_EPK_EDITORIAL, facts: [] };
  const data = value as Record<string, unknown>;
  const text = (key: keyof Omit<EpkEditorialContent, 'facts'>) => typeof data[key] === 'string' ? data[key] as string : DEFAULT_EPK_EDITORIAL[key];
  const facts = Array.isArray(data.facts) ? data.facts.flatMap((fact, index) => {
    if (!fact || typeof fact !== 'object' || Array.isArray(fact)) return [];
    const item = fact as Record<string, unknown>; const icon = item.icon;
    return typeof item.title === 'string' && typeof item.value === 'string'
      ? [{ id: typeof item.id === 'string' ? item.id : `fact-${index}`, title: item.title, value: item.value, icon: normalizedEpkFactIcon(icon) }]
      : [];
  }) : [];
  return { bioTitle: text('bioTitle'), musicTitle: text('musicTitle'), proTitle: text('proTitle'), proDescription: text('proDescription'), contactTitle: text('contactTitle'), facts };
}

export async function getEpk(workspaceId: string): Promise<EpkRecord | null> {
  const { data, error } = await supabase.from('epks').select('*').eq('workspace_id', workspaceId).maybeSingle();
  if (error) throw error;
  return data ? toRecord(data) : null;
}

export async function createEpk(workspaceId: string, displayName: string): Promise<EpkRecord> {
  const slug = normalizeEpkSlug(displayName);
  const { data, error } = await supabase.from('epks').insert({ workspace_id: workspaceId, display_name: displayName.trim(), slug, genres: [] }).select().single();
  if (error) throw error;
  return toRecord(data);
}

export async function saveEpk(epk: EpkRecord): Promise<EpkRecord> {
  const slug = normalizeEpkSlug(epk.slug);
  if (!slug || RESERVED_SLUGS.has(slug)) throw new Error('Ce slug est indisponible.');
  if (epk.genres.length > 5 || epk.genres.some((genre) => genre.trim().length > 40)) throw new Error('Ajoutez au maximum cinq genres de 40 caractères maximum.');
  const { data, error } = await supabase.from('epks').update({ display_name: epk.displayName.trim(), slug, genres: epk.genres.map((genre) => genre.trim()).filter(Boolean), city: epk.city?.trim() || null, country: epk.country?.trim() || null, tagline: epk.tagline?.trim() || null, short_bio: epk.shortBio?.trim() || null, full_bio: epk.fullBio?.trim() || null, theme: epk.theme, hero_asset_id: epk.heroAssetId ?? null, accent_color: epk.accentColor ?? DEFAULT_EPK_ACCENT, section_order: epk.sectionOrder ?? DEFAULT_EPK_SECTION_ORDER, hidden_sections: epk.hiddenSections ?? [], editorial_content: epk.editorial, featured_type: epk.featuredType ?? null, featured_id: epk.featuredId ?? null }).eq('id', epk.id).select().single();
  if (error) throw error;
  return toRecord(data);
}

export async function saveEpkDraft(epk: EpkRecord, expectedRevision: number): Promise<EpkRecord> {
  const patch = { display_name: epk.displayName.trim(), slug: normalizeEpkSlug(epk.slug), genres: epk.genres, city: epk.city || null, country: epk.country || null, tagline: epk.tagline || null, short_bio: epk.shortBio || null, full_bio: epk.fullBio || null, accent_color: epk.accentColor ?? DEFAULT_EPK_ACCENT, section_order: epk.sectionOrder ?? DEFAULT_EPK_SECTION_ORDER, hidden_sections: epk.hiddenSections ?? [], editorial_content: epk.editorial, featured_type: epk.featuredType ?? null, featured_id: epk.featuredId ?? null };
  const { data, error } = await supabase.rpc('save_epk_draft', { p_epk_id: epk.id, p_expected_revision: expectedRevision, p_patch: patch });
  if (error) throw error;
  if (!data || !Array.isArray(data) || !data[0]) throw new Error('Conflit de modification EPK.');
  return toRecord(data[0] as Record<string, unknown>);
}

export async function publishEpkDraft(epkId: string, expectedRevision: number): Promise<EpkRecord> {
  const data = await publishEpkMedia(epkId, expectedRevision);
  if (!data || !Array.isArray(data) || !data[0]) throw new Error('Publication EPK impossible.');
  return toRecord(data[0] as Record<string, unknown>);
}

export async function unpublishEpk(epkId: string): Promise<EpkRecord> {
  const { data, error } = await supabase.rpc('unpublish_epk', { p_epk_id: epkId });
  if (error) throw error;
  if (!data || !Array.isArray(data) || !data[0]) throw new Error('Retrait de la page publique impossible.');
  return toRecord(data[0] as Record<string, unknown>);
}

function toContact(row: Record<string, unknown>): EpkContact {
  const contact: EpkContact = { id: String(row.id), epkId: String(row.epk_id), name: String(row.name ?? ''), position: Number(row.position ?? 0) };
  if (typeof row.role === 'string' && row.role.trim()) contact.role = row.role.trim();
  if (typeof row.organisation === 'string') contact.organisation = row.organisation;
  if (typeof row.email === 'string') contact.email = row.email;
  if (typeof row.phone === 'string') contact.phone = row.phone;
  if (typeof row.whatsapp === 'string') contact.whatsapp = row.whatsapp;
  return contact;
}

export async function listEpkContacts(epkId: string): Promise<EpkContact[]> {
  const { data, error } = await supabase.from('epk_contacts').select('*').eq('epk_id', epkId).order('position');
  if (error) throw error;
  return (data ?? []).map((row) => toContact(row));
}

export async function addEpkContact(epkId: string, input: CreateEpkContactInput, position: number): Promise<EpkContact> {
  if (!input.name.trim() || (!input.email?.trim() && !input.phone?.trim() && !input.whatsapp?.trim())) throw new Error('Un nom et un moyen de contact sont requis.');
  const { data, error } = await supabase.from('epk_contacts').insert({ epk_id: epkId, name: input.name.trim(), role: input.role?.trim() || null, organisation: input.organisation?.trim() || null, email: input.email?.trim() || null, phone: input.phone?.trim() || null, whatsapp: input.whatsapp?.trim() || null, position }).select().single();
  if (error) throw error;
  return toContact(data);
}

export async function deleteEpkContact(contactId: string): Promise<void> {
  const { error } = await supabase.from('epk_contacts').delete().eq('id', contactId);
  if (error) throw error;
}

export async function updateEpkContact(contactId: string, input: { name?: string | undefined; role?: string | null | undefined; email?: string | null | undefined; phone?: string | null | undefined }): Promise<EpkContact> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    client_updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.role !== undefined) updates.role = input.role?.trim() || null;
  if (input.email !== undefined) updates.email = input.email?.trim() || null;
  if (input.phone !== undefined) updates.phone = input.phone?.trim() || null;
  const { data, error } = await supabase.from('epk_contacts').update(updates).eq('id', contactId).select().single();
  if (error) throw error;
  return toContact(data);
}

export function parseEpkVideoUrl(value: string): Pick<EpkVideo, 'provider' | 'providerVideoId'> | null {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    let videoId: string | null = null;
    if (hostname === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      videoId = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ?? null;
    }
    if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) return { provider: 'YOUTUBE', providerVideoId: videoId };
    if (hostname === 'vimeo.com' || hostname === 'player.vimeo.com') {
      videoId = url.pathname.match(/^\/(?:video\/)?(\d+)/)?.[1] ?? null;
      if (videoId) return { provider: 'VIMEO', providerVideoId: videoId };
    }
  } catch { /* invalid URL */ }
  return null;
}

function toVideo(row: Record<string, unknown>): EpkVideo {
  const video: EpkVideo = { id: String(row.id), epkId: String(row.epk_id), provider: row.provider === 'VIMEO' ? 'VIMEO' : 'YOUTUBE', providerVideoId: String(row.provider_video_id ?? ''), videoType: row.video_type === 'LIVE' || row.video_type === 'LIVE_SESSION' || row.video_type === 'MUSIC_VIDEO' || row.video_type === 'INTERVIEW' ? row.video_type : 'OTHER', position: Number(row.position ?? 0) };
  if (typeof row.title === 'string') video.title = row.title;
  return video;
}

export async function listEpkVideos(epkId: string): Promise<EpkVideo[]> {
  const { data, error } = await supabase.from('epk_videos').select('*').eq('epk_id', epkId).order('position');
  if (error) throw error;
  return (data ?? []).map((row) => toVideo(row));
}

export async function addEpkVideo(epkId: string, input: CreateEpkVideoInput, position: number): Promise<EpkVideo> {
  const video = parseEpkVideoUrl(input.url);
  if (!video) throw new Error('Utilisez une URL YouTube ou Vimeo valide.');
  const { data, error } = await supabase.from('epk_videos').insert({ epk_id: epkId, provider: video.provider, provider_video_id: video.providerVideoId, title: input.title?.trim() || null, video_type: input.videoType, position }).select().single();
  if (error) throw error;
  return toVideo(data);
}

export async function deleteEpkVideo(videoId: string): Promise<void> {
  const { error } = await supabase.from('epk_videos').delete().eq('id', videoId);
  if (error) throw error;
}

function toLink(row: Record<string, unknown>): EpkLink {
  const kinds: EpkLinkKind[] = ['SPOTIFY', 'APPLE_MUSIC', 'DEEZER', 'YOUTUBE', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'WEBSITE', 'CUSTOM'];
  const link: EpkLink = { id: String(row.id), epkId: String(row.epk_id), kind: kinds.includes(row.kind as EpkLinkKind) ? row.kind as EpkLinkKind : 'CUSTOM', url: String(row.url ?? ''), position: Number(row.position ?? 0) };
  if (typeof row.label === 'string') link.label = row.label;
  return link;
}

export async function listEpkLinks(epkId: string): Promise<EpkLink[]> {
  const { data, error } = await supabase.from('epk_links').select('*').eq('epk_id', epkId).order('position');
  if (error) throw error;
  return (data ?? []).map((row) => toLink(row));
}

export async function addEpkLink(epkId: string, input: CreateEpkLinkInput, position: number): Promise<EpkLink> {
  let url: URL;
  try { url = new URL(input.url.trim()); } catch { throw new Error('Utilisez une URL https valide.'); }
  if (url.protocol !== 'https:') throw new Error('Utilisez une URL https valide.');
  if (input.kind === 'CUSTOM' && !input.label?.trim()) throw new Error('Un libellé est requis pour un lien personnalisé.');
  const { data, error } = await supabase.from('epk_links').insert({ epk_id: epkId, kind: input.kind, label: input.label?.trim() || null, url: url.href, position }).select().single();
  if (error) throw error;
  return toLink(data);
}

export async function deleteEpkLink(linkId: string): Promise<void> {
  const { error } = await supabase.from('epk_links').delete().eq('id', linkId);
  if (error) throw error;
}

export async function updateEpkLink(linkId: string, input: { label?: string | null | undefined; url?: string | undefined }): Promise<EpkLink> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    client_updated_at: new Date().toISOString(),
  };
  if (input.label !== undefined) updates.label = input.label?.trim() || null;
  if (input.url !== undefined) {
    let url: URL;
    try { url = new URL(input.url.trim()); } catch { throw new Error('Utilisez une URL https valide.'); }
    if (url.protocol !== 'https:') throw new Error('Utilisez une URL https valide.');
    updates.url = url.href;
  }
  const { data, error } = await supabase.from('epk_links').update(updates).eq('id', linkId).select().single();
  if (error) throw error;
  return toLink(data);
}

function toPhoto(row: Record<string, unknown>): EpkPhoto {
  const photo: EpkPhoto = { id: String(row.id), epkId: String(row.epk_id), previewAssetId: String(row.preview_asset_id), originalAssetId: String(row.original_asset_id), position: Number(row.position ?? 0) };
  if (typeof row.credit === 'string') photo.credit = row.credit;
  if (typeof row.caption === 'string') photo.caption = row.caption;
  return photo;
}

export async function listEpkPhotos(epkId: string): Promise<EpkPhoto[]> {
  const { data, error } = await supabase.from('epk_photos').select('*').eq('epk_id', epkId).order('position');
  if (error) throw error;
  return (data ?? []).map(toPhoto);
}

const EPK_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
const EPK_ZIP_TYPES = new Set(['application/zip', 'application/x-zip-compressed', 'application/x-zip']);

function isEpkDocumentFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return type === 'application/pdf' || name.endsWith('.pdf') || EPK_ZIP_TYPES.has(type) || name.endsWith('.zip');
}

function epkDocumentExtension(file: File): 'pdf' | 'zip' {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return EPK_ZIP_TYPES.has(type) || name.endsWith('.zip') ? 'zip' : 'pdf';
}

function withEpkDocumentType(file: File): File {
  const mime = epkDocumentExtension(file) === 'zip' ? 'application/zip' : 'application/pdf';
  if (file.type === mime) return file;
  return new File([file], file.name, { type: mime, lastModified: file.lastModified });
}

function extensionFor(file: File): string {
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return epkDocumentExtension(file);
}

async function uploadAsset(epk: EpkRecord, file: File, kind: 'image_preview' | 'image_original' | 'document'): Promise<string> {
  const id = createId();
  const storagePath = `workspaces/${epk.workspaceId}/epks/${epk.id}/${id}.${extensionFor(file)}`;
  await uploadEpkObject(storagePath, file, kind);
  const { error } = await supabase.from('epk_assets').insert({ id, epk_id: epk.id, storage_path: storagePath, mime_type: file.type, size_bytes: file.size, kind, original_filename: file.name });
  if (!error) return id;
  await deleteEpkObject(storagePath).catch(() => undefined);
  throw error;
}

/**
 * The EPK editor runs on the application origin, whereas public media routes
 * are served by the EPK Worker. Resolve a private R2 object here instead of
 * pointing the editor at a non-existent local `/media/preview/...` route.
 */
export async function createEpkAssetSignedUrl(assetId: string): Promise<string> {
  const { data, error } = await supabase.from('epk_assets').select('storage_path').eq('id', assetId).single();
  if (error) throw error;
  if (!data?.storage_path) throw new Error('Média EPK introuvable.');
  return createAudioSignedUrl(data.storage_path);
}

export async function uploadEpkHeroImage(epk: EpkRecord, file: File): Promise<EpkRecord> {
  const image = await compressEpkImage(file, EPK_HERO_IMAGE_SIZE);
  const previousAssetId = epk.heroAssetId;
  const assetId = await uploadAsset(epk, image, 'image_preview');
  try {
    const saved = await saveEpk({ ...epk, heroAssetId: assetId, featuredType: 'IMAGE', featuredId: assetId });
    if (previousAssetId && previousAssetId !== assetId) await deleteEpkAsset(previousAssetId).catch(() => undefined);
    return saved;
  } catch (error) {
    const { data: asset } = await supabase.from('epk_assets').select('storage_path').eq('id', assetId).maybeSingle();
    await supabase.from('epk_assets').delete().eq('id', assetId);
    if (asset?.storage_path) await deleteEpkObject(asset.storage_path).catch(() => undefined);
    throw error;
  }
}

async function deleteEpkAsset(assetId: string): Promise<void> {
  const { data: asset, error: assetError } = await supabase.from('epk_assets').select('storage_path').eq('id', assetId).maybeSingle();
  if (assetError) throw assetError;
  const { error } = await supabase.from('epk_assets').delete().eq('id', assetId);
  if (error) throw error;
  if (asset?.storage_path) await deleteEpkObject(asset.storage_path);
}

export async function deleteEpkHeroImage(epk: EpkRecord): Promise<EpkRecord> {
  const assetId = epk.heroAssetId;
  if (!assetId) return epk;

  const next = { ...epk };
  delete next.heroAssetId;
  if (next.featuredId === assetId) {
    delete next.featuredId;
    delete next.featuredType;
  }
  const saved = await saveEpk(next);
  await deleteEpkAsset(assetId).catch(() => undefined);
  return saved;
}

export async function addEpkPhoto(epk: EpkRecord, file: File, input: { credit?: string; caption?: string }, position: number): Promise<EpkPhoto> {
  const image = await compressEpkImage(file, EPK_PHOTO_IMAGE_SIZE);
  const previewId = await uploadAsset(epk, image, 'image_preview');
  try {
    const { data, error } = await supabase.from('epk_photos').insert({ epk_id: epk.id, preview_asset_id: previewId, original_asset_id: previewId, credit: input.credit?.trim() || null, caption: input.caption?.trim() || null, position }).select().single();
    if (error) throw error;
    return toPhoto(data);
  } catch (error) {
    await supabase.from('epk_assets').delete().eq('id', previewId);
    throw error;
  }
}

export async function deleteEpkPhoto(photo: EpkPhoto): Promise<void> {
  const { data: assets, error: assetsError } = await supabase.from('epk_assets').select('id,storage_path').in('id', [photo.previewAssetId, photo.originalAssetId]);
  if (assetsError) throw assetsError;
  const { error } = await supabase.from('epk_photos').delete().eq('id', photo.id);
  if (error) throw error;
  const { error: deleteError } = await supabase.from('epk_assets').delete().in('id', [photo.previewAssetId, photo.originalAssetId]);
  if (deleteError) throw deleteError;
  await Promise.all((assets ?? []).map((asset) => deleteEpkObject(String(asset.storage_path))));
}

function toDocument(row: Record<string, unknown>): EpkDocument {
  const description = typeof row.description === 'string' ? row.description.trim() : '';
  return {
    id: String(row.id),
    epkId: String(row.epk_id),
    assetId: String(row.asset_id),
    title: String(row.title ?? ''),
    ...(description ? { description } : {}),
    icon: isEpkDocumentIcon(row.icon) ? row.icon : DEFAULT_EPK_DOCUMENT_ICON,
    documentUpdatedAt: String(row.document_updated_at ?? ''),
    position: Number(row.position ?? 0),
  };
}

export async function listEpkDocuments(epkId: string): Promise<EpkDocument[]> {
  const { data, error } = await supabase.from('epk_documents').select('*').eq('epk_id', epkId).order('position');
  if (error) throw error;
  return (data ?? []).map(toDocument);
}

export async function addEpkDocument(epk: EpkRecord, file: File, input: { title: string; description?: string; icon: EpkDocumentIcon; documentUpdatedAt: string }, position: number): Promise<EpkDocument> {
  if (!isEpkDocumentFile(file) || file.size > EPK_DOCUMENT_MAX_BYTES) throw new Error('Choisissez un PDF ou un ZIP de 15 Mo maximum.');
  if (!input.title.trim()) throw new Error('Le titre du document est requis.');
  if (!isEpkDocumentIcon(input.icon)) throw new Error('Choisissez une icône.');
  const assetId = await uploadAsset(epk, withEpkDocumentType(file), 'document');
  const description = input.description?.trim() || null;
  const { data, error } = await supabase.from('epk_documents').insert({ epk_id: epk.id, asset_id: assetId, title: input.title.trim(), description, icon: input.icon, document_type: 'OTHER', document_updated_at: input.documentUpdatedAt || undefined, position }).select().single();
  if (!error) return toDocument(data);
  const { data: asset } = await supabase.from('epk_assets').select('storage_path').eq('id', assetId).single();
  await supabase.from('epk_assets').delete().eq('id', assetId);
  if (asset?.storage_path) await deleteEpkObject(asset.storage_path).catch(() => undefined);
  throw error;
}

export async function updateEpkDocument(epk: EpkRecord, document: EpkDocument, input: { title: string; description?: string; icon: EpkDocumentIcon }, file?: File): Promise<EpkDocument> {
  if (!input.title.trim()) throw new Error('Le titre du document est requis.');
  if (!isEpkDocumentIcon(input.icon)) throw new Error('Choisissez une icône.');
  if (file && (!isEpkDocumentFile(file) || file.size > EPK_DOCUMENT_MAX_BYTES)) throw new Error('Choisissez un PDF ou un ZIP de 15 Mo maximum.');
  const description = input.description?.trim() || null;
  const documentUpdatedAt = new Date().toISOString().slice(0, 10);
  let assetId = document.assetId;
  let previousPath: string | undefined;
  if (file) {
    const { data: current, error: currentError } = await supabase.from('epk_assets').select('storage_path').eq('id', document.assetId).single();
    if (currentError) throw currentError;
    previousPath = current.storage_path;
    assetId = await uploadAsset(epk, withEpkDocumentType(file), 'document');
  }
  const { data, error } = await supabase.from('epk_documents').update({ title: input.title.trim(), description, icon: input.icon, asset_id: assetId, document_updated_at: documentUpdatedAt }).eq('id', document.id).select().single();
  if (!error) {
    if (file && previousPath) {
      await supabase.from('epk_assets').delete().eq('id', document.assetId);
      await deleteEpkObject(previousPath).catch(() => undefined);
    }
    return toDocument(data);
  }
  if (file && assetId !== document.assetId) {
    const { data: asset } = await supabase.from('epk_assets').select('storage_path').eq('id', assetId).single();
    await supabase.from('epk_assets').delete().eq('id', assetId);
    if (asset?.storage_path) await deleteEpkObject(asset.storage_path).catch(() => undefined);
  }
  throw error;
}

export async function deleteEpkDocument(document: EpkDocument): Promise<void> {
  const { data: asset, error: assetError } = await supabase.from('epk_assets').select('storage_path').eq('id', document.assetId).single();
  if (assetError) throw assetError;
  const { error } = await supabase.from('epk_documents').delete().eq('id', document.id);
  if (error) throw error;
  const { error: deleteError } = await supabase.from('epk_assets').delete().eq('id', document.assetId);
  if (deleteError) throw deleteError;
  await deleteEpkObject(asset.storage_path);
}

export async function listAvailableEpkTracks(workspaceId: string): Promise<AvailableEpkTrack[]> {
  const [assets, songs] = await Promise.all([
    db.songAssets.where('workspaceId').equals(workspaceId).toArray(),
    db.songs.where('workspaceId').equals(workspaceId).toArray(),
  ]);
  const songTitles = new Map(songs.filter((song) => song.deletedAt === undefined).map((song) => [song.id, song.title]));
  return assets
    .filter((asset) => asset.deletedAt === undefined)
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((asset) => asset.songId && songTitles.has(asset.songId)
      ? { id: asset.id, filename: asset.filename, songId: asset.songId, songTitle: songTitles.get(asset.songId)!, isSynced: asset.syncStatus === 'synced' }
      : { id: asset.id, filename: asset.filename, isSynced: asset.syncStatus === 'synced' });
}

function toTrack(row: Record<string, unknown>): EpkTrack { return { id: String(row.id), epkId: String(row.epk_id), title: String(row.title ?? ''), visibility: row.visibility === 'UNLISTED' ? 'UNLISTED' : 'PUBLIC', sourceType: row.source_type === 'EPK_ASSET' ? 'EPK_ASSET' : 'SONG_ASSET', ...(typeof row.song_asset_id === 'string' ? { songAssetId: row.song_asset_id } : {}), ...(typeof row.audio_asset_id === 'string' ? { audioAssetId: row.audio_asset_id } : {}), position: Number(row.position ?? 0), ...(typeof row.description === 'string' ? { description: row.description } : {}) }; }
export async function listEpkTracks(epkId: string): Promise<EpkTrack[]> { const { data, error } = await supabase.from('epk_tracks').select('*').eq('epk_id', epkId).order('position'); if (error) throw error; return (data ?? []).map(toTrack); }
export async function addEpkTrack(epkId: string, asset: AvailableEpkTrack, position: number, displayTitle: string): Promise<EpkTrack> { if (!asset.isSynced) throw new Error('Cet audio doit être synchronisé avant de pouvoir être ajouté à un EPK public.'); const { data, error } = await supabase.from('epk_tracks').insert({ epk_id: epkId, title: displayTitle.trim(), position, source_type: 'SONG_ASSET', song_asset_id: asset.id, visibility: 'PUBLIC' }).select().single(); if (error) throw error; return toTrack(data); }
export async function deleteEpkTrack(trackId: string): Promise<void> { const { error } = await supabase.from('epk_tracks').delete().eq('id', trackId); if (error) throw error; }

export async function getEpkTrackAudioUrl(track: EpkTrack): Promise<string> {
  if (track.sourceType === 'SONG_ASSET' && track.songAssetId) {
    try {
      const cached = await getCachedAudioUrl(track.songAssetId);
      if (cached) return cached;
    } catch {
      // ignore
    }
    const local = await songAssetsRepository.getById(track.songAssetId);
    if (local?.storagePath) {
      return createAudioSignedUrl(local.storagePath);
    }
    const { data, error } = await supabase.from('song_assets').select('storage_path').eq('id', track.songAssetId).single();
    if (error) throw error;
    if (!data?.storage_path) throw new Error('Fichier audio introuvable.');
    return createAudioSignedUrl(data.storage_path);
  }
  if (track.sourceType === 'EPK_ASSET' && track.audioAssetId) {
    return createEpkAssetSignedUrl(track.audioAssetId);
  }
  throw new Error('Piste audio introuvable.');
}

export function getEpkCompleteness(epk: EpkRecord, contactCount: number): number {
  let score = 0;
  if (epk.displayName && epk.genres.length && epk.city) score += 25;
  if (epk.heroAssetId || epk.featuredId) score += 15;
  if (epk.shortBio || epk.fullBio) score += 15;
  if (contactCount > 0) score += 15;
  return score;
}
