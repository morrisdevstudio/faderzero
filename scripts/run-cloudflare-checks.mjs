import { spawnSync } from 'node:child_process';
import os from 'node:os';

const expected = { platform: 'linux', arch: 'x64', node: 'v22.16.0', npm: '10.9.2' };
const wrangler = ['--yes', 'wrangler@4.118.0'];

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(`Impossible de vérifier ${command}.`);
  return result.stdout.trim();
}

function assertEqual(label, actual, wanted) {
  if (actual !== wanted) throw new Error(`${label}: attendu ${wanted}, reçu ${actual}.`);
}

assertEqual('Plateforme', process.platform, expected.platform);
assertEqual('Architecture', process.arch, expected.arch);
assertEqual('Node.js', process.version, expected.node);
assertEqual('npm', capture('npm', ['--version']), expected.npm);
assertEqual('CI', process.env.CI, 'true');
assertEqual('CF_PAGES', process.env.CF_PAGES, '1');

console.log('[cloudflare-check] Environnement validé :');
console.log(`  OS: ${os.type()} ${os.release()} (${process.arch})`);
console.log(`  Node.js: ${process.version}`);
console.log(`  npm: ${expected.npm}`);

const checks = [
  ['Politique Cloudflare gratuite', 'npm', ['run', 'check:cloudflare:costs']],
  ['TypeScript', 'npm', ['run', 'typecheck']],
  ['Audio Worker TypeScript', 'npm', ['run', 'typecheck:worker']],
  ['EPK Worker TypeScript', 'npm', ['run', 'typecheck:epk']],
  ['Lint', 'npm', ['run', 'lint']],
  ['Tests', 'npm', ['test']],
  ['Audio Worker tests', 'npm', ['run', 'test:worker']],
  ['EPK Worker tests', 'npm', ['run', 'test:epk']],
  ['En-têtes de sécurité', 'npm', ['run', 'security:headers']],
  ['Audio Worker types', 'npx', [...wrangler, 'types', '--check', '--config', 'cloudflare/audio-worker/wrangler.jsonc', 'cloudflare/audio-worker/worker-configuration.d.ts']],
  ['EPK Worker types', 'npx', [...wrangler, 'types', '--check', '--config', 'cloudflare/epk-public/wrangler.jsonc', 'cloudflare/epk-public/worker-configuration.d.ts']],
  ['Audio Worker dry-run', 'npx', [...wrangler, 'deploy', '--dry-run', '--config', 'cloudflare/audio-worker/wrangler.jsonc']],
  ['EPK Worker dry-run', 'npx', [...wrangler, 'deploy', '--dry-run', '--config', 'cloudflare/epk-public/wrangler.jsonc']],
  ['Pages Functions', 'npx', [...wrangler, 'pages', 'functions', 'build', '--outdir', '/tmp/pages-functions']],
  ['Build Cloudflare Pages', 'npm', ['run', 'build:deploy']],
];

for (const [label, command, args] of checks) {
  console.log(`\n[cloudflare-check] ${label}...`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(`[cloudflare-check] ${label}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\n[cloudflare-check] Tous les contrôles sont passés.');
