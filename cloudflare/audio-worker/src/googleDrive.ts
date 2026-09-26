import type { WorkerEnv } from './index';

export interface GoogleDriveEnv extends WorkerEnv {
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  GOOGLE_TOKEN_ENCRYPTION_KEY: string;
}

interface User {
  id: string;
  token: string;
}

interface ConnectionRow {
  id: string;
  workspace_id: string;
  root_identifier: string;
  provider_metadata: Record<string, unknown>;
  status: string;
}

interface UploadSessionRow {
  id: string;
  workspace_id: string;
  connection_id: string;
  user_id: string;
  logical_key: string;
  object_kind: string;
  mime_type: string;
  size_bytes: number;
  provider_session_uri: string;
  status: string;
}

interface DriveCredentials {
  refreshToken: string;
}

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GOOGLE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleGoogleDriveRequest(request: Request, env: GoogleDriveEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === '/storage/google-drive/oauth/start' && request.method === 'POST') {
    return startOAuth(request, env);
  }
  if (url.pathname === '/storage/google-drive/oauth/callback' && request.method === 'GET') {
    return finishOAuth(request, env);
  }
  if (url.pathname === '/storage/google-drive/upload-sessions' && request.method === 'POST') {
    return createUploadSession(request, env);
  }
  const uploadMatch = url.pathname.match(/^\/storage\/google-drive\/upload-sessions\/([0-9a-f-]{36})\/content$/i);
  if (uploadMatch && request.method === 'PUT') {
    return uploadSessionContent(request, env, uploadMatch[1]!);
  }
  if (url.pathname === '/storage/google-drive/uploads/finalize' && request.method === 'POST') {
    return finalizeUpload(request, env);
  }
  if (url.pathname === '/storage/read-session' && request.method === 'POST') {
    return createReadSession(request, env);
  }
  const contentMatch = url.pathname.match(/^\/storage\/content\/([0-9a-f-]{36})$/i);
  if (contentMatch && (request.method === 'GET' || request.method === 'HEAD')) {
    return serveStorageObject(request, env, contentMatch[1]!);
  }
  if (url.pathname === '/storage/delete' && request.method === 'POST') {
    return deleteStorageObject(request, env);
  }
  if (url.pathname === '/storage/quota' && request.method === 'POST') {
    return getStorageQuota(request, env);
  }
  if (url.pathname === '/storage/health' && request.method === 'POST') {
    return checkStorageHealth(request, env);
  }
  return null;
}

