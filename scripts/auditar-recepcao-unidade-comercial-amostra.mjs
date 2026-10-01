#!/usr/bin/env node
/**
 * Amostra ~10 pedidos (quartis da cronologia) com recepção e fator ≠ 1:
 * valida se qtd recebida comercial = base ÷ fator (mesma regra da UI).
 *
 *   npx vite-node scripts/auditar-recepcao-unidade-comercial-amostra.mjs
 */
import { requireP38SupabaseScriptClient, asP38LegacyClient } from './p38-supabase-script-client.mjs';
import { hydratePedidosCompraItensFromSql } from '../src/lib/fetchPedidoCompraItens.js';
import { rebuildEmbarqueItensMirror, enrichEmbarqueMirrorFromPedidoItens } from '../src/lib/embarqueItemContract.js';
import {
  resolveEmbarqueQuantidadeComercial,
  resolveEmbarqueQuantidadeBase,
  resolveEmbarqueLinhaFator,
  resolveEmbarqueLinhaUnidade,
} from '../src/lib/embarqueQuantityResolve.js';
import { commercialQuantityFromBase } from '../src/lib/productUnits.js';

const SAMPLE_SIZE = 10;
const TOL_COM = 0.06;
const auditAll = process.argv.includes('--all');

function pickQuartileIndices(n, k = SAMPLE_SIZE) {
  if (n <= 0) return [];
  if (n <= k) return [...Array(n).keys()];
  const out = [];
  for (let i = 0; i < k; i += 1) {
    const t = k === 1 ? 0 : i / (k - 1);
    out.push(Math.min(n - 1, Math.round(t * (n - 1))));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function linhaTemRecepcaoComFator(linha, pedidoItens) {
  const recBase = resolveEmbarqueQuantidadeBase(linha, 'recebida');
  if (recBase <= 0.009) return false;
  const fator = resolveEmbarqueLinhaFator(linha);
  const enriched = enrichEmbarqueMirrorFromPedidoItens(linha, pedidoItens);
  const f2 = resolveEmbarqueLinhaFator(enriched);
  return f2 > 1.001 || fator > 1.001;
}

function auditarLinhaRecepcao(linha, pedidoItens) {
  const enriched = enrichEmbarqueMirrorFromPedidoItens(linha, pedidoItens);
  const fator = resolveEmbarqueLinhaFator(enriched);
  const unidade = resolveEmbarqueLinhaUnidade(enriched);
  const recBase = resolveEmbarqueQuantidadeBase(enriched, 'recebida');
  const recCom = resolveEmbarqueQuantidadeComercial(enriched, 'recebida');
  if (recBase <= 0.009) return null;

  const esperadoCom = commercialQuantityFromBase(recBase, fator, unidade);
  const delta = Math.abs(esperadoCom - recCom);
  const ok = delta <= TOL_COM;

  return {
    produto: enriched.produto_nome || enriched.produto_id,
    unidade,
    fator,
    rec_base: recBase,
    rec_com_ui: recCom,
    rec_com_esperado: esperadoCom,
    delta,
    ok,
  };
}

const p38 = asP38LegacyClient(requireP38SupabaseScriptClient());
const { entities } = p38;

const todos = await entities.PedidoCompra.list('created_date', 5000);
const ordenados = (todos || [])
  .filter((p) => p?.id)
  .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));

const elegiveis = [];

for (const pedido of ordenados) {
  const embarques = await entities.Embarque.filter({ pedido_compra_id: pedido.id });
  if (!embarques?.length) continue;

  const [hidratado] = await hydratePedidosCompraItensFromSql(p38, [pedido]);
  const pedidoItens = hidratado?.itens || [];

  let temCargaFator = false;
  const linhasAudit = [];

  for (const emb of embarques) {
    const raw = await entities.EmbarqueItem.filter({ embarque_id: emb.id });
    const mirror = rebuildEmbarqueItensMirror(raw || []).map((l) =>
      enrichEmbarqueMirrorFromPedidoItens(l, pedidoItens),
    );
    for (const linha of mirror) {
      if (!linhaTemRecepcaoComFator(linha, pedidoItens)) continue;
      temCargaFator = true;
      const audit = auditarLinhaRecepcao(linha, pedidoItens);
      if (audit) linhasAudit.push({ embarque: emb.numero || emb.codigo_exibicao || emb.id, ...audit });
    }
  }

  if (!temCargaFator) continue;

  elegiveis.push({
    pedido,
    pedidoItens,
    _itens_fonte: hidratado?._itens_fonte,
    linhasAudit,
  });
}

const idx = auditAll
  ? elegiveis.map((_, i) => i)
  : pickQuartileIndices(elegiveis.length, SAMPLE_SIZE);
const amostra = idx.map((i) => elegiveis[i]);

const resumo = {
  pedidos_total_bd: ordenados.length,
  elegiveis_recepcao_fator: elegiveis.length,
  indices_quartis: idx,
  linhas_ok: 0,
  linhas_falha: 0,
  pedidos_com_falha: 0,
};

const detalhe = amostra.map((row, pos) => {
  const falhas = (row.linhasAudit || []).filter((l) => !l.ok);
  const oks = (row.linhasAudit || []).filter((l) => l.ok);
  resumo.linhas_ok += oks.length;
  resumo.linhas_falha += falhas.length;
  if (falhas.length) resumo.pedidos_com_falha += 1;

  return {
    ordem_amostra: pos + 1,
    indice_elegivel: idx[pos],
    numero: row.pedido.numero,
    created_date: row.pedido.created_date,
    itens_fonte: row._itens_fonte,
    linhas_total: row.linhasAudit.length,
    linhas_falha: falhas.length,
    falhas,
    ok_exemplo: oks.slice(0, 2),
  };
});

console.log(JSON.stringify({ resumo, amostra: detalhe }, null, 2));
process.exit(resumo.linhas_falha > 0 ? 1 : 0);
