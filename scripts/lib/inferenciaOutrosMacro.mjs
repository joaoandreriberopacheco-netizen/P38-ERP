/**
 * Inferência agressiva para SKUs com h1 longo / "falsos h1".
 * Objetivo: tirar o máximo possível do bucket OUTROS.
 */

import { inferirPecaConexao } from './inferenciaPecaConexao.mjs';

function trim(s) {
  return String(s ?? '').trim();
}

export function norm(s) {
  return trim(s).replace(/\s+/g, ' ').toUpperCase();
}

function textBlob(produto) {
  return norm([
    produto.campo_hierarquico_1,
    produto.campo_hierarquico_2,
    produto.campo_hierarquico_3,
    produto.campo_hierarquico_4,
    produto.campo_hierarquico_5,
    produto.nome,
  ].filter(Boolean).join(' '));
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
    motivo: 'macro_outros',
  };
}

function linhaFromCategoria(categoria) {
  const c = norm(categoria);
  if (c.includes('FERRAMENTAS')) return ['FERRAMENTAS', 'FERRAMENTAS', 'mix'];
  if (c.includes('ÁREAS MOLHADAS') || c.includes('AREAS MOLHADAS')) return ['METAIS_SANITARIOS', 'METAIS SANITÁRIOS', 'portfolio'];
  if (c.includes('HIDRÁULICA') || c.includes('HIDRAULICA')) return ['HIDRÁULICA', 'HIDRÁULICA', 'mix'];
  if (c.includes('PINTURA') || c.includes('QUÍMICOS') || c.includes('QUIMICOS')) return ['PINTURA_QUIMICOS', 'PINTURA E QUÍMICOS', 'portfolio'];
  if (c.includes('ELÉTRICA') || c.includes('ELETRICA')) return ['ELETRICA', 'MATERIAL ELÉTRICO', 'mix'];
  if (c.includes('ILUMINAÇÃO') || c.includes('ILUMINACAO')) return ['ILUMINACAO', 'ILUMINAÇÃO', 'mix'];
  if (c.includes('PISOS') || c.includes('REVESTIMENTOS')) return ['PISO', 'PISOS E REVESTIMENTOS', 'portfolio'];
  if (c.includes('MATERIAIS BÁSICOS') || c.includes('MATERIAIS BASICOS')) return ['MATERIAIS_BASICOS', 'MATERIAIS BÁSICOS', 'mix'];
  if (c.includes('COBERTURAS') || c.includes('FORROS')) return ['COBERTURAS', 'COBERTURAS E FORROS', 'mix'];
  if (c.includes('ESQUADRIAS') || c.includes('FERRAGENS')) return ['ESQUADRIAS', 'ESQUADRIAS E FERRAGENS', 'mix'];
  return ['DIVERSOS', 'DIVERSOS', 'mix'];
}

function extractEmbalagem(t) {
  const m = t.match(/\b(\d+[,.]?\d*\s*(?:ML|L|KG|G|LT|LTS|LITROS?))\b/i);
  return m ? m[1].replace(/\s+/g, ' ').toUpperCase() : '';
}

