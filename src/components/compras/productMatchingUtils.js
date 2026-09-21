import { ratio as fuzzRatio } from 'fuzzball';
import { parseSearchTerms } from '@/lib/searchTokens';
import { isCanonicalProductCode, normalizeProductCodeForSearch, productCodesMatch } from '@/lib/productCode';

const MATCH_STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'para', 'por', 'no', 'na', 'nos', 'nas',
  'un', 'und', 'uni', 'unid', 'pc', 'pç', 'pct', 'cx', 'caixa', 'kg', 'g', 'ml', 'l', 'lt', 'm', 'mt', 'mm', 'cm',
  'colante', // PDF traz "argamassa colante"; catálogo costuma ser só "ARGAMASSA … AC-n"
]);

const MATERIAL_ABBREVIATIONS = {
  cim: 'cimento',
  argam: 'argamassa',
  cpiv: 'cp iv',
  cpi: 'cp',
  drywall: 'dry wall',
  dry: 'dry',
  wall: 'wall',
  placa: 'placa',
  tijolo: 'tijolo',
  telha: 'telha',
  tinta: 'tinta',
  verniz: 'verniz',
  massa: 'massa',
  rejunte: 'rejunte',
  piso: 'piso',
  porc: 'porcelanato',
  porcel: 'porcelanato',
  mrm: 'marrom',
  bg: 'bege',
};

/** Abreviações comuns na busca manual (ex.: "naturale mrm" → marrom). */
const QUERY_TERM_ALIASES = {
  mrm: 'marrom',
  bg: 'bege',
};

function termMatchesSearchable(term, searchable) {
  if (!term) return true;
  if (searchable.includes(term)) return true;
  const alias = QUERY_TERM_ALIASES[term];
  return alias ? searchable.includes(alias) : false;
}

function preprocessMatchText(value) {
  return String(value || '')
    .replace(/\bac[\s-]*iii\b/gi, ' ac3 ')
    .replace(/\bac[\s-]*ii\b/gi, ' ac2 ')
    .replace(/\bac[\s-]*iv\b/gi, ' ac4 ')
    .replace(/\bac[\s-]*i\b/gi, ' ac1 ')
    .replace(/\bac[\s-]*1\b/gi, ' ac1 ')
    .replace(/\bac[\s-]*2\b/gi, ' ac2 ')
    .replace(/\bac[\s-]*3\b/gi, ' ac3 ')
    .replace(/\b(\d+)\s*kg\b/gi, ' $1kg ');
}

function normalizeMatchText(value) {
  return normalizeProductSearchText(
    preprocessMatchText(value)
      .replace(/[²³]/g, '2')
      .replace(/[,;:/|()[\]{}]/g, ' ')
      .replace(/(\d)([a-z]{2,})/gi, '$1 $2')
      .replace(/([a-z]{2,})(\d)/gi, '$1 $2'),
  );
}

const OCR_COLOR_TOKENS = new Set([
  'amarelo', 'vermelho', 'branco', 'cinza', 'preto', 'azul', 'verde', 'marrom', 'bege', 'neve',
]);

const OCR_KIND_TOKENS = new Set([
  'acrilica', 'acrilico', 'corrida', 'piso', 'semibrilho', 'latex', 'esmalte', 'textura', 'demarcacao',
]);

/** Evita vincular tinta amarela → vermelha, massa acrílica → corrida, etc. */
function ocrMatchHasDiscriminatorConflict(queryTokens, catalogTokens) {
  const qColors = queryTokens.filter((t) => OCR_COLOR_TOKENS.has(t));
  const cColors = catalogTokens.filter((t) => OCR_COLOR_TOKENS.has(t));
  if (qColors.length && cColors.length && !qColors.some((c) => cColors.includes(c))) {
    return true;
  }

  const qKinds = queryTokens.filter((t) => OCR_KIND_TOKENS.has(t));
  const cKinds = catalogTokens.filter((t) => OCR_KIND_TOKENS.has(t));
  if (!qKinds.length || !cKinds.length) return false;
  if (qKinds.some((k) => cKinds.includes(k))) return false;

  const conflictPairs = [
    ['acrilica', 'acrilico', 'corrida'],
    ['piso', 'semibrilho', 'latex', 'esmalte'],
  ];
  for (const group of conflictPairs) {
    const qIn = qKinds.some((k) => group.includes(k));
    const cIn = cKinds.some((k) => group.includes(k));
    if (qIn && cIn) return true;
  }
  return qKinds.length >= 1 && cKinds.length >= 1;
}

