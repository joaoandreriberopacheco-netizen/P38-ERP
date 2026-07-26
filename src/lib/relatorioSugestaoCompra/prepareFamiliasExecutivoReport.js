import { buildFamiliasNivel2FromLinhas } from '@/lib/sugestaoFamiliasNivel2';
import { sugestaoProjecaoEstoque30dNegativa } from '@/lib/calcularSugestaoCompraVelocidade';
import { formatSugestaoQuantidadeVitrine } from '@/lib/sugestaoCompraVitrineDisplay';
import { normalizePdfText } from '@/lib/jspdfNotoFont';

const safe = (text) => normalizePdfText(text);

function fmtQtdFamilia(familia) {
  const base = Number(familia.qtdSugeridaBase) || 0;
  if (base <= 0) return '—';
  const rep = familia.linhas?.[0]?.produto || familia.linhas?.[0]?.skus?.[0];
  if (!rep) return String(Math.round(base));
  return safe(formatSugestaoQuantidadeVitrine(rep, base) || String(Math.round(base)));
}

/**
 * Dados para o PDF executivo «voz das famílias» (nível hierárquico 2).
 */
export function prepareFamiliasExecutivoReport(linhas = [], options = {}) {
  const familias = buildFamiliasNivel2FromLinhas(linhas, {
    incluirPedidosAprovados: options.incluirPedidosAprovados === true,
    salesVelocityMap: options.salesVelocityMap || {},
  });

  const rows = familias.map((f, idx) => ({
    rank: idx + 1,
    familia: safe(f.label),
    curva: safe(f.curvaDominante || '—'),
    estoque: safe(f.estoqueTexto || '—'),
    media_30d: safe(f.media30dTexto || '—'),
    projecao: safe(f.projecao?.projecao_estoque_30d_texto || '—'),
    projecao_negativa: sugestaoProjecaoEstoque30dNegativa(f.projecao),
    qtd_sugerida: fmtQtdFamilia(f),
    mensagem: safe(f.mensagem?.texto || '—'),
    mensagem_tom: f.mensagem?.tom || 'muted',
    sku_count: f.skuCount || 0,
    skus_ruptura: f.skusRuptura || 0,
    skus_acao: f.skusComAcao || 0,
  }));

  const comRuptura = rows.filter((r) => r.projecao_negativa).length;
  const comAcao = rows.filter((r) => r.qtd_sugerida !== '—').length;

  return {
    rows,
    summary: {
      totalFamilias: rows.length,
      comRuptura,
      comAcao,
    },
  };
}
