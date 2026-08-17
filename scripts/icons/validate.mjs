import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'glob';

const root = process.cwd();
const contractsPath = resolve(root, 'src/ui/icons/contracts.ts');
const contractsContent = readFileSync(contractsPath, 'utf8');

const roleKeysMatch = contractsContent.match(/export const iconRoleKeys = \[\s*([\s\S]*?)\s*\] as const;/);
if (!roleKeysMatch) {
  console.error('[icons:validate] Error: Unable to parse iconRoleKeys from contracts.ts');
  process.exit(1);
}

const validRoles = new Set(
  roleKeysMatch[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter(Boolean)
);

const tsxFiles = globSync('src/**/*.tsx', { cwd: root, absolute: true });
let errors = 0;
let fzIconCount = 0;

for (const file of tsxFiles) {
  const content = readFileSync(file, 'utf8');
  if (!content.includes('FzIcon')) continue;

  const regex = /<FzIcon\b([\s\S]*?)\/?>/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    fzIconCount++;
    const attrs = match[1];

    // Extract name attribute (either name="foo" or name={cond ? 'foo' : 'bar'})
    const nameAttrMatch = attrs.match(/\bname=(?:["']([^"']+)["']|\{([^}]+)\})/);
    if (!nameAttrMatch) {
      console.error(`[icons:validate] Missing "name" prop on FzIcon in ${file}`);
      errors++;
    } else {
      const stringLiterals = (nameAttrMatch[1] || nameAttrMatch[2])
        .match(/['"][a-zA-Z0-9_-]+['"]/g)
        ?.map((s) => s.replace(/['"]/g, '')) ?? (nameAttrMatch[1] ? [nameAttrMatch[1]] : []);

      for (const role of stringLiterals) {
        if (!validRoles.has(role)) {
          console.error(`[icons:validate] Invalid role "${role}" on FzIcon in ${file}`);
          errors++;
        }
      }
    }

    // Extract usageId attribute
    const usageIdAttrMatch = attrs.match(/\busageId=(?:["']([^"']+)["']|\{([^}]+)\})/);
    if (!usageIdAttrMatch) {
      console.error(`[icons:validate] Missing "usageId" prop on FzIcon in ${file}`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`[icons:validate] Validation failed with ${errors} error(s).`);
  process.exit(1);
}

console.log(`[icons:validate] PASS: ${fzIconCount} FzIcon instances validated across ${validRoles.size} roles.`);
