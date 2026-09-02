type WorkerEnv = Omit<Cloudflare.Env, 'SUPABASE_URL'> & {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  MEDIA_SIGNING_SECRET: string;
  MEDIA_BUCKET: R2Bucket;
  PAGES_ORIGIN?: string;
};

type EpkContact = { name: string; role: string; email: string | null; phone: string | null; whatsapp: string | null };
type EpkVideo = { provider: 'YOUTUBE' | 'VIMEO'; provider_video_id: string; title: string | null; video_type: string; position: number };
type EpkLink = { kind: string; label: string | null; url: string; position: number };
type EpkPhoto = { id: string; preview_asset_id: string; original_asset_id: string; credit: string | null; caption: string | null; position: number };
type EpkDocument = { id: string; asset_id: string; title: string; document_type: string; document_updated_at: string; position: number };
type EpkTrack = { id: string; title: string; description: string | null; visibility: string; position: number; source_type: string; audio_asset_id: string | null; song_asset_id?: string | null };
type EpkRow = { id: string; display_name: string; slug: string; tagline: string | null; short_bio: string | null; full_bio: string | null; city: string | null; country: string | null; genres: string[]; theme: string; status: string; hero_asset_id: string | null; accent_color?: string; published_snapshot?: unknown; epk_contacts: EpkContact[]; epk_videos: EpkVideo[]; epk_links: EpkLink[]; epk_photos: EpkPhoto[]; epk_documents: EpkDocument[]; epk_tracks: EpkTrack[] };
type PublicAsset = { storage_path: string; mime_type: string; kind: string };
type PublicTrack = { audio_asset_id: string; epk_assets: PublicAsset };
const PHOTO_CAROUSEL_SCRIPT = `<script>document.querySelectorAll('[data-photo-carousel]').forEach(function(carousel){var track=carousel.querySelector('[data-photo-track]');if(!track)return;var count=track.children.length;var index=0;var position=carousel.querySelector('[data-photo-position]');function render(){if(position)position.textContent=(index+1)+' / '+count}function move(direction){index=(index+direction+count)%count;track.scrollTo({left:track.clientWidth*index,behavior:'smooth'});render()}var previous=carousel.querySelector('[data-photo-prev]');var next=carousel.querySelector('[data-photo-next]');if(previous)previous.addEventListener('click',function(){move(-1)});if(next)next.addEventListener('click',function(){move(1)});track.addEventListener('scroll',function(){index=Math.max(0,Math.min(count-1,Math.round(track.scrollLeft/track.clientWidth)));render()});if(count>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches){setInterval(function(){move(1)},5000)}});</script>`;
const RESERVED_PAGE_SLUGS = new Set(['account', 'assets', 'booking', 'calendar', 'en', 'fr', 'home', 'imports', 'landing', 'login', 'metronome', 'musiques', 'prompter', 'robots.txt', 'sitemap.xml', 'songs', 'setlists', 'sync']);

const LANDING_SEO = {
  fr: { title: 'FaderZero — Le cockpit de scène des groupes', description: 'Préparez vos répétitions et concerts : setlists, paroles, prompteur, métronome et audio, même hors connexion.', locale: 'fr_FR' },
  en: { title: 'FaderZero — The stage cockpit for bands', description: 'Prepare rehearsals and gigs with setlists, lyrics, prompter, metronome, and audio—even offline.', locale: 'en_US' },
} as const;

function forwardToPages(request: Request, env: WorkerEnv): Promise<Response> {
  const pagesOrigin = env.PAGES_ORIGIN || 'https://faderzero.pages.dev';
  const url = new URL(request.url);
  const targetUrl = new URL(url.pathname + url.search, pagesOrigin);
  const headers = new Headers(request.headers);
  headers.set('host', new URL(pagesOrigin).host);
  return fetch(new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'follow',
  }));
}

