import { describe, expect, it } from 'vitest';
import { generateIconRegistry } from './registry.mjs';

const builtIns = Object.fromEntries([
  'add', 'back', 'calendar', 'check', 'close', 'delete', 'download', 'edit', 'fullscreen', 'home', 'menu', 'metronome', 'pause', 'play', 'prompter', 'record', 'setlist', 'settings', 'songs', 'stop', 'upload', 'show-password', 'hide-password', 'export-pdf',
].map((key) => [key, { sourceType: 'lucide', iconName: 'circle' }]));

describe('icon publication registry', () => {
  it('includes dynamic roles and stable usage overrides', () => {
    const source = generateIconRegistry({
      publicationId: 'test',
      roles: { ...builtIns, 'afficher-masquer': { sourceType: 'lucide', iconName: 'eye' } },
      usageOverrides: { 'login.password.visibility': { sourceType: 'lucide', iconName: 'eye-off' } },
    });
    expect(source).toContain('"afficher-masquer": Eye');
    expect(source).toContain('"login.password.visibility": EyeOff');
  });
});
