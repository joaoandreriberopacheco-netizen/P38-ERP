// Agente de impressão térmica: registo, fila remota e poll pelo PC da loja.
import type { createP38Client } from '../p38Client.ts';
import { serviceClient } from '../auth.ts';
import { gerarCupomESCPOS } from './imprimirCupomTermicoEscpos.ts';

const AGENT_TOKEN_HEADER = 'x-p38-agent-token';

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function randomPairingCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return String(n).padStart(6, '0');
}

function normalizePairingCode(raw: string) {
  return String(raw || '').replace(/\D/g, '').slice(0, 6);
}

function formatPairingCode(digits: string) {
  const d = normalizePairingCode(digits);
  if (d.length !== 6) return d;
  return `${d.slice(0, 3)}-${d.slice(3)}`;
}

async function loadAgentByToken(token: string) {
  const db = serviceClient();
  const { data, error } = await db
    .from('agente_impressao')
    .select('*')
    .eq('token', token)
    .eq('ativo', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function handle(req: Request, base44: Awaited<ReturnType<typeof createP38Client>>): Promise<Response> {
  const body = await readJson(req);
  const action = String(body?.action || '').trim();
  const db = serviceClient();

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    if (action === 'register') {
      const user = await base44.auth.me();
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const nome = String(body.nome || 'Caixa principal').trim();
      const ip_impressora = body.ip_impressora ? String(body.ip_impressora).trim() : null;
      const porta = Number(body.porta) || 9100;
      const token = body.token ? normalizePairingCode(String(body.token)) : randomPairingCode();
      if (token.length !== 6) {
        return json({ error: 'Código inválido — use 6 dígitos (000-000)' }, 400);
      }

      const { data: existing } = await db
        .from('agente_impressao')
        .select('id')
        .eq('token', token)
        .maybeSingle();

      if (existing?.id) {
        const { data, error } = await db
          .from('agente_impressao')
          .update({
            nome,
            ip_impressora,
            porta,
            ativo: true,
          })
          .eq('id', existing.id)
          .select('id, nome, token, ip_impressora, porta')
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({
          success: true,
          agente: { ...data, codigo: formatPairingCode(data.token) },
        });
      }

      const { data, error } = await db
        .from('agente_impressao')
        .insert({
          nome,
          token,
          ip_impressora,
          porta,
          ativo: true,
        })
        .select('id, nome, token, ip_impressora, porta')
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({
        success: true,
        agente: { ...data, codigo: formatPairingCode(data.token) },
      });
    }

    if (action === 'enqueue') {
      const user = await base44.auth.me();
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const pedido_id = String(body.pedido_id || '').trim();
      const agente_id = String(body.agente_id || '').trim();
      if (!pedido_id) return json({ error: 'pedido_id é obrigatório' }, 400);
      if (!agente_id) return json({ error: 'agente_id é obrigatório' }, 400);

      const { data: agente, error: agenteErr } = await db
        .from('agente_impressao')
        .select('id, ip_impressora, porta, ativo')
        .eq('id', agente_id)
        .maybeSingle();
      if (agenteErr) return json({ error: agenteErr.message }, 500);
      if (!agente || !agente.ativo) return json({ error: 'Agente não encontrado ou inativo' }, 404);

      const ip_impressora = body.ip_impressora
        ? String(body.ip_impressora).trim()
        : (agente.ip_impressora as string | null);
      const porta = Number(body.porta) || Number(agente.porta) || 9100;

      const { data: job, error } = await db
        .from('fila_impressao_termica')
        .insert({
          agente_id,
          pedido_id,
          ip_impressora,
          porta,
          status: 'pending',
          created_by: user.id,
        })
        .select('id, agente_id, pedido_id, status, created_at')
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ success: true, job });
    }

    if (action === 'poll') {
      const token = String(req.headers.get(AGENT_TOKEN_HEADER) || body.token || '').trim();
      if (!token) return json({ error: 'Token do agente em falta' }, 401);

      const agente = await loadAgentByToken(token);
      if (!agente) return json({ error: 'Agente inválido' }, 401);

      await db
        .from('agente_impressao')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', agente.id);

      const { data: jobs, error } = await db
        .from('fila_impressao_termica')
        .select('id, pedido_id, ip_impressora, porta, created_at')
        .eq('agente_id', agente.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(5);

      if (error) return json({ error: error.message }, 500);

      if (jobs?.length) {
        const ids = jobs.map((j) => j.id);
        await db
          .from('fila_impressao_termica')
          .update({ status: 'processing' })
          .in('id', ids);
      }

      return json({
        success: true,
        agente_id: agente.id,
        jobs: jobs || [],
        default_printer: {
          ip_impressora: agente.ip_impressora,
          porta: agente.porta,
        },
      });
    }

    if (action === 'ack') {
      const token = String(req.headers.get(AGENT_TOKEN_HEADER) || body.token || '').trim();
      if (!token) return json({ error: 'Token do agente em falta' }, 401);

      const agente = await loadAgentByToken(token);
      if (!agente) return json({ error: 'Agente inválido' }, 401);

      const job_id = String(body.job_id || '').trim();
      const ok = body.success !== false;
      const error_message = body.error ? String(body.error) : null;
      if (!job_id) return json({ error: 'job_id é obrigatório' }, 400);

      const { error } = await db
        .from('fila_impressao_termica')
        .update({
          status: ok ? 'done' : 'failed',
          error_message,
          processed_at: new Date().toISOString(),
        })
        .eq('id', job_id)
        .eq('agente_id', agente.id);

      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (action === 'preview-escpos') {
      const user = await base44.auth.me();
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const pedido_id = String(body.pedido_id || '').trim();
      if (!pedido_id) return json({ error: 'pedido_id é obrigatório' }, 400);

      const pedidos = await base44.entities.PedidoVenda.filter({ id: pedido_id });
      if (!pedidos?.length) return json({ error: 'Pedido não encontrado' }, 404);
      const pedido = pedidos[0];

      const empresas = await base44.entities.DadosEmpresa.list();
      const dadosEmpresa = empresas?.length ? empresas[0] : null;
      const escpos = gerarCupomESCPOS(pedido, dadosEmpresa);

      return json({
        success: true,
        bytes: escpos.length,
        escpos_base64: btoa(escpos),
      });
    }

    return json({ error: 'action inválida', hint: 'register | enqueue | poll | ack | preview-escpos' }, 400);
  } catch (error) {
    console.error('[printAgent]', error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
