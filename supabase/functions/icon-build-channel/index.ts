import { createClient } from 'npm:@supabase/supabase-js@2.108.2';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return response({ error: 'SERVER_CONFIGURATION_MISSING' }, 503);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return response({ error: 'INVALID_BODY' }, 400); }
  if (typeof body.token !== 'string' || body.token.length !== 64) return response({ error: 'UNAUTHORIZED' }, 401);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (body.action === 'prepare') {
    const { data, error } = await serviceClient.rpc('design_icon_prepare_build', {
      p_token: body.token,
      p_inventory: body.inventory,
      p_revision: typeof body.revision === 'string' ? body.revision : '',
    });
    if (error) return response({ error: error.code === '42501' ? 'UNAUTHORIZED' : 'PREPARE_FAILED' }, error.code === '42501' ? 401 : 500);
    return response(data);
  }
  if (body.action === 'complete') {
    const { error } = await serviceClient.rpc('design_icon_complete_build', {
      p_token: body.token,
      p_publication_id: body.publicationId,
      p_status: body.status,
      p_build_sha: body.buildSha,
      p_error_code: body.errorCode,
    });
    if (error) return response({ error: error.code === '42501' ? 'UNAUTHORIZED' : 'COMPLETE_FAILED' }, error.code === '42501' ? 401 : 500);
    return response({ ok: true });
  }
  return response({ error: 'INVALID_ACTION' }, 400);
});
