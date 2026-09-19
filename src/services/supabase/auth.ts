import { assertSupabaseConfig, supabase } from './client';
import type { Session, Subscription } from '@supabase/supabase-js';
import { assertValidPassword } from './passwordPolicy';

export interface PasswordSignUpResult {
  needsEmailConfirmation: boolean;
  session: Session | null;
}

const SIGN_IN_TIMEOUT_MS = 10_000;

function normalizeAuthError(error: unknown): Error {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    const message = error.message;

    if (message.includes('Invalid login credentials')) {
      return new Error('Identifiant ou mot de passe incorrect.');
    }

    if (message.includes('Email not confirmed')) {
      return new Error("Votre adresse e-mail n'a pas encore ete confirmee.");
    }

    if (message.includes('User already registered')) {
      return new Error('Un compte existe deja avec cette adresse e-mail.');
    }

    if (message.includes('rate limit')) {
      return new Error("Trop d'e-mails ont ete demandes. Reessayez dans quelques minutes.");
    }
  }

  return error instanceof Error ? error : new Error('Erreur de connexion Supabase.');
}

export async function signInWithPassword(email: string, password: string) {
  assertSupabaseConfig();
  const authPromise = supabase.auth.signInWithPassword({
    email,
    password,
  });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), SIGN_IN_TIMEOUT_MS);
    });
    const { data, error } = (await Promise.race([authPromise, timeoutPromise])) as any;
    if (error) throw normalizeAuthError(error);
    return data;
  } catch (error) {
    if (error instanceof Error && error.message === 'NETWORK_TIMEOUT') {
      throw new Error('La connexion prend trop de temps. Vérifiez votre réseau puis réessayez.');
    }
    throw normalizeAuthError(error);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function getOAuthRedirectUrl(): string {
  return `${window.location.origin}/auth/callback?view=app`;
}

export async function signInWithGoogle(): Promise<void> {
  assertSupabaseConfig();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getOAuthRedirectUrl() },
  });
  if (error) throw normalizeAuthError(error);
}

export async function linkGoogleIdentity(): Promise<void> {
  assertSupabaseConfig();
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: getOAuthRedirectUrl() },
  });
  if (error) throw normalizeAuthError(error);
}

export async function hasGoogleIdentity(): Promise<boolean> {
  assertSupabaseConfig();
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw normalizeAuthError(error);
  return data.identities.some((identity) => identity.provider === 'google');
}

export async function signUpWithPassword(
  displayName: string,
  email: string,
  password: string
): Promise<PasswordSignUpResult> {
  assertSupabaseConfig();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: { display_name: displayName },
    },
  });
  if (error) throw normalizeAuthError(error);

  return {
    session: data.session,
    needsEmailConfirmation: data.session === null,
  };
}

export async function resendSignupConfirmation(email: string): Promise<void> {
  assertSupabaseConfig();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw normalizeAuthError(error);
}

export async function requestPasswordReset(email: string): Promise<void> {
  assertSupabaseConfig();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/account?reset-password=1`,
  });
}

export async function signOut() {
  try {
    localStorage.removeItem('faderzero_demo_session');
    assertSupabaseConfig();
    await supabase.auth.signOut();
  } catch {}
}

export async function requestEmailChange(email: string) {
  assertSupabaseConfig();
  const { data, error } = await supabase.auth.updateUser({
    email,
  }, {
    emailRedirectTo: `${window.location.origin}/account`,
  });
  if (error) throw normalizeAuthError(error);
  return data;
}

async function updatePasswordAndRevokeSessions(password: string) {
  assertValidPassword(password);
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) throw normalizeAuthError(updateError);

  const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
  if (signOutError) throw normalizeAuthError(signOutError);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  assertSupabaseConfig();
  const session = await getSession();
  if (!session?.user.email) throw new Error('Session utilisateur invalide.');

  const { error } = await supabase.auth.signInWithPassword({
    email: session.user.email,
    password: currentPassword,
  });
  if (error) throw normalizeAuthError(error);

  await updatePasswordAndRevokeSessions(newPassword);
}

export async function completePasswordRecovery(newPassword: string): Promise<void> {
  assertSupabaseConfig();
  await updatePasswordAndRevokeSessions(newPassword);
}

export async function getSession() {
  try {
    assertSupabaseConfig();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw normalizeAuthError(error);
    if (session) return session;
  } catch {}

  localStorage.removeItem('faderzero_demo_session');

  return null;
}

export function onAuthStateChange(callback: (session: Session | null) => void): Subscription {
  assertSupabaseConfig();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return subscription;
}