export async function fetchStorageObjectForPublication(env: GoogleDriveEnv, storageObjectId: string): Promise<Response | null> {
  const locations = await serviceRows(env, 'storage_object_locations', {
    select: 'id,storage_object_id,connection_id,provider_id,physical_identifier',
    storage_object_id: `eq.${storageObjectId}`, is_primary: 'eq.true', verification_status: 'eq.verified', limit: '1',
  });
  const location = asLocation(locations[0]);
  if (!location) return null;
  if (location.provider_id === 'faderzero_r2') {
    const object = await env.AUDIO_BUCKET.get(location.physical_identifier);
    if (!object) return null;
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('content-length', String(object.size));
    return new Response(object.body, { headers });
  }
  if (location.provider_id !== 'google_drive') return null;
  const connection = await connectionById(location.connection_id, env);
  const accessToken = connection ? await connectionAccessToken(connection, env) : null;
  if (!accessToken) return null;
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(location.physical_identifier)}?alt=media`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return response.ok ? response : null;
}

async function startOAuth(request: Request, env: GoogleDriveEnv): Promise<Response> {
  const user = await authenticate(request, env);
  if (!user) return json(request, env, { error: 'Unauthorized' }, 401);
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET || !env.GOOGLE_OAUTH_REDIRECT_URI) {
    return json(request, env, { error: 'Google Drive OAuth unavailable' }, 503);
  }
  const body = await request.json().catch(() => null);
  const workspaceId = recordString(body, 'workspaceId');
  const returnTo = recordString(body, 'returnTo') === 'onboarding' ? 'onboarding' : 'settings';
  if (!workspaceId || !UUID.test(workspaceId)) return json(request, env, { error: 'Invalid workspace' }, 400);
  if ((await workspaceRole(user, workspaceId, env)) !== 'admin') return json(request, env, { error: 'Forbidden' }, 403);

  const state = randomBase64Url(32);
  const verifier = randomBase64Url(64);
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const stateHash = bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(state))));
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const stored = await userRpc(env, user.token, 'create_google_drive_oauth_state', {
    p_workspace_id: workspaceId,
    p_state_hash: stateHash,
    p_pkce_verifier: verifier,
    p_expires_at: expiresAt,
    p_return_to: returnTo,
  });
  if (!stored.ok) return json(request, env, { error: 'OAuth state unavailable' }, 502);

  const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.searchParams.set('client_id', env.GOOGLE_OAUTH_CLIENT_ID);
  authorization.searchParams.set('redirect_uri', env.GOOGLE_OAUTH_REDIRECT_URI);
  authorization.searchParams.set('response_type', 'code');
  authorization.searchParams.set('scope', DRIVE_SCOPE);
  authorization.searchParams.set('access_type', 'offline');
  authorization.searchParams.set('prompt', 'consent');
  authorization.searchParams.set('state', state);
  authorization.searchParams.set('code_challenge', challenge);
  authorization.searchParams.set('code_challenge_method', 'S256');
  return json(request, env, { authorizationUrl: authorization.toString(), expiresAt });
}

async function finishOAuth(request: Request, env: GoogleDriveEnv): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!state) return redirectResult(env, null, 'error');
  const stateHash = bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(state))));
  const consumed = await serviceRpc(env, 'consume_google_drive_oauth_state_server', { p_state_hash: stateHash });
  const stateRows = await responseRows(consumed);
  const oauthState = stateRows[0];
  if (!isRecord(oauthState)) return redirectResult(env, null, 'expired');
  const workspaceId = recordString(oauthState, 'workspace_id');
  const userId = recordString(oauthState, 'user_id');
  const verifier = recordString(oauthState, 'pkce_verifier');
  const returnTo = recordString(oauthState, 'return_to') === 'onboarding' ? 'onboarding' : 'settings';
  if (!workspaceId || !userId || !verifier) return redirectResult(env, workspaceId, 'expired', returnTo);
  if (!code || url.searchParams.has('error')) return redirectResult(env, workspaceId, 'error', returnTo);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  const tokenBody: unknown = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok || !isRecord(tokenBody)) return redirectResult(env, workspaceId, 'error', returnTo);
  const accessToken = recordString(tokenBody, 'access_token');
  const refreshToken = recordString(tokenBody, 'refresh_token');
  if (!accessToken || !refreshToken) return redirectResult(env, workspaceId, 'no_refresh_token', returnTo);

  const aboutResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress),storageQuota(limit,usage)', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const about: unknown = await aboutResponse.json().catch(() => null);
  if (!aboutResponse.ok || !isRecord(about)) return redirectResult(env, workspaceId, 'error', returnTo);
  const userInfo = isRecord(about.user) ? about.user : {};
  const quota = isRecord(about.storageQuota) ? about.storageQuota : {};
  const folders = await ensureWorkspaceFolders(accessToken, workspaceId);
  const encrypted = await encryptCredentials({ refreshToken }, env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  const displayName = recordString(userInfo, 'emailAddress') ?? recordString(userInfo, 'displayName') ?? 'Google Drive';
  const saved = await serviceRpc(env, 'upsert_google_drive_connection', {
    p_workspace_id: workspaceId,
    p_connected_by: userId,
    p_root_identifier: folders.root,
    p_display_name: displayName,
    p_provider_metadata: {
      folders,
      accountEmail: recordString(userInfo, 'emailAddress'),
      quotaUsedBytes: numberString(quota.usage),
      quotaLimitBytes: numberString(quota.limit),
    },
    p_encrypted_credentials: encrypted,
    p_encryption_key_version: 1,
  });
  return saved.ok ? redirectResult(env, workspaceId, 'connected', returnTo) : redirectResult(env, workspaceId, 'error', returnTo);
}

async function createUploadSession(request: Request, env: GoogleDriveEnv): Promise<Response> {
  const user = await authenticate(request, env);
  if (!user) return json(request, env, { error: 'Unauthorized' }, 401);
  const body: unknown = await request.json().catch(() => null);
  const workspaceId = recordString(body, 'workspaceId');
  const logicalKey = recordString(body, 'logicalKey');
  const objectKind = recordString(body, 'objectKind');
  const mimeType = recordString(body, 'mimeType')?.toLowerCase();
  const sizeBytes = recordNumber(body, 'sizeBytes');
  const resumedSessionId = recordString(body, 'sessionId');
  if (!workspaceId || !logicalKey || !objectKind || !mimeType || !sizeBytes ||
      !validLogicalKey(workspaceId, logicalKey) || !validUpload(objectKind, mimeType, sizeBytes)) {
    return json(request, env, { error: 'Invalid upload request' }, 400);
  }
  const role = await workspaceRole(user, workspaceId, env);
  if (role !== 'admin' && role !== 'member') return json(request, env, { error: 'Forbidden' }, 403);

  if (resumedSessionId && UUID.test(resumedSessionId)) {
    const session = await loadUploadSession(resumedSessionId, env);
    if (!session || session.user_id !== user.id || session.workspace_id !== workspaceId ||
        session.logical_key !== logicalKey || session.size_bytes !== sizeBytes) {
      return json(request, env, { error: 'Upload session unavailable' }, 409);
    }
    const probe = await fetch(session.provider_session_uri, {
      method: 'PUT',
      headers: { 'content-length': '0', 'content-range': `bytes */${sizeBytes}` },
    });
    if (probe.ok) {
      const completed: unknown = await probe.json().catch(() => null);
      const physicalIdentifier = recordString(completed, 'id');
      if (!physicalIdentifier) return json(request, env, { error: 'Completed upload receipt unavailable' }, 502);
      return json(request, env, {
        providerId: 'google_drive', sessionId: session.id, workspaceId, logicalKey,
        resumableSessionUri: session.provider_session_uri,
        confirmedBytes: sizeBytes, completedPhysicalIdentifier: physicalIdentifier,
      });
    }
    if (probe.status !== 308) return json(request, env, { error: 'Upload session expired' }, 410);
    return json(request, env, {
      providerId: 'google_drive', sessionId: session.id, workspaceId, logicalKey,
      resumableSessionUri: session.provider_session_uri,
      confirmedBytes: confirmedUploadBytes(probe.headers.get('range')),
    });
  }

  const connection = await defaultGoogleConnection(workspaceId, env);
  if (!connection) return json(request, env, { error: 'Google Drive is not configured' }, 409);
  const accessToken = await connectionAccessToken(connection, env);
  if (!accessToken) return json(request, env, { error: 'Google Drive authorization expired' }, 401);
  const folderId = folderForObject(connection.provider_metadata, objectKind);
  if (!folderId) return json(request, env, { error: 'Google Drive folder unavailable' }, 409);
  const driveResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-length': String(sizeBytes),
      'x-upload-content-type': mimeType,
    },
    body: JSON.stringify({
      name: logicalKey.split('/').at(-1) ?? 'faderzero-file',
      mimeType,
      parents: [folderId],
      // Google Drive limits each app-property key/value pair to 124 UTF-8 bytes.
      // A full FaderZero logical key can exceed that limit, while workspace ownership
      // remains sufficient for the post-upload verification below.
      appProperties: { faderzeroWorkspaceId: workspaceId },
    }),
  });
  const sessionUri = driveResponse.headers.get('location');
  if (!driveResponse.ok || !sessionUri) return driveError(request, env, driveResponse);
  const expiresAt = new Date(Date.now() + 55 * 60_000).toISOString();
  const stored = await serviceRpc(env, 'create_storage_upload_session', {
    p_workspace_id: workspaceId,
    p_connection_id: connection.id,
    p_user_id: user.id,
    p_logical_key: logicalKey,
    p_object_kind: objectKind,
    p_mime_type: mimeType,
    p_size_bytes: sizeBytes,
    p_provider_session_uri: sessionUri,
    p_expires_at: expiresAt,
  });
  const sessionId = await scalarResponse(stored);
  if (!stored.ok || typeof sessionId !== 'string') return json(request, env, { error: 'Upload session unavailable' }, 502);
  return json(request, env, {
    providerId: 'google_drive', sessionId, workspaceId, logicalKey,
    resumableSessionUri: sessionUri, confirmedBytes: 0, expiresAt,
  }, 201);
}

async function uploadSessionContent(request: Request, env: GoogleDriveEnv, sessionId: string): Promise<Response> {
  const user = await authenticate(request, env);
  if (!user) return json(request, env, { error: 'Unauthorized' }, 401);
  const session = await loadUploadSession(sessionId, env);
  if (!session || session.user_id !== user.id || session.status !== 'created') {
    return json(request, env, { error: 'Upload session unavailable' }, 404);
  }
  const role = await workspaceRole(user, session.workspace_id, env);
  if (role !== 'admin' && role !== 'member') return json(request, env, { error: 'Forbidden' }, 403);
  const range = request.headers.get('content-range');
  const match = range?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
  const start = Number(match?.[1]);
  const end = Number(match?.[2]);
  const total = Number(match?.[3]);
  const length = end - start + 1;
  if (!match || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < 0 || end < start || total !== session.size_bytes || end !== total - 1 ||
      length > MAX_FILE_BYTES || !request.body ||
      request.headers.get('content-type')?.split(';', 1)[0]?.toLowerCase() !== session.mime_type ||
      (request.headers.has('content-length') && Number(request.headers.get('content-length')) !== length)) {
    return json(request, env, { error: 'Invalid upload content' }, 400);
  }
  const sessionUrl = new URL(session.provider_session_uri);
  if (sessionUrl.origin !== 'https://www.googleapis.com' || sessionUrl.pathname !== '/upload/drive/v3/files') {
    return json(request, env, { error: 'Invalid provider session' }, 409);
  }
  const connection = await connectionById(session.connection_id, env);
  if (!connection) return json(request, env, { error: 'Storage connection unavailable' }, 409);
  const accessToken = await connectionAccessToken(connection, env);
  if (!accessToken) return json(request, env, { error: 'Google Drive token renewal failed' }, 401);
  const upstream = await fetch(sessionUrl, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': session.mime_type,
      'content-length': String(length),
      'content-range': match[0],
    },
    body: request.body.pipeThrough(new FixedLengthStream(length)),
  });
  if (!upstream.ok) return driveError(request, env, upstream);
  const result: unknown = await upstream.json().catch(() => null);
  const physicalIdentifier = recordString(result, 'id');
  if (!physicalIdentifier) return json(request, env, { error: 'Google Drive upload response invalid' }, 502);
  return json(request, env, { physicalIdentifier });
}

async function finalizeUpload(request: Request, env: GoogleDriveEnv): Promise<Response> {
  const user = await authenticate(request, env);
  if (!user) return json(request, env, { error: 'Unauthorized' }, 401);
  const body: unknown = await request.json().catch(() => null);
  const sessionId = recordString(body, 'sessionId');
  const physicalIdentifier = recordString(body, 'physicalIdentifier');
  const contentHash = recordString(body, 'contentHash');
  if (!sessionId || !UUID.test(sessionId) || !physicalIdentifier) return json(request, env, { error: 'Invalid finalization' }, 400);
  const session = await loadUploadSession(sessionId, env);
  if (!session || session.user_id !== user.id) return json(request, env, { error: 'Upload session unavailable' }, 404);
  const role = await workspaceRole(user, session.workspace_id, env);
  if (role !== 'admin' && role !== 'member') return json(request, env, { error: 'Forbidden' }, 403);
  const connection = await connectionById(session.connection_id, env);
  if (!connection) return json(request, env, { error: 'Storage connection unavailable' }, 409);
  const accessToken = await connectionAccessToken(connection, env);
  if (!accessToken) return json(request, env, { error: 'Google Drive authorization expired' }, 401);
  const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(physicalIdentifier)}?fields=id,size,mimeType,parents,trashed,md5Checksum,appProperties`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const metadata: unknown = await metadataResponse.json().catch(() => null);
  const expectedFolder = folderForObject(connection.provider_metadata, session.object_kind);
  if (!metadataResponse.ok || !isRecord(metadata) || recordString(metadata, 'id') !== physicalIdentifier ||
      recordString(metadata, 'size') !== String(session.size_bytes) || recordString(metadata, 'mimeType') !== session.mime_type ||
      metadata.trashed === true || !Array.isArray(metadata.parents) || !metadata.parents.includes(expectedFolder)) {
    return json(request, env, { error: 'Uploaded file verification failed' }, 422);
  }
  const properties = isRecord(metadata.appProperties) ? metadata.appProperties : {};
  if (recordString(properties, 'faderzeroWorkspaceId') !== session.workspace_id) {
    return json(request, env, { error: 'Uploaded file does not belong to this workspace' }, 422);
  }
  const finalized = await serviceRpc(env, 'finalize_storage_upload', {
    p_session_id: sessionId,
    p_physical_identifier: physicalIdentifier,
    p_content_hash: contentHash ?? recordString(metadata, 'md5Checksum') ?? null,
  });
  const objectId = await scalarResponse(finalized);
  if (!finalized.ok || typeof objectId !== 'string') return json(request, env, { error: 'Upload finalization failed' }, 502);
  return json(request, env, { storageObjectId: objectId, providerId: 'google_drive', physicalKey: physicalIdentifier });
}

