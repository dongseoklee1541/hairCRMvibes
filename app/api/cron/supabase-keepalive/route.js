import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
};

function jsonResponse(body, status) {
  return Response.json(body, {
    status,
    headers: responseHeaders,
  });
}

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return jsonResponse({ ok: false, error: 'cron_not_configured' }, 503);
  }

  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return jsonResponse({ ok: false, error: 'supabase_not_configured' }, 503);
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { error } = await supabase
    .from('salon_operation_settings')
    .select('id')
    .eq('id', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Supabase keepalive query failed.', { code: error.code });
    return jsonResponse({ ok: false, error: 'supabase_query_failed' }, 502);
  }

  return jsonResponse({ ok: true }, 200);
}