function preferredLandingLanguage(request: Request): 'fr' | 'en' {
  const candidates = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((entry, index) => {
      const [language, ...parameters] = entry.trim().split(';');
      const quality = Number(parameters.find((parameter) => parameter.trim().startsWith('q='))?.trim().slice(2) ?? '1');
      return { language: language?.toLowerCase() ?? '', quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((candidate) => candidate.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);
  for (const candidate of candidates) {
    if (candidate.language === 'fr' || candidate.language.startsWith('fr-')) return 'fr';
    if (candidate.language === 'en' || candidate.language.startsWith('en-')) return 'en';
  }
  return 'fr';
}

async function forwardLandingPage(request: Request, env: WorkerEnv, language: 'fr' | 'en'): Promise<Response> {
  const response = await forwardToPages(request, env);
  const seo = LANDING_SEO[language];
  const alternate = language === 'fr' ? 'en' : 'fr';
  const html = (await response.text()).replace('<html lang="en">', `<html lang="${language}">`).replace('</head>', `<meta name="description" content="${seo.description}"><link rel="canonical" href="https://faderzero.com/${language}"><link rel="alternate" hreflang="fr" href="https://faderzero.com/fr"><link rel="alternate" hreflang="en" href="https://faderzero.com/en"><link rel="alternate" hreflang="x-default" href="https://faderzero.com/fr"><meta property="og:type" content="website"><meta property="og:title" content="${seo.title}"><meta property="og:description" content="${seo.description}"><meta property="og:url" content="https://faderzero.com/${language}"><meta property="og:locale" content="${seo.locale}"><meta property="og:locale:alternate" content="${LANDING_SEO[alternate].locale}"></head>`).replace('<title>FaderZero PWA</title>', `<title>${seo.title}</title>`);
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  return new Response(html, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      const destination = new URL(`/${preferredLandingLanguage(request)}`, url);
      return new Response(null, { status: 302, headers: { location: destination.toString(), vary: 'Accept-Language' } });
    }
    if (request.method === 'GET' && (url.pathname === '/fr' || url.pathname === '/en')) {
      return forwardLandingPage(request, env, url.pathname.slice(1) as 'fr' | 'en');
    }
    const sessionMatch = url.pathname.match(/^\/api\/public\/([a-z0-9]+(?:-[a-z0-9]+)*)\/tracks\/([0-9a-f-]+)\/session$/);
    if (request.method === 'POST' && sessionMatch) return createTrackSession(request, env, sessionMatch[1]!, sessionMatch[2]!);
    const downloadSessionMatch = url.pathname.match(/^\/api\/public\/([a-z0-9]+(?:-[a-z0-9]+)*)\/documents\/([0-9a-f-]+)\/session$/);
    if (request.method === 'POST' && downloadSessionMatch) return createDocumentSession(request, env, downloadSessionMatch[1]!, downloadSessionMatch[2]!);
    if (request.method === 'GET' && url.pathname.startsWith('/media/preview/')) return servePreview(request, env, url.pathname.slice('/media/preview/'.length));
    if (request.method === 'GET' && url.pathname.startsWith('/media/audio/')) return serveSignedAsset(request, env, url.pathname.slice('/media/audio/'.length), 'audio');
    if (request.method === 'GET' && url.pathname.startsWith('/media/song-audio/')) return serveSignedSongAsset(request, env, url.pathname.slice('/media/song-audio/'.length));
    if (request.method === 'GET' && url.pathname.startsWith('/download/')) return serveSignedAsset(request, env, url.pathname.slice('/download/'.length), 'download');
    if (request.method !== 'GET' || url.pathname.split('/').filter(Boolean).length !== 1) return forwardToPages(request, env);
    const slug = url.pathname.slice(1);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || RESERVED_PAGE_SLUGS.has(slug)) return forwardToPages(request, env);
    try {
      const cache = typeof caches !== 'undefined' && 'default' in caches ? (caches as unknown as { default: Cache }).default : null;
      if (cache) {
        const cached = await cache.match(request);
        if (cached) return cached;
      }
      const epk = await loadPublishedEpk(slug, env);
      if (!epk) return forwardToPages(request, env);
      const response = url.searchParams.get('format') === 'json'
        ? Response.json(toPublicDto(epk), { headers: publicHeaders('application/json; charset=utf-8') })
        : new Response(renderHtml(epk, url), { headers: publicHeaders('text/html; charset=utf-8') });
      if (cache && response.status === 200) {
        if (ctx?.waitUntil) {
          ctx.waitUntil(cache.put(request, response.clone()));
        } else {
          await cache.put(request, response.clone());
        }
      }
      return response;
    } catch (error) {
      console.error(JSON.stringify({ message: 'epk public request failed', slug, error: error instanceof Error ? error.message : String(error) }));
      return forwardToPages(request, env);
    }
  },
} satisfies ExportedHandler<WorkerEnv>;

async function loadPublishedEpk(slug: string, env: WorkerEnv): Promise<EpkRow | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/epks`);
  url.searchParams.set('select', 'id,display_name,slug,tagline,short_bio,full_bio,city,country,genres,theme,status,hero_asset_id,accent_color,published_snapshot,epk_contacts(name,role,email,phone,whatsapp),epk_videos(provider,provider_video_id,title,video_type,position),epk_links(kind,label,url,position),epk_photos(id,preview_asset_id,original_asset_id,credit,caption,position),epk_documents(id,asset_id,title,document_type,document_updated_at,position),epk_tracks(id,title,description,visibility,position,source_type,audio_asset_id,song_asset_id)');
  url.searchParams.set('slug', `eq.${slug}`); url.searchParams.set('status', 'eq.PUBLISHED'); url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, accept: 'application/json' } });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  const body: unknown = await response.json();
  return Array.isArray(body) && isEpkRow(body[0]) ? body[0] : null;
}

async function loadPublishedAsset(assetId: string, env: WorkerEnv, allowedKinds: string[]): Promise<PublicAsset | null> {
  if (!isUuid(assetId)) return null;
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/epk_assets`);
  // `epks` also references media through hero/logo fields. Name the asset's
  // owning FK explicitly so PostgREST does not reject this embed as ambiguous.
  url.searchParams.set('select', 'storage_path,mime_type,kind,epks!epk_assets_epk_id_fkey!inner(status)');
  url.searchParams.set('id', `eq.${assetId}`);
  url.searchParams.set('epks.status', 'eq.PUBLISHED');
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: serviceHeaders(env) });
  if (!response.ok) throw new Error(`Supabase asset lookup returned ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body) || !isPublicAsset(body[0]) || !allowedKinds.includes(body[0].kind)) return null;
  return body[0];
}

async function createTrackSession(request: Request, env: WorkerEnv, slug: string, trackId: string): Promise<Response> {
  if (!isUuid(trackId)) return unavailable();
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/epk_tracks`);
  url.searchParams.set('select', 'audio_asset_id,epks!inner(slug,status),epk_assets!inner(storage_path,mime_type,kind)');
  url.searchParams.set('id', `eq.${trackId}`);
  url.searchParams.set('source_type', 'eq.EPK_ASSET');
  url.searchParams.set('visibility', 'eq.PUBLIC');
  url.searchParams.set('epks.slug', `eq.${slug}`);
  url.searchParams.set('epks.status', 'eq.PUBLISHED');
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: serviceHeaders(env) });
  if (!response.ok) throw new Error(`Supabase track lookup returned ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body) || !isPublicTrack(body[0])) {
    const songUrl = new URL(`${env.SUPABASE_URL}/rest/v1/epk_tracks`);
    songUrl.searchParams.set('select', 'song_asset_id,epks!inner(slug,status)'); songUrl.searchParams.set('id', `eq.${trackId}`); songUrl.searchParams.set('source_type', 'eq.SONG_ASSET'); songUrl.searchParams.set('visibility', 'eq.PUBLIC'); songUrl.searchParams.set('epks.slug', `eq.${slug}`); songUrl.searchParams.set('epks.status', 'eq.PUBLISHED'); songUrl.searchParams.set('limit', '1');
    const songResponse = await fetch(songUrl, { headers: serviceHeaders(env) }); const songBody: unknown = songResponse.ok ? await songResponse.json() : null;
    if (!Array.isArray(songBody) || !isRecord(songBody[0]) || typeof songBody[0].song_asset_id !== 'string') return unavailable();
    const expires = Math.floor(Date.now() / 1000) + 300; const signature = await signMedia(songBody[0].song_asset_id, expires, env.MEDIA_SIGNING_SECRET); const audioUrl = new URL(`/media/song-audio/${songBody[0].song_asset_id}`, request.url); audioUrl.searchParams.set('expires', String(expires)); audioUrl.searchParams.set('signature', signature);
    return Response.json({ url: audioUrl.toString(), expiresAt: new Date(expires * 1000).toISOString() }, { headers: new Headers({ 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' }) });
  }
  const expires = Math.floor(Date.now() / 1000) + 300;
  const signature = await signMedia(body[0].audio_asset_id, expires, env.MEDIA_SIGNING_SECRET);
  const audioUrl = new URL(`/media/audio/${body[0].audio_asset_id}`, request.url);
  audioUrl.searchParams.set('expires', String(expires)); audioUrl.searchParams.set('signature', signature);
  return Response.json({ url: audioUrl.toString(), expiresAt: new Date(expires * 1000).toISOString() }, { headers: new Headers({ 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' }) });
}

async function serveSignedSongAsset(request: Request, env: WorkerEnv, assetId: string): Promise<Response> {
  const url = new URL(request.url); const expires = Number(url.searchParams.get('expires')); const signature = url.searchParams.get('signature'); const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(expires) || expires < now || expires > now + 300 || !signature || !(await verifyMediaSignature(assetId, expires, signature, env.MEDIA_SIGNING_SECRET))) return unavailable();
  const query = new URL(`${env.SUPABASE_URL}/rest/v1/epk_tracks`); query.searchParams.set('select', 'song_assets!inner(storage_path,mime_type),epks!inner(status)'); query.searchParams.set('song_asset_id', `eq.${assetId}`); query.searchParams.set('source_type', 'eq.SONG_ASSET'); query.searchParams.set('visibility', 'eq.PUBLIC'); query.searchParams.set('epks.status', 'eq.PUBLISHED'); query.searchParams.set('limit', '1');
  const response = await fetch(query, { headers: serviceHeaders(env) }); const body: unknown = response.ok ? await response.json() : null;
  if (!Array.isArray(body) || !isRecord(body[0]) || !isRecord(body[0].song_assets) || typeof body[0].song_assets.storage_path !== 'string' || typeof body[0].song_assets.mime_type !== 'string') return unavailable();
  return serveR2Asset(request, env, { storage_path: body[0].song_assets.storage_path, mime_type: body[0].song_assets.mime_type, kind: 'audio' }, false, 'private, no-store');
}

async function createDocumentSession(request: Request, env: WorkerEnv, slug: string, assetId: string): Promise<Response> {
  if (!isUuid(assetId)) return unavailable();
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/epk_documents`);
  url.searchParams.set('select', 'asset_id,epks!inner(slug,status)');
  url.searchParams.set('asset_id', `eq.${assetId}`);
  url.searchParams.set('epks.slug', `eq.${slug}`);
  url.searchParams.set('epks.status', 'eq.PUBLISHED');
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: serviceHeaders(env) });
  if (!response.ok) throw new Error(`Supabase document lookup returned ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body) || !isRecord(body[0]) || body[0].asset_id !== assetId) return unavailable();
  const expires = Math.floor(Date.now() / 1000) + 300;
  const signature = await signMedia(assetId, expires, env.MEDIA_SIGNING_SECRET);
  const downloadUrl = new URL(`/download/${assetId}`, request.url);
  downloadUrl.searchParams.set('expires', String(expires));
  downloadUrl.searchParams.set('signature', signature);
  return Response.json({ url: downloadUrl.toString(), expiresAt: new Date(expires * 1000).toISOString() }, { headers: new Headers({ 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' }) });
}

async function servePreview(request: Request, env: WorkerEnv, assetId: string): Promise<Response> {
  const asset = await loadPublishedAsset(assetId, env, ['image_preview', 'image_original', 'logo', 'artwork']);
  if (!asset) return unavailable();
  return serveR2Asset(request, env, asset, false, 'public, max-age=300, s-maxage=3600');
}

async function serveSignedAsset(request: Request, env: WorkerEnv, assetId: string, mode: 'audio' | 'download'): Promise<Response> {
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get('expires'));
  const signature = url.searchParams.get('signature');
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(expires) || expires < now || expires > now + 300 || !signature || !(await verifyMediaSignature(assetId, expires, signature, env.MEDIA_SIGNING_SECRET))) return unavailable();
  const asset = await loadPublishedAsset(assetId, env, mode === 'audio' ? ['audio'] : ['image_original', 'document']);
  if (!asset) return unavailable();
  return serveR2Asset(request, env, asset, mode === 'download', 'private, no-store');
}

async function serveR2Asset(request: Request, env: WorkerEnv, asset: PublicAsset, download: boolean, cacheControl: string): Promise<Response> {
  const object = await env.MEDIA_BUCKET.get(asset.storage_path, { range: request.headers });
  if (!object) return unavailable();
  const headers = new Headers({ 'content-type': asset.mime_type, 'accept-ranges': 'bytes', etag: object.httpEtag, 'cache-control': cacheControl, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
  if (download) headers.set('content-disposition', 'attachment');
  let status = 200;
  if (object.range && 'offset' in object.range && 'length' in object.range) {
    headers.set('content-range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
    headers.set('content-length', String(object.range.length)); status = 206;
  } else headers.set('content-length', String(object.size));
  return new Response(object.body, { status, headers });
}

function serviceHeaders(env: WorkerEnv): HeadersInit { return { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, accept: 'application/json' }; }

function toPublicDto(epk: EpkRow) {
  return { name: epk.display_name, slug: epk.slug, tagline: epk.tagline, shortBio: epk.short_bio, fullBio: epk.full_bio, city: epk.city, country: epk.country, genres: epk.genres, theme: epk.theme, contacts: epk.epk_contacts.map((contact) => ({ name: contact.name, role: contact.role, email: contact.email, phone: contact.phone, whatsapp: contact.whatsapp })), videos: epk.epk_videos.sort((a, b) => a.position - b.position).map((video) => ({ provider: video.provider, id: video.provider_video_id, title: video.title, type: video.video_type })), links: epk.epk_links.sort((a, b) => a.position - b.position).map((link) => ({ kind: link.kind, label: link.label, url: link.url })), photos: epk.epk_photos.sort((a, b) => a.position - b.position).map((photo) => ({ id: photo.id, previewAssetId: photo.preview_asset_id, originalAssetId: photo.original_asset_id, credit: photo.credit, caption: photo.caption })), documents: epk.epk_documents.sort((a, b) => a.position - b.position).map((document) => ({ id: document.id, assetId: document.asset_id, title: document.title, type: document.document_type, updatedAt: document.document_updated_at })), tracks: epk.epk_tracks.filter((track) => track.visibility === 'PUBLIC' && ((track.source_type === 'EPK_ASSET' && track.audio_asset_id) || (track.source_type === 'SONG_ASSET' && track.song_asset_id))).sort((a, b) => a.position - b.position).map((track) => ({ id: track.id, title: track.title, description: track.description, visibility: track.visibility })) };
}

function renderHtml(epk: EpkRow, url: URL): string {
  const snapshot = isRecord(epk.published_snapshot) ? epk.published_snapshot : null;
  if (snapshot) return renderSnapshotHtml(snapshot, epk, url);
  const fallbackSnapshot: Record<string, unknown> = {
    name: epk.display_name,
    slug: epk.slug,
    tagline: epk.tagline,
    shortBio: epk.short_bio,
    fullBio: epk.full_bio,
    city: epk.city,
    country: epk.country,
    genres: epk.genres,
    accentColor: epk.accent_color,
    sectionOrder: ['bio', 'musique', 'medias', 'espacePro', 'contact'],
    hiddenSections: [],
    videos: epk.epk_videos.map((v) => ({ id: v.provider_video_id, title: v.title, provider: v.provider, providerVideoId: v.provider_video_id })),
    tracks: epk.epk_tracks.filter((t) => t.visibility === 'PUBLIC').map((t) => ({ id: t.id, title: t.title, description: t.description })),
    photos: epk.epk_photos.map((p) => ({ id: p.id, previewAssetId: p.preview_asset_id, caption: p.caption, credit: p.credit })),
    documents: epk.epk_documents.map((d) => ({ id: d.id, assetId: d.asset_id, title: d.title, type: d.document_type, updatedAt: d.document_updated_at })),
    contacts: epk.epk_contacts.map((c) => ({ name: c.name, role: c.role, email: c.email, phone: c.phone, whatsapp: c.whatsapp })),
    links: epk.epk_links.map((l) => ({ label: l.label || l.kind, url: l.url })),
    editorial: { bioTitle: 'Biographie', musicTitle: 'À écouter', proTitle: 'Espace pro', proDescription: '', contactTitle: 'Contact', facts: [] },
  };
  return renderSnapshotHtml(fallbackSnapshot, epk, url);
}

function renderSnapshotHtml(snapshot: Record<string, unknown>, epk: EpkRow, url: URL): string {
  const value = (key: string) => typeof snapshot[key] === 'string' ? snapshot[key] : '';
  const list = (key: string) => Array.isArray(snapshot[key]) ? snapshot[key] : [];
  const accent = /^#[0-9a-f]{6}$/i.test(value('accentColor')) ? value('accentColor') : '#ff3a63';
  const heroUrl = epk.hero_asset_id && isUuid(epk.hero_asset_id) ? `/media/preview/${epk.hero_asset_id}` : '';
  const heroBackground = heroUrl ? `linear-gradient(to top,#09090b,#0008,#0003),url('${heroUrl}') center/cover` : 'linear-gradient(to top,#09090b,#0008,#0003)';
  const name = value('name') || epk.display_name; const title = escapeHtml(name); const description = escapeHtml(value('tagline') || value('shortBio') || name);
  const genres = list('genres').filter((item): item is string => typeof item === 'string').map((genre) => `<span>${escapeHtml(genre)}</span>`).join('');
  const location = [value('city'), value('country')].filter(Boolean).map(escapeHtml).join(' · ');
  const videos = list('videos').filter(isRecord).map((video) => { const id = encodeURIComponent(String(video.providerVideoId ?? '')); const source = video.provider === 'VIMEO' ? `https://player.vimeo.com/video/${id}` : `https://www.youtube-nocookie.com/embed/${id}`; const title = escapeAttribute(String(video.title || 'Vidéo du groupe')); return `<article class="video" style="display:block;padding:0;overflow:hidden"><iframe src="${source}" title="${title}" loading="lazy" style="display:block;width:100%;aspect-ratio:16/9;border:0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>${video.title ? `<p style="margin:0;padding:12px 16px;font-weight:800">${escapeHtml(String(video.title))}</p>` : ''}</article>`; }).join('');
  const tracks = list('tracks').filter(isRecord).map((track) => `<article class="track"><strong>${escapeHtml(String(track.title ?? ''))}</strong><button data-track="${escapeAttribute(String(track.id ?? ''))}">Écouter</button></article>`).join('');
  const photoItems = list('photos').filter(isRecord).map((photo) => `<figure style="flex:0 0 100%;margin:0;scroll-snap-align:start"><img loading="lazy" src="/media/preview/${escapeAttribute(String(photo.previewAssetId ?? ''))}" alt="${escapeAttribute(String(photo.caption || `${name} — photo presse`))}"></figure>`).join('');
  const photoCount = list('photos').filter(isRecord).length;
  const photos = photoItems ? `<div data-photo-carousel><div data-photo-track style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none">${photoItems}</div>${photoCount > 1 ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px"><button type="button" data-photo-prev>Précédente</button><span data-photo-position aria-live="polite">1 / ${photoCount}</span><button type="button" data-photo-next>Suivante</button></div>` : ''}</div>${PHOTO_CAROUSEL_SCRIPT}` : '';
  const documents = list('documents').filter(isRecord).map((document) => `<button data-document="${escapeAttribute(String(document.assetId ?? ''))}">${escapeHtml(String(document.title ?? 'Document'))}</button>`).join('');
  const contacts = list('contacts').filter(isRecord).map((contact) => `<article class="contact"><strong>${escapeHtml(String(contact.name ?? ''))}</strong><span>${escapeHtml(String(contact.role ?? ''))}</span>${typeof contact.email === 'string' ? `<a href="mailto:${escapeAttribute(contact.email)}">E-mail</a>` : ''}</article>`).join('');
  const links = list('links').filter(isRecord).map((link) => `<a class="link" target="_blank" rel="noreferrer" href="${escapeAttribute(String(link.url ?? ''))}">${escapeHtml(String(link.label ?? 'Lien'))} ↗</a>`).join('');
  const editorial = isRecord(snapshot.editorial) ? snapshot.editorial : {};
  const editorialValue = (key: string, fallback: string) => typeof editorial[key] === 'string' ? editorial[key] : fallback;
  const facts = Array.isArray(editorial.facts) ? editorial.facts.filter(isRecord).map((fact) => `<article class="fact"><small>${escapeHtml(String(fact.title ?? ''))}</small><strong>${escapeHtml(String(fact.value ?? ''))}</strong></article>`).join('') : '';
  const section = (id: string, heading: string, content: string) => content ? `<section id="epk-${id}"><h2>${heading}</h2>${content}</section>` : '';

  const sectionRenderers: Record<string, () => string> = {
    bio: () => section('bio', editorialValue('bioTitle', 'Biographie'), `${value('fullBio') ? `<p>${escapeHtml(value('fullBio'))}</p>` : ''}${facts}`),
    musique: () => section('musique', editorialValue('musicTitle', 'À écouter'), `${tracks}${links}`),
    medias: () => section('medias', 'Vidéos &amp; Photos', `${videos}${photos}`),
    espacePro: () => section('espace-pro', editorialValue('proTitle', 'Espace pro'), `${editorialValue('proDescription', '')}${documents}`),
    contact: () => section('contact', editorialValue('contactTitle', 'Contact'), contacts),
  };

  const hidden = new Set(list('hiddenSections').filter((item): item is string => typeof item === 'string'));
  const rawOrder = list('sectionOrder').filter((item): item is string => typeof item === 'string');
  const defaultOrder = ['bio', 'musique', 'medias', 'espacePro', 'contact'];
  const orderedSections = (rawOrder.length ? rawOrder : defaultOrder)
    .filter((sec) => sec !== 'banniere' && !hidden.has(sec))
    .map((sec) => sectionRenderers[sec]?.() ?? '')
    .join('');

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — EPK</title><meta name="description" content="${description}"><link rel="canonical" href="${escapeHtml(url.href)}"><meta property="og:type" content="profile"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${escapeHtml(url.href)}"><meta name="twitter:card" content="summary"><style>:root{color-scheme:dark;--accent:${accent}}*{box-sizing:border-box}body{margin:0;background:#09090b;color:#fff;font:16px Inter,Segoe UI,sans-serif}header{min-height:80vh;padding:32px max(24px,calc((100% - 1280px)/2));display:flex;flex-direction:column;justify-content:end;background:${heroBackground}}nav{position:absolute;top:24px;left:24px;right:24px;display:flex;justify-content:space-between;font-weight:800}main{margin:auto;max-width:1280px}h1{max-width:12ch;margin:20px 0 0;font-size:clamp(3rem,11vw,8rem);font-weight:900;line-height:.9;letter-spacing:-.05em;text-transform:uppercase}h2{margin:8px 0 28px;font-size:clamp(2rem,6vw,3rem);font-weight:900}.genres{display:flex;flex-wrap:wrap;gap:8px}.genres span,.link{border:1px solid #ffffff3a;border-radius:999px;padding:6px 10px}section{padding:80px 24px;border-bottom:1px solid #27272a}.video,.track,.contact{display:flex;min-height:64px;align-items:center;justify-content:space-between;gap:14px;margin:10px 0;padding:16px;border:1px solid #3f3f46;border-radius:12px;background:#18181b;color:#fff}.video:first-letter{color:var(--accent)}button{min-height:44px;border:0;border-radius:8px;padding:10px 14px;background:var(--accent);color:#09090b;font:inherit;font-weight:900}figure{display:inline-block;width:calc(50% - 8px);margin:4px}img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}.link{display:inline-flex;margin:4px;color:#fff}.fact{display:inline-flex;flex-direction:column;gap:4px;min-width:150px;margin:8px;padding:16px;border:1px solid #27272a;border-radius:12px;background:#18181b}.fact small{color:#a1a1aa;text-transform:uppercase;font-size:.68rem}footer{padding:32px;text-align:center;color:#aab1bd}@media(min-width:760px){section{padding:112px 40px}figure{width:calc(33.333% - 8px)}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}</style></head><body><header><h1>${title}</h1>${value('tagline') ? `<p>${escapeHtml(value('tagline'))}</p>` : ''}${location ? `<p>${location}</p>` : ''}<div class="genres">${genres}</div></header><main>${orderedSections}</main><footer>Propulsé par <strong>FaderZero</strong></footer><script>document.querySelectorAll('[data-track]').forEach(function(b){b.addEventListener('click',async function(){var r=await fetch('/api/public/${encodeURIComponent(epk.slug)}/tracks/'+b.dataset.track+'/session',{method:'POST'});if(r.ok){var a=document.createElement('audio');a.controls=true;a.src=(await r.json()).url;b.replaceWith(a);a.play()}})});document.querySelectorAll('[data-document]').forEach(function(b){b.addEventListener('click',async function(){var r=await fetch('/api/public/${encodeURIComponent(epk.slug)}/documents/'+b.dataset.document+'/session',{method:'POST'});if(r.ok)location.assign((await r.json()).url)})})</script></body></html>`;
}