function extractMedidas(t) {
  const m = t.match(/\b(\d+\s*[Xx×]\s*\d+(?:\s*[Xx×]\s*\d+)?(?:\s*MM|CM|M)?|\d+\s*MM|\d+\/\d+'?|\d+"|\d+\s*M\b)/);
  return m ? m[0].replace(/\s+/g, ' ').toUpperCase() : '';
}

export function compactarRotulo(text) {
  const words = trim(text).split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words.join(' ');
  const out = [words[0]];
  for (let i = 1; i < words.length; i++) {
    if (norm(words[i]) !== norm(out[out.length - 1])) out.push(words[i]);
  }
  return out.join(' ');
}

function primeirasPalavras(text, n = 3) {
  return compactarRotulo(text.split(/\s+/).slice(0, n).join(' '));
}

function parseThinner(produto, t) {
  if (!/\bTHINNER\b|\bSOLVENTE?\b/.test(t)) return null;
  const emb = extractEmbalagem(t) || trim(produto.campo_hierarquico_2);
  // Mesma LINHA para todos os thinners — produto compra distingue marca/receita (237 ≠ 2750).
  const lc = 'THINNER';
  const ln = 'THINNER';
  const lt = 'portfolio';

  if (/LUKSNOVA|LUKS NOVA|\bLUKS\b/.test(t)) {
    const code = t.match(/\b(206|237)\b/)?.[1] || '';
    return patch(lc, ln, lt, code ? `THINNER LUKSNOVA ${code}` : 'THINNER LUKSNOVA', emb, '');
  }
  if (/\bANJO\b/.test(t)) {
    const code = t.match(/\b(2750|2760|\d{4})\b/)?.[1] || '';
    return patch(lc, ln, lt, code ? `THINNER ANJO ${code}` : 'THINNER ANJO', emb, '');
  }
  if (/\bKING\b/.test(t)) return patch(lc, ln, lt, 'THINNER KING', emb, '');
  return patch(lc, ln, lt, primeirasPalavras(produto.campo_hierarquico_1 || produto.nome, 4), emb, '');
}

function parseTintaSpray(produto, t) {
  if (!t.startsWith('TINTA SPRAY') && !t.includes(' TINTA SPRAY')) return null;
  const emb = extractEmbalagem(t) || trim(produto.campo_hierarquico_2);
  const cor = trim(produto.campo_hierarquico_3) || trim(produto.campo_hierarquico_4);
  return patch('TINTA', 'TINTA', 'portfolio', 'TINTA SPRAY', emb, cor);
}

function parseMassaQuimica(produto, t) {
  // Delegado a inferenciaLinhaPorTipo.mjs — evita duplicar e cair em PINTURA E QUÍMICOS.
  return null;
}

function parseRoloPincel(produto, t) {
  if (!t.startsWith('ROLO DE') && !t.startsWith('PINCEL')) return null;
  const [lc, ln, lt] = linhaFromCategoria(produto.categoria_nome);
  if (t.includes('ROLO')) {
    const tipo = t.includes('ESPUMA') ? 'ROLO DE ESPUMA' : t.includes('LA') || t.includes('LÃ') ? 'ROLO DE LÃ' : 'ROLO DE PINTURA';
    return patch(lc, ln, lt, tipo, extractMedidas(t) || trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_3));
  }
  return patch(lc, ln, lt, 'PINCEL', trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_3));
}

function parseTorneiraPiaCuba(produto, t) {
  if (/^TORNEIRA\b/.test(t)) return null; // inferenciaLinhaPorTipo → LINHA TORNEIRA
  if (/^PIA\b/.test(t)) {
    return patch('METAIS_SANITARIOS', 'METAIS SANITÁRIOS', 'portfolio', 'PIA', extractMedidas(t), trim(produto.campo_hierarquico_2));
  }
  if (/^CUBA\b/.test(t)) {
    let pc = 'CUBA';
    if (/EMBUTIR|INOX/.test(t)) pc = 'CUBA EMBUTIR';
    else if (/APOIO/.test(t)) pc = 'CUBA DE APOIO';
    return patch('METAIS_SANITARIOS', 'METAIS SANITÁRIOS', 'portfolio', pc, extractMedidas(t) || trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_3));
  }
  return null;
}

function parseRegistroValvula(produto, t) {
  if (/^REGISTRO\b/.test(t)) {
    let pc = 'REGISTRO';
    if (/ESFERA|ESF\b/.test(t)) pc = 'REGISTRO ESFERA';
    else if (/PRESSAO|PRESSÃO/.test(t)) pc = 'REGISTRO PRESSÃO';
    else if (/GAVETA/.test(t)) pc = 'REGISTRO GAVETA';
    else if (/PARA(P)?\s*CAIXA/.test(t)) pc = 'REGISTRO CAIXA ACOP';
    return patch('HIDRÁULICA', 'HIDRÁULICA', 'mix', pc, extractMedidas(t) || trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_4));
  }
  if (/^VALVULA\b|^VÁLVULA\b/.test(t)) {
    return patch('HIDRÁULICA', 'HIDRÁULICA', 'mix', 'VÁLVULA', trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_3));
  }
  return null;
}

function parseCaixaAgua(produto, t) {
  if (/CAIXA D.?ÁGUA|CAIXA D.?AGUA/.test(t)) {
    const cap = t.match(/\d+\s*L(?:ITROS?)?/i)?.[0]?.toUpperCase() || trim(produto.campo_hierarquico_2);
    const marca = t.match(/FORTLEV|BAKOF/i)?.[0] || trim(produto.campo_hierarquico_3);
    return patch('HIDRÁULICA', 'HIDRÁULICA', 'mix', "CAIXA D'ÁGUA", cap, marca);
  }
  if (/ADAPTADOR P\/ CX/.test(t)) {
    return patch('HIDRÁULICA', 'HIDRÁULICA', 'mix', "ADAPTADOR CAIXA D'ÁGUA", trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_3));
  }
  return null;
}

