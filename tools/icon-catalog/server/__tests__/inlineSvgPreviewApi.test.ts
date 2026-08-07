import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inlineSvgPreviewApi } from '../inlineSvgPreviewApi';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

async function call(url: string, occurrence: any, method = 'GET') {
  const root = await mkdtemp(join(tmpdir(), 'fz-inline-api-')); directories.push(root); await mkdir(join(root, 'src'));
  if (occurrence?.file !== 'src/Missing.tsx') await writeFile(join(root, 'src', 'Icon.tsx'), 'const Icon = () => <svg viewBox="0 0 24 24"><path d="M2 3"/></svg>;');
  const repository: any = { read: async () => ({ inventory: { icons: occurrence ? [occurrence] : [] } }) };
  return new Promise<any>((resolve) => {
    const response: any = { headers: {}, setHeader: (key: string, value: string) => response.headers[key] = value, end: (body?: string) => resolve({ status: response.statusCode, headers: response.headers, body }) };
    inlineSvgPreviewApi(repository, root)({ method, url } as any, response, () => resolve({ next: true }));
  });
}

describe('inline SVG preview API', () => {
  const occurrence = { occurrenceId: 'inline1', format: 'inline-svg', kind: 'inline-svg', file: 'src/Icon.tsx', line: 1 };
  it('retourne un SVG inline disponible', async () => { const response = await call('/api/icon-inline/inline1', occurrence); expect(response.status).toBe(200); expect(response.headers['content-type']).toBe('image/svg+xml'); expect(response.body).toContain('<path d="M2 3"/>'); });
  it.each([
    ['/api/icon-inline/missing', undefined, 404],
    ['/api/icon-inline/inline1', { ...occurrence, format: 'png' }, 400],
    ['/api/icon-inline/inline1', { ...occurrence, file: 'src/Missing.tsx' }, 404],
    ['/api/icon-inline/inline1', { ...occurrence, file: '../secret.tsx' }, 400],
    ['/api/icon-inline/inline%2F1', occurrence, 400],
  ])('protège %s', async (url, item, status) => expect((await call(url, item)).status).toBe(status));
  it('laisse passer les autres routes', async () => expect(await call('/api/other', occurrence)).toEqual({ next: true }));
});
