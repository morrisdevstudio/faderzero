import { describe, expect, it } from 'vitest';
import { getSupabaseConfigError } from './client';

describe('getSupabaseConfigError', () => {
  it('reports missing environment variables', () => {
    const error = getSupabaseConfigError({
      supabaseUrl: '',
      supabaseAnonKey: '',
      currentOrigin: 'https://localhost:5173',
    });

    expect(error).toContain('Configuration Supabase manquante');
  });

  it('reports blocked mixed content when the app is on HTTPS and Supabase is on HTTP', () => {
    const error = getSupabaseConfigError({
      supabaseUrl: 'http://192.168.1.71:54321',
      supabaseAnonKey: 'anon-key',
      currentOrigin: 'https://localhost:5173',
    });

    expect(error).toContain('HTTPS');
    expect(error).toContain('HTTP');
  });

  it('returns null when the configuration looks usable', () => {
    const error = getSupabaseConfigError({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      currentOrigin: 'https://localhost:5173',
    });

    expect(error).toBeNull();
  });
});
