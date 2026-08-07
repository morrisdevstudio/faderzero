import { iconNames } from 'lucide-react/dynamic.js';

const builtInRoleKeys = ['add', 'back', 'calendar', 'check', 'close', 'delete', 'download', 'edit', 'fullscreen', 'home', 'menu', 'metronome', 'pause', 'play', 'prompter', 'record', 'setlist', 'settings', 'songs', 'stop', 'upload', 'show-password', 'hide-password', 'export-pdf'];

function componentName(iconName) {
  return iconName.split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join('');
}

export function generateIconRegistry(manifest) {
  const available = new Set(iconNames);
  const entries = (group, label) => Object.entries(group ?? {}).map(([key, entry]) => {
    if (entry.sourceType !== 'lucide' || !available.has(entry.iconName)) throw new Error(`Invalid published icon for ${label} ${key}`);
    return [key, componentName(entry.iconName)];
  });
  const roles = entries(manifest.roles, 'role');
  for (const key of builtInRoleKeys) if (!manifest.roles?.[key]) throw new Error(`Missing published icon for role ${key}`);
  const overrides = entries(manifest.usageOverrides, 'usage');
  const imports = [...new Set([...roles, ...overrides].map(([, component]) => component))].sort();
  const record = (items) => items.map(([key, component]) => `  ${JSON.stringify(key)}: ${component},`).join('\n');
  return `import {\n  ${imports.join(', ')},\n  type LucideIcon,\n} from 'lucide-react';\n\n// Generated from publication ${manifest.publicationId}. Do not edit during a Cloudflare build.\nexport const publishedIconComponents: Record<string, LucideIcon> = {\n${record(roles)}\n};\n\nexport const publishedIconUsageOverrides: Record<string, LucideIcon> = {\n${record(overrides)}\n};\n`;
}
