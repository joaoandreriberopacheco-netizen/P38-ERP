#!/usr/bin/env node
/**
 * Retroativo PW8-WLV-A (Vitória Régia): embarque_item gravou CX com fator 1 (base = caixas).
 * Estoque (movimentacao_estoque) já entrou em m² correto na recepção — só alinha SQL + espelho JSON.
 *
 * Uso:
 *   node scripts/corrigir-pw8-wlv-a-retroativo.mjs
 *   node scripts/corrigir-pw8-wlv-a-retroativo.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { loadDotEnvFiles } from './base44-env.mjs';
import { loadP38SecretsBundle } from './load-p38-secrets-bundle.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

const PEDIDO_ID = '34dca342-7f53-4e99-9a0d-a032555d194f';
const EMBARQUE_A_ID = 'de2ccc31-3172-4b2c-9d17-74581fb6e675';
const APPLY = process.argv.includes('--apply');

const roundQty = (n) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;

/** @param {...string} nomes */
function extractFatorFromName(...nomes) {
  for (const raw of nomes) {
    if (!raw) continue;
    const s = String(raw)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace('METRO QUADRADO', 'M2')
      .replace('M²', 'M2')
      .replace(/CAIXAS?/g, 'CX');
    const padroes = [
      /(\d+(?:[.,]\d+)?)\s*M2\s*[\/xX\s]*\s*CX/i,
      /CX\s*(\d+(?:[.,]\d+)?)\s*M2/i,
      /\(\s*(\d+(?:[.,]\d+)?)\s*M2\s*\)/i,
      /CX\s*2\s*,/i, // ex.: "CX2," no Branco RT → 2,16 m²/cx (60x120)
    ];
    for (const re of padroes) {
      const m = re.exec(s);
      if (m) {
        if (re.source.includes('CX\\s*2')) return 2.16;
        const v = Number(String(m[1]).replace(',', '.'));
        if (Number.isFinite(v) && v > 1 && v < 100) return roundQty(v);
      }
    }
  }
  return null;
}

function fatorFromProdutoRow(produtoRow, produtoNome) {
  const dados = produtoRow?.dados || {};
  const unidades = Array.isArray(produtoRow?.unidades)
    ? produtoRow.unidades
    : Array.isArray(dados.unidades)
      ? dados.unidades
      : [];
  const cx = unidades.find((u) => String(u?.sigla || '').toUpperCase() === 'CX');
  const fCx = Number(cx?.fator_conversao);
  if (Number.isFinite(fCx) && fCx > 1) return fCx;
  const fromName = extractFatorFromName(produtoRow?.nome, produtoNome, produtoRow?.descricao);
  return fromName && fromName > 1 ? fromName : null;
}

function mirrorFromSqlRow(row) {
  const fator = Number(row.fator_aplicado) || Number(row.dados?.fator_aplicado) || 1;
  const unidade = row.unidade_sigla || 'CX';
  const qEmbCom = Number(row.quantidade_embarcada_comercial) || 0;
  const qRecCom = Number(row.quantidade_recebida_comercial) || 0;
  const qPedCom = Number(row.quantidade_pedida_comercial) || 0;
  const qEmbBase = Number(row.quantidade_embarcada_base) || roundQty(qEmbCom * fator);
  const qRecBase = Number(row.quantidade_recebida_base) || roundQty(qRecCom * fator);
  const qPedBase = Number(row.quantidade_pedida_base) || roundQty(qPedCom * fator);

  return {
    produto_id: row.produto_id,
    produto_nome: row.produto_nome,
    produto_unidade_id: row.produto_unidade_id || row.dados?.produto_unidade_id || '',
    pedido_compra_item_id: row.pedido_compra_item_id || '',
    fator_aplicado: fator,
    fator_apresentacao: fator,
    fator_conversao: 1,
    quantidade_pedida: qPedBase,
    quantidade_embarcada: qEmbBase,
    quantidade_recebida: qRecBase,
    quantidade_base: qEmbBase,
    quantidade_pedida_apresentacao: qPedCom,
    quantidade_embarcada_apresentacao: qEmbCom,
    quantidade_recebida_apresentacao: qRecCom,
    unidade_medida: 'M2',
    unidade_apresentacao: unidade,
    unidade_sigla: unidade,
    divergencia_tipo: row.divergencia_tipo || 'Nenhuma',
    embarque_item_id: row.id,
  };
}

function needsFix(row) {
  const fator = Number(row.fator_aplicado) || Number(row.dados?.fator_aplicado) || 1;
  const un = String(row.unidade_sigla || '').toUpperCase();
  if (un !== 'CX') return false;
  const recCom = Number(row.quantidade_recebida_comercial) || 0;
  const recBase = Number(row.quantidade_recebida_base) || Number(row.dados?.quantidade_recebida_base) || 0;
  if (recCom <= 0) return false;
  if (fator > 1.001) return false;
  if (recBase > recCom + 0.01) return false;
  return true;
}

