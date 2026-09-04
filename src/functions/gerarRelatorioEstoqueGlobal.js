import { base44 } from '@/api/base44Client';
import { fetchCompraContextBrowser } from '@/lib/relatorioEstoqueGlobalPdf/fetchCompraContextBrowser';
import { generateRelatorioEstoqueGlobalPdf } from '@/lib/relatorioEstoqueGlobalPdf/generateRelatorioEstoqueGlobalPdf';

/**
 * PDF consolidado — estoque físico + trânsito (2 páginas, reunião).
 */
export async function gerarRelatorioEstoqueGlobal({ produtos } = {}) {
  const lista = Array.isArray(produtos) ? produtos : [];
  const compraContext = await fetchCompraContextBrowser(base44);
  return generateRelatorioEstoqueGlobalPdf({ produtos: lista, compraContext });
}