function publicHeaders(contentType: string): Headers { return new Headers({ 'content-type': contentType, 'cache-control': 'public, max-age=60, s-maxage=300', 'content-security-policy': "default-src 'none'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; base-uri 'none'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' }); }
function unavailable(): Response { return new Response('<!doctype html><title>EPK indisponible</title><h1>EPK indisponible</h1>', { status: 404, headers: publicHeaders('text/html; charset=utf-8') }); }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character); }
function escapeAttribute(value: string): string { return escapeHtml(value).replace(/`/g, '&#096;'); }
function isEpkRow(value: unknown): value is EpkRow { return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).id === 'string' && typeof (value as Record<string, unknown>).display_name === 'string' && Array.isArray((value as Record<string, unknown>).genres) && Array.isArray((value as Record<string, unknown>).epk_contacts) && Array.isArray((value as Record<string, unknown>).epk_videos) && Array.isArray((value as Record<string, unknown>).epk_links) && Array.isArray((value as Record<string, unknown>).epk_photos) && Array.isArray((value as Record<string, unknown>).epk_documents) && Array.isArray((value as Record<string, unknown>).epk_tracks); }
function isPublicAsset(value: unknown): value is PublicAsset { return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).storage_path === 'string' && typeof (value as Record<string, unknown>).mime_type === 'string' && typeof (value as Record<string, unknown>).kind === 'string'; }
function isPublicTrack(value: unknown): value is PublicTrack { return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).audio_asset_id === 'string' && isPublicAsset((value as Record<string, unknown>).epk_assets); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }

async function verifyMediaSignature(assetId: string, expires: number, signature: string, secret: string): Promise<boolean> {
  const expectedBytes = hexToBytes(await signMedia(assetId, expires, secret));
  if (!expectedBytes) return false;
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  let difference = 0;
  for (let index = 0; index < expectedBytes.byteLength; index += 1) difference |= expectedBytes[index]! ^ Number.parseInt(signature.slice(index * 2, index * 2 + 2), 16);
  return difference === 0;
}

async function signMedia(assetId: string, expires: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${expires}:${assetId}`)));
  return Array.from(signature, (value) => value.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): Uint8Array | null { return /^[0-9a-f]+$/i.test(value) && value.length % 2 === 0 ? Uint8Array.from(value.match(/.{2}/g) ?? [], (part) => Number.parseInt(part, 16)) : null; }