async function main() {
  loadDotEnvFiles();
  loadP38SecretsBundle();
  const secrets = resolveP38Secrets();
  const url = secrets.supabaseUrl || (secrets.projectRef ? `https://${secrets.projectRef}.supabase.co` : '');
  const key = secrets.serviceRoleKey;
  if (!url || !key) {
    console.error('SUPABASE URL / SERVICE_ROLE ausentes');
    process.exit(1);
  }

  const sb = createClient(url, key);

  const { data: movs, error: movErr } = await sb
    .from('movimentacao_estoque')
    .select('produto_id,quantidade,quantidade_base')
    .eq('referencia_tipo', 'PedidoCompra')
    .eq('referencia_id', PEDIDO_ID)
    .eq('tipo', 'Entrada')
    .eq('motivo', 'Compra');
  if (movErr) throw movErr;
  const movByProd = new Map();
  for (const m of movs || []) {
    const q = Number(m.quantidade_base ?? m.quantidade) || 0;
    movByProd.set(String(m.produto_id), roundQty((movByProd.get(String(m.produto_id)) || 0) + q));
  }

  const { data: rows, error: fetchErr } = await sb
    .from('embarque_item')
    .select('*')
    .eq('embarque_id', EMBARQUE_A_ID)
    .order('ordem');
  if (fetchErr) throw fetchErr;

  const plan = [];
  for (const row of rows || []) {
    if (!needsFix(row)) {
      plan.push({ id: row.id, produto: row.produto_nome, skip: true, reason: 'já coerente ou sem recepção' });
      continue;
    }

    const { data: prod } = await sb.from('produto').select('id,nome,descricao,dados').eq('id', row.produto_id).maybeSingle();
    let fator = fatorFromProdutoRow(prod, row.produto_nome);
    const recCom = Number(row.quantidade_recebida_comercial) || 0;
    const movQ = movByProd.get(String(row.produto_id));
    if (movQ && recCom > 0) {
      const fMov = roundQty(movQ / recCom);
      if (fMov > 1.01 && fMov < 100) fator = fMov;
    }
    if (!fator || fator <= 1) {
      plan.push({ id: row.id, produto: row.produto_nome, error: 'fator CX não resolvido' });
      continue;
    }

    const embCom = Number(row.quantidade_embarcada_comercial) || 0;
    const pedCom = Number(row.quantidade_pedida_comercial) || 0;
    const patch = {
      unidade_sigla: 'CX',
      fator_aplicado: fator,
      quantidade_pedida_base: roundQty(pedCom * fator),
      quantidade_embarcada_base: roundQty(embCom * fator),
      quantidade_recebida_base: roundQty(recCom * fator),
      dados: {
        ...(row.dados || {}),
        fator_aplicado: fator,
        quantidade_pedida_base: roundQty(pedCom * fator),
        quantidade_embarcada_base: roundQty(embCom * fator),
        quantidade_recebida_base: roundQty(recCom * fator),
      },
      updated_at: new Date().toISOString(),
    };

    plan.push({
      id: row.id,
      produto: row.produto_nome,
      cx: recCom,
      fator,
      antes_base: row.quantidade_recebida_base,
      depois_base: patch.quantidade_recebida_base,
      mov_estoque: movQ ?? null,
      patch,
    });
  }

  const errors = plan.filter((p) => p.error);
  const fixes = plan.filter((p) => p.patch);
  const report = {
    dryRun: !APPLY,
    embarque: 'PW8-WLV-A',
    pedido_id: PEDIDO_ID,
    linhas_total: rows?.length ?? 0,
    corrigir: fixes.length,
    ignoradas: plan.filter((p) => p.skip).length,
    erros: errors,
    detalhe: fixes.map(({ patch, ...rest }) => rest),
  };

  console.log(JSON.stringify(report, null, 2));

  if (errors.length) {
    console.error('\nAbortado: resolva fator em falta antes de aplicar.');
    process.exit(1);
  }

  if (!APPLY) {
    console.log('\nPasse --apply para gravar no Supabase (estoque não será alterado).');
    return;
  }

  for (const item of fixes) {
    const { error } = await sb.from('embarque_item').update(item.patch).eq('id', item.id);
    if (error) throw new Error(`${item.id}: ${error.message}`);
  }

  const { data: rowsAfter, error: afterErr } = await sb
    .from('embarque_item')
    .select('*')
    .eq('embarque_id', EMBARQUE_A_ID)
    .order('ordem');
  if (afterErr) throw afterErr;

  const mirror = (rowsAfter || []).map(mirrorFromSqlRow);
  const { data: embRow } = await sb.from('embarque').select('dados').eq('id', EMBARQUE_A_ID).single();
  const dados = { ...(embRow?.dados || {}), codigo_exibicao: 'PW8-WLV-A', itens_embarcados: mirror };

  const { error: embUpdErr } = await sb
    .from('embarque')
    .update({ itens: mirror, dados, updated_at: new Date().toISOString() })
    .eq('id', EMBARQUE_A_ID);
  if (embUpdErr) throw embUpdErr;

  const tag = `[RETROATIVO PW8-WLV-A fator CX→base m² | ${new Date().toISOString().slice(0, 10)}]`;
  const { data: ped } = await sb.from('pedido_compra').select('observacoes,dados').eq('id', PEDIDO_ID).single();
  await sb
    .from('pedido_compra')
    .update({
      observacoes: `${String(ped?.observacoes || '').trim()}\n${tag}`.trim(),
      dados: { ...(ped?.dados || {}), pw8_wlv_a_retroativo: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq('id', PEDIDO_ID);

  const somaRecBase = roundQty(
    (rowsAfter || []).reduce((acc, r) => acc + (Number(r.quantidade_recebida_base) || 0), 0),
  );
  const somaMov = roundQty([...movByProd.values()].reduce((a, b) => a + b, 0));

  console.log('\nOK — PW8-WLV-A alinhado.');
  console.log(JSON.stringify({ soma_recebida_base_embarque: somaRecBase, soma_movimentacao_m2: somaMov }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
