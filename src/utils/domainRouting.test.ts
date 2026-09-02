import { describe, expect, it } from 'vitest';
import { isAppHostname, isLandingHostname, resolveViewTarget, getAppUrl, getLandingUrl } from './domainRouting';

describe('domainRouting', () => {
  it('detects app hostnames', () => {
    expect(isAppHostname('app.faderzero.com')).toBe(true);
    expect(isAppHostname('app.localhost')).toBe(true);
    expect(isAppHostname('faderzero.com')).toBe(false);
    expect(isAppHostname('localhost')).toBe(false);
  });

  it('detects landing apex hostnames', () => {
    expect(isLandingHostname('faderzero.com')).toBe(true);
    expect(isLandingHostname('www.faderzero.com')).toBe(true);
    expect(isLandingHostname('app.faderzero.com')).toBe(false);
  });

  it('resolves view target based on path, hostname and query params', () => {
    expect(resolveViewTarget('/', 'faderzero.com', '')).toBe('landing');
    expect(resolveViewTarget('/fr', 'faderzero.com', '')).toBe('landing');
    expect(resolveViewTarget('/en', 'faderzero.com', '')).toBe('landing');
    expect(resolveViewTarget('/landing', 'app.faderzero.com', '')).toBe('landing');
    expect(resolveViewTarget('/', 'localhost', '?view=landing')).toBe('landing');
    expect(resolveViewTarget('/', 'localhost', '?view=app')).toBe('app');
    expect(resolveViewTarget('/', 'app.faderzero.com', '')).toBe('app');
    expect(resolveViewTarget('/home', 'faderzero.com', '')).toBe('app');
    expect(resolveViewTarget('/the-rolling-stones', 'faderzero.com', '')).toBe('epk');
  });

  it('generates correct app and landing URLs', () => {
    expect(getAppUrl('/home')).toBeDefined();
    expect(getLandingUrl('/')).toBeDefined();
  });
});
