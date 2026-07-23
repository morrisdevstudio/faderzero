import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  requestPasswordReset: vi.fn(),
  resendSignupConfirmation: vi.fn(),
  clearFeedback: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    ...authMocks,
    loading: false,
    error: null,
    infoMessage: null,
  }),
}));

vi.mock('@/services/supabase/client', () => ({
  getSupabaseConfigError: () => null,
}));

import { LoginPage } from '@/components/LoginPage';

describe('LoginPage inscription et récupération', () => {
  beforeEach(() => {
    Object.values(authMocks).forEach((mock) => mock.mockReset());
  });

  it('valide le pseudo, les règles du mot de passe et sa confirmation', async () => {
    authMocks.signUp.mockResolvedValue({ session: null, needsEmailConfirmation: true });
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Inscription' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Pseudo' }), { target: { value: '  Élodie !  ' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Adresse e-mail' }), { target: { value: 'ELODIE@example.test' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'Fader123' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'Fader123' } });

    expect(screen.getByText('✓ Une majuscule')).toBeInTheDocument();
    expect(screen.getByText('✓ Une minuscule')).toBeInTheDocument();
    expect(screen.getByText('✓ Un chiffre')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Creer mon compte' }));

    await waitFor(() => {
      expect(authMocks.signUp).toHaveBeenCalledWith('Élodie !', 'elodie@example.test', 'Fader123');
    });

    authMocks.resendSignupConfirmation.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: "Renvoyer l'e-mail de confirmation" }));
    await waitFor(() => {
      expect(authMocks.resendSignupConfirmation).toHaveBeenCalledWith('elodie@example.test');
    });
  });

  it('refuse un mot de passe faible sans appeler Supabase', async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Inscription' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Pseudo' }), { target: { value: 'Yann' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Adresse e-mail' }), { target: { value: 'yann@example.test' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'faible12' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'faible12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Creer mon compte' }));

    expect(await screen.findByText(/une majuscule, une minuscule et un chiffre/)).toBeInTheDocument();
    expect(authMocks.signUp).not.toHaveBeenCalled();
  });

  it('lance la récupération depuis un message non discriminant', async () => {
    authMocks.requestPasswordReset.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Adresse e-mail' }), { target: { value: 'inconnu@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }));

    await waitFor(() => {
      expect(authMocks.requestPasswordReset).toHaveBeenCalledWith('inconnu@example.test');
    });
    expect(screen.getByText(/ne confirme jamais si une adresse possède un compte/)).toBeInTheDocument();
  });
});
