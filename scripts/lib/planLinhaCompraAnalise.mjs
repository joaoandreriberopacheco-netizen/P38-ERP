/**
 * Proposta de LINHA de compra + produto_compra + eixos a partir do cadastro legado (h1–h5).
 * Só para análise/export — não altera a base de dados.
 */

const TINTA_H3_TO_PRODUTO_COMPRA = {
  ESMALTE: { codigo: 'TINTA_ESMALTE_SINTETICO', nome: 'TINTA ESMALTE SINTÉTICO' },
  'P/ PISO': { codigo: 'TINTA_P_PISO', nome: 'TINTA P/ PISO' },
  'ACR. FOSCO ECON.': { codigo: 'TINTA_ACR_FOSCO_ECON', nome: 'TINTA ACRÍLICA FOSCO ECONÔMICO' },
  'SEMI-BRILHO': { codigo: 'TINTA_SEMI_BRILHO', nome: 'TINTA SEMI-BRILHO' },
  STANDARD: { codigo: 'TINTA_STANDARD', nome: 'TINTA STANDARD' },
  'STANDARD POUPE+': { codigo: 'TINTA_STANDARD_POUPE', nome: 'TINTA STANDARD POUPE+' },
  'INT/EXT STAND': { codigo: 'TINTA_INT_EXT_STAND', nome: 'TINTA INT/EXT STANDARD' },
};

export const LINHA_ORDEM = [
  'CIMENTO',
  'ARGAMASSA',
  'PISO',
  'CONEXÃO SOLDÁVEL',
  'TINTA',
];

function trim(s) {
  return String(s || '').trim();
}

export function norm(s) {
  return trim(s).toUpperCase();
}

function slug(s) {
  return norm(s).replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
}

function mapTintaH3ToProdutoCompra(h3Raw) {
  const h3 = norm(h3Raw);
  if (!h3) return null;
  const direct = TINTA_H3_TO_PRODUTO_COMPRA[h3];
  if (direct) return direct;
  return { codigo: `TINTA_${slug(h3)}`, nome: `TINTA ${h3}` };
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

export function montarNomeProposto({ produtoCompraNome, eixoA, eixoB, marca }) {
  return [produtoCompraNome, eixoA, eixoB, marca]
    .map((s) => trim(s))
    .filter(Boolean)
    .join(' ');
}

/**
 * @returns {null | object} proposta de mapeamento
 */
export function planLinhaCompraAnalise(produto = {}) {
  const h1 = trim(produto.campo_hierarquico_1);
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  const h4 = trim(produto.campo_hierarquico_4);
  const marca = trim(produto.marca);

  if (!h1) {
    return {
      linha_nome: '(sem h1)',
      linha_tipo: 'indefinido',
      produto_compra_nome: '',
      eixo_a: '',
      eixo_b: '',
      eixo_a_rotulo: '',
      eixo_b_rotulo: '',
      confianca: 'baixa',
      motivo: 'sem_h1',
      nome_proposto: trim(produto.nome),
      h1_cadastro: '',
    };
  }

  const h1u = norm(h1);
  let patch;

  if (h1u === 'PISO' && h2 && h3) {
    patch = {
      linha_nome: 'PISO',
      linha_tipo: 'portfolio',
      produto_compra_nome: 'PISO',
      eixo_a_rotulo: 'Formato',
      eixo_b_rotulo: 'Modelo',
      eixo_a: h2,
      eixo_b: h3,
      confianca: 'alta',
      motivo: 'h1=PISO',
    };
  } else if (h1u.includes('CIMENTO')) {
    patch = {
      linha_nome: 'CIMENTO',
      linha_tipo: 'solo',
      produto_compra_nome: h1u.includes('BRANCO') ? 'CIMENTO BRANCO' : 'CIMENTO PORTLAND',
      eixo_a_rotulo: '',
      eixo_b_rotulo: '',
      eixo_a: '',
      eixo_b: '',
      confianca: 'alta',
      motivo: 'h1 cimento',
    };
  } else if (h1u === 'ARGAMASSA' && h2 && h3) {
    patch = {
      linha_nome: 'ARGAMASSA',
      linha_tipo: 'linha_mix',
      produto_compra_nome: 'ARGAMASSA',
      eixo_a_rotulo: 'Classe',
      eixo_b_rotulo: 'Embalagem',
      eixo_a: h3,
      eixo_b: h2,
      confianca: 'alta',
      motivo: 'h1=ARGAMASSA',
    };
  } else if (isSoldavel(produto)) {
    const pcNome = soldavelProdutoCompraNome(h1, h3);
    const med = soldavelEixoB(h1, h3, h4);
    if (!med) {
      patch = {
        linha_nome: 'CONEXÃO SOLDÁVEL',
        linha_tipo: 'linha_mix',
        produto_compra_nome: pcNome,
        eixo_a_rotulo: 'Peça',
        eixo_b_rotulo: 'Medida',
        eixo_a: '',
        eixo_b: '',
        confianca: 'baixa',
        motivo: 'soldável sem medida (h3/h4)',
      };
    } else {
      patch = {
        linha_nome: 'CONEXÃO SOLDÁVEL',
        linha_tipo: 'linha_mix',
        produto_compra_nome: pcNome,
        eixo_a_rotulo: 'Peça',
        eixo_b_rotulo: 'Medida',
        eixo_a: '',
        eixo_b: med,
        confianca: 'alta',
        motivo: 'h2=soldável',
      };
    }
  } else if (h1u === 'TINTA' && h2) {
    const map = mapTintaH3ToProdutoCompra(h3);
    if (!map) {
      patch = {
        linha_nome: 'TINTA',
        linha_tipo: 'portfolio',
        produto_compra_nome: '(tinta sem h3)',
        eixo_a_rotulo: 'Embalagem',
        eixo_b_rotulo: 'Cor / detalhe',
        eixo_a: h2,
        eixo_b: h4 || '',
        confianca: 'baixa',
        motivo: 'tinta sem h3',
      };
    } else {
      patch = {
        linha_nome: 'TINTA',
        linha_tipo: 'portfolio',
        produto_compra_nome: map.nome,
        eixo_a_rotulo: 'Embalagem',
        eixo_b_rotulo: 'Cor / detalhe',
        eixo_a: h2,
        eixo_b: h4 || '',
        confianca: 'alta',
        motivo: 'h1=TINTA',
      };
    }
  } else if (h2 && h3) {
    patch = {
      linha_nome: h1u,
      linha_tipo: 'linha_mix',
      produto_compra_nome: h1u,
      eixo_a_rotulo: 'Variante A',
      eixo_b_rotulo: 'Variante B',
      eixo_a: h2,
      eixo_b: h3,
      confianca: 'media',
      motivo: 'h1→linha, h2×h3',
    };
  } else if (h2) {
    patch = {
      linha_nome: h1u,
      linha_tipo: 'portfolio',
      produto_compra_nome: h1u,
      eixo_a_rotulo: 'Detalhe',
      eixo_b_rotulo: 'Modelo',
      eixo_a: h2,
      eixo_b: h4 || h3 || '',
      confianca: 'media',
      motivo: 'h1→linha, h2',
    };
  } else {
    patch = {
      linha_nome: h1u,
      linha_tipo: 'solo',
      produto_compra_nome: h1u,
      eixo_a_rotulo: '',
      eixo_b_rotulo: '',
      eixo_a: '',
      eixo_b: '',
      confianca: 'media',
      motivo: 'h1→linha solo',
    };
  }

  return {
    ...patch,
    h1_cadastro: h1,
    h2_cadastro: h2,
    h3_cadastro: h3,
    h4_cadastro: h4,
    h5_cadastro: trim(produto.campo_hierarquico_5),
    marca,
    nome_atual: trim(produto.nome),
    nome_proposto: montarNomeProposto({
      produtoCompraNome: patch.produto_compra_nome,
      eixoA: patch.eixo_a,
      eixoB: patch.eixo_b,
      marca,
    }),
  };
}

export function linhaSortKey(linhaNome) {
  const n = norm(linhaNome);
  const idx = LINHA_ORDEM.findIndex((l) => norm(l) === n);
  if (idx >= 0) return `${String(idx).padStart(2, '0')}_${n}`;
  return `99_${n}`;
}
