import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateIconRegistry } from './registry.mjs';

const root = process.cwd();
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_ANON_KEY;
const buildToken = process.env.ICON_BUILD_TOKEN;
const isCloudflare = process.env.CF_PAGES === '1';

function headers() {
  return { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, 'Content-Type': 'application/json' };
}
async function buildChannel(body) {
  const response = await fetch(`${supabaseUrl}/functions/v1/icon-build-channel`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Supabase build request failed (${response.status}): ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

if (!isCloudflare || !supabaseUrl || !publishableKey || !buildToken) {
  console.log('[icons] Local build: keeping the committed offline registry.');
  process.exit(0);
}

execFileSync(process.execPath, ['scripts/audit-icons.mjs'], { cwd: root, stdio: 'inherit' });
const inventory = JSON.parse(readFileSync(resolve(root, 'docs/icon-audit/icon-inventory.json'), 'utf8'));
const revision = process.env.CF_PAGES_COMMIT_SHA ?? '';
const rows = (inventory.icons ?? []).map((item) => ({
  usageId: item.usageId || `legacy:${item.occurrenceId}`,
  occurrenceId: item.occurrenceId,
  metadata: { name: item.name, route: item.route ?? '', pageName: item.pageName ?? '', file: item.file, line: item.line, format: item.format, fingerprint: item.fingerprint ?? '', source: item.source ?? '' },
}));
const prepared = await buildChannel({ action: 'prepare', token: buildToken, inventory: rows, revision });
const publication = prepared?.publication;
if (!publication) {
  console.log('[icons] Inventory synchronized; no queued publication.');
  process.exit(0);
}
writeFileSync(resolve(root, 'src/ui/icons/published.generated.ts'), generateIconRegistry(publication.manifest), 'utf8');
writeFileSync(resolve(root, '.icon-publication-build.json'), JSON.stringify({ id: publication.id }), 'utf8');
console.log(`[icons] Prepared publication ${publication.id}.`);
