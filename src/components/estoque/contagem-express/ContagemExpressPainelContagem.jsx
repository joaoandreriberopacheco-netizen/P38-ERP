import { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Boxes, CheckCircle2, Loader2, Minus, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { allowProgrammaticFocusBriefly, focusField } from '@/lib/focusPolicy';
import { formatCountQuantity, getGroupDisplayFromBase } from '@/lib/inventoryCountUnits';
import { P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';

function CelulaInfo({ label, valor, unidade, tone = 'default' }) {
  const toneClass = tone === 'ok'
    ? 'text-[#4A5D23] dark:text-[#a4ce33]'
    : tone === 'falta'
      ? 'text-red-500 dark:text-red-400'
      : 'text-foreground';

  return (
    <div className={cn('rounded-xl px-3 py-2.5 text-center', P38_FIELD_SURFACE)}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold font-glacial ${toneClass}`}>
        {valor}
        {unidade ? <span className="ml-1 text-xs font-semibold text-muted-foreground">{unidade}</span> : null}
      </div>
    </div>
  );
}

export default function ContagemExpressPainelContagem({
  produto,
  produtoNome,
  quantidade,
  unidade,
  saldoInfo,
  totalNoCarrinhoBase,
  pendenteBase = 0,
  onQuantidadeChange,
  onMenos,
  onMais,
  onTrocarUnidade,
  onConfirmar,
  onCancelar,
  onRemover,
  confirmLabel = 'Confirmar',
}) {
  const quantidadeRef = useRef(null);
  const qtdNum = parseFloat(quantidade);
  const quantidadeValida = quantidade !== '' && !Number.isNaN(qtdNum) && qtdNum >= 0;

  useEffect(() => {
    if (!produto?.id) return undefined;

    allowProgrammaticFocusBriefly();
    const timer = window.setTimeout(() => {
      const el = quantidadeRef.current;
      if (!el) return;
      allowProgrammaticFocusBriefly();
      focusField(el, { preventScroll: true });
      if (el.value && typeof el.select === 'function') {
        el.select();
      }
    }, 50);

    return () => window.clearTimeout(timer);
  }, [produto?.id]);
  const contadoTotalBase = totalNoCarrinhoBase + pendenteBase;
  const saldo = saldoInfo?.saldoExtrato ?? null;
  const diferencaBase = saldo != null ? contadoTotalBase - saldo : null;

  const sistemaDisplay = saldo != null ? getGroupDisplayFromBase(produto, saldo) : null;
  const contadoDisplay = getGroupDisplayFromBase(produto, contadoTotalBase);
  const diffDisplay = diferencaBase != null
    ? getGroupDisplayFromBase(produto, Math.abs(diferencaBase))
    : null;

  const handleConfirmarSubmit = (event) => {
    event?.preventDefault?.();
    if (!quantidadeValida) return;
    allowProgrammaticFocusBriefly();
    onConfirmar?.();
  };

  let diffTone = 'default';
  let diffLabel = '—';
  if (diferencaBase != null) {
    if (Math.abs(diferencaBase) < 1e-6) {
      diffTone = 'ok';
      diffLabel = 'OK';
    } else if (diferencaBase > 0) {
      diffTone = 'sobra';
      diffLabel = `+${formatCountQuantity(diffDisplay?.quantidade ?? Math.abs(diferencaBase))}`;
    } else {
      diffTone = 'falta';
      diffLabel = `-${formatCountQuantity(diffDisplay?.quantidade ?? Math.abs(diferencaBase))}`;
    }
  }

  return (
    <div className={cn('mx-auto w-full max-w-lg rounded-3xl p-5', P38_FIELD_SURFACE)}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 line-clamp-3 text-base font-semibold text-foreground">{produtoNome}</h2>
        <button
          type="button"
          onClick={onCancelar}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleConfirmarSubmit} className="mt-6">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onMenos}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-sm"
          >
            <Minus className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="min-w-[7rem]">
            <Input
              ref={quantidadeRef}
              type="number"
              inputMode="decimal"
              enterKeyHint="go"
              value={quantidade}
              onChange={(e) => onQuantidadeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmarSubmit(e);
                }
              }}
              placeholder="Qtd"
              className="h-14 border-0 bg-transparent text-center text-3xl font-bold font-glacial shadow-none focus-visible:ring-0"
            />
            <button
              type="button"
              onClick={onTrocarUnidade}
              className="mx-auto mt-1 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-card"
            >
              <Boxes className="h-3 w-3" />
              {unidade || 'UN'}
            </button>
          </div>

          <button
            type="button"
            onClick={onMais}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-sm"
          >
            <Plus className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
        <CelulaInfo
          label="Estoque atual"
          valor={saldoInfo?.loading ? '…' : sistemaDisplay ? formatCountQuantity(sistemaDisplay.quantidade) : '—'}
          unidade={sistemaDisplay?.unidade}
        />
        <CelulaInfo
          label="Já contei"
          valor={formatCountQuantity(contadoDisplay.quantidade)}
          unidade={contadoDisplay.unidade}
        />
        <CelulaInfo
          label="Diferença"
          valor={saldoInfo?.loading ? '…' : diffLabel}
          unidade={diffTone === 'ok' ? '' : diffDisplay?.unidade}
          tone={diffTone}
        />
        </div>

        <button
          type="submit"
          disabled={!quantidadeValida}
          className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl p38-btn-primary text-sm font-semibold disabled:opacity-40"
        >
          <CheckCircle2 className="h-4 w-4" />
          {confirmLabel}
        </button>

        {onRemover ? (
          <button
            type="button"
            onClick={onRemover}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-red-500 hover:bg-red-500/10 dark:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
            Remover do carrinho
          </button>
        ) : null}
      </form>
    </div>
  );
}
