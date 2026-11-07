#!/usr/bin/env node
/**
 * Reassign credit-card sales from Banco do Brasil → PagBank from 2026-11-06 (corte).
 *
 *   npm run migrar:cartao-credito-pagbank              # dry-run
 *   npm run migrar:cartao-credito-pagbank -- --apply   # update rows
 */
import { requireP38SupabaseScriptClient } from './p38-supabase-script-client.mjs';

const DATA_CORTE = '2026-11-06';
const apply = process.argv.includes('--apply');

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

const { supabase } = requireP38SupabaseScriptClient();

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

const rows = (candidatos || []).filter((l) => {
  const fpt = l.forma_pagamento_tipo || l.dados?.forma_pagamento_tipo || '';
  return fpt === 'Cartão Crédito' || fpt === 'Cartão de Crédito' || String(fpt).includes('Crédito');
});

const dia6 = rows.filter((l) => String(l.data_vencimento || l.dados?.data_vencimento || '').slice(0, 10) === DATA_CORTE);

const report = {
  dataCorte: DATA_CORTE,
  apply,
  contaBancoBrasil: { id: bbId, nome: bb.nome },
  contaPagBank: pagBank ? { id: pagId, nome: pagBank.nome } : null,
  totalEncontrados: rows.length,
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

console.log(JSON.stringify({ reaplicados: updated, dia06: dia6.length }, null, 2));
