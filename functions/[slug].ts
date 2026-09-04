type PagesContext = {
  request: Request;
  params: { slug?: string };
  env: { SUPABASE_URL: string; SUPABASE_SECRET_KEY: string; EPK_PUBLIC_MEDIA_ORIGIN?: string };
  next: () => Promise<Response>;
};

type PublishedRow = { display_name: string; slug: string; status: string; published_revision: number; published_snapshot: unknown };
const APP_ORIGIN = 'https://app.faderzero.com';
const PUBLIC_ORIGIN = 'https://faderzero.com';
const DEFAULT_MEDIA_ORIGIN = 'https://media.faderzero.com';

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const slug = context.params.slug?.toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return redirectToLanding();

  const row = await loadEpk(context.env, slug);
  if (!row) return redirectToLanding();
  if (row.status !== 'PUBLISHED') return notPublished();

  const requestUrl = new URL(context.request.url);
  if (requestUrl.searchParams.get('verify')) {
    return new Response(null, { status: 204, headers: publicHeaders(row.published_revision) });
  }

  const shell = await context.next();
  if (!shell.ok) return shell;
  const html = await shell.text();
  const model = withPublicMedia(row.published_snapshot, context.env.EPK_PUBLIC_MEDIA_ORIGIN ?? DEFAULT_MEDIA_ORIGIN);
  if (requestUrl.searchParams.get('format') === 'json') {
    return Response.json(model, { headers: publicHeaders(row.published_revision) });
  }
  const metadata = socialMetadata(model, new URL(requestUrl.pathname, PUBLIC_ORIGIN));
  const payload = safeJson(model);
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const injected = html.replace('</head>', `${metadata}<script nonce="${nonce}">window.__FZ_EPK_MODEL__=${payload};</script></head>`);
  return new Response(injected, { status: 200, headers: { ...publicHeaders(row.published_revision, nonce), 'content-type': 'text/html; charset=UTF-8' } });
};

export const onRequestHead = async (context: PagesContext): Promise<Response> => {
  const slug = context.params.slug?.toLowerCase();
  const row = slug ? await loadEpk(context.env, slug) : null;
  return row?.status === 'PUBLISHED' ? new Response(null, { status: 200, headers: publicHeaders(row.published_revision) }) : redirectToLanding();
};

async function loadEpk(env: PagesContext['env'], slug: string): Promise<PublishedRow | null> {
  const endpoint = new URL(`${env.SUPABASE_URL}/rest/v1/epks`);
  endpoint.searchParams.set('select', 'display_name,slug,status,published_revision,published_snapshot');
  endpoint.searchParams.set('slug', `eq.${slug}`);
  endpoint.searchParams.set('limit', '1');
  const response = await fetch(endpoint, { headers: { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` } });
  if (!response.ok) return null;
  const rows = await response.json() as PublishedRow[];
  return rows[0] ?? null;
}

function withPublicMedia(snapshot: unknown, mediaOrigin?: string): Record<string, unknown> {
  const model = isRecord(snapshot) ? structuredClone(snapshot) : {};
  if (!mediaOrigin) return model;
  const origin = mediaOrigin.replace(/\/$/, '');
  const mediaUrl = (key: unknown) => typeof key === 'string' && key.startsWith('epks/') ? `${origin}/${key}` : undefined;
  const heroUrl = mediaUrl(model.heroPublicKey);
  if (heroUrl) model.heroUrl = heroUrl;
  for (const key of ['tracks', 'photos', 'documents'] as const) {
    if (!Array.isArray(model[key])) continue;
    model[key] = model[key].map((item) => {
      if (!isRecord(item)) return item;
      const url = mediaUrl(item.publicKey);
      return url ? { ...item, [key === 'photos' ? 'previewUrl' : key === 'documents' ? 'url' : 'audioUrl']: url } : item;
    });
  }
  return model;
}

function socialMetadata(model: Record<string, unknown>, url: URL): string {
  const title = stringValue(model.name) || 'FaderZero';
  const description = stringValue(model.shortBio) || stringValue(model.tagline) || title;
  const image = stringValue(model.heroUrl);
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url.origin + url.pathname)}">`,
    '<meta property="og:type" content="website">',
  ];
  if (image) tags.push(`<meta property="og:image" content="${escapeHtml(image)}">`);
  return tags.join('');
}

function publicHeaders(revision: number, nonce?: string): Record<string, string> {
  const scriptSource = nonce ? `'self' 'nonce-${nonce}'` : "'self'";
  return {
    'cache-control': 'no-store',
    'x-fz-epk-revision': String(revision),
    'access-control-allow-origin': APP_ORIGIN,
    vary: 'Origin',
    'content-security-policy': `default-src 'self'; base-uri 'self'; connect-src 'self' https:; font-src 'self' data:; frame-ancestors 'none'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; img-src 'self' data: https://media.faderzero.com; media-src 'self' blob: https://media.faderzero.com; object-src 'none'; script-src ${scriptSource}; style-src 'self'; form-action 'self'; upgrade-insecure-requests`,
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
  };
}
function redirectToLanding() { return Response.redirect('https://faderzero.com/fr', 302); }
function notPublished(): Response {
  return new Response('<!doctype html><title>Page publique non publiée</title><meta name="robots" content="noindex"><h1>Page publique non publiée</h1>', { status: 404, headers: { ...publicHeaders(0), 'content-type': 'text/html; charset=UTF-8' } });
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function stringValue(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }
function safeJson(value: unknown): string { return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\\u2028/g, '\\u2028').replace(/\\u2029/g, '\\u2029'); }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character)); }
