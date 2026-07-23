export interface WorkerEnv extends Cloudflare.Env {
  URL_SIGNING_SECRET: string;
  SUPABASE_SECRET_KEY?: string;
}

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 300;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_SEGMENT_PATTERN = /^[a-zA-Z0-9._-]+$/;
const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
]);
const MAX_AUDIT_BATCH_SIZE = 1000;

interface AuthenticatedUser {
  id: string;
  accessToken: string;
}

interface ObjectKeyDetails {
  key: string;
  workspaceId: string;
}

type WorkspaceRole = 'admin' | 'member' | 'guest';

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    try {
      if (!isRequestOriginAllowed(request, env)) {
        return jsonResponse(request, env, { error: 'Origin not allowed' }, 403);
      }

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      }

      const url = new URL(request.url);
      if (url.pathname === '/health' && request.method === 'GET') {
        return jsonResponse(request, env, { status: 'ok' });
      }

      if (url.pathname === '/signed-url' && request.method === 'POST') {
        return await createSignedUrl(request, env);
      }

      if (url.pathname.startsWith('/objects/')) {
        const details = parseObjectKey(url.pathname.slice('/objects/'.length));
        if (!details) {
          return jsonResponse(request, env, { error: 'Invalid object key' }, 400);
        }

        if (request.method === 'PUT') {
          return await uploadObject(request, env, details);
        }

        if (request.method === 'GET' || request.method === 'HEAD') {
          return await serveObject(request, env, details.key);
        }
      }

      return jsonResponse(request, env, { error: 'Not found' }, 404);
    } catch (error) {
      console.error(JSON.stringify({
        message: 'audio worker request failed',
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return jsonResponse(request, env, { error: 'Internal server error' }, 500);
    }
  },
  async scheduled(_controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(auditR2Objects(env));
  },
} satisfies ExportedHandler<WorkerEnv>;

async function uploadObject(
  request: Request,
  env: WorkerEnv,
  details: ObjectKeyDetails
): Promise<Response> {
  const user = await authenticate(request, env);
  if (!user) {
    return jsonResponse(request, env, { error: 'Unauthorized' }, 401);
  }

  const role = await getWorkspaceRole(user, details.workspaceId, env);
  if (role !== 'admin' && role !== 'member') {
    return jsonResponse(request, env, { error: 'Forbidden' }, 403);
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (!Number.isInteger(contentLength) || contentLength <= 0 || contentLength > MAX_AUDIO_BYTES) {
    return jsonResponse(request, env, { error: 'Invalid content length' }, 413);
  }

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (!contentType || !AUDIO_TYPES.has(contentType)) {
    return jsonResponse(request, env, { error: 'Unsupported audio type' }, 415);
  }

  if (!request.body) {
    return jsonResponse(request, env, { error: 'Missing request body' }, 400);
  }

  const reservationId = request.headers.get('x-audio-reservation-id');
  if (!reservationId || !UUID_PATTERN.test(reservationId)) {
    return jsonResponse(request, env, { error: 'Invalid audio reservation' }, 400);
  }

  const claimError = await claimAudioReservation(
    request,
    env,
    user,
    details,
    reservationId,
    contentLength,
  );
  if (claimError) {
    const isLimited = claimError.includes('concurrency') || claimError.includes('rate exceeded');
    return jsonResponse(request, env, { error: claimError }, isLimited ? 429 : 409);
  }

  const validatedBody = await validateAndReplayMp3Body(request.body);
  if (!validatedBody) {
    await releaseAudioReservation(env, user, reservationId);
    return jsonResponse(request, env, { error: 'Invalid MP3 content' }, 415);
  }

  const uploadBody = validatedBody.pipeThrough(new FixedLengthStream(contentLength));

  const onlyIf = new Headers({ 'if-none-match': '*' });
  let object: R2Object | null;
  try {
    object = await env.AUDIO_BUCKET.put(details.key, uploadBody, {
      onlyIf,
      httpMetadata: {
        contentType,
        cacheControl: 'private, max-age=3600',
      },
      customMetadata: {
        workspaceId: details.workspaceId,
        uploadedBy: user.id,
      },
    });
  } catch (error) {
    await releaseAudioReservation(env, user, reservationId);
    throw error;
  }

  if (!object) {
    await releaseAudioReservation(env, user, reservationId);
    return jsonResponse(request, env, { error: 'Object already exists' }, 409);
  }

  return jsonResponse(request, env, {
    key: object.key,
    size: object.size,
    etag: object.httpEtag,
  }, 201);
}

async function claimAudioReservation(
  request: Request,
  env: WorkerEnv,
  user: AuthenticatedUser,
  details: ObjectKeyDetails,
  reservationId: string,
  requestedBytes: number,
): Promise<string | null> {
  const ipHash = await hashIdentifier(
    request.headers.get('cf-connecting-ip') ?? 'unknown',
    env.URL_SIGNING_SECRET,
  );
  const response = await callSupabaseRpc(env, user.accessToken, 'begin_audio_upload', {
    p_reservation_id: reservationId,
    p_workspace_id: details.workspaceId,
    p_requested_bytes: requestedBytes,
    p_ip_hash: ipHash,
  });
  if (response.ok) return null;

  const body: unknown = await response.json().catch(() => null);
  return isRecord(body) && typeof body.message === 'string'
    ? body.message
    : 'audio reservation rejected';
}

async function releaseAudioReservation(
  env: WorkerEnv,
  user: AuthenticatedUser,
  reservationId: string,
): Promise<void> {
  const response = await callSupabaseRpc(env, user.accessToken, 'release_audio_upload_reservation', {
    p_reservation_id: reservationId,
  });
  if (!response.ok) {
    console.error(JSON.stringify({
      message: 'audio reservation release failed',
      reservationId,
      status: response.status,
    }));
  }
}

function callSupabaseRpc(
  env: WorkerEnv,
  accessToken: string,
  functionName: string,
  body: Record<string, unknown>,
) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function auditR2Objects(env: WorkerEnv): Promise<void> {
  if (!env.SUPABASE_SECRET_KEY) {
    console.error(JSON.stringify({ message: 'R2 audit skipped', error: 'SUPABASE_SECRET_KEY missing' }));
    return;
  }

  let cursor: string | undefined;
  let quarantinedCount = 0;
  do {
    const page = await env.AUDIO_BUCKET.list({
      limit: MAX_AUDIT_BATCH_SIZE,
      ...(cursor ? { cursor } : {}),
    });
    if (page.objects.length > 0) {
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/audit_audio_r2_keys`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SECRET_KEY,
          authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ p_r2_keys: page.objects.map((object) => object.key) }),
      });
      if (!response.ok) {
        throw new Error(`R2 audit RPC failed (${response.status})`);
      }
      const count: unknown = await response.json();
      if (typeof count === 'number') quarantinedCount += count;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  console.log(JSON.stringify({ message: 'R2 audit complete', quarantinedCount }));
}

async function createSignedUrl(request: Request, env: WorkerEnv): Promise<Response> {
  const user = await authenticate(request, env);
  if (!user) {
    return jsonResponse(request, env, { error: 'Unauthorized' }, 401);
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.key !== 'string') {
    return jsonResponse(request, env, { error: 'Invalid request body' }, 400);
  }

  const details = parseObjectKey(encodeObjectKey(body.key));
  if (!details) {
    return jsonResponse(request, env, { error: 'Invalid object key' }, 400);
  }

  if (!(await getWorkspaceRole(user, details.workspaceId, env))) {
    return jsonResponse(request, env, { error: 'Forbidden' }, 403);
  }

  if (!(await env.AUDIO_BUCKET.head(details.key))) {
    return jsonResponse(request, env, { error: 'Object not found' }, 404);
  }

  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  const signature = await signObject(details.key, expires, env.URL_SIGNING_SECRET);
  const objectUrl = new URL(`/objects/${encodeObjectKey(details.key)}`, request.url);
  objectUrl.searchParams.set('expires', String(expires));
  objectUrl.searchParams.set('signature', signature);

  return jsonResponse(request, env, {
    signedUrl: objectUrl.toString(),
    expiresAt: new Date(expires * 1000).toISOString(),
  });
}

async function serveObject(request: Request, env: WorkerEnv, key: string): Promise<Response> {
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get('expires'));
  const signature = url.searchParams.get('signature');
  const now = Math.floor(Date.now() / 1000);

  if (
    !Number.isInteger(expires) ||
    expires < now ||
    expires > now + SIGNED_URL_TTL_SECONDS ||
    !signature ||
    !(await verifyObjectSignature(key, expires, signature, env.URL_SIGNING_SECRET))
  ) {
    return jsonResponse(request, env, { error: 'Invalid or expired signature' }, 403);
  }

  const object = await env.AUDIO_BUCKET.get(key, { range: request.headers });
  if (!object) {
    return jsonResponse(request, env, { error: 'Object not found' }, 404);
  }

  const headers = corsHeaders(request, env);
  object.writeHttpMetadata(headers);
  headers.set('accept-ranges', 'bytes');
  headers.set('etag', object.httpEtag);
  headers.set('content-security-policy', "default-src 'none'");
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('cache-control', 'private, no-store');

  let status = 200;
  if (object.range && 'offset' in object.range && 'length' in object.range) {
    const end = object.range.offset + object.range.length - 1;
    headers.set('content-range', `bytes ${object.range.offset}-${end}/${object.size}`);
    headers.set('content-length', String(object.range.length));
    status = 206;
  } else {
    headers.set('content-length', String(object.size));
  }

  return new Response(request.method === 'HEAD' ? null : object.body, { status, headers });
}

async function validateAndReplayMp3Body(body: ReadableStream<Uint8Array>): Promise<ReadableStream<Uint8Array> | null> {
  const reader = body.getReader();
  const firstChunk = await reader.read();
  if (firstChunk.done || !firstChunk.value || !hasMp3FrameHeader(firstChunk.value)) {
    await reader.cancel();
    return null;
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(firstChunk.value);
    },
    async pull(controller) {
      try {
        const next = await reader.read();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

function hasMp3FrameHeader(bytes: Uint8Array): boolean {
  for (let index = 0; index + 1 < bytes.byteLength; index += 1) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const versionBits = second & 0x18;
    const layerBits = second & 0x06;
    if (first === 0xff && (second & 0xe0) === 0xe0 && versionBits !== 0x08 && layerBits !== 0x00) {
      return true;
    }
  }
  return false;
}

async function authenticate(request: Request, env: WorkerEnv): Promise<AuthenticatedUser | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const accessToken = authorization.slice('Bearer '.length);
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization,
    },
  });
  if (!response.ok) {
    return null;
  }

  const body: unknown = await response.json();
  return isRecord(body) && typeof body.id === 'string'
    ? { id: body.id, accessToken }
    : null;
}

async function getWorkspaceRole(
  user: AuthenticatedUser,
  workspaceId: string,
  env: WorkerEnv
): Promise<WorkspaceRole | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/workspace_members`);
  url.searchParams.set('select', 'role');
  url.searchParams.set('workspace_id', `eq.${workspaceId}`);
  url.searchParams.set('user_id', `eq.${user.id}`);
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${user.accessToken}`,
      accept: 'application/json',
    },
  });
  if (!response.ok) {
    return null;
  }

  const body: unknown = await response.json();
  if (!Array.isArray(body) || body.length === 0 || !isRecord(body[0])) {
    return null;
  }

  const role = body[0].role;
  if (role === 'owner') {
    return 'admin';
  }
  return role === 'admin' || role === 'member' || role === 'guest' ? role : null;
}

function parseObjectKey(encodedKey: string): ObjectKeyDetails | null {
  let key: string;
  try {
    key = encodedKey.split('/').map(decodeURIComponent).join('/');
  } catch {
    return null;
  }

  if (!key || key.includes('..') || key.startsWith('/')) {
    return null;
  }

  const parts = key.split('/');
  const workspaceId = parts[1];
  if (parts[0] !== 'workspaces' || !workspaceId || !UUID_PATTERN.test(workspaceId)) {
    return null;
  }

  const isImport = parts.length === 4 && parts[2] === 'imports' && isSafeSegment(parts[3]);
  const isSong =
    parts.length === 5 &&
    parts[2] === 'songs' &&
    isSafeSegment(parts[3]) &&
    isSafeSegment(parts[4]);

  return isImport || isSong ? { key, workspaceId } : null;
}

function isSafeSegment(value: string | undefined): value is string {
  return typeof value === 'string' && SAFE_SEGMENT_PATTERN.test(value);
}

function encodeObjectKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

async function signObject(key: string, expires: number, secret: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(`${expires}:${key}`)
  );
  return bytesToHex(new Uint8Array(signature));
}

async function hashIdentifier(value: string, secret: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function verifyObjectSignature(
  key: string,
  expires: number,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = hexToBytes(await signObject(key, expires, secret));
  const provided = hexToBytes(signature);
  if (!expected || !provided || expected.byteLength !== provided.byteLength) {
    return false;
  }
  return constantTimeEqual(expected, provided);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) {
    return null;
  }
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRequestOriginAllowed(request: Request, env: WorkerEnv): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    return true;
  }
  return env.ALLOWED_ORIGINS.split(',').some((allowed) => matchesOrigin(origin, allowed.trim()));
}

function matchesOrigin(origin: string, allowed: string): boolean {
  if (!allowed.includes('*')) {
    return origin === allowed;
  }
  const [prefix, suffix, unexpected] = allowed.split('*');
  return (
    unexpected === undefined &&
    prefix !== undefined &&
    suffix !== undefined &&
    origin.startsWith(prefix) &&
    origin.endsWith(suffix) &&
    origin.length > prefix.length + suffix.length
  );
}

function corsHeaders(request: Request, env: WorkerEnv): Headers {
  const headers = new Headers({
    'access-control-allow-methods': 'GET, HEAD, PUT, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-audio-reservation-id',
    'access-control-expose-headers': 'content-length, content-range, etag',
    'access-control-max-age': '86400',
    vary: 'Origin',
  });
  const origin = request.headers.get('origin');
  if (origin && isRequestOriginAllowed(request, env)) {
    headers.set('access-control-allow-origin', origin);
  }
  return headers;
}

function jsonResponse(
  request: Request,
  env: WorkerEnv,
  body: Record<string, unknown>,
  status = 200
): Response {
  const headers = corsHeaders(request, env);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return Response.json(body, { status, headers });
}
