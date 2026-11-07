import React from 'react';
import { Wallet } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { P38_CHIP_ACTIVE, P38_CHIP_INACTIVE, P38_POPOVER } from './financeiroP38';
import { labelContasSaldoSelecionadas } from '@/lib/preferenciasSaldoContas';
import {
  contasSelEfetivoGestaoCaixas,
  contasSelPadraoGestaoCaixas,
  contasComTipoEfetivoGestaoCaixas,
} from '@/lib/preferenciasCaixasContas';
import { isContaCaixaPDVFinanceiro } from '@/lib/filtroDataFinanceiro';
import { FINANCEIRO_TOOLBAR_ICON_CLASS } from './FinanceiroToolbarIcon';
import {
  contaMarcadaNoFluxo,
  filtroContasFluxoAtivo,
  marcarPadraoContasFluxo,
  marcarTodasContasFluxo,
  selecaoContasFluxoEhPadrao,
  toggleContaFluxoSelecao,
} from './contasFluxoSelecaoUi';

/**
 * Escolhe contas no saldo (e no Fluxo, quando modoFluxo).
 * `variant="icon"` — ícone Wallet compacto; `variant="chip"` — pill com rótulo (aba Caixas).
 */
export default function ContasSaldoPicker({
  contas = [],
  sel = [],
  onSel,
  className = '',
  variant = 'chip',
  modoFluxo = false,
  modoGestaoCaixas = false,
  contasTodasParaMarcar = [],
}) {
  const baseContas = contas.filter(Boolean);
  const opcoes = modoGestaoCaixas
    ? contasComTipoEfetivoGestaoCaixas(baseContas.filter((c) => !isContaCaixaPDVFinanceiro(c)))
    : baseContas;
  const todasRef = contasTodasParaMarcar.length
    ? (modoGestaoCaixas
      ? contasComTipoEfetivoGestaoCaixas(contasTodasParaMarcar.filter((c) => !isContaCaixaPDVFinanceiro(c)))
      : contasTodasParaMarcar)
    : opcoes;

  const padraoCaixasIds = () => contasSelPadraoGestaoCaixas(todasRef);
  const selecaoCaixasEhPadrao = () => {
    const padrao = new Set(padraoCaixasIds());
    const ativos = new Set(contasSelEfetivoGestaoCaixas(sel, todasRef));
    if (!padrao.size || padrao.size !== ativos.size) return false;
    return [...padrao].every((id) => ativos.has(id));
  };

  const fluxoAtivo = modoFluxo && !modoGestaoCaixas && filtroContasFluxoAtivo(sel, opcoes, todasRef);
  const caixasPadraoPrincipal = modoGestaoCaixas && selecaoCaixasEhPadrao();
  const caixasTodas = !modoFluxo && !modoGestaoCaixas && (!sel.length || sel.length >= opcoes.length);

  const label = modoGestaoCaixas
    ? (selecaoCaixasEhPadrao()
      ? 'Caixas e bancos principais'
      : labelContasSaldoSelecionadas(contasSelEfetivoGestaoCaixas(sel, todasRef), opcoes))
    : modoFluxo
      ? (selecaoContasFluxoEhPadrao(sel, opcoes) ? 'Contas operacionais' : labelContasSaldoSelecionadas(sel, opcoes))
      : labelContasSaldoSelecionadas(sel, opcoes);
  const tooltipLabel = modoFluxo
    ? 'Filtrar contas no Fluxo (saldo e lançamentos)'
    : (caixasTodas ? 'Contas no saldo total' : `Saldo: ${label}`);

  const estaSelecionada = (id) => {
    if (modoGestaoCaixas) {
      return contasSelEfetivoGestaoCaixas(sel, todasRef).includes(id);
    }
    return modoFluxo ? contaMarcadaNoFluxo(id, sel, opcoes) : (!sel.length || sel.includes(id));
  };

  const toggle = (id) => {
    if (modoGestaoCaixas) {
      const efetivos = contasSelEfetivoGestaoCaixas(sel, todasRef);
      const base = sel.length ? [...sel] : [...efetivos];
      const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      onSel?.(next.length ? next : padraoCaixasIds());
      return;
    }
    if (modoFluxo) {
      onSel?.(toggleContaFluxoSelecao(id, sel, opcoes));
      return;
    }
    const allIds = opcoes.map((c) => c.id);
    const base = sel.length ? [...sel] : [...allIds];
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    if (next.length >= allIds.length) {
      onSel?.([]);
      return;
    }
    onSel?.(next);
  };

  const marcarTodas = () => {
    if (modoFluxo) onSel?.(marcarTodasContasFluxo(todasRef));
    else onSel?.([]);
  };

  const marcarPadrao = () => {
    if (modoGestaoCaixas) onSel?.(padraoCaixasIds());
    else if (modoFluxo) onSel?.(marcarPadraoContasFluxo());
    else onSel?.([]);
  };

  if (!opcoes.length) return null;

  const painel = (
    <>
      <div className="mb-2 px-2 pt-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Contas no saldo total</p>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground/80">
          {modoFluxo
            ? 'Altera o saldo da carteira e quais lançamentos aparecem na lista.'
            : 'Só altera o valor da carteira na aba Contas.'}
        </p>
      </div>
      {modoFluxo ? (
        <div className="mb-1.5 flex gap-1">
          <button
            type="button"
            onClick={marcarPadrao}
            className={`flex-1 rounded-2xl px-2 py-2 text-left text-xs transition-colors ${(modoGestaoCaixas ? selecaoCaixasEhPadrao() : selecaoContasFluxoEhPadrao(sel, opcoes))
              ? `${P38_CHIP_ACTIVE} font-medium`
              : 'text-muted-foreground hover:bg-secondary/80 dark:hover:bg-[#383e47]'}`}
          >
            {modoGestaoCaixas ? 'Principais' : 'Operacionais'}
          </button>
          <button
            type="button"
            onClick={marcarTodas}
            className="flex-1 rounded-2xl px-2 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary/80 dark:hover:bg-[#383e47]"
          >
            Todas
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={marcarTodas}
          className={`mb-1.5 w-full rounded-2xl px-3 py-2 text-left text-xs transition-colors ${caixasTodas
            ? `${P38_CHIP_ACTIVE} font-medium`
            : 'text-muted-foreground hover:bg-secondary/80 dark:hover:bg-[#383e47]'}`}
        >
          Todas no saldo
        </button>
      )}
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {opcoes.map((c) => (
          <label
            key={c.id}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition-all ${estaSelecionada(c.id)
              ? 'bg-secondary/80 shadow-sm dark:bg-[#383e47]'
              : 'hover:bg-secondary/60 dark:hover:bg-[#383e47]/60'}`}
          >
            <Checkbox
              checked={estaSelecionada(c.id)}
              onCheckedChange={() => toggle(c.id)}
              className="h-4 w-4"
            />
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
              style={{ background: c.cor || '#a4ce33' }}
            />
            <span className="truncate text-xs text-foreground/90">{c.nome}</span>
          </label>
        ))}
      </div>
    </>
  );

  const triggerAtivo = modoGestaoCaixas ? !caixasPadraoPrincipal : (modoFluxo ? fluxoAtivo : !caixasTodas);

  if (variant === 'icon') {
    return (
      <Popover modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              FINANCEIRO_TOOLBAR_ICON_CLASS,
              triggerAtivo && 'ring-1 ring-[#4a5240] dark:ring-[#a4ce33]',
              className,
            )}
            aria-label={tooltipLabel}
            aria-haspopup="dialog"
            title={tooltipLabel}
          >
            <Wallet className="h-4 w-4 text-foreground/90" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className={cn('z-[80] w-64 p-2.5', P38_POPOVER)}
          align="end"
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {painel}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
            (modoFluxo ? fluxoAtivo : !caixasTodas) ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE,
            className,
          )}
          aria-label="Escolher contas incluídas no saldo total"
          title={tooltipLabel}
        >
          <Wallet className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[9rem] truncate sm:max-w-[12rem]">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('z-[80] w-64 p-2.5', P38_POPOVER)}
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {painel}
      </PopoverContent>
    </Popover>
  );
}
