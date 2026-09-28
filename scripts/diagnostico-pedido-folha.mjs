#!/usr/bin/env node
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets, P38_CANONICAL_PROJECT_REF } from './p38-secrets.mjs';
import { pedidoCompraItemToLegacyMirror } from '../src/lib/pedidoCompraItemContract.js';
import { rebuildEmbarqueItensMirror, enrichEmbarqueMirrorFromPedidoItens } from '../src/lib/embarqueItemContract.js';
import {
  buildLinhasFolhaLogisticaFornecedor,
  qtyCaixaFromQuantidadeBase,
} from '../src/lib/relatorioPendenteEmbarqueFornecedor.js';
import { hydrateProdutoFromSupabaseRow } from '../src/lib/produtoSupabaseHydrate.js';
import { calcularFolhaLogisticaLinha } from '../src/lib/embarqueLogisticaHelpers.js';
import { calcValorTotalPedidoCompra } from '../src/lib/pedidoCompraFinanceiro.js';
import { sortEmbarquesParaExibicao } from '../src/lib/embarqueDisplayUtils.js';

const numero = process.argv[2] || 'AB6-PPQ';
loadDotEnvFiles();

function mapProd(row) {
  return hydrateProdutoFromSupabaseRow(row);
}

async function main() {
  const secrets = resolveP38Secrets('cloud-agent');
  const url = secrets.supabaseUrl || `https://${secrets.projectRef || P38_CANONICAL_PROJECT_REF}.supabase.co`;
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, secrets.serviceRoleKey, { auth: { persistSession: false } });

  const { data: pedRow } = await sb.from('pedido_compra').select('*').eq('numero', numero).maybeSingle();
  if (!pedRow) {
    console.error('Pedido não encontrado:', numero);
    process.exit(1);
  }

  const { data: pciRows } = await sb.from('pedido_compra_item').select('*').eq('pedido_compra_id', pedRow.id);
  const { data: embRows } = await sb.from('embarque').select('*').eq('pedido_compra_id', pedRow.id);
  const embIds = (embRows || []).map((e) => e.id);
  const { data: eiRows } = embIds.length
    ? await sb.from('embarque_item').select('*').in('embarque_id', embIds)
    : { data: [] };

  const produtoIds = [...new Set((pciRows || []).map((i) => i.produto_id).filter(Boolean))];
  const { data: prodRows } = produtoIds.length
    ? await sb.from('produto').select('*').in('id', produtoIds)
    : { data: [] };
  const produtosMap = {};
  for (const p of prodRows || []) produtosMap[p.id] = mapProd(p);

  const itens = (pciRows || []).map(pedidoCompraItemToLegacyMirror);
  const itensPorPedido = itens;
  const linhasPorEmb = new Map();
  for (const ei of eiRows || []) {
    if (!linhasPorEmb.has(ei.embarque_id)) linhasPorEmb.set(ei.embarque_id, []);
    linhasPorEmb.get(ei.embarque_id).push(ei);
  }
  const embarquesDb = (embRows || []).map((row) => {
    const raw = linhasPorEmb.get(row.id) || [];
    const mirror = rebuildEmbarqueItensMirror(raw).map((l) => enrichEmbarqueMirrorFromPedidoItens(l, itensPorPedido));
    return {
      id: row.id,
      pedido_compra_id: row.pedido_compra_id,
      numero: row.numero || row.dados?.numero,
      tipo: row.tipo || row.dados?.tipo,
      status_recebimento: row.status_recebimento || row.dados?.status_recebimento,
      data_embarque: row.data_embarque || row.dados?.data_embarque,
      transportadora_nome: row.transportadora_nome || row.dados?.transportadora_nome,
      _linhas: mirror,
    };
  });

  const pedido = {
    id: pedRow.id,
    numero: pedRow.numero,
    fornecedor_nome: pedRow.fornecedor_nome,
    data_emissao: String(pedRow.data_emissao || '').slice(0, 10),
    itens,
  };

  const embarquesOrd = sortEmbarquesParaExibicao(embarquesDb, pedido);
  const valorPedido = calcValorTotalPedidoCompra(pedido);

  console.log(JSON.stringify({
    pedido: pedido.numero,
    emissao: pedido.data_emissao,
    fornecedor: pedido.fornecedor_nome,
    valor_pedido: valorPedido,
    embarques: embarquesOrd.map((e) => ({
      codigo: e.numero,
      recepcao: e.status_recebimento,
      data_embarque: e.data_embarque,
      transportadora: e.transportadora_nome,
    })),
    linhas_folha: itens.map((item) => {
      const produto = produtosMap[item.produto_id];
      const folha = calcularFolhaLogisticaLinha(item, embarquesOrd);
      const ctx = { ...item, produto_nome: item.produto_nome };
      return {
        produto: item.produto_nome?.slice(0, 55),
        comprada_cx: qtyCaixaFromQuantidadeBase(folha.comprada, produto, item.unidade_medida, ctx),
        transito_cx: qtyCaixaFromQuantidadeBase(folha.emTransito, produto, item.unidade_medida, ctx),
        recebida_cx: qtyCaixaFromQuantidadeBase(folha.recebida, produto, item.unidade_medida, ctx),
        pendente_cx: qtyCaixaFromQuantidadeBase(folha.saldoPendente, produto, item.unidade_medida, ctx),
        folha_m2: folha,
      };
    }),
    entra_relatorio_todos_pendentes: buildLinhasFolhaLogisticaFornecedor(pedido, embarquesOrd, produtosMap, {
      somenteSaldoAvaria: false,
      valorPedidoTotal: valorPedido,
    }).length,
    entra_relatorio_so_pos_embarque: buildLinhasFolhaLogisticaFornecedor(pedido, embarquesOrd, produtosMap, {
      somenteSaldoAvaria: true,
      valorPedidoTotal: valorPedido,
    }).length,
    motivo_exclusao_pdf: 'Só entra linha com Pendente (col. 4) > 0 na folha; trânsito não conta como pendente.',
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
