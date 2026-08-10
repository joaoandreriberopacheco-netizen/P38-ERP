import { useState } from 'react';
import { Plus, FileText, X, Download, Send, CheckSquare, FileSpreadsheet, Smartphone, Loader2, List, FileUp, Files, DollarSign } from 'lucide-react';
import { gerarRelatorioPedidosCompra } from '@/functions/gerarRelatorioPedidosCompra';
import { fetchAnexosPorPedidos, coletarPedidoIdsParaRelatorio } from '@/lib/fetchAnexosPorPedidos';
import { toast } from 'sonner';
import { dataHoje } from '@/components/utils/dateUtils';
import { normalizeItemCompraParaExibicao, custoApresentacaoParaFator1 } from '@/lib/productUnits';
import { base44 } from '@/api/base44Client';

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
      // Nó representando pedido dentro da estrutura agrupada
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

export default function ActionMenuComprasV2({ onNovopedido, onImportarPedido, onImportarNF, onDownloadTemplate, onEnviarFinanceiroLote, onToggleModoSelecao, onAtualizarPrecosFiltrados, modoSelecao = false, quantidadeSelecionados = 0, enviandoLote = false, pedidos = [], filtrosDesc = 'Pedidos filtrados na tela', kpis = {}, grupos = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [gerando, setGerando] = useState(null);

  const handleGerarRelatorio = async (version) => {
    setGerando(version);
    toast.loading('Gerando relatório...', { id: 'gerando-relatorio' });
    try {
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
      if (version === 'expandida_com_anexos') {
        toast.loading('Carregando anexos dos pedidos filtrados...', { id: 'gerando-relatorio' });
        const pedidoIds = coletarPedidoIdsParaRelatorio(pedidos, grupos);
        anexosPorPedido = await fetchAnexosPorPedidos(pedidoIds);
        toast.loading('Montando PDF completo (minuta + anexos)...', { id: 'gerando-relatorio' });
      }

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

      toast.success(`Relatório ${version} gerado com sucesso`, { id: 'gerando-relatorio' });
      setIsExpanded(false);
    } catch (error) {
      const msg = error?.message || String(error);
      toast.error('Erro ao gerar relatório', {
        id: 'gerando-relatorio',
        description: msg.length > 300 ? `${msg.slice(0, 300)}…` : msg,
      });
      console.error(error);
    } finally {
      setGerando(null);
    }
  };

  const actions = [
    {
      icon: <DollarSign className="w-5 h-5" />,
      label: 'Atualizar preços (filtrados)',
      onClick: () => { onAtualizarPrecosFiltrados?.(); setIsExpanded(false); },
      color: 'bg-card dark:bg-muted text-foreground/90',
      title: 'Revisar e aplicar custos dos produtos dos pedidos visíveis no filtro (fonte SQL)',
    },
    {
      icon: <CheckSquare className="w-5 h-5" />,
      label: modoSelecao ? 'Cancelar seleção' : 'Selecionar embarques',
      onClick: () => { onToggleModoSelecao?.(); setIsExpanded(false); },
      color: modoSelecao ? 'bg-background dark:bg-muted text-white' : 'bg-card dark:bg-muted text-foreground/90',
    },
    ...(modoSelecao ? [{
      icon: <Send className="w-5 h-5" />,
      label: enviandoLote ? 'Enviando...' : `Enviar ao financeiro${quantidadeSelecionados ? ` (${quantidadeSelecionados})` : ''}`,
      onClick: () => { onEnviarFinanceiroLote?.(); setIsExpanded(false); },
      color: 'bg-emerald-600 text-white',
      disabled: enviandoLote || quantidadeSelecionados === 0,
    }] : []),
    {
      icon: <Plus className="w-5 h-5" />,
      label: 'Novo Pedido',
      onClick: () => { onNovopedido(); setIsExpanded(false); },
      color: 'bg-card dark:bg-muted text-foreground/90',
    },
    {
      icon: <FileUp className="w-5 h-5" />,
      label: 'Importar pedido (PDF)',
      onClick: () => { onImportarPedido?.(); setIsExpanded(false); },
      color: 'bg-card dark:bg-muted text-foreground/90',
    },
    {
      icon: <FileText className="w-5 h-5" />,
      label: 'Importar NF',
      onClick: () => { onImportarNF(); setIsExpanded(false); },
      color: 'bg-card dark:bg-muted text-foreground/90',
    },
    {
      icon: <Download className="w-5 h-5" />,
      label: 'Template',
      onClick: () => { onDownloadTemplate(); setIsExpanded(false); },
      color: 'bg-card dark:bg-muted text-foreground/90',
    },
    {
      icon: <FileSpreadsheet className="w-5 h-5" />,
      label: 'PDF expandido',
      reportVersion: 'expandida',
      onClick: () => handleGerarRelatorio('expandida'),
      color: 'bg-card dark:bg-muted text-foreground/90',
      disabled: !!gerando,
    },
    {
      icon: <Files className="w-5 h-5" />,
      label: 'PDF completo (minuta + anexos)',
      reportVersion: 'expandida_com_anexos',
      onClick: () => handleGerarRelatorio('expandida_com_anexos'),
      color: 'bg-card dark:bg-muted text-foreground/90',
      disabled: !!gerando,
      title: 'Minuta de cada embarque filtrado + comprovantes e anexos embutidos',
    },
    {
      icon: <List className="w-5 h-5" />,
      label: 'PDF enxuto',
      reportVersion: 'expandida_enxuta',
      onClick: () => handleGerarRelatorio('expandida_enxuta'),
      color: 'bg-card dark:bg-muted text-foreground/90',
      disabled: !!gerando,
    },
    {
      icon: <Smartphone className="w-5 h-5" />,
      label: 'PDF mobile clássico',
      reportVersion: 'expandida_mobile',
      onClick: () => handleGerarRelatorio('expandida_mobile'),
      color: 'bg-card dark:bg-muted text-foreground/90',
      disabled: !!gerando,
      title: 'Cards coloridos com pills de status (versão anterior)',
    },
    {
      icon: <Smartphone className="w-5 h-5" />,
      label: 'PDF mobile claro',
      reportVersion: 'expandida_mobile_claro',
      onClick: () => handleGerarRelatorio('expandida_mobile_claro'),
      color: 'bg-card dark:bg-muted text-foreground/90',
      disabled: !!gerando,
      title: 'Fontes pretas e alto contraste para leitura no celular',
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-[54] bg-black/20 backdrop-blur-[2px]"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* FAB container */}
      <div className="fixed right-4 z-[55] flex max-h-[70vh] flex-col-reverse items-end gap-2 overflow-y-auto p38-bottom-fab1 md:bottom-6 md:right-6">
        {/* FAB principal */}
        <button
          onClick={() => setIsExpanded(prev => !prev)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
            isExpanded ? 'bg-muted dark:bg-muted/400 rotate-45' : 'bg-background dark:bg-muted'
          } text-white`}
          title="Ações de compras"
        >
          {isExpanded ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>

        {/* Botões filhos — lista vertical */}
        {isExpanded && actions.map((action, idx) => (
          <button
            key={idx}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.label}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium whitespace-nowrap active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${action.color}`}
            style={{
              animation: `fadeSlideUp 0.18s ease both`,
              animationDelay: `${idx * 30}ms`,
            }}
          >
            {gerando && action.reportVersion === gerando
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : action.icon}
            {action.label}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}