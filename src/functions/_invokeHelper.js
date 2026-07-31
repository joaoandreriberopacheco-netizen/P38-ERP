import { p38 } from '@/api/base44Client';
import { isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { invokeP38EdgeFunctionBinary } from '@/lib/p38EdgeFunctionInvoke';

export async function invokeFunction(name, body) {
  const requestContext = p38.createRequestContext({
    channel: 'invokeHelper',
    functionName: name
  });
  // Sempre via legacyClient: com provider=supabase evita p38.functions cair no stub Base44
  // quando o adapter activo não é Supabase (ex.: ANON_KEY ausente no bundle).
  const functionsApi = p38.legacyClient?.functions || p38.functions;
  const response = await functionsApi.invoke(name, body, requestContext);
  if (response && typeof response === 'object' && 'data' in response) {
    return response;
  }
  return { data: response };
}

/**
 * Para funções que devolvem PDF ou outros binários: evita parse/transform do Axios
 * que pode corromper bytes ou falhar ao interpretar o corpo como JSON/texto.
 */
export async function invokeFunctionBinary(name, body) {
  if (isSupabaseBrowserConfigured()) {
    return invokeP38EdgeFunctionBinary(name, body);
  }

  const { getAccessToken } = await import('@base44/sdk');
  const { appParams } = await import('@/lib/app-params');
  const { serverUrl, appId, functionsVersion } = appParams;
  const base = String(serverUrl || '').replace(/\/+$/, '');
  const url = `${base}/api/apps/${encodeURIComponent(appId)}/functions/${encodeURIComponent(name)}`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: '*/*',
    'X-App-Id': String(appId),
  };

  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (functionsVersion) {
    headers['Base44-Functions-Version'] = String(functionsVersion);
  }
  if (typeof window !== 'undefined' && window.location?.href) {
    headers['X-Origin-URL'] = window.location.href;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    let message = `Erro ao chamar ${name} (HTTP ${res.status})`;
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const errJson = await res.json();
        message =
          errJson?.error ||
          errJson?.message ||
          errJson?.detail ||
          (typeof errJson === 'string' ? errJson : message);
      } else {
        const t = await res.text();
        if (t) message = t.slice(0, 500);
      }
    } catch {
      /* mantém message */
    }
    throw new Error(message);
  }

  const data = await res.arrayBuffer();
  return { data };
}
