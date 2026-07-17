import { assertSupabaseConfig, supabase } from './client';
import type { Session, Subscription } from '@supabase/supabase-js';

export interface PasswordSignUpResult {
  needsEmailConfirmation: boolean;
  session: Session | null;
}

function normalizeAuthError(error: unknown): Error {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    const message = error.message;

    if (message.includes('Invalid login credentials')) {
      return new Error('E-mail ou mot de passe incorrect.');
    }

    if (message.includes('Email not confirmed')) {
      return new Error("Votre adresse e-mail n'a pas encore ete confirmee.");
    }

    if (message.includes('User already registered')) {
      return new Error('Un compte existe deja avec cette adresse e-mail.');
    }
  }

  return error instanceof Error ? error : new Error('Erreur de connexion Supabase.');
}

export async function signInWithPassword(email: string, password: string) {
  assertSupabaseConfig();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw normalizeAuthError(error);
  return data;
}

export async function signUpWithPassword(
  email: string,
  password: string
): Promise<PasswordSignUpResult> {
  assertSupabaseConfig();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw normalizeAuthError(error);

  return {
    session: data.session,
    needsEmailConfirmation: data.session === null,
  };
}

export async function signOut() {
  assertSupabaseConfig();
  const { error } = await supabase.auth.signOut();
  if (error) throw normalizeAuthError(error);
}

export async function updatePassword(password: string) {
  assertSupabaseConfig();
  const { data, error } = await supabase.auth.updateUser({
    password,
  });
  if (error) throw normalizeAuthError(error);
  return data;
}

export async function getSession() {
  assertSupabaseConfig();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw normalizeAuthError(error);
  return session;
}

export function onAuthStateChange(callback: (session: Session | null) => void): Subscription {
  assertSupabaseConfig();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return subscription;
}
