#!/usr/bin/env node
/**
 * Reassign credit-card sales from Banco do Brasil → PagBank from 2026-11-06 (corte).
 *
 *   npm run financeiro:migrar-cartao-credito-pagbank              # dry-run
 *   npm run financeiro:migrar-cartao-credito-pagbank:apply       # update rows
 *
 * Exclusões (não migram para PagBank):
 *   --exclude=PV-05055   (repetível)
 *   env PAGBANK_MIGRAR_EXCLUIR_REFS=PV-05055,PV-99999
 *   + lista padrão EXCLUIR_REFS_MIGRACAO_PAGBANK (PV-05055 — já pago no BB, decisão negócio).
 *
 * Secrets: NEXT_PUBLIC_SUPABASE_URL (ou VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 */
import { requireP38SupabaseAdmin } from './p38-supabase-admin.mjs';

/** PV já liquidado no BB — manter fora da migração PagBank (06/11/2026). */
export const EXCLUIR_REFS_MIGRACAO_PAGBANK = Object.freeze(['PV-05055']);

const DATA_CORTE = '2026-11-06';
const apply = process.argv.includes('--apply');

function parseExcluirReferencias() {
  const fromEnv = (process.env.PAGBANK_MIGRAR_EXCLUIR_REFS || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const fromArgv = process.argv
    .filter((a) => a.startsWith('--exclude='))
    .map((a) => a.slice('--exclude='.length).trim().toUpperCase())
    .filter(Boolean);
  return [...new Set([...EXCLUIR_REFS_MIGRACAO_PAGBANK.map((r) => r.toUpperCase()), ...fromEnv, ...fromArgv])];
}

function refPedidoVenda(lanc) {
  return String(lanc?.referencia_numero || lanc?.dados?.referencia_numero || '').trim().toUpperCase();
}

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

function isPagBank(conta) {
  const n = norm(conta?.nome);
  return n.includes('pagbank') || (n.includes('pag') && n.includes('bank'));
}

function isBancoBrasil(conta) {
  const n = norm(conta?.nome);
  return n.includes('brasil') || (n.includes('banco') && n.includes('brasil'));
}

const supabase = requireP38SupabaseAdmin();

const { data: contas, error: errContas } = await supabase.from('contas_financeiras').select('id,nome,ativo');
if (errContas) {
  console.error('Erro ao listar contas:', errContas.message);
  process.exit(1);
}

let pagBank = contas.find(isPagBank);
const bb = contas.find(isBancoBrasil);

if (!pagBank) {
  if (!apply) {
    console.log('PagBank não existe — dry-run assume criação pela migration 117 no deploy.');
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('contas_financeiras')
      .insert({
        nome: 'PagBank',
        tipo: 'Carteira Digital',
        ativo: true,
        saldo_inicial: 0,
        saldo_atual: 0,
        dados: {},
      })
      .select('id,nome')
      .single();
    if (insErr) {
      console.error('Não foi possível criar PagBank:', insErr.message);
      process.exit(1);
    }
    pagBank = inserted;
    console.log('Conta PagBank criada:', pagBank.id);
  }
}

if (!bb) {
  console.error('Conta Banco do Brasil não encontrada.');
  process.exit(1);
}

const bbId = bb.id;
const pagId = pagBank?.id;

const { data: candidatos, error: errLan } = await supabase
  .from('lancamento_financeiro')
  .select(
    'id,descricao,valor,valor_liquido,data_vencimento,data_pagamento,status,status_conciliacao,forma_pagamento_tipo,conta_financeira_id,conta_financeira_nome,referencia_numero,dados',
  )
  .eq('tipo', 'Receita')
  .eq('conta_financeira_id', bbId)
  .gte('data_vencimento', DATA_CORTE)
  .in('forma_pagamento_tipo', ['Cartão Crédito', 'Cartão de Crédito']);

if (errLan) {
  console.error('Erro ao buscar lançamentos:', errLan.message);
  process.exit(1);
}

const excluirRefs = parseExcluirReferencias();

const creditoRows = (candidatos || []).filter((l) => {
  const fpt = l.forma_pagamento_tipo || l.dados?.forma_pagamento_tipo || '';
  return fpt === 'Cartão Crédito' || fpt === 'Cartão de Crédito' || String(fpt).includes('Crédito');
});

const excluidos = creditoRows.filter((l) => excluirRefs.includes(refPedidoVenda(l)));
const rows = creditoRows.filter((l) => !excluirRefs.includes(refPedidoVenda(l)));

const dia6 = rows.filter((l) => String(l.data_vencimento || l.dados?.data_vencimento || '').slice(0, 10) === DATA_CORTE);

const totalLiquidoMigrar = rows.reduce(
  (s, l) => s + Number(l.valor_liquido ?? l.valor ?? 0),
  0,
);

const report = {
  dataCorte: DATA_CORTE,
  apply,
  excluirReferencias: excluirRefs,
  excluidos: excluidos.map((r) => ({
    ref: refPedidoVenda(r),
    data: (r.data_vencimento || '').slice(0, 10),
    valor: r.valor_liquido ?? r.valor,
    status: r.status,
    motivo: 'excluído da migração (referencia_numero)',
  })),
  contaBancoBrasil: { id: bbId, nome: bb.nome },
  contaPagBank: pagBank ? { id: pagId, nome: pagBank.nome } : null,
  totalEncontrados: rows.length,
  totalLiquidoMigrar: Math.round(totalLiquidoMigrar * 100) / 100,
  totalDia06: dia6.length,
  idsDia06: dia6.map((r) => r.id),
  amostra: rows.slice(0, 15).map((r) => ({
    id: r.id,
    data: (r.data_vencimento || '').slice(0, 10),
    valor: r.valor_liquido ?? r.valor,
    status: r.status,
    ref: r.referencia_numero || r.dados?.referencia_numero,
  })),
};

console.log(JSON.stringify(report, null, 2));

if (!apply) {
  console.log('\nAdicione --apply para mover estes lançamentos para PagBank (Pago/Conciliado).');
  process.exit(0);
}

if (!pagId) {
  console.error('PagBank ausente; não é possível aplicar.');
  process.exit(1);
}

let updated = 0;
for (const l of rows) {
  const dv = String(l.data_vencimento || l.dados?.data_vencimento || DATA_CORTE).slice(0, 10);
  const patch = {
    conta_financeira_id: pagId,
    conta_financeira_nome: pagBank.nome || 'PagBank',
    data_pagamento: dv,
    data_liquidacao_prevista: dv,
    status: 'Pago',
    status_conciliacao: 'Conciliado',
  };
  const { error } = await supabase.from('lancamento_financeiro').update(patch).eq('id', l.id);
  if (error) {
    console.error(`Falha ${l.id}:`, error.message);
  } else {
    updated += 1;
  }
}

console.log(
  JSON.stringify({ reaplicados: updated, dia06: dia6.length, excluirReferencias: excluirRefs }, null, 2),
);
