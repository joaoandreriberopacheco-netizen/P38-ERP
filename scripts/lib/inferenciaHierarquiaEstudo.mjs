/**
 * Regras de inferência LINHA → produto compra → eixos (estudo export).
 * Prioridade: padrões h1/h2 explícitos antes do fallback genérico.
 */

import { inferirTuboPorLinha } from './inferenciaLinhaPorTipo.mjs';
import { inferirPecaConexao } from './inferenciaPecaConexao.mjs';

function trim(s) {
  return String(s ?? '').trim();
}

export function norm(s) {
  return trim(s).toUpperCase();
}

/** @returns {null | object} */
export function planInferenciaEstruturada(produto = {}) {
  const h1 = trim(produto.campo_hierarquico_1);
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  const h4 = trim(produto.campo_hierarquico_4);
  const h5 = trim(produto.campo_hierarquico_5);
  if (!h1) return null;

  const h1u = norm(h1);
  const h2u = norm(h2);

  // --- Fios elétricos ---
  if (h1u === 'FIO ELÉTRICO' || h1u === 'FIO ELETRICO') {
    return patch('FIO', 'FIOS ELÉTRICOS', 'mix', 'FIO ELÉTRICO', '', h3 || h2);
  }
  if (h1u === 'FIO PARALELO') {
    return patch('FIO', 'FIOS ELÉTRICOS', 'mix', 'FIO PARALELO', '', h3 || h2);
  }
  if (h1u.startsWith('CABO ') && !h1u.includes('MADEIRA') && !h1u.includes('ENXADA')) {
    return patch('FIO', 'FIOS ELÉTRICOS', 'mix', h1, h2, h3 || h4);
  }

  // --- Vergalhão / armadura ---
  if (h1u.includes('VERGALH')) {
    return patch('VERGALHAO', 'VERGALHÃO', 'mix', 'VERGALHÃO', h2, h3);
  }
  if (h1u === 'ESTRIBO') {
    return patch('VERGALHAO', 'VERGALHÃO', 'mix', 'ESTRIBO', h2, h3 || h4);
  }
  if (h1u.includes('TELA ') && (h1u.includes('SOLD') || h1u.includes('MOSQUIT') || h1u.includes('MOSQUITE'))) {
    return patch('VERGALHAO', 'VERGALHÃO', 'mix', 'TELA', h2, h3);
  }

  // --- Eletroduto (peças) ---
  if (h1u.includes('ELETRODUTO')) {
    return patch('ELETRODUTO', 'ELETRODUTO', 'mix', tituloPeca(h1, 'ELETRODUTO'), h2, h3 || h4);
  }

  // --- Bucha plástica (parafuso) ---
  if (h1u === 'BUCHA PLÁSTICA' || h1u === 'BUCHA PLASTICA') {
    return patch('FERRAGEM', 'FERRAGEM', 'mix', 'BUCHA PLÁSTICA', '', h2);
  }

  // --- Barra roscada ---
  if (h1u.includes('BARRA ROSC')) {
    return patch('FERRAGEM', 'FERRAGEM', 'mix', 'BARRA ROSCADA ZINCADA', h2, h3);
  }

  // --- Disco de corte ---
  if (h1u === 'DISCO DE CORTE' || h1u.startsWith('DISCO DE CORTE')) {
    return patch('FERRAGEM', 'FERRAGEM', 'mix', 'DISCO DE CORTE', h2, h3 || h4);
  }

  // --- Corante ---
  if (h1u.includes('CORANTE')) {
    return patch('TINTA', 'TINTA', 'portfolio', 'CORANTE LÍQUIDO', h2, h3 || h4);
  }

  // --- Xadrez / pigmento ---
  if (h1u.includes('XADREZ')) {
    return patch('TINTA', 'TINTA', 'portfolio', 'XADREZ EM PÓ', h2, h3);
  }

  // --- Lixa ---
  if (h1u === 'LIXA' && h2) {
    return patch('LIXA', 'LIXA', 'mix', 'LIXA', h2, h3 || h4);
  }

  // --- Luminária / lâmpada LED ---
  if (h1u.includes('LUMINÁRIA') || h1u.includes('LUMINARIA') || h1u.includes('LAMPADA LED') || h1u.includes('LÂMPADA LED')) {
    return patch('ELETRICA', 'MATERIAL ELÉTRICO', 'portfolio', tituloPeca(h1, 'LED'), h2, h3 || h4);
  }

  // --- Disjuntor ---
  if (h1u.includes('DISJUNTOR')) {
    return patch('ELETRICA', 'MATERIAL ELÉTRICO', 'mix', 'DISJUNTOR', h2, h3 || h4);
  }

  // --- Tomada / interruptor ---
  if (h1u.includes('TOMADA') || h1u.includes('INTERRUPTOR')) {
    return patch('ELETRICA', 'MATERIAL ELÉTRICO', 'mix', tituloPeca(h1), h2, h3 || h4);
  }

  // --- Grampo p/ fio ---
  if (h1u.includes('GRAMPO') && h1u.includes('FIO')) {
    return patch('ELETRICA', 'MATERIAL ELÉTRICO', 'mix', 'GRAMPO P/ FIO', h2, h3);
  }

  // --- Colar para tubo ---
  if (h1u.includes('COLAR') && h1u.includes('TUBO')) {
    return patch('ROSCAVEL', 'ROSCÁVEL', 'mix', 'COLAR PARA TUBO', h2, h3);
  }

  // --- Engate flex ---
  if (h1u.includes('ENGATE FLEX')) {
    return patch('ROSCAVEL', 'ROSCÁVEL', 'mix', 'ENGATE FLEXÍVEL', h2, h3 || h4);
  }

  // --- Tubo → LINHA da conexão ---
  if (h1u.startsWith('TUBO')) {
    const tubo = inferirTuboPorLinha(produto);
    if (tubo) {
      return { ...tubo, motivo: 'inferencia_estruturada' };
    }
  }

  // --- Peças avulsas (joelho, luva, tee, cap…) → LINHA da conexão ---
  const peca = inferirPecaConexao(produto);
  if (peca) {
    return { ...peca, motivo: 'inferencia_estruturada' };
  }

  return null;
}

