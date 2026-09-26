import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  linkIdentity: vi.fn(),
  getUserIdentities: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  resend: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  assertSupabaseConfig: vi.fn(),
  supabase: { auth: authMocks },
}));

import {
  changePassword,
  completePasswordRecovery,
  getSession,
  requestEmailChange,
  requestPasswordReset,
  resendSignupConfirmation,
  signInWithGoogle,
  linkGoogleIdentity,
  hasGoogleIdentity,
  signInWithPassword,
  signUpWithPassword,
} from '@/services/supabase/auth';

describe('service Auth', () => {
  beforeEach(() => {
    authMocks.signUp.mockReset();
    authMocks.resetPasswordForEmail.mockReset();
    authMocks.getSession.mockReset();
    authMocks.signInWithPassword.mockReset();
    authMocks.signInWithOAuth.mockReset();
    authMocks.linkIdentity.mockReset();
    authMocks.getUserIdentities.mockReset();
    authMocks.updateUser.mockReset();
    authMocks.signOut.mockReset();
    authMocks.resend.mockReset();
  });

  it('demande une double confirmation lors du changement d’e-mail', async () => {
    authMocks.updateUser.mockResolvedValue({ data: {}, error: null });
    await requestEmailChange('nouveau@example.test');
    expect(authMocks.updateUser).toHaveBeenCalledWith(
      { email: 'nouveau@example.test' },
      { emailRedirectTo: `${window.location.origin}/account` },
    );
  });

  it('redirige la connexion Google vers le callback de la PWA', async () => {
    authMocks.signInWithOAuth.mockResolvedValue({ data: {}, error: null });

    await signInWithGoogle();

    expect(authMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?view=app` },
    });
  });

  it('attend un délai réseau réaliste et annule son minuteur après une connexion réussie', async () => {
    vi.useFakeTimers();
    authMocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: null });

    await expect(signInWithPassword('compte@example.test', 'MotDePasse123')).resolves.toEqual({ session: null });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(authMocks.signInWithPassword).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('retourne un message clair lorsque la connexion expire', async () => {
    vi.useFakeTimers();
    authMocks.signInWithPassword.mockImplementation(() => new Promise(() => undefined));
    const attempt = signInWithPassword('compte@example.test', 'MotDePasse123');
    const rejection = expect(attempt).rejects.toThrow('La connexion prend trop de temps');

    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
    vi.useRealTimers();
  });

  it('associe Google et lit les identités déjà rattachées', async () => {
    authMocks.linkIdentity.mockResolvedValue({ data: {}, error: null });
    authMocks.getUserIdentities.mockResolvedValue({
      data: { identities: [{ provider: 'email' }, { provider: 'google' }] },
      error: null,
    });

    await linkGoogleIdentity();
    await expect(hasGoogleIdentity()).resolves.toBe(true);

    expect(authMocks.linkIdentity).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?view=app` },
    });
  });

  it('vérifie le mot de passe courant puis révoque toutes les sessions', async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { user: { email: 'compte@example.test' } } },
      error: null,
    });
    authMocks.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    authMocks.updateUser.mockResolvedValue({ data: {}, error: null });
    authMocks.signOut.mockResolvedValue({ error: null });

    await changePassword('Ancien123', 'Nouveau123');

    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'compte@example.test',
      password: 'Ancien123',
    });
    expect(authMocks.updateUser).toHaveBeenCalledWith({ password: 'Nouveau123' });
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });

  it('révoque aussi toutes les sessions après une récupération', async () => {
    authMocks.updateUser.mockResolvedValue({ data: {}, error: null });
    authMocks.signOut.mockResolvedValue({ error: null });

    await completePasswordRecovery('Nouveau123');

    expect(authMocks.signInWithPassword).not.toHaveBeenCalled();
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });

  it('transmet l’inscription et le retour de confirmation à Supabase', async () => {
    authMocks.signUp.mockResolvedValue({ data: { session: null }, error: null });

    await expect(signUpWithPassword('elodie@example.test', 'Fader123')).resolves.toEqual({
      session: null,
      needsEmailConfirmation: true,
    });
    expect(authMocks.signUp).toHaveBeenCalledWith({
      email: 'elodie@example.test',
      password: 'Fader123',
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
  });

  it('renvoie une confirmation d’inscription vers l’origine courante', async () => {
    authMocks.resend.mockResolvedValue({ data: {}, error: null });

    await resendSignupConfirmation('elodie@example.test');

    expect(authMocks.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'elodie@example.test',
      options: { emailRedirectTo: window.location.origin },
    });
  });

  it('demande un lien de récupération vers le parcours compte', async () => {
    authMocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    await requestPasswordReset('compte@example.test');

    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith('compte@example.test', {
      redirectTo: `${window.location.origin}/account?reset-password=1`,
    });
  });

  it('ignores and removes any legacy local demo session', async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    localStorage.setItem('faderzero_demo_session', JSON.stringify({ user: { id: 'demo-user' } }));

    await expect(getSession()).resolves.toBeNull();

    expect(localStorage.getItem('faderzero_demo_session')).toBeNull();
  });
});
