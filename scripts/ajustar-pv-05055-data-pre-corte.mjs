#!/usr/bin/env node
/**
 * PV-05055 (Mastercard Moderninha): datas antes do corte 06/11/2026 — não entra no saldo pós-corte.
 *
 *   npm run financeiro:pv-05055-data-pre-corte           # dry-run
 *   npm run financeiro:pv-05055-data-pre-corte:apply     # grava 1 lançamento
 *
 * Secrets: NEXT_PUBLIC_SUPABASE_URL (ou VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 * (ou DATABASE_URL + versão SQL — não incluída; use admin REST).
 */
import { requireP38SupabaseAdmin } from './p38-supabase-admin.mjs';

const REF = 'PV-05055';
const DATA_ALVO = '2026-11-05';
const DATA_LANCAMENTO_ISO = `${DATA_ALVO}T12:00:00-05:00`;
const apply = process.argv.includes('--apply');

function refPedidoVenda(lanc) {
  return String(lanc?.referencia_numero || lanc?.dados?.referencia_numero || '').trim().toUpperCase();
}

function textoLanc(l) {
  return [
    l?.descricao,
    l?.observacoes,
    l?.forma_pagamento,
    l?.forma_pagamento_tipo,
    l?.dados?.maquininha_nome,
    l?.dados?.bandeira,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isAlvo(l) {
  if (refPedidoVenda(l) !== REF) return false;
  const fpt = String(l?.forma_pagamento_tipo || l?.dados?.forma_pagamento_tipo || '');
  const credito = fpt.includes('Crédito') || fpt.includes('Credito');
  if (!credito) return false;
  const t = textoLanc(l);
  const temModerninha = t.includes('moderninha');
  const temMc = t.includes('mastercard');
  return temModerninha || temMc || credito;
}

function pickDatas(l) {
  return {
    data_lancamento: l?.data_lancamento ?? l?.dados?.data_lancamento ?? null,
    data_vencimento: l?.data_vencimento ?? l?.dados?.data_vencimento ?? null,
    data_pagamento: l?.data_pagamento ?? l?.dados?.data_pagamento ?? null,
    data_liquidacao_prevista:
      l?.data_liquidacao_prevista ?? l?.dados?.data_liquidacao_prevista ?? null,
  };
}

const supabase = requireP38SupabaseAdmin();

const { data: rows, error: errList } = await supabase
  .from('lancamento_financeiro')
  .select(
    'id,descricao,observacoes,referencia_numero,forma_pagamento_tipo,valor,valor_liquido,conta_financeira_nome,data_lancamento,data_vencimento,data_pagamento,data_liquidacao_prevista,dados',
  )
  .or(`referencia_numero.eq.${REF},descricao.ilike.%${REF}%`);

if (errList) {
  console.error('Erro ao listar:', errList.message);
  process.exit(1);
}

const candidatos = (rows || []).filter(isAlvo);

if (candidatos.length !== 1) {
  console.error(
    JSON.stringify(
      {
        erro: candidatos.length === 0 ? 'lançamento não encontrado' : 'ambiguidade — vários lançamentos',
        ref: REF,
        total: candidatos.length,
        ids: candidatos.map((c) => c.id),
        amostra: (rows || []).slice(0, 5).map((r) => ({ id: r.id, ref: refPedidoVenda(r), desc: r.descricao })),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const alvo = candidatos[0];
const antes = pickDatas(alvo);

const patch = {
  data_lancamento: DATA_LANCAMENTO_ISO,
  data_vencimento: DATA_ALVO,
  data_pagamento: DATA_ALVO,
  data_liquidacao_prevista: DATA_ALVO,
  dados: {
    ...(alvo.dados && typeof alvo.dados === 'object' ? alvo.dados : {}),
    data_lancamento: DATA_LANCAMENTO_ISO,
    data_vencimento: DATA_ALVO,
    data_pagamento: DATA_ALVO,
    data_liquidacao_prevista: DATA_ALVO,
    ajuste_pre_corte_2026_11_05: true,
  },
  observacoes: [alvo.observacoes, `Datas ajustadas para pré-corte ${DATA_ALVO} (decisão PV-05055)`]
    .filter(Boolean)
    .join(' | '),
};

const relatorio = {
  tabela: 'lancamento_financeiro',
  id: alvo.id,
  referencia: REF,
  descricao: alvo.descricao,
  conta: alvo.conta_financeira_nome,
  antes,
  depois: pickDatas({ ...alvo, ...patch }),
  apply,
};

console.log(JSON.stringify(relatorio, null, 2));

if (!apply) {
  console.log('\nNenhuma alteração gravada. Use :apply para persistir (apenas este id).');
  process.exit(0);
}

const { data: updated, error: errUp } = await supabase
  .from('lancamento_financeiro')
  .update(patch)
  .eq('id', alvo.id)
  .select('id,data_lancamento,data_vencimento,data_pagamento,data_liquidacao_prevista')
  .single();

if (errUp) {
  console.error('Falha no update:', errUp.message);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, gravado: updated }, null, 2));
