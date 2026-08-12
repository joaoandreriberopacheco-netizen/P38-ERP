#!/usr/bin/env node
/**
 * Aplica saldos de abertura no corte financeiro (ajuste Reforço/Sangria).
 *
 * Uso:
 *   node scripts/aplicar-corte-financeiro-saldos.mjs --data-corte=2026-08-12 --dry-run
 *   node scripts/aplicar-corte-financeiro-saldos.mjs --data-corte=2026-08-12 --apply \
 *     --contas="Caixa PDV:0|Caixa Geral:0|Banco do Brasil:821.11"
 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';

function parseBrMoney(raw) {
  const s = String(raw).trim();
  if (!s) return NaN;
  if (s.includes(',')) {
    return Number(s.replace(/\./g, '').replace(',', '.'));
  }
  return Number(s);
}

function parseArgs(argv) {
  const dataCorte = argv.find((a) => a.startsWith('--data-corte='))?.slice(13) || '';
  const dryRun = !argv.includes('--apply');
  const contasArg = argv.find((a) => a.startsWith('--contas='))?.slice(9);
  const contas = contasArg
    ? contasArg.split('|').map((chunk) => {
      const sep = chunk.indexOf(':');
      if (sep <= 0) return null;
      const nome = chunk.slice(0, sep).trim();
      const valor = parseBrMoney(chunk.slice(sep + 1));
      return Number.isFinite(valor) ? { nome, alvo: valor } : null;
    }).filter(Boolean)
    : [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataCorte) || !contas.length) {
    console.error(
      'Uso: node scripts/aplicar-corte-financeiro-saldos.mjs --data-corte=YYYY-MM-DD [--dry-run|--apply] --contas="Caixa PDV:0|Caixa Geral:0|Banco do Brasil:821.11"',
    );
    process.exit(1);
  }
  return { dataCorte, dryRun, contas };
}

function toKey(v) {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return new Date(s).toISOString().slice(0, 10);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function lancParticipaSaldo(l, conta) {
  if (!l || l.status === 'Cancelado') return false;
  if (l.tipo !== 'Receita' && l.tipo !== 'Despesa') return false;
  if (!(l.status === 'Pago' || l.data_pagamento)) return false;
  if (conta?.is_caixa_pdv) {
    if (l.tipo === 'Despesa') return true;
    if (l.tipo === 'Receita') {
      const fp = String(l.forma_pagamento || '').trim();
      if (fp === 'Dinheiro') return true;
      const nonCash = ['PIX', 'Cartão de Débito', 'Cartão de Crédito', 'Conta a Pagar', 'Vale Troca'];
      if (nonCash.includes(fp)) return false;
      const fpt = String(l.forma_pagamento_tipo || '').trim();
      if (['Cartão Débito', 'Cartão Crédito', 'Boleto'].includes(fpt)) return false;
      let tags = l.tags;
      if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch { tags = []; }
      }
      if (Array.isArray(tags) && (tags.includes('CARTAO') || tags.includes('FIADO'))) return false;
      if (fp) return false;
      return true;
    }
  }
  return true;
}

function deltaLanc(l, conta) {
  if (!lancParticipaSaldo(l, conta)) return 0;
  const v = Number(l.valor || 0);
  return l.tipo === 'Receita' ? v : -v;
}

function deltaMov(m) {
  const v = Number(m.valor || 0);
  if (m.tipo === 'Reforço') return v;
  if (m.tipo === 'Sangria' || m.tipo === 'Recolhimento de Caixa') return -v;
  return 0;
}

function movDataKey(m) {
  return toKey(m.data_movimento) || toKey(m.created_at);
}

function lancDataKey(l) {
  return toKey(l.data_pagamento) || toKey(l.data_vencimento);
}

function lancsConta(conta, lancs) {
  if (conta.is_caixa_geral) {
    return lancs.filter((l) => !l.conta_financeira_id || l.conta_financeira_id === conta.id);
  }
  return lancs.filter((l) => l.conta_financeira_id === conta.id);
}

function movsConta(contaId, movs) {
  return movs.filter((m) => m.conta_id === contaId);
}

function idsMovInLanc(lancs) {
  const ids = new Set();
  lancs.forEach((l) => {
    if (l.referencia_tipo === 'MovimentosCaixa' && l.referencia_id && l.tipo === 'Despesa') {
      ids.add(String(l.referencia_id));
    }
  });
  return ids;
}

function saldoCompleto(conta, lancs, movs) {
  const ls = lancsConta(conta, lancs);
  const ms = movsConta(conta.id, movs);
  const skip = idsMovInLanc(lancs);
  let d = Number(conta.saldo_inicial || 0);
  ls.forEach((l) => { d += deltaLanc(l, conta); });
  ms.forEach((m) => { if (!skip.has(String(m.id))) d += deltaMov(m); });
  return round2(d);
}

function liquidoPeriodo(conta, lancs, movs, pred) {
  const ls = lancsConta(conta, lancs);
  const ms = movsConta(conta.id, movs);
  const skip = idsMovInLanc(lancs);
  let d = 0;
  ls.forEach((l) => {
    const k = lancDataKey(l);
    if (k && pred(k)) d += deltaLanc(l, conta);
  });
  ms.forEach((m) => {
    if (skip.has(String(m.id))) return;
    const k = movDataKey(m);
    if (k && pred(k)) d += deltaMov(m);
  });
  return round2(d);
}

function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Início do dia de corte (Tabatinga UTC-5) — antes dos movimentos operacionais. */
function timestampAberturaCorte(dataCorte) {
  return `${dataCorte}T05:00:00.000Z`;
}

