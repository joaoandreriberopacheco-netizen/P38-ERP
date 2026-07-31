import { parseSearchTerms } from '@/lib/searchTokens';
import { normalizeProductCodeForSearch, productCodesMatch } from '@/lib/productCode';

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
};

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
  const codigo = String(item.codigo || item.codigo_pdf || '').trim();
  const marca = String(item.marca || item.marca_pdf || '').trim();

  if (codigo) queries.push(codigo);
  if (descricao) queries.push(descricao);
  if (descricao && marca) queries.push(`${descricao} ${marca}`);
  if (codigo && descricao) queries.push(`${codigo} ${descricao}`);
  return [...new Set(queries.filter(Boolean))];
}

function findByProductCode(item, catalogoProdutos = []) {
  const codigo = String(item.codigo || item.codigo_pdf || '').trim();
  if (!codigo) return null;
  const hit = catalogoProdutos.find((produto) =>
    productCodesMatch(codigo, produto.codigo_interno)
    || productCodesMatch(codigo, produto.codigo_barras),
  );
  return hit ? { produto: hit, confianca: 'alta' } : null;
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

export function getProductSearchText(produto) {
  const codigoInternoRaw = normalizeProductCodeForSearch(produto?.codigo_interno);
  return normalizeMatchText([
    produto?.nome,
    produto?.codigo_interno,
    codigoInternoRaw,
    produto?.codigo_barras,
    produto?.campo_hierarquico_1,
    produto?.campo_hierarquico_2,
    produto?.campo_hierarquico_3,
    produto?.campo_hierarquico_4,
    produto?.campo_hierarquico_5,
    produto?.marca,
  ].filter(Boolean).join(' '));
}

/** Termos separados por espaço ou ";" — todos devem aparecer (mesmo conceito da tela Produtos). */
export function getSemicolonSearchTokens(query) {
  return parseSearchTerms(query, normalizeProductSearchText);
}

export function matchesProductQuery(produto, query) {
  if (!query?.trim()) return true;
  const searchable = getProductSearchText(produto);
  const terms = parseSearchTerms(query, normalizeMatchText);
  return terms.every((term) => searchable.includes(term));
}

export function sortProductsAlphabetically(produtos = []) {
  return [...produtos].sort((a, b) =>
    getProdutoLabel(a).localeCompare(getProdutoLabel(b), 'pt-BR', { sensitivity: 'base' })
  );
}

export function filterAndSortProducts(produtos = [], query = '', { limit = null, includeEmpty = false } = {}) {
  const trimmed = String(query || '').trim();
  if (!trimmed && !includeEmpty) return [];

  const sorted = sortProductsAlphabetically(produtos);
  const filtered = trimmed
    ? sorted.filter((produto) => matchesProductQuery(produto, trimmed))
    : sorted;

  return Number.isFinite(limit) && limit > 0 ? filtered.slice(0, limit) : filtered;
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
  const byCode = findByProductCode(ocrItem, catalogoProdutos);
  if (byCode) return byCode;

  const queries = buildOcrItemMatchQueries(ocrItem);
  if (!queries.length && textoIdentificado) queries.push(String(textoIdentificado).trim());
  if (!queries.length) return null;

  let best = null;
  let bestScore = 0;
  let secondScore = 0;

  for (const query of queries) {
    const queryTokens = tokenizeForProductMatch(query);
    if (!queryTokens.length) continue;

    const direct = catalogoProdutos.find((produto) => matchesProductQuery(produto, query));
    if (direct) return { produto: direct, confianca: 'media' };

    for (const produto of catalogoProdutos) {
      const score = scoreProductAgainstTokens(queryTokens, produto);
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
  const minScore = minWords <= 2 ? 0.45 : minWords <= 4 ? 0.38 : 0.32;
  const marginOk = bestScore - secondScore >= 0.08 || secondScore === 0;

  if (!best || bestScore < minScore || !marginOk) return null;

  let confianca = 'baixa';
  if (bestScore >= 0.75) confianca = 'alta';
  else if (bestScore >= 0.55) confianca = 'media';

  return { produto: best, confianca, score: bestScore };
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

export function buildProdutoMatchingPromptBase({ produtos, fornecedores, contextLabel = 'CATALOGO DE PRODUTOS' }) {
  const catalogoStr = JSON.stringify((produtos || []).map(getProdutoCatalogEntry));
  const fornecedoresStr = JSON.stringify((fornecedores || []).map(getFornecedorCatalogEntry));

  return `Você é um especialista em materiais de construção e loja de materiais.

Tarefa: analisar o documento e para CADA item identificado, encontrar o produto correspondente no catálogo abaixo.

REGRAS OBRIGATÓRIAS DE MATCHING:
1. Use correspondência SEMÂNTICA - ignore abreviações, acentos, maiúsculas/minúsculas e variações ortográficas.
2. Exemplos de correspondência esperada:
   - "CIM CPIV 50KG VOTO" -> produto com "Cimento Portland CP IV 50kg Votorantim"
   - "ARGAM AC III 20KG" -> produto com "Argamassa Colante AC-III 20kg"
   - "PLACA DRYWALL ST 12,5" -> produto com "Placa Dry Wall Standard 12.5mm"
3. Se houver dúvida entre dois produtos, escolha o que tiver MAIS campos coincidentes (tipo, gramatura, dimensão, marca e código).
4. Prefira confiança "baixa" a deixar o match vazio - só deixe vazio se não existir NENHUM produto similar.
5. O id do match deve conter EXATAMENTE o id do produto do catálogo, sem alterações.

Fornecedores cadastrados:
${fornecedoresStr}

${contextLabel} (id | nome completo | marca | código):
${catalogoStr}`;
}
