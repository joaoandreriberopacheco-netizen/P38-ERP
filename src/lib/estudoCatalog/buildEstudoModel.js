/**
 * Modelo de catálogo a partir do manifest Excel (estudo) — sem Supabase/Base44.
 */

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

/** Estoque simulado determinístico (só preview — não é BD). */
function estoqueSimulado(codigo) {
  let h = 0;
  const s = String(codigo || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 997;
  return h % 24;
}

function mapRow(raw) {
  const est = estoqueSimulado(raw.codigo_interno);
  const zerado = est <= 0;
  const abaixo = est > 0 && est < 4;
  const alertaMix = raw.status_mix && raw.status_mix !== 'tem';

  return {
    ...raw,
    id: raw.codigo_interno,
    estoque: est,
    estoque_vitrine: est,
    estoque_label: `${est} cx`,
    estoque_sigla: 'cx',
    zerado,
    abaixo_ponto: abaixo,
    alerta_estudo: alertaMix,
    fonte_excel: true,
    produto: {
      id: raw.codigo_interno,
      codigo_interno: raw.codigo_interno,
      nome: raw.novo_sku || raw.sku_atual,
      descricao: raw.sku_atual,
    },
    produto_compra_codigo: raw.solo ? '' : slugPc(raw.produto_compra_nome || raw.produto_compra),
  };
}

export function enrichEstudoRows(manifest) {
  return (manifest?.skus || []).map(mapRow);
}

/** Árvore: bloco → sub_bloco → linha → produto compra → SKU */
export function buildEstudoTree(enriched) {
  const blocoMap = new Map();

  for (const row of enriched) {
    const blocoKey = row.bloco || '(sem bloco)';
    if (!blocoMap.has(blocoKey)) {
      blocoMap.set(blocoKey, { bloco: blocoKey, sub_blocos: new Map() });
    }
    const bloco = blocoMap.get(blocoKey);

    const subKey = row.sub_bloco || '(sem sub-bloco)';
    if (!bloco.sub_blocos.has(subKey)) {
      bloco.sub_blocos.set(subKey, { sub_bloco: subKey, linhas: new Map() });
    }
    const sub = bloco.sub_blocos.get(subKey);

    const linKey = row.linha_codigo;
    if (!sub.linhas.has(linKey)) {
      sub.linhas.set(linKey, {
        linha_codigo: row.linha_codigo,
        linha_nome: row.linha_nome,
        linha_tipo: row.linha_tipo,
        linha_ordem: row.linha_ordem,
        core: row.core,
        etapa: row.etapa,
        pcs: new Map(),
        solos: [],
      });
    }
    const lin = sub.linhas.get(linKey);

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

  return [...blocoMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([_, bloco]) => ({
      bloco: bloco.bloco,
      sub_blocos: [...bloco.sub_blocos.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
        .map(([__, sub]) => ({
          sub_bloco: sub.sub_bloco,
          linhas: [...sub.linhas.values()]
            .sort((a, b) => a.linha_ordem - b.linha_ordem)
            .map((lin) => ({
              ...lin,
              pcs: [...lin.pcs.values()].sort(sortPc),
              solos: lin.solos.sort((a, b) =>
                (a.novo_sku || '').localeCompare(b.novo_sku || '', 'pt-BR'),
              ),
            })),
        })),
    }));
}

function pcKey(row) {
  if (row.solo) return `${row.linha_codigo}::solo`;
  return `${row.linha_codigo}::${row.produto_compra_codigo}`;
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
    g.estoque_total += row.estoque;
    if (row.zerado) g.zerados += 1;
    if (row.abaixo_ponto) g.abaixo_massa += 1;
    if (row.alerta_estudo) g.alerta = true;
  }

  return [...map.values()]
    .map((g) => {
      const skuCount = g.skus.length;
      const comMassa = g.skus.filter((s) => s.estoque >= 16).length;
      const saldavel = comMassa >= Math.min(9, skuCount);
      return {
        ...g,
        sku_count: skuCount,
        estoque_label: `${g.estoque_total} cx`,
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
