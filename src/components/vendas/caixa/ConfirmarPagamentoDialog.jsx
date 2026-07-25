import React, { useState, useEffect } from 'react';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import {
  Banknote, Smartphone, CreditCard, Ticket, Receipt, ArrowLeft, ChevronRight, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import SeletorMaquininhaSheet from './SeletorMaquininhaSheet';
import SeletorFiadoSheet from './SeletorFiadoSheet';
import { CAIXA_TOAST_SUCCESS, caixaClasses } from '@/lib/caixaP38Theme';
import { resolveValorPedidoVenda } from '@/lib/financialUtils';

export default function ConfirmarPagamentoDialog({
  open, onOpenChange,
  pedidoSelecionado,
  pagamentosDinheiro, setPagamentosDinheiro, inputDinheiro, setInputDinheiro,
  pagamentosPix, setPagamentosPix, inputPix, setInputPix,
  pagamentosDebito, setPagamentosDebito, inputDebito, setInputDebito,
  pagamentosCredito, setPagamentosCredito, inputCredito, setInputCredito,
  parcelasCredito, setParcelasCredito,
  formaPagamentoAtiva, setFormaPagamentoAtiva,
  inputRefs, handleInputMascara,
  pagamentosVale, setPagamentosVale, inputVale, setInputVale,
  pagamentosContaPagar, setPagamentosContaPagar, inputContaPagar, setInputContaPagar,
  codigoVale, setCodigoVale, valeEncontrado, setValeEncontrado, buscandoVale, setBuscandoVale,
  maquininhaDebito, setMaquininhaDebito,
  maquininhaCredito, setMaquininhaCredito,
  troco, valorRestante, pagamentoValido, processandoVenda,
  formatValor, formatarValorExibicao,
  handleFinalizarVenda, setShowRetornoDialog,
  toast, base44,
}) {
  const [seletorMaquininha, setSeletorMaquininha] = useState(null);
  const [showSeletorFiado, setShowSeletorFiado] = useState(false);
  const [fiadoConfig, setFiadoConfig] = useState(null);
  const [valoresVisiveis, setValoresVisiveis] = useState(true);

  useEffect(() => {
    setFiadoConfig(null);
    setShowSeletorFiado(false);
    setSeletorMaquininha(null);
  }, [pedidoSelecionado?.id]);

  // Bloqueia dígitos sem maquininha (valor só após botão + seleção); não abre o seletor automaticamente
  const handleInputMascaraComMaquininha = (e, setInput, setValor, modalidade) => {
    if (modalidade === 'debito' && !maquininhaDebito && /^\d$/.test(e.key)) {
      e.preventDefault();
      toast({
        title: 'Selecione maquininha e bandeira',
        description: 'Use o botão à direita antes de informar o valor.',
        duration: 2200,
      });
      return;
    }
    if (modalidade === 'credito' && !maquininhaCredito && /^\d$/.test(e.key)) {
      e.preventDefault();
      toast({
        title: 'Selecione maquininha e bandeira',
        description: 'Use o botão à direita antes de informar o valor.',
        duration: 2200,
      });
      return;
    }
    handleInputMascara(e, setInput, setValor);
  };

  const handleInputMascaraFiado = (e, setInput, setValor) => {
    if (!fiadoConfig && /^\d$/.test(e.key)) {
      e.preventDefault();
      toast({
        title: 'Configure o fiado primeiro',
        description: 'Use o botão à direita para prazo e condições.',
        duration: 2200,
      });
      return;
    }
    handleInputMascara(e, setInput, setValor);
  };

  const dialogOpen = open && !!pedidoSelecionado;

  const handleBuscarVale = async () => {
    if (!codigoVale.trim()) return;
    setBuscandoVale(true);
    try {
      const vales = await base44.entities.ValeCompra.filter({ codigo: codigoVale.trim() });
      const valeValido = vales.find((vale) => {
        const saldoDisponivel = vale.valor_disponivel ?? vale.saldo ?? 0;
        return ['Ativo', 'Utilizado Parcialmente'].includes(vale.status) && saldoDisponivel > 0;
      });

      if (valeValido) {
        const saldoDisponivel = valeValido.valor_disponivel ?? valeValido.saldo ?? 0;
        setValeEncontrado(valeValido);
        const maxVale = Math.min(saldoDisponivel, resolveValorPedidoVenda(pedidoSelecionado));
        setPagamentosVale(maxVale);
        setInputVale(formatarValorExibicao(maxVale));
        toast({ title: `Vale encontrado: ${formatValor(saldoDisponivel)}`, className: CAIXA_TOAST_SUCCESS, duration: 2000 });
      } else {
        toast({ title: 'Vale não encontrado ou sem saldo disponível', variant: 'destructive', duration: 2000 });
        setValeEncontrado(null);
        setPagamentosVale(0);
        setInputVale('0,00');
      }
    } catch (e) {
      toast({ title: 'Erro ao buscar vale', variant: 'destructive' });
    } finally {
      setBuscandoVale(false);
    }
  };

  if (!open && !pedidoSelecionado) return null;

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
        <CaixaDialogContent className="flex max-h-[min(92dvh,52rem)] min-h-0 max-w-lg flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-card p-0 shadow-2xl dark:bg-background">
          {/* Header */}
          <DialogHeader className="shrink-0 border-b border-border/40 px-5 pb-4 pt-5 dark:border-border/40">
            <DialogTitle className="flex items-center justify-between">
              <span className="text-base font-semibold text-foreground font-glacial">
                {pedidoSelecionado.cliente_nome || 'Avulso'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setValoresVisiveis(!valoresVisiveis)}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                  title={valoresVisiveis ? 'Ocultar valores' : 'Mostrar valores'}
                >
                  {valoresVisiveis ? (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                <span className="text-2xl font-bold text-foreground font-glacial tabular-nums">
                  {valoresVisiveis ? formatValor(resolveValorPedidoVenda(pedidoSelecionado)) : '••••••'}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Formas de pagamento */}
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 [scrollbar-gutter:stable]">

            {/* Dinheiro */}
            <InputPagamento
              label="Dinheiro"
              icon={Banknote}
              index={0}
              active={formaPagamentoAtiva === 0}
              onFocus={() => setFormaPagamentoAtiva(0)}
              inputRef={inputRefs.dinheiro}
              value={inputDinheiro}
              onKeyDown={(e) => handleInputMascara(e, setInputDinheiro, setPagamentosDinheiro)}
              valoresVisiveis={valoresVisiveis}
            />

            {/* PIX */}
            <InputPagamento
              label="PIX"
              icon={Smartphone}
              index={1}
              active={formaPagamentoAtiva === 1}
              onFocus={() => setFormaPagamentoAtiva(1)}
              inputRef={inputRefs.pix}
              value={inputPix}
              onKeyDown={(e) => handleInputMascara(e, setInputPix, setPagamentosPix)}
              valoresVisiveis={valoresVisiveis}
            />

            {/* Débito */}
            <div>
              <InputPagamento
                label="Cartão Débito"
                icon={CreditCard}
                index={2}
                active={formaPagamentoAtiva === 2}
                onFocus={() => setFormaPagamentoAtiva(2)}
                onContainerClick={() => setFormaPagamentoAtiva(2)}
                maquininhaPendente={!maquininhaDebito}
                onMaquininhaButtonClick={() => setSeletorMaquininha('debito')}
                inputRef={inputRefs.debito}
                value={inputDebito}
                onKeyDown={(e) => handleInputMascaraComMaquininha(e, setInputDebito, setPagamentosDebito, 'debito')}
                badge={maquininhaDebito ? `${maquininhaDebito.maquininha?.nome} · ${maquininhaDebito.bandeira} · ${maquininhaDebito.taxa}%` : null}
                onBadgeClick={() => setSeletorMaquininha('debito')}
                valoresVisiveis={valoresVisiveis}
              />
            </div>

            {/* Crédito */}
            <div>
              <InputPagamento
                label="Cartão Crédito"
                icon={CreditCard}
                index={3}
                active={formaPagamentoAtiva === 3}
                onFocus={() => setFormaPagamentoAtiva(3)}
                onContainerClick={() => setFormaPagamentoAtiva(3)}
                maquininhaPendente={!maquininhaCredito}
                onMaquininhaButtonClick={() => setSeletorMaquininha('credito')}
                inputRef={inputRefs.credito}
                value={inputCredito}
                onKeyDown={(e) => handleInputMascaraComMaquininha(e, setInputCredito, setPagamentosCredito, 'credito')}
                badge={maquininhaCredito ? `${maquininhaCredito.maquininha?.nome} · ${maquininhaCredito.bandeira} · ${parcelasCredito}x · ${maquininhaCredito.taxa}%` : null}
                onBadgeClick={() => setSeletorMaquininha('credito')}
                valoresVisiveis={valoresVisiveis}
              />
            </div>

            {/* Vale Troca */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <input autoComplete="off"
                  type="text"
                  placeholder="Código do Vale..."
                  value={codigoVale}
                  onChange={(e) => setCodigoVale(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarVale(); }}
                  className="flex-1 h-11 px-3 bg-muted/50 rounded-xl text-sm text-foreground/90 focus:outline-none focus:ring-2 focus:ring-border/40 dark:focus:ring-ring border-0"
                />
                <button
                  onClick={handleBuscarVale}
                  disabled={buscandoVale}
                  className="h-11 px-4 bg-background dark:bg-card text-white dark:text-foreground rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  {buscandoVale ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Buscar'}
                </button>
              </div>
              {valeEncontrado && (
                <InputPagamento
                    label={`Vale (saldo: ${formatValor(valeEncontrado.valor_disponivel ?? valeEncontrado.saldo ?? 0)})`}
                    icon={Ticket}
                    index={4}
                    active={formaPagamentoAtiva === 4}
                    onFocus={() => setFormaPagamentoAtiva(4)}
                    inputRef={inputRefs.vale}
                    value={inputVale}
                    onKeyDown={(e) => handleInputMascara(e, setInputVale, setPagamentosVale)}
                    valoresVisiveis={valoresVisiveis}
                  />
              )}
            </div>

            {/* Fiado */}
            <InputPagamento
              label="Fiado (Conta a Pagar)"
              icon={Receipt}
              index={5}
              active={formaPagamentoAtiva === 5}
              onFocus={() => setFormaPagamentoAtiva(5)}
              onContainerClick={() => setFormaPagamentoAtiva(5)}
              fiadoPendente={!fiadoConfig}
              onFiadoButtonClick={() => setShowSeletorFiado(true)}
              inputRef={inputRefs.contaPagar}
              value={inputContaPagar}
              onKeyDown={(e) => handleInputMascaraFiado(e, setInputContaPagar, setPagamentosContaPagar)}
              badge={fiadoConfig ? `Vence em ${fiadoConfig.prazo_dias} dias` : null}
              onBadgeClick={() => setShowSeletorFiado(true)}
              valoresVisiveis={valoresVisiveis}
            />

            {/* Resumo troco / falta */}
            {(troco > 0 || valorRestante > 0) && (
              <div className="mt-1 pt-3 border-t border-border/40 space-y-1.5">
                {troco > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Troco</span>
                    <span className="font-semibold text-foreground">{formatValor(troco)}</span>
                  </div>
                )}
                {valorRestante > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Falta</span>
                    <span className={`font-semibold ${caixaClasses('danger').text}`}>{formatValor(valorRestante)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex shrink-0 gap-2.5 border-t border-border/40 px-4 pb-4 pt-3 dark:border-border/40">
            <button
              onClick={() => setShowRetornoDialog(true)}
              className="h-12 px-4 bg-muted text-foreground/90 rounded-xl text-sm font-medium flex items-center gap-2 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" /> Devolver
            </button>
            <button
              onClick={handleFinalizarVenda}
              disabled={!pagamentoValido || processandoVenda}
              className="flex-1 h-12 bg-background dark:bg-card text-white dark:text-foreground rounded-xl font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {processandoVenda
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processando...</>
                : <><ChevronRight className="w-4 h-4" /> Confirmar Pagamento</>
              }
            </button>
          </div>
        </CaixaDialogContent>
      </Dialog>

      <SeletorMaquininhaSheet
        visible={!!seletorMaquininha}
        modalidade={seletorMaquininha || 'debito'}
        parcelas={seletorMaquininha === 'credito' ? parcelasCredito : 1}
        onSelect={(dados) => {
          if (seletorMaquininha === 'debito') {
            setMaquininhaDebito(dados);
          } else {
            setMaquininhaCredito(dados);
            if (dados.parcelas) setParcelasCredito(dados.parcelas);
          }
          setSeletorMaquininha(null);
        }}
        onCancel={() => setSeletorMaquininha(null)}
      />

      <SeletorFiadoSheet
        visible={showSeletorFiado}
        clienteNome={pedidoSelecionado?.cliente_nome}
        valorTotal={resolveValorPedidoVenda(pedidoSelecionado)}
        formatValor={formatValor}
        onConfirm={(config) => {
          setFiadoConfig(config);
          if (config.valor) {
            setPagamentosContaPagar(config.valor);
            setInputContaPagar(formatarValorExibicao(config.valor));
          }
          setShowSeletorFiado(false);
        }}
        onCancel={() => setShowSeletorFiado(false)}
      />
    </>
  );
}

// ── Input de pagamento glacial ────────────────────────────────────────────────
function InputPagamento({
  label, icon: Icon, active, onFocus, onContainerClick, inputRef, value, onKeyDown, badge, onBadgeClick, valoresVisiveis,
  maquininhaPendente, onMaquininhaButtonClick,
  fiadoPendente, onFiadoButtonClick,
}) {
  return (
    <div className="space-y-0.5">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-text ${
          active
            ? 'bg-muted ring-1 ring-border/40 dark:ring-border/40'
            : 'bg-muted/50/60 hover:bg-muted'
        }`}
        onClick={() => {
          if (onContainerClick) onContainerClick();
          else onFocus?.();
        }}
      >
        <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        <span className="text-sm text-muted-foreground flex-1 select-none min-w-0">{label}</span>
        {fiadoPendente && onFiadoButtonClick ? (
          <button
            type="button"
            ref={inputRef}
            onClick={(e) => {
              e.stopPropagation();
              onFiadoButtonClick();
            }}
            onFocus={() => onFocus?.()}
            className="max-w-[11rem] shrink-0 touch-manipulation rounded-xl bg-background px-3 py-2 text-left text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-ring dark:bg-card dark:text-foreground dark:hover:bg-muted dark:focus:ring-ring"
          >
            Prazo · fiado
          </button>
        ) : maquininhaPendente && onMaquininhaButtonClick ? (
          <button
            type="button"
            ref={inputRef}
            onClick={(e) => {
              e.stopPropagation();
              onMaquininhaButtonClick();
            }}
            onFocus={() => onFocus?.()}
            className="max-w-[11rem] shrink-0 touch-manipulation rounded-xl bg-background px-3 py-2 text-left text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-ring dark:bg-card dark:text-foreground dark:hover:bg-muted dark:focus:ring-ring"
          >
            Maquininha / bandeira
          </button>
        ) : (
          <input autoComplete="off"
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={valoresVisiveis ? value : value ? '••••••' : ''}
            onChange={() => {}}
            onFocus={(e) => { e.target.select(); onFocus?.(); }}
            onKeyDown={onKeyDown}
            className="w-24 text-right text-base font-semibold bg-transparent border-0 focus:outline-none text-foreground cursor-text tabular-nums"
          />
        )}
      </div>
      {badge && (
        <button
          onClick={onBadgeClick}
          className="w-full text-left px-3 py-1 text-xs text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground transition-colors"
        >
          {badge} · <span className="underline">trocar</span>
        </button>
      )}
    </div>
  );
}