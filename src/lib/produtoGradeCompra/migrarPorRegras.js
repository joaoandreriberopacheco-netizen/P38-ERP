import { mapTintaH3ToProdutoCompra } from './tintaProdutoCompraMap';
import { norm, slug } from './catalogoGradeIA';

function trim(s) {
  return String(s || '').trim();
}

function soldavelProdutoCompraNome(h1, h3) {
  const peca = norm(h1);
  const d3 = norm(h3);
  if (peca === 'JOELHO') {
    if (d3 === 'MISTO') return 'JOELHO MISTO SOLDÁVEL';
    if (d3 === '45' || d3 === '90') return `JOELHO ${d3}° SOLDÁVEL`;
  }
  return `${peca} SOLDÁVEL`;
}

function soldavelEixoB(h1, h3, h4) {
  const peca = norm(h1);
  const d3 = trim(h3);
  const d4 = trim(h4);
  if (peca === 'JOELHO' && ['45', '90', 'MISTO'].includes(norm(h3))) return d4 || d3;
  return d3 || d4;
}

function isSoldavel(produto) {
  const h2 = norm(produto.campo_hierarquico_2);
  return h2 === 'SOLDÁVEL' || h2 === 'SOLDAVEL';
}

/**
 * Migração determinística (mesmas regras do script migrar-produto-grade-compra.mjs + h1 genérico).
 * Não usa Edge Function / IA.
 */
export function planMigracaoPorRegras(produto = {}) {
  const h1 = trim(produto.campo_hierarquico_1);
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  const h4 = trim(produto.campo_hierarquico_4);

  if (!h1) return null;

  const h1u = norm(h1);

  // --- PISO ---
  if (h1u === 'PISO' && h2 && h3) {
    return {
      linha_codigo: 'PISO',
      linha_nome: 'PISO',
      linha_tipo: 'portfolio',
      eixo_a_rotulo: 'Formato',
      eixo_b_rotulo: 'Modelo',
      produto_compra_codigo: 'PISO',
      produto_compra_nome: 'PISO',
      eixo_a: h2,
      eixo_b: h3,
      confianca: 'alta',
      motivo_curto: 'h1=PISO, h2×h3',
    };
  }

  // --- CIMENTO ---
  if (h1u.includes('CIMENTO')) {
    const pcCod = h1u.includes('BRANCO') ? 'CIMENTO_BRANCO' : 'CIMENTO_PORTLAND';
    const pcNome = h1u.includes('BRANCO') ? 'CIMENTO BRANCO' : 'CIMENTO PORTLAND';
    return {
      linha_codigo: 'CIMENTO',
      linha_nome: 'CIMENTO',
      linha_tipo: 'solo',
      produto_compra_codigo: pcCod,
      produto_compra_nome: pcNome,
      eixo_a: '',
      eixo_b: '',
      confianca: 'alta',
      motivo_curto: 'h1 cimento',
    };
  }

  // --- ARGAMASSA ---
  if (h1u === 'ARGAMASSA' && h2 && h3) {
    return {
      linha_codigo: 'ARGAMASSA',
      linha_nome: 'ARGAMASSA',
      linha_tipo: 'linha_mix',
      eixo_a_rotulo: 'Classe',
      eixo_b_rotulo: 'Embalagem',
      produto_compra_codigo: 'ARGAMASSA',
      produto_compra_nome: 'ARGAMASSA',
      eixo_a: h3,
      eixo_b: h2,
      confianca: 'alta',
      motivo_curto: 'h1=ARGAMASSA',
    };
  }

  // --- SOLDÁVEL ---
  if (isSoldavel(produto)) {
    const pcNome = soldavelProdutoCompraNome(h1, h3);
    const med = soldavelEixoB(h1, h3, h4);
    if (!med) return null;
    return {
      linha_codigo: 'CONEXAO_SOLDAVEL',
      linha_nome: 'CONEXÃO SOLDÁVEL',
      linha_tipo: 'linha_mix',
      eixo_a_rotulo: 'Peça',
      eixo_b_rotulo: 'Medida',
      produto_compra_codigo: slug(pcNome),
      produto_compra_nome: pcNome,
      eixo_a: '',
      eixo_b: med,
      confianca: 'alta',
      motivo_curto: 'h2=soldável',
    };
  }

  // --- TINTA ---
  if (h1u === 'TINTA' && h2) {
    const map = mapTintaH3ToProdutoCompra(h3);
    if (!map) return null;
    return {
      linha_codigo: 'TINTA',
      linha_nome: 'TINTA',
      linha_tipo: 'portfolio',
      eixo_a_rotulo: 'Embalagem',
      eixo_b_rotulo: 'Cor / detalhe',
      produto_compra_codigo: map.codigo,
      produto_compra_nome: map.nome,
      eixo_a: h2,
      eixo_b: h4 || '',
      confianca: 'alta',
      motivo_curto: 'h1=TINTA',
    };
  }

  // --- Genérico: h1 vira linha; h2×h3 como eixos quando existem ---
  const linhaCodigo = slug(h1u).slice(0, 60);
  if (!linhaCodigo) return null;

  if (h2 && h3) {
    return {
      linha_codigo: linhaCodigo,
      linha_nome: h1u,
      linha_tipo: 'linha_mix',
      eixo_a_rotulo: 'Variante A',
      eixo_b_rotulo: 'Variante B',
      produto_compra_codigo: linhaCodigo,
      produto_compra_nome: h1u,
      eixo_a: h2,
      eixo_b: h3,
      confianca: 'media',
      motivo_curto: 'h1→linha, h2×h3',
    };
  }

  if (h2) {
    return {
      linha_codigo: linhaCodigo,
      linha_nome: h1u,
      linha_tipo: 'portfolio',
      eixo_a_rotulo: 'Detalhe',
      eixo_b_rotulo: 'Modelo',
      produto_compra_codigo: linhaCodigo,
      produto_compra_nome: h1u,
      eixo_a: h2,
      eixo_b: h4 || h3 || '',
      confianca: 'media',
      motivo_curto: 'h1→linha, h2',
    };
  }

  return {
    linha_codigo: linhaCodigo,
    linha_nome: h1u,
    linha_tipo: 'solo',
    produto_compra_codigo: linhaCodigo,
    produto_compra_nome: h1u,
    eixo_a: '',
    eixo_b: '',
    confianca: 'media',
    motivo_curto: 'h1→linha solo',
  };
}

export function planMigracaoPorRegrasBatch(produtos = []) {
  const updates = [];
  const skipped = [];
  for (const p of produtos) {
    const patch = planMigracaoPorRegras(p);
    if (!patch) {
      skipped.push({ produto: p, reason: 'sem_h1' });
      continue;
    }
    updates.push({ produto: p, patch });
  }
  return { updates, skipped };
}
