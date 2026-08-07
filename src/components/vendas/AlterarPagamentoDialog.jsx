import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import SeletorMaquininhaSheet from '@/components/vendas/caixa/SeletorMaquininhaSheet';
import {
  buildPagamentoCartaoFromSelecao,
  stripCartaoFields,
  isCartaoForma,
  rebuildReceitasLancamentosPedidoVenda,
} from '@/lib/pagamentoPedidoVendaFinanceiro';

const FORMAS_PAGAMENTO = [
  'Dinheiro',
  'PIX',
  'Cartão de Débito',
  'Cartão de Crédito',
  'Vale Troca',
  'Vale Compra',
  'Conta a Pagar',
];

function BuscarPedidoStep({ onFound }) {
  const [numeroPedido, setNumeroPedido] = useState('');
  const [buscando, setBuscando] = useState(false);
  const { toast } = useToast();

  const buscar = async () => {
    const termo = numeroPedido.trim().toUpperCase();
    if (!termo) return;
    setBuscando(true);
    const todos = await base44.entities.PedidoVenda.list();
    const encontrado = todos.find(
      (p) => p.numero?.toUpperCase() === termo || p.numero?.toUpperCase().includes(termo)
    );
    setBuscando(false);
    if (!encontrado) {
      toast({ title: 'Pedido não encontrado', variant: 'destructive' });
      return;
    }
    if (!encontrado.pagamentos || encontrado.pagamentos.length === 0) {
      toast({ title: 'Pedido sem pagamentos registrados', variant: 'destructive' });
      return;
    }
    onFound(encontrado);
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="rounded-2xl bg-card p-5 shadow-sm dark:bg-muted">
        <p className="mb-1 text-sm text-muted-foreground">Informe o número do pedido</p>
        <p className="mb-4 text-xs text-muted-foreground">
          A forma de pagamento registrada será substituída
        </p>
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Ex: PV-00042"
            value={numeroPedido}
            onChange={(e) => setNumeroPedido(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            className="rounded-none border-0 border-b border-border/40 bg-transparent font-mono text-lg uppercase focus-visible:ring-0 dark:border-border/40"
          />
          <Button
            onClick={buscar}
            disabled={buscando}
            className="rounded-xl bg-primary px-5 text-primary-foreground dark:bg-card dark:text-foreground"
          >
            {buscando ? '...' : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IconForma({ forma }) {
  if (forma?.toLowerCase().includes('pix')) return <Smartphone className="h-4 w-4 text-muted-foreground" />;
  if (forma?.toLowerCase().includes('dinheiro')) return <Banknote className="h-4 w-4 text-muted-foreground" />;
  return <CreditCard className="h-4 w-4 text-muted-foreground" />;
}

function EditarPagamentosStep({ pedido, onConfirm }) {
  const [pagamentos, setPagamentos] = useState(() =>
    (pedido.pagamentos || []).map((p, i) => ({ ...p, _id: i }))
  );
  const [seletorMaq, setSeletorMaq] = useState(null);
  const { toast } = useToast();

  const formatValor = (v) =>
    `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const totalPago = roundToTwoDecimals(
    pagamentos.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0)
  );
  const diferenca = roundToTwoDecimals(totalPago - (pedido.valor_total || 0));

  const linhaSeletor = seletorMaq ? pagamentos.find((p) => p._id === seletorMaq._id) : null;

  const atualizarPagamento = (id, campo, valor) => {
    setPagamentos((prev) =>
      prev.map((p) => (p._id === id ? { ...p, [campo]: valor } : p))
    );
  };

  const onFormaChange = (id, novaForma) => {
    setPagamentos((prev) =>
      prev.map((p) => {
        if (p._id !== id) return p;
        let next = stripCartaoFields({ ...p, forma_pagamento: novaForma });
        next.forma_pagamento = novaForma;
        if (!isCartaoForma(novaForma)) {
          next.parcelas = 1;
        } else if (!next.parcelas) {
          next.parcelas = 1;
        }
        return next;
      })
    );
    if (novaForma === 'Cartão de Débito' || novaForma === 'Cartão de Crédito') {
      setSeletorMaq({ _id: id, modalidade: novaForma === 'Cartão de Débito' ? 'debito' : 'credito' });
    }
  };

  const adicionarPagamento = () => {
    setPagamentos((prev) => [
      ...prev,
      { _id: Date.now(), forma_pagamento: 'Dinheiro', valor: 0, parcelas: 1 },
    ]);
  };

  const removerPagamento = (id) => {
    if (pagamentos.length === 1) return;
    setPagamentos((prev) => prev.filter((p) => p._id !== id));
  };

  const handleConfirm = () => {
    if (Math.abs(diferenca) > 0.01) {
      toast({
        title: `Diferença de ${formatValor(Math.abs(diferenca))}`,
        description: 'O total dos pagamentos deve ser igual ao valor do pedido.',
        variant: 'destructive',
      });
      return;
    }

    for (const p of pagamentos) {
      if (isCartaoForma(p.forma_pagamento)) {
        if (!p.maquininha_id && !p.maquininha_nome) {
          toast({
            title: 'Maquininha obrigatória',
            description: `Selecione maquininha e bandeira para ${p.forma_pagamento}.`,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    const limpos = pagamentos.map(({ _id, ...rest }) => {
      const valor = roundToTwoDecimals(parseFloat(rest.valor) || 0);
      const base = {
        ...rest,
        valor,
        parcelas: rest.parcelas || 1,
      };
      if (isCartaoForma(base.forma_pagamento)) {
        return {
          forma_pagamento: base.forma_pagamento,
          valor: base.valor,
          parcelas: base.parcelas,
          maquininha_id: base.maquininha_id,
          maquininha_nome: base.maquininha_nome,
          maquininha_conta_id: base.maquininha_conta_id,
          maquininha_conta_nome: base.maquininha_conta_nome,
          bandeira: base.bandeira,
          taxa_maquininha: base.taxa_maquininha ?? 0,
          prazo_maquininha_dias: base.prazo_maquininha_dias,
        };
      }
      const { maquininha_id: _m, maquininha_nome: _n, bandeira: _b, taxa_maquininha: _t, prazo_maquininha_dias: _p, ...out } = base;
      return out;
    });

    onConfirm(limpos);
  };

  return (
    <>
      <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto p-4">
        <div className="rounded-2xl bg-card px-4 py-3 shadow-sm dark:bg-muted">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">{pedido.numero}</div>
              <div className="text-xs text-muted-foreground">{pedido.cliente_nome}</div>
            </div>
            <div className="text-sm font-bold text-foreground/90">
              {formatValor(pedido.valor_total)}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {pagamentos.map((pag) => (
            <div key={pag._id} className="rounded-2xl bg-card px-4 py-4 shadow-sm dark:bg-muted">
              <div className="mb-3 flex items-center gap-2">
                <IconForma forma={pag.forma_pagamento} />
                <Select
                  value={pag.forma_pagamento}
                  onValueChange={(v) => onFormaChange(pag._id, v)}
                >
                  <SelectTrigger className="h-10 flex-1 rounded-xl border-0 bg-muted/40 dark:bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-muted">
                    {(FORMAS_PAGAMENTO.includes(pag.forma_pagamento)
                      ? FORMAS_PAGAMENTO
                      : [pag.forma_pagamento, ...FORMAS_PAGAMENTO]
                    ).map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pagamentos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removerPagamento(pag._id)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 dark:bg-red-900/20"
                    style={{ minWidth: 32, minHeight: 32 }}
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="w-14 text-xs text-muted-foreground">Valor</label>
                <Input
                  type="number"
                  value={pag.valor}
                  onChange={(e) => atualizarPagamento(pag._id, 'valor', e.target.value)}
                  className="h-10 rounded-xl border-0 bg-muted/40 text-right font-mono dark:bg-muted"
                  step="0.01"
                />
              </div>

              {isCartaoForma(pag.forma_pagamento) && (
                <button
                  type="button"
                  onClick={() =>
                    setSeletorMaq({
                      _id: pag._id,
                      modalidade: pag.forma_pagamento === 'Cartão de Débito' ? 'debito' : 'credito',
                    })
                  }
                  className="mt-2 w-full rounded-xl bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground dark:bg-muted/80 dark:text-foreground/90"
                >
                  {pag.maquininha_nome ? (
                    <>
                      <span className="font-medium text-foreground">
                        {pag.maquininha_nome} · {pag.bandeira || '—'} · {pag.taxa_maquininha ?? 0}%
                        {pag.forma_pagamento === 'Cartão de Crédito' && (
                          <> · {pag.parcelas || 1}x</>
                        )}
                      </span>
                      <span className="ml-1 text-muted-foreground underline">trocar</span>
                    </>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">
                      Toque para selecionar maquininha e bandeira
                    </span>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={adicionarPagamento}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/40 text-sm text-muted-foreground dark:border-border/40 dark:text-muted-foreground"
        >
          + Adicionar forma de pagamento
        </button>

        <div
          className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
            Math.abs(diferenca) < 0.01
              ? 'bg-emerald-50 dark:bg-emerald-900/20'
              : 'bg-red-50 dark:bg-red-900/20'
          }`}
        >
          <span
            className={`text-sm font-medium ${
              Math.abs(diferenca) < 0.01
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-red-700 dark:text-red-300'
            }`}
          >
            {Math.abs(diferenca) < 0.01
              ? '✓ Total correto'
              : diferenca > 0
                ? `Sobrando ${formatValor(Math.abs(diferenca))}`
                : `Faltando ${formatValor(Math.abs(diferenca))}`}
          </span>
          <span
            className={`font-glacial text-lg font-bold ${
              Math.abs(diferenca) < 0.01
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-red-700 dark:text-red-300'
            }`}
          >
            {formatValor(totalPago)}
          </span>
        </div>

        <Button
          onClick={handleConfirm}
          disabled={Math.abs(diferenca) > 0.01}
          className="h-14 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground dark:bg-card dark:text-foreground"
          style={{ minHeight: 56 }}
        >
          Salvar Alteração
        </Button>
      </div>

      <SeletorMaquininhaSheet
        visible={!!seletorMaq}
        modalidade={seletorMaq?.modalidade || 'debito'}
        parcelas={
          seletorMaq?.modalidade === 'credito' ? linhaSeletor?.parcelas || 1 : 1
        }
        onSelect={(dados) => {
          if (!seletorMaq) return;
          setPagamentos((prev) =>
            prev.map((p) => {
              if (p._id !== seletorMaq._id) return p;
              const merged = buildPagamentoCartaoFromSelecao(
                p.forma_pagamento,
                p.valor,
                dados
              );
              return merged ? { ...p, ...merged } : p;
            })
          );
          setSeletorMaq(null);
        }}
        onCancel={() => setSeletorMaq(null)}
      />
    </>
  );
}

export default function AlterarPagamentoDialog({ open, onClose }) {
  const [step, setStep] = useState('buscar');
  const [pedido, setPedido] = useState(null);
  const [formasDePagamento, setFormasDePagamento] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    base44.entities.FormasDePagamento.filter({ ativo: true }).then(setFormasDePagamento).catch(() => {});
  }, []);
  const { toast } = useToast();

  const handleClose = () => {
    setStep('buscar');
    setPedido(null);
    onClose();
  };

  const handleConfirm = async (novosPagamentos) => {
    setSalvando(true);
    try {
      const user = await base44.auth.me().catch(() => null);
      const antesStr = JSON.stringify(pedido.pagamentos || []);
      const depoisStr = JSON.stringify(novosPagamentos);
      const agora = new Date().toISOString();
      const linhaHistorico = `\n[Alteração de pagamento | ${agora}${user?.full_name ? ` | Por: ${user.full_name}` : ''}]\nAntes: ${antesStr}\nDepois: ${depoisStr}`;

      await base44.entities.PedidoVenda.update(pedido.id, {
        pagamentos: novosPagamentos,
        historico: (pedido.historico || '') + linhaHistorico,
      });

      await rebuildReceitasLancamentosPedidoVenda(
        base44,
        pedido,
        novosPagamentos,
        formasDePagamento
      );

      toast({
        title: '✓ Pagamento atualizado!',
        description: `Formas de pagamento do ${pedido.numero} foram alteradas.`,
        className: 'bg-emerald-100 text-emerald-800',
      });
      handleClose();
    } catch (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setSalvando(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
      <DialogContent className="m-0 flex h-full max-h-none w-full max-w-none flex-col rounded-none bg-muted/40 p-0 dark:bg-background">
        <div className="flex flex-shrink-0 items-center border-b border-border/40 bg-card px-4 py-3 dark:border-border/40 dark:bg-muted">
          <button
            type="button"
            onClick={step === 'editar' ? () => setStep('buscar') : handleClose}
            className="-ml-2 rounded-lg p-2 hover:bg-muted"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <ArrowLeft className="h-6 w-6 text-foreground/90" />
          </button>
          <h2 className="flex-1 text-center font-glacial text-lg font-semibold text-foreground">
            Alterar Pagamento
          </h2>
          <div className="w-10" />
        </div>

        <div className="relative flex-1 overflow-auto">
          {salvando && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-card/80 dark:bg-background/80">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-border/40 dark:border-white" />
            </div>
          )}
          {step === 'buscar' && (
            <BuscarPedidoStep
              onFound={(p) => {
                setPedido(p);
                setStep('editar');
              }}
            />
          )}
          {step === 'editar' && pedido && (
            <EditarPagamentosStep pedido={pedido} onConfirm={handleConfirm} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
