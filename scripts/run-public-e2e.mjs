import { spawn } from 'node:child_process';

const baseUrl = 'http://127.0.0.1:4173';

function start(command, args) {
  return spawn(command, args, { stdio: 'inherit' });
}

function waitForExit(process) {
  return new Promise((resolve) => {
    process.once('exit', (code) => resolve(code ?? 1));
    process.once('error', () => resolve(1));
  });
}

async function waitForServer() {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Le serveur Vite n'est pas encore prêt.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Le serveur de prévisualisation n'a pas répondu sur ${baseUrl}.`);
}

async function stop(child) {
  if (child.exitCode !== null) return;

  child.kill();
  await Promise.race([
    waitForExit(child),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);

}

const preview = start(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort']);

try {
  await waitForServer();
  const test = start(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.public.config.ts']);
  const exitCode = await waitForExit(test);
  process.exitCode = exitCode;
} finally {
  await stop(preview);
}
