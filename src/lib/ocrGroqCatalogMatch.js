/**
 * Match de itens importados ao catálogo via Groq (2ª chamada — paridade com Gemini antigo).
 * Catálogo candidato é montado no servidor (p38-core) para não travar o mobile.
 */

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

function buildFornecedoresTsv(fornecedores = []) {
  if (!fornecedores.length) return '(nenhum)';
  return fornecedores
    .map((f) => {
      const id = String(f.id || '').trim();
      const nome = String(f.nome || '').replace(/\|/g, '/').trim();
      const cnpj = String(f.cpf_cnpj || '').replace(/\D/g, '');
      return `${id}|${nome}|${cnpj}`;
    })
    .join('\n');
}

/**
 * @param {object} opts
 * @param {'pedido_compra'|'cotacao_pdf'} opts.tipo
 * @param {object[]} opts.itens — linhas já extraídas do documento
 * @param {object[]} [_opts.produtos] — ignorado (catálogo no servidor)
 * @param {object[]} [opts.fornecedores]
 * @param {(msg: string) => void} [opts.onProgress]
 */
export async function buscarMatchCatalogoGroq({
  tipo,
  itens,
  fornecedores = [],
  onProgress,
}) {
  if (!isOcrCloudFallbackEnabled() || !isOcrGroqMatchEnabled()) return null;
  const lista = buildItensPayload(itens);
  if (!lista.length) return null;

  onProgress?.('Associando itens ao catálogo (IA)');

  let payload;
  try {
    payload = await invokeP38Core({
      op: 'MatchImportCatalogoGroq',
      tipo,
      itens: lista,
      catalogo_tsv: '',
      montar_catalogo_no_servidor: true,
      fornecedores_tsv: buildFornecedoresTsv(fornecedores),
      telemetry: {
        source: `ocr_groq_match_${tipo}`,
        catalog_product_count: 0,
      },
    });
  } catch (err) {
    console.warn('[ocrGroqCatalogMatch] invoke falhou:', err);
    return null;
  }

  if (payload?.error) {
    console.warn('[ocrGroqCatalogMatch]', payload.error);
    return null;
  }

  const dados = payload?.dados ?? payload;
  if (!dados || typeof dados !== 'object') return null;

  const fornecedor_id_match = String(dados.fornecedor_id_match || '').trim();
  const rows = Array.isArray(dados.itens) ? dados.itens : [];

  return {
    fornecedor_id_match,
    itens: rows
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const indice = Number(row.indice);
        if (!Number.isFinite(indice) || indice < 0) return null;
        return {
          indice,
          produto_id_match: String(row.produto_id_match || '').trim(),
          confianca: String(row.confianca || 'baixa').toLowerCase(),
        };
      })
      .filter(Boolean),
  };
}

/** Aplica ids devolvidos pelo Groq antes do `resolveOcrProductMatch` local. */
export function aplicarMatchGroqNasLinhas(itens, matchGroq, catalogoProdutos = []) {
  if (!matchGroq?.itens?.length) return itens;
  const catalogoIds = new Set((catalogoProdutos || []).map((p) => p.id));
  const porIndice = new Map();
  for (const row of matchGroq.itens) {
    if (!row || !Number.isFinite(row.indice)) continue;
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
