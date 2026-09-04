import { gerarCupomESCPOS } from './escpos/cupom-venda.mjs';
import { sendToPrinter } from './printer-tcp.mjs';

function mergeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  if (out.dados && typeof out.dados === 'object') {
    Object.assign(out, out.dados);
    delete out.dados;
  }
  if (out.total != null && out.valor_total == null) out.valor_total = out.total;
  if (out.created_at && !out.created_date) out.created_date = out.created_at;
  return out;
}

function buildHeaders({ supabaseUrl, supabaseAnonKey, accessToken, agentToken }) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey,
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (agentToken) headers['x-p38-agent-token'] = agentToken;
  return headers;
}

export async function validateAccessToken({ supabaseUrl, supabaseAnonKey, accessToken }) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: buildHeaders({ supabaseUrl, supabaseAnonKey, accessToken }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id ? data : null;
}

export async function fetchPedidoCupom({ supabaseUrl, supabaseAnonKey, accessToken, pedidoId }) {
  const headers = buildHeaders({ supabaseUrl, supabaseAnonKey, accessToken });
  const pedidoRes = await fetch(
    `${supabaseUrl}/rest/v1/pedido_venda?id=eq.${encodeURIComponent(pedidoId)}&select=*`,
    { headers },
  );
  if (!pedidoRes.ok) {
    throw new Error(`Pedido HTTP ${pedidoRes.status}`);
  }
  const pedidos = await pedidoRes.json();
  if (!Array.isArray(pedidos) || !pedidos.length) {
    throw new Error('Pedido não encontrado');
  }

  const empresaRes = await fetch(`${supabaseUrl}/rest/v1/dados_empresa?select=*&limit=1`, { headers });
  let dadosEmpresa = null;
  if (empresaRes.ok) {
    const empresas = await empresaRes.json();
    dadosEmpresa = empresas?.[0] ? mergeRow(empresas[0]) : null;
  }

  return {
    pedido: mergeRow(pedidos[0]),
    dadosEmpresa: dadosEmpresa ? mergeRow(dadosEmpresa) : null,
  };
}

export async function printPedidoCupom({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
  pedidoId,
  ipImpressora,
  porta = 9100,
}) {
  const { pedido, dadosEmpresa } = await fetchPedidoCupom({
    supabaseUrl,
    supabaseAnonKey,
    accessToken,
    pedidoId,
  });
  const escpos = gerarCupomESCPOS(pedido, dadosEmpresa);
  const buffer = Buffer.from(escpos, 'latin1');
  const result = await sendToPrinter(ipImpressora, porta, buffer);
  return { ...result, pedido_numero: pedido.numero };
}

export async function pollRemoteJobs({ supabaseUrl, supabaseAnonKey, agentToken }) {
  const res = await fetch(`${supabaseUrl}/functions/v1/print-agent`, {
    method: 'POST',
    headers: buildHeaders({
      supabaseUrl,
      supabaseAnonKey,
      accessToken: supabaseAnonKey,
      agentToken,
    }),
    body: JSON.stringify({ action: 'poll' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Poll HTTP ${res.status}`);
  return data;
}

export async function ackRemoteJob({
  supabaseUrl,
  supabaseAnonKey,
  agentToken,
  jobId,
  success,
  error,
}) {
  const res = await fetch(`${supabaseUrl}/functions/v1/print-agent`, {
    method: 'POST',
    headers: buildHeaders({
      supabaseUrl,
      supabaseAnonKey,
      accessToken: supabaseAnonKey,
      agentToken,
    }),
    body: JSON.stringify({
      action: 'ack',
      job_id: jobId,
      success,
      error,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ack HTTP ${res.status}`);
  return data;
}

export async function fetchPedidoWithAgentToken({
  supabaseUrl,
  supabaseAnonKey,
  agentToken,
  pedidoId,
}) {
  const headers = buildHeaders({ supabaseUrl, supabaseAnonKey, agentToken });
  const pedidoRes = await fetch(
    `${supabaseUrl}/rest/v1/pedido_venda?id=eq.${encodeURIComponent(pedidoId)}&select=*`,
    { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` } },
  );
  if (!pedidoRes.ok) throw new Error(`Pedido HTTP ${pedidoRes.status}`);
  const pedidos = await pedidoRes.json();
  if (!pedidos?.length) throw new Error('Pedido não encontrado');

  const empresaRes = await fetch(`${supabaseUrl}/rest/v1/dados_empresa?select=*&limit=1`, {
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
  });
  const empresas = empresaRes.ok ? await empresaRes.json() : [];

  return {
    pedido: mergeRow(pedidos[0]),
    dadosEmpresa: empresas?.[0] ? mergeRow(empresas[0]) : null,
  };
}

export async function printRemoteJob({
  supabaseUrl,
  supabaseAnonKey,
  agentToken,
  job,
  defaultPrinterHost,
  defaultPrinterPort,
}) {
  const host = job.ip_impressora || defaultPrinterHost;
  const port = Number(job.porta || defaultPrinterPort || 9100);
  if (!host) throw new Error('IP da impressora não configurado no job nem no agente');

  const { pedido, dadosEmpresa } = await fetchPedidoWithAgentToken({
    supabaseUrl,
    supabaseAnonKey,
    agentToken,
    pedidoId: job.pedido_id,
  });

  const escpos = gerarCupomESCPOS(pedido, dadosEmpresa);
  const buffer = Buffer.from(escpos, 'latin1');
  return sendToPrinter(host, port, buffer);
}
