import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iconCaptureApi } from '../iconCaptureApi';

const temporaryRoots: string[] = [];

async function fixture(status: string = 'captured', file = 'screenshots/icons/runtime/capture.png') {
  const root = await mkdtemp(join(tmpdir(), 'fz-icon-capture-'));
  temporaryRoots.push(root);
  const runtime = join(root, 'docs/icon-audit/screenshots/icons/runtime');
  await mkdir(runtime, { recursive: true });
  if (status === 'captured') await writeFile(join(runtime, 'capture.png'), Buffer.from([137, 80, 78, 71]));
  await writeFile(join(root, 'docs/icon-audit/capture-report.json'), JSON.stringify({ occurrences: [{ occurrenceId: 'dynamic_1', status, file, reason: 'Donnée de test absente' }] }));
  return root;
}

async function call(root: string, method: string, url: string) {
  return new Promise<{ status: number; headers: Record<string, string>; body: Buffer | string | undefined; next?: boolean }>((resolve) => {
    const response: any = { statusCode: 200, headers: {}, setHeader: (key: string, value: string) => { response.headers[key] = value; }, end: (body?: Buffer | string) => resolve({ status: response.statusCode, headers: response.headers, body }) };
    iconCaptureApi(root)({ method, url } as any, response, () => resolve({ status: 0, headers: {}, body: undefined, next: true }));
  });
}

afterEach(async () => { await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe('icon capture API', () => {
  it('sert uniquement une capture déclarée sous runtime', async () => {
    const response = await call(await fixture(), 'GET', '/api/icon-capture/dynamic_1');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.body).toEqual(Buffer.from([137, 80, 78, 71]));
  });
  it.each(['/api/icon-capture/..%2Fsecret', '/api/icon-capture/C%3Asecret'])('refuse un identifiant dangereux', async (url) => expect((await call(await fixture(), 'GET', url)).status).toBe(400));
  it('retourne 404 pour une occurrence inconnue', async () => expect((await call(await fixture(), 'GET', '/api/icon-capture/missing')).status).toBe(404));
  it('retourne 409 pour une capture bloquée sans exposer le rapport', async () => {
    const response = await call(await fixture('blocked-no-fixture'), 'GET', '/api/icon-capture/dynamic_1');
    expect(response.status).toBe(409);
    expect(String(response.body)).not.toContain('screenshots');
  });
  it('laisse les autres routes à Vite', async () => expect((await call(await fixture(), 'GET', '/api/autre-chose')).next).toBe(true));
});
