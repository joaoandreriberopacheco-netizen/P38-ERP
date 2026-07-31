import { parseSearchTerms } from '@/lib/searchTokens';
import { normalizeProductCodeForSearch } from '@/lib/productCode';

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
  return normalizeProductSearchText([
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
  const terms = getSemicolonSearchTokens(query);
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
export function findLocalBestProductMatch(textoIdentificado, catalogoProdutos = []) {
  const query = String(textoIdentificado || '').trim();
  if (!query || !catalogoProdutos.length) return null;

  const direct = catalogoProdutos.find((produto) => matchesProductQuery(produto, query));
  if (direct) return { produto: direct, confianca: 'media' };

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let best = null;
  let bestScore = 0;

  catalogoProdutos.forEach((produto) => {
    const searchable = getProductSearchText(produto);
    const score = words.reduce((sum, word) => sum + (searchable.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = produto;
    }
  });

  const threshold = Math.max(2, Math.ceil(words.length / 2));
  if (!best || bestScore < threshold) return null;
  return { produto: best, confianca: bestScore >= words.length ? 'media' : 'baixa' };
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
