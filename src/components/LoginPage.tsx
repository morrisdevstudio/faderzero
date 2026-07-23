import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getSupabaseConfigError } from '@/services/supabase/client';
import { normalizeDisplayName } from '@/services/supabase/profile';
import { assertValidPassword, getPasswordRequirements } from '@/services/supabase/passwordPolicy';

type AuthMode = 'signin' | 'signup' | 'forgot';

function EyeIcon({ crossed = false }: { crossed?: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed ? <path d="m4 4 16 16" /> : null}
    </svg>
  );
}

interface LoginPageProps {
  inviteTokenPresent?: boolean;
}

export function LoginPage({ inviteTokenPresent = false }: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
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
    setIsPasswordVisible(false);
    setIsConfirmPasswordVisible(false);
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
  const title = mode === 'signin' ? 'Connexion' : mode === 'signup' ? 'Creer un compte' : 'Mot de passe oublié';
  const subtitle =
    mode === 'signin'
      ? inviteTokenPresent
        ? 'Connectez-vous pour accepter le lien de groupe que vous avez recu.'
        : 'Connectez-vous pour retrouver votre groupe et vos donnees.'
      : mode === 'signup'
        ? 'Créez votre accès FaderZero. Votre e-mail devra être confirmé avant la connexion.'
        : 'Saisissez votre adresse. La réponse reste volontairement identique pour toutes les demandes.';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c0d10] px-4 text-[#f5f0ea]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[40%] h-[80%] w-[80%] rounded-full bg-orange-600/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[40%] h-[80%] w-[80%] rounded-full bg-amber-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md rounded-[1.8rem] border border-white/10 bg-white/5 p-8 shadow-[0_32px_64px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="text-center mb-8">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-orange-400 mb-4 shadow-[0_0_20px_rgba(251,146,60,0.15)]">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20" />
              <path d="M2 12h20" />
              <path d="M5 5l14 14" />
              <path d="M19 5 5 19" />
            </svg>
          </span>
          <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-white">FaderZero</h1>
          <p className="text-[0.72rem] uppercase tracking-[0.16em] text-white/50 mt-1">Votre prompteur scenique</p>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-black/20 p-1.5">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`rounded-xl px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.16em] transition ${
                mode === 'signin'
                  ? 'bg-orange-500 text-white shadow-[0_12px_28px_rgba(249,115,22,0.28)]'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-xl px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.16em] transition ${
                mode === 'signup'
                  ? 'bg-orange-500 text-white shadow-[0_12px_28px_rgba(249,115,22,0.28)]'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              Inscription
            </button>
          </div>
        </div>

        <div className="mb-6 text-center">
          <h2 className="text-xl font-black uppercase tracking-[0.18em] text-white">{title}</h2>
          <p className="mt-2 text-[0.76rem] leading-relaxed text-white/55">{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' ? (
            <div>
              <label htmlFor="displayName" className="mb-2 block text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/60">
                Pseudo
              </label>
              <input
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
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/20 transition focus:border-orange-500/50 focus:bg-white/10 focus:outline-none focus:ring-0"
              />
              <p className="mt-2 text-[0.68rem] text-white/40">2 à 30 caractères, non unique.</p>
            </div>
          ) : null}

          <div>
            <label htmlFor="email" className="block text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/60 mb-2">
              Adresse e-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@exemple.com"
              disabled={loading}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/20 transition focus:border-orange-500/50 focus:bg-white/10 focus:outline-none focus:ring-0"
            />
          </div>

          {mode !== 'forgot' ? <div>
            <label htmlFor="password" className="block text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/60 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={isPasswordVisible ? 'text' : 'password'}
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Au moins 8 caracteres"
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 pr-13 text-sm text-white placeholder-white/20 transition focus:border-orange-500/50 focus:bg-white/10 focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
                disabled={loading}
                aria-label={isPasswordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={isPasswordVisible}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-white/45 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
              >
                <EyeIcon crossed={!isPasswordVisible} />
              </button>
            </div>
          </div> : null}

          {mode === 'signup' ? (
            <ul className="grid grid-cols-2 gap-2 text-[0.68rem]" aria-label="Règles du mot de passe">
              {[
                ['8 caractères', passwordRequirements.minimumLength],
                ['Une majuscule', passwordRequirements.uppercase],
                ['Une minuscule', passwordRequirements.lowercase],
                ['Un chiffre', passwordRequirements.digit],
              ].map(([label, valid]) => (
                <li key={String(label)} className={valid ? 'text-emerald-300' : 'text-white/40'}>
                  {valid ? '✓' : '○'} {label}
                </li>
              ))}
            </ul>
          ) : null}

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/60 mb-2">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={isConfirmPasswordVisible ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Retapez votre mot de passe"
                  disabled={loading}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 pr-13 text-sm text-white placeholder-white/20 transition focus:border-orange-500/50 focus:bg-white/10 focus:outline-none focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => setIsConfirmPasswordVisible((currentValue) => !currentValue)}
                  disabled={loading}
                  aria-label={
                    isConfirmPasswordVisible
                      ? 'Masquer la confirmation du mot de passe'
                      : 'Afficher la confirmation du mot de passe'
                  }
                  aria-pressed={isConfirmPasswordVisible}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-white/45 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
                >
                  <EyeIcon crossed={!isConfirmPasswordVisible} />
                </button>
              </div>
            </div>
          )}

          {mode === 'signin' ? (
            <button
              type="button"
              onClick={() => setMode('forgot')}
              className="w-full text-center text-[0.7rem] font-bold text-orange-300 transition hover:text-orange-200"
            >
              Mot de passe oublié ?
            </button>
          ) : null}

          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => setMode('signin')}
              className="w-full text-center text-[0.7rem] font-bold text-white/55 transition hover:text-white"
            >
              Retour à la connexion
            </button>
          ) : null}

          {displayedError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-[0.75rem] text-red-400">
              {displayedError}
            </div>
          )}

          {infoMessage && (
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 text-center text-[0.75rem] text-orange-300">
              {infoMessage}
            </div>
          )}

          {mode === 'signup' && pendingConfirmationEmail ? (
            <button
              type="button"
              onClick={() => void handleResendConfirmation()}
              disabled={loading}
              className="w-full rounded-xl border border-orange-500/25 bg-orange-500/10 px-4 py-3 text-[0.7rem] font-black uppercase tracking-[0.14em] text-orange-200 transition hover:bg-orange-500/20 disabled:opacity-45"
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
            className="relative w-full overflow-hidden rounded-2xl bg-white px-4 py-4 text-[0.72rem] font-black uppercase tracking-[0.2em] text-[#0c0d10] transition hover:bg-orange-500 hover:text-white disabled:bg-white/10 disabled:text-white/40 shadow-lg"
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
          <p className="text-[0.72rem] leading-relaxed text-white/45">
            {mode === 'signin'
              ? inviteTokenPresent
                ? "Une fois connecte, vous pourrez rejoindre directement le groupe partage avec ce lien."
                : "Connectez-vous puis vous retrouverez directement votre groupe si vous en avez deja un."
              : mode === 'signup'
                ? "Vous devrez valider votre adresse e-mail avant votre première connexion."
                : "Pour votre sécurité, l’application ne confirme jamais si une adresse possède un compte."}
          </p>
        </div>
      </div>
    </div>
  );
}
