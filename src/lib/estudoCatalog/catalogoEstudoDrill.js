import { pathwayPapelLabel } from '@/lib/estudoCatalog/pathwayMeta';

/** Segmentos de navegação drill-down (sem boneca russa). */
export const DRILL_KIND = {
  BLOCO: 'bloco',
  SUB: 'sub',
  GRUPO: 'grupo',
  CORE: 'core',
  PATHWAY: 'pathway',
};

function filterLinhas(linhas, filtroTipos) {
  const list = linhas || [];
  if (!filtroTipos?.size) return list;
  return list.filter((lin) => filtroTipos.has(lin.linha_tipo));
}

function pathwayLinhas(pathway, filtroTipos) {
  return filterLinhas(Array.from(pathway.linhas?.values?.() || pathway.linhas || []), filtroTipos);
}

function corePathways(coreNode) {
  return Array.from(coreNode.pathways?.values?.() || coreNode.pathways || []).sort(
    (a, b) => (a.pathway_ordem ?? 90) - (b.pathway_ordem ?? 90),
  );
}

function grupoCores(grupoNode) {
  return Array.from(grupoNode.cores?.values?.() || grupoNode.cores || []);
}

function subGrupos(sub) {
  return Array.from(sub.grupos?.values?.() || sub.grupos || []).sort(
    (a, b) => (a.grupo_ordem ?? 900) - (b.grupo_ordem ?? 900),
  );
}

function blocoSubs(bloco) {
  return Array.from(bloco.sub_blocos?.values?.() || bloco.sub_blocos || []);
}

function shortMeta(parts) {
  return parts.filter(Boolean).join(' · ');
}

/** Próximo nível navegável a partir do path actual. */
export function getDrillLevel(path, tree, filtroTipos) {
  if (!path?.length) {
    return {
      kind: 'root',
      label: 'Blocos',
      items: (tree || []).map((bloco) => ({
        kind: DRILL_KIND.BLOCO,
        key: bloco.bloco,
        label: bloco.bloco,
        meta: shortMeta([`${bloco.sub_blocos?.length || blocoSubs(bloco).length || 0} ramo(s)`]),
        node: bloco,
        navigable: true,
      })),
    };
  }

  const last = path[path.length - 1];

  if (last.kind === DRILL_KIND.BLOCO) {
    const subs = blocoSubs(last.node);
    return {
      kind: DRILL_KIND.SUB,
      label: 'Ramos',
      items: subs.map((sub) => ({
        kind: DRILL_KIND.SUB,
        key: sub.sub_bloco,
        label: sub.sub_bloco,
        meta: shortMeta([
          sub.sku_count != null ? `${sub.sku_count} SKU(s)` : null,
        ]),
        node: sub,
        navigable: true,
      })),
    };
  }

  if (last.kind === DRILL_KIND.SUB) {
    const grupos = subGrupos(last.node);
    const withGrupo = grupos.filter((g) => g.grupo);
    if (!withGrupo.length) {
      const cores = grupos.flatMap((g) => grupoCores(g));
      return buildCoreLevel(cores, filtroTipos);
    }
    return {
      kind: DRILL_KIND.GRUPO,
      label: 'Grupos',
      items: withGrupo.map((grupoNode) => ({
        kind: DRILL_KIND.GRUPO,
        key: grupoNode.grupo,
        label: grupoNode.grupo,
        meta: shortMeta([
          `${grupoCores(grupoNode).length} core(s)`,
          grupoNode.sku_count != null ? `${grupoNode.sku_count} SKU(s)` : null,
        ]),
        node: grupoNode,
        navigable: true,
      })),
    };
  }

  if (last.kind === DRILL_KIND.GRUPO) {
    return buildCoreLevel(grupoCores(last.node), filtroTipos);
  }

  if (last.kind === DRILL_KIND.CORE) {
    const pathways = corePathways(last.node);
    const withLinhas = pathways
      .map((pw) => ({ pw, linhas: pathwayLinhas(pw, filtroTipos) }))
      .filter(({ linhas }) => linhas.length);

    if (withLinhas.length === 1 && withLinhas[0].pw.pathway_papel === 'default') {
      return buildLinhaLevel(withLinhas[0].linhas, last.node.core);
    }

    return {
      kind: DRILL_KIND.PATHWAY,
      label: 'Papéis',
      items: withLinhas.map(({ pw, linhas }) => ({
        kind: DRILL_KIND.PATHWAY,
        key: pw.pathway_papel,
        label: pathwayPapelLabel(pw.pathway_papel),
        meta: `${linhas.length} LINHA(s)`,
        node: pw,
        linhas,
        navigable: true,
      })),
    };
  }

  if (last.kind === DRILL_KIND.PATHWAY) {
    const linhas = pathwayLinhas(last.node, filtroTipos);
    const coreLabel = path.find((s) => s.kind === DRILL_KIND.CORE)?.label || '';
    return buildLinhaLevel(linhas, coreLabel);
  }

  return { kind: 'unknown', label: '', items: [] };
}

function buildCoreLevel(cores, filtroTipos) {
  const items = cores
    .map((coreNode) => {
      const pathways = corePathways(coreNode);
      const linhaCount = pathways.reduce((a, pw) => a + pathwayLinhas(pw, filtroTipos).length, 0);
      if (!linhaCount) return null;
      return {
        kind: DRILL_KIND.CORE,
        key: coreNode.core,
        label: coreNode.core,
        meta: `${linhaCount} LINHA(s)`,
        node: coreNode,
        navigable: true,
      };
    })
    .filter(Boolean);

  return { kind: DRILL_KIND.CORE, label: 'Cores', items };
}

function buildLinhaLevel(linhas, coreLabel) {
  const sorted = [...linhas].sort((a, b) => (a.linha_ordem ?? 0) - (b.linha_ordem ?? 0));
  return {
    kind: 'linhas',
    label: coreLabel ? `LINHAs · ${coreLabel}` : 'LINHAs',
    items: sorted.map((linha) => {
      const pcs = linha.pcs || [];
      const solos = linha.solos || [];
      const skuCount = linha.sku_count ?? pcs.reduce((a, p) => a + (p.skus?.length || 0), 0) + solos.length;
      const pcCount = pcs.length || (linha.linha_tipo === 'solo' ? 1 : 0);
      const title = linha.pathway_sufixo
        ? `${linha.linha_nome || linha.linha_display} ·${linha.pathway_sufixo}`
        : (linha.linha_nome || linha.linha_display);

      return {
        kind: 'linha',
        key: linha.linha_pathway_key,
        label: title,
        meta: `${pcCount} PC · ${skuCount} SKU`,
        linha,
        navigable: false,
      };
    }),
  };
}

/** Avança path; salta níveis com filho único (menos cliques). */
export function drillEnter(path, item, tree, filtroTipos) {
  let next = [...path, { kind: item.kind, key: item.key, label: item.label, node: item.node }];

  for (let guard = 0; guard < 6; guard += 1) {
    const level = getDrillLevel(next, tree, filtroTipos);
    if (level.kind === 'linhas' || level.kind === 'root' || level.items.length !== 1) break;
    const only = level.items[0];
    if (!only.navigable) break;
    next = [...next, { kind: only.kind, key: only.key, label: only.label, node: only.node }];
  }

  return next;
}

export function drillBack(path, index = -1) {
  if (!path?.length) return [];
  if (index < 0) return path.slice(0, -1);
  return path.slice(0, index + 1);
}

export function drillBreadcrumb(path) {
  return path.map((seg, i) => ({ ...seg, index: i }));
}
