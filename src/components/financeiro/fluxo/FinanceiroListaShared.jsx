import React, { useState } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { dataHoje } from '@/components/utils/dateUtils';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import {
  P38_EXTRATO_V8_DATE_HEADER,
  P38_EXTRATO_V8_DAY_CARD,
  P38_EXTRATO_V8_DAY_GROUP,
  P38_EXTRATO_V8_DAY_SALDO,
  P38_EXTRATO_V8_DAY_SALDO_VALUE,
  P38_FIELD_SURFACE,
} from './financeiroP38';
import FinanceiroResumoBar from './FinanceiroResumoBar';
import P38ModuleLoadingOverlay from '@/components/ui/P38ModuleLoadingOverlay';

/** Rótulo de grupo — Hoje/Ontem ou data curta (mesmo padrão Fluxo e Contas). */
export function formatFinanceiroGrupoLabel(k, hStr, oStr) {
  if (k === 'sem-data' || k === 'sem-vencimento') return 'Sem data';
  if (k === hStr) return 'Hoje';
  if (k === oStr) return 'Ontem';
  const d = new Date(`${k}T12:00:00-05:00`);
  if (Number.isNaN(d.getTime())) return k;
  if (k > hStr) return `${format(d, "d 'de' MMMM", { locale: ptBR })} (previsto)`;
  return format(d, "d 'de' MMMM", { locale: ptBR });
}

/** Rótulo de data do protótipo extrato v8 — «11 NOVEMBRO DE 2026». */
export function formatExtratoMobileGrupoLabel(k) {
  if (k === 'sem-data' || k === 'sem-vencimento') return 'SEM DATA';
  const hStr = dataHoje();
  const oStr = format(subDays(new Date(`${hStr}T12:00:00-05:00`), 1), 'yyyy-MM-dd');
  if (k === hStr) return 'HOJE';
  if (k === oStr) return 'ONTEM';
  const d = new Date(`${k}T12:00:00-05:00`);
  if (Number.isNaN(d.getTime())) return String(k).toUpperCase();
  if (k > hStr) {
    return `${format(d, "d 'DE' MMMM 'DE' yyyy", { locale: ptBR })} (PREVISTO)`.toUpperCase();
  }
  return format(d, "d 'DE' MMMM 'DE' yyyy", { locale: ptBR }).toUpperCase();
}

