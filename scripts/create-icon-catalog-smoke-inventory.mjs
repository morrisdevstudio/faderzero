import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd(); const baseUrl = 'http://localhost:4175'; const id = '2e4cda0176562c3d'; const initialNote = 'ÉTAT INITIAL DU TEST TEMPORAIRE'; const temporaryNote = 'TEST PATCH TEMPORAIRE';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  const real = join(root, 'docs/icon-audit/icon-inventory.json'); const initialRealHash = hash(await readFile(real));
  const base = join(root, 'docs', 'icon-audit', '.smoke-tmp'); await mkdir(base, { recursive: true }); const directory = await mkdtemp(`${base}\\`); const inventoryPath = join(directory, 'icon-inventory.json');
  let child; let browser; let realInventoryChanged = false;
  try {
    await cp(real, inventoryPath); const prepared = JSON.parse(await readFile(inventoryPath, 'utf8')); const target = prepared.icons.find((item) => item.occurrenceId === id);
    if (!target || target.name !== 'CalendarIcon') throw new Error('SMOKE_TARGET_INVALID'); target.decision = { ...(target.decision ?? {}), notes: initialNote };
    await writeFile(inventoryPath, `${JSON.stringify(prepared, null, 2)}\n`); const preparedJson = JSON.parse(await readFile(inventoryPath, 'utf8'));
    child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'tools/icon-catalog/vite.config.ts', '--port', '4175', '--strictPort'], { cwd: root, env: { ...process.env, ICON_CATALOG_INVENTORY_PATH: inventoryPath }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let startupOutput = ''; let exitCode = null; child.stdout.on('data', (chunk) => { startupOutput += chunk; }); child.stderr.on('data', (chunk) => { startupOutput += chunk; }); child.on('exit', (code) => { exitCode = code; });
    for (let index = 0; index < 30; index += 1) { try { if ((await fetch(`${baseUrl}/api/icon-inventory`)).ok) break; } catch {} await wait(250); if (index === 29) throw new Error(`SMOKE_SERVER_FAILED:${exitCode}:${startupOutput.slice(-500)}`); }
    browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); const patches = [];
    page.on('request', (request) => { if (request.method() === 'PATCH') patches.push(request.postDataJSON()); }); await page.goto(baseUrl);
    const row = page.locator(`[data-occurrence-id="${id}"]`); const notes = row.getByLabel('Notes'); await row.waitFor(); for (let index = 0; index < 20 && await notes.inputValue() !== initialNote; index += 1) await wait(100); if (await notes.inputValue() !== initialNote) throw new Error('SMOKE_INITIAL_VALUE_MISSING'); await notes.fill(temporaryNote); const firstPatch = page.waitForResponse((response) => response.request().method() === 'PATCH'); await row.getByRole('button', { name: 'Enregistrer' }).click(); const firstPatchResponse = await firstPatch; if (!firstPatchResponse.ok()) throw new Error(`SMOKE_FIRST_PATCH_HTTP_${firstPatchResponse.status()}:${await firstPatchResponse.text()}`); await row.getByText('Enregistré').waitFor();
    const first = await (await fetch(`${baseUrl}/api/icon-inventory`)).json(); if (first.inventory.icons.find((item) => item.occurrenceId === id).decision.notes !== temporaryNote) throw new Error(`SMOKE_FIRST_PATCH_FAILED:${JSON.stringify(first.inventory.icons.find((item) => item.occurrenceId === id).decision)}`);
    await row.getByLabel('Notes').fill(initialNote); await row.getByRole('button', { name: 'Enregistrer' }).click(); await row.getByText('Enregistré').waitFor();
    const final = await (await fetch(`${baseUrl}/api/icon-inventory`)).json(); if (patches.length !== 2 || patches[1].revision !== first.revision || JSON.stringify(final.inventory) !== JSON.stringify(preparedJson)) throw new Error('SMOKE_RESTORE_FAILED');
    console.log(JSON.stringify({ status: 'ok', occurrenceId: id, firstRevision: first.revision, finalRevision: final.revision, patches: patches.length }));
  } finally { await browser?.close(); child?.kill(); await rm(directory, { recursive: true, force: true }); realInventoryChanged = !existsSync(real) || hash(await readFile(real)) !== initialRealHash; }
  if (realInventoryChanged) throw new Error('REAL_INVENTORY_CHANGED');
}
await main();
