// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixtures = [];
afterEach(() => { for (const path of fixtures.splice(0)) rmSync(path, { recursive: true, force: true }); });

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'faderzero-policy-'));
  fixtures.push(directory);
  for (const file of [
    'scripts/validate-cloudflare-free-tier.mjs',
    'cloudflare/free-tier-policy.json',
    'cloudflare/audio-worker/wrangler.jsonc',
    'cloudflare/epk-public/wrangler.jsonc',
    'supabase/migrations/20260817132753_cloudflare_free_tier_guardrails.sql',
  ]) {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    copyFileSync(join(root, file), join(directory, file));
  }
  return directory;
}

function validate(directory) {
  return spawnSync(process.execPath, [join(directory, 'scripts/validate-cloudflare-free-tier.mjs')], { encoding: 'utf8' });
}

it('validates a clean checkout without the ignored local override', () => {
  const result = validate(fixture());
  expect(result.status, result.stderr).toBe(0);
});

it('still rejects disallowed bindings in a local override when present', () => {
  const directory = fixture();
  writeFileSync(join(directory, 'cloudflare/audio-worker/wrangler.local.jsonc'), '{"ai":{"binding":"AI"}}');
  const result = validate(directory);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('binding non autorisé');
});

it('still requires the production worker configuration', () => {
  const directory = fixture();
  rmSync(join(directory, 'cloudflare/epk-public/wrangler.jsonc'));
  expect(validate(directory).status).not.toBe(0);
});
