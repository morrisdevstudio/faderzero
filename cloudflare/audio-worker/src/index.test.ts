import { describe, expect, it } from 'vitest';
import worker from './index';

const baseEnv = {
  ALLOWED_ORIGINS:
    'http://localhost:5173,https://faderzero.pages.dev,https://*.faderzero.pages.dev',
} as unknown as Cloudflare.Env & { URL_SIGNING_SECRET: string };

describe('audio Worker request boundary', () => {
  it('allows a Cloudflare Pages preview origin', async () => {
    const response = await worker.fetch(
      new Request('https://audio.example/health', {
        headers: { origin: 'https://preview-123.faderzero.pages.dev' },
      }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://preview-123.faderzero.pages.dev',
    );
  });

  it('rejects a lookalike Pages origin', async () => {
    const response = await worker.fetch(
      new Request('https://audio.example/health', {
        headers: { origin: 'https://faderzero.pages.dev.attacker.example' },
      }),
      baseEnv,
    );

    expect(response.status).toBe(403);
  });
});
