// Dispara job noturno de fecho de KPI (ontem) — útil para backfill manual.
import { jsonResponse } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Use POST' }, 405);
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (!serviceKey || !supabaseUrl) {
    return jsonResponse({ error: 'Supabase não configurado' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader.replace(/^Bearer\s+/i, '') !== serviceKey) {
    return jsonResponse({ error: 'Não autorizado' }, 401);
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/job_fechar_dashboard_kpi_ontem`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return jsonResponse({ error: data?.message || res.statusText }, res.status);
  }
  return jsonResponse(data);
});
