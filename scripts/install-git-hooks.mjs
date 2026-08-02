import { chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.env.CI === 'true' || process.env.CF_PAGES === '1') process.exit(0);

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const hookPath = fileURLToPath(new URL('../.githooks/pre-push', import.meta.url));
const repositoryCheck = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
  cwd: projectRoot,
  encoding: 'utf8',
});
if (repositoryCheck.status !== 0 || repositoryCheck.stdout.trim() !== 'true') process.exit(0);
if (process.platform !== 'win32') chmodSync(hookPath, 0o755);

const result = spawnSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
  cwd: projectRoot,
  stdio: 'inherit',
});
if (result.error || result.status !== 0) {
  console.error('[git-hooks] Impossible de configurer core.hooksPath.');
  process.exit(result.status ?? 1);
}
console.log('[git-hooks] Hook pre-push Cloudflare activé.');
