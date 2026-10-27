/**
 * Match de itens importados ao catálogo via Groq (2ª chamada — paridade com Gemini antigo).
 */

import {
  buildCompactFornecedoresTsv,
  buildCompactProdutosTsv,
  buildOcrCatalogCandidatePool,
} from '@/components/compras/productMatchingUtils';
import {
  isOcrCloudFallbackEnabled,
  isOcrGroqMatchEnabled,
} from '@/lib/ocrCloudFallback';
import { invokeP38Core } from '@/lib/p38CoreInvoke';

function itemDescricaoParaMatch(item) {
  return String(
    item?.descricao
    || item?.descricao_pdf
    || item?.texto_identificado
    || '',
  ).trim();
}

function buildItensPayload(itens) {
  return (itens || []).map((item, indice) => ({
    indice,
    descricao: itemDescricaoParaMatch(item),
    codigo: String(item?.codigo || item?.codigo_pdf || '').trim(),
    marca: String(item?.marca || item?.marca_pdf || '').trim(),
    quantidade: item?.quantidade ?? item?.quantidade_pdf ?? null,
    preco_unitario: item?.preco_unitario ?? item?.preco_unitario_pdf ?? null,
  })).filter((row) => row.descricao.length >= 2);
}

/**
 * @param {object} opts
 * @param {'pedido_compra'|'cotacao_pdf'} opts.tipo
 * @param {object[]} opts.itens — linhas já extraídas do documento
 * @param {object[]} opts.produtos — catálogo completo (shortlist local antes do Groq)
 * @param {object[]} [opts.fornecedores]
 * @param {(msg: string) => void} [opts.onProgress]
 * @returns {Promise<{ fornecedor_id_match: string, itens: Array<{ indice, produto_id_match, confianca }> } | null>}
 */
export async function buscarMatchCatalogoGroq({
  tipo,
  itens,
  produtos,
  fornecedores = [],
  onProgress,
}) {
  if (!isOcrCloudFallbackEnabled() || !isOcrGroqMatchEnabled()) return null;
  const lista = buildItensPayload(itens);
  if (!lista.length || !produtos?.length) return null;

  onProgress?.('Associando itens ao catálogo (IA)');

  const candidatos = buildOcrCatalogCandidatePool(itens, produtos);
  if (!candidatos.length) return null;

  const catalogo_tsv = buildCompactProdutosTsv(candidatos);
  const fornecedores_tsv = buildCompactFornecedoresTsv(fornecedores);

  const payload = await invokeP38Core({
    op: 'MatchImportCatalogoGroq',
    tipo,
    itens: lista,
    catalogo_tsv,
    fornecedores_tsv,
    telemetry: {
      source: `ocr_groq_match_${tipo}`,
      catalog_product_count: candidatos.length,
    },
  });

  if (payload?.error) {
    throw new Error(String(payload.error));
  }

  const dados = payload?.dados ?? payload;
  if (!dados || typeof dados !== 'object') return null;

  const fornecedor_id_match = String(dados.fornecedor_id_match || '').trim();
  const rows = Array.isArray(dados.itens) ? dados.itens : [];

  return {
    fornecedor_id_match,
    itens: rows.map((row) => ({
      indice: Number(row.indice),
      produto_id_match: String(row.produto_id_match || '').trim(),
      confianca: String(row.confianca || 'baixa').toLowerCase(),
    })),
  };
}

/** Aplica ids devolvidos pelo Groq antes do `resolveOcrProductMatch` local. */
export function aplicarMatchGroqNasLinhas(itens, matchGroq, catalogoProdutos = []) {
  if (!matchGroq?.itens?.length) return itens;
  const catalogoIds = new Set((catalogoProdutos || []).map((p) => p.id));
  const porIndice = new Map();
  for (const row of matchGroq.itens) {
    if (!Number.isFinite(row.indice)) continue;
    porIndice.set(row.indice, row);
  }

  return (itens || []).map((item, indice) => {
    const row = porIndice.get(indice);
    if (!row?.produto_id_match || !catalogoIds.has(row.produto_id_match)) return item;
    return {
      ...item,
      confianca: row.confianca || item.confianca,
      produto_id_match_groq: row.produto_id_match,
    };
  });
}
