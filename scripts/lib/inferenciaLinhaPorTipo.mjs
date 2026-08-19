/**
 * LINHA portal pelo tipo de produto (h1/nome), não pela categoria ERP.
 * Mesma lógica do THINNER: família única na LINHA, produto compra distingue marca/receita.
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

function patch(linhaCodigo, linhaNome, linhaTipo, produtoCompra, eixoA, eixoB) {
  return {
    linha_codigo: linhaCodigo,
    linha_nome: linhaNome,
    linha_tipo: linhaTipo,
    produto_compra_nome: trim(produtoCompra),
    eixo_a: trim(eixoA),
    eixo_b: trim(eixoB),
    confianca: 'alta',
    motivo: 'linha_por_tipo',
  };
}

function extractEmbalagem(t) {
  const m = t.match(/\b(\d+[,.]?\d*\s*(?:ML|L|KG|G|LT|LTS|LITROS?))\b/i);
  return m ? m[1].replace(/\s+/g, ' ').toUpperCase() : '';
}

function marcaConhecida(t, marcas) {
  for (const m of marcas) {
    if (t.includes(m)) return m;
  }
  return '';
}

function parseVerniz(produto, t) {
  if (!/\bVERNIZ\b/.test(t) || /\bTHINNER\b/.test(t)) return null;
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  const h4 = trim(produto.campo_hierarquico_4);
  const marcas = ['IQUINE', 'VERBRAS', 'HIDROTINTAS', 'CORAL', 'SUVINIL'];
  const marca = marcaConhecida(h3, marcas) || marcaConhecida(t, marcas);
  const emb = extractEmbalagem(t) || (/^\(/.test(h2) ? h2 : extractEmbalagem(h2)) || h2;
  const pc = marca ? `VERNIZ ${marca}` : 'VERNIZ';
  return patch('VERNIZ', 'VERNIZ', 'portfolio', pc, emb, h3 && marca !== h3 ? h3 : h4);
}

function parseRejunte(produto, t) {
  if (!/\bREJUNTE\b/.test(t) || /LIMPADOR DE REJUNTE/.test(t)) return null;
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  const h4 = trim(produto.campo_hierarquico_4);
  const h5 = trim(produto.campo_hierarquico_5);
  const marca = marcaConhecida(t, ['QUARTZOLIT', 'JBMIX', 'Vedacit', 'VEDACIT']) || h3 || h4;
  const pc = marca ? `REJUNTE ${marca.toUpperCase()}` : 'REJUNTE';
  return patch('REJUNTE', 'REJUNTE', 'mix', pc, h2 || extractEmbalagem(t), h4 || h5);
}

function parseArgamassa(produto, t) {
  if (!/^ARGAMASSA\b/.test(t) && norm(produto.campo_hierarquico_1) !== 'ARGAMASSA') return null;
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  const h4 = trim(produto.campo_hierarquico_4);
  const tipo = h3 || t.match(/\bAC-[123]\b/i)?.[0]?.toUpperCase() || '';
  const pc = tipo ? `ARGAMASSA ${tipo}` : 'ARGAMASSA';
  return patch('ARGAMASSA', 'ARGAMASSA', 'mix', pc, h2 || extractEmbalagem(t), h4);
}

function parseCimento(produto, t) {
  const h1u = norm(produto.campo_hierarquico_1);
  if (!h1u.includes('CIMENTO') || h1u.includes('QUEIMADO')) return null;
  if (/TINTA.*CIMENTO/.test(t)) return null;
  const h2 = trim(produto.campo_hierarquico_2);
  const pc = h1u.includes('BRANCO') ? 'CIMENTO BRANCO' : 'CIMENTO PORTLAND';
  return patch('CIMENTO', 'CIMENTO', 'mix', pc, h2 || extractEmbalagem(t), '');
}

function parseMassa(produto, t) {
  if (!/\bMASSA CORRIDA\b|\bMASSA ACR/i.test(t)) return null;
  const isCorrida = /\bMASSA CORRIDA\b/.test(t);
  const lc = isCorrida ? 'MASSA_CORRIDA' : 'MASSA_ACRILICA';
  const ln = isCorrida ? 'MASSA CORRIDA' : 'MASSA ACRÍLICA';
  const marca = marcaConhecida(t, ['HIPERCOR', 'LUX', 'LUKSCOLOR', 'SELATINTAS']) || trim(produto.campo_hierarquico_3);
  const pc = marca ? `${ln} ${marca}` : ln;
  const emb = extractEmbalagem(t) || trim(produto.campo_hierarquico_2);
  return patch(lc, ln, 'mix', pc, emb, '');
}

function parseTinta(produto, t) {
  if (/\bTHINNER\b|\bVERNIZ\b/.test(t)) return null;
  if (!/^TINTA\b/.test(t) && norm(produto.campo_hierarquico_1) !== 'TINTA') return null;
  if (/TINTA SPRAY/.test(t)) return null;
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  const h4 = trim(produto.campo_hierarquico_4);
  const linhaTipo = h3 ? 'portfolio' : 'mix';
  let pc = 'TINTA';
  if (/ESMALTE/.test(t)) pc = 'TINTA ESMALTE SINTÉTICO';
  else if (/P\/ PISO|PISO/.test(t)) pc = 'TINTA P/ PISO';
  else if (/FOSCO/.test(t)) pc = 'TINTA ACRÍLICA FOSCO';
  else if (/SEMI.?BRILHO/.test(t)) pc = 'TINTA SEMI-BRILHO';
  else if (/STANDARD|POUPE/.test(t)) pc = 'TINTA STANDARD';
  else if (h3) pc = `TINTA ${h3}`;
  return patch('TINTA', 'TINTA', linhaTipo, pc, h2 || extractEmbalagem(t), h4);
}

function parsePrego(produto, t) {
  if (norm(produto.campo_hierarquico_1) !== 'PREGO' && !/^PREGO\b/.test(t)) return null;
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  return patch('PREGO', 'PREGO', 'solo', 'PREGO', h2, h3);
}

function parseParafuso(produto, t) {
  if (!/^PARAFUSO\b/.test(t) && norm(produto.campo_hierarquico_1) !== 'PARAFUSO') return null;
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  let pc = 'PARAFUSO';
  if (/ASSENTO/.test(t)) pc = 'PARAFUSO ASSENTO SANITÁRIO';
  else if (/DRYWALL|GIPSITA/.test(t)) pc = 'PARAFUSO DRYWALL';
  else if (/MADEIRA/.test(t)) pc = 'PARAFUSO MADEIRA';
  return patch('PARAFUSO', 'PARAFUSO', 'mix', pc, h2, h3);
}

function parseAdesivo(produto, t) {
  if (!/^ADESIVO\b|^COLA \b|^COLA\b/.test(t)) return null;
  if (/GANCHOS ADESIVOS/.test(t)) return null;
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  let pc = 'ADESIVO';
  if (/PLÁSTICO|PLASTICO/.test(t)) pc = 'ADESIVO PLÁSTICO';
  else if (/MADEIRA/.test(t)) pc = 'COLA MADEIRA';
  else if (/CONTATO/.test(t)) pc = 'ADESIVO DE CONTATO';
  else if (/TUBOS|TUBO/.test(t)) pc = 'ADESIVO P/ TUBOS';
  return patch('ADESIVO', 'ADESIVO', 'mix', pc, h2 || extractEmbalagem(t), h3);
}

function parseImpermeabilizante(produto, t) {
  if (!/\bIMPERMEABILIZ/i.test(t) && !/^VEDACIT\b/.test(t) && !/\bMANTA LÍQUIDA\b/.test(t)) return null;
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  let pc = 'IMPERMEABILIZANTE';
  if (/PAREDE/.test(t)) pc = 'IMPERMEABILIZANTE PAREDE';
  else if (/VEDACIT/.test(t)) pc = 'VEDACIT';
  else if (/MANTA LÍQUIDA/.test(t)) pc = 'MANTA LÍQUIDA';
  return patch('IMPERMEABILIZANTE', 'IMPERMEABILIZANTE', 'mix', pc, h2 || extractEmbalagem(t), h3);
}

function parseTuboPorLinha(produto, t) {
  const h1u = norm(produto.campo_hierarquico_1);
  if (!h1u.startsWith('TUBO') && !/^TUBO\b/.test(t)) return null;
  if (/ADESIVO|TUBOLAR|COLAR PARA TUBO|TORNEIRA.*TUBO/.test(t)) return null;

  const h2u = norm(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  const h4 = trim(produto.campo_hierarquico_4);
  const med = h3 || trim(produto.campo_hierarquico_2);

  if (h2u.includes('ELETRODUTO') || /TUBO ELETRODUTO/.test(t)) {
    return patch('ELETRODUTO', 'ELETRODUTO', 'mix', 'TUBO ELETRODUTO', med, h4);
  }
  if (h2u.includes('ESGOTO') || /TUBO ESGOTO|TUBO OCRE|TUBO DESCARGA|\bPOÇO\b|\bPOCO\b/.test(t)) {
    let pc = 'TUBO ESGOTO';
    if (/OCRE/.test(t)) pc = 'TUBO OCRE';
    else if (/DESCARGA/.test(t)) pc = 'TUBO DESCARGA';
    return patch('ESGOTO', 'ESGOTO', 'mix', pc, med, h4);
  }
  if (h2u.includes('SOLD') || /TUBO SOLDAVEL/.test(t)) {
    return patch('SOLDAVEL', 'SOLDÁVEL', 'mix', 'TUBO SOLDÁVEL', med, h4);
  }
  if (h2u.includes('ROSC') || /TUBO ROSCAVEL|TUBO GALVANIZ/.test(t)) {
    const pc = /GALVANIZ/.test(t) ? 'TUBO GALVANIZADO' : 'TUBO ROSCÁVEL';
    return patch('ROSCAVEL', 'ROSCÁVEL', 'mix', pc, med, h4);
  }
  return null;
}

/** Exportado para inferenciaHierarquiaEstudo (h1=TUBO estruturado). */
export function inferirTuboPorLinha(produto, t = textBlob(produto)) {
  return parseTuboPorLinha(produto, t);
}

