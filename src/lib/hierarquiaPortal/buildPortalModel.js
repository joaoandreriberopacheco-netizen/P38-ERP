import { planLinhaCompraAnalise, norm } from '@/lib/hierarquiaPortal/planLinhaCompra';
import { inferirLinhaCodigo, findLinhaMeta } from '@/lib/hierarquiaPortal/inferirLinha';
import { getPortalExcelSku, findPortalExcelLinha } from '@/lib/hierarquiaPortal/portalExcelManifest';
import { portalEstoqueSku, portalEstoqueGrupo } from '@/lib/hierarquiaPortal/portalStockFormat';

function trim(s) {
  return String(s || '').trim();
}

function slugCodigo(s) {
  return norm(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'ITEM';
}

function mapTipoLinha(tipoMestre) {
  if (tipoMestre === 'solo' || tipoMestre === 'mix' || tipoMestre === 'portfolio') return tipoMestre;
  return 'mix';
}

export function enrichProdutoPortal(produto) {
  const excel = getPortalExcelSku(produto);
  const plan = planLinhaCompraAnalise(produto);
  const vitrine = portalEstoqueSku(produto);
  const estoqueBase = Number(produto.estoque_atual) || 0;
  const ponto = Number(produto.estoque_minimo) || 0;

  if (excel) {
    const linhaMeta = findPortalExcelLinha(excel.linha_codigo) || {
      codigo: excel.linha_codigo,
      nome: excel.linha_nome,
      tipo: 'portfolio',
      ordem: 10,
    };
    const linhaTipo = mapTipoLinha(linhaMeta.tipo);
    const solo = linhaTipo === 'solo';
    const pcNome = solo ? '' : trim(excel.produto_compra);
    const pcCodigo = solo ? '' : (excel.produto_compra_codigo || slugCodigo(pcNome));

    return {
      produto,
      categoria: trim(excel.categoria) || trim(produto.categoria_nome) || '(sem categoria)',
      linha_codigo: linhaMeta.codigo,
      linha_nome: linhaMeta.nome,
      linha_tipo: linhaTipo,
      linha_ordem: linhaMeta.ordem ?? 10,
      produto_compra_codigo: pcCodigo,
      produto_compra_nome: pcNome,
      solo,
      eixo_a: excel.ex_a || plan.eixo_a || '',
      eixo_b: excel.ex_b || plan.eixo_b || '',
      eixo_a_rotulo: excel.ex_a || plan.eixo_a_rotulo || '',
      eixo_b_rotulo: excel.ex_b || plan.eixo_b_rotulo || '',
      confianca: 'excel',
      estoque: estoqueBase,
      estoque_vitrine: vitrine.quantidade,
      estoque_sigla: vitrine.sigla,
      estoque_label: vitrine.label,
      abaixo_ponto: estoqueBase < ponto,
      zerado: estoqueBase <= 0,
      fonte_excel: true,
    };
  }

  const linhaCod = inferirLinhaCodigo(produto);
  const linhaMeta = findLinhaMeta(linhaCod);
  const linhaTipo = mapTipoLinha(linhaMeta.tipo);
  const solo = linhaTipo === 'solo';
  const pcNome = solo ? '' : trim(plan.produto_compra_nome);
  const pcCodigo = solo ? '' : slugCodigo(pcNome || linhaMeta.codigo);

  return {
    produto,
    categoria: trim(produto.categoria_nome) || '(sem categoria)',
    linha_codigo: linhaMeta.codigo,
    linha_nome: linhaMeta.nome,
    linha_tipo: linhaTipo,
    linha_ordem: linhaMeta.ordem,
    produto_compra_codigo: pcCodigo,
    produto_compra_nome: pcNome,
    solo,
    eixo_a: plan.eixo_a || '',
    eixo_b: plan.eixo_b || '',
    eixo_a_rotulo: plan.eixo_a_rotulo || '',
    eixo_b_rotulo: plan.eixo_b_rotulo || '',
    confianca: plan.confianca,
    estoque: estoqueBase,
    estoque_vitrine: vitrine.quantidade,
    estoque_sigla: vitrine.sigla,
    estoque_label: vitrine.label,
    abaixo_ponto: estoqueBase < ponto,
    zerado: estoqueBase <= 0,
    fonte_excel: false,
  };
}

function pcKey(row) {
  if (row.solo) return `${row.linha_codigo}::solo`;
  return `${row.linha_codigo}::${row.produto_compra_codigo}`;
}

export function buildPortalSupplyLines(enriched) {
  const map = new Map();

  for (const row of enriched) {
    const key = pcKey(row);
    if (!map.has(key)) {
      map.set(key, {
        key,
        categoria: row.categoria,
        linha_codigo: row.linha_codigo,
        linha_nome: row.linha_nome,
        linha_tipo: row.linha_tipo,
        linha_ordem: row.linha_ordem,
        produto_compra_codigo: row.produto_compra_codigo,
        produto_compra_nome: row.solo ? '(solo — SKUs directos)' : row.produto_compra_nome,
        solo: row.solo,
        skus: [],
        estoque_total: 0,
        estoque_label: '',
        estoque_sigla: '',
        zerados: 0,
        abaixo_ponto: 0,
        eixo_a_rotulo: row.eixo_a_rotulo,
        eixo_b_rotulo: row.eixo_b_rotulo,
      });
    }
    const g = map.get(key);
    g.skus.push(row);
    g.estoque_total += row.estoque_vitrine ?? row.estoque;
    if (row.zerado) g.zerados += 1;
    if (row.abaixo_ponto) g.abaixo_ponto += 1;
  }

  return [...map.values()]
    .map((g) => {
      const grp = portalEstoqueGrupo(g.skus);
      return {
        ...g,
        sku_count: g.skus.length,
        estoque_total: grp.quantidade,
        estoque_label: grp.label,
        estoque_sigla: grp.sigla,
        alerta: g.zerados > 0 || g.abaixo_ponto > g.skus.length / 2,
        pfut_simulado: g.zerados === g.skus.length ? -3 : g.abaixo_ponto > 0 ? -1 : 12,
      };
    })
    .sort((a, b) => {
      if (a.linha_ordem !== b.linha_ordem) return a.linha_ordem - b.linha_ordem;
      return (a.produto_compra_nome || '').localeCompare(b.produto_compra_nome, 'pt-BR');
    });
}

export function buildPortalTree(enriched) {
  const catMap = new Map();

  for (const row of enriched) {
    if (!catMap.has(row.categoria)) catMap.set(row.categoria, new Map());
    const linMap = catMap.get(row.categoria);
    if (!linMap.has(row.linha_codigo)) {
      linMap.set(row.linha_codigo, {
        linha_codigo: row.linha_codigo,
        linha_nome: row.linha_nome,
        linha_tipo: row.linha_tipo,
        linha_ordem: row.linha_ordem,
        pcs: new Map(),
        solos: [],
      });
    }
    const lin = linMap.get(row.linha_codigo);

    if (row.solo) {
      lin.solos.push(row);
      continue;
    }

    const pk = row.produto_compra_codigo;
    if (!lin.pcs.has(pk)) {
      lin.pcs.set(pk, {
        produto_compra_codigo: pk,
        produto_compra_nome: row.produto_compra_nome,
        eixo_a_rotulo: row.eixo_a_rotulo,
        eixo_b_rotulo: row.eixo_b_rotulo,
        skus: [],
      });
    }
    lin.pcs.get(pk).skus.push(row);
  }

  const categorias = [...catMap.entries()]
    .map(([nome, linMap]) => ({
      nome,
      linhas: [...linMap.values()]
        .sort((a, b) => a.linha_ordem - b.linha_ordem)
        .map((lin) => ({
          ...lin,
          pcs: [...lin.pcs.values()].sort((a, b) =>
            a.produto_compra_nome.localeCompare(b.produto_compra_nome, 'pt-BR'),
          ),
          solos: lin.solos.sort((a, b) => (a.produto.nome || '').localeCompare(b.produto.nome || '', 'pt-BR')),
        })),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return categorias;
}

export function listPortalLinhas(enriched) {
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
