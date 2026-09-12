// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { type IssueReporterEnv } from './index';

class MemoryBucket {
  values = new Map<string, { value: Uint8Array; contentType?: string }>();

  async get(key: string) {
    const entry = this.values.get(key);
    if (!entry) return null;
    const copy = entry.value.slice();
    return {
      body: new Response(copy).body!,
      text: async () => new TextDecoder().decode(copy),
      ...(entry.contentType ? { httpMetadata: { contentType: entry.contentType } } : {}),
    };
  }

  async put(key: string, value: ArrayBuffer | string, options?: { onlyIf?: Headers; httpMetadata?: { contentType?: string } }) {
    if (options?.onlyIf?.get('if-none-match') === '*' && this.values.has(key)) return null;
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
    this.values.set(key, { value: bytes, ...(options?.httpMetadata?.contentType ? { contentType: options.httpMetadata.contentType } : {}) });
    return {};
  }

  async delete(key: string) { this.values.delete(key); }
}

class ReceiptFailingBucket extends MemoryBucket {
  receiptFailures = 3;

  override async put(key: string, value: ArrayBuffer | string, options?: { onlyIf?: Headers; httpMetadata?: { contentType?: string } }) {
    if (key.startsWith('receipts/') && this.receiptFailures > 0) {
      this.receiptFailures -= 1;
      throw new Error('temporary R2 receipt failure');
    }
    return super.put(key, value, options);
  }
}

function environment(bucket = new MemoryBucket()): IssueReporterEnv {
  return {
    ISSUE_REPORTS_BUCKET: bucket,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'publishable',
    GITHUB_TOKEN: 'github-secret',
    GITHUB_REPOSITORY: 'morrisdevstudio/faderzero',
    AUTHORIZED_REPORTER_EMAIL: 'yann.chouteau@gmail.com',
    PUBLIC_ASSET_ORIGIN: 'https://reports.example.com',
    ALLOWED_ORIGINS: 'https://app.faderzero.com,https://*.faderzero.pages.dev',
  };
}

function reportRequest(id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', screenshot = true) {
  const form = new FormData();
  form.set('id', id);
  form.set('category', 'bug');
  form.set('title', 'Le bouton ne répond plus');
  form.set('description', 'Le problème apparaît après ouverture de la page.');
  form.set('diagnostics', JSON.stringify({ route: '/songs', appVersion: 'release-1', capturedAt: '2026-09-12T10:00:00Z', viewport: '390×844@3', displayMode: 'standalone', online: true, userAgent: 'test' }));
  if (screenshot) form.set('screenshot', new File([new Uint8Array([1, 2, 3])], `${id}.webp`, { type: 'image/webp' }));
  return new Request('https://reports.example.com/reports', {
    method: 'POST', headers: { origin: 'https://app.faderzero.com', authorization: 'Bearer user-token' }, body: form,
  });
}

afterEach(() => vi.restoreAllMocks());

describe('issue reporter worker', () => {
  it('fails closed when the GitHub secret is not provisioned', async () => {
    const env = environment();
    env.GITHUB_TOKEN = '';
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const response = await worker.fetch(reportRequest(), env);
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unapproved origins before authentication', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const response = await worker.fetch(new Request('https://reports.example.com/reports', { method: 'POST', headers: { origin: 'https://evil.example' } }), environment());
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a valid session belonging to another email', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ id: 'user-2', email: 'other@example.com' }));
    const response = await worker.fetch(reportRequest(), environment());
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'Compte non autorisé.' });
  });

  it('uploads the screenshot and creates a labelled GitHub issue', async () => {
    const bucket = new MemoryBucket();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1', email: 'yann.chouteau@gmail.com' });
      if (url.includes('/issues?')) return Response.json([]);
      if (url.includes('/labels/bug')) return Response.json({ name: 'bug' });
      if (url.endsWith('/issues') && init?.method === 'POST') return Response.json({ number: 17, html_url: 'https://github.com/morrisdevstudio/faderzero/issues/17' }, { status: 201 });
      return new Response('unexpected', { status: 500 });
    });
    const response = await worker.fetch(reportRequest(), environment(bucket));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ issueNumber: 17, issueUrl: 'https://github.com/morrisdevstudio/faderzero/issues/17' });
    expect(bucket.values.has('assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp')).toBe(true);
    expect(bucket.values.has('receipts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json')).toBe(true);
    const issueCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith('/issues') && init?.method === 'POST');
    expect(String(issueCall?.[1]?.body)).toContain('faderzero-report-id:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(String(issueCall?.[1]?.body)).toContain('Capture annotée');
  });

  it('returns the previous receipt instead of creating a duplicate', async () => {
    const bucket = new MemoryBucket();
    await bucket.put('receipts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json', JSON.stringify({ issueNumber: 8, issueUrl: 'https://github.com/example/8' }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ id: 'user-1', email: 'yann.chouteau@gmail.com' }));
    const response = await worker.fetch(reportRequest('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false), environment(bucket));
    await expect(response.json()).resolves.toEqual({ issueNumber: 8, issueUrl: 'https://github.com/example/8' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('recovers a lost response by scanning issue pages when receipt persistence failed', async () => {
    const bucket = new ReceiptFailingBucket();
    let issueCreated = false;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1', email: 'yann.chouteau@gmail.com' });
      if (url.includes('/issues?')) return Response.json(issueCreated ? [{
        number: 17,
        html_url: 'https://github.com/morrisdevstudio/faderzero/issues/17',
        body: '<!-- faderzero-report-id:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa -->',
      }] : []);
      if (url.includes('/labels/bug')) return Response.json({ name: 'bug' });
      if (url.endsWith('/issues') && init?.method === 'POST') {
        issueCreated = true;
        return Response.json({ number: 17, html_url: 'https://github.com/morrisdevstudio/faderzero/issues/17' }, { status: 201 });
      }
      return new Response('unexpected', { status: 500 });
    });
    expect((await worker.fetch(reportRequest(undefined, false), environment(bucket))).status).toBe(500);
    const retry = await worker.fetch(reportRequest(undefined, false), environment(bucket));
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toEqual({ issueNumber: 17, issueUrl: 'https://github.com/morrisdevstudio/faderzero/issues/17' });
    expect(fetchMock.mock.calls.filter(([input, init]) => String(input).endsWith('/issues') && init?.method === 'POST')).toHaveLength(1);
  });

  it('rejects an oversized streamed multipart body without a content-length header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ id: 'user-1', email: 'yann.chouteau@gmail.com' }));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(6 * 1024 * 1024 + 1));
        controller.close();
      },
    });
    const request = new Request('https://reports.example.com/reports', {
      method: 'POST',
      headers: { origin: 'https://app.faderzero.com', authorization: 'Bearer user-token', 'content-type': 'multipart/form-data; boundary=test' },
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    const response = await worker.fetch(request, environment());
    expect(response.status).toBe(413);
  });

  it('serves stored captures without exposing a listing route', async () => {
    const bucket = new MemoryBucket();
    await bucket.put('assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp', new Uint8Array([1, 2, 3]).buffer, { httpMetadata: { contentType: 'image/webp' } });
    const response = await worker.fetch(new Request('https://reports.example.com/assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp'), environment(bucket));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toContain('immutable');
    const listing = await worker.fetch(new Request('https://reports.example.com/assets/', { headers: { origin: 'https://app.faderzero.com' } }), environment(bucket));
    expect(listing.status).toBe(404);
  });
});
