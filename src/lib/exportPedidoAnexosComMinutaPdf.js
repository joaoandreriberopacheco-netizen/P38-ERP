import { base44 } from '@/api/base44Client';
import { gerarRelatorioPedidosCompra } from '@/functions/gerarRelatorioPedidosCompra';
import { hydratePedidosCompraItensFromSql } from '@/lib/fetchPedidoCompraItens';
import { getEmbarqueItensLinhas, hydrateEmbarquesFromSql } from '@/lib/fetchEmbarqueItens';
import { carregarProdutosMap } from '@/lib/embarqueVitrineHelpers';
import { materializePedidosCompraView } from '@/lib/comprasEmbarqueCards';
import { buildGruposConsultaEmbarques, enrichEmbarqueParaConsulta } from '@/lib/consultaComprasEmbarques';
import { normalizarPedidoParaRelatorio } from '@/lib/comprasRelatorioPedidos';

async function carregarPedidoParaMinutaAnexos(pedidoId) {
  const pedido = await base44.entities.PedidoCompra.get(pedidoId);
  if (!pedido?.id) {
    throw new Error('Pedido não encontrado para gerar a minuta.');
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

function buildGruposMinutaPedido(pedidosConsulta, produtosMap) {
  if (!pedidosConsulta.length) return [];
  return buildGruposConsultaEmbarques(pedidosConsulta, 'eta_transportadora', 'asc').map((grupo) => ({
    key: grupo.key,
    label: grupo.label,
    groupDate: grupo.groupDate,
    groupCarrier: grupo.groupCarrier,
    pedidos: (grupo.cards || []).map((card) => normalizarPedidoParaRelatorio(card, produtosMap)),
  }));
}

/**
 * Minuta individual: capa enxuta (mesmo PDF da consulta nos relatórios) + anexos.
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

  const { pedido, pedidosConsulta, produtosMap } = await carregarPedidoParaMinutaAnexos(pedidoId);
  const anexosValidos = (anexos || []).filter((item) => item?.url_drive);
  const numero = pedidoNumero || pedido.numero || pedidoId;

  if (!pedidosConsulta.length) {
    throw new Error('Não há dados do pedido para montar a minuta.');
  }

  const pedidosNormalizados = pedidosConsulta.map((card) => normalizarPedidoParaRelatorio(card, produtosMap));
  const grupos = buildGruposMinutaPedido(pedidosConsulta, produtosMap);
  const totalGeral = pedidosConsulta.reduce(
    (acc, card) => acc + (Number(card._consulta_valor) || Number(card._display_valor) || 0),
    0,
  );

  const resultado = await gerarRelatorioPedidosCompra({
    pedidos: pedidosNormalizados,
    grupos,
    version: 'expandida_com_anexos_a4',
    filtros_desc: `Pedido ${numero}`,
    kpis: { totalPedidos: pedidosNormalizados.length, totalGeral },
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
