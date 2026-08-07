import { describe, expect, it } from 'vitest';
import { legacySvgUrl, lucideNameCandidates, occurrenceFormatLabel, occurrenceLocation, publicIconUrl } from './iconPreview';
import type { IconOccurrence } from './iconCatalogService';

const occurrence = (overrides: Partial<IconOccurrence>): IconOccurrence => ({
  usageId: 'test', occurrenceId: 'test', name: 'Icon', route: '', pageName: '', file: '', line: 0,
  format: '', fingerprint: '', source: '', defaultRoleKey: null, assignedRoleKey: null,
  overrideIconName: null, integrationState: 'legacy', verificationState: 'unverified', version: 1,
  ...overrides,
});

describe('icon previews', () => {
  it('adds the SVG namespace required by image decoders', () => {
    const url = legacySvgUrl('<svg viewBox="0 0 24 24"><path d="M4 12h16" /></svg>');
    expect(url).not.toBeNull();
    expect(decodeURIComponent(url!)).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
  });

  it('recognizes public assets and rejects external images', () => {
    expect(publicIconUrl('/pwa-512x512.png')).toBe('/pwa-512x512.png');
    expect(publicIconUrl('<svg />', 'public/favicon.svg')).toBe('/favicon.svg');
    expect(publicIconUrl('https://example.com/icon.png')).toBeNull();
  });

  it('adds a visible neutral stroke when legacy SVG styling is missing', () => {
    const url = legacySvgUrl('<svg viewBox="0 0 24 24"><path d="M4 12h16" /></svg>');
    expect(decodeURIComponent(url!)).toContain('stroke="#f4f4f5"');
  });

  it('finds Lucide candidates for legacy and FaderZero components', () => {
    expect(lucideNameCandidates('EyeIcon', '')).toContain('eye');
    expect(lucideNameCandidates('ArrowLeft', '')).toContain('arrow-left');
    expect(lucideNameCandidates('FzIcon', '<FzIcon name="upload" />')).toContain('upload');
  });

  it('uses source information when page metadata is missing', () => {
    const item = occurrence({ file: 'src/components/LoginPage.tsx', line: 245, format: 'react-component' });
    expect(occurrenceLocation(item)).toBe('LoginPage.tsx · ligne 245');
    expect(occurrenceFormatLabel(item.format)).toBe('Composant React');
  });
});
