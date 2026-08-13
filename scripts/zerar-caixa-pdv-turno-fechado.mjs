#!/usr/bin/env node
/**
 * Turno fechado com saldo remanescente na Caixa PDV → transfere para Caixa Geral e zera PDV.
 * Uso: node scripts/zerar-caixa-pdv-turno-fechado.mjs [--turno=TC-00128] [--dry-run|--apply]
 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const APPLY = process.argv.includes('--apply');
const turnoNum = process.argv.find((a) => a.startsWith('--turno='))?.slice(8) || 'TC-00128';
const DATA_CORTE = '2026-08-12';

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

function lancParticipaSaldoCaixaPDV(l) {
  if (!l || l.status === 'Cancelado') return false;
  if (l.tipo !== 'Receita' && l.tipo !== 'Despesa') return false;
  if (!(l.status === 'Pago' || l.data_pagamento)) return false;
  if (l.tipo === 'Despesa') return true;
  const fp = String(l.forma_pagamento || '').trim();
  if (fp === 'Dinheiro') return true;
  if (['PIX', 'Cartão de Débito', 'Cartão de Crédito', 'Conta a Pagar', 'Vale Troca'].includes(fp)) return false;
  if (fp) return false;
  return true;
}

function deltaLanc(l) {
  if (!lancParticipaSaldoCaixaPDV(l)) return 0;
  const v = Number(l.valor || 0);
  return l.tipo === 'Receita' ? v : -v;
}

function deltaMov(m) {
  const v = Number(m.valor || 0);
  if (m.tipo === 'Reforço') {
    if (m.status_registro === 'Pendente' || m.status_registro === 'Cancelado') return 0;
    return v;
  }
  if (m.tipo === 'Sangria' || m.tipo === 'Recolhimento de Caixa') return -v;
  return 0;
}

function idsLancEspelhados(lancs, movs) {
  const ids = new Set();
  lancs.forEach((l) => {
    if (l.referencia_tipo === 'MovimentosCaixa' && l.referencia_id) ids.add(String(l.id));
  });
  movs.forEach((m) => {
    if (m.lancamento_financeiro_id) ids.add(String(m.lancamento_financeiro_id));
  });
  return ids;
}

function idsMovInLancDesp(lancs) {
  const ids = new Set();
  lancs.forEach((l) => {
    if (l.referencia_tipo === 'MovimentosCaixa' && l.referencia_id && l.tipo === 'Despesa') {
      ids.add(String(l.referencia_id));
    }
  });
  return ids;
}

function saldoPdvPosCorte(conta, lancs, movs, dataCorte) {
  const esp = idsLancEspelhados(lancs, movs);
  const skipMov = idsMovInLancDesp(lancs);
  let d = Number(conta.saldo_inicial || 0);
  lancs.filter((l) => l.conta_financeira_id === conta.id).forEach((l) => {
    if (esp.has(String(l.id))) return;
    const k = toKey(l.data_pagamento) || toKey(l.data_vencimento);
    if (k && k >= dataCorte) d += deltaLanc(l);
  });
  movs.filter((m) => m.conta_id === conta.id).forEach((m) => {
    if (skipMov.has(String(m.id))) return;
    const k = toKey(m.created_at);
    if (k && k >= dataCorte) d += deltaMov(m);
  });
  return round2(d);
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const turno = (await client.query('SELECT * FROM turno_caixa WHERE numero = $1', [turnoNum])).rows[0];
    if (!turno) throw new Error(`Turno ${turnoNum} não encontrado`);
    if (turno.status !== 'Fechado') throw new Error(`Turno ${turnoNum} ainda não está fechado`);

    const pdv = (await client.query('SELECT * FROM contas_financeiras WHERE id = $1', [turno.conta_caixa_pdv_id])).rows[0];
    const geral = (await client.query('SELECT * FROM contas_financeiras WHERE is_caixa_geral IS TRUE LIMIT 1')).rows[0];
    if (!geral) throw new Error('Caixa Geral não configurada');

    const lancs = (await client.query('SELECT * FROM lancamento_financeiro')).rows;
    let movs = (await client.query('SELECT * FROM movimentos_caixa')).rows;

    const saldoTurno = round2(Number(turno.dinheiro_conferido ?? turno.saldo_final ?? 0));
    const saldoCalc = saldoPdvPosCorte(pdv, lancs, movs, DATA_CORTE);
    const valorTransferir = saldoTurno > 0.009 ? saldoTurno : saldoCalc;

    console.log(`\nZerar Caixa PDV pós-fechamento — ${turnoNum} (${APPLY ? 'APLICAR' : 'DRY-RUN'})\n`);
    console.log(`Turno fechado: ${turno.data_fechamento}`);
    console.log(`Dinheiro conferido no fechamento: R$ ${fmt(saldoTurno)}`);
    console.log(`Saldo PDV calculado (pós-correção):  R$ ${fmt(saldoCalc)}`);
    console.log(`Valor a transferir → Caixa Geral:   R$ ${fmt(valorTransferir)}`);
    console.log(`Caixa Geral atual: R$ ${fmt(geral.saldo_atual)} → R$ ${fmt(+geral.saldo_atual + valorTransferir)}`);

    if (valorTransferir <= 0.009) {
      console.log('\nPDV já está zerada (ou troco insignificante).');
      if (APPLY) {
        await client.query('UPDATE contas_financeiras SET saldo_atual = 0, updated_at = NOW() WHERE id = $1', [pdv.id]);
        console.log('✓ saldo_atual PDV = 0');
      }
      return;
    }

    if (!APPLY) {
      console.log('\nNada gravado. Repita com --apply');
      return;
    }

    await client.query('BEGIN');
    const movId = randomUUID();
    const obs = `Fechamento de turno ${turnoNum} - Transferido para ${geral.nome} (correção retroativa)`;
    const ts = turno.data_fechamento || new Date().toISOString();

    await client.query(
      `INSERT INTO movimentos_caixa (id, dados, created_at, updated_at, tipo, valor, observacao, conta_id, turno_caixa_id, usuario_responsavel_id, usuario_responsavel_nome, status_registro)
       VALUES ($1, '{}'::jsonb, $2::timestamptz, NOW(), 'Sangria', $3, $4, $5, $6, $7, $8, 'Ativo')`,
      [movId, ts, valorTransferir, obs, pdv.id, turno.id, turno.usuario_fechamento_id || 'sistema', turno.usuario_fechamento_nome || 'Correção'],
    );

    const dataRef = toKey(ts);
    const despId = randomUUID();
    const recId = randomUUID();
    await client.query(
      `INSERT INTO lancamento_financeiro (id, dados, created_at, updated_at, tipo, valor, descricao, conta_financeira_id, conta_financeira_nome, data_vencimento, data_pagamento, status, status_conciliacao, categoria, referencia_tipo, referencia_id, observacoes)
       VALUES ($1, '{}'::jsonb, NOW(), NOW(), 'Despesa', $2, $3, $4, $5, $6::date, $6::date, 'Pago', 'N/A', 'Transferência entre Contas', 'MovimentosCaixa', $7, $3)`,
      [despId, valorTransferir, obs, pdv.id, pdv.nome, dataRef, movId],
    );
    await client.query(
      `INSERT INTO lancamento_financeiro (id, dados, created_at, updated_at, tipo, valor, descricao, conta_financeira_id, conta_financeira_nome, data_vencimento, data_pagamento, status, status_conciliacao, categoria, referencia_tipo, referencia_id, observacoes)
       VALUES ($1, '{}'::jsonb, NOW(), NOW(), 'Receita', $2, $3, $4, $5, $6::date, $6::date, 'Pago', 'N/A', 'Transferência entre Contas', 'MovimentosCaixa', $7, $3)`,
      [recId, valorTransferir, `Entrada de ${pdv.nome}: ${obs}`, geral.id, geral.nome, dataRef, movId],
    );

    await client.query(
      `UPDATE contas_financeiras SET saldo_atual = 0, updated_at = NOW() WHERE id = $1`,
      [pdv.id],
    );
    await client.query(
      `UPDATE contas_financeiras SET saldo_atual = COALESCE(saldo_atual, 0) + $1, updated_at = NOW() WHERE id = $2`,
      [valorTransferir, geral.id],
    );

    const movIds = Array.isArray(turno.movimentos_ids) ? [...turno.movimentos_ids, movId] : [movId];
    await client.query(
      `UPDATE turno_caixa SET movimentos_ids = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(movIds), turno.id],
    );

    await client.query('COMMIT');
    console.log('\n✓ Caixa PDV zerada; R$ ' + fmt(valorTransferir) + ' transferido para Caixa Geral.');
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
