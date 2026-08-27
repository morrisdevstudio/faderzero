import { supabase } from '@/services/supabase/client';

export type EpkStatus = 'DRAFT' | 'PUBLISHED';
export type EpkTheme = 'stage-dark' | 'midnight-blue' | 'press-ivory' | 'fader-red';
export type EpkVideoType = 'LIVE' | 'LIVE_SESSION' | 'MUSIC_VIDEO' | 'INTERVIEW' | 'OTHER';
export type EpkContactRole = 'BAND' | 'BOOKING' | 'MANAGEMENT' | 'TECH' | 'PRESS' | 'PRODUCTION' | 'OTHER';
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
}

export interface EpkContact {
  id: string;
  epkId: string;
  name: string;
  role: EpkContactRole;
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
  role: EpkContactRole;
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
  return record;
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
  const validation = validateEpkDraft({ displayName: epk.displayName, slug, genres: epk.genres });
  if (validation) throw new Error(validation);
  const { data, error } = await supabase.from('epks').update({ display_name: epk.displayName.trim(), slug, genres: epk.genres.map((genre) => genre.trim()).filter(Boolean), city: epk.city?.trim() || null, country: epk.country?.trim() || null, tagline: epk.tagline?.trim() || null, short_bio: epk.shortBio?.trim() || null, full_bio: epk.fullBio?.trim() || null, theme: epk.theme }).eq('id', epk.id).select().single();
  if (error) throw error;
  return toRecord(data);
}

export async function setEpkStatus(epkId: string, status: EpkStatus): Promise<EpkRecord> {
  const { data, error } = await supabase.from('epks').update({ status }).eq('id', epkId).select().single();
  if (error) throw error;
  return toRecord(data);
}

function toContact(row: Record<string, unknown>): EpkContact {
  const contact: EpkContact = { id: String(row.id), epkId: String(row.epk_id), name: String(row.name ?? ''), role: row.role === 'BAND' || row.role === 'BOOKING' || row.role === 'MANAGEMENT' || row.role === 'TECH' || row.role === 'PRESS' || row.role === 'PRODUCTION' ? row.role : 'OTHER', position: Number(row.position ?? 0) };
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
  const { data, error } = await supabase.from('epk_contacts').insert({ epk_id: epkId, name: input.name.trim(), role: input.role, organisation: input.organisation?.trim() || null, email: input.email?.trim() || null, phone: input.phone?.trim() || null, whatsapp: input.whatsapp?.trim() || null, position }).select().single();
  if (error) throw error;
  return toContact(data);
}

export async function deleteEpkContact(contactId: string): Promise<void> {
  const { error } = await supabase.from('epk_contacts').delete().eq('id', contactId);
  if (error) throw error;
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

export function getEpkCompleteness(epk: EpkRecord, contactCount: number): number {
  let score = 0;
  if (epk.displayName && epk.genres.length && epk.city) score += 25;
  if (epk.heroAssetId || epk.featuredId) score += 15;
  if (epk.shortBio || epk.fullBio) score += 15;
  if (contactCount > 0) score += 15;
  return score;
}