async function createReadSession(request: Request, env: GoogleDriveEnv): Promise<Response> {
  const user = await authenticate(request, env);
  if (!user) return json(request, env, { error: 'Unauthorized' }, 401);
  const body: unknown = await request.json().catch(() => null);
  const workspaceId = recordString(body, 'workspaceId');
  const logicalKey = recordString(body, 'logicalKey');
  const download = isRecord(body) && body.download === true;
  if (!workspaceId || !logicalKey || !validLogicalKey(workspaceId, logicalKey)) return json(request, env, { error: 'Invalid object' }, 400);
  if (!(await workspaceRole(user, workspaceId, env))) return json(request, env, { error: 'Forbidden' }, 403);
  const objects = await serviceRows(env, 'storage_objects', { select: 'id', workspace_id: `eq.${workspaceId}`, logical_key: `eq.${logicalKey}`, limit: '1' });
  const objectId = recordString(objects[0], 'id');
  if (!objectId) return json(request, env, { error: 'Object not found' }, 404);
  const expires = Math.floor(Date.now() / 1000) + 300;
  const signature = await signReadSession(objectId, user.id, expires, download, env.URL_SIGNING_SECRET);
  const url = new URL(`/storage/content/${objectId}`, request.url);
  url.searchParams.set('uid', user.id);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('signature', signature);
  if (download) url.searchParams.set('download', '1');
  return json(request, env, { url: url.toString(), expiresAt: new Date(expires * 1000).toISOString() });
}

