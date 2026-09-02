/**
 * Domain & URL routing utilities for FaderZero
 * Handles separation between apex domain (faderzero.com), public EPKs, and the PWA application (app.faderzero.com).
 */

const RESERVED_TOP_PATHS = new Set([
  'home',
  'calendar',
  'booking',
  'songs',
  'setlists',
  'prompter',
  'sync',
  'metronome',
  'account',
  'imports',
  'musiques',
  'landing',
  'fr',
  'en',
  'login',
  'api',
  'assets',
  'media',
  'preview',
]);

export function isAppHostname(hostname = window.location.hostname): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized.startsWith('app.')) {
    return true;
  }
  return false;
}

export function isLandingHostname(hostname = window.location.hostname): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === 'faderzero.com' || normalized === 'www.faderzero.com') {
    return true;
  }
  return false;
}

export type ViewTarget = 'landing' | 'app' | 'epk';

export function resolveViewTarget(
  pathname = window.location.pathname,
  hostname = window.location.hostname,
  search = window.location.search,
): ViewTarget {
  const params = new URLSearchParams(search);
  const explicitView = params.get('view');
  if (explicitView === 'landing') return 'landing';
  if (explicitView === 'app') return 'app';

  // Local previews keep the explicit landing route; production uses /fr and /en.
  if (pathname === '/landing' || pathname.startsWith('/landing/') || pathname === '/fr' || pathname.startsWith('/fr/') || pathname === '/en' || pathname.startsWith('/en/')) {
    return 'landing';
  }

  // If on apex landing domain (faderzero.com)
  if (isLandingHostname(hostname)) {
    const cleanPath = pathname.replace(/^\/+|\/+$/g, '');
    if (!cleanPath) {
      return 'landing';
    }
    const firstSegment = cleanPath.split('/')[0]?.toLowerCase();
    if (firstSegment && !RESERVED_TOP_PATHS.has(firstSegment)) {
      return 'epk';
    }
    return 'app';
  }

  // If app subdomain or localhost/test default
  return 'app';
}

export function getAppUrl(path = ''): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const hostname = window.location.hostname.toLowerCase();

  // If we are in local development
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) {
    return cleanPath === '/' ? '/?view=app' : cleanPath;
  }

  // If on Cloudflare preview domain (e.g. *.pages.dev)
  if (hostname.endsWith('.pages.dev')) {
    return cleanPath === '/' ? '/?view=app' : cleanPath;
  }

  // In production: point to app.faderzero.com
  return `https://app.faderzero.com${cleanPath === '/' ? '' : cleanPath}`;
}

export function getLandingUrl(path = ''): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const hostname = window.location.hostname.toLowerCase();

  // If local dev or preview
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost') || hostname.endsWith('.pages.dev')) {
    return cleanPath === '/' ? '/landing' : `/landing${cleanPath}`;
  }

  return `https://faderzero.com${cleanPath === '/' ? '/fr' : cleanPath}`;
}
