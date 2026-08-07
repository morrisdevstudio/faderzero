import { expect, test } from '@playwright/test';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { svgFingerprint } from '../scripts/audit-icons.mjs';

const root = process.cwd();
const auditDir = path.join(root, 'docs', 'icon-audit');
const pageDir = path.join(auditDir, 'screenshots', 'pages');
const iconDir = path.join(auditDir, 'screenshots', 'icons');
const manifest = JSON.parse(readFileSync(path.join(auditDir, 'playwright-scenarios.json'), 'utf8'));
const inventoryPath = path.join(auditDir, 'icon-inventory.json');

function cleanDirectory(directory: string) {
  if (!existsSync(directory)) return [];
  const removed = readdirSync(directory).filter((name) => name.endsWith('.png'));
  for (const name of removed) rmSync(path.join(directory, name));
  return removed.map((name) => path.relative(auditDir, path.join(directory, name)).replaceAll('\\', '/'));
}
const removed = [...cleanDirectory(pageDir), ...cleanDirectory(iconDir)];
const captures: Array<Record<string, unknown>> = [];
const failures: Array<Record<string, string>> = [];

for (const scenario of manifest.staticRoutes.filter((item: { status: string }) => item.status === 'ready')) {
  test(`capture ${scenario.scenarioId}`, async ({ page }) => {
    try {
      await page.goto(scenario.route);
      await expect(page.getByRole('heading', { name: 'Connexion' })).not.toBeVisible();
      const pageCapture = path.join(pageDir, `${scenario.scenarioId}.png`);
      await page.screenshot({ path: pageCapture, fullPage: true, animations: 'disabled' });
      const visible = await page.locator('svg').evaluateAll((svgs, scenarioId) => svgs.map((svg, index) => {
        const box = svg.getBoundingClientRect();
        const style = getComputedStyle(svg);
        const control = svg.closest('button,a,[role="button"],[role="link"]');
        const controlBox = control?.getBoundingClientRect();
        const runtimeId = `${scenarioId}-${index + 1}`;
        svg.setAttribute('data-icon-audit-instance', runtimeId);
        return { runtimeId, markup: svg.outerHTML, visible: box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none', rect: { x: box.x, y: box.y, width: box.width, height: box.height }, controlRect: controlBox && { x: controlBox.x, y: controlBox.y, width: controlBox.width, height: controlBox.height }, controlLabel: control?.getAttribute('aria-label') || control?.textContent?.trim() || '', color: style.color };
      }), scenario.scenarioId);
      for (const item of visible.filter((item) => item.visible)) {
        const candidatePath = path.join(iconDir, `${item.runtimeId}.png`);
        await page.locator(`[data-icon-audit-instance="${item.runtimeId}"]`).screenshot({ path: candidatePath, animations: 'disabled' });
        captures.push({ ...item, route: scenario.route, scenarioId: scenario.scenarioId, contextCapture: path.relative(auditDir, pageCapture).replaceAll('\\', '/'), iconCapture: path.relative(auditDir, candidatePath).replaceAll('\\', '/'), fingerprint: svgFingerprint(item.markup) });
      }
    } catch (error) { failures.push({ scenarioId: scenario.scenarioId, error: error instanceof Error ? error.message : String(error) }); throw error; }
  });
}

test.afterAll(() => {
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const byFingerprint = new Map<string, Array<Record<string, unknown>>>();
  for (const icon of inventory.icons) if (icon.fingerprint) byFingerprint.set(icon.fingerprint, [...(byFingerprint.get(icon.fingerprint) ?? []), icon]);
  const covered = new Set<string>();
  for (const capture of captures) {
    const candidates = byFingerprint.get(capture.fingerprint as string) ?? [];
    const icon = candidates.find((candidate) => !covered.has(candidate.occurrenceId)) ?? candidates[0];
    if (!icon) continue;
    covered.add(icon.occurrenceId);
    const existing = Array.isArray(icon.captures) ? icon.captures : [];
    icon.captures = [...existing.filter((entry: { scenarioId?: string }) => entry.scenarioId !== capture.scenarioId), capture];
    icon.coverage = 'covered';
  }
  for (const icon of inventory.icons) if (!covered.has(icon.occurrenceId)) icon.coverage = 'not-covered';
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  const blocked = [...manifest.dynamicRoutes, ...manifest.interactiveStates].map((scenario: Record<string, unknown>) => ({ ...scenario, status: 'blocked-no-fixture' }));
  writeFileSync(path.join(auditDir, 'capture-report.json'), `${JSON.stringify({ schemaVersion: 1, convention: 'data-icon-audit-instance is injected only into the Playwright DOM as scenarioId + visible SVG ordinal; it never reaches production.', capturedOccurrences: captures, nonCoveredOccurrences: inventory.icons.filter((icon: Record<string, unknown>) => icon.coverage === 'not-covered').map((icon: Record<string, unknown>) => icon.occurrenceId), failedScenarios: failures, staleCapturesRemoved: removed, staleCapturesConserved: [], blockedScenarios: blocked }, null, 2)}\n`);
});
