import { gerarRelatorioPedidosCompra } from '@/functions/gerarRelatorioPedidosCompra';
import { fetchAnexosPorPedidos, coletarPedidoIdsParaRelatorio } from '@/lib/fetchAnexosPorPedidos';
import { dataHoje } from '@/components/utils/dateUtils';
import { normalizeItemCompraParaExibicao, custoApresentacaoParaFator1 } from '@/lib/productUnits';
import { base44 } from '@/api/base44Client';

const VERSOES_RELATORIO_COM_ANEXOS = new Set(['expandida_com_anexos', 'expandida_com_anexos_a4']);

export const COMPRAS_RELATORIOS = [
  { version: 'expandida', label: 'PDF expandido', icon: 'spreadsheet' },
  { version: 'expandida_com_anexos', label: 'PDF mobile consulta + anexos', icon: 'files', title: 'Visual da consulta + comprovantes embutidos por pedido' },
  { version: 'expandida_com_anexos_a4', label: 'PDF completo A4 (minuta + anexos)', icon: 'spreadsheet', title: 'Minuta enxuta A4 com tabela de itens + comprovantes embutidos por pedido' },
  { version: 'expandida_enxuta', label: 'PDF enxuto', icon: 'list' },
  { version: 'expandida_mobile', label: 'PDF mobile (consulta)', icon: 'smartphone', title: 'Mesmo visual da tela Consulta — chips de status, cores e linhas de produto' },
  { version: 'expandida_mobile_claro', label: 'PDF mobile consulta', icon: 'smartphone', title: 'Layout consulta com alto contraste para leitura no celular' },
];

function normalizarItemRelatorio(item, produtosMap = {}) {
  const produtoSnapshot = produtosMap[item?.produto_id] || item?._produto || null;
  const norm = normalizeItemCompraParaExibicao(item, produtoSnapshot);
  const quantidadeAtual = Number(item?.quantidade ?? 0) || 0;
  const quantidadeShow = Number(norm.quantidade ?? 0) || quantidadeAtual;
  const divisorAtual = quantidadeAtual > 0 ? quantidadeAtual : 1;
  const divisorShow = quantidadeShow > 0 ? quantidadeShow : 1;
  const quantidadeBase = Number(norm.quantidade_base ?? 0) || 0;

  const totalBruto =
    item?.total ??
    item?.valor_total_item ??
    item?.valor_total ??
    item?.subtotal;
  let total = Number(totalBruto);
  if (!Number.isFinite(total) || total <= 0) {
    const cu =
      Number(item?.custo_final_unitario) ||
      Number(item?.custo_unitario) ||
      Number(item?.valor_unitario_compra) ||
      0;
    const q = Number(quantidadeShow || quantidadeAtual) || 0;
    total = cu > 0 && q > 0 ? cu * q : 0;
  }
  const freteTotal = Number(item?.frete_total ?? ((Number(item?.frete_unitario ?? 0) || 0) * quantidadeAtual)) || 0;
  const outrosTotal = Number(item?.outros_total ?? ((Number(item?.custo_outros ?? 0) || 0) * quantidadeAtual)) || 0;
  const custoTotal = Number(item?.custo_total_item ?? ((Number(item?.custo_calculado ?? 0) || 0) * quantidadeAtual)) || 0;
  const imposto1Total = (Number(item?.custo_imposto1 ?? 0) || 0) * divisorAtual;
  const imposto2Total = (Number(item?.custo_imposto2 ?? 0) || 0) * divisorAtual;

  const fator = Number(norm.fator_conversao ?? item?.fator_conversao ?? 1) || 1;
  const unitComercial = divisorShow > 0 ? total / divisorShow : 0;
  const custoF1Salvo = Number(item?.custo_unitario);
  const custoF1 =
    Number.isFinite(custoF1Salvo) && custoF1Salvo > 0
      ? custoF1Salvo
      : custoApresentacaoParaFator1(unitComercial, fator);

  return {
    ...item,
    ...norm,
    quantidade_embarcada: quantidadeShow,
    quantidade_pedida: quantidadeShow,
    quantidade_base: quantidadeBase,
    fator_conversao: fator,
    custo_unitario: custoF1,
    valor_unitario_compra: unitComercial,
    frete_unitario: freteTotal / divisorShow,
    custo_outros: outrosTotal / divisorShow,
    custo_calculado: custoTotal / divisorShow,
    custo_imposto1: imposto1Total / divisorShow,
    custo_imposto2: imposto2Total / divisorShow,
    total,
    valor_total_item: total,
  };
}

