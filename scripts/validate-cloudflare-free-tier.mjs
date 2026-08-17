import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const policy = JSON.parse(readFileSync(`${root}/cloudflare/free-tier-policy.json`, 'utf8'));
const wranglerFiles = [
  'cloudflare/audio-worker/wrangler.jsonc',
  'cloudflare/audio-worker/wrangler.local.jsonc',
];
const wranglerConfigs = wranglerFiles.map((path) => ({
  path,
  contents: readFileSync(`${root}/${path}`, 'utf8'),
}));
const wrangler = wranglerConfigs[0].contents;
const migration = readFileSync(
  `${root}/supabase/migrations/20260817132753_cloudflare_free_tier_guardrails.sql`,
  'utf8',
);

const disallowedBindings = [
  'ai',
  'browser',
  'containers',
  'd1_databases',
  'durable_objects',
  'hyperdrive',
  'images',
  'queues',
  'services',
  'vectorize',
  'workflows',
];

function fail(message) {
  throw new Error(`[cloudflare-free-tier] ${message}`);
}

for (const { path, contents } of wranglerConfigs) {
  for (const binding of disallowedBindings) {
    if (new RegExp(`"${binding}"\\s*:`).test(contents)) {
      fail(`binding non autorisé dans ${path} : ${binding}`);
    }
  }

  if (/"usage_model"\s*:/.test(contents)) {
    fail(`usage_model ne doit pas forcer un modèle Workers payant dans ${path}.`);
  }

  if (/infrequent[_ -]?access|r2[_ -]?(sql|data[_ -]?catalog)/i.test(contents)) {
    fail(`R2 Infrequent Access, SQL et Data Catalog sont interdits dans ${path}.`);
  }
}

const configuredBuckets = [...wrangler.matchAll(/"bucket_name"\s*:\s*"([^"]+)"/g)]
  .map((match) => match[1]);
if (JSON.stringify(configuredBuckets) !== JSON.stringify(policy.allowedR2Buckets)) {
  fail(`buckets R2 attendus : ${policy.allowedR2Buckets.join(', ')}.`);
}

for (const value of [
  policy.storageLimitBytes,
  policy.classAOperationLimit,
  policy.classBOperationLimit,
]) {
  if (!migration.includes(String(value))) {
    fail(`le seuil ${value} manque dans la migration de garde-fous.`);
  }
}

if (!migration.includes('R2_FREE_TIER_OPERATION_GUARDRAIL')
    || !migration.includes('R2_FREE_TIER_STORAGE_GUARDRAIL')) {
  fail('les refus stockage/opérations ne sont pas tous configurés.');
}

console.log('[cloudflare-free-tier] Politique gratuite validée.');