async function serveStorageObject(request: Request, env: GoogleDriveEnv, objectId: string): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('uid');
  const expires = Number(url.searchParams.get('expires'));
  const signature = url.searchParams.get('signature');
  const download = url.searchParams.get('download') === '1';
  if (!userId || !UUID.test(objectId) || !Number.isSafeInteger(expires) || expires <= Date.now() / 1000 || !signature ||
      !(await verifyReadSession(objectId, userId, expires, download, signature, env.URL_SIGNING_SECRET))) {
    return json(request, env, { error: 'Read session expired' }, 401);
  }
  const objects = await serviceRows(env, 'storage_objects', { select: 'workspace_id,mime_type,size_bytes,logical_key', id: `eq.${objectId}`, limit: '1' });
  const object = objects[0];
  const workspaceId = recordString(object, 'workspace_id');
  if (!workspaceId || !(await serviceWorkspaceMember(userId, workspaceId, env))) return json(request, env, { error: 'Forbidden' }, 403);
  const locations = await serviceRows(env, 'storage_object_locations', {
    select: 'id,storage_object_id,connection_id,provider_id,physical_identifier',
    storage_object_id: `eq.${objectId}`, is_primary: 'eq.true', verification_status: 'eq.verified', limit: '1',
  });
  const location = asLocation(locations[0]);
  if (!location) return json(request, env, { error: 'Object location unavailable' }, 404);
  const mimeType = recordString(object, 'mime_type') ?? 'application/octet-stream';
  const logicalKey = recordString(object, 'logical_key') ?? 'download';
  if (location.provider_id === 'faderzero_r2') {
    return serveR2Location(request, env, location.physical_identifier, mimeType, logicalKey, download);
  }
  if (location.provider_id !== 'google_drive') return json(request, env, { error: 'Provider unavailable' }, 503);
  const connection = await connectionById(location.connection_id, env);
  if (!connection) return json(request, env, { error: 'Storage connection unavailable' }, 503);
  const accessToken = await connectionAccessToken(connection, env);
  if (!accessToken) return json(request, env, { error: 'Google Drive authorization expired' }, 401);
  const headers = new Headers({ authorization: `Bearer ${accessToken}` });
  const range = request.headers.get('range');
  if (range) headers.set('range', range);
  const upstream = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(location.physical_identifier)}?alt=media`, {
    method: request.method, headers,
  });
  if (!upstream.ok && upstream.status !== 206) return driveError(request, env, upstream);
  return relayProviderResponse(request, env, upstream, mimeType, logicalKey, download);
}

async function deleteStorageObject(request: Request, env: GoogleDriveEnv): Promise<Response> {
  const user = await authenticate(request, env);
  if (!user) return json(request, env, { error: 'Unauthorized' }, 401);
  const body: unknown = await request.json().catch(() => null);
  const workspaceId = recordString(body, 'workspaceId');
  const logicalKey = recordString(body, 'logicalKey');
  if (!workspaceId || !logicalKey || !validLogicalKey(workspaceId, logicalKey)) return json(request, env, { error: 'Invalid object' }, 400);
  if ((await workspaceRole(user, workspaceId, env)) !== 'admin') return json(request, env, { error: 'Forbidden' }, 403);
  const objects = await serviceRows(env, 'storage_objects', { select: 'id', workspace_id: `eq.${workspaceId}`, logical_key: `eq.${logicalKey}`, limit: '1' });
  const objectId = recordString(objects[0], 'id');
  if (!objectId) return new Response(null, { status: 204, headers: cors(request, env) });
  const rows = await serviceRows(env, 'storage_object_locations', { select: 'id,storage_object_id,connection_id,provider_id,physical_identifier', storage_object_id: `eq.${objectId}` });
  let queued = false;
  for (const row of rows) {
    const location = asLocation(row);
    if (!location) continue;
    try {
      if (location.provider_id === 'faderzero_r2') {
        await env.AUDIO_BUCKET.delete(location.physical_identifier);
      } else if (location.provider_id === 'google_drive') {
        const connection = await connectionById(location.connection_id, env);
        const accessToken = connection ? await connectionAccessToken(connection, env) : null;
        if (!accessToken) throw new Error('Google Drive authorization unavailable');
        const deleted = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(location.physical_identifier)}`, {
          method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` },
        });
        if (!deleted.ok && deleted.status !== 404) throw new Error(`Google Drive deletion failed (${deleted.status})`);
      }
      await serviceRpc(env, 'complete_storage_location_deletion', { p_location_id: location.id });
    } catch (error) {
      queued = true;
      await serviceRpc(env, 'enqueue_storage_cleanup', {
        p_storage_object_id: objectId, p_location_id: location.id, p_provider_id: location.provider_id,
        p_error: error instanceof Error ? error.message : 'Provider deletion failed',
      });
    }
  }
  return queued ? json(request, env, { status: 'cleanup_queued' }, 202) : new Response(null, { status: 204, headers: cors(request, env) });
}

async function getStorageQuota(request: Request, env: GoogleDriveEnv): Promise<Response> {
  const context = await authorizedConnectionRequest(request, env);
  if (context instanceof Response) return context;
  const accessToken = await connectionAccessToken(context.connection, env);
  if (!accessToken) return json(request, env, { error: 'Google Drive authorization expired' }, 401);
  const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota(limit,usage)', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(body) || !isRecord(body.storageQuota)) return driveError(request, env, response);
  const used = Number(numberString(body.storageQuota.usage) ?? 0);
  const limit = Number(numberString(body.storageQuota.limit) ?? 0);
  return json(request, env, {
    unit: 'bytes', usedAmount: used, reservedAmount: 0,
    limitAmount: limit, remainingAmount: Math.max(0, limit - used),
  });
}

async function checkStorageHealth(request: Request, env: GoogleDriveEnv): Promise<Response> {
  const context = await authorizedConnectionRequest(request, env);
  if (context instanceof Response) return context;
  const accessToken = await connectionAccessToken(context.connection, env);
  if (!accessToken) return json(request, env, { healthy: false, status: 'authorization_expired' });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(context.connection.root_identifier)}?fields=id,trashed`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = await response.json().catch(() => null);
  return json(request, env, { healthy: response.ok && isRecord(body) && body.trashed !== true, status: response.ok ? 'connected' : 'unavailable' });
}