async function main() {
  const { dataCorte, dryRun, contas: alvos } = parseArgs(process.argv.slice(2));
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const contasDb = (await client.query(`SELECT * FROM contas_financeiras WHERE ativo IS NOT FALSE`)).rows;
    const lancs = (await client.query(`SELECT * FROM lancamento_financeiro`)).rows;
    const movs = (await client.query(`SELECT * FROM movimentos_caixa`)).rows;
    const byName = Object.fromEntries(contasDb.map((c) => [c.nome, c]));

    const plano = [];
    for (const alvo of alvos) {
      const conta = byName[alvo.nome];
      if (!conta) throw new Error(`Conta não encontrada: ${alvo.nome}`);

      const full = saldoCompleto(conta, lancs, movs);
      const posCorte = round2(full - liquidoPeriodo(conta, lancs, movs, (k) => k < dataCorte));
      const hoje = liquidoPeriodo(conta, lancs, movs, (k) => k >= dataCorte);
      const aberturaImpl = round2(posCorte - hoje);
      const ajuste = round2(alvo.alvo - aberturaImpl);

      plano.push({ conta, alvo: alvo.alvo, full, posCorte, hoje, aberturaImpl, ajuste });
    }

    console.log(`\nCorte financeiro — abertura ${dataCorte} (${dryRun ? 'DRY-RUN' : 'APLICAR'})\n`);
    for (const p of plano) {
      console.log(`${p.conta.nome}`);
      console.log(`  Abertura alvo: R$ ${fmt(p.alvo)} | implícita: R$ ${fmt(p.aberturaImpl)}`);
      if (Math.abs(p.ajuste) < 0.01) {
        console.log('  → Sem ajuste\n');
        continue;
      }
      const tipo = p.ajuste > 0 ? 'Reforço' : 'Sangria';
      console.log(`  → ${tipo} R$ ${fmt(Math.abs(p.ajuste))}\n`);
    }

    if (dryRun) {
      console.log('Nada gravado. Repita com --apply para executar.');
      return;
    }

    await client.query('BEGIN');
    const tsAbertura = timestampAberturaCorte(dataCorte);
    const obs = `Corte financeiro ${dataCorte.split('-').reverse().join('/')} — saldo abertura`;

    for (const p of plano) {
      if (Math.abs(p.ajuste) < 0.01) continue;
      const tipo = p.ajuste > 0 ? 'Reforço' : 'Sangria';
      const valor = Math.abs(p.ajuste);
      const id = randomUUID();
      await client.query(
        `INSERT INTO movimentos_caixa (
          id, dados, created_at, updated_at, tipo, valor, observacao, conta_id,
          usuario_responsavel_id, usuario_responsavel_nome, status_registro
        ) VALUES ($1, '{}'::jsonb, $2::timestamptz, NOW(), $3, $4, $5, $6, $7, $8, 'Ativo')`,
        [id, tsAbertura, tipo, valor, obs, p.conta.id, 'sistema', 'Corte financeiro (agente)'],
      );
    }

    // Recarrega movimentos e persiste saldo_atual alinhado à regra canónica
    const movs2 = (await client.query(`SELECT * FROM movimentos_caixa`)).rows;
    for (const p of plano) {
      const novoSaldo = saldoCompleto(p.conta, lancs, movs2);
      await client.query(`UPDATE contas_financeiras SET saldo_atual = $1, updated_at = NOW() WHERE id = $2`, [
        novoSaldo,
        p.conta.id,
      ]);
      console.log(`Atualizado ${p.conta.nome}: saldo_atual R$ ${fmt(novoSaldo)}`);
    }

    await client.query('COMMIT');
    console.log('\n✓ Ajustes aplicados.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