export const formatFinanceiroValor = (v) =>
  `R$ ${(Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Cabeçalho de grupo colapsável — Fluxo de Caixa e Contas Abertas. */
export function FinanceiroGrupo({
  label,
  grupoKey,
  labelClassName,
  receitas = 0,
  despesas = 0,
  liquido: liquidoProp,
  saldoAcumulado,
  variant = 'default',
  card = false,
  balancoDia = false,
  extratoV8 = false,
  ocultarTotais = false,
  children,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const liquido = liquidoProp != null ? liquidoProp : receitas - despesas;

  if (extratoV8) {
    const dateLabel = grupoKey != null ? formatExtratoMobileGrupoLabel(grupoKey) : String(label || '').toUpperCase();
    const saldoDia = saldoAcumulado != null ? saldoAcumulado : liquido;
    return (
      <div className={P38_EXTRATO_V8_DAY_GROUP}>
        <p className={P38_EXTRATO_V8_DATE_HEADER}>{dateLabel}</p>
        <div className={P38_EXTRATO_V8_DAY_CARD}>
          <div className={P38_EXTRATO_V8_DAY_SALDO}>
            <span className="font-normal !font-[inherit]">Saldo do dia</span>
            <strong className={P38_EXTRATO_V8_DAY_SALDO_VALUE}>{formatFinanceiroValor(saldoDia)}</strong>
          </div>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    );
  }
  const showBreakdown = !balancoDia && receitas > 0 && despesas > 0;
  const overdue = variant === 'overdue';

  const negClass = overdue ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  const balancoDiaNode = balancoDia ? (
    <FinanceiroResumoBar
      receitas={receitas}
      despesas={despesas}
      variacao={liquido}
      saldo={saldoAcumulado}
      saldoComSinal
      variant="balancoDia"
      className="md:w-auto md:justify-end"
    />
  ) : null;

  const saldoNode = (
    <span
      className={cn(
        'whitespace-nowrap text-[10px] font-bold tabular-nums sm:text-[11px]',
        liquido >= 0 ? 'text-[#4A5D23] dark:text-[#a4ce33]' : negClass,
      )}
    >
      {liquido >= 0 ? '+' : '−'}
      {formatFinanceiroValor(Math.abs(liquido))}
    </span>
  );

  const content = (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'group w-full min-w-0 px-1',
          balancoDia
            ? 'flex flex-col gap-2.5 px-1 py-3 md:flex-row md:items-center md:justify-between md:gap-2 md:py-1.5'
            : cn(
                card
                  ? 'flex flex-col gap-1 py-2.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-3'
                  : 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 py-1.5',
              ),
          card ? 'px-3 py-2.5' : 'mb-0.5 border-b border-border/50 dark:border-white/10',
        )}
      >
        <div
          className={cn(
            'flex min-w-0 items-center gap-2',
            balancoDia ? 'w-full justify-between md:w-auto md:flex-1' : 'min-w-0',
          )}
        >
          <p
            className={cn(
              'min-w-0 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground/75 sm:tracking-widest',
              !balancoDia && !card && 'truncate',
              (!balancoDia && card) && 'truncate',
              balancoDia && 'truncate',
              labelClassName,
            )}
          >
            {label}
          </p>
          {balancoDia && (
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-foreground/50 transition-transform md:hidden',
                open && 'rotate-90',
              )}
            />
          )}
        </div>
        <div
          className={cn(
            'flex min-w-0 items-center gap-1 sm:gap-1.5',
            card && 'w-full justify-end sm:w-auto sm:shrink-0 sm:justify-end',
            balancoDia && 'w-full md:w-auto md:shrink md:justify-end',
            !balancoDia && !card && 'shrink-0 justify-end',
          )}
        >
          {balancoDia ? (
            balancoDiaNode
          ) : ocultarTotais ? null : (
            <>
              {showBreakdown && receitas > 0 && (
                <span className="hidden text-[11px] font-semibold tabular-nums text-[#4A5D23] sm:inline dark:text-[#a4ce33]">
                  +{formatFinanceiroValor(receitas)}
                </span>
              )}
              {showBreakdown && despesas > 0 && (
                <span className={cn('hidden text-[11px] font-semibold tabular-nums sm:inline', negClass)}>
                  −{formatFinanceiroValor(despesas)}
                </span>
              )}
              {saldoNode}
            </>
          )}
          {!balancoDia && (
            <ChevronRight
              className={cn('h-3.5 w-3.5 shrink-0 text-foreground/50 transition-transform', open && 'rotate-90')}
            />
          )}
          {balancoDia && (
            <ChevronRight
              className={cn(
                'hidden h-3.5 w-3.5 shrink-0 text-foreground/50 transition-transform md:block',
                open && 'rotate-90',
              )}
            />
          )}
        </div>
      </button>
      {open && (
        <P38MobileLineList className={cn('block md:!block', card ? 'rounded-none' : 'rounded-lg')}>
          {children}
        </P38MobileLineList>
      )}
    </>
  );

  if (card) {
    return (
      <div className={cn('w-full min-w-0 overflow-hidden rounded-xl border border-border/40 dark:border-white/10', P38_FIELD_SURFACE)}>
        {content}
      </div>
    );
  }

  return <div className="w-full min-w-0">{content}</div>;
}

export function FinanceiroListaEstado({
  loading,
  loadingPresentation = 'overlay',
  loadingMessage = 'Carregando…',
  vazio,
  vazioMensagem,
  vazioIcon: VazioIcon,
  flushBottom = false,
  listClassName,
  children,
}) {
  if (loading && loadingPresentation === 'skeleton') {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (vazio && !loading) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-card py-12 dark:border-white/10 dark:bg-[#26262e]/40">
        {VazioIcon && <VazioIcon className="h-9 w-9 text-muted-foreground/40" />}
        <p className="text-sm text-muted-foreground">{vazioMensagem}</p>
      </div>
    );
  }

  const showOverlay = loading && loadingPresentation === 'overlay';

  return (
    <div
      className={cn(
        'relative min-w-0 w-full max-w-full',
        flushBottom ? 'pb-0' : 'pb-24 md:pb-2',
      )}
    >
      <P38ModuleLoadingOverlay open={showOverlay} message={loadingMessage} />
      <div
        className={cn(
          'relative z-0 min-w-0 w-full max-w-full overflow-x-hidden',
          listClassName ?? 'space-y-2',
          showOverlay && 'pointer-events-none select-none opacity-25',
        )}
      >
        {children}
      </div>
    </div>
  );
}
