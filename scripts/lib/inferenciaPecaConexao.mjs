/**
 * Peças avulsas de conexão → LINHA da conexão (ESGOTO, SOLDÁVEL, ROSCÁVEL…).
 * Mesma lógica dos tubos: não existe LINHA genérica de peça.
 */

function trim(s) {
  return String(s ?? '').trim();
}

function norm(s) {
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

function patch(linhaCodigo, linhaNome, produtoCompra, eixoA, eixoB) {
  return {
    linha_codigo: linhaCodigo,
    linha_nome: linhaNome,
    linha_tipo: 'mix',
    produto_compra_nome: trim(produtoCompra),
    eixo_a: trim(eixoA),
    eixo_b: trim(eixoB),
    confianca: 'alta',
    motivo: 'peca_conexao',
  };
}

/** @returns {[string, string] | null} [codigo, nome] */
export function detectLinhaConexao(h2 = '', h3 = '', t = '') {
  const blob = norm(`${h2} ${h3} ${t}`);
  if (/ELETRODUTO/.test(blob)) return ['ELETRODUTO', 'ELETRODUTO'];
  if (/ESGOTO/.test(blob)) return ['ESGOTO', 'ESGOTO'];
  if (/SOLDAVEL|SOLDÁVEL|\bSOLD\b/.test(blob)) return ['SOLDAVEL', 'SOLDÁVEL'];
  if (/ROSCAVEL|ROSCÁVEL|\bROSC\b/.test(blob)) return ['ROSCAVEL', 'ROSCÁVEL'];
  return null;
}

function joelhoProdutoCompra(h2u, h3u, ln) {
  if (ln === 'SOLDÁVEL') {
    if (h3u === 'MISTO' || h2u.includes('MISTO')) return 'JOELHO MISTO SOLDÁVEL';
    if (h3u === '45' || h3u === '90') return `JOELHO ${h3u}° SOLDÁVEL`;
    return 'JOELHO SOLDÁVEL';
  }
  if (ln === 'ESGOTO') {
    if (h3u === '45' || h3u === '90') return `JOELHO ESGOTO ${h3u}`;
    return 'JOELHO ESGOTO';
  }
  if (ln === 'ROSCÁVEL') {
    if (h3u === '45' || h3u === '90') return `JOELHO ROSCÁVEL ${h3u}`;
    return 'JOELHO ROSCÁVEL';
  }
  return 'JOELHO';
}

function capProdutoCompra(ln) {
  if (ln === 'ESGOTO') return 'CAP ESGOTO';
  if (ln === 'SOLDÁVEL') return 'CAP SOLDÁVEL';
  if (ln === 'ROSCÁVEL') return 'CAP ROSCÁVEL';
  return 'CAP';
}

function luvaProdutoCompra(h2u, h3u, ln) {
  if (h3u === 'REDUÇÃO' || h3u === 'REDUCAO' || h2u.includes('RED')) {
    if (ln === 'SOLDÁVEL') return 'LUVA REDUÇÃO SOLDÁVEL';
    if (ln === 'ROSCÁVEL') return 'LUVA REDUÇÃO ROSCÁVEL';
    return 'LUVA REDUÇÃO';
  }
  if (ln === 'ESGOTO') return 'LUVA ESGOTO';
  if (ln === 'SOLDÁVEL') return 'LUVA SOLDÁVEL';
  if (ln === 'ROSCÁVEL') return 'LUVA ROSCÁVEL';
  return 'LUVA';
}

function teProdutoCompra(h2u, h3u, ln) {
  if (h3u === 'MISTO' || h2u.includes('MISTO')) {
    if (ln === 'SOLDÁVEL') return 'TE SOLDÁVEL MISTO';
    return 'TE MISTO';
  }
  if (ln === 'ESGOTO') return 'TE ESGOTO';
  if (ln === 'SOLDÁVEL') return 'TE SOLDÁVEL';
  if (ln === 'ROSCÁVEL') return 'TE ROSCÁVEL';
  return 'TE';
}

function pecaGenericaProdutoCompra(peca, ln) {
  const p = norm(peca);
  if (ln === 'ESGOTO') return `${p} ESGOTO`;
  if (ln === 'SOLDÁVEL') return `${p} SOLDÁVEL`;
  if (ln === 'ROSCÁVEL') return `${p} ROSCÁVEL`;
  if (ln === 'ELETRODUTO') return `${p} ELETRODUTO`;
  return p;
}

function eixosJoelho(h3, h4, h5) {
  const d3 = norm(h3);
  if (['45', '90', 'MISTO'].includes(d3)) return { eixo_a: '', eixo_b: trim(h4) || trim(h5) };
  return { eixo_a: trim(h3), eixo_b: trim(h4) || trim(h5) };
}

function eixosCap(h2, h3) {
  const h2u = norm(h2);
  if (['ESGOTO', 'SOLDAVEL', 'SOLDÁVEL', 'ROSCAVEL', 'ROSCÁVEL'].includes(h2u)) {
    return { eixo_a: trim(h3), eixo_b: '' };
  }
  return { eixo_a: trim(h2), eixo_b: trim(h3) };
}

function eixosLuva(h2, h3, h4) {
  const h2u = norm(h2);
  if (h3 === 'REDUÇÃO' || h3 === 'REDUCAO') return { eixo_a: trim(h4), eixo_b: '' };
  if (['ESGOTO', 'SOLDAVEL', 'SOLDÁVEL', 'ROSCAVEL', 'ROSCÁVEL'].includes(h2u)) {
    return { eixo_a: trim(h3) || trim(h4), eixo_b: '' };
  }
  return { eixo_a: trim(h2), eixo_b: trim(h3) || trim(h4) };
}

function eixosTe(h2, h3, h4) {
  const h2u = norm(h2);
  if (['ESGOTO', 'SOLDAVEL', 'SOLDÁVEL', 'ROSCAVEL', 'ROSCÁVEL'].includes(h2u)) {
    return { eixo_a: trim(h3) || trim(h4), eixo_b: trim(h4) && trim(h3) ? trim(h4) : '' };
  }
  return { eixo_a: trim(h2), eixo_b: trim(h3) || trim(h4) };
}

/** @returns {null | object} */
export function inferirPecaConexao(produto = {}) {
  const h1 = trim(produto.campo_hierarquico_1);
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  const h4 = trim(produto.campo_hierarquico_4);
  const h5 = trim(produto.campo_hierarquico_5);
  if (!h1) return null;

  const h1u = norm(h1);
  const h2u = norm(h2);
  const h3u = norm(h3);
  const t = textBlob(produto);

  if (h1u.includes('ADAPTADOR') && /CX\.?\s*D.?ÁGUA|CAIXA D.?ÁGUA/.test(t)) return null;
  if (h1u.includes('ADAPTADOR') && (h2u.includes('SOLD') || h1u.includes('SOLD'))) {
    const ln = detectLinhaConexao(h2, h3, t) ?? ['SOLDAVEL', 'SOLDÁVEL'];
    return patch(ln[0], ln[1], 'ADAPTADOR SOLDÁVEL', h3 || h2, h4);
  }

  const linhaFromH1 = detectLinhaConexao('', '', h1u);
  const linha = detectLinhaConexao(h2, h3, t) ?? linhaFromH1 ?? detectLinhaConexao('', '', t);
  if (!linha) return null;

  const [lc, ln] = linha;

  if (h1u.startsWith('NIPEL')) {
    return patch(lc, ln, ln === 'ROSCÁVEL' ? 'NIPEL ROSCÁVEL' : pecaGenericaProdutoCompra('NIPEL', ln), h3 || h2, h4);
  }

  if (h1u.startsWith('UNIAO') || h1u.startsWith('UNIÃO')) {
    const pc = ln === 'SOLDÁVEL' ? 'UNIÃO SOLDÁVEL' : ln === 'ROSCÁVEL' ? 'UNIÃO ROSCÁVEL' : 'UNIÃO';
    return patch(lc, ln, pc, h3 || h2, h4);
  }

  if (h1u.startsWith('PLUG') && (h1u.includes('ROSC') || ln === 'ROSCÁVEL')) {
    return patch('ROSCAVEL', 'ROSCÁVEL', 'PLUG ROSCÁVEL', h3 || h2, h4);
  }

  if (h1u === 'JOELHO') {
    const { eixo_a, eixo_b } = eixosJoelho(h3, h4, h5);
    return patch(lc, ln, joelhoProdutoCompra(h2u, h3u, ln), eixo_a, eixo_b);
  }

  if (h1u === 'CAP') {
    const { eixo_a, eixo_b } = eixosCap(h2, h3);
    return patch(lc, ln, capProdutoCompra(ln), eixo_a, eixo_b);
  }

  if (h1u === 'CURVA') {
    const curvaTipo = h3u === 'CURTA' || h3u === 'LONGA' ? h3 : h3 || h4;
    const ang = h4 || h5;
    return patch(lc, ln, ln === 'ESGOTO' ? 'CURVA ESGOTO' : pecaGenericaProdutoCompra('CURVA', ln), curvaTipo, ang);
  }

  if (h1u === 'LUVA') {
    const { eixo_a, eixo_b } = eixosLuva(h2, h3, h4);
    return patch(lc, ln, luvaProdutoCompra(h2u, h3u, ln), eixo_a, eixo_b);
  }

  if (h1u === 'TE' || h1u === 'TÊ') {
    const { eixo_a, eixo_b } = eixosTe(h2, h3, h4);
    return patch(lc, ln, teProdutoCompra(h2u, h3u, ln), eixo_a, eixo_b);
  }

  if (h1u === 'UNIAO' || h1u === 'UNIÃO') {
    return patch(lc, ln, ln === 'SOLDÁVEL' ? 'UNIÃO SOLDÁVEL' : ln === 'ROSCÁVEL' ? 'UNIÃO ROSCÁVEL' : 'UNIÃO', h3, h4);
  }

  if (h1u === 'NIPEL') {
    return patch(lc, ln, ln === 'ROSCÁVEL' ? 'NIPEL ROSCÁVEL' : pecaGenericaProdutoCompra('NIPEL', ln), h3 || h2, h4);
  }

  if (h1u === 'PLUG') {
    return patch(lc, ln, ln === 'ROSCÁVEL' ? 'PLUG ROSCÁVEL' : pecaGenericaProdutoCompra('PLUG', ln), h3 || h2, h4);
  }

  if ((h1u.includes('BUCHA') && (h1u.includes('RED') || h2u.includes('RED'))) || (h1u.includes('BUCHA RED'))) {
    if (ln === 'SOLDÁVEL') return patch(lc, ln, 'BUCHA REDUÇÃO SOLDÁVEL', h3, h4);
    if (ln === 'ROSCÁVEL') return patch(lc, ln, 'BUCHA REDUÇÃO ROSCÁVEL', '', h4 || h3);
  }

  if (h1u === 'CRUZETA') {
    return patch(lc, ln, pecaGenericaProdutoCompra('CRUZETA', ln), h3 || h2, h4);
  }

  if (h1u === 'JUNÇÃO' || h1u === 'JUNCAO') {
    return patch(lc, ln, 'JUNÇÃO', h2, h3 || h4);
  }

  const pecasSimples = ['REDUCAO', 'REDUÇÃO', 'Y', 'TÊ'];
  if (pecasSimples.includes(h1u) || /^Y ESGOTO\b/.test(t)) {
    return patch(lc, ln, pecaGenericaProdutoCompra(h1u, ln), h3 || h2, h4);
  }

  return null;
}