function tokenizeForProductMatch(value) {
  const normalized = normalizeMatchText(value);
  if (!normalized) return [];

  const tokens = [];
  for (const raw of normalized.split(/\s+/)) {
    if (!raw || raw.length < 2) continue;
    if (MATCH_STOPWORDS.has(raw)) continue;
    tokens.push(raw);
    const expanded = MATERIAL_ABBREVIATIONS[raw];
    if (expanded) {
      for (const part of expanded.split(/\s+/)) {
        if (part && !MATCH_STOPWORDS.has(part)) tokens.push(part);
      }
    }
  }
  return [...new Set(tokens)];
}

function tokenMatchScore(queryToken, catalogToken) {
  if (!queryToken || !catalogToken) return 0;
  if (queryToken === catalogToken) return 1;
  if (queryToken.length >= 3 && catalogToken.startsWith(queryToken)) return 0.9;
  if (catalogToken.length >= 3 && queryToken.startsWith(catalogToken)) return 0.8;
  if (queryToken.length >= 4 && catalogToken.includes(queryToken)) return 0.65;
  if (catalogToken.length >= 4 && queryToken.includes(catalogToken)) return 0.55;
  return 0;
}

function scoreProductAgainstTokens(queryTokens, produto) {
  const catalogTokens = tokenizeForProductMatch(getProductSearchText(produto));
  if (!queryTokens.length || !catalogTokens.length) return 0;

  let total = 0;
  for (const queryToken of queryTokens) {
    let best = 0;
    for (const catalogToken of catalogTokens) {
      best = Math.max(best, tokenMatchScore(queryToken, catalogToken));
    }
    total += best;
  }
  return total / queryTokens.length;
}

function buildOcrItemMatchQueries(item = {}) {
  const queries = [];
  const descricao = String(item.descricao || item.descricao_pdf || item.texto_identificado || '').trim();
  const marca = String(item.marca || item.marca_pdf || '').trim();

  if (descricao) queries.push(descricao);
  if (descricao && marca) queries.push(`${descricao} ${marca}`);

  const tokens = tokenizeForProductMatch(descricao);
  if (tokens.length > 4) {
    queries.push(tokens.slice(0, 4).join(' '));
    queries.push(tokens.slice(0, 6).join(' '));
  } else if (tokens.length >= 2) {
    queries.push(tokens.join(' '));
  }

  return [...new Set(queries.filter(Boolean))];
}

/** Match OCR: não exige 100% das palavras do PDF (descrições longas de distribuidor). */
function matchesProductQueryOcrLoose(produto, query) {
  const tokens = tokenizeForProductMatch(query);
  if (!tokens.length) return false;
  const searchable = getProductSearchText(produto);
  const matched = tokens.filter((term) => termMatchesSearchable(term, searchable));
  const minRequired = tokens.length <= 3
    ? tokens.length
    : Math.max(2, Math.ceil(tokens.length * 0.55));
  return matched.length >= minRequired;
}

export function getProdutoLabel(produto) {
  if (!produto) return '';

  const partesHierarquia = [
    produto.campo_hierarquico_1,
    produto.campo_hierarquico_2,
    produto.campo_hierarquico_3,
    produto.campo_hierarquico_4,
    produto.campo_hierarquico_5,
  ].filter(Boolean);

  if (partesHierarquia.length > 0) {
    return partesHierarquia.join(' ');
  }

  return produto.nome || '';
}

export function normalizeProductSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildProductSearchFields(produto, { includeHierarchy = false } = {}) {
  const codigoInternoRaw = normalizeProductCodeForSearch(produto?.codigo_interno);
  const fields = [
    produto?.nome,
    produto?.descricao,
    produto?.codigo_interno,
    codigoInternoRaw,
    produto?.codigo_barras,
    produto?.marca,
  ];
  if (includeHierarchy) {
    fields.push(
      produto?.campo_hierarquico_1,
      produto?.campo_hierarquico_2,
      produto?.campo_hierarquico_3,
      produto?.campo_hierarquico_4,
      produto?.campo_hierarquico_5,
    );
  }
  return fields.filter(Boolean);
}

