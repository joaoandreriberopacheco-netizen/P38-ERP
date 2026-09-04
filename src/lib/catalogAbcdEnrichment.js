/**
 * Classe ABCD — fonte canónica: coluna `produto.abcd` no SQL (job IEP / cadastro).
 * O enrich ao vivo só preenche métricas IEP; não substitui a curva gravada.
 */

const CURVAS_VALIDAS = new Set(['A', 'B', 'C', 'D', 'E']);

/** Curva gravada no cadastro (Supabase) — usar antes de qualquer cálculo ao vivo. */
export function resolveCadastroAbcdClasse(produto) {
  if (!produto) return '';
  if (produto.iep_trava_manual) {
    const locked = String(produto.iep_classe || produto.abcd || '').toUpperCase().trim();
    if (CURVAS_VALIDAS.has(locked)) return locked;
  }
  const cadastro = String(produto.abcd || '').toUpperCase().trim();
  return CURVAS_VALIDAS.has(cadastro) ? cadastro : '';
}

export function resolveProdutoAbcdClasse(produto) {
  const cadastro = resolveCadastroAbcdClasse(produto);
  if (cadastro) return cadastro;
  return String(produto?.iep_classe || '').toUpperCase().trim();
}

export function produtoMatchesAbcdFilter(produto, abcdFilter) {
  if (!abcdFilter || abcdFilter === 'all') return true;
  const letter = resolveProdutoAbcdClasse(produto);
  if (!letter) return false;
  return letter === String(abcdFilter).toUpperCase();
}

/** Filtro multi-seleção (ex.: A e B ao mesmo tempo). Array vazio = todas as classes. */
export function produtoMatchesAbcdMultiFilter(produto, selectedLetters) {
  if (!Array.isArray(selectedLetters) || selectedLetters.length === 0) return true;
  const letter = resolveProdutoAbcdClasse(produto);
  if (!letter) return false;
  const allowed = new Set(selectedLetters.map((v) => String(v).toUpperCase()));
  return allowed.has(letter);
}
