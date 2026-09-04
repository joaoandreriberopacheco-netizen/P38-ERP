import { useState, useMemo, useCallback } from 'react';
import { sincronizarPedidosCompraPorLancamentos } from '@/lib/aprovarPedidoCompraFinanceiro';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { dataHoje } from '@/components/utils/dateUtils';
import { CONCILIACAO_LOTE_TAMANHO, processarEmLotes } from '@/lib/conciliacaoEmLote';
import { isLancamentoPago } from '@/lib/lancamentoFinanceiroStatus';
import { lancamentoEhValeFolha, sincronizarValeFolhaComLancamento } from '@/lib/folhaValeFluxo';
import { sincronizarSaldosContasFinanceiras } from '@/lib/sincronizarSaldoContasFinanceiras';

function expandirSelecionados(programadas, selectedIds) {
  const ids = new Set(selectedIds);
  return programadas.filter((l) => ids.has(l.id)).flatMap((l) => {
    if (l.isTransferenciaConsolidada && l._lancamentoDespesa && l._lancamentoReceita) {
      return [l._lancamentoDespesa, l._lancamentoReceita];
    }
    return [l._lancamentoDespesa || l];
  }).filter((l) => l && !isLancamentoPago(l));
}

/** Pagamento em lote para lançamentos programados no fluxo unificado. */
export default function usePagamentoLoteFluxo({ programadas, contas, movimentos, reload }) {
  const { toast } = useToast();
  const [modoSelecaoLote, setModoSelecaoLote] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showPagamentoLote, setShowPagamentoLote] = useState(false);
  const [contaLoteId, setContaLoteId] = useState('');
  const [dataPagamentoLote, setDataPagamentoLote] = useState(dataHoje());
  const [processingLote, setProcessingLote] = useState(false);
  const [progressoLote, setProgressoLote] = useState({ atual: 0, total: 0 });

  const idsSelecionaveis = useMemo(
    () => programadas.map((l) => l.id),
    [programadas],
  );

  const todosSelecionados = idsSelecionaveis.length > 0
    && idsSelecionaveis.every((id) => selectedIds.includes(id));

  const lancamentosSelecionados = useMemo(
    () => expandirSelecionados(programadas, selectedIds),
    [programadas, selectedIds],
  );

  const handleToggleSelecionado = useCallback((id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const handleSelecionarTodos = useCallback(() => {
    setSelectedIds(todosSelecionados ? [] : idsSelecionaveis);
  }, [todosSelecionados, idsSelecionaveis]);

  const sairModoLote = useCallback(() => {
    setModoSelecaoLote(false);
    setSelectedIds([]);
  }, []);

  const entrarModoPagarLote = useCallback(() => {
    if (modoSelecaoLote) {
      sairModoLote();
      return;
    }
    setModoSelecaoLote(true);
    setSelectedIds([]);
  }, [modoSelecaoLote, sairModoLote]);

  const handleConfirmarPagamentoLote = useCallback(async () => {
    const conta = contas.find((c) => c.id === contaLoteId);
    const itensLote = lancamentosSelecionados;
    if (!conta || !dataPagamentoLote || itensLote.length === 0) return;

    setProcessingLote(true);
    setProgressoLote({ atual: 0, total: itensLote.length });
    try {
      const { erros, sucessos } = await processarEmLotes(
        itensLote,
        CONCILIACAO_LOTE_TAMANHO,
        async (lancamento) => {
          await base44.entities.LancamentoFinanceiro.update(lancamento.id, {
            status: 'Pago',
            data_pagamento: dataPagamentoLote,
            status_conciliacao: 'Pendente',
            conta_financeira_id: conta.id,
            conta_financeira_nome: conta.nome,
          });
          if (lancamentoEhValeFolha(lancamento)) {
            try {
              await sincronizarValeFolhaComLancamento({
                ...lancamento,
                status: 'Pago',
                data_pagamento: dataPagamentoLote,
                conta_financeira_id: conta.id,
                conta_financeira_nome: conta.nome,
              });
            } catch {
              /* não bloqueia pagamento em lote */
            }
          }
        },
        (atual, total) => setProgressoLote({ atual, total }),
      );

      if (sucessos.length === 0) {
        throw new Error('Nenhum lançamento foi pago.');
      }

      const contaIdsAfetados = [
        ...new Set([
          conta.id,
          ...sucessos.map((l) => l.conta_financeira_id).filter(Boolean),
        ]),
      ];

      const snapshot = await reload?.();
      await sincronizarSaldosContasFinanceiras(base44, {
        contas: snapshot?.cts ?? contas,
        lancamentos: snapshot?.ls,
        movimentos: snapshot?.movs ?? movimentos,
        contaIds: contaIdsAfetados,
      });

      try {
        await sincronizarPedidosCompraPorLancamentos(base44, sucessos);
      } catch {
        /* não bloqueia pagamento em lote */
      }

      const descricaoSucesso = erros.length > 0
        ? `${sucessos.length} de ${itensLote.length} lançamento(s) pago(s) — ${erros.length} falha(s)`
        : `${sucessos.length} lançamento(s) marcado(s) como pago(s).`;

      toast({
        title: erros.length > 0 ? 'Pagamento parcial' : (sucessos.length > 1 ? 'Pagamentos confirmados' : 'Pagamento confirmado'),
        description: descricaoSucesso,
        className: erros.length > 0 ? undefined : 'bg-muted text-foreground',
        variant: erros.length > 0 ? 'destructive' : undefined,
      });

      setShowPagamentoLote(false);
      sairModoLote();
      setContaLoteId('');
      setDataPagamentoLote(dataHoje());
      await reload?.();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro no pagamento em lote',
        description: error?.message || 'Não foi possível concluir todos os lançamentos.',
        variant: 'destructive',
      });
    } finally {
      setProcessingLote(false);
      setProgressoLote({ atual: 0, total: 0 });
    }
  }, [
    contas,
    contaLoteId,
    dataPagamentoLote,
    lancamentosSelecionados,
    movimentos,
    reload,
    sairModoLote,
    toast,
  ]);

  return {
    modoSelecaoLote,
    entrarModoPagarLote,
    sairModoLote,
    selectedIds,
    handleToggleSelecionado,
    handleSelecionarTodos,
    todosSelecionados,
    idsSelecionaveis,
    lancamentosSelecionados,
    showPagamentoLote,
    setShowPagamentoLote,
    contaLoteId,
    setContaLoteId,
    dataPagamentoLote,
    setDataPagamentoLote,
    processingLote,
    progressoLote,
    handleConfirmarPagamentoLote,
  };
}
