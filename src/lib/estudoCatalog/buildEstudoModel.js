/**
 * Modelo de catálogo a partir do manifest Excel (estudo) — única fonte na UI Novo Ecosistema.
 * Estoque vem das colunas Excel (job nocturno actualiza via codigo_interno); sem Supabase em runtime.
 */

import { linhaPathwayKey, PATHWAY_PAPEL_ORDER } from '@/lib/estudoCatalog/pathwayMeta';

function trim(s) {
  return String(s ?? '').trim();
}

function slugPc(nome) {
  return trim(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'PC';
}

function formatQtyLabel(quantidade, sigla) {
  const q = Number(quantidade) || 0;
  const unit = sigla || 'UN';
  return `${q.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unit}`;
}

function hasExcelStock(raw) {
  if (raw.estoque_atual == null || raw.estoque_atual === '') return false;
  const n = Number(raw.estoque_atual);
  return Number.isFinite(n);
}

function mapRowFromExcel(raw) {
  const hasStock = hasExcelStock(raw);
  const est = hasStock ? Number(raw.estoque_atual) : 0;
  const sigla = trim(raw.estoque_sigla) || 'UN';
  const ponto = Number(raw.estoque_minimo) || 0;
  const alertaMix = raw.status_mix && raw.status_mix !== 'tem';

  return {
    ...raw,
    id: raw.codigo_interno,
    estoque: est,
    estoque_vitrine: est,
    estoque_sigla: sigla,
    estoque_label: hasStock ? formatQtyLabel(est, sigla) : '—',
    estoque_virtual: false,
    estoque_pendente: 0,
    estoque_encontrado: hasStock,
    estoque_minimo: ponto,
    estoque_atualizado_em: raw.estoque_atualizado_em || null,
    zerado: hasStock ? est <= 0 : false,
    abaixo_ponto: hasStock && ponto > 0 && est < ponto,
    alerta_estudo: alertaMix,
    fonte_excel: true,
    produto: null,
    produto_compra_codigo: raw.solo ? '' : slugPc(raw.produto_compra_nome || raw.produto_compra),
  };
}

/** Agrega estoque de SKUs enriquecidos (só colunas Excel). */
function estudoEstoqueGrupo(skus) {
  const enrichedRows = skus || [];
  if (!enrichedRows.length) return { label: '—', quantidade: 0, sigla: '', mixed: false, virtual: false };

  const withStock = enrichedRows.filter((s) => s.estoque_encontrado);
  if (!withStock.length) return { label: '—', quantidade: 0, sigla: '', mixed: false, virtual: false };

  const siglas = new Set(withStock.map((s) => s.estoque_sigla || 'UN'));
  if (siglas.size > 1) {
    const q = withStock.reduce((a, s) => a + (s.estoque_vitrine ?? 0), 0);
    return {
      quantidade: q,
      sigla: 'UN',
      label: formatQtyLabel(q, 'UN'),
      mixed: true,
      virtual: false,
    };
  }

  const sigla = [...siglas][0] || 'UN';
  const q = withStock.reduce((a, s) => a + (s.estoque_vitrine ?? 0), 0);
  return {
    quantidade: q,
    sigla,
    label: formatQtyLabel(q, sigla),
    mixed: false,
    virtual: false,
  };
}

/** Enriquece linhas do manifest — só Excel, sem cadastro em runtime. */
export function enrichEstudoRows(manifest) {
  const rows = manifest?.skus || [];
  return rows.map(mapRowFromExcel);
}

function attachStockSummary(node, skus) {
  const grp = estudoEstoqueGrupo(skus);
  return {
    ...node,
    estoque_label: grp.label,
    estoque_quantidade: grp.quantidade,
    estoque_virtual: grp.virtual,
    sku_count: skus.length,
  };
}

/** Árvore: bloco → grupo → core → pathway → LINHA → produto compra → SKU */
export function buildEstudoTree(enriched) {
  const blocoMap = new Map();

  for (const row of enriched) {
    const blocoKey = row.bloco || '(sem bloco)';
    if (!blocoMap.has(blocoKey)) {
      blocoMap.set(blocoKey, { bloco: blocoKey, grupos: new Map() });
    }
    const bloco = blocoMap.get(blocoKey);

    const grupoKey = trim(row.grupo) || '';
    if (!bloco.grupos.has(grupoKey)) {
      bloco.grupos.set(grupoKey, {
        grupo: grupoKey,
        grupo_ordem: Number(row.grupo_ordem) || (grupoKey ? 900 : 0),
        cores: new Map(),
      });
    }
    const grupoNode = bloco.grupos.get(grupoKey);

    const coreKey = trim(row.core) || '(sem core)';
    if (!grupoNode.cores.has(coreKey)) {
      grupoNode.cores.set(coreKey, { core: coreKey, pathways: new Map() });
    }
    const coreNode = grupoNode.cores.get(coreKey);

    const pathwayKey = row.pathway_papel || 'default';
    if (!coreNode.pathways.has(pathwayKey)) {
      coreNode.pathways.set(pathwayKey, {
        pathway_papel: pathwayKey,
        pathway_ordem: PATHWAY_PAPEL_ORDER[pathwayKey] ?? 90,
        linhas: new Map(),
      });
    }
    const pathwayNode = coreNode.pathways.get(pathwayKey);

    const linKey = row.linha_pathway_key || linhaPathwayKey(row.linha_codigo, row.pathway_sufixo);
    if (!pathwayNode.linhas.has(linKey)) {
      pathwayNode.linhas.set(linKey, {
        linha_pathway_key: linKey,
        linha_codigo: row.linha_codigo,
        linha_nome: row.linha_nome,
        linha_display: row.linha_display || row.linha_nome,
        pathway_sufixo: row.pathway_sufixo || '',
        pathway_papel: row.pathway_papel || 'default',
        linha_tipo: row.linha_tipo,
        linha_ordem: row.linha_ordem,
        core: row.core,
        etapa: row.etapa,
        pcs: new Map(),
        solos: [],
      });
    }
    const lin = pathwayNode.linhas.get(linKey);

    if (row.solo) {
      lin.solos.push(row);
      continue;
    }

    const pk = row.produto_compra_codigo;
    if (!lin.pcs.has(pk)) {
      lin.pcs.set(pk, {
        produto_compra_codigo: pk,
        produto_compra_nome: row.produto_compra_nome || row.produto_compra,
        skus: [],
      });
    }
    lin.pcs.get(pk).skus.push(row);
  }

  const sortPc = (a, b) => (a.produto_compra_nome || '').localeCompare(b.produto_compra_nome || '', 'pt-BR');

  const finalizeLinha = (lin) => {
    const pcs = [...lin.pcs.values()].sort(sortPc).map((pc) => {
      const skus = pc.skus || [];
      return attachStockSummary({ ...pc, skus }, skus);
    });
    const allSkus = [...pcs.flatMap((p) => p.skus), ...(lin.solos || [])];
    return attachStockSummary(
      { ...lin, pcs, solos: lin.solos.sort((a, b) => (a.novo_sku || '').localeCompare(b.novo_sku || '', 'pt-BR')) },
      allSkus,
    );
  };

  return [...blocoMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([_, bloco]) => {
      const grupos = [...bloco.grupos.entries()]
        .sort(([, a], [, b]) => {
          const ordA = a.grupo_ordem ?? 900;
          const ordB = b.grupo_ordem ?? 900;
          if (ordA !== ordB) return ordA - ordB;
          return (a.grupo || '').localeCompare(b.grupo || '', 'pt-BR');
        })
        .map(([, grupoNode]) => {
          const cores = [...grupoNode.cores.entries()]
            .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
            .map(([____, coreNode]) => {
              const pathways = [...coreNode.pathways.values()]
                .sort((a, b) => a.pathway_ordem - b.pathway_ordem)
                .map((pw) => {
                  const linhas = [...pw.linhas.values()]
                    .sort((a, b) => a.linha_ordem - b.linha_ordem || (a.linha_nome || '').localeCompare(b.linha_nome || '', 'pt-BR'))
                    .map(finalizeLinha);
                  const pwSkus = linhas.flatMap((l) => [...(l.pcs || []).flatMap((p) => p.skus), ...(l.solos || [])]);
                  return attachStockSummary({ ...pw, linhas }, pwSkus);
                });
              const coreSkus = pathways.flatMap((p) => p.linhas.flatMap((l) => [...(l.pcs || []).flatMap((pc) => pc.skus), ...(l.solos || [])]));
              return attachStockSummary({ core: coreNode.core, pathways }, coreSkus);
            });
          const grupoSkus = cores.flatMap((c) => c.pathways.flatMap((p) => p.linhas.flatMap((l) => [...(l.pcs || []).flatMap((pc) => pc.skus), ...(l.solos || [])])));
          return attachStockSummary(
            { grupo: grupoNode.grupo, grupo_ordem: grupoNode.grupo_ordem, cores },
            grupoSkus,
          );
        });
      const blocoSkus = grupos.flatMap((g) => g.cores.flatMap((c) => c.pathways.flatMap((p) => p.linhas.flatMap((l) => [...(l.pcs || []).flatMap((pc) => pc.skus), ...(l.solos || [])]))));
      return attachStockSummary({ bloco: bloco.bloco, grupos }, blocoSkus);
    });
}

function pcKey(row) {
  const base = row.linha_pathway_key || linhaPathwayKey(row.linha_codigo, row.pathway_sufixo);
  if (row.solo) return `${base}::solo`;
  return `${base}::${row.produto_compra_codigo}`;
}

export function buildEstudoSupplyLines(enriched) {
  const map = new Map();

  for (const row of enriched) {
    const key = pcKey(row);
    if (!map.has(key)) {
      map.set(key, {
        key,
        bloco: row.bloco,
        sub_bloco: row.sub_bloco,
        grupo: row.grupo,
        core: row.core,
        pathway_papel: row.pathway_papel,
        linha_pathway_key: row.linha_pathway_key,
        linha_codigo: row.linha_codigo,
        linha_nome: row.linha_nome,
        linha_tipo: row.linha_tipo,
        linha_ordem: row.linha_ordem,
        produto_compra_codigo: row.produto_compra_codigo,
        produto_compra_nome: row.solo ? '(solo — SKUs directos)' : row.produto_compra_nome,
        solo: row.solo,
        skus: [],
        estoque_total: 0,
        zerados: 0,
        abaixo_massa: 0,
        sku_count: 0,
        saldavel: true,
        alerta: false,
        massa_critica: 16,
        min_linhas_saldavel: 9,
        linhas_com_massa_critica: 0,
      });
    }
    const g = map.get(key);
    g.skus.push(row);
    g.estoque_total += row.estoque_vitrine ?? row.estoque ?? 0;
    if (row.zerado) g.zerados += 1;
    if (row.abaixo_ponto) g.abaixo_massa += 1;
    if (row.alerta_estudo) g.alerta = true;
  }

  return [...map.values()]
    .map((g) => {
      const skuCount = g.skus.length;
      const comMassa = g.skus.filter((s) => (s.estoque_vitrine ?? s.estoque ?? 0) >= 16).length;
      const saldavel = comMassa >= Math.min(9, skuCount);
      const sigla = g.skus[0]?.estoque_sigla || 'cx';
      return {
        ...g,
        sku_count: skuCount,
        estoque_label: `${g.estoque_total} ${sigla}`,
        linhas_com_massa_critica: comMassa,
        saldavel,
        alerta: g.alerta || g.zerados > 0 || !saldavel,
      };
    })
    .sort((a, b) => {
      if (a.linha_ordem !== b.linha_ordem) return a.linha_ordem - b.linha_ordem;
      return (a.produto_compra_nome || '').localeCompare(b.produto_compra_nome || '', 'pt-BR');
    });
}

export function listEstudoLinhas(enriched) {
  const set = new Map();
  for (const row of enriched) {
    if (!set.has(row.linha_codigo)) {
      set.set(row.linha_codigo, {
        codigo: row.linha_codigo,
        nome: row.linha_nome,
        tipo: row.linha_tipo,
        ordem: row.linha_ordem,
      });
    }
  }
  return [...set.values()].sort((a, b) => a.ordem - b.ordem);
}

export function countEstudoEstoqueEncontrado(enriched) {
  let found = 0;
  for (const row of enriched || []) {
    if (row.estoque_encontrado) found += 1;
  }
  return { found, total: enriched?.length || 0 };
}
