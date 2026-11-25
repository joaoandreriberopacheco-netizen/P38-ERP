import { base44 } from '@/api/base44Client';
import { dataHoje } from '@/components/utils/dateUtils';
import { fetchAllProdutosCatalogo } from '@/lib/fetchProdutosAtivos';
import { fetchPedidosCompraParaSugestaoEstoque } from '@/lib/fetchPedidosCompraParaSugestaoEstoque';
import { fetchPedidosVendaParaMargemCompetencia } from '@/lib/fetchPedidosVenda90d';
import { computeFluxoOrganicoEncomenda } from '@/lib/relatorioFluxoOrganicoEncomenda/computeFluxoOrganicoEncomenda';

export async function fetchFluxoOrganicoEncomendaReport(competencia = dataHoje().slice(0, 7)) {
  const [produtos, pedidosVenda, compraCtx] = await Promise.all([
    fetchAllProdutosCatalogo(),
    fetchPedidosVendaParaMargemCompetencia(competencia),
    fetchPedidosCompraParaSugestaoEstoque(base44),
  ]);

  return computeFluxoOrganicoEncomenda({
    competencia,
    pedidosVenda,
    pedidosCompra: compraCtx.pedidosTodos || [],
    produtos,
  });
}