async function authorizedConnectionRequest(
  request: Request,
  env: GoogleDriveEnv,
): Promise<{ user: User; connection: ConnectionRow } | Response> {
  const user = await authenticate(request, env);
  if (!user) return json(request, env, { error: 'Unauthorized' }, 401);
  const body: unknown = await request.json().catch(() => null);
  const workspaceId = recordString(body, 'workspaceId');
  if (!workspaceId || !(await workspaceRole(user, workspaceId, env))) return json(request, env, { error: 'Forbidden' }, 403);
  const connection = await defaultGoogleConnection(workspaceId, env);
  return connection ? { user, connection } : json(request, env, { error: 'Google Drive is not configured' }, 409);
}

async function ensureWorkspaceFolders(accessToken: string, workspaceId: string): Promise<Record<string, string>> {
  const root = await findOrCreateFolder(accessToken, {
    name: `Faderzero ${workspaceId.slice(0, 8)}`,
    properties: { faderzeroWorkspaceId: workspaceId, faderzeroFolderKind: 'root' },
  });
  const [audio, epk, documents] = await Promise.all([
    findOrCreateFolder(accessToken, { name: 'Audio', parent: root, properties: { faderzeroWorkspaceId: workspaceId, faderzeroFolderKind: 'audio' } }),
    findOrCreateFolder(accessToken, { name: 'EPK', parent: root, properties: { faderzeroWorkspaceId: workspaceId, faderzeroFolderKind: 'epk' } }),
    findOrCreateFolder(accessToken, { name: 'Documents', parent: root, properties: { faderzeroWorkspaceId: workspaceId, faderzeroFolderKind: 'documents' } }),
  ]);
  return { root, audio, epk, documents };
}

