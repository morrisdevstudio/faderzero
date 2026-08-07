import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd(); const baseUrl = 'http://localhost:4177'; const id = '2e4cda0176562c3d';
const initial = 'ÉTAT INITIAL DU TEST RELOAD 409'; const draft = 'BROUILLON LOCAL À CONSERVER APRÈS RELOAD'; const external = 'MODIFICATION EXTERNE SERVEUR POUR RELOAD';
const hash = (value) => createHash('sha256').update(value).digest('hex'); const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
const find = (inventory) => inventory.icons.find((item) => item.occurrenceId === id);
async function replaceAtomically(file, note) { const inventory = JSON.parse(await readFile(file, 'utf8')); find(inventory).decision = { ...(find(inventory).decision ?? {}), notes: note }; const temp = `${file}.external.tmp`; await writeFile(temp, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8'); let error; for (let index = 0; index < 10; index += 1) { try { await rename(temp, file); return; } catch (caught) { error = caught; await wait(100); } } throw error; }
async function main() {
  const real = join(root, 'docs/icon-audit/icon-inventory.json'); const realHash = hash(await readFile(real)); const base = join(root, 'docs/icon-audit/.smoke-tmp'); await mkdir(base, { recursive: true }); const directory = await mkdtemp(`${base}\\`); const file = join(directory, 'icon-inventory.json'); let child; let browser; let primary;
  try {
    await cp(real, file); const prepared = JSON.parse(await readFile(file, 'utf8')); const target = find(prepared); if (!target || target.name !== 'CalendarIcon') throw new Error('TARGET_INVALID'); target.decision = { ...(target.decision ?? {}), notes: initial }; await writeFile(file, `${JSON.stringify(prepared, null, 2)}\n`, 'utf8');
    child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'tools/icon-catalog/vite.config.ts', '--port', '4177', '--strictPort'], { cwd: root, env: { ...process.env, ICON_CATALOG_INVENTORY_PATH: file }, stdio: 'ignore', windowsHide: true });
    for (let index = 0; index < 30; index += 1) { try { if ((await fetch(`${baseUrl}/api/icon-inventory`)).ok) break; } catch {} await wait(250); if (index === 29) throw new Error('SERVER_FAILED'); }
    browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); const patches = []; let inventoryGets = 0; let r0 = '';
    page.on('request', (request) => { if (request.method() === 'PATCH') patches.push(request.postDataJSON()); if (request.method() === 'GET' && request.url().endsWith('/api/icon-inventory')) inventoryGets += 1; });
    page.on('response', async (response) => { if (response.request().method() === 'GET' && response.url().endsWith('/api/icon-inventory') && response.ok()) { const body = await response.json(); r0 ||= body.revision; } });
    await page.goto(baseUrl); const row = page.locator(`[data-occurrence-id="${id}"]`); const notes = row.getByLabel('Notes'); await row.waitFor(); for (let index = 0; index < 20 && await notes.inputValue() !== initial; index += 1) await wait(100); if (!r0 || await notes.inputValue() !== initial) throw new Error('INITIAL_LOAD_FAILED');
    await notes.fill(draft); await row.getByText('Modifications non enregistrées').waitFor(); if (patches.length) throw new Error('AUTOSAVE_DETECTED');
    await replaceAtomically(file, external); const r1 = (await (await fetch(`${baseUrl}/api/icon-inventory`)).json()).revision; const before = hash(await readFile(file));
    const conflict = page.waitForResponse((response) => response.request().method() === 'PATCH'); await row.getByRole('button', { name: 'Enregistrer' }).click(); const response = await conflict; const afterPatch = hash(await readFile(file)); if (response.status() !== 409 || patches.length !== 1 || patches[0].revision !== r0 || before !== afterPatch) throw new Error('CONFLICT_FAILED');
    await row.getByRole('button', { name: 'Recharger les données serveur' }).click(); await page.waitForTimeout(50); const afterReload = hash(await readFile(file));
    if (patches.length !== 1 || inventoryGets < 2 || afterReload !== before || await notes.inputValue() !== draft || !await row.getByText('Modifications non enregistrées').isVisible()) throw new Error('RELOAD_PRESERVATION_FAILED');
    const current = await (await fetch(`${baseUrl}/api/icon-inventory`)).json(); if (current.revision !== r1 || find(current.inventory).decision.notes !== external) throw new Error('RELOAD_SERVER_STATE_FAILED');
    console.log(JSON.stringify({ status: 'ok', occurrenceId: id, r0, r1, patchStatus: response.status(), patches: patches.length, inventoryGets, temporaryHash: before }));
  } catch (error) { primary = error; }
  await browser?.close(); child?.kill(); await rm(directory, { recursive: true, force: true });
  if (!existsSync(real) || hash(await readFile(real)) !== realHash) throw new Error('REAL_INVENTORY_CHANGED'); if (primary) throw primary;
}
await main();
