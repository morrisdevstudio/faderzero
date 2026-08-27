type WorkerEnv = Omit<Cloudflare.Env, 'SUPABASE_URL'> & {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  MEDIA_SIGNING_SECRET: string;
  MEDIA_BUCKET: R2Bucket;
};

type EpkContact = { name: string; role: string; email: string | null; phone: string | null; whatsapp: string | null };
type EpkVideo = { provider: 'YOUTUBE' | 'VIMEO'; provider_video_id: string; title: string | null; video_type: string; position: number };
type EpkLink = { kind: string; label: string | null; url: string; position: number };
type EpkPhoto = { id: string; preview_asset_id: string; original_asset_id: string; credit: string | null; caption: string | null; position: number };
type EpkDocument = { id: string; asset_id: string; title: string; document_type: string; document_updated_at: string; position: number };
type EpkTrack = { id: string; title: string; description: string | null; visibility: string; position: number; source_type: string; audio_asset_id: string | null };
type EpkRow = { id: string; display_name: string; slug: string; tagline: string | null; short_bio: string | null; full_bio: string | null; city: string | null; country: string | null; genres: string[]; theme: string; status: string; hero_asset_id: string | null; epk_contacts: EpkContact[]; epk_videos: EpkVideo[]; epk_links: EpkLink[]; epk_photos: EpkPhoto[]; epk_documents: EpkDocument[]; epk_tracks: EpkTrack[] };
type PublicAsset = { storage_path: string; mime_type: string; kind: string };
type PublicTrack = { audio_asset_id: string; epk_assets: PublicAsset };
const RESERVED_PAGE_SLUGS = new Set(['account', 'assets', 'booking', 'calendar', 'home', 'imports', 'metronome', 'musiques', 'prompter', 'songs', 'setlists', 'sync']);

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const sessionMatch = url.pathname.match(/^\/api\/public\/([a-z0-9]+(?:-[a-z0-9]+)*)\/tracks\/([0-9a-f-]+)\/session$/);
    if (request.method === 'POST' && sessionMatch) return createTrackSession(request, env, sessionMatch[1]!, sessionMatch[2]!);
    const downloadSessionMatch = url.pathname.match(/^\/api\/public\/([a-z0-9]+(?:-[a-z0-9]+)*)\/documents\/([0-9a-f-]+)\/session$/);
    if (request.method === 'POST' && downloadSessionMatch) return createDocumentSession(request, env, downloadSessionMatch[1]!, downloadSessionMatch[2]!);
    if (request.method === 'GET' && url.pathname.startsWith('/media/preview/')) return servePreview(request, env, url.pathname.slice('/media/preview/'.length));
    if (request.method === 'GET' && url.pathname.startsWith('/media/audio/')) return serveSignedAsset(request, env, url.pathname.slice('/media/audio/'.length), 'audio');
    if (request.method === 'GET' && url.pathname.startsWith('/download/')) return serveSignedAsset(request, env, url.pathname.slice('/download/'.length), 'download');
    if (request.method !== 'GET' || url.pathname.split('/').filter(Boolean).length !== 1) return fetch(request);
    const slug = url.pathname.slice(1);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || RESERVED_PAGE_SLUGS.has(slug)) return fetch(request);
    try {
      const epk = await loadPublishedEpk(slug, env);
      if (!epk) return fetch(request);
      if (url.searchParams.get('format') === 'json') return Response.json(toPublicDto(epk), { headers: publicHeaders('application/json; charset=utf-8') });
      return new Response(renderHtml(epk, url), { headers: publicHeaders('text/html; charset=utf-8') });
    } catch (error) {
      console.error(JSON.stringify({ message: 'epk public request failed', slug, error: error instanceof Error ? error.message : String(error) }));
      return fetch(request);
    }
  },
} satisfies ExportedHandler<WorkerEnv>;