async function findOrCreateFolder(
  accessToken: string,
  input: { name: string; parent?: string; properties: Record<string, string> },
): Promise<string> {
  const q = [
    `mimeType='${GOOGLE_FOLDER_MIME}'`,
    'trashed=false',
    ...Object.entries(input.properties).map(([key, value]) => `appProperties has { key='${driveQuery(key)}' and value='${driveQuery(value)}' }`),
    ...(input.parent ? [`'${driveQuery(input.parent)}' in parents`] : []),
  ].join(' and ');
  const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
  listUrl.searchParams.set('q', q);
  listUrl.searchParams.set('spaces', 'drive');
  listUrl.searchParams.set('fields', 'files(id)');
  listUrl.searchParams.set('pageSize', '1');
  const listed = await fetch(listUrl, { headers: { authorization: `Bearer ${accessToken}` } });
  const listBody: unknown = await listed.json().catch(() => null);
  if (!listed.ok) throw new Error(`Google Drive folder lookup failed (${listed.status})`);
  if (isRecord(listBody) && Array.isArray(listBody.files)) {
    const existingId = recordString(listBody.files[0], 'id');
    if (existingId) return existingId;
  }
  const created = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      mimeType: GOOGLE_FOLDER_MIME,
      appProperties: input.properties,
      ...(input.parent ? { parents: [input.parent] } : {}),
    }),
  });
  const createBody: unknown = await created.json().catch(() => null);
  const id = recordString(createBody, 'id');
  if (!created.ok || !id) throw new Error(`Google Drive folder creation failed (${created.status})`);
  return id;
}

async function connectionAccessToken(connection: ConnectionRow, env: GoogleDriveEnv): Promise<string | null> {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) return null;
  const secretResponse = await serviceRpc(env, 'get_storage_connection_secret', { p_connection_id: connection.id });
  const rows = await responseRows(secretResponse);
  const encrypted = recordString(rows[0], 'encrypted_credentials');
  if (!secretResponse.ok || !encrypted) return null;
  const credentials = await decryptCredentials(encrypted, env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body: unknown = await response.json().catch(() => null);
  const token = recordString(body, 'access_token');
  if (!response.ok || !token) {
    if (recordString(body, 'error') !== 'invalid_grant') return null;
    await servicePatch(env, 'workspace_storage_connections', { id: `eq.${connection.id}` }, { status: 'authorization_expired', last_health_check_at: new Date().toISOString() });
    return null;
  }
  return token;
}

async function encryptCredentials(credentials: DriveCredentials, keyMaterial: string): Promise<string> {
  const key = await encryptionKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(credentials));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  const packed = new Uint8Array(1 + iv.length + ciphertext.length);
  packed[0] = 1;
  packed.set(iv, 1);
  packed.set(ciphertext, 13);
  return bytesToBase64(packed);
}

async function decryptCredentials(value: string, keyMaterial: string): Promise<DriveCredentials> {
  const packed = base64ToBytes(value);
  if (packed[0] !== 1 || packed.length < 30) throw new Error('Unsupported encrypted credentials');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: packed.slice(1, 13) }, await encryptionKey(keyMaterial), packed.slice(13));
  const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));
  const refreshToken = recordString(parsed, 'refreshToken');
  if (!refreshToken) throw new Error('Invalid encrypted credentials');
  return { refreshToken };
}

async function encryptionKey(material: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function authenticate(request: Request, env: GoogleDriveEnv): Promise<User | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization },
  });
  const body: unknown = await response.json().catch(() => null);
  const id = recordString(body, 'id');
  return response.ok && id ? { id, token: authorization.slice(7) } : null;
}

async function workspaceRole(user: User, workspaceId: string, env: GoogleDriveEnv): Promise<'admin' | 'member' | 'guest' | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/workspace_members`);
  url.searchParams.set('select', 'role');
  url.searchParams.set('workspace_id', `eq.${workspaceId}`);
  url.searchParams.set('user_id', `eq.${user.id}`);
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${user.token}` } });
  const rows: unknown = await response.json().catch(() => null);
  const role = Array.isArray(rows) ? recordString(rows[0], 'role') : null;
  if (role === 'owner') return 'admin';
  return role === 'admin' || role === 'member' || role === 'guest' ? role : null;
}