/** Texto pesquisável completo (inclui hierarquia) — OCR e match automático. */
export function getProductSearchText(produto) {
  return normalizeMatchText(buildProductSearchFields(produto, { includeHierarchy: true }).join(' '));
}

/** Texto pesquisável manual — alinhado ao catálogo Produtos (nome, códigos, marca). */
export function getProductPrimarySearchText(produto) {
  return normalizeMatchText(buildProductSearchFields(produto, { includeHierarchy: false }).join(' '));
}

/** Termos separados por espaço ou ";" — todos devem aparecer (mesmo conceito da tela Produtos). */
export function getSemicolonSearchTokens(query) {
  return parseSearchTerms(query, normalizeProductSearchText);
}

export function matchesProductQuery(produto, query, { includeHierarchy = false } = {}) {
  if (!query?.trim()) return true;
  const searchable = includeHierarchy
    ? getProductSearchText(produto)
    : getProductPrimarySearchText(produto);
  const terms = parseSearchTerms(query, normalizeMatchText);
  return terms.every((term) => termMatchesSearchable(term, searchable));
}

function scoreManualProductSearch(produto, query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return 0;

  const terms = parseSearchTerms(trimmed, normalizeMatchText);
  if (!terms.length) return 0;

  const primaryText = getProductPrimarySearchText(produto);
  if (!terms.every((term) => termMatchesSearchable(term, primaryText))) return 0;

  const nomeText = normalizeMatchText(produto?.nome);
  const queryTokens = tokenizeForProductMatch(trimmed);
  let score = scoreProductAgainstTokens(queryTokens, produto);

  for (const term of terms) {
    if (nomeText.includes(term)) score += 2;
    else if (primaryText.includes(term)) score += 0.75;
  }

  return score;
}

export function sortProductsAlphabetically(produtos = []) {
  return [...produtos].sort((a, b) =>
    getProdutoLabel(a).localeCompare(getProdutoLabel(b), 'pt-BR', { sensitivity: 'base' })
  );
}