function parseTorneira(produto, t) {
  if (!/^TORNEIRA\b/.test(t)) return null;
  const h2 = trim(produto.campo_hierarquico_2);
  const h3 = trim(produto.campo_hierarquico_3);
  let pc = 'TORNEIRA';
  if (/PURIFICADOR/.test(t)) pc = 'TORNEIRA PURIFICADOR';
  else if (/MONOCOMANDO/.test(t)) pc = 'TORNEIRA MONOCOMANDO';
  else if (/BICA/.test(t)) pc = 'TORNEIRA BICA';
  else if (/COZINHA/.test(t)) pc = 'TORNEIRA COZINHA';
  else if (/PLASTICA|PLÁSTICA/.test(t)) pc = 'TORNEIRA PLÁSTICA';
  return patch('TORNEIRA', 'TORNEIRA', 'portfolio', pc, h2, h3);
}

/** @returns {null | object} */
export function planLinhaPorTipoProduto(produto = {}) {
  const t = textBlob(produto);
  if (!t && !trim(produto.campo_hierarquico_1)) return null;

  for (const fn of [
    () => parseVerniz(produto, t),
    () => parseRejunte(produto, t),
    () => parseArgamassa(produto, t),
    () => parseCimento(produto, t),
    () => parseMassa(produto, t),
    () => parseTinta(produto, t),
    () => parsePrego(produto, t),
    () => parseParafuso(produto, t),
    () => parseAdesivo(produto, t),
    () => parseImpermeabilizante(produto, t),
    () => parseTuboPorLinha(produto, t),
    () => parseTorneira(produto, t),
  ]) {
    const r = fn();
    if (r) return r;
  }
  return null;
}
