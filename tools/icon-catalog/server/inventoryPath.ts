import { existsSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

export function catalogSmokeRoot() { return resolve(process.env.ICON_CATALOG_SMOKE_ROOT ?? 'docs/icon-audit/.smoke-tmp'); }
function inside(child: string, parent: string) { const path = relative(parent, child); return path !== '' && !path.startsWith('..') && !path.includes(':'); }
export function resolveCatalogInventoryPath(repositoryRoot: string) {
  const defaultPath = resolve(repositoryRoot, 'docs/icon-audit/icon-inventory.json');
  const requested = process.env.ICON_CATALOG_INVENTORY_PATH;
  if (!requested) return defaultPath;
  if (/^(file:|https?:)/i.test(requested)) throw new Error('ICON_CATALOG_INVENTORY_PATH_INVALID');
  const candidate = resolve(requested);
  const root = catalogSmokeRoot();
  if (!inside(candidate, root) || !existsSync(candidate) || !statSync(candidate).isFile()) throw new Error('ICON_CATALOG_INVENTORY_PATH_INVALID');
  const real = realpathSync(candidate);
  if (!inside(real, realpathSync(root)) || lstatSync(candidate).isSymbolicLink()) throw new Error('ICON_CATALOG_INVENTORY_PATH_INVALID');
  return real;
}
