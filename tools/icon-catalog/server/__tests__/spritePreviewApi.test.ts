import { describe, expect, it } from 'vitest';
import { spritePreviewApi } from '../spritePreviewApi';

const sprite = '<svg><symbol id="calendar" viewBox="0 0 24 24"><path fill="currentColor" d="M1 2"/></symbol></svg>';

function call(method: string, url: string, reader = async () => sprite) {
  return new Promise<any>((resolve) => {
    const response: any = { headers: {}, setHeader: (key: string, value: string) => response.headers[key] = value, end: (body?: string) => resolve({ status: response.statusCode, headers: response.headers, body }) };
    spritePreviewApi('fixed/public/icons.svg', reader as any)({ method, url } as any, response, () => resolve({ next: true }));
  });
}

describe('sprite preview api', () => {
  it('retourne un SVG autonome pour un symbole connu', async () => {
    const response = await call('GET', '/api/icon-sprite/calendar');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('image/svg+xml');
    expect(response.body).toContain('viewBox="0 0 24 24"');
  });
  it.each(['/api/icon-sprite/..%2Fsecret', '/api/icon-sprite/calendar%23other', '/api/icon-sprite/C%3Asecret'])('refuse un identifiant invalide : %s', async (url) => expect((await call('GET', url)).status).toBe(400));
  it('retourne 404 pour un symbole absent', async () => expect((await call('GET', '/api/icon-sprite/missing')).status).toBe(404));
  it('retourne 500 sans chemin interne', async () => {
    const response = await call('GET', '/api/icon-sprite/calendar', async () => { throw new Error('D:\\secret'); });
    expect(response.status).toBe(500);
    expect(response.body).not.toContain('D:\\secret');
    expect(response.body).not.toContain('stack');
  });
  it('laisse passer les autres routes', async () => expect(await call('GET', '/api/autre-chose')).toEqual({ next: true }));
});
