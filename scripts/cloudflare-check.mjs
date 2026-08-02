import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const imageName = 'faderzero-cloudflare-check:local';
const publicEnvPath = fileURLToPath(new URL('../.env.deploy.example', import.meta.url));
const publicEnvKeys = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_AUDIO_API_URL'];

function run(command, args) {
  const result = spawnSync(command, args, { cwd: projectRoot, stdio: 'inherit' });
  if (result.error) {
    console.error(`[cloudflare-check] Impossible de lancer ${command}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

function readPublicBuildEnvironment() {
  const values = new Map();
  for (const rawLine of readFileSync(publicEnvPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 1) continue;
    values.set(line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim());
  }
  for (const key of publicEnvKeys) {
    if (!values.get(key)) throw new Error(`${key} est absent de .env.deploy.example.`);
  }
  return publicEnvKeys.flatMap((key) => ['--env', `${key}=${values.get(key)}`]);
}

function getCommitSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'local-check';
}

const dockerInfo = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
  cwd: projectRoot,
  encoding: 'utf8',
});
if (dockerInfo.error || dockerInfo.status !== 0) {
  console.error('[cloudflare-check] Docker Desktop doit être démarré avant tout push.');
  if (dockerInfo.error) console.error(dockerInfo.error.message);
  process.exit(1);
}

let publicEnvironment;
try {
  publicEnvironment = readPublicBuildEnvironment();
} catch (error) {
  console.error(`[cloudflare-check] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

console.log(`[cloudflare-check] Docker ${dockerInfo.stdout.trim()} détecté.`);
console.log('[cloudflare-check] Construction propre de l’environnement Cloudflare Pages...');

const buildStatus = run('docker', [
  'build', '--platform', 'linux/amd64', '--pull', '--no-cache',
  '--file', 'Dockerfile.cloudflare-check', '--tag', imageName, '.',
]);
if (buildStatus !== 0) process.exit(buildStatus);

const runStatus = run('docker', [
  'run', '--rm', '--platform', 'linux/amd64',
  '--env', 'CI=true',
  '--env', 'CF_PAGES=1',
  '--env', 'CF_PAGES_BRANCH=local-pre-push',
  '--env', `CF_PAGES_COMMIT_SHA=${getCommitSha()}`,
  '--env', 'CF_PAGES_URL=https://local-check.invalid',
  '--env', 'VITE_APP_VERSION=',
  ...publicEnvironment,
  imageName,
]);
process.exit(runStatus);
