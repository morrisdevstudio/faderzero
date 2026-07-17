import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are missing.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url-for-build.supabase.co',
  supabaseAnonKey || 'placeholder-key-for-build'
);

export function checkSupabaseConfig(): boolean {
  return getSupabaseConfigError() === null;
}

function getOriginProtocol(origin?: string): string | null {
  if (!origin) return null;

  try {
    return new URL(origin).protocol;
  } catch {
    return null;
  }
}

function getSupabaseProtocol(url?: string): string | null {
  if (!url) return null;

  try {
    return new URL(url).protocol;
  } catch {
    return null;
  }
}

export function getSupabaseConfigError(options?: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  currentOrigin?: string;
}): string | null {
  const currentSupabaseUrl = options?.supabaseUrl ?? supabaseUrl;
  const currentSupabaseAnonKey = options?.supabaseAnonKey ?? supabaseAnonKey;
  const currentOrigin =
    options?.currentOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : undefined);

  if (!currentSupabaseUrl || !currentSupabaseAnonKey) {
    return "Configuration Supabase manquante. Copiez `pwa/.env.example` vers `pwa/.env`, puis renseignez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.";
  }

  const appProtocol = getOriginProtocol(currentOrigin);
  const apiProtocol = getSupabaseProtocol(currentSupabaseUrl);

  if (appProtocol === 'https:' && apiProtocol === 'http:') {
    return "Connexion bloquee par le navigateur: la PWA est ouverte en HTTPS mais `VITE_SUPABASE_URL` pointe vers HTTP. Utilisez une URL Supabase en HTTPS, ou lancez la PWA en HTTP pendant le developpement local.";
  }

  return null;
}

export function assertSupabaseConfig(options?: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  currentOrigin?: string;
}): void {
  const errorMessage = getSupabaseConfigError(options);

  if (errorMessage) {
    throw new Error(errorMessage);
  }
}
