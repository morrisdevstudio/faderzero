import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const baseUrl = 'http://localhost:4176';
const occurrenceId = '2e4cda0176562c3d';
const initialNote = 'ÉTAT INITIAL DU TEST DE CONFLIT';
const draftNote = 'BROUILLON LOCAL POUR TEST 409';
const externalNote = 'MODIFICATION EXTERNE TEMPORAIRE POUR TEST 409';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
const inventoryAt = (inventory) => inventory.icons.find((item) => item.occurrenceId === occurrenceId);

async function writeExternalChange(file) {
  const inventory = JSON.parse(await readFile(file, 'utf8'));
  const target = inventoryAt(inventory);
  target.decision = { ...(target.decision ?? {}), notes: externalNote };
  const temporary = `${file}.external.tmp`;
  await writeFile(temporary, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  let lastError;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try { await rename(temporary, file); return; }
    catch (error) { lastError = error; await wait(100); }
  }
  throw lastError;
}

async function main() {
  const real = join(root, 'docs/icon-audit/icon-inventory.json');
  const realHash = hash(await readFile(real));
  const base = join(root, 'docs/icon-audit/.smoke-tmp');
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(`${base}\\`);
  const file = join(directory, 'icon-inventory.json');
  let child; let browser; let primaryError;
  try {
    await cp(real, file);
    const prepared = JSON.parse(await readFile(file, 'utf8'));
    const target = inventoryAt(prepared);
    if (!target || target.name !== 'CalendarIcon') throw new Error('SMOKE_TARGET_INVALID');
    target.decision = { ...(target.decision ?? {}), notes: initialNote };
    await writeFile(file, `${JSON.stringify(prepared, null, 2)}\n`, 'utf8');
    child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'tools/icon-catalog/vite.config.ts', '--port', '4176', '--strictPort'], { cwd: root, env: { ...process.env, ICON_CATALOG_INVENTORY_PATH: file }, stdio: 'ignore', windowsHide: true });
    for (let index = 0; index < 30; index += 1) { try { if ((await fetch(`${baseUrl}/api/icon-inventory`)).ok) break; } catch {} await wait(250); if (index === 29) throw new Error('SMOKE_SERVER_FAILED'); }
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const patches = []; let r0 = '';
    page.on('request', (request) => { if (request.method() === 'PATCH') patches.push({ url: request.url(), body: request.postDataJSON() }); });
    page.on('response', async (response) => { if (response.request().method() === 'GET' && response.url().endsWith('/api/icon-inventory') && response.ok()) { const responseBody = await response.json(); r0 ||= responseBody.revision; } });
    await page.goto(baseUrl);
    const row = page.locator(`[data-occurrence-id="${occurrenceId}"]`); const notes = row.getByLabel('Notes');
    await row.waitFor(); for (let index = 0; index < 20 && await notes.inputValue() !== initialNote; index += 1) await wait(100);
    if (await notes.inputValue() !== initialNote || !r0) throw new Error('SMOKE_INITIAL_LOAD_FAILED');
    await notes.fill(draftNote); await row.getByText('Modifications non enregistrées').waitFor();
    if (patches.length !== 0) throw new Error('SMOKE_AUTOSAVE_DETECTED');
    await writeExternalChange(file); const r1Body = await (await fetch(`${baseUrl}/api/icon-inventory`)).json(); const r1 = r1Body.revision; const beforeConflictHash = hash(await readFile(file));
    const conflict = page.waitForResponse((response) => response.request().method() === 'PATCH'); await row.getByRole('button', { name: 'Enregistrer' }).click(); const conflictResponse = await conflict;
    if (conflictResponse.status() !== 409 || patches.length !== 1 || patches[0].body.revision !== r0) throw new Error('SMOKE_CONFLICT_FAILED');
    const afterConflictHash = hash(await readFile(file)); if (beforeConflictHash !== afterConflictHash) throw new Error('SMOKE_CONFLICT_WROTE_FILE');
    await row.getByText('L’inventaire a été modifié depuis son chargement.').waitFor(); if (await notes.inputValue() !== draftNote) throw new Error('SMOKE_DRAFT_LOST');
    await row.getByRole('button', { name: 'Conserver mon brouillon' }).click(); if (await notes.inputValue() !== draftNote || patches.length !== 1) throw new Error('SMOKE_DISMISS_FAILED');
    console.log(JSON.stringify({ status: 'ok', occurrenceId, r0, r1, patchStatus: conflictResponse.status(), patches: patches.length, temporaryHash: beforeConflictHash }));
  } catch (error) { primaryError = error; }
  await browser?.close(); child?.kill(); await rm(directory, { recursive: true, force: true });
  if (!existsSync(real) || hash(await readFile(real)) !== realHash) throw new Error('REAL_INVENTORY_CHANGED');
  if (primaryError) throw primaryError;
}
await main();
