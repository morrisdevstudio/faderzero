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

  it('utilise le logo partagé en blanc dans les dimensions historiques', () => {
    render(<LoginPage />);

    const brand = screen.getByRole('img', { name: 'FaderZero' });
    const logo = brand.querySelector('svg');

    expect(logo).toHaveClass('h-[54px]', 'w-[147px]', 'text-white');
    expect(logo).toHaveAttribute('preserveAspectRatio', 'none');
    expect(logo).toHaveAttribute('viewBox', '0 0 96 40');
  });

  it('utilise le style partagé pour les titres de champs', () => {
    render(<LoginPage />);

    expect(screen.getByText('Adresse e-mail')).toHaveClass('fz-field-label');
    expect(screen.getByText('Mot de passe')).toHaveClass('fz-field-label');

    fireEvent.click(screen.getByRole('button', { name: 'Inscription' }));
    expect(screen.getByText('Pseudo')).toHaveClass('fz-field-label');
    expect(screen.getByText('Confirmer le mot de passe')).toHaveClass('fz-field-label');
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

  it('affiche une erreur quand les identifiants de connexion sont incorrects', async () => {
    authMocks.signIn.mockRejectedValue(new Error('Identifiant ou mot de passe incorrect.'));
    render(<LoginPage />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Adresse e-mail' }), { target: { value: 'inconnu@example.test' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'incorrect' } });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Identifiant ou mot de passe incorrect.')).toBeInTheDocument();
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
