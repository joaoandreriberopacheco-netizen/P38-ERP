/**
 * Preços PagLeve — Formigres na tabela oficial; demais fabricantes usam
 * derivação Arielle (formato + linha), como referência comercial no catálogo.
 */
import { resolvePrecoFormigres } from './formigresTabelaPrecos.mjs';
import { resolvePrecoArielle } from './arielleTabelaPrecos.mjs';

export function produtoPrecoFromItem(item) {
  const tipo = item.formigres_tipo
    || (item.linha === 'retificada' ? 'RETIFICADO' : item.linha === 'bold' ? 'BOLD' : '');
  const acab = String(item.formigres_acabamento || item.acabamento_label || '').toUpperCase();
  return {
    formato: item.formato,
    titulo: item.descricao || item.formigres_titulo,
    tipo,
    acabamento: acab,
  };
}

/**
 * @param {object} item — linha do catálogo PagLeve
 * @param {object} classif — { linha, subtipo, variante_lisa }
 * @param {object} [prodSnapshot] — produto Formigres/Carmelo normalizado quando houver match
 */
export function resolvePrecoPagLeve(item, classif, prodSnapshot = null) {
  const prod = prodSnapshot || produtoPrecoFromItem(item);
  const fg = String(item.fabricante_grupo || '').trim();
  if (fg === 'Grupo Formigres') {
    return resolvePrecoFormigres(prod, classif);
  }
  return resolvePrecoArielle(prod, classif);
}
