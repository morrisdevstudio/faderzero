interface R2ObjectBodyLike {
  body: ReadableStream<Uint8Array>;
  text(): Promise<string>;
  httpMetadata?: { contentType?: string };
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  put(key: string, value: ArrayBuffer | string, options?: { onlyIf?: Headers; httpMetadata?: { contentType?: string; cacheControl?: string }; customMetadata?: Record<string, string> }): Promise<unknown | null>;
  delete(key: string): Promise<void>;
}

export interface IssueReporterEnv {
  ISSUE_REPORTS_BUCKET: R2BucketLike;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_REPOSITORY: string;
  AUTHORIZED_REPORTER_EMAIL: string;
  PUBLIC_ASSET_ORIGIN: string;
  ALLOWED_ORIGINS: string;
}

type Category = 'bug' | 'amélioration' | 'notes' | 'feature';
type Receipt = { issueNumber: number; issueUrl: string };
class GitHubApiError extends Error {
  constructor(
    readonly status: number,
    readonly operation: string,
    readonly detail?: string,
    readonly acceptedPermissions?: string,
    readonly rateLimitRemaining?: string,
    readonly retryAfter?: string,
    readonly requestId?: string,
  ) {
    const metadata = [
      acceptedPermissions ? `permissions=${acceptedPermissions}` : '',
      rateLimitRemaining !== undefined ? `remaining=${rateLimitRemaining}` : '',
      retryAfter ? `retry-after=${retryAfter}` : '',
      requestId ? `request-id=${requestId}` : '',
    ].filter(Boolean).join(', ');
    super(`GitHub ${operation} failed (${status})${detail ? `: ${detail}` : ''}${metadata ? ` [${metadata}]` : ''}`);
    this.name = 'GitHubApiError';
  }
}
const REPORT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
const CATEGORIES = new Set<Category>(['bug', 'amélioration', 'notes', 'feature']);
const LABEL_COLORS: Record<Category, string> = { bug: 'd73a4a', 'amélioration': 'a2eeef', notes: '7057ff', feature: '0e8a16' };
const GITHUB_HEADERS = {
  accept: 'application/vnd.github+json',
  'user-agent': 'FaderZero-Issue-Reporter',
  'x-github-api-version': '2022-11-28',
};

export default {
  async fetch(request: Request, env: IssueReporterEnv): Promise<Response> {
    try {
      const url = new URL(request.url);
      const assetMatch = url.pathname.match(/^\/assets\/([0-9a-f-]{36})\.webp$/i);
      if (assetMatch && (request.method === 'GET' || request.method === 'HEAD')) return await serveAsset(request, env, assetMatch[1]!);

      if (!isOriginAllowed(request, env)) return json(request, env, { error: 'Origin non autorisée.' }, 403);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env) });
      if (url.pathname === '/health' && request.method === 'GET') return json(request, env, { status: 'ok' });
      if (url.pathname === '/reports' && request.method === 'POST') return await createReport(request, env);
      return json(request, env, { error: 'Route introuvable.' }, 404);
    } catch (error) {
      console.error(JSON.stringify({ message: 'issue reporter failed', error: error instanceof Error ? error.message : String(error) }));
      if (error instanceof GitHubApiError) {
        return json(request, env, { error: githubPublicError(error) }, 502);
      }
      return json(request, env, { error: 'Erreur interne du service de signalement.' }, 500);
    }
  },
};