function normalizarPedidoParaRelatorio(pedido, produtosMap = {}) {
  const fonteItens = Array.isArray(pedido?._display_itens)
    ? pedido._display_itens
    : (Array.isArray(pedido?.itens) ? pedido.itens : []);
  const itensNormalizados = fonteItens.map((item) => normalizarItemRelatorio(item, produtosMap));

  return {
    ...pedido,
    itens: itensNormalizados,
    _display_itens: itensNormalizados,
  };
}

function coletarProdutoIds(source) {
  const ids = new Set();
  const coletarItens = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((item) => {
      if (item?.produto_id) ids.add(item.produto_id);
    });
  };
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;
    coletarItens(node.itens);
    coletarItens(node._display_itens);
    if (Array.isArray(node.pedidos)) walk(node.pedidos);
    if (Array.isArray(node.grupos)) walk(node.grupos);
    if (Array.isArray(node.children)) walk(node.children);
  };
  walk(source);
  return Array.from(ids);
}

function normalizarGruposParaRelatorio(grupos = [], produtosMap = {}) {
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const clone = { ...node };
    if (Array.isArray(clone.itens)) {
      const norm = normalizarPedidoParaRelatorio(clone, produtosMap);
      clone.itens = norm.itens;
      clone._display_itens = norm._display_itens;
    }
    if (Array.isArray(clone.pedidos)) clone.pedidos = clone.pedidos.map((p) => normalizarPedidoParaRelatorio(p, produtosMap));
    if (Array.isArray(clone.grupos)) clone.grupos = clone.grupos.map(walk);
    if (Array.isArray(clone.children)) clone.children = clone.children.map(walk);
    return clone;
  };
  return walk(grupos);
}

export async function gerarComprasRelatorioPdf({
  version,
  pedidos = [],
  grupos = [],
  filtrosDesc = 'Pedidos filtrados na tela',
  kpis = {},
  onProgress,
}) {
  onProgress?.('Carregando produtos...');
  const ids = coletarProdutoIds([pedidos, grupos]);
  const produtosMap = {};
  if (ids.length > 0) {
    try {
      const rows = await base44.entities.Produto.filter({ id: ids });
      (rows || []).forEach((p) => {
        if (p?.id) produtosMap[p.id] = p;
      });
    } catch {
      const chunkSize = 25;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const slice = ids.slice(i, i + chunkSize);
        const batch = await Promise.all(slice.map((id) => base44.entities.Produto.get(id).catch(() => null)));
        batch.filter(Boolean).forEach((p) => {
          produtosMap[p.id] = p;
        });
      }
    }
  }

  const pedidosNormalizados = (pedidos || []).map((p) => normalizarPedidoParaRelatorio(p, produtosMap));
  const gruposNormalizados = normalizarGruposParaRelatorio(grupos || [], produtosMap);

  let anexosPorPedido = {};
  if (VERSOES_RELATORIO_COM_ANEXOS.has(version)) {
    onProgress?.('Carregando anexos dos pedidos filtrados...');
    const pedidoIds = coletarPedidoIdsParaRelatorio(pedidos, grupos);
    anexosPorPedido = await fetchAnexosPorPedidos(pedidoIds);
    onProgress?.(
      version === 'expandida_com_anexos_a4'
        ? 'Montando PDF A4 completo (minuta + anexos)...'
        : 'Montando PDF mobile completo (minuta + anexos)...',
    );
  }

  onProgress?.('Gerando relatório...');
  const resposta = await gerarRelatorioPedidosCompra({
    pedidos: pedidosNormalizados,
    version,
    filtros_desc: filtrosDesc,
    kpis,
    grupos: gruposNormalizados,
    produtos_map: produtosMap,
    anexos_por_pedido: anexosPorPedido,
  });

  const blob = new Blob([resposta.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RelatorioCompras_${version}_${dataHoje()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
