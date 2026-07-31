/**
 * Painel Blade Ranger — simulação Excel (ruptura / ponto futuro).
 * Metáfora: luz amarela = risco futuro; vermelha = ruptura já ocorreu.
 */

import { findLinhaMeta, inferirLinhaCodigo, norm, trim } from './inferirLinha.js';

const DIAS_MEDIA = 30;

export function inferirProdutoCompraLabel(produto, linhaCodigo, linhaTipo) {
  const h1 = trim(produto.campo_hierarquico_1);
  if (linhaTipo === 'solo') return findLinhaMeta(linhaCodigo)?.nome || linhaCodigo;
  if (['SOLDAVEL', 'ESGOTO', 'ROSCAVEL', 'FIXACAO', 'MASSA', 'REJUNTE', 'ARGAMASSA', 'IMPERMEABILIZACAO'].includes(linhaCodigo)) {
    return h1 || trim(produto.nome) || '—';
  }
  if (linhaCodigo === 'TINTA') {
    const h3 = trim(produto.campo_hierarquico_3);
    if (h3 && h1) return `${h1} · ${h3}`;
    return h1 || trim(produto.nome) || '—';
  }
  if (linhaCodigo === 'CERAMICA' || linhaCodigo === 'HIDRAULICA') {
    const h3 = trim(produto.campo_hierarquico_3);
    if (h3 && h1) return `${h1} · ${h3}`;
    return h1 || trim(produto.nome) || '—';
  }
  return h1 || trim(produto.nome) || '—';
}

/** Média 30d projetada a partir de vendas 60d (mesma regra do catálogo). */
export function media30FromVelocity(velocity) {
  const qtd60 = Number(velocity?.qtd60) || 0;
  return qtd60 / 2;
}

export function pontoFuturo(estoque, velocity) {
  const e = Number(estoque) || 0;
  return e - media30FromVelocity(velocity);
}

/**
 * @returns {{ luz: string, label: string, sugestao: number, media30: number, pontoFuturo: number }}
 */
export function classificarLuz(produto, velocity, estoqueAtual = produto.estoque_atual) {
  const e = Number(estoqueAtual) || 0;
  const m = Number(produto.estoque_minimo) || 0;
  const ideal = Number(produto.estoque_ideal) || 0;
  const media30 = media30FromVelocity(velocity);
  const pf = pontoFuturo(e, velocity);

  let luz = 'VERDE';
  let label = 'Saudável';

  if (!produto.ativo) {
    return { luz: 'CINZA', label: 'Inativo', sugestao: 0, media30, pontoFuturo: pf };
  }
  if (e <= 0) {
    luz = 'VERMELHA';
    label = 'Ruptura (sem estoque)';
  } else if (pf < 0) {
    luz = 'AMARELA';
    label = 'Risco no ponto futuro';
  } else if (m > 0 && e <= m) {
    luz = 'AMARELA';
    label = 'Abaixo do mínimo';
  }

  let sugestao = 0;
  if (luz === 'VERMELHA') {
    sugestao = Math.max(m, media30, ideal > 0 ? ideal : 0, 1);
  } else if (luz === 'AMARELA') {
    if (pf < 0) sugestao = Math.ceil(Math.abs(pf));
    if (ideal > 0 && e < ideal) sugestao = Math.max(sugestao, Math.ceil(ideal - e));
    if (m > 0 && e < m) sugestao = Math.max(sugestao, Math.ceil(m - e));
  }

  return { luz, label, sugestao, media30, pontoFuturo: pf };
}

const LUZ_RANK = { VERMELHA: 3, AMARELA: 2, VERDE: 1, CINZA: 0 };

export function worstLuz(luzas) {
  let best = 'CINZA';
  for (const l of luzas) {
    if ((LUZ_RANK[l] || 0) > (LUZ_RANK[best] || 0)) best = l;
  }
  return best;
}

export function skuTreeLabel(produto) {
  const parts = [
    trim(produto.campo_hierarquico_1),
    trim(produto.campo_hierarquico_2),
    trim(produto.campo_hierarquico_3),
    trim(produto.campo_hierarquico_4),
  ].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return trim(produto.nome) || 'SKU';
}

