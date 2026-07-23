import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const caddyfilePath = fileURLToPath(new URL('../deploy/Caddyfile', import.meta.url));
const pagesHeadersPath = fileURLToPath(new URL('../public/_headers', import.meta.url));
const pagesRedirectsPath = fileURLToPath(new URL('../public/_redirects', import.meta.url));
const caddyfile = await readFile(caddyfilePath, 'utf8');
const pagesHeaders = await readFile(pagesHeadersPath, 'utf8');
const pagesRedirects = await readFile(pagesRedirectsPath, 'utf8');
const activeConfiguration = caddyfile
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

const requiredFragments = [
  "Content-Security-Policy \"default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "media-src 'self' blob: https://faderzero-audio-api.admin-morris-studio.workers.dev",
  "frame-ancestors 'none'",
  'X-Content-Type-Options "nosniff"',
  'Referrer-Policy "no-referrer"',
  'Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"',
  'X-Frame-Options "DENY"',
  'Strict-Transport-Security "max-age=31536000; includeSubDomains"',
  'localhost:8443, faderzero-server.tailfba668.ts.net:8443 {',
  'tls internal',
];

for (const fragment of requiredFragments) {
  if (!activeConfiguration.includes(fragment)) {
    throw new Error(`Missing security-header configuration: ${fragment}`);
  }
}

if (/unsafe-(?:eval|inline)/i.test(activeConfiguration)) {
  throw new Error('CSP must not allow unsafe-eval or unsafe-inline.');
}

if (/:8080\s*\{/i.test(activeConfiguration)) {
  throw new Error('The application must be served through the HTTPS listener on :8443.');
}

const requiredPagesFragments = [
  "Content-Security-Policy: default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "media-src 'self' blob: https://faderzero-audio-api.admin-morris-studio.workers.dev",
  "frame-ancestors 'none'",
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: no-referrer',
  'Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  'X-Frame-Options: DENY',
  'Strict-Transport-Security: max-age=31536000; includeSubDomains',
  'Cache-Control: public, max-age=31536000, immutable',
];

for (const fragment of requiredPagesFragments) {
  if (!pagesHeaders.includes(fragment)) {
    throw new Error(`Missing Cloudflare Pages security configuration: ${fragment}`);
  }
}

if (/unsafe-(?:eval|inline)/i.test(pagesHeaders)) {
  throw new Error('Cloudflare Pages CSP must not allow unsafe-eval or unsafe-inline.');
}

if (!/^\/\*\s+\/index\.html\s+200\s*$/m.test(pagesRedirects)) {
  throw new Error('Cloudflare Pages must fall back to index.html for SPA routes.');
}

console.log('Security header configuration is valid.');
