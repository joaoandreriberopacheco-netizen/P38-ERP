/**
 * Saldo de estoque a partir do extrato de MovimentacaoEstoque (mesma regra de
 * `sincronizarEstoquePorMovimentacao` / `recalcularEstoqueProduto`, antes do Math.max no cadastro).
 */
export function calcularSaldoMovimentacoes(movimentacoes = []) {
  return (movimentacoes || []).reduce((acc, mov) => {
    const quantidade = Number(mov.quantidade) || 0;
    if (mov.tipo === "Entrada") return acc + quantidade;
    if (mov.tipo === "Saída") return acc - quantidade;
    return acc;
  }, 0);
}

const MOVIMENTACOES_PAGE_SIZE = 500;

/**
 * Carrega **todas** as movimentações de um produto (paginado).
 * Não usar limite fixo (ex.: 1000) — produtos com histórico longo distorcem contagens.
 */
export async function fetchMovimentacoesEstoqueProduto(base44, produtoId) {
  if (!produtoId || !base44?.entities?.MovimentacaoEstoque?.filter) return [];

  const todos = [];
  let skip = 0;

  while (true) {
    const batch = await base44.entities.MovimentacaoEstoque.filter(
      { produto_id: produtoId },
      "created_date",
      MOVIMENTACOES_PAGE_SIZE,
      skip,
    );
    const rows = Array.isArray(batch) ? batch : batch?.data ?? [];
    if (!rows.length) break;
    todos.push(...rows);
    if (rows.length < MOVIMENTACOES_PAGE_SIZE) break;
    skip += rows.length;
  }

  return todos;
}

/** Saldo do extrato completo de um produto (fonte para Contagem Express / auditorias). */
export async function calcularSaldoExtratoProduto(base44, produtoId) {
  const movs = await fetchMovimentacoesEstoqueProduto(base44, produtoId);
  return calcularSaldoMovimentacoes(movs);
}

/** Preserva negativos; evita `Number(x) || 0` que mascararia só NaN (não o -1). */
export function parseEstoqueCadastro(val) {
  const n = Number(val);
  if (Number.isFinite(n)) return n;
  if (val == null || val === "") return 0;
  const s = String(val).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const m = Number(s);
  return Number.isFinite(m) ? m : 0;
}