export function buildLinhaTree(produtos, velocityMap, linhasMestre) {
  const byLinha = new Map();

  for (const p of produtos) {
    const cod = inferirLinhaCodigo(p);
    const meta = findLinhaMeta(cod);
    if (!byLinha.has(cod)) {
      byLinha.set(cod, {
        codigo: cod,
        meta,
        compras: new Map(),
      });
    }
    const linha = byLinha.get(cod);
    const compraKey = inferirProdutoCompraLabel(p, cod, meta.tipo);
    if (!linha.compras.has(compraKey)) {
      linha.compras.set(compraKey, { label: compraKey, skus: [] });
    }
    const v = velocityMap[String(p.id)] || { qtd30: 0, qtd60: 0 };
    const alert = classificarLuz(p, v);
    linha.compras.get(compraKey).skus.push({ produto: p, velocity: v, alert });
  }

  const orderMap = new Map(linhasMestre.map((l, i) => [l.codigo, l.ordem ?? i]));
  const sorted = [...byLinha.values()].sort(
    (a, b) => (orderMap.get(a.codigo) ?? 999) - (orderMap.get(b.codigo) ?? 999),
  );

  const rows = [];
  const resumoLinhas = [];
  const incendios = [];

  for (const linha of sorted) {
    const meta = linha.meta;
    const compraList = [...linha.compras.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    const allSkuAlerts = compraList.flatMap((c) => c.skus.map((s) => s.alert));

    const linhaLuz = worstLuz(allSkuAlerts.map((a) => a.luz));
    const counts = { VERMELHA: 0, AMARELA: 0, VERDE: 0, CINZA: 0 };
    for (const a of allSkuAlerts) counts[a.luz] = (counts[a.luz] || 0) + 1;

    resumoLinhas.push({
      codigo: linha.codigo,
      nome: meta.nome,
      tipo: meta.tipo,
      skus: allSkuAlerts.length,
      vermelhas: counts.VERMELHA,
      amarelas: counts.AMARELA,
      verdes: counts.VERDE,
      luz: linhaLuz,
    });

    rows.push({
      nivel: 'LINHA',
      indent: 0,
      tree: `▸ ${meta.nome}`,
      linha_codigo: linha.codigo,
      linha_nome: meta.nome,
      tipo: meta.tipo,
      produto_compra: '',
      sku_nome: '',
      h1: '',
      h2: '',
      h3: '',
      luz: linhaLuz,
      luz_label: `${counts.VERMELHA} verm · ${counts.AMARELA} amar · ${counts.VERDE} ok`,
      estoque: '',
      media30: '',
      ponto_futuro: '',
      est_min: '',
      sugestao: '',
      unidade: '',
      acao: linhaLuz === 'VERDE' ? 'Observar' : 'Analisar linha — quem acendeu?',
    });

    for (const compra of compraList) {
      const compraLuz = worstLuz(compra.skus.map((s) => s.alert.luz));
      rows.push({
        nivel: 'PRODUTO COMPRA',
        indent: 1,
        tree: `  ▸ ${compra.label}`,
        linha_codigo: linha.codigo,
        linha_nome: meta.nome,
        tipo: meta.tipo,
        produto_compra: compra.label,
        sku_nome: '',
        h1: '',
        h2: '',
        h3: '',
        luz: compraLuz,
        luz_label: `${compra.skus.length} SKUs`,
        estoque: '',
        media30: '',
        ponto_futuro: '',
        est_min: '',
        sugestao: '',
        unidade: '',
        acao: compraLuz === 'VERDE' ? '—' : 'Ver SKUs com luz',
      });

      const skusSorted = [...compra.skus].sort((a, b) => {
        const ra = LUZ_RANK[a.alert.luz] || 0;
        const rb = LUZ_RANK[b.alert.luz] || 0;
        if (rb !== ra) return rb - ra;
        return skuTreeLabel(a.produto).localeCompare(skuTreeLabel(b.produto), 'pt-BR');
      });

      for (const { produto: p, velocity: v, alert } of skusSorted) {
        const un = String(p.unidade_principal || 'UN').trim().toUpperCase();
        const row = {
          nivel: 'SKU',
          indent: 2,
          tree: `    • ${skuTreeLabel(p)}`,
          linha_codigo: linha.codigo,
          linha_nome: meta.nome,
          tipo: meta.tipo,
          produto_compra: compra.label,
          sku_nome: p.nome,
          h1: trim(p.campo_hierarquico_1),
          h2: trim(p.campo_hierarquico_2),
          h3: trim(p.campo_hierarquico_3),
          luz: alert.luz,
          luz_label: alert.label,
          estoque: Number(p.estoque_atual) || 0,
          media30: alert.media30,
          ponto_futuro: alert.pontoFuturo,
          est_min: Number(p.estoque_minimo) || 0,
          sugestao: alert.sugestao,
          unidade: un,
          acao:
            alert.luz === 'VERMELHA'
              ? 'Comprar agora — fogo aberto'
              : alert.luz === 'AMARELA'
                ? 'Incluir em compra — apagar antes'
                : '—',
        };
        rows.push(row);
        if (alert.luz === 'VERMELHA' || alert.luz === 'AMARELA') {
          incendios.push(row);
        }
      }
    }
  }

  return { rows, resumoLinhas, incendios };
}

export { DIAS_MEDIA };