function patch(linhaCodigo, linhaNome, linhaTipo, produtoCompra, eixoA, eixoB) {
  return {
    linha_codigo: linhaCodigo,
    linha_nome: linhaNome,
    linha_tipo: linhaTipo,
    produto_compra_nome: trim(produtoCompra),
    eixo_a: trim(eixoA),
    eixo_b: trim(eixoB),
    confianca: 'alta',
    motivo: 'inferencia_estruturada',
  };
}

/** Mantém h1 como nome de peça quando termina com palavra-chave. */
function tituloPeca(h1, keyword) {
  const t = trim(h1);
  if (!keyword) return t;
  if (norm(t).includes(norm(keyword))) return t;
  return t;
}

export function inferirLinhaCodigoEstruturado(produto) {
  const structured = planInferenciaEstruturada(produto);
  if (structured?.linha_codigo) return structured.linha_codigo;

  const n1 = norm(produto.campo_hierarquico_1);
  const n2 = norm(produto.campo_hierarquico_2);
  const h2sold = n2 === 'SOLDÁVEL' || n2 === 'SOLDAVEL';

  if (h2sold) return 'SOLDAVEL';
  if (n1.includes('CIMENTO')) return 'CIMENTO';
  if (n1 === 'ARGAMASSA') return 'ARGAMASSA';
  if (n1 === 'PISO') return 'PISO';
  if (n1 === 'PORCELANATO' || n1 === 'PORCELENATO') return 'PORCELANATO';
  if (n1 === 'REVESTIMENTO') return 'REVESTIMENTO';
  if (n1 === 'TINTA' || n1 === 'TINTA SPRAY') return 'TINTA';
  if (n1 === 'VERNIZ') return 'VERNIZ';
  if (n1.includes('MASSA CORRIDA')) return 'MASSA_CORRIDA';
  if (n1.includes('MASSA ACR')) return 'MASSA_ACRILICA';
  if (n1.includes('REJUNTE')) return 'REJUNTE';
  if (n1 === 'PREGO') return 'PREGO';
  if (n1.includes('PARAFUSO')) return 'PARAFUSO';
  if (n2.includes('ESGOTO') || n1.includes('ESGOTO')) return 'ESGOTO';
  if (n2.includes('ROSC') || n1.includes('ROSC')) return 'ROSCAVEL';
  if (n1.includes('FIO ELÉTRICO') || n1.includes('FIO ELETRICO') || n1 === 'FIO PARALELO') return 'FIO';
  if (n1.includes('VERGALH') || n1 === 'ESTRIBO') return 'VERGALHAO';
  if (n1.includes('ELETRODUTO')) return 'ELETRODUTO';
  if (n1.includes('TORNEIRA')) return 'TORNEIRA';
  if (['CHUVEIRO', 'REGISTRO', 'VALVULA', 'CAIXA DE DESCARGA', 'ASSENTO SANITÁRIO', 'MONOCOMANDO'].some((k) => n1.includes(k))) {
    return 'METAIS_SANITARIOS';
  }
  if (n1.startsWith('TUBO') && !n1.includes('ADESIVO')) {
    if (n2.includes('ELETRODUTO') || n1.includes('ELETRODUTO')) return 'ELETRODUTO';
    if (n2.includes('ESGOTO') || n1.includes('ESGOTO') || n1.includes('OCRE') || n1.includes('DESCARGA')) return 'ESGOTO';
    if (n2.includes('SOLD') || n1.includes('SOLD')) return 'SOLDAVEL';
    if (n2.includes('ROSC') || n1.includes('ROSC') || n1.includes('GALVANIZ')) return 'ROSCAVEL';
  }
  if (n1 === 'LIXA') return 'LIXA';
  if (['DISJUNTOR', 'LAMPADA', 'LUMINÁRIA', 'LUMINARIA', 'TOMADA', 'INTERRUPTOR', 'GRAMPO'].some((k) => n1.includes(k))) {
    return 'ELETRICA';
  }
  if (['FECHADURA', 'DOBRADIÇA', 'PUXADOR', 'TRINCO', 'BUCHA PLÁSTICA', 'BUCHA PLASTICA', 'BARRA ROSC', 'DISCO DE CORTE'].some((k) => n1.includes(k))) {
    return 'FERRAGEM';
  }
  if (n1.includes('IMPERMEAB')) return 'IMPERMEABILIZANTE';
  if (n1.includes('ADESIVO') || n1.includes('COLA ')) return 'ADESIVO';
  return 'OUTROS';
}