async function serviceWorkspaceMember(userId: string, workspaceId: string, env: GoogleDriveEnv): Promise<boolean> {
  const rows = await serviceRows(env, 'workspace_members', { select: 'user_id', workspace_id: `eq.${workspaceId}`, user_id: `eq.${userId}`, limit: '1' });
  return rows.length > 0;
}

async function defaultGoogleConnection(workspaceId: string, env: GoogleDriveEnv): Promise<ConnectionRow | null> {
  const rows = await serviceRows(env, 'workspace_storage_connections', {
    select: 'id,workspace_id,root_identifier,provider_metadata,status',
    workspace_id: `eq.${workspaceId}`, provider_id: 'eq.google_drive', status: 'eq.connected', is_default: 'eq.true', limit: '1',
  });
  return asConnection(rows[0]);
}

async function connectionById(connectionId: string, env: GoogleDriveEnv): Promise<ConnectionRow | null> {
  const rows = await serviceRows(env, 'workspace_storage_connections', {
    select: 'id,workspace_id,root_identifier,provider_metadata,status', id: `eq.${connectionId}`, limit: '1',
  });
  return asConnection(rows[0]);
}

function asConnection(value: unknown): ConnectionRow | null {
  if (!isRecord(value)) return null;
  const id = recordString(value, 'id');
  const workspaceId = recordString(value, 'workspace_id');
  const rootIdentifier = recordString(value, 'root_identifier');
  const status = recordString(value, 'status');
  if (!id || !workspaceId || !rootIdentifier || !status) return null;
  return { id, workspace_id: workspaceId, root_identifier: rootIdentifier, status, provider_metadata: isRecord(value.provider_metadata) ? value.provider_metadata : {} };
}

function asLocation(value: unknown): (Record<'id' | 'storage_object_id' | 'connection_id' | 'physical_identifier', string> & { provider_id: string }) | null {
  if (!isRecord(value)) return null;
  const id = recordString(value, 'id');
  const storageObjectId = recordString(value, 'storage_object_id');
  const connectionId = recordString(value, 'connection_id');
  const providerId = recordString(value, 'provider_id');
  const physicalIdentifier = recordString(value, 'physical_identifier');
  return id && storageObjectId && connectionId && providerId && physicalIdentifier
    ? { id, storage_object_id: storageObjectId, connection_id: connectionId, provider_id: providerId, physical_identifier: physicalIdentifier }
    : null;
}

async function loadUploadSession(sessionId: string, env: GoogleDriveEnv): Promise<UploadSessionRow | null> {
  const response = await serviceRpc(env, 'get_storage_upload_session', { p_session_id: sessionId });
  const row = (await responseRows(response))[0];
  if (!response.ok || !isRecord(row)) return null;
  const strings = ['id', 'workspace_id', 'connection_id', 'user_id', 'logical_key', 'object_kind', 'mime_type', 'provider_session_uri', 'status'] as const;
  const values = Object.fromEntries(strings.map((key) => [key, recordString(row, key)]));
  const sizeBytes = Number(row.size_bytes);
  if (strings.some((key) => !values[key]) || !Number.isSafeInteger(sizeBytes)) return null;
  return { ...(values as unknown as Omit<UploadSessionRow, 'size_bytes'>), size_bytes: sizeBytes };
}

async function userRpc(env: GoogleDriveEnv, token: string, name: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function serviceRpc(env: GoogleDriveEnv, name: string, body: Record<string, unknown>): Promise<Response> {
  if (!env.SUPABASE_SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY missing');
  return fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function serviceRows(env: GoogleDriveEnv, table: string, filters: Record<string, string>): Promise<unknown[]> {
  if (!env.SUPABASE_SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY missing');
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` } });
  if (!response.ok) throw new Error(`Supabase ${table} lookup failed (${response.status})`);
  const value: unknown = await response.json();
  return Array.isArray(value) ? value : [];
}

async function servicePatch(env: GoogleDriveEnv, table: string, filters: Record<string, string>, body: Record<string, unknown>): Promise<void> {
  if (!env.SUPABASE_SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY missing');
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
  await fetch(url, {
    method: 'PATCH',
    headers: { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function responseRows(response: Response): Promise<unknown[]> {
  const value: unknown = await response.json().catch(() => null);
  return Array.isArray(value) ? value : value === null ? [] : [value];
}

async function scalarResponse(response: Response): Promise<unknown> {
  const value: unknown = await response.json().catch(() => null);
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function folderForObject(metadata: Record<string, unknown>, objectKind: string): string | null {
  const folders = isRecord(metadata.folders) ? metadata.folders : {};
  if (objectKind === 'audio') return recordString(folders, 'audio');
  if (objectKind === 'document') return recordString(folders, 'documents');
  if (objectKind === 'epk_media') return recordString(folders, 'epk');
  return null;
}

function validLogicalKey(workspaceId: string, logicalKey: string): boolean {
  return logicalKey.startsWith(`workspaces/${workspaceId}/`) && !logicalKey.includes('..') && logicalKey.length <= 500;
}

function validUpload(kind: string, mimeType: string, sizeBytes: number): boolean {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return false;
  if (kind === 'audio') return sizeBytes <= MAX_FILE_BYTES && (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3');
  if (kind === 'epk_media') return sizeBytes <= 10 * 1024 * 1024 && ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType);
  return kind === 'document' && sizeBytes <= 15 * 1024 * 1024 && ['application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/x-zip'].includes(mimeType);
}

async function serveR2Location(
  request: Request,
  env: GoogleDriveEnv,
  key: string,
  mimeType: string,
  logicalKey: string,
  download: boolean,
): Promise<Response> {
  const range = request.headers.get('range');
  const object = await env.AUDIO_BUCKET.get(key, range ? { range: new Headers({ range }) } : undefined);
  if (!object) return json(request, env, { error: 'Object not found' }, 404);
  const headers = cors(request, env);
  object.writeHttpMetadata(headers);
  headers.set('content-type', mimeType);
  headers.set('accept-ranges', 'bytes');
  headers.set('etag', object.httpEtag);
  let status = 200;
  if (object.range && 'offset' in object.range && 'length' in object.range) {
    headers.set('content-range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
    headers.set('content-length', String(object.range.length));
    status = 206;
  } else {
    headers.set('content-length', String(object.size));
  }
  if (download) headers.set('content-disposition', contentDisposition(logicalKey));
  return new Response(request.method === 'HEAD' ? null : object.body, { status, headers });
}

function relayProviderResponse(
  request: Request,
  env: GoogleDriveEnv,
  upstream: Response,
  mimeType: string,
  logicalKey: string,
  download: boolean,
): Response {
  const headers = cors(request, env);
  for (const name of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('content-type', upstream.headers.get('content-type') ?? mimeType);
  headers.set('cache-control', 'private, no-store');
  if (download) headers.set('content-disposition', contentDisposition(logicalKey));
  return new Response(request.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers });
}

function contentDisposition(logicalKey: string): string {
  const filename = (logicalKey.split('/').at(-1) ?? 'download').replace(/["\\\r\n]/g, '_');
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function signReadSession(objectId: string, userId: string, expires: number, download: boolean, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${objectId}:${userId}:${expires}:${download ? 1 : 0}`))));
}

