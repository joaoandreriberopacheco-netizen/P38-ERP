import { normalizeSearchText } from '@/lib/normalizeSearchText';

/** Prefixo na busca do catálogo para filtrar por categoria de cadastro (área A–J). */
export const CATALOG_AREA_SEARCH_PREFIX = 'xx';

function normalizeAreaText(value) {
  return normalizeSearchText(value);
}

/**
 * Extrai o fragmento de categoria após "XX" (ex.: "xxmolhadas" → "molhadas", "xxj-" → "j").
 * @returns {string|null}
 */
export function parseCatalogAreaNeedle(token) {
  const normalized = normalizeAreaText(token);
  if (!normalized.startsWith(CATALOG_AREA_SEARCH_PREFIX)) return null;

  const needle = normalized
    .slice(CATALOG_AREA_SEARCH_PREFIX.length)
    .replace(/^-+/, '')
    .trim();

  return needle || null;
}

/**
 * Separa termos de texto livre e termos de área (prefixo XX).
 */
export function splitCatalogSearchTokens(terms = []) {
  const textTerms = [];
  const areaNeedles = [];

  for (const term of terms) {
    const areaNeedle = parseCatalogAreaNeedle(term);
    if (areaNeedle != null) {
      areaNeedles.push(areaNeedle);
      continue;
    }
    textTerms.push(term);
  }

  return { textTerms, areaNeedles };
}

/**
 * Verifica se a categoria do produto corresponde ao fragmento XX.
 * - Letra A–J (ex. "j", "j-"): código no início do nome ("J - ...").
 * - Texto livre (ex. "molhadas"): substring no nome da categoria.
 */
export function categoryNomeMatchesAreaNeedle(categoriaNome, areaNeedle) {
  const cat = normalizeAreaText(categoriaNome);
  if (!cat || !areaNeedle) return false;

  const letterCodeMatch = String(areaNeedle).match(/^([a-j])(?:-)?$/i);
  if (letterCodeMatch) {
    const letter = letterCodeMatch[1].toLowerCase();
    return new RegExp(`^${letter}\\s*-\\s*`).test(cat) || cat.startsWith(`${letter}-`);
  }

  return cat.includes(normalizeAreaText(areaNeedle));
}

export function produtoMatchesCategoryAreaTokens(produto, areaNeedles = []) {
  if (!areaNeedles.length) return true;
  return areaNeedles.every((needle) =>
    categoryNomeMatchesAreaNeedle(produto?.categoria_nome, needle)
  );
}