function parseConexaoAvulsa(produto, t) {
  const peca = inferirPecaConexao(produto);
  if (peca) return peca;

  const h1 = norm(produto.campo_hierarquico_1);
  const rules = [
    { re: /^GRELHA/, pc: 'GRELHA', lc: 'HIDRÁULICA', ln: 'HIDRÁULICA' },
    { re: /^SIFAO|^SIFÃO/, pc: 'SIFÃO', lc: 'HIDRÁULICA', ln: 'HIDRÁULICA' },
    { re: /^RALO/, pc: 'RALO', lc: 'HIDRÁULICA', ln: 'HIDRÁULICA' },
    { re: /^BOCAL/, pc: 'BOCAL', lc: 'HIDRÁULICA', ln: 'HIDRÁULICA' },
    { re: /^TAMPA/, pc: 'TAMPA', lc: 'HIDRÁULICA', ln: 'HIDRÁULICA' },
    { re: /^TAPA-FURO/, pc: 'TAPA-FURO', lc: 'ELETRICA', ln: 'MATERIAL ELÉTRICO' },
    { re: /^ESPUDE/, pc: 'ESPUDE', lc: 'HIDRÁULICA', ln: 'HIDRÁULICA' },
    { re: /^MANGUEIRA P\/ MAQUINA/, pc: 'MANGUEIRA LAVADORA', lc: 'HIDRÁULICA', ln: 'HIDRÁULICA' },
  ];
  for (const { re, pc, lc, ln } of rules) {
    if (re.test(h1) || re.test(t)) {
      const med = trim(produto.campo_hierarquico_4) || trim(produto.campo_hierarquico_3) || trim(produto.campo_hierarquico_2) || extractMedidas(t);
      return patch(lc, ln, 'mix', pc, med, trim(produto.campo_hierarquico_5));
    }
  }
  return null;
}

function parseFitaVedacao(produto, t) {
  if (/^FITA\b/.test(t)) {
    let pc = 'FITA';
    if (/CREPE/.test(t)) pc = 'FITA CREPE';
    else if (/ISOLANTE/.test(t)) pc = 'FITA ISOLANTE';
    else if (/AUTOADERENTE|AUTO-AD/.test(t)) pc = 'FITA AUTOADESIVA';
    else if (/ALUMINIO|ALUMÍNIO/.test(t)) pc = 'FITA ALUMÍNIO';
    const [lc, ln, lt] = linhaFromCategoria(produto.categoria_nome);
    return patch(lc, ln, lt, pc, trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_3));
  }
  if (/^SILICONE\b|^PU FOAM\b|^ESPUMA EXPANS/i.test(t)) {
    const [lc, ln, lt] = linhaFromCategoria(produto.categoria_nome);
    const pc = t.startsWith('SILICONE') ? 'SILICONE' : t.includes('ESPUMA') ? 'ESPUMA EXPANSIVA' : 'PU FOAM';
    return patch(lc, ln, lt, pc, extractEmbalagem(t) || trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_3));
  }
  return null;
}

function parseEletrica(produto, t) {
  if (/^QUADRO DE DISTRIBUI/.test(t)) {
    const mod = t.match(/\d+\s*\/\s*\d+|\d+/)?.[0] || trim(produto.campo_hierarquico_2);
    return patch('ELETRICA', 'MATERIAL ELÉTRICO', 'mix', 'QUADRO DE DISTRIBUIÇÃO', mod, trim(produto.campo_hierarquico_3));
  }
  if (/^RESISTENCIA\b|^RESISTÊNCIA\b/.test(t)) {
    return patch('ELETRICA', 'MATERIAL ELÉTRICO', 'mix', 'RESISTÊNCIA', trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_3));
  }
  if (/^CONDUITE\b|^CAIXA DE LUZ\b|^CAIXINHA DE LUZ\b|^HASTE DE ATERRAMENTO\b/.test(t)) {
    return patch('ELETRICA', 'MATERIAL ELÉTRICO', 'mix', primeirasPalavras(produto.campo_hierarquico_1 || produto.nome, 3), trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_3));
  }
  if (/^SPOT\b|^PLAFON\b|^REFLETOR\b/.test(t)) {
    return patch('ILUMINACAO', 'ILUMINAÇÃO', 'portfolio', primeirasPalavras(produto.campo_hierarquico_1, 2), trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_3));
  }
  return null;
}

