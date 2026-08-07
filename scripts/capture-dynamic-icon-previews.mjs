import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const auditDirectory = join(root, 'docs', 'icon-audit');
const inventoryPath = join(auditDirectory, 'icon-inventory.json');
const runtimeDirectory = join(auditDirectory, 'screenshots', 'icons', 'runtime');
const reportPath = join(auditDirectory, 'capture-report.json');
const baseUrl = process.env.ICON_CAPTURE_BASE_URL ?? 'http://127.0.0.1:4173';

// Each entry describes a real use site. No entity identifier is invented: when
// a route requires user data, the action deliberately reports a blocked fixture.
const targets = [
  { occurrenceId: '056ba440f53eb434', route: '/', scenarioId: 'login-password-masked', action: 'login', reason: 'rendu dépendant des propriétés React' },
  { occurrenceId: 'c3083e5d6a796d19', route: '/', scenarioId: 'login-confirm-password-masked', action: 'login-signup', reason: 'rendu dépendant des propriétés React' },
  { occurrenceId: '614f22a90c4e443d', route: '/', scenarioId: 'splash-loading', action: 'splash', reason: 'SVG dynamique non extractible statiquement' },
  { occurrenceId: '258c70ffcd42151a', route: '/booking', scenarioId: 'booking-contact-phone', action: 'booking-contact', reason: 'rendu dépendant des propriétés React' },
  { occurrenceId: '631082649aa6b220', route: '/booking', scenarioId: 'booking-contact-email', action: 'booking-contact', reason: 'rendu dépendant des propriétés React' },
  { occurrenceId: '98c96dd10aabaab6', route: '/booking', scenarioId: 'booking-contact-social', action: 'booking-contact', reason: 'rendu dépendant des propriétés React' },
  { occurrenceId: 'c1c3bba9be11ab46', route: '/songs', scenarioId: 'songs-audio-primary', action: 'audio-menu', reason: 'rendu dépendant des propriétés React' },
  { occurrenceId: 'e141b12888456545', route: '/songs', scenarioId: 'songs-extra-audio', action: 'none', reason: 'rendu dépendant des propriétés React' },
  { occurrenceId: '3d216faaf426162e', route: '/prompter/play', scenarioId: 'prompter-settings-speed-one', action: 'prompter-settings', reason: 'rendu dépendant des propriétés React' },
  { occurrenceId: '889334d53deca34c', route: '/prompter/play', scenarioId: 'prompter-settings-text-normal', action: 'prompter-settings', reason: 'rendu dépendant des propriétés React' },
  { occurrenceId: 'cbc0a967f918a0e7', route: '/songs/:songId/write', scenarioId: 'song-writer-left', action: 'requires-song-writer', reason: 'rendu dépendant des propriétés React' },
  { occurrenceId: 'f7d0341f46591999', route: '/songs/:songId/write', scenarioId: 'song-writer-right', action: 'requires-song-writer', reason: 'rendu dépendant des propriétés React' },
  { occurrenceId: '40b3ed90385e3285', route: '/songs/:songId', scenarioId: 'song-detail-primary-audio', action: 'requires-song-detail', reason: 'rendu dépendant des propriétés React' },
];

const selectorFor = (occurrenceId) => `[data-icon-audit-id="${occurrenceId}"]`;
const safeFileName = (occurrenceId) => `${createHash('sha256').update(occurrenceId).digest('hex').slice(0, 20)}.png`;

async function waitForServer(url) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { if ((await fetch(url)).ok) return true; } catch { /* Vite is still starting. */ }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  return false;
}

async function startAppIfNeeded() {
  if (await waitForServer(baseUrl)) return { process: undefined };
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort']
    : ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'];
  const child = spawn(command, args, { cwd: root, stdio: 'ignore', windowsHide: true });
  if (!await waitForServer(baseUrl)) { child.kill(); throw new Error('APP_START_FAILED'); }
  return { process: child };
}

async function prepare(page, target) {
  if (target.action === 'splash') {
    await page.goto(baseUrl, { waitUntil: 'commit' });
    return;
  }
  if (target.action === 'login' || target.action === 'login-signup') {
    await page.goto(baseUrl);
    await page.getByRole('heading', { name: 'Connexion' }).waitFor({ state: 'visible', timeout: 5_000 });
    if (target.action === 'login-signup') await page.getByRole('button', { name: 'Inscription', exact: true }).click();
    return;
  }
  if (target.action === 'requires-song-writer' || target.action === 'requires-song-detail') throw new Error('BLOCKED_NO_FIXTURE: parcours dynamique de morceau à découvrir');
  await page.goto(`${baseUrl}${target.route}`);
  if (target.action === 'prompter-settings') await page.getByRole('button', { name: 'Réglages' }).click();
  if (target.action === 'booking-contact') {
    const lead = page.locator('button').filter({ hasText: /./ }).first();
    if (!await lead.isVisible().catch(() => false)) throw new Error('BLOCKED_NO_FIXTURE: aucun contact de réservation visible');
  }
  if (target.action === 'audio-menu') {
    const actions = page.getByRole('button', { name: 'Actions du fichier audio' }).first();
    if (!await actions.isVisible().catch(() => false)) throw new Error('BLOCKED_NO_FIXTURE: aucune piste audio visible');
    await actions.click();
  }
}

