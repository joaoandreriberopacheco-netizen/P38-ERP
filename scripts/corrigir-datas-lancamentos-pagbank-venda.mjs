#!/usr/bin/env node
/**
 * Lançamentos na conta PagBank: alinhar datas à data da venda (PV), não ao dia da migração.
 *
 *   npm run financeiro:corrigir-datas-pagbank-venda           # dry-run
 *   npm run financeiro:corrigir-datas-pagbank-venda:apply     # gravar (só após confirmação)
 *
 * Secrets: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (p38-supabase-admin.mjs)
 */
import { requireP38SupabaseAdmin } from './p38-supabase-admin.mjs';
import { camposLancamentoPagBankPago } from './lib/pagbank-lancamento-pago.mjs';

const apply = process.argv.includes('--apply');

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

function isPagBankConta(conta) {
  const n = norm(conta?.nome);
  return n.includes('pagbank') || (n.includes('pag') && n.includes('bank'));
}

function refPedidoVenda(lanc) {
  return String(lanc?.referencia_numero || lanc?.dados?.referencia_numero || '').trim().toUpperCase();
}

function extrairRefPv(lanc) {
  const col = refPedidoVenda(lanc);
  if (/^PV-\d+/i.test(col)) return col.toUpperCase();
  const m = String(lanc?.descricao || lanc?.dados?.descricao || '').match(/PV-\d+/i);
  return m ? m[0].toUpperCase() : '';
}

/** Espelho de p38_pedido_venda_sale_date / resolveDataVendaMargemKey. */
function dataVendaPedido(pv) {
  const dados = pv?.dados && typeof pv.dados === 'object' ? pv.dados : {};
  for (const field of ['data_venda', 'data_emissao', 'data_fechamento']) {
    const raw = pv?.[field] ?? dados[field];
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }
  }
  const created = pv?.created_at || dados?.created_at;
  if (created) {
    const s = String(created);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }
  return null;
}

function pickDatasLanc(l) {
  return {
    data_lancamento: l?.data_lancamento ?? l?.dados?.data_lancamento ?? null,
    data_vencimento: (l?.data_vencimento ?? l?.dados?.data_vencimento ?? null)?.toString?.().slice(0, 10)
      ?? l?.data_vencimento ?? null,
    data_pagamento: (l?.data_pagamento ?? l?.dados?.data_pagamento ?? null)?.toString?.().slice(0, 10)
      ?? l?.data_pagamento ?? null,
    data_liquidacao_prevista: (l?.data_liquidacao_prevista ?? l?.dados?.data_liquidacao_prevista ?? null)
      ?.toString?.()
      .slice(0, 10) ?? l?.data_liquidacao_prevista ?? null,
  };
}

function diaChave(val) {
  if (!val) return null;
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function patchDatasVenda(dataVendaKey) {
  const dia = String(dataVendaKey || '').slice(0, 10);
  if (!dia) return null;
  return {
    data_lancamento: `${dia}T12:00:00-05:00`,
    data_vencimento: dia,
    ...camposLancamentoPagBankPago(dia),
  };
}

const supabase = requireP38SupabaseAdmin();

const { data: contas, error: errContas } = await supabase.from('contas_financeiras').select('id,nome');
if (errContas) {
  console.error(errContas.message);
  process.exit(1);
}

const pagBank = (contas || []).find(isPagBankConta);
if (!pagBank) {
  console.error('Conta PagBank não encontrada.');
  process.exit(1);
}

const { data: lancs, error: errLan } = await supabase
  .from('lancamento_financeiro')
  .select(
    'id,descricao,referencia_numero,forma_pagamento_tipo,valor,valor_liquido,conta_financeira_nome,data_lancamento,data_vencimento,data_pagamento,data_liquidacao_prevista,referencia_id,dados',
  )
  .eq('conta_financeira_id', pagBank.id);

if (errLan) {
  console.error(errLan.message);
  process.exit(1);
}

const lista = (lancs || []).map((l) => ({ l, ref: extrairRefPv(l) })).filter((x) => x.ref);

const refs = [...new Set(lista.map((x) => x.ref))];
const pvByNumero = new Map();

if (refs.length) {
  const { data: pvs, error: errPv } = await supabase
    .from('pedido_venda')
    .select('id,numero,dados,created_at')
    .in('numero', refs);

  if (errPv) {
    console.error('pedido_venda:', errPv.message);
    process.exit(1);
  }
  for (const pv of pvs || []) {
    if (pv?.numero) pvByNumero.set(String(pv.numero).toUpperCase(), pv);
  }
}

const plano = [];
const semPedido = [];
const semDataVenda = [];

for (const { l, ref } of lista) {
  const pv = pvByNumero.get(ref);
  if (!pv) {
    semPedido.push({ id: l.id, ref, descricao: l.descricao });
    continue;
  }
  const dataVenda = dataVendaPedido(pv);
  if (!dataVenda) {
    semDataVenda.push({ id: l.id, ref, pedido_id: pv.id });
    continue;
  }
  const antes = pickDatasLanc(l);
  const depoisPatch = patchDatasVenda(dataVenda);
  const depois = {
    data_lancamento: depoisPatch.data_lancamento,
    data_vencimento: depoisPatch.data_vencimento,
    data_pagamento: depoisPatch.data_pagamento,
    data_liquidacao_prevista: depoisPatch.data_liquidacao_prevista,
  };
  const mudaria =
    diaChave(antes.data_vencimento) !== depois.data_vencimento
    || diaChave(antes.data_pagamento) !== depois.data_pagamento
    || diaChave(antes.data_liquidacao_prevista) !== depois.data_liquidacao_prevista
    || diaChave(antes.data_lancamento) !== depois.data_vencimento;

  plano.push({
    id: l.id,
    ref,
    descricao: l.descricao,
    valor: l.valor_liquido ?? l.valor,
    pedido_venda_id: pv.id,
    dados: l.dados,
    antes,
    depois,
    mudaria,
  });
}

const aAlterar = plano.filter((p) => p.mudaria);

const relatorio = {
  contaPagBank: { id: pagBank.id, nome: pagBank.nome },
  totalLancamentosPagBankComPv: lista.length,
  totalPlano: plano.length,
  totalAlterar: aAlterar.length,
  semPedido,
  semDataVenda,
  apply,
  alteracoes: aAlterar,
};

console.log(JSON.stringify(relatorio, null, 2));

if (!apply) {
  console.log(
    `\nDry-run: ${aAlterar.length} lançamento(s) com datas diferentes da venda. Use :apply após confirmar.`,
  );
  process.exit(0);
}

if (!aAlterar.length) {
  console.log('Nada a gravar.');
  process.exit(0);
}

let gravados = 0;
const erros = [];

for (const item of aAlterar) {
  const basePatch = patchDatasVenda(item.depois.data_vencimento);
  const patch = {
    ...basePatch,
    dados: {
      ...(item.dados && typeof item.dados === 'object' ? item.dados : {}),
      data_lancamento: basePatch.data_lancamento,
      data_vencimento: basePatch.data_vencimento,
      data_pagamento: basePatch.data_pagamento,
      data_liquidacao_prevista: basePatch.data_liquidacao_prevista,
      datas_alinhadas_venda_pv: item.ref,
    },
  };
  const { error } = await supabase.from('lancamento_financeiro').update(patch).eq('id', item.id);
  if (error) erros.push({ id: item.id, ref: item.ref, erro: error.message });
  else gravados += 1;
}

console.log(JSON.stringify({ gravados, erros }, null, 2));