export function filterAndSortProducts(produtos = [], query = '', { limit = null, includeEmpty = false } = {}) {
  const trimmed = String(query || '').trim();
  if (!trimmed && !includeEmpty) return [];

  if (!trimmed) {
    const sorted = sortProductsAlphabetically(produtos);
    return Number.isFinite(limit) && limit > 0 ? sorted.slice(0, limit) : sorted;
  }

  const filtered = produtos.filter((produto) => matchesProductQuery(produto, trimmed));
  const ranked = filtered
    .map((produto) => ({ produto, score: scoreManualProductSearch(produto, trimmed) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return getProdutoLabel(a.produto).localeCompare(getProdutoLabel(b.produto), 'pt-BR', { sensitivity: 'base' });
    })
    .map(({ produto }) => produto);

  return Number.isFinite(limit) && limit > 0 ? ranked.slice(0, limit) : ranked;
}

export function getProdutoCatalogEntry(produto) {
  return {
    id: produto.id,
    nome: getProdutoLabel(produto),
    marca: produto.marca || '',
    codigo: produto.codigo_interno || '',
  };
}

export function getFornecedorCatalogEntry(fornecedor) {
  return {
    id: fornecedor.id,
    nome: fornecedor.nome || '',
    cnpj: fornecedor.cpf_cnpj || '',
  };
}

function normalizeCnpjDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeFornecedorSearchText(value) {
  return normalizeProductSearchText(value);
}

/** Matching local de produto após OCR — sem enviar catálogo ao LLM. */
export function findLocalBestProductMatch(textoIdentificado, catalogoProdutos = [], item = null) {
  if (!catalogoProdutos.length) return null;

  const ocrItem = item || { descricao: textoIdentificado };
  const queries = buildOcrItemMatchQueries(ocrItem);
  if (!queries.length && textoIdentificado) queries.push(String(textoIdentificado).trim());
  if (!queries.length) return null;

  let best = null;
  let bestScore = 0;
  let secondScore = 0;

  for (const query of queries) {
    const queryTokens = tokenizeForProductMatch(query);
    if (!queryTokens.length) continue;

    const direct = catalogoProdutos.find((produto) => {
      const catalogTokens = tokenizeForProductMatch(getProductSearchText(produto));
      if (ocrMatchHasDiscriminatorConflict(queryTokens, catalogTokens)) return false;
      return matchesProductQueryOcrLoose(produto, query);
    });
    if (direct) {
      const directScore = scoreProductAgainstTokens(queryTokens, direct);
      return {
        produto: direct,
        confianca: directScore >= 0.7 ? 'alta' : 'media',
        score: directScore,
      };
    }

    for (const produto of catalogoProdutos) {
      const catalogTokens = tokenizeForProductMatch(getProductSearchText(produto));
      if (ocrMatchHasDiscriminatorConflict(queryTokens, catalogTokens)) continue;
      const tokenScore = scoreProductAgainstTokens(queryTokens, produto);
      const label = getProdutoLabel(produto);
      const primary = getProductPrimarySearchText(produto);
      const fuzzyLabel = query.length >= 6 && label
        ? fuzzRatio(query, label, { full_process: true }) / 100
        : 0;
      const fuzzyPrimary = query.length >= 6 && primary
        ? fuzzRatio(query, primary, { full_process: true }) / 100
        : 0;
      const score = Math.max(tokenScore, fuzzyLabel * 0.92, fuzzyPrimary * 0.88);
      if (score > bestScore) {
        secondScore = bestScore;
        bestScore = score;
        best = produto;
      } else if (score > secondScore) {
        secondScore = score;
      }
    }
  }

  const minWords = Math.max(...queries.map((q) => tokenizeForProductMatch(q).length), 1);
  const minScore = minWords <= 2 ? 0.38 : minWords <= 4 ? 0.30 : 0.24;
  const marginOk =
    bestScore - secondScore >= 0.05
    || secondScore === 0
    || bestScore >= 0.62;

  if (!best || bestScore < minScore || !marginOk) return null;

  let confianca = 'baixa';
  if (bestScore >= 0.75) confianca = 'alta';
  else if (bestScore >= 0.55) confianca = 'media';

  return { produto: best, confianca, score: bestScore };
}

function normalizeMatchConfianca(value, fallback = 'baixa') {
  const c = String(value || '').toLowerCase().trim();
  if (c === 'alta' || c === 'media' || c === 'baixa') return c;
  return fallback;
}

/**
 * Após OCR/LLM: separa sugestão (produto_id_match) de seleção automática (selected_product_id).
 * Evita preencher linha com match fraco (ex.: sempre cair em porcelanato genérico).
 */
export function resolveOcrProductMatch(item, catalogoProdutos = [], llmProdutoId = '') {
  const catalogoIds = new Set(catalogoProdutos.map((p) => p.id));
  const llmId = llmProdutoId && catalogoIds.has(llmProdutoId) ? llmProdutoId : '';
  const local = findLocalBestProductMatch(null, catalogoProdutos, item);
  const localId = local?.produto?.id || '';
  const localScore = local?.score ?? 0;
  const llmConf = normalizeMatchConfianca(item?.confianca, '');

  let matchId = '';
  let confianca = '';

  if (llmId && localId) {
    if (llmId === localId) {
      matchId = llmId;
      confianca = normalizeMatchConfianca(llmConf || local.confianca, local.confianca || 'media');
    } else if (localScore >= 0.55) {
      matchId = localId;
      confianca = normalizeMatchConfianca(local.confianca, 'baixa');
    } else if (llmConf === 'alta') {
      matchId = llmId;
      confianca = 'media';
    }
  } else if (llmId) {
    if (localId === llmId && localScore >= 0.4) {
      matchId = llmId;
      confianca = normalizeMatchConfianca(llmConf, local.confianca || 'media');
    } else if (llmConf === 'alta') {
      matchId = llmId;
      confianca = 'baixa';
    }
  } else if (localId) {
    matchId = localId;
    confianca = normalizeMatchConfianca(local.confianca, 'baixa');
  }

  const autoSelect =
    matchId &&
    (
      confianca === 'alta' ||
      confianca === 'media' ||
      (localId === matchId && localScore >= 0.26) ||
      (llmId === matchId && (llmConf === 'alta' || llmConf === 'media'))
    )
      ? matchId
      : '';

  return {
    produto_id_match: matchId,
    selected_product_id: autoSelect,
    confianca: matchId ? confianca : '',
  };
}

/** Matching local de fornecedor por CNPJ ou nome após OCR. */
export function findLocalBestFornecedorMatch({ nome, cnpj } = {}, fornecedores = []) {
  if (!fornecedores.length) return null;

  const cnpjDigits = normalizeCnpjDigits(cnpj);
  if (cnpjDigits.length >= 11) {
    const byCnpj = fornecedores.find(
      (f) => normalizeCnpjDigits(f.cpf_cnpj) === cnpjDigits,
    );
    if (byCnpj) return byCnpj;
  }

  const nomeNorm = normalizeFornecedorSearchText(nome);
  if (!nomeNorm) return null;

  const exact = fornecedores.find(
    (f) => normalizeFornecedorSearchText(f.nome) === nomeNorm,
  );
  if (exact) return exact;

  const words = nomeNorm.split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return null;

  let best = null;
  let bestScore = 0;
  fornecedores.forEach((f) => {
    const searchable = normalizeFornecedorSearchText(f.nome);
    const score = words.reduce((sum, word) => sum + (searchable.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  });

  return bestScore >= Math.max(2, Math.ceil(words.length / 2)) ? best : null;
}

export function buildCompactFornecedoresTsv(fornecedores = []) {
  if (!fornecedores.length) return '(nenhum)';
  return fornecedores
    .map((f) => {
      const id = String(f.id || '').trim();
      const nome = String(f.nome || '').replace(/\|/g, '/').trim();
      const cnpj = String(f.cpf_cnpj || '').replace(/\D/g, '');
      return `${id}|${nome}|${cnpj}`;
    })
    .join('\n');
}

/** Catálogo mínimo em TSV — ~60% menos tokens que JSON repetindo chaves. */
export function buildCompactProdutosTsv(produtos = [], { maxNomeChars = 96 } = {}) {
  return (produtos || [])
    .map((p) => {
      const id = String(p.id || '').trim();
      const codigo = String(p.codigo_interno || '').replace(/\|/g, '/').trim();
      let nome = getProdutoLabel(p).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
      if (maxNomeChars > 0 && nome.length > maxNomeChars) {
        nome = `${nome.slice(0, maxNomeChars - 1)}…`;
      }
      const marca = String(p.marca || '').replace(/\|/g, '/').trim();
      return `${id}|${codigo}|${nome}|${marca}`;
    })
    .join('\n');
}

/**
 * Prompt enxuto para import pedido: 1 leitura do PDF + match no catálogo compacto.
 */
/** Prompt só extração — sem catálogo (match local depois do OCR Paddle). */
export function buildPedidoCompraExtracaoPrompt({ mode = 'pdf' } = {}) {
  const docTipo = mode === 'pdf' ? 'documento de orçamento/pedido' : 'imagem de lista de compra';
  return `Analise o texto deste ${docTipo}. Extraia fornecedor e itens visíveis no documento.

REGRAS:
- Extraia apenas dados presentes no texto.
- Não invente itens nem valores.
- quantidade e preco_unitario devem ser números quando visíveis.

Retorne JSON:
{
  "fornecedor": {"nome_identificado": "string", "cnpj_identificado": "string"},
  "itens": [{
    "descricao": "texto do documento",
    "codigo": "código no documento",
    "marca": "marca se visível",
    "quantidade": number,
    "preco_unitario": number,
    "unidade_medida_documento": "M2, CX, UN…"
  }]
}`;
}

/** Prompt só extração para cotação PDF — sem catálogo. */
export function buildCotacaoPdfExtracaoPrompt() {
  return `Analise o texto desta proposta/cotação de fornecedor. Extraia fornecedor, valores financeiros e itens.

FINANCEIRO:
- subtotal: soma bruta antes de descontos
- total_final: valor final a pagar (último total do documento)
- desconto_global: diferença entre subtotal e total_final quando aplicável

Retorne JSON:
{
  "fornecedor": {"nome_identificado": "string", "cnpj_identificado": "string"},
  "financeiro": {
    "subtotal": number,
    "desconto_global": number,
    "total_final": number,
    "desconto_comercial": number,
    "desconto_suframa": number
  },
  "itens": [{
    "descricao_pdf": "string",
    "codigo_pdf": "string",
    "marca_pdf": "string",
    "quantidade_pdf": number,
    "preco_unitario_pdf": number
  }]
}`;
}

/** Prompt só transcrição de lista (foto) — sem catálogo. */
export function buildListaFotoExtracaoPrompt() {
  return `Transcreva TODOS os itens visíveis na lista (linha por linha).
Não ignore nenhum item. Se houver dúvida, transcreva com confianca "baixa".

Retorne JSON:
{
  "itens": [{
    "texto_identificado": "string (transcrição exata)",
    "quantidade_escrita": "string (ex: 2cx, 10m) ou null",
    "confianca": "alta|media|baixa"
  }]
}`;
}

export function buildEfficientPedidoCompraPrompt({
  produtos = [],
  fornecedores = [],
  mode = 'pdf',
} = {}) {
  const catalogoTsv = buildCompactProdutosTsv(produtos);
  const fornecedoresTsv = buildCompactFornecedoresTsv(fornecedores);
  const docTipo = mode === 'pdf' ? 'PDF de orçamento/pedido' : 'imagem de lista de compra';

  return `Analise este ${docTipo}. Extraia fornecedor e itens do documento e associe cada item ao catálogo interno.

REGRAS DE MATCH (produtos):
- Correspondência semântica: ignore maiúsculas, acentos e abreviações (ex.: CIM→cimento, AC-I→AC-1, ARGAM→argamassa).
- produto_id_match = id exato da coluna 1 do catálogo, ou string vazia se não houver similar.
- Deixe produto_id_match vazio se a correspondência não for clara — não invente match genérico.
- Use confiança "alta" só com certeza; "media" com boa similaridade; "baixa" se duvidoso (o utilizador confirma).
- fornecedor.id_match = id exato da lista de fornecedores, ou vazio.

FORNECEDORES (id|nome|cnpj):
${fornecedoresTsv}

CATALOGO (${produtos.length} produtos — id|codigo|nome|marca):
${catalogoTsv}

Retorne JSON:
{
  "fornecedor": {"nome_identificado": "string", "cnpj_identificado": "string", "id_match": "id ou vazio"},
  "itens": [{
    "descricao": "texto do documento",
    "codigo": "código no documento",
    "marca": "marca se visível",
    "quantidade": number,
    "preco_unitario": number,
    "unidade_medida_documento": "M2, CX, UN…",
    "produto_id_match": "id do catálogo ou vazio",
    "confianca": "alta|media|baixa"
  }]
}`;
}

export function buildProdutoMatchingPromptBase({ produtos, fornecedores, contextLabel = 'CATALOGO DE PRODUTOS' }) {
  const catalogoStr = buildCompactProdutosTsv(produtos);
  const fornecedoresStr = buildCompactFornecedoresTsv(fornecedores);

  return `Você é um especialista em materiais de construção e loja de materiais.

Tarefa: analisar o documento e para CADA item identificado, encontrar o produto correspondente no catálogo abaixo.

REGRAS OBRIGATÓRIAS DE MATCHING:
1. Use correspondência SEMÂNTICA - ignore abreviações, acentos, maiúsculas/minúsculas e variações ortográficas.
2. Exemplos: "CIM CPIV 50KG"→cimento CP IV 50kg; "ARGAM AC III 20KG"→argamassa AC-III 20kg; "AC-I"→AC-1.
3. produto_id_match = id exato (coluna 1) ou vazio.
4. Deixe vazio se não houver correspondência clara; não force match por categoria genérica (ex.: outro porcelanato).

Fornecedores (id|nome|cnpj):
${fornecedoresStr}

${contextLabel} (${produtos.length} produtos — id|codigo|nome|marca):
${catalogoStr}`;
}