async function verifyReadSession(objectId: string, userId: string, expires: number, download: boolean, signature: string, secret: string): Promise<boolean> {
  const expected = await signReadSession(objectId, userId, expires, download, secret);
  if (!/^[0-9a-f]{64}$/i.test(signature) || signature.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  return difference === 0;
}

function confirmedUploadBytes(range: string | null): number {
  const match = range?.match(/^bytes=0-(\d+)$/i);
  return match ? Number(match[1]) + 1 : 0;
}

async function driveError(request: Request, env: GoogleDriveEnv, response: Response): Promise<Response> {
  const status = response.status === 401 || response.status === 403 ? 401 : response.status === 429 ? 429 : response.status === 507 ? 507 : 502;
  const body: unknown = await response.clone().json().catch(() => null);
  const providerMessage = isRecord(body) && isRecord(body.error) ? recordString(body.error, 'message') : undefined;
  return json(request, env, {
    error: status === 401
      ? `Google Drive rejected the request${providerMessage ? `: ${providerMessage}` : ''}`
      : status === 429 ? 'Google Drive rate limit reached' : status === 507 ? 'Google Drive storage is full' : 'Google Drive unavailable',
  }, status);
}

function redirectResult(env: GoogleDriveEnv, workspaceId: string | null, result: string, returnTo: 'settings' | 'onboarding' = 'settings'): Response {
  const url = new URL(returnTo === 'onboarding' ? '/' : '/account', env.APP_URL);
  if (returnTo === 'settings') url.searchParams.set('view', 'group-storage');
  if (workspaceId) url.searchParams.set('workspace', workspaceId);
  url.searchParams.set('storage', result);
  return Response.redirect(url.toString(), 302);
}

function json(request: Request, env: GoogleDriveEnv, body: Record<string, unknown>, status = 200): Response {
  const headers = cors(request, env);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return Response.json(body, { status, headers });
}

function cors(request: Request, env: GoogleDriveEnv): Headers {
  const headers = new Headers({
    'access-control-allow-methods': 'GET, HEAD, PUT, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, range',
    'access-control-expose-headers': 'content-length, content-range, accept-ranges, etag, content-disposition',
    vary: 'Origin',
  });
  const origin = request.headers.get('origin');
  if (origin && env.ALLOWED_ORIGINS.split(',').some((allowed) => matchesOrigin(origin, allowed.trim()))) headers.set('access-control-allow-origin', origin);
  return headers;
}

function matchesOrigin(origin: string, allowed: string): boolean {
  if (!allowed.includes('*')) return origin === allowed;
  const [prefix, suffix, unexpected] = allowed.split('*');
  return unexpected === undefined && prefix !== undefined && suffix !== undefined && origin.startsWith(prefix) && origin.endsWith(suffix) && origin.length > prefix.length + suffix.length;
}

function recordString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  return typeof value[key] === 'string' && value[key] ? value[key] : null;
}

function recordNumber(value: unknown, key: string): number | null {
  if (!isRecord(value) || typeof value[key] !== 'number' || !Number.isSafeInteger(value[key]) || value[key] <= 0) return null;
  return value[key];
}

function numberString(value: unknown): string | null {
  return typeof value === 'string' && /^\d+$/.test(value) ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function randomBase64Url(size: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(size)));
}

function base64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function driveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
