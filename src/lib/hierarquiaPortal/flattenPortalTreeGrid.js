import { TREE_GRID_EXPAND_ALL_LEVEL } from '@/components/produtos/treegrid/LevelControl';
import { portalEstoqueGrupo } from '@/lib/hierarquiaPortal/portalStockFormat';

function filterTree(tree, filtroLinha, filtroTipos, search) {
  const q = search.trim().toLowerCase();
  const tipos = filtroTipos?.size ? filtroTipos : new Set(['solo', 'mix', 'portfolio']);

  return tree
    .map((cat) => ({
      ...cat,
      linhas: cat.linhas
        .filter((lin) => (!filtroLinha || lin.linha_codigo === filtroLinha) && tipos.has(lin.linha_tipo))
        .map((lin) => {
          if (!q) return lin;
          const matchLin = lin.linha_nome.toLowerCase().includes(q);
          const pcs = lin.pcs.filter(
            (pc) =>
              pc.produto_compra_nome.toLowerCase().includes(q) ||
              pc.skus.some((s) => s.produto.nome?.toLowerCase().includes(q)),
          );
          const solos = lin.solos.filter(
            (s) => s.produto.nome?.toLowerCase().includes(q) || matchLin,
          );
          if (!matchLin && !pcs.length && !solos.length) return null;
          return { ...lin, pcs: matchLin ? lin.pcs : pcs, solos: matchLin ? lin.solos : solos };
        })
        .filter(Boolean),
    }))
    .filter((cat) => cat.linhas.length > 0);
}

function skuCountLinha(lin) {
  return lin.pcs.reduce((s, p) => s + p.skus.length, 0) + lin.solos.length;
}

function allSkuRows(lin) {
  return [
    ...lin.solos,
    ...lin.pcs.flatMap((pc) => pc.skus),
  ];
}

/**
 * Flatten portal tree → linhas compactas estilo TreeGrid (níveis 1–4 + todos).
 */
export function flattenPortalTreeGrid(tree, maxLevel) {
  const rows = [];
  const showAll = maxLevel >= TREE_GRID_EXPAND_ALL_LEVEL;

  for (const cat of tree) {
    const catSkus = cat.linhas.flatMap(allSkuRows);
    const catStock = portalEstoqueGrupo(catSkus);
    rows.push({
      id: `cat:${cat.nome}`,
      kind: 'categoria',
      depth: 0,
      label: cat.nome,
      subtitle: `${cat.linhas.length} LINHA(s)`,
      tipo: null,
      skuCount: catSkus.length,
      estoque: catStock,
    });

    if (maxLevel < 2 && !showAll) continue;

    for (const lin of cat.linhas) {
      const linSkus = allSkuRows(lin);
      const linStock = portalEstoqueGrupo(linSkus);
      rows.push({
        id: `lin:${cat.nome}::${lin.linha_codigo}`,
        kind: 'linha',
        depth: 1,
        label: lin.linha_nome,
        subtitle: lin.linha_codigo,
        tipo: lin.linha_tipo,
        skuCount: skuCountLinha(lin),
        estoque: linStock,
      });

      if (maxLevel < 3 && !showAll) continue;

      if (lin.linha_tipo === 'solo') {
        if (maxLevel >= 4 || showAll) {
          for (const s of lin.solos) {
            rows.push({
              id: `sku:${s.produto.id}`,
              kind: 'sku',
              depth: 2,
              label: s.produto.nome,
              subtitle: s.eixo_b || s.produto.codigo_interno || '',
              tipo: null,
              skuCount: null,
              estoque: { label: s.estoque_label, quantidade: s.estoque_vitrine, sigla: s.estoque_sigla },
            });
          }
        }
        continue;
      }

      for (const pc of lin.pcs) {
        const pcStock = portalEstoqueGrupo(pc.skus);
        rows.push({
          id: `pc:${cat.nome}::${lin.linha_codigo}::${pc.produto_compra_codigo}`,
          kind: 'produto_compra',
          depth: 2,
          label: pc.produto_compra_nome,
          subtitle:
            pc.eixo_a_rotulo && pc.eixo_b_rotulo
              ? `${pc.eixo_a_rotulo} × ${pc.eixo_b_rotulo}`
              : '',
          tipo: lin.linha_tipo,
          skuCount: pc.skus.length,
          estoque: pcStock,
        });

        if (maxLevel < 4 && !showAll) continue;

        for (const s of pc.skus) {
          rows.push({
            id: `sku:${s.produto.id}`,
            kind: 'sku',
            depth: 3,
            label: s.produto.nome,
            subtitle: s.eixo_b || s.produto.codigo_interno || '',
            tipo: null,
            skuCount: null,
            estoque: { label: s.estoque_label, quantidade: s.estoque_vitrine, sigla: s.estoque_sigla },
          });
        }
      }
    }
  }

  return rows;
}

export { filterTree };
