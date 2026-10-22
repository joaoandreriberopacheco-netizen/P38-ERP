import { base44 } from '@/api/base44Client';
import { hydratePedidosCompraItensFromSql } from '@/lib/fetchPedidoCompraItens';
import { getEmbarqueItensLinhas, hydrateEmbarquesFromSql } from '@/lib/fetchEmbarqueItens';
import { carregarProdutosMap } from '@/lib/embarqueVitrineHelpers';
import { materializePedidosCompraView } from '@/lib/comprasEmbarqueCards';
import { enrichEmbarqueParaConsulta } from '@/lib/consultaComprasEmbarques';
import { renderConsultaPedidosToJsPdf } from '@/lib/consultaComprasHtmlExport';
import { appendAnexosToPdfDoc } from '@/lib/appendAnexosToPdfDoc';

async function carregarPedidoParaConsultaAnexos(pedidoId) {
  const pedido = await base44.entities.PedidoCompra.get(pedidoId);
  if (!pedido?.id) {
    throw new Error('Pedido não encontrado para gerar a capa do PDF.');
  }

  const [pedidoHidratado] = await hydratePedidosCompraItensFromSql(base44, [pedido]);
  Object.assign(pedido, pedidoHidratado || {});

  let embarquesDb = [];
  try {
    const headers = await base44.entities.Embarque.filter({ pedido_compra_id: pedidoId });
    embarquesDb = await hydrateEmbarquesFromSql(base44, headers || []);
  } catch {
    embarquesDb = [];
  }

  const produtoIds = [
    ...new Set([
      ...(pedido.itens || []).map((item) => item.produto_id).filter(Boolean),
      ...embarquesDb.flatMap((emb) => getEmbarqueItensLinhas(emb).map((item) => item.produto_id).filter(Boolean)),
    ]),
  ];
  const produtosMap = await carregarProdutosMap(produtoIds.map((id) => ({ produto_id: id })));

  const { cardsDeEmbarque } = materializePedidosCompraView([pedido], embarquesDb, produtosMap);
  const pedidosConsulta = (cardsDeEmbarque || []).map((card) => enrichEmbarqueParaConsulta(card, produtosMap));

  return { pedido, pedidosConsulta, produtosMap };
}

/**
 * Exporta anexos do pedido com a 1ª página = visual da consulta (HTML) + comprovantes.
 */
export async function exportPedidoAnexosComMinutaPdf({
  pedidoId,
  pedidoNumero = '',
  anexos = [],
  fileName = 'anexos.pdf',
}) {
  if (!pedidoId) {
    throw new Error('Pedido não informado para exportar anexos com consulta.');
  }

  const { pedido, pedidosConsulta, produtosMap } = await carregarPedidoParaConsultaAnexos(pedidoId);
  const anexosValidos = (anexos || []).filter((item) => item?.url_drive);
  const numero = pedidoNumero || pedido.numero || pedidoId;

  if (!pedidosConsulta.length) {
    throw new Error('Não há dados do pedido para montar a capa da consulta.');
  }

  const doc = await renderConsultaPedidosToJsPdf({
    pedidosFiltrados: pedidosConsulta,
    produtosMap,
    showDetalheCustos: true,
    theme: 'light',
    filtrosDesc: `Pedido ${numero}`,
    contextLabel: 'Consulta do pedido',
    groupBy: 'eta_transportadora',
    sortOrder: 'asc',
  });

  if (doc.internal.getNumberOfPages() < 1) {
    throw new Error('A capa da consulta não foi gerada. Tente novamente ou atualize a página.');
  }

  if (anexosValidos.length > 0) {
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 8;
    await appendAnexosToPdfDoc(doc, anexosValidos, {
      sectionPrefix: `Anexos ${numero}`,
      mode: 'one_per_page',
      layout: {
        margin,
        titleY: 12,
        contentTop: 18,
        contentBottom: pageH - 10,
      },
      flow: {
        newPageY: 10,
        bottomPad: 10,
      },
    });
  }

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);

  return { pages: 'consulta_com_anexos', anexos: anexosValidos.length };
}