function parseFerramenta(produto, t) {
  const tools = ['MARTELO', 'ALICATE', 'DESEMPENADEIRA', 'ESPATULA', 'ESPÁTULA', 'COLHER DE PEDREIRO', 'SERROTE', 'PLAINA', 'NIVEL', 'NÍVEL', 'BOTA', 'LUVA DE', 'ÓCULOS', 'OCULOS'];
  for (const tool of tools) {
    if (t.startsWith(tool)) {
      const [lc, ln, lt] = linhaFromCategoria(produto.categoria_nome);
      return patch(lc, ln, lt, primeirasPalavras(produto.campo_hierarquico_1 || produto.nome, 2), trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_3));
    }
  }
  return null;
}

function parseMateriaisBasicos(produto, t) {
  if (/^BLOCO DE CONCRETO\b/.test(t)) {
    return patch('MATERIAIS_BASICOS', 'MATERIAIS BÁSICOS', 'mix', 'BLOCO DE CONCRETO', extractMedidas(t) || trim(produto.campo_hierarquico_2), '');
  }
  if (/^COMPENSADO\b|^MADEIRIT\b/.test(t)) {
    return patch('MATERIAIS_BASICOS', 'MATERIAIS BÁSICOS', 'mix', primeirasPalavras(produto.campo_hierarquico_1, 1), extractMedidas(t) || trim(produto.campo_hierarquico_2), '');
  }
  if (/^AREIA\b|^SEIXO\b|^TIJOLO\b|^CAL\b/.test(t)) {
    return patch('MATERIAIS_BASICOS', 'MATERIAIS BÁSICOS', 'mix', primeirasPalavras(produto.campo_hierarquico_1, 2), extractEmbalagem(t) || trim(produto.campo_hierarquico_2), '');
  }
  if (/^ARAME\b|^ESTRIBO\b|^FORRO PVC\b|^PERFIL DE\b|^PERFIL U\b/.test(t)) {
    const [lc, ln, lt] = linhaFromCategoria(produto.categoria_nome);
    return patch(lc, ln, lt, primeirasPalavras(produto.campo_hierarquico_1, 3), trim(produto.campo_hierarquico_2), trim(produto.campo_hierarquico_3));
  }
  return null;
}

function parseGenericoPorCategoria(produto) {
  const h1 = trim(produto.campo_hierarquico_1);
  const nome = trim(produto.nome);
  if (!h1 && !nome) return null;
  const [lc, ln, lt] = linhaFromCategoria(produto.categoria_nome);
  const base = compactarRotulo(h1 || nome);
  return patch(
    lc,
    ln,
    lt,
    primeirasPalavras(base, 4),
    trim(produto.campo_hierarquico_2) || extractEmbalagem(base) || extractMedidas(base),
    trim(produto.campo_hierarquico_3) || trim(produto.campo_hierarquico_4),
  );
}

/** @returns {null | object} */
export function planInferenciaOutrosMacro(produto = {}) {
  const t = textBlob(produto);
  const h1n = norm(produto.campo_hierarquico_1);
  if (!t && !h1n) return null;

  for (const fn of [
    () => parseThinner(produto, t),
    () => parseTintaSpray(produto, t),
    () => parseMassaQuimica(produto, t),
    () => parseRoloPincel(produto, t),
    () => parseTorneiraPiaCuba(produto, t),
    () => parseRegistroValvula(produto, t),
    () => parseCaixaAgua(produto, t),
    () => parseConexaoAvulsa(produto, t),
    () => parseFitaVedacao(produto, t),
    () => parseEletrica(produto, t),
    () => parseFerramenta(produto, t),
    () => parseMateriaisBasicos(produto, t),
  ]) {
    const r = fn();
    if (r) return r;
  }

  if (h1n.length >= 3 || trim(produto.nome).length >= 3) {
    return parseGenericoPorCategoria(produto);
  }
  return null;
}

export function isFalsoH1(produto) {
  const h1 = trim(produto.campo_hierarquico_1);
  const nome = trim(produto.nome);
  if (!h1) return false;
  if (norm(h1) === norm(nome)) return true;
  if (nome.toUpperCase().startsWith(h1.toUpperCase()) && h1.length > 20) return true;
  if (h1.length > 45) return true;
  const tokens = h1.split(/\s+/);
  if (tokens.length >= 5 && tokens.filter((x) => /\d/.test(x)).length >= 2) return true;
  return false;
}

export function deveUsarOutros(produto, plan) {
  if (plan?.motivo === 'macro_outros' || plan?.motivo === 'inferencia_estruturada' || plan?.motivo === 'linha_por_tipo' || plan?.motivo === 'peca_conexao') {
    return false;
  }
  if (plan?.linha_codigo && !['OUTROS', 'DIVERSOS'].includes(plan.linha_codigo)) return false;
  return isFalsoH1(produto) && !plan?.produto_compra_nome;
}
