#!/usr/bin/env node
/**
 * Marca pedido DT8-8B8 (Fortlev) como recepcionado/concluído no Supabase.
 * Uso: node scripts/recepcionar-dt8-8b8-supabase.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js';

const PEDIDO_ID = '6a458432785b7176bacff537';
const PEDIDO_NUMERO = 'DT8-8B8';
const EMBARQUE_REAL_ID = '6a571f4fab7d26db5bd182d4';
const EMBARQUE_NEC_ID = '6a629c86802150cd44e3d994';
const APPLY = process.argv.includes('--apply');

const url = process.env.VITE_SUPABASE_URL || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY ausente');
  process.exit(1);
}

const sb = createClient(url, key);

function mirrorFromSqlRow(row) {
  const d = row.dados || {};
  const fator = Number(d.fator_aplicado) || 1;
  const qEmbCom = Number(row.quantidade_embarcada_comercial) || 0;
  const qRecCom = Number(row.quantidade_recebida_comercial) || 0;
  const qPedCom = Number(row.quantidade_pedida_comercial) || 0;
  const unidade = row.unidade_sigla || 'UN';
  return {
    produto_id: row.produto_id,
    produto_nome: row.produto_nome,
    produto_unidade_id: d.produto_unidade_id || '',
    pedido_compra_item_id: row.pedido_compra_item_id || '',
    fator_aplicado: fator,
    fator_apresentacao: fator,
    fator_conversao: 1,
    quantidade_pedida: qPedCom,
    quantidade_embarcada: qEmbCom,
    quantidade_recebida: qRecCom,
    quantidade_base: qEmbCom,
    quantidade_pedida_apresentacao: qPedCom,
    quantidade_embarcada_apresentacao: qEmbCom,
    quantidade_recebida_apresentacao: qRecCom,
    unidade_medida: unidade,
    unidade_apresentacao: unidade,
    unidade_sigla: unidade,
    divergencia_tipo: row.divergencia_tipo || 'Nenhuma',
    embarque_item_id: row.id,
  };
}

async function loadEmbarqueItems(embarqueId) {
  const { data, error } = await sb
    .from('embarque_item')
    .select('*')
    .eq('embarque_id', embarqueId)
    .order('ordem');
  if (error) throw error;
  return data || [];
}

async function main() {
  const { data: pedido, error: pedErr } = await sb
    .from('pedido_compra')
    .select('id,numero,status,status_recebimento_geral')
    .eq('id', PEDIDO_ID)
    .single();
  if (pedErr) throw pedErr;

  const itensReal = await loadEmbarqueItems(EMBARQUE_REAL_ID);
  const itensNec = await loadEmbarqueItems(EMBARQUE_NEC_ID);

  const plano = {
    pedido: pedido.numero,
    status_atual: pedido.status,
    embarque_real: itensReal.map((r) => ({
      id: r.id,
      produto: r.produto_nome,
      embarcado: r.quantidade_embarcada_comercial,
      recebido: r.quantidade_recebida_comercial,
      novo_recebido: r.quantidade_embarcada_comercial,
    })),
    embarque_necessidade: itensNec.map((r) => ({
      id: r.id,
      produto: r.produto_nome,
      embarcado: r.quantidade_embarcada_comercial,
      recebido: r.quantidade_recebida_comercial,
      novo_recebido: r.quantidade_embarcada_comercial,
    })),
  };

  console.log(JSON.stringify({ dryRun: !APPLY, plano }, null, 2));

  if (!APPLY) {
    console.log('\nPasse --apply para gravar no Supabase.');
    return;
  }

  const now = new Date().toISOString();

  for (const row of [...itensReal, ...itensNec]) {
    const qEmb = Number(row.quantidade_embarcada_comercial) || 0;
    const { error } = await sb
      .from('embarque_item')
      .update({
        quantidade_recebida_comercial: qEmb,
        divergencia_tipo: 'Nenhuma',
        dados: {
          ...(row.dados || {}),
          quantidade_recebida_base: qEmb,
          quantidade_embarcada_base: qEmb,
        },
        updated_at: now,
      })
      .eq('id', row.id);
    if (error) throw new Error(`embarque_item ${row.id}: ${error.message}`);
  }

  const itensRealAtual = await loadEmbarqueItems(EMBARQUE_REAL_ID);
  const mirrorReal = itensRealAtual.map(mirrorFromSqlRow);
  const { data: embRealRow } = await sb.from('embarque').select('dados').eq('id', EMBARQUE_REAL_ID).single();
  const dadosReal = { ...(embRealRow?.dados || {}), itens_embarcados: mirrorReal, codigo_exibicao: 'DT8-8B8-A' };

  const { error: embRealErr } = await sb
    .from('embarque')
    .update({
      status: 'Concluído',
      status_recebimento: 'Recebido OK',
      itens: mirrorReal,
      dados: dadosReal,
      updated_at: now,
    })
    .eq('id', EMBARQUE_REAL_ID);
  if (embRealErr) throw embRealErr;

  const itensNecAtual = await loadEmbarqueItems(EMBARQUE_NEC_ID);
  const mirrorNec = itensNecAtual.map(mirrorFromSqlRow);
  const { data: embNecRow } = await sb.from('embarque').select('dados').eq('id', EMBARQUE_NEC_ID).single();
  const dadosNec = { ...(embNecRow?.dados || {}), itens_embarcados: mirrorNec, codigo_exibicao: 'DT8-8B8-B' };

  const { error: embNecErr } = await sb
    .from('embarque')
    .update({
      status: 'Concluído',
      status_recebimento: 'Recebido OK',
      itens: mirrorNec,
      dados: dadosNec,
      updated_at: now,
    })
    .eq('id', EMBARQUE_NEC_ID);
  if (embNecErr) throw embNecErr;

  const tag = `[RECEPÇÃO RETROATIVA SUPABASE | ${PEDIDO_NUMERO} | ${now.slice(0, 10)}]`;
  const { data: pedFull } = await sb.from('pedido_compra').select('dados,observacoes').eq('id', PEDIDO_ID).single();
  const { error: pedUpdErr } = await sb
    .from('pedido_compra')
    .update({
      status: 'Concluído',
      status_recebimento_geral: 'Concluído OK',
      observacoes: `${String(pedFull?.observacoes || '').trim()}\n${tag}`.trim(),
      dados: {
        ...(pedFull?.dados || {}),
        recepcao_retroativa: now,
      },
      updated_at: now,
    })
    .eq('id', PEDIDO_ID);
  if (pedUpdErr) throw pedUpdErr;

  const { data: verificacao } = await sb
    .from('pedido_compra')
    .select('numero,status,status_recebimento_geral')
    .eq('id', PEDIDO_ID)
    .single();

  console.log('\nOK — DT8-8B8 concluído no Supabase:');
  console.log(JSON.stringify(verificacao, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
