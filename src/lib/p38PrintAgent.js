import { resolveP38AccessToken } from '@/lib/supabaseBrowserClient';
import { printAgent } from '@/functions/printAgent';

export const P38_PRINT_AGENT_BASE = 'http://127.0.0.1:3920';
export const LS_AGENT_ID = 'p38_print_agent_id';
export const LS_AGENT_NOME = 'p38_print_agent_nome';

export async function checkPrintAgentHealth(timeoutMs = 1500) {
  try {
    const res = await fetch(`${P38_PRINT_AGENT_BASE}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function printCupomViaLocalAgent({ pedido_id, ip_impressora, porta = 9100 }) {
  const accessToken = await resolveP38AccessToken();
  if (!accessToken) {
    throw new Error('Sessão expirada — entre novamente.');
  }

  const res = await fetch(`${P38_PRINT_AGENT_BASE}/print/cupom`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ pedido_id, ip_impressora, porta }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Agente respondeu HTTP ${res.status}`);
  }
  return data;
}

export async function registerPrintAgent({ token, nome, ip_impressora, porta = 9100 }) {
  const response = await printAgent({
    action: 'register',
    token,
    nome,
    ip_impressora,
    porta,
  });
  const agente = response?.data?.agente;
  if (!agente?.id) {
    throw new Error(response?.data?.error || 'Não foi possível registar o agente');
  }
  localStorage.setItem(LS_AGENT_ID, agente.id);
  if (agente.nome) localStorage.setItem(LS_AGENT_NOME, agente.nome);
  return agente;
}

export async function enqueueRemotePrint({ pedido_id, agente_id, ip_impressora, porta = 9100 }) {
  const id = agente_id || localStorage.getItem(LS_AGENT_ID);
  if (!id) {
    throw new Error('Nenhum agente de impressão ligado à loja.');
  }

  const response = await printAgent({
    action: 'enqueue',
    pedido_id,
    agente_id: id,
    ip_impressora,
    porta,
  });

  if (!response?.data?.success) {
    throw new Error(response?.data?.error || 'Falha ao enfileirar impressão remota');
  }
  return response.data;
}

export function getStoredAgentId() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(LS_AGENT_ID);
  } catch {
    return null;
  }
}

export function getStoredAgentNome() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(LS_AGENT_NOME);
  } catch {
    return null;
  }
}
