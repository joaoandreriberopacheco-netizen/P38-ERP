import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { runOperacaoAuthBypass } from '@/components/auth/runOperacaoAuthBypass';
import {
  aprovarPedidoCompraFinanceiro,
  liberarEdicaoPedidoCompraFinanceiro,
  pedidoAguardandoAprovacaoFinanceira,
  pedidoAprovadoFinanceiramente,
  rejeitarPedidoCompraFinanceiro,
  sincronizarPedidoCompraSePagamentoCompleto,
} from '@/lib/aprovarPedidoCompraFinanceiro';
import { calcValorTotalPedidoCompra, listarLancamentosPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { CheckCircle, XCircle, Unlock, ExternalLink, Loader2, AlertCircle } from 'lucide-react';

const formatCurrency = (value) =>
  `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

/**
 * Central de pagamento / aprovação financeira dentro do pedido de compra (atalho ao módulo Aprovações).
 */
export default function PainelCentralFinanceiroPedido({ pedido, onPedidoAtualizado }) {
  const { toast } = useToast();
  const [contas, setContas] = useState([]);
  const [contaSelecionada, setContaSelecionada] = useState('');
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [processando, setProcessando] = useState(false);
  const [mostrarRejeitar, setMostrarRejeitar] = useState(false);
  const [lancamentos, setLancamentos] = useState([]);

  const aguardando = pedidoAguardandoAprovacaoFinanceira(pedido, lancamentos);
  const aprovado = pedidoAprovadoFinanceiramente(pedido);
  const solicitacaoEdicao = pedido?.status_aprovacao_financeira === 'Solicitação de Edição Pendente';
  const rejeitado =
    pedido?.status_aprovacao_financeira === 'Rejeitado Financeiramente' ||
    pedido?.status_aprovacao_financeira === 'Rejeitado';

  useEffect(() => {
    if (!pedido?.id) return;
    base44.entities.ContasFinanceiras.filter({ ativo: true }).then(setContas).catch(() => setContas([]));
  }, [pedido?.id]);

  useEffect(() => {
    if (!pedido?.id) return;
    let cancelled = false;

    (async () => {
      const lancs = await listarLancamentosPedidoCompra(base44, pedido.id);
      if (cancelled) return;
      setLancamentos(lancs);

      if (!pedidoAguardandoAprovacaoFinanceira(pedido, lancs)) return;

      const { synced } = await sincronizarPedidoCompraSePagamentoCompleto({
        base44,
        pedido,
        lancamentos: lancs,
      });
      if (!cancelled && synced) {
        await onPedidoAtualizado?.();
      }
    })().catch(() => {
      if (!cancelled) setLancamentos([]);
    });

    return () => {
      cancelled = true;
    };
  }, [pedido?.id, pedido?.status, pedido?.status_aprovacao_financeira]);

  useEffect(() => {
    if (pedido?.conta_pagamento_id) {
      setContaSelecionada(pedido.conta_pagamento_id);
    }
  }, [pedido?.conta_pagamento_id, pedido?.id]);

  if (!pedido?.id) return null;

  const executar = async (fn) => {
    setProcessando(true);
    try {
      await fn();
      await onPedidoAtualizado?.();
    } catch (error) {
      toast({
        title: 'Não foi possível concluir',
        description: error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setProcessando(false);
    }
  };

  const handleAprovar = () => {
    if (!contaSelecionada) {
      toast({
        title: 'Conta obrigatória',
        description: 'Selecione a conta que pagará esta compra.',
        variant: 'destructive',
      });
      return;
    }
    const contaNome = contas.find((c) => c.id === contaSelecionada)?.nome || '';
    void runOperacaoAuthBypass((authData) =>
      executar(async () => {
        await aprovarPedidoCompraFinanceiro({
          base44,
          pedido,
          contaId: contaSelecionada,
          contaNome,
          authData,
        });
        toast({
          title: 'Pagamento aprovado',
          description: 'Pedido liberado para recepção. Contas a pagar atualizadas.',
        });
      })
    );
  };

  const handleRejeitar = () => {
    if (!motivoRejeicao.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Descreva por que o pagamento não será aprovado.',
        variant: 'destructive',
      });
      return;
    }
    const motivo = motivoRejeicao.trim();
    void runOperacaoAuthBypass((authData) =>
      executar(async () => {
        await rejeitarPedidoCompraFinanceiro({ base44, pedido, motivo, authData });
        setMotivoRejeicao('');
        setMostrarRejeitar(false);
        toast({
          title: 'Pedido rejeitado',
          description: 'O setor de compras verá o motivo no histórico.',
          variant: 'destructive',
        });
      })
    );
  };

  const handleLiberarEdicao = () => {
    void runOperacaoAuthBypass((authData) =>
      executar(async () => {
        await liberarEdicaoPedidoCompraFinanceiro({ base44, pedido, authData });
        toast({
          title: 'Edição liberada',
          description: 'Você pode corrigir o pedido e reenviar ao financeiro.',
        });
      })
    );
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Central financeira do pedido</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aprove ou rejeite aqui — atalho ao módulo Aprovações, sem trocar de tela.
            </p>
          </div>
          <Link
            to="/AprovacoesFinanceiras"
            className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 shrink-0"
          >
            Fila geral
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total a aprovar</span>
          <span className="text-lg font-bold text-foreground">{formatCurrency(calcValorTotalPedidoCompra(pedido))}</span>
        </div>

        {aguardando && (
          <>
            <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Despesa CMV automática.</span>{' '}
              Ao aprovar, as parcelas ficam em aberto na conta escolhida como custo de mercadoria.
            </div>
            <div>
              <Label className="text-xs">Conta para pagamento</Label>
              <Select value={contaSelecionada} onValueChange={setContaSelecionada} disabled={processando}>
                <SelectTrigger className="mt-1 h-11 rounded-xl">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                onClick={handleAprovar}
                disabled={processando}
              >
                {processando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Aprovar pagamento
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
                onClick={() => setMostrarRejeitar((v) => !v)}
                disabled={processando}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Rejeitar
              </Button>
            </div>
            {mostrarRejeitar && (
              <div className="space-y-2 pt-1">
                <Label className="text-xs">Motivo da rejeição</Label>
                <Textarea
                  rows={2}
                  className="rounded-xl resize-none"
                  placeholder="Ex.: valor divergente, fornecedor incorreto..."
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  disabled={processando}
                />
                <Button variant="destructive" className="w-full rounded-xl" onClick={handleRejeitar} disabled={processando}>
                  Confirmar rejeição
                </Button>
              </div>
            )}
          </>
        )}

        {solicitacaoEdicao && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Compras pediu correção. Libere a edição para reabrir o pedido em rascunho.</span>
            </div>
            <Button className="w-full rounded-xl" variant="secondary" onClick={handleLiberarEdicao} disabled={processando}>
              <Unlock className="w-4 h-4 mr-2" />
              Liberar edição
            </Button>
          </div>
        )}

        {aprovado && !aguardando && !solicitacaoEdicao && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 text-xs text-emerald-800 dark:text-emerald-200">
            <CheckCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Aprovado financeiramente
            {pedido.conta_pagamento_nome ? ` · ${pedido.conta_pagamento_nome}` : ''}
            {pedido.data_aprovacao_financeira
              ? ` · ${format(new Date(pedido.data_aprovacao_financeira), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`
              : ''}
          </div>
        )}

        {rejeitado && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-xs text-red-800 dark:text-red-200">
            <XCircle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Rejeitado
            {pedido.motivo_rejeicao_financeira ? `: ${pedido.motivo_rejeicao_financeira}` : ''}
          </div>
        )}

        {!aguardando && !aprovado && !rejeitado && !solicitacaoEdicao && pedido.status === 'Rascunho' && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Envie o pedido ao financeiro pelo menu flutuante (canto inferior direito) para liberar a aprovação aqui.
          </p>
        )}
      </div>
    </div>
  );
}
