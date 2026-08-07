import { describe, expect, it } from 'vitest';
import { collectOccurrencesFromSource, mergeInventory, normalizeSvg, svgFingerprint } from './audit-icons.mjs';

describe('audit des icônes', () => {
  it('normalise un SVG en ne conservant que la géométrie', () => {
    expect(normalizeSvg('<svg height="24" viewBox="0 0 24 24" class="x"><path fill="red" d="M0 0 L1 1"/><circle r="2" cy="4" cx="3"/></svg>')).toBe('<svg viewBox="0 0 24 24"><path d="M0 0 L1 1"/><circle cx="3" cy="4" r="2"/></svg>');
  });
  it('donne la même empreinte à deux SVG dont seul le formatage diffère', () => {
    expect(svgFingerprint('<svg viewBox="0 0 24 24"><path d="M1 2" /></svg>')).toBe(svgFingerprint('<svg class="h-4" height="24" viewBox="0 0 24 24">\n<path fill="none" d="M1 2"></path>\n</svg>'));
  });
  it('conserve les données manuelles déjà associées à une occurrence stable', () => {
    const discovered = [{ occurrenceId: 'stable', route: '/home', file: 'src/a.tsx', line: 1, column: 1, kind: 'inline-svg', name: 'svg', format: 'inline-svg', fingerprint: 'x', source: '', status: 'discovered' }];
    const result = mergeInventory({ schemaVersion: 1, icons: [{ ...discovered[0], proposal: 'Remplacer', decision: 'approved', notes: 'Garder le trait', captures: ['before.png'] }] }, discovered);
    expect(result.icons[0]).toMatchObject({ proposal: 'Remplacer', decision: 'approved', notes: 'Garder le trait', captures: ['before.png'] });
  });
  it('crée deux occurrences pour deux usages du même composant Icon', () => {
    const source = 'function StarIcon() { return <svg viewBox="0 0 1 1"><path d="M0 0" /></svg>; } export function Page() { return <><StarIcon /><StarIcon /></>; }';
    const occurrences = collectOccurrencesFromSource(source);
    expect(occurrences.filter((item) => item.kind === 'react-icon-component')).toHaveLength(2);
    expect(new Set(occurrences.map((item) => item.occurrenceId)).size).toBe(2);
  });
});
