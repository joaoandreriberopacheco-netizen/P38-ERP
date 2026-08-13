#!/usr/bin/env node
/**
 * Auditoria: saldo_inicial, saldo_atual, saldo pós-corte e movimentos por conta.
 * Uso: node scripts/auditar-saldos-contas-corte.mjs [--data-corte=2026-08-12]
 */
import pg from 'pg';

const DATA_CORTE = process.argv.find((a) => a.startsWith('--data-corte='))?.slice(13) || '2026-08-12';

function toKey(v) {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return new Date(s).toISOString().slice(0, 10);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function saldoPosCorte(conta, lancs, movs, dataCorte) {
  const full = saldoCompleto(conta, lancs, movs);
  const antes = liquidoPeriodo(conta, lancs, movs, (k) => k < dataCorte);
  return round2(full - antes);
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const contas = (await client.query(
      `SELECT id, nome, tipo, saldo_inicial, saldo_atual, is_caixa_pdv, is_caixa_geral, ativo
       FROM contas_financeiras ORDER BY nome`,
    )).rows;
    const lancs = (await client.query(`SELECT * FROM lancamento_financeiro`)).rows;
    const movs = (await client.query(`SELECT * FROM movimentos_caixa`)).rows;

    console.log(`\n══ Auditoria saldos — corte ${DATA_CORTE} ══\n`);
    console.log(
      'Conta'.padEnd(28),
      'saldo_inicial'.padStart(14),
      'saldo_atual'.padStart(14),
      'calc_full'.padStart(14),
      'pos_corte'.padStart(14),
      'desde_corte'.padStart(14),
      'Δ UI'.padStart(10),
    );
    console.log('-'.repeat(108));

    const divergencias = [];

    for (const conta of contas.filter((c) => c.ativo !== false)) {
      const full = saldoCompleto(conta, lancs, movs);
      const pos = saldoPosCorte(conta, lancs, movs, DATA_CORTE);
      const desde = liquidoPeriodo(conta, lancs, movs, (k) => k >= DATA_CORTE);
      const aberturaImpl = round2(pos - desde);
      const gravado = round2(Number(conta.saldo_atual || 0));
      const deltaUi = round2(gravado - pos);

      console.log(
        conta.nome.slice(0, 27).padEnd(28),
        fmt(conta.saldo_inicial).padStart(14),
        fmt(gravado).padStart(14),
        fmt(full).padStart(14),
        fmt(pos).padStart(14),
        fmt(desde).padStart(14),
        fmt(deltaUi).padStart(10),
      );

      if (Math.abs(gravado - full) > 0.02 || Math.abs(full - pos) > 0.02 && gravado === full) {
        divergencias.push({ conta, gravado, full, pos, aberturaImpl, desde });
      }
    }

    console.log('\n── Abertura implícita no corte (pos_corte − movimentos desde corte) ──\n');
    for (const conta of contas.filter((c) => c.ativo !== false)) {
      const pos = saldoPosCorte(conta, lancs, movs, DATA_CORTE);
      const desde = liquidoPeriodo(conta, lancs, movs, (k) => k >= DATA_CORTE);
      const abertura = round2(pos - desde);
      console.log(`  ${conta.nome}: abertura implícita R$ ${fmt(abertura)} | movimentos desde corte R$ ${fmt(desde)} | saldo agora R$ ${fmt(pos)}`);
    }

    const poupança = contas.find((c) => /poupan/i.test(c.nome));
    if (poupança) {
      console.log(`\n── Detalhe: ${poupança.nome} ──\n`);
      console.log(`  saldo_inicial SQL: R$ ${fmt(poupança.saldo_inicial)}`);
      console.log(`  saldo_atual SQL:   R$ ${fmt(poupança.saldo_atual)}`);
      const ls = lancsConta(poupança, lancs);
      const ms = movsConta(poupança.id, movs);
      console.log(`  Lançamentos vinculados: ${ls.length} | Movimentos caixa: ${ms.length}`);
      const movsCorte = ms.filter((m) => {
        const k = movDataKey(m);
        return k && k >= DATA_CORTE;
      });
      if (movsCorte.length) {
        console.log('  Movimentos desde corte:');
        movsCorte.slice(0, 15).forEach((m) => {
          console.log(`    ${movDataKey(m)} ${m.tipo} R$ ${fmt(m.valor)} — ${m.observacao || ''}`);
        });
      }
      const lancsPos = ls.filter((l) => {
        const k = lancDataKey(l);
        return k && k >= DATA_CORTE;
      });
      if (lancsPos.length) {
        console.log('  Lançamentos desde corte:');
        lancsPos.slice(0, 15).forEach((l) => {
          console.log(`    ${lancDataKey(l)} ${l.tipo} R$ ${fmt(l.valor)} — ${l.descricao || ''}`);
        });
      }
    }

    if (divergencias.length) {
      console.log('\n⚠ Contas com saldo_atual ≠ saldo pós-corte (UI mostra calc, gravado pode confundir):');
      divergencias.forEach((d) => {
        console.log(`  ${d.conta.nome}: saldo_atual=${fmt(d.gravado)} calc_full=${fmt(d.full)} pos_corte=${fmt(d.pos)}`);
      });
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
