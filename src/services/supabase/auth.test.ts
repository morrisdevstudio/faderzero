import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
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
  requestEmailChange,
  requestPasswordReset,
  resendSignupConfirmation,
  signUpWithPassword,
} from '@/services/supabase/auth';

describe('service Auth', () => {
  beforeEach(() => {
    authMocks.signUp.mockReset();
    authMocks.resetPasswordForEmail.mockReset();
    authMocks.getSession.mockReset();
    authMocks.signInWithPassword.mockReset();
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

  it('transmet le pseudo et le retour de confirmation à Supabase', async () => {
    authMocks.signUp.mockResolvedValue({ data: { session: null }, error: null });

    await expect(signUpWithPassword('Élodie !', 'elodie@example.test', 'Fader123')).resolves.toEqual({
      session: null,
      needsEmailConfirmation: true,
    });
    expect(authMocks.signUp).toHaveBeenCalledWith({
      email: 'elodie@example.test',
      password: 'Fader123',
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: 'Élodie !' },
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
});
