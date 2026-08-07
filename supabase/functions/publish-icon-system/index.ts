import { createClient } from 'npm:@supabase/supabase-js@2.108.2';

const allowedOrigins = new Set([
  'https://faderzero.pages.dev',
  'https://fader.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://faderzero.pages.dev',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json(request, { error: 'SERVER_CONFIGURATION_MISSING' }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json(request, { error: 'UNAUTHENTICATED' }, 401);

  const { data: admin } = await userClient.from('platform_admins').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (!admin) return json(request, { error: 'NOT_FOUND' }, 404);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: deployHookUrl, error: deployHookError } = await serviceClient.rpc('design_icon_deploy_hook');
  if (deployHookError || typeof deployHookUrl !== 'string' || !deployHookUrl.startsWith('https://api.cloudflare.com/')) {
    return json(request, { error: 'DEPLOY_HOOK_CONFIGURATION_MISSING' }, 503);
  }
  const [{ data: roles, error: rolesError }, { data: occurrences, error: occurrencesError }] = await Promise.all([
    serviceClient.from('design_icon_roles').select('key,source_type,icon_name').eq('status', 'approved').order('key'),
    serviceClient.from('design_icon_occurrences').select('usage_id,override_source_type,override_icon_name').not('override_icon_name', 'is', null).order('usage_id'),
  ]);
  if (rolesError || occurrencesError) return json(request, { error: 'CATALOG_READ_FAILED' }, 500);

  const publicationId = crypto.randomUUID();
  const manifest = {
    schemaVersion: 1,
    publicationId,
    roles: Object.fromEntries((roles ?? []).map((role) => [role.key, { sourceType: role.source_type, iconName: role.icon_name }])),
    usageOverrides: Object.fromEntries((occurrences ?? []).map((item) => [item.usage_id, { sourceType: item.override_source_type, iconName: item.override_icon_name }])),
  };
  const sourceRevision = request.headers.get('x-faderzero-revision')?.slice(0, 120) ?? new Date().toISOString();
  const { error: insertError } = await serviceClient.from('design_icon_publications').insert({
    id: publicationId, manifest, requested_by: userData.user.id, source_revision: sourceRevision, status: 'queued',
  });
  if (insertError?.code === '23505') return json(request, { error: 'PUBLICATION_ALREADY_RUNNING' }, 409);
  if (insertError) return json(request, { error: 'PUBLICATION_CREATE_FAILED' }, 500);

  try {
    const hookResponse = await fetch(deployHookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicationId }),
    });
    if (!hookResponse.ok) throw new Error(`Deploy hook returned ${hookResponse.status}`);
  } catch (error) {
    console.error('Cloudflare deploy hook failed', error);
    await serviceClient.from('design_icon_publications').update({ status: 'failed', error_code: 'DEPLOY_HOOK_FAILED', completed_at: new Date().toISOString() }).eq('id', publicationId);
    return json(request, { error: 'DEPLOY_HOOK_FAILED' }, 502);
  }

  return json(request, { publicationId, status: 'queued' }, 202);
});