function blockedStatus(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('BLOCKED_NO_FIXTURE')) return ['blocked-no-fixture', message.replace('BLOCKED_NO_FIXTURE: ', '')];
  return ['failed', message];
}

async function captureTarget(browser, target) {
  const authenticated = !['login', 'login-signup', 'splash'].includes(target.action);
  const storageState = join(root, 'playwright', '.auth', 'user.json');
  if (authenticated && !existsSync(storageState)) return { ...target, status: 'blocked-no-fixture', selector: selectorFor(target.occurrenceId), reason: 'Session Playwright authentifiée absente' };
  // Dynamic icons are often rendered at 20 px. Capture at device scale so the
  // catalogue can show the real icon without enlarging a low-resolution PNG.
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 3,
    ...(authenticated ? { storageState } : {}),
  });
  const page = await context.newPage();
  const selector = selectorFor(target.occurrenceId);
  try {
    await prepare(page, target);
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count === 0) return { ...target, status: 'blocked-not-visible', selector, reason: 'Ancre d’audit absente ou non visible dans ce scénario' };
    if (count !== 1) return { ...target, status: 'blocked-ambiguous-selector', selector, reason: `${count} éléments correspondent à l’ancre` };
    await locator.waitFor({ state: 'visible', timeout: 4_000 });
    const box = await locator.boundingBox();
    if (!box || box.width <= 0 || box.height <= 0) return { ...target, status: 'blocked-not-visible', selector, reason: 'Élément sans rectangle visible' };
    const fileName = safeFileName(target.occurrenceId);
    const file = join(runtimeDirectory, fileName);
    await locator.screenshot({ path: file, animations: 'disabled', omitBackground: true, scale: 'device' });
    return { occurrenceId: target.occurrenceId, status: 'captured', route: target.route, scenarioId: target.scenarioId, selector, file: relative(auditDirectory, file).replaceAll('\\', '/'), width: Math.round(box.width), height: Math.round(box.height), reason: target.reason };
  } catch (error) {
    const [status, reason] = blockedStatus(error);
    return { occurrenceId: target.occurrenceId, status, route: target.route, scenarioId: target.scenarioId, selector, file: null, width: null, height: null, reason: `${target.reason} — ${reason}` };
  } finally { await context.close(); }
}

async function main() {
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  const availableIds = new Set(inventory.icons.map((item) => item.occurrenceId));
  const requested = targets.filter((target) => availableIds.has(target.occurrenceId));
  await mkdir(runtimeDirectory, { recursive: true });
  const previousReport = existsSync(reportPath) ? JSON.parse(await readFile(reportPath, 'utf8')) : { occurrences: [] };
  const previousByOccurrenceId = new Map((previousReport.occurrences ?? []).map((item) => [item.occurrenceId, item]));
  const app = await startAppIfNeeded();
  try {
    const browser = await chromium.launch({ headless: true });
    try {
      const occurrences = [];
      for (const target of requested) occurrences.push(await captureTarget(browser, target));
      const mergedOccurrences = occurrences.map((item) => {
        const previous = previousByOccurrenceId.get(item.occurrenceId);
        const previousFile = previous?.file ? join(auditDirectory, previous.file) : undefined;
        const retainedFile = join(runtimeDirectory, safeFileName(item.occurrenceId));
        // A transient test-account state must not erase a prior, verified PNG.
        const staticReason = targets.find((target) => target.occurrenceId === item.occurrenceId)?.reason ?? item.reason;
        return item.status !== 'captured' && previous?.status === 'captured' && previousFile && existsSync(previousFile)
          ? { ...previous, reason: staticReason }
          : item.status !== 'captured' && existsSync(retainedFile)
            ? {
                ...item,
                status: 'captured',
                file: relative(auditDirectory, retainedFile).replaceAll('\\', '/'),
                width: null,
                height: null,
                reason: staticReason,
              }
            : item;
      });
      const summary = { requested: mergedOccurrences.length, captured: mergedOccurrences.filter((item) => item.status === 'captured').length, blocked: mergedOccurrences.filter((item) => item.status.startsWith('blocked-')).length, failed: mergedOccurrences.filter((item) => item.status === 'failed').length };
      await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), summary, occurrences: mergedOccurrences }, null, 2)}\n`);
    } finally { await browser.close(); }
  } finally {
    if (app.process) app.process.kill();
  }
}

await main();
