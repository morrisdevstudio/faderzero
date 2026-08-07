import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const marker = resolve(root, '.icon-publication-build.json');
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_ANON_KEY;
const buildToken = process.env.ICON_BUILD_TOKEN;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status ?? 'unknown'}`);
}
async function complete(status, errorCode = null) {
  if (!existsSync(marker) || !supabaseUrl || !publishableKey || !buildToken) return;
  const { id } = JSON.parse(readFileSync(marker, 'utf8'));
  const response = await fetch(`${supabaseUrl}/functions/v1/icon-build-channel`, {
    method: 'POST',
    headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'complete', token: buildToken, publicationId: id, status, buildSha: process.env.CF_PAGES_COMMIT_SHA ?? null, errorCode }),
  });
  if (!response.ok) throw new Error(`Could not finalize icon publication: ${response.status}`);
  unlinkSync(marker);
}

try {
  run(process.execPath, ['scripts/icons/prepare-build.mjs']);
  run(process.execPath, ['node_modules/typescript/bin/tsc', '-b']);
  run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'deploy']);
  await complete('active');
} catch (error) {
  console.error(error);
  try { await complete('failed', 'BUILD_FAILED'); } catch (finalizeError) { console.error(finalizeError); }
  process.exitCode = 1;
}
