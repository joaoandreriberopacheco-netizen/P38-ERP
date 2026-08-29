import { montarNomePortalSku } from '@/lib/hierarquiaPortal/montarNomePortalSku';
import { pathwayPapelLabel } from '@/lib/estudoCatalog/pathwayMeta';

function sortKey(...parts) {
  return parts.map((p) => String(p ?? '').trim()).join('\0');
}

/**
 * Percorre a árvore estudo e devolve fila linear de SKUs.
 * @param {'alpha' | 'hierarchy'} sort — catálogo plano usa alpha; hierarquia preservada para export
 */
export function flattenEstudoCatalogSkus(tree, { sort = 'alpha' } = {}) {
  const rows = [];

  for (const bloco of tree || []) {
    for (const sub of bloco.sub_blocos || []) {
      for (const grupo of sub.grupos || []) {
        for (const core of grupo.cores || []) {
          for (const pw of core.pathways || []) {
            const pathwayLabel =
              pw.pathway_papel && pw.pathway_papel !== 'default'
                ? pathwayPapelLabel(pw.pathway_papel)
                : '';

            for (const linha of pw.linhas || []) {
              const context = {
                bloco: bloco.bloco,
                sub_bloco: sub.sub_bloco,
                grupo: grupo.grupo || '',
                core: core.core,
                pathway: pathwayLabel,
                linha_codigo: linha.linha_codigo,
                linha_nome: linha.linha_nome || linha.linha_display,
                linha_ordem: linha.linha_ordem ?? 0,
                linha_tipo: linha.linha_tipo,
              };

              const pushSku = (sku, produtoCompraNome = '') => {
                rows.push({
                  id: sku.codigo_interno || sku.id || `${linha.linha_pathway_key}-${rows.length}`,
                  context,
                  sku,
                  produto_compra_nome: produtoCompraNome,
                });
              };

              for (const s of linha.solos || []) {
                pushSku(s, '');
              }
              for (const pc of linha.pcs || []) {
                for (const s of pc.skus || []) {
                  pushSku(s, pc.produto_compra_nome || '');
                }
              }
            }
          }
        }
      }
    }
  }

  if (sort === 'alpha') {
    rows.sort((a, b) => {
      const na = montarNomePortalSku(a.sku).toLowerCase();
      const nb = montarNomePortalSku(b.sku).toLowerCase();
      const cmp = na.localeCompare(nb, 'pt', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return String(a.sku.codigo_interno || '').localeCompare(String(b.sku.codigo_interno || ''), 'pt');
    });
    return rows;
  }

  rows.sort((a, b) => {
    const ka = sortKey(
      a.context.bloco,
      a.context.sub_bloco,
      a.context.grupo,
      a.context.core,
      a.context.pathway,
      String(a.context.linha_ordem).padStart(6, '0'),
      a.context.linha_nome,
      a.produto_compra_nome,
      a.sku.novo_sku,
      a.sku.codigo_interno,
    );
    const kb = sortKey(
      b.context.bloco,
      b.context.sub_bloco,
      b.context.grupo,
      b.context.core,
      b.context.pathway,
      String(b.context.linha_ordem).padStart(6, '0'),
      b.context.linha_nome,
      b.produto_compra_nome,
      b.sku.novo_sku,
      b.sku.codigo_interno,
    );
    return ka.localeCompare(kb, 'pt');
  });

  return rows;
}

/** Caminho curto para leitura na vista plana (pathway da obra). */
export function estudoSkuCaminhoCurto(context) {
  return [
    context.bloco,
    context.sub_bloco,
    context.grupo,
    context.core,
    context.pathway,
  ]
    .filter(Boolean)
    .join(' › ');
}
