import { describe, expect, it } from 'vitest';
import { iconRoleKey } from './iconRole';

describe('iconRoleKey', () => {
  it('creates a stable database key from a French label', () => {
    expect(iconRoleKey('Afficher / masquer')).toBe('afficher-masquer');
    expect(iconRoleKey('Exporter en PDF')).toBe('exporter-en-pdf');
  });

  it('removes unsupported characters and limits the key length', () => {
    expect(iconRoleKey('  Membre & profil  ')).toBe('membre-profil');
    expect(iconRoleKey(`Rôle ${'très-long-'.repeat(12)}`)).toHaveLength(64);
  });
});
