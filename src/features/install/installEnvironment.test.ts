import { describe, expect, it, vi } from 'vitest';
import { applyInstallGuidePreview, detectInstallEnvironment, getInstallAvailability, getInstallGuide } from './installEnvironment';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockReturnValue({ matches: false }),
});

describe('installEnvironment', () => {
  it('reconnaît Chrome sur iPhone et son guide spécifique', () => {
    const environment = detectInstallEnvironment({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/120.0.0 Mobile/15E148 Safari/604.1',
      vendor: 'Google Inc.',
    });

    expect(environment).toMatchObject({ os: 'ios', browser: 'chrome', isStandalone: false });
    expect(getInstallGuide(environment).illustration).toBe('ios-chrome');
  });

  it('guide Safari macOS vers le Dock', () => {
    const environment = detectInstallEnvironment({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
      vendor: 'Apple Computer, Inc.',
    });

    expect(environment).toMatchObject({ os: 'macos', browser: 'safari' });
    expect(getInstallGuide(environment).steps).toContain('Choisissez Ajouter au Dock.');
  });

  it('masque l’entrée d’installation dans Firefox', () => {
    const environment = detectInstallEnvironment({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/123.0' });

    expect(getInstallAvailability(environment)).toBe('unsupported');
  });

  it('ne propose rien lorsque l’installation n’est pas prise en charge', () => {
    const environment = { os: 'unknown' as const, browser: 'unknown' as const, isStandalone: false, canPromptInstall: false };

    expect(getInstallAvailability(environment)).toBe('unsupported');
  });

  it('réserve l’aperçu iOS à l’environnement de développement', () => {
    const environment = { os: 'windows' as const, browser: 'chrome' as const, isStandalone: false, canPromptInstall: true };

    expect(applyInstallGuidePreview(environment, '?installGuide=ios', true)).toMatchObject({ os: 'ios', browser: 'safari', canPromptInstall: false });
    expect(applyInstallGuidePreview(environment, '?installGuide=ios', false)).toBe(environment);
  });
});
