import { base44 } from '@/api/base44Client';
import { generateRelatorioPedidosCompraPdf } from '@/lib/relatorioPedidosCompraPdf/generateRelatorioPedidosCompraPdf';
import { hydratePedidosCompraItensFromSql } from '@/lib/fetchPedidoCompraItens';
import { getEmbarqueItensLinhas, hydrateEmbarquesFromSql } from '@/lib/fetchEmbarqueItens';
import { carregarProdutosMap } from '@/lib/embarqueVitrineHelpers';
import { normalizarPedidoParaRelatorio } from '@/lib/comprasRelatorioPedidos';

function buildEmbarqueFallback(pedidoId, pedidoNumero) {
  return {
    id: `original-${pedidoId}`,
    pedido_compra_id: pedidoId,
    numero: pedidoNumero || '',
    tipo: 'Original',
    status: 'Pendente',
    status_recebimento: 'Pendente',
  };
}

async function carregarPedidoParaMinutaAnexos(pedidoId) {
  const pedido = await base44.entities.PedidoCompra.get(pedidoId);
  if (!pedido?.id) {
    throw new Error('Pedido não encontrado para gerar a minuta.');
  }

  await hydratePedidosCompraItensFromSql(base44, [pedido]);

  let embarquesDb = [];
  try {
    const headers = await base44.entities.Embarque.filter({ pedido_compra_id: pedidoId });
    embarquesDb = await hydrateEmbarquesFromSql(base44, headers || []);
  } catch {
    embarquesDb = [];
  }

  const embarque =
    embarquesDb
      .filter((item) => item?.tipo !== 'Necessidade')
      .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0))[0]
    || embarquesDb[0]
    || buildEmbarqueFallback(pedidoId, pedido.numero);

  const produtoIds = [
    ...new Set([
      ...(pedido.itens || []).map((item) => item.produto_id).filter(Boolean),
      ...embarquesDb.flatMap((emb) => getEmbarqueItensLinhas(emb).map((item) => item.produto_id).filter(Boolean)),
    ]),
  ];
  const produtosMap = await carregarProdutosMap(produtoIds.map((id) => ({ produto_id: id })));

  const pedidoNormalizado = normalizarPedidoParaRelatorio(
    {
      ...pedido,
      _embarque: embarque,
      _display_code: pedido.numero,
      _display_fornecedor: pedido.fornecedor_nome || '—',
      _display_status: pedido.status,
    },
    produtosMap,
  );

  return { pedido: pedidoNormalizado, produtosMap };
}

/**
 * Exporta anexos do pedido com minuta A4 na 1ª página (enxuto + consulta mobile).
 */
export async function exportPedidoAnexosComMinutaPdf({
  pedidoId,
  pedidoNumero = '',
  anexos = [],
  fileName = 'anexos.pdf',
}) {
  if (!pedidoId) {
    throw new Error('Pedido não informado para exportar anexos com minuta.');
  }

  const { pedido, produtosMap } = await carregarPedidoParaMinutaAnexos(pedidoId);
  const anexosValidos = (anexos || []).filter((item) => item?.url_drive);

  const resultado = await generateRelatorioPedidosCompraPdf({
    pedidos: [pedido],
    version: 'expandida_com_anexos_a4',
    filtros_desc: `Anexos do pedido ${pedidoNumero || pedido.numero || pedidoId}`,
    kpis: { totalPedidos: 1, totalGeral: pedido.valor_total || 0 },
    produtos_map: produtosMap,
    anexos_por_pedido: { [pedidoId]: anexosValidos },
  });

  const blob = new Blob([resultado.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);

  return { pages: resultado.version, anexos: anexosValidos.length };
}
