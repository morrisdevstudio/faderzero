import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getSupabaseConfigError } from '@/services/supabase/client';
import { normalizeDisplayName } from '@/services/supabase/profile';
import { assertValidPassword, getPasswordRequirements } from '@/services/supabase/passwordPolicy';
import { PasswordField } from '@/ui/components/PasswordField';
import { TextField } from '@/ui/components/TextField';
import { FaderLogo } from '@/ui/components/FaderLogo';

type AuthMode = 'signin' | 'signup' | 'forgot';

interface LoginPageProps {
  inviteTokenPresent?: boolean;
}

export function LoginPage({ inviteTokenPresent = false }: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  const {
    signIn,
    signUp,
    requestPasswordReset,
    resendSignupConfirmation,
    loading,
    error,
    infoMessage,
    clearFeedback,
  } = useAuthStore();
  const configError = getSupabaseConfigError();
  const displayedError = configError ?? localError ?? error;

  useEffect(() => {
    setLocalError(null);
    clearFeedback();
  }, [mode, clearFeedback]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || configError) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || (mode !== 'forgot' && !password)) return;

    setLocalError(null);
    clearFeedback();

    try {
      if (mode === 'forgot') {
        await requestPasswordReset(normalizedEmail);
      } else if (mode === 'signin') {
        await signIn(normalizedEmail, password);
      } else {
        const normalizedDisplayName = normalizeDisplayName(displayName);
        assertValidPassword(password);
        if (password !== confirmPassword) {
          throw new Error('Les mots de passe ne correspondent pas.');
        }
        const result = await signUp(normalizedDisplayName, normalizedEmail, password);
        setPendingConfirmationEmail(result.needsEmailConfirmation ? normalizedEmail : null);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Impossible de traiter la demande.');
    }
  }

  async function handleResendConfirmation() {
    if (!pendingConfirmationEmail || loading) return;
    setLocalError(null);
    clearFeedback();
    try {
      await resendSignupConfirmation(pendingConfirmationEmail);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Impossible de renvoyer l'e-mail.");
    }
  }

  const passwordRequirements = getPasswordRequirements(password);
  const title = mode === 'signin' ? 'Connexion' : mode === 'signup' ? 'Créer un compte' : 'Mot de passe oublié';
  const subtitle =
    mode === 'signin'
      ? inviteTokenPresent
        ? 'Connectez-vous pour accepter le lien de groupe que vous avez reçu.'
        : 'Connectez-vous pour retrouver votre groupe et vos données.'
      : mode === 'signup'
        ? 'Créez votre accès FaderZero. Votre e-mail devra être confirmé avant la connexion.'
        : 'Saisissez votre adresse e-mail pour recevoir le lien de réinitialisation.';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c0d10] px-4 py-8 text-[#f5f0ea]">
      {/* Soft background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] left-1/2 -translate-x-1/2 h-[70%] w-[90%] max-w-2xl rounded-full bg-[#ff3a63]/10 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-md rounded-[1.8rem] border border-white/10 bg-[rgba(16,18,24,0.96)] p-7 sm:p-8 shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <div role="img" aria-label="FaderZero">
            <FaderLogo
              className="h-[54px] w-[147px] text-white"
              preserveAspectRatio="none"
            />
          </div>
        </div>

        {/* Tab Selector */}
        {mode !== 'forgot' ? (
          <div className="mb-6 rounded-[1.2rem] border border-white/10 bg-black/40 p-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`rounded-[0.9rem] px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.16em] transition ${
                  mode === 'signin'
                    ? 'fz-button-primary shadow-[0_8px_20px_rgba(255,58,99,0.35)]'
                    : 'text-white/55 hover:bg-white/5 hover:text-white'
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`rounded-[0.9rem] px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.16em] transition ${
                  mode === 'signup'
                    ? 'fz-button-primary shadow-[0_8px_20px_rgba(255,58,99,0.35)]'
                    : 'text-white/55 hover:bg-white/5 hover:text-white'
                }`}
              >
                Inscription
              </button>
            </div>
          </div>
        ) : null}

        {/* Title */}
        <div className="mb-6 text-center">
          <h2 className="text-lg font-black uppercase tracking-[0.18em] text-white">{title}</h2>
          <p className="mt-1.5 text-[0.76rem] leading-relaxed text-white/55">{subtitle}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {mode === 'signup' ? (
            <div>
              <label htmlFor="displayName" className="fz-field-label">
                Pseudo
              </label>
              <TextField
                id="displayName"
                type="text"
                required
                minLength={2}
                maxLength={30}
                autoComplete="nickname"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Votre nom affiché"
                disabled={loading}
              />
              <p className="mt-1.5 text-[0.68rem] text-white/40">2 à 30 caractères, non unique.</p>
            </div>
          ) : null}

          <div>
            <label htmlFor="email" className="fz-field-label">
              Adresse e-mail
            </label>
            <TextField
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@exemple.com"
              disabled={loading}
            />
          </div>

          {mode !== 'forgot' ? (
            <div>
              <label htmlFor="password" className="fz-field-label">
                Mot de passe
              </label>
              <PasswordField
                  key={`password-${mode}`}
                  id="password"
                  required
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Au moins 8 caractères"
                  disabled={loading}
                />
            </div>
          ) : null}

          {mode === 'signup' ? (
            <ul className="grid grid-cols-2 gap-2 text-[0.68rem]" aria-label="Règles du mot de passe">
              {[
                ['8 caractères', passwordRequirements.minimumLength],
                ['Une majuscule', passwordRequirements.uppercase],
                ['Une minuscule', passwordRequirements.lowercase],
                ['Un chiffre', passwordRequirements.digit],
              ].map(([label, valid]) => (
                <li key={String(label)} className={valid ? 'text-emerald-300 font-medium' : 'text-white/40'}>
                  {valid ? '✓' : '○'} {label}
                </li>
              ))}
            </ul>
          ) : null}

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" className="fz-field-label">
                Confirmer le mot de passe
              </label>
              <PasswordField
                  id="confirmPassword"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Retapez votre mot de passe"
                  disabled={loading}
                  showPasswordLabel="Afficher la confirmation du mot de passe"
                  hidePasswordLabel="Masquer la confirmation du mot de passe"
                />
            </div>
          )}

          {mode === 'signin' ? (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-[0.7rem] font-bold text-white/60 transition hover:text-white"
              >
                Mot de passe oublié ?
              </button>
            </div>
          ) : null}

          {mode === 'forgot' ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-[0.7rem] font-bold text-white/60 transition hover:text-white"
              >
                Retour à la connexion
              </button>
            </div>
          ) : null}

          {displayedError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-center text-[0.75rem] text-rose-300">
              {displayedError}
            </div>
          )}

          {infoMessage && (
            <div className="rounded-xl border border-white/20 bg-white/10 p-3 text-center text-[0.75rem] text-white/90">
              {infoMessage}
            </div>
          )}

          {mode === 'signup' && pendingConfirmationEmail ? (
            <button
              type="button"
              onClick={() => void handleResendConfirmation()}
              disabled={loading}
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-[0.7rem] font-black uppercase tracking-[0.14em] text-white/90 transition hover:bg-white/15 disabled:opacity-45"
            >
              Renvoyer l'e-mail de confirmation
            </button>
          ) : null}

          <button
            type="submit"
            disabled={
              loading
              || !email.trim()
              || Boolean(configError)
              || (mode !== 'forgot' && !password)
              || (mode === 'signup' && (!displayName.trim() || !confirmPassword))
            }
            className="fz-button-primary relative w-full overflow-hidden rounded-[1.1rem] px-4 py-3.5 text-[0.72rem] font-black uppercase tracking-[0.2em] transition active:scale-[0.99] disabled:opacity-40 disabled:shadow-none"
          >
            {loading
              ? mode === 'signin'
                ? 'Connexion...'
                : mode === 'signup'
                  ? 'Creation...'
                  : 'Envoi...'
              : mode === 'signin'
                ? 'Se connecter'
                : mode === 'signup'
                  ? 'Creer mon compte'
                  : 'Envoyer le lien'}
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-5 text-center">
          <p className="text-[0.7rem] leading-relaxed text-white/45">
            {mode === 'signin'
              ? inviteTokenPresent
                ? "Une fois connecté, vous pourrez rejoindre directement le groupe partagé avec ce lien."
                : "Connectez-vous puis vous retrouverez directement votre groupe si vous en avez déjà un."
              : mode === 'signup'
                ? "Vous devrez valider votre adresse e-mail avant votre première connexion."
                : "Pour votre sécurité, l’application ne confirme jamais si une adresse possède un compte."}
          </p>
        </div>
      </div>
    </div>
  );
}