async function createReport(request: Request, env: IssueReporterEnv): Promise<Response> {
  if (!env.GITHUB_TOKEN?.trim()) return json(request, env, { error: 'Service GitHub non configuré.' }, 503);
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return json(request, env, { error: 'Signalement trop volumineux.' }, 413);
  const user = await authenticate(request, env);
  if (!user) return json(request, env, { error: 'Session invalide.' }, 401);
  if (user.email.toLowerCase() !== env.AUTHORIZED_REPORTER_EMAIL.trim().toLowerCase()) return json(request, env, { error: 'Compte non autorisé.' }, 403);

  const form = await readBoundedFormData(request);
  if (form === 'too-large') return json(request, env, { error: 'Signalement trop volumineux.' }, 413);
  if (!form) return json(request, env, { error: 'Formulaire invalide.' }, 400);
  const id = field(form, 'id');
  const category = field(form, 'category') as Category;
  const title = field(form, 'title').trim();
  const description = field(form, 'description').trim();
  const diagnosticsRaw = field(form, 'diagnostics');
  const screenshotValue = form.get('screenshot');
  const screenshot = screenshotValue instanceof File ? screenshotValue : null;
  if (!REPORT_ID.test(id) || !CATEGORIES.has(category) || !title || title.length > 120 || !description || description.length > 10_000) {
    return json(request, env, { error: 'Champs du signalement invalides.' }, 400);
  }
  const diagnostics = parseDiagnostics(diagnosticsRaw);
  if (!diagnostics) return json(request, env, { error: 'Diagnostic invalide.' }, 400);
  if (screenshot && (screenshot.type !== 'image/webp' || screenshot.size <= 0 || screenshot.size > MAX_SCREENSHOT_BYTES)) {
    return json(request, env, { error: 'La capture doit être une image WebP de 5 Mio maximum.' }, 415);
  }

  const receiptKey = `receipts/${id}.json`;
  const previous = await readReceipt(env, receiptKey);
  if (previous) return json(request, env, previous);

  const existing = await findExistingIssue(env, id);
  if (existing) {
    await writeReceipt(env, receiptKey, existing);
    return json(request, env, existing);
  }

  const lockKey = `locks/${id}.json`;
  const lock = await acquireLock(env, lockKey, user.id);
  if (!lock) return json(request, env, { error: 'Ce signalement est déjà en cours d’envoi.' }, 409);

  const assetKey = `assets/${id}.webp`;
  let uploaded = false;
  try {
    const afterLock = await readReceipt(env, receiptKey);
    if (afterLock) return json(request, env, afterLock);
    await ensureLabel(env, category);
    if (screenshot) {
      const bytes = await screenshot.arrayBuffer();
      await env.ISSUE_REPORTS_BUCKET.put(assetKey, bytes, {
        httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
        customMetadata: { reportId: id, uploadedBy: user.id },
      });
      uploaded = true;
    }
    const body = buildIssueBody(env, id, description, diagnostics, Boolean(screenshot));
    const response = await githubFetch(env, `/repos/${env.GITHUB_REPOSITORY}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body, labels: [category] }),
    });
    if (!response.ok) {
      if (uploaded) await env.ISSUE_REPORTS_BUCKET.delete(assetKey);
      const githubError = await response.json().catch(() => null) as { message?: unknown } | null;
      return json(request, env, { error: typeof githubError?.message === 'string' ? `GitHub : ${githubError.message}` : 'GitHub a refusé le signalement.' }, response.status === 422 ? 422 : 502);
    }
    const value = await response.json() as { number?: unknown; html_url?: unknown };
    if (typeof value.number !== 'number' || typeof value.html_url !== 'string') throw new Error('Invalid GitHub issue response');
    const receipt = { issueNumber: value.number, issueUrl: value.html_url };
    await writeReceipt(env, receiptKey, receipt);
    return json(request, env, receipt, 201);
  } finally {
    await env.ISSUE_REPORTS_BUCKET.delete(lockKey).catch(() => undefined);
  }
}

async function authenticate(request: Request, env: IssueReporterEnv): Promise<{ id: string; email: string } | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization },
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: unknown; email?: unknown };
  return typeof user.id === 'string' && typeof user.email === 'string' ? { id: user.id, email: user.email } : null;
}

async function serveAsset(request: Request, env: IssueReporterEnv, id: string): Promise<Response> {
  if (!REPORT_ID.test(id)) return new Response('Not found', { status: 404 });
  const object = await env.ISSUE_REPORTS_BUCKET.get(`assets/${id}.webp`);
  if (!object) return new Response('Not found', { status: 404, headers: securityHeaders() });
  return new Response(request.method === 'HEAD' ? null : object.body, {
    headers: { ...securityHeaders(), 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable' },
  });
}

function buildIssueBody(env: IssueReporterEnv, id: string, description: string, diagnostics: Record<string, unknown>, hasScreenshot: boolean): string {
  const screenshot = hasScreenshot ? `\n\n![Capture annotée](${env.PUBLIC_ASSET_ORIGIN.replace(/\/$/, '')}/assets/${id}.webp)` : '';
  const rows = [
    ['Route', diagnostics.route], ['Version', diagnostics.appVersion], ['Date UTC', diagnostics.capturedAt],
    ['Viewport', diagnostics.viewport], ['Mode', diagnostics.displayMode], ['Réseau', diagnostics.online === true ? 'en ligne' : 'hors ligne'],
    ['Navigateur', diagnostics.userAgent],
  ].map(([label, value]) => `| ${label} | ${escapeTable(String(value ?? 'inconnu'))} |`).join('\n');
  return `${description}${screenshot}\n\n<details><summary>Diagnostic automatique</summary>\n\n| Champ | Valeur |\n| --- | --- |\n${rows}\n\n</details>\n\n<!-- faderzero-report-id:${id} -->`;
}

async function findExistingIssue(env: IssueReporterEnv, id: string): Promise<Receipt | null> {
  const marker = `<!-- faderzero-report-id:${id} -->`;
  for (let page = 1; page <= 100; page += 1) {
    const response = await githubFetch(env, `/repos/${env.GITHUB_REPOSITORY}/issues?state=all&sort=created&direction=desc&per_page=100&page=${page}`);
    if (!response.ok) throw await githubApiError(response, 'issue scan');
    const issues = await response.json() as Array<{ number?: unknown; html_url?: unknown; body?: unknown; pull_request?: unknown }>;
    if (!Array.isArray(issues)) return null;
    const match = issues.find((issue) => !issue.pull_request && typeof issue.body === 'string' && issue.body.includes(marker));
    if (match && typeof match.number === 'number' && typeof match.html_url === 'string') {
      return { issueNumber: match.number, issueUrl: match.html_url };
    }
    if (issues.length < 100) return null;
  }
  throw new Error('GitHub issue scan exceeded the safety limit');
}

async function ensureLabel(env: IssueReporterEnv, category: Category): Promise<void> {
  const encoded = encodeURIComponent(category);
  const current = await githubFetch(env, `/repos/${env.GITHUB_REPOSITORY}/labels/${encoded}`);
  if (current.ok) return;
  if (current.status !== 404) throw await githubApiError(current, 'label lookup');
  const response = await githubFetch(env, `/repos/${env.GITHUB_REPOSITORY}/labels`, {
    method: 'POST', body: JSON.stringify({ name: category, color: LABEL_COLORS[category] }),
  });
  if (!response.ok && response.status !== 422) throw await githubApiError(response, 'label creation');
}

function githubFetch(env: IssueReporterEnv, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...GITHUB_HEADERS, authorization: `Bearer ${env.GITHUB_TOKEN}`, 'content-type': 'application/json', ...init.headers },
  });
}

async function githubApiError(response: Response, operation: string): Promise<GitHubApiError> {
  const rawBody = await response.clone().text().catch(() => '');
  let detail: string | undefined;
  try {
    const payload = JSON.parse(rawBody) as { message?: unknown };
    if (typeof payload.message === 'string') detail = payload.message.slice(0, 500);
  } catch {
    if (rawBody.trim()) detail = rawBody.trim().slice(0, 500);
  }
  return new GitHubApiError(
    response.status,
    operation,
    detail,
    response.headers.get('x-accepted-github-permissions') ?? undefined,
    response.headers.get('x-ratelimit-remaining') ?? undefined,
    response.headers.get('retry-after') ?? undefined,
    response.headers.get('x-github-request-id') ?? undefined,
  );
}

function githubPublicError(error: GitHubApiError): string {
  if (error.status === 401) return 'Connexion GitHub invalide. Le jeton du Worker doit être renouvelé.';
  if (error.rateLimitRemaining === '0' || error.retryAfter) return 'GitHub limite temporairement les requêtes. Réessayez plus tard.';
  if (error.status === 403) return 'GitHub refuse l’accès au dépôt. Vérifiez la permission « Issues: Read and write » du jeton.';
  if (error.status === 404) return 'Le dépôt GitHub est introuvable pour ce jeton. Vérifiez que morrisdevstudio/faderzero est autorisé.';
  return 'GitHub est temporairement indisponible. Réessayez dans quelques instants.';
}

async function readReceipt(env: IssueReporterEnv, key: string): Promise<Receipt | null> {
  const object = await env.ISSUE_REPORTS_BUCKET.get(key);
  if (!object) return null;
  try {
    const value = JSON.parse(await object.text()) as Partial<Receipt>;
    return typeof value.issueNumber === 'number' && typeof value.issueUrl === 'string' ? value as Receipt : null;
  } catch { return null; }
}

async function acquireLock(env: IssueReporterEnv, key: string, userId: string): Promise<unknown | null> {
  const value = JSON.stringify({ createdAt: Date.now(), userId });
  const options = { onlyIf: new Headers({ 'if-none-match': '*' }), httpMetadata: { contentType: 'application/json' } };
  const created = await env.ISSUE_REPORTS_BUCKET.put(key, value, options);
  if (created) return created;
  const current = await env.ISSUE_REPORTS_BUCKET.get(key);
  if (!current) return env.ISSUE_REPORTS_BUCKET.put(key, value, options);
  try {
    const lock = JSON.parse(await current.text()) as { createdAt?: unknown };
    if (typeof lock.createdAt === 'number' && Date.now() - lock.createdAt > 120_000) {
      await env.ISSUE_REPORTS_BUCKET.delete(key);
      return env.ISSUE_REPORTS_BUCKET.put(key, value, options);
    }
  } catch { /* A malformed lock is treated as active until manually cleared. */ }
  return null;
}

async function writeReceipt(env: IssueReporterEnv, key: string, receipt: Receipt): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await env.ISSUE_REPORTS_BUCKET.put(key, JSON.stringify(receipt), { httpMetadata: { contentType: 'application/json' } });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unable to persist issue receipt');
}

async function readBoundedFormData(request: Request): Promise<FormData | 'too-large' | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return 'too-large';
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const contentType = request.headers.get('content-type');
    if (!contentType) return null;
    return await new Response(bytes, { headers: { 'content-type': contentType } }).formData();
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function parseDiagnostics(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    return typeof record.route === 'string' && record.route.startsWith('/') && record.route.length <= 500 ? record : null;
  } catch { return null; }
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function isOriginAllowed(request: Request, env: IssueReporterEnv): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).some((allowed) => {
    if (allowed.startsWith('https://*.')) {
      const suffix = allowed.slice('https://*'.length);
      try { const url = new URL(origin); return url.protocol === 'https:' && url.hostname.endsWith(suffix) && url.hostname !== suffix.slice(1); } catch { return false; }
    }
    return origin === allowed;
  });
}

function cors(request: Request, env: IssueReporterEnv): Record<string, string> {
  const origin = request.headers.get('origin');
  return origin && isOriginAllowed(request, env) ? {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    vary: 'Origin',
  } : {};
}

function json(request: Request, env: IssueReporterEnv, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...cors(request, env), ...securityHeaders(), 'cache-control': 'no-store' } });
}

function securityHeaders(): Record<string, string> {
  return { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; frame-ancestors 'none'" };
}

function escapeTable(value: string): string { return value.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' '); }
