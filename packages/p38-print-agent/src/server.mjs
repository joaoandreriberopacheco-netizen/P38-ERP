import http from 'http';
import { URL } from 'url';
import { resolveConfig } from './config.mjs';
import {
  ackRemoteJob,
  pollRemoteJobs,
  printPedidoCupom,
  printRemoteJob,
  validateAccessToken,
} from './print-service.mjs';

function json(res, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-P38-Agent-Token',
    'Access-Control-Allow-Private-Network': 'true',
    ...extraHeaders,
  });
  res.end(data);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

export function startPrintAgentServer() {
  const cfg = resolveConfig();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${cfg.port}`);

    if (req.method === 'OPTIONS') {
      json(res, 204, {});
      return;
    }

    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        json(res, 200, {
          ok: true,
          name: 'p38-print-agent',
          version: '1.0.0',
          agent_id: cfg.agentId || null,
          has_agent_token: Boolean(cfg.agentToken),
          printer_host: cfg.printerHost || null,
          poll_enabled: Boolean(cfg.agentToken && cfg.supabaseUrl),
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/print/cupom') {
        if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
          json(res, 503, {
            error: 'Supabase não configurado no agente',
            hint: 'Defina P38_SUPABASE_URL e P38_SUPABASE_ANON_KEY',
          });
          return;
        }

        const auth = String(req.headers.authorization || '');
        const accessToken = auth.replace(/^Bearer\s+/i, '').trim();
        if (!accessToken) {
          json(res, 401, { error: 'Authorization Bearer em falta' });
          return;
        }

        const user = await validateAccessToken({
          supabaseUrl: cfg.supabaseUrl,
          supabaseAnonKey: cfg.supabaseAnonKey,
          accessToken,
        });
        if (!user) {
          json(res, 401, { error: 'Sessão inválida ou expirada' });
          return;
        }

        const body = await readJson(req);
        const pedido_id = String(body.pedido_id || '').trim();
        const ip_impressora = String(body.ip_impressora || cfg.printerHost || '').trim();
        const porta = Number(body.porta || cfg.printerPort || 9100);

        if (!pedido_id) {
          json(res, 400, { error: 'pedido_id é obrigatório' });
          return;
        }
        if (!ip_impressora) {
          json(res, 400, { error: 'ip_impressora é obrigatório' });
          return;
        }

        const result = await printPedidoCupom({
          supabaseUrl: cfg.supabaseUrl,
          supabaseAnonKey: cfg.supabaseAnonKey,
          accessToken,
          pedidoId: pedido_id,
          ipImpressora: ip_impressora,
          porta,
        });

        json(res, 200, {
          success: true,
          message: 'Cupom enviado para impressora térmica',
          bytes_enviados: result.bytes,
          pedido_numero: result.pedido_numero,
        });
        return;
      }

      json(res, 404, { error: 'Not found', hint: 'GET /health | POST /print/cupom' });
    } catch (error) {
      console.error('[p38-print-agent]', error);
      json(res, 500, { error: String(error?.message || error) });
    }
  });

  server.listen(cfg.port, '127.0.0.1', () => {
    console.log(`[p38-print-agent] http://127.0.0.1:${cfg.port}/health`);
    console.log(`[p38-print-agent] impressora padrão: ${cfg.printerHost || '(não definida)'}:${cfg.printerPort}`);
    if (cfg.agentToken) {
      console.log(`[p38-print-agent] fila remota activa (poll ${cfg.pollIntervalMs}ms)`);
    } else {
      console.log('[p38-print-agent] fila remota inactiva — configure P38_PRINT_AGENT_TOKEN após registar agente');
    }
  });

  return { server, cfg };
}

export function startRemotePoller(cfg) {
  if (!cfg.agentToken || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;

  let busy = false;

  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const data = await pollRemoteJobs({
        supabaseUrl: cfg.supabaseUrl,
        supabaseAnonKey: cfg.supabaseAnonKey,
        agentToken: cfg.agentToken,
      });

      for (const job of data.jobs || []) {
        try {
          await printRemoteJob({
            supabaseUrl: cfg.supabaseUrl,
            supabaseAnonKey: cfg.supabaseAnonKey,
            agentToken: cfg.agentToken,
            job,
            defaultPrinterHost: cfg.printerHost,
            defaultPrinterPort: cfg.printerPort,
          });
          await ackRemoteJob({
            supabaseUrl: cfg.supabaseUrl,
            supabaseAnonKey: cfg.supabaseAnonKey,
            agentToken: cfg.agentToken,
            jobId: job.id,
            success: true,
          });
          console.log(`[p38-print-agent] job ${job.id} impresso (pedido ${job.pedido_id})`);
        } catch (error) {
          console.error(`[p38-print-agent] job ${job.id} falhou:`, error.message);
          await ackRemoteJob({
            supabaseUrl: cfg.supabaseUrl,
            supabaseAnonKey: cfg.supabaseAnonKey,
            agentToken: cfg.agentToken,
            jobId: job.id,
            success: false,
            error: error.message,
          }).catch(() => {});
        }
      }
    } catch (error) {
      console.error('[p38-print-agent] poll:', error.message);
    } finally {
      busy = false;
    }
  };

  tick();
  return setInterval(tick, cfg.pollIntervalMs);
}
