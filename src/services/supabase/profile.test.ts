import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  assertSupabaseConfig: vi.fn(),
  supabase: {
    auth: { getSession: supabaseMocks.getSession },
    from: supabaseMocks.from,
    storage: { from: supabaseMocks.storageFrom },
  },
}));

import {
  getCurrentProfile,
  getGeneratedAvatar,
  getProfileAvatarUrl,
  normalizeDisplayName,
  updateCurrentProfileDisplayName,
  uploadCurrentProfileAvatar,
} from '@/services/supabase/profile';

const profileRow = {
  id: 'profile-1',
  display_name: 'Élodie !',
  avatar_path: null,
  avatar_updated_at: null,
  created_at: '2026-07-22T10:00:00.000Z',
  updated_at: '2026-07-22T10:00:00.000Z',
};

function selectChain(result = { data: profileRow, error: null }) {
  const chain = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

describe('profile service', () => {
  beforeEach(() => {
    supabaseMocks.getSession.mockReset();
    supabaseMocks.from.mockReset();
    supabaseMocks.storageFrom.mockReset();
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'profile-1' } } },
      error: null,
    });
  });

  it('normalise le pseudo sans interdire les accents et caractères spéciaux', () => {
    expect(normalizeDisplayName('  Élodie !  ')).toBe('Élodie !');
    expect(() => normalizeDisplayName('x')).toThrow('entre 2 et 30 caractères');
    expect(() => normalizeDisplayName('a'.repeat(31))).toThrow('entre 2 et 30 caractères');
  });

  it('génère deux lettres majuscules et une couleur stable', () => {
    expect(getGeneratedAvatar(' élodie ', 'profile-1')).toEqual({
      initials: 'ÉL',
      hue: getGeneratedAvatar('autre', 'profile-1').hue,
    });
  });

  it('lit uniquement le profil de la session courante', async () => {
    const chain = selectChain();
    supabaseMocks.from.mockReturnValue(chain);

    await expect(getCurrentProfile()).resolves.toMatchObject({
      id: 'profile-1',
      displayName: 'Élodie !',
      avatarPath: null,
    });
    expect(supabaseMocks.from).toHaveBeenCalledWith('profiles');
    expect(chain.eq).toHaveBeenCalledWith('id', 'profile-1');
  });

  it('enregistre le pseudo normalisé pour la session courante', async () => {
    const chain = selectChain();
    supabaseMocks.from.mockReturnValue(chain);

    await expect(updateCurrentProfileDisplayName('  Nouveau pseudo  ')).resolves.toMatchObject({
      displayName: 'Élodie !',
    });
    expect(chain.update).toHaveBeenCalledWith({ display_name: 'Nouveau pseudo' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'profile-1');
  });

  it('crée une URL signée pour un avatar privé', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.test/avatar.webp' },
      error: null,
    });
    supabaseMocks.storageFrom.mockReturnValue({ createSignedUrl });

    await expect(getProfileAvatarUrl('profile-1/avatar.webp')).resolves.toBe('https://storage.test/avatar.webp');
    expect(supabaseMocks.storageFrom).toHaveBeenCalledWith('avatars');
    expect(createSignedUrl).toHaveBeenCalledWith('profile-1/avatar.webp', 3600);
  });

  it('refuse un fichier avatar non-image avant tout téléversement', async () => {
    const file = new File(['texte'], 'avatar.txt', { type: 'text/plain' });

    await expect(uploadCurrentProfileAvatar(file)).rejects.toThrow('JPEG, PNG ou WebP');
    expect(supabaseMocks.storageFrom).not.toHaveBeenCalled();
  });
});
