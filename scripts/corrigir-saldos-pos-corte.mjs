#!/usr/bin/env node
/**
 * Restaura saldo_inicial do corte 12/08/2026 e recalcula saldo_atual.
 * Regra: saldo = saldo_inicial (abertura) + movimentos desde a data de corte.
 *
 * Uso:
 *   node scripts/corrigir-saldos-pos-corte.mjs --dry-run
 *   node scripts/corrigir-saldos-pos-corte.mjs --apply
 */
import pg from 'pg';

const DATA_CORTE = process.argv.find((a) => a.startsWith('--data-corte='))?.slice(13) || '2026-08-12';
const APPLY = process.argv.includes('--apply');

/** Aberturas acordadas no corte financeiro 12/08/2026 (print da conversa). */
const ABERTURA_CORTE = {
  'Caixa PDV': 0,
  'Caixa Geral': 0,
  'Banco do Brasil': 821.11,
  'CAIXA PJ': 82.05,
  'CAIXA PP': 12377.36,
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toKey(v) {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return new Date(s).toISOString().slice(0, 10);
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

function saldoPosCorte(conta, lancs, movs, dataCorte) {
  const ls = lancsConta(conta, lancs);
  const ms = movsConta(conta.id, movs);
  const skip = idsMovInLanc(lancs);
  let liquido = 0;
  ls.forEach((l) => {
    const k = toKey(l.data_pagamento) || toKey(l.data_vencimento);
    if (k && k >= dataCorte) liquido += deltaLanc(l, conta);
  });
  ms.forEach((m) => {
    if (skip.has(String(m.id))) return;
    const k = toKey(m.created_at);
    if (k && k >= dataCorte) liquido += deltaMov(m);
  });
  return round2(Number(conta.saldo_inicial || 0) + liquido);
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const movsRemover = (await client.query(
      `SELECT m.id, m.tipo, m.valor, m.observacao, m.created_at, c.nome
       FROM movimentos_caixa m
       JOIN contas_financeiras c ON c.id = m.conta_id
       WHERE LEFT(m.created_at::text, 10) >= $1
         AND (
           m.observacao ILIKE 'Corte financeiro%'
           OR (c.nome = 'CAIXA PP' AND m.observacao ILIKE 'Ajuste manual de saldo%')
         )
       ORDER BY c.nome, m.created_at`,
      [DATA_CORTE],
    )).rows;

    const contas = (await client.query(
      `SELECT * FROM contas_financeiras WHERE ativo IS NOT FALSE ORDER BY nome`,
    )).rows;
    let lancs = (await client.query(`SELECT * FROM lancamento_financeiro`)).rows;
    let movs = (await client.query(`SELECT * FROM movimentos_caixa`)).rows;

    console.log(`\nCorreção corte ${DATA_CORTE} (${APPLY ? 'APLICAR' : 'DRY-RUN'})\n`);

    if (movsRemover.length) {
      console.log(`Movimentos de abertura/ajuste a remover (${movsRemover.length}):`);
      movsRemover.forEach((m) => {
        console.log(`  ${m.nome}: ${m.created_at.toISOString().slice(0, 16)} ${m.tipo} R$ ${fmt(m.valor)} | ${m.observacao}`);
      });
      const removeIds = new Set(movsRemover.map((m) => m.id));
      movs = movs.filter((m) => !removeIds.has(m.id));
    }

    console.log('\nConta'.padEnd(28), 'ini SQL'.padStart(12), '→ abertura'.padStart(12), 'atual SQL'.padStart(12), '→ saldo'.padStart(12));
    console.log('-'.repeat(80));

    const updates = [];
    for (const conta of contas) {
      const aberturaAlvo = ABERTURA_CORTE[conta.nome];
      const contaCalc = {
        ...conta,
        saldo_inicial: aberturaAlvo != null ? aberturaAlvo : Number(conta.saldo_inicial || 0),
      };
      const novo = saldoPosCorte(contaCalc, lancs, movs, DATA_CORTE);
      const atual = round2(Number(conta.saldo_atual || 0));
      const iniSql = round2(Number(conta.saldo_inicial || 0));
      updates.push({
        conta,
        novo,
        atual,
        iniSql,
        iniAlvo: contaCalc.saldo_inicial,
        corrigeIni: aberturaAlvo != null && Math.abs(iniSql - aberturaAlvo) > 0.01,
      });
      console.log(
        conta.nome.slice(0, 27).padEnd(28),
        fmt(iniSql).padStart(12),
        fmt(contaCalc.saldo_inicial).padStart(12),
        fmt(atual).padStart(12),
        fmt(novo).padStart(12),
      );
    }

    if (APPLY) {
      await client.query('BEGIN');
      for (const m of movsRemover) {
        await client.query(`DELETE FROM movimentos_caixa WHERE id = $1`, [m.id]);
      }
      if (movsRemover.length) {
        console.log(`\n✓ ${movsRemover.length} movimento(s) de abertura/ajuste removidos.`);
      }
      for (const u of updates) {
        if (u.corrigeIni) {
          await client.query(
            `UPDATE contas_financeiras SET saldo_inicial = $1, updated_at = NOW() WHERE id = $2`,
            [u.iniAlvo, u.conta.id],
          );
        }
        await client.query(
          `UPDATE contas_financeiras SET saldo_atual = $1, updated_at = NOW() WHERE id = $2`,
          [u.novo, u.conta.id],
        );
      }
      await client.query('COMMIT');
      console.log('\n✓ saldo_inicial e saldo_atual actualizados.');
    } else {
      console.log('\nNada gravado. Repita com --apply para executar.');
    }
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