async function loadPublishedEpk(slug: string, env: WorkerEnv): Promise<EpkRow | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/epks`);
  url.searchParams.set('select', 'id,display_name,slug,tagline,short_bio,full_bio,city,country,genres,theme,status,hero_asset_id,epk_contacts(name,role,email,phone,whatsapp),epk_videos(provider,provider_video_id,title,video_type,position),epk_links(kind,label,url,position),epk_photos(id,preview_asset_id,original_asset_id,credit,caption,position),epk_documents(id,asset_id,title,document_type,document_updated_at,position),epk_tracks(id,title,description,visibility,position,source_type,audio_asset_id)');
  url.searchParams.set('slug', `eq.${slug}`); url.searchParams.set('status', 'eq.PUBLISHED'); url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, accept: 'application/json' } });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  const body: unknown = await response.json();
  return Array.isArray(body) && isEpkRow(body[0]) ? body[0] : null;
}

async function loadPublishedAsset(assetId: string, env: WorkerEnv, allowedKinds: string[]): Promise<PublicAsset | null> {
  if (!isUuid(assetId)) return null;
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/epk_assets`);
  url.searchParams.set('select', 'storage_path,mime_type,kind,epks!inner(status)');
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
  if (!Array.isArray(body) || !isPublicTrack(body[0])) return unavailable();
  const expires = Math.floor(Date.now() / 1000) + 300;
  const signature = await signMedia(body[0].audio_asset_id, expires, env.MEDIA_SIGNING_SECRET);
  const audioUrl = new URL(`/media/audio/${body[0].audio_asset_id}`, request.url);
  audioUrl.searchParams.set('expires', String(expires)); audioUrl.searchParams.set('signature', signature);
  return Response.json({ url: audioUrl.toString(), expiresAt: new Date(expires * 1000).toISOString() }, { headers: new Headers({ 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' }) });
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
  const asset = await loadPublishedAsset(assetId, env, ['image_preview', 'logo', 'artwork']);
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
  return { name: epk.display_name, slug: epk.slug, tagline: epk.tagline, shortBio: epk.short_bio, fullBio: epk.full_bio, city: epk.city, country: epk.country, genres: epk.genres, theme: epk.theme, contacts: epk.epk_contacts.map((contact) => ({ name: contact.name, role: contact.role, email: contact.email, phone: contact.phone, whatsapp: contact.whatsapp })), videos: epk.epk_videos.sort((a, b) => a.position - b.position).map((video) => ({ provider: video.provider, id: video.provider_video_id, title: video.title, type: video.video_type })), links: epk.epk_links.sort((a, b) => a.position - b.position).map((link) => ({ kind: link.kind, label: link.label, url: link.url })), photos: epk.epk_photos.sort((a, b) => a.position - b.position).map((photo) => ({ id: photo.id, previewAssetId: photo.preview_asset_id, originalAssetId: photo.original_asset_id, credit: photo.credit, caption: photo.caption })), documents: epk.epk_documents.sort((a, b) => a.position - b.position).map((document) => ({ id: document.id, assetId: document.asset_id, title: document.title, type: document.document_type, updatedAt: document.document_updated_at })), tracks: epk.epk_tracks.filter((track) => track.source_type === 'EPK_ASSET' && track.visibility === 'PUBLIC' && track.audio_asset_id).sort((a, b) => a.position - b.position).map((track) => ({ id: track.id, title: track.title, description: track.description, visibility: track.visibility })) };
}

function renderHtml(epk: EpkRow, url: URL): string {
  const title = escapeHtml(epk.display_name);
  const description = escapeHtml(epk.tagline || epk.short_bio || `${epk.display_name} · ${epk.genres.join(', ')}`);
  const location = [epk.city, epk.country].filter((value): value is string => Boolean(value)).map(escapeHtml).join(' · ');
  const genres = epk.genres.map((genre) => `<span>${escapeHtml(genre)}</span>`).join('');
  const contacts = epk.epk_contacts.map((contact) => `<li><strong>${escapeHtml(contact.name)}</strong> · ${escapeHtml(contact.role)}${contact.email ? ` · <a href="mailto:${escapeAttribute(contact.email)}">E-mail</a>` : ''}${contact.phone ? ` · <a href="tel:${escapeAttribute(contact.phone)}">Téléphone</a>` : ''}${contact.whatsapp ? ` · <a href="https://wa.me/${escapeAttribute(contact.whatsapp.replace(/\D/g, ''))}">WhatsApp</a>` : ''}</li>`).join('');
  const fullBio = epk.full_bio ? `<section><h2>Présentation</h2><p>${escapeHtml(epk.full_bio)}</p></section>` : '';
  const videos = epk.epk_videos.sort((a, b) => a.position - b.position).map((video, index) => {
    const embed = video.provider === 'YOUTUBE' ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.provider_video_id)}` : `https://player.vimeo.com/video/${encodeURIComponent(video.provider_video_id)}`;
    const label = escapeHtml(video.title || video.video_type || 'Vidéo');
    return `<article class="video"><p>${label}</p><button type="button" data-embed="${escapeAttribute(embed)}" data-target="video-${index}">Lire la vidéo</button><div id="video-${index}"></div></article>`;
  }).join('');
  const links = epk.epk_links.sort((a, b) => a.position - b.position).map((link) => `<li><a href="${escapeAttribute(link.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(link.label || link.kind)}</a></li>`).join('');
  const photos = epk.epk_photos.sort((a, b) => a.position - b.position).map((photo) => `<figure><img loading="lazy" src="/media/preview/${escapeAttribute(photo.preview_asset_id)}" alt="${escapeAttribute(photo.caption || `${epk.display_name} — photo`)}">${photo.caption || photo.credit ? `<figcaption>${escapeHtml([photo.caption, photo.credit].filter(Boolean).join(' · '))}</figcaption>` : ''}</figure>`).join('');
  const documents = epk.epk_documents.sort((a, b) => a.position - b.position).map((document) => `<li>${escapeHtml(document.title)} <small>${escapeHtml(document.document_type)} · ${escapeHtml(document.document_updated_at)}</small> <button type="button" data-document="${escapeAttribute(document.asset_id)}">Télécharger</button></li>`).join('');
  const tracks = epk.epk_tracks.filter((track) => track.source_type === 'EPK_ASSET' && track.visibility === 'PUBLIC' && track.audio_asset_id).sort((a, b) => a.position - b.position).map((track) => `<article class="track"><strong>${escapeHtml(track.title)}</strong>${track.description ? `<p>${escapeHtml(track.description)}</p>` : ''}<button type="button" data-track="${escapeAttribute(track.id)}">Écouter</button><audio controls preload="none" hidden></audio></article>`).join('');
  const accent = epk.theme === 'fader-red' ? '#ff3a63' : epk.theme === 'press-ivory' ? '#4b2d18' : epk.theme === 'midnight-blue' ? '#77bdfb' : '#f5f0ea';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — EPK</title><meta name="description" content="${description}"><link rel="canonical" href="${escapeHtml(url.href)}"><meta property="og:type" content="profile"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${escapeHtml(url.href)}"><meta name="twitter:card" content="summary"><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#111;color:#f5f0ea;font:16px system-ui,sans-serif}main{max-width:720px;margin:auto;padding:32px 20px}p{line-height:1.55;color:#d4d4d8}.eyebrow{color:${accent};font-weight:800;text-transform:uppercase;letter-spacing:.12em;font-size:.75rem}.genres{display:flex;flex-wrap:wrap;gap:8px}.genres span{border:1px solid #ffffff33;border-radius:999px;padding:6px 10px;font-size:.85rem}h1{font-size:clamp(2.2rem,10vw,4.5rem);line-height:.95;margin:12px 0}a{color:${accent}}li{margin:.55rem 0}.video,.track{margin:16px 0}.video button,.more-button,.track button,li button{min-height:44px;border:0;border-radius:8px;background:${accent};color:#111;padding:10px 14px;font:inherit;font-weight:700}.video iframe{width:100%;aspect-ratio:16/9;border:0;margin-top:10px}figure{margin:12px 0}figure img{display:block;width:100%;border-radius:10px}figcaption,small{color:#a1a1aa}#full-bio[hidden]{display:none}footer{margin-top:48px;color:#a1a1aa;font-size:.8rem}</style></head><body><main><p class="eyebrow">Electronic press kit</p><h1>${title}</h1><div class="genres">${genres}</div>${location ? `<p>${location}</p>` : ''}${epk.tagline ? `<p>${escapeHtml(epk.tagline)}</p>` : ''}${epk.short_bio ? `<p>${escapeHtml(epk.short_bio)}</p>` : ''}${fullBio ? `<button class="more-button" type="button" data-more>Lire la suite</button><div id="full-bio" hidden>${fullBio}</div>` : ''}${videos ? `<section><h2>Vidéos</h2>${videos}</section>` : ''}${tracks ? `<section><h2>Audio</h2>${tracks}</section>` : ''}${photos ? `<section><h2>Photos</h2>${photos}</section>` : ''}${documents ? `<section><h2>Documents</h2><ul>${documents}</ul></section>` : ''}${contacts ? `<section><h2>Contacts</h2><ul>${contacts}</ul></section>` : ''}${links ? `<section><h2>Liens</h2><ul>${links}</ul></section>` : ''}<footer>Propulsé par FaderZero</footer></main><script>document.querySelectorAll('[data-embed]').forEach(function(button){button.addEventListener('click',function(){var frame=document.createElement('iframe');frame.src=button.dataset.embed;frame.title=button.previousElementSibling.textContent||'Vidéo';frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';frame.allowFullscreen=true;document.getElementById(button.dataset.target).appendChild(frame);button.remove();});});document.querySelectorAll('[data-track]').forEach(function(button){button.addEventListener('click',async function(){var response=await fetch('/api/public/${encodeURIComponent(epk.slug)}/tracks/'+button.dataset.track+'/session',{method:'POST'});if(!response.ok)return;var audio=button.nextElementSibling;audio.src=(await response.json()).url;audio.hidden=false;audio.play();button.remove();});});document.querySelectorAll('[data-document]').forEach(function(button){button.addEventListener('click',async function(){var response=await fetch('/api/public/${encodeURIComponent(epk.slug)}/documents/'+button.dataset.document+'/session',{method:'POST'});if(!response.ok)return;location.assign((await response.json()).url);});});var more=document.querySelector('[data-more]');if(more){more.addEventListener('click',function(){document.getElementById('full-bio').hidden=false;more.remove();});}</script></body></html>`;
}

function publicHeaders(contentType: string): Headers { return new Headers({ 'content-type': contentType, 'cache-control': 'public, max-age=60, s-maxage=300', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; base-uri 'none'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' }); }
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
