/**
 * Modelo de catálogo a partir do manifest Excel (estudo) + estoque real do cadastro.
 */

import { portalEstoqueSku, portalEstoqueGrupo } from '@/lib/hierarquiaPortal/portalStockFormat';
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

function normCodigo(c) {
  return trim(c).toUpperCase();
}

/** Estoque simulado quando SKU não existe no cadastro (fallback preview). */
function estoqueSimulado(codigo) {
  let h = 0;
  const s = String(codigo || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 997;
  return h % 24;
}

function mapRowSimulado(raw) {
  const est = estoqueSimulado(raw.codigo_interno);
  const zerado = est <= 0;
  const abaixo = est > 0 && est < 4;
  const alertaMix = raw.status_mix && raw.status_mix !== 'tem';

  return {
    ...raw,
    id: raw.codigo_interno,
    estoque: est,
    estoque_vitrine: est,
    estoque_sigla: 'cx',
    estoque_label: `${est} cx`,
    estoque_virtual: false,
    estoque_pendente: 0,
    estoque_encontrado: false,
    zerado,
    abaixo_ponto: abaixo,
    alerta_estudo: alertaMix,
    fonte_excel: true,
    produto: null,
    produto_compra_codigo: raw.solo ? '' : slugPc(raw.produto_compra_nome || raw.produto_compra),
  };
}

function mapRowComProduto(raw, produto, catalogStockContext) {
  const vitrine = portalEstoqueSku(produto, catalogStockContext);
  const estoqueBase = vitrine.quantidade;
  const ponto = Number(produto.estoque_minimo) || 0;
  const alertaMix = raw.status_mix && raw.status_mix !== 'tem';

  return {
    ...raw,
    id: raw.codigo_interno,
    produto,
    produto_id: produto.id,
    estoque: estoqueBase,
    estoque_vitrine: vitrine.quantidade,
    estoque_sigla: vitrine.sigla,
    estoque_label: vitrine.label,
    estoque_virtual: vitrine.virtual,
    estoque_pendente: vitrine.pendente,
    estoque_encontrado: true,
    zerado: estoqueBase <= 0,
    abaixo_ponto: ponto > 0 && estoqueBase < ponto,
    alerta_estudo: alertaMix,
    fonte_excel: true,
    produto_compra_codigo: raw.solo ? '' : slugPc(raw.produto_compra_nome || raw.produto_compra),
  };
}

/** Indexa produtos activos por codigo_interno. */
export function indexProdutosPorCodigo(produtos = []) {
  const map = new Map();
  for (const p of produtos) {
    const cod = normCodigo(p?.codigo_interno);
    if (cod && !map.has(cod)) map.set(cod, p);
  }
  return map;
}

/** Enriquece linhas do manifest com estoque real (cadastro) ou simulado. */
export function enrichEstudoRows(manifest, { produtoByCodigo = null, catalogStockContext = null } = {}) {
  const rows = manifest?.skus || [];
  if (!produtoByCodigo?.size) {
    return rows.map(mapRowSimulado);
  }
  return rows.map((raw) => {
    const produto = produtoByCodigo.get(normCodigo(raw.codigo_interno));
    if (produto) return mapRowComProduto(raw, produto, catalogStockContext);
    return mapRowSimulado(raw);
  });
}

function countSkusInLinha(lin) {
  const pcs = lin.pcs || [];
  const solos = lin.solos || [];
  return pcs.reduce((a, p) => a + (p.skus?.length || 0), 0) + solos.length;
}

function attachStockSummary(node, skus, catalogStockContext = null) {
  const grp = portalEstoqueGrupo(skus, catalogStockContext);
  return {
    ...node,
    estoque_label: grp.label,
    estoque_quantidade: grp.quantidade,
    estoque_virtual: grp.virtual,
    sku_count: skus.length,
  };
}

/** Árvore: bloco → sub_bloco → grupo → core → pathway → LINHA → produto compra → SKU */
export function buildEstudoTree(enriched, { catalogStockContext = null } = {}) {
  const blocoMap = new Map();

  for (const row of enriched) {
    const blocoKey = row.bloco || '(sem bloco)';
    if (!blocoMap.has(blocoKey)) {
      blocoMap.set(blocoKey, { bloco: blocoKey, sub_blocos: new Map() });
    }
    const bloco = blocoMap.get(blocoKey);

    const subKey = row.sub_bloco || '(sem sub-bloco)';
    if (!bloco.sub_blocos.has(subKey)) {
      bloco.sub_blocos.set(subKey, { sub_bloco: subKey, grupos: new Map() });
    }
    const sub = bloco.sub_blocos.get(subKey);

    const grupoKey = trim(row.grupo) || '';
    if (!sub.grupos.has(grupoKey)) {
      sub.grupos.set(grupoKey, {
        grupo: grupoKey,
        grupo_ordem: Number(row.grupo_ordem) || (grupoKey ? 900 : 0),
        cores: new Map(),
      });
    }
    const grupoNode = sub.grupos.get(grupoKey);

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
      return attachStockSummary({ ...pc, skus }, skus, catalogStockContext);
    });
    const allSkus = [...pcs.flatMap((p) => p.skus), ...(lin.solos || [])];
    return attachStockSummary(
      { ...lin, pcs, solos: lin.solos.sort((a, b) => (a.novo_sku || '').localeCompare(b.novo_sku || '', 'pt-BR')) },
      allSkus,
      catalogStockContext,
    );
  };

  return [...blocoMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([_, bloco]) => ({
      bloco: bloco.bloco,
      sub_blocos: [...bloco.sub_blocos.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
        .map(([__, sub]) => {
          const grupos = [...sub.grupos.entries()]
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
                      return attachStockSummary({ ...pw, linhas }, pwSkus, catalogStockContext);
                    });
                  const coreSkus = pathways.flatMap((p) => p.linhas.flatMap((l) => [...(l.pcs || []).flatMap((pc) => pc.skus), ...(l.solos || [])]));
                  return attachStockSummary({ core: coreNode.core, pathways }, coreSkus, catalogStockContext);
                });
              const grupoSkus = cores.flatMap((c) => c.pathways.flatMap((p) => p.linhas.flatMap((l) => [...(l.pcs || []).flatMap((pc) => pc.skus), ...(l.solos || [])])));
              return attachStockSummary(
                { grupo: grupoNode.grupo, grupo_ordem: grupoNode.grupo_ordem, cores },
                grupoSkus,
                catalogStockContext,
              );
            });
          const subSkus = grupos.flatMap((g) => g.cores.flatMap((c) => c.pathways.flatMap((p) => p.linhas.flatMap((l) => [...(l.pcs || []).flatMap((pc) => pc.skus), ...(l.solos || [])]))));
          return attachStockSummary({ sub_bloco: sub.sub_bloco, grupos }, subSkus, catalogStockContext);
        }),
    }));
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
