import { assertSupabaseConfig, supabase } from './client';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SOURCE_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 512;
const PROFILE_COLUMNS = 'id, display_name, avatar_path, avatar_updated_at, created_at, updated_at';

export interface Profile {
  id: string;
  displayName: string;
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_path: string | null;
  avatar_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeneratedAvatar {
  initials: string;
  hue: number;
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    avatarUpdatedAt: row.avatar_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error('Vous devez être connecté pour modifier votre profil.');
  return data.session.user.id;
}

function assertValidAvatarFile(file: File): void {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choisissez une image JPEG, PNG ou WebP.');
  }
  if (file.size > MAX_AVATAR_SOURCE_BYTES) {
    throw new Error("L'image doit peser moins de 5 Mo.");
  }
}

async function loadAvatarImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function prepareAvatarBlob(file: File): Promise<Blob> {
  assertValidAvatarFile(file);
  const image = await loadAvatarImage(file);
  const sourceSize = Math.min(image.width, image.height);
  const sourceX = (image.width - sourceSize) / 2;
  const sourceY = (image.height - sourceSize) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext('2d');

  if (!context) throw new Error("Impossible de préparer l'image sur cet appareil.");
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  if ('close' in image && typeof image.close === 'function') image.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Impossible de convertir l'image en WebP.")),
      'image/webp',
      0.86,
    );
  });
}

export function normalizeDisplayName(value: string): string {
  const displayName = value.trim();
  const length = Array.from(displayName).length;

  if (length < 2 || length > 30) {
    throw new Error('Le pseudo doit contenir entre 2 et 30 caractères.');
  }

  return displayName;
}

export function getGeneratedAvatar(displayName: string, profileId: string): GeneratedAvatar {
  const letters = Array.from(displayName.trim()).filter((character) => character.trim().length > 0);
  const initials = letters.slice(0, 2).join('').toLocaleUpperCase('fr-FR') || 'FZ';
  let hash = 0;

  for (const character of profileId) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }

  return { initials, hue: hash % 360 };
}

export async function getCurrentProfile(): Promise<Profile> {
  assertSupabaseConfig();
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();

  if (error) throw error;
  return mapProfile(data as ProfileRow);
}

export async function updateCurrentProfileDisplayName(value: string): Promise<Profile> {
  assertSupabaseConfig();
  const displayName = normalizeDisplayName(value);
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw error;
  return mapProfile(data as ProfileRow);
}

export async function getProfileAvatarUrl(avatarPath: string | null): Promise<string | null> {
  assertSupabaseConfig();
  if (!avatarPath) return null;

  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(avatarPath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadCurrentProfileAvatar(file: File): Promise<Profile> {
  assertSupabaseConfig();
  const userId = await getCurrentUserId();
  const avatarBlob = await prepareAvatarBlob(file);
  const avatarPath = `${userId}/avatar-${Date.now()}.webp`;
  const currentProfile = await getCurrentProfile();
  const avatarStorage = supabase.storage.from(AVATAR_BUCKET);
  const { error: uploadError } = await avatarStorage.upload(avatarPath, avatarBlob, {
    cacheControl: '3600',
    contentType: 'image/webp',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_path: avatarPath })
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (profileError) {
    await avatarStorage.remove([avatarPath]);
    throw profileError;
  }

  if (currentProfile.avatarPath && currentProfile.avatarPath !== avatarPath) {
    await avatarStorage.remove([currentProfile.avatarPath]);
  }

  return mapProfile(data as ProfileRow);
}
