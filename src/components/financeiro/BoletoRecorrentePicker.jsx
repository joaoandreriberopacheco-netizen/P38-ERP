import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Repeat2, Receipt, CheckCircle2, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dataHoje } from '@/components/utils/dateUtils';
import { TAG_LF_BOLETO_PDF, TAG_LF_GERADO_AUTO } from '@/lib/agefinLancamentosRecorrencia';
import { getMonthKey, getContaDoMes, useRecorrentesBoletoData } from '@/hooks/useRecorrentesBoletoData';

function formatCurrency(value) {
  return `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function PickerCard({ recorrente, contaMes, onSelect }) {
  const hasBoleto = Boolean(contaMes?.forma_pagamento_tipo === 'Boleto' || contaMes?.forma_pagamento === 'Boleto');
  const isPaid = contaMes?.status === 'Pago';
  const todayKey = dataHoje();
  const isOverdue = !isPaid && contaMes?.data_vencimento && contaMes.data_vencimento < todayKey;

  return (
    <button
      type="button"
      onClick={() => onSelect({ recorrente, contaMes })}
      className="w-full rounded-[28px] bg-card p-1 text-left shadow-sm transition-all hover:shadow-md dark:bg-background"
    >
      <div className="space-y-2.5 rounded-[24px] bg-muted/40/95 px-3.5 py-3 dark:bg-muted/70">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[15px] font-semibold leading-5 text-foreground">{recorrente.nome_despesa}</p>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{recorrente.terceiro_nome || 'Sem beneficiário'}</p>
          </div>
          <div className="shrink-0 pl-2 text-right">
            <p className="text-[11px] text-muted-foreground">Previsto</p>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(recorrente.valor_previsto)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 shadow-sm dark:bg-background">
            <Repeat2 className="h-3 w-3" />
            {recorrente.frequencia}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 shadow-sm dark:bg-background">
            <Calendar className="h-3 w-3" />
            Dia {recorrente.dia_vencimento}
          </span>
          {isPaid && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
              <CheckCircle2 className="h-3 w-3" /> Pago
            </span>
          )}
          {!isPaid && isOverdue && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-red-800 dark:bg-red-900/30 dark:text-red-200">
              <CircleAlert className="h-3 w-3" /> Vencido
            </span>
          )}
          {hasBoleto && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-lime-50 px-2 py-0.5 text-lime-900 dark:bg-lime-900/20 dark:text-lime-100">
              <Receipt className="h-3 w-3" /> Boleto
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Escolher conta recorrente do mês (atalho partilha / atualizar boleto).
 */
export default function BoletoRecorrentePicker({ onSelectCard, onVoltar }) {
  const { recorrentes, contas, loading } = useRecorrentesBoletoData();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterPagamento, setFilterPagamento] = useState('todos');
  const [filterPrazo, setFilterPrazo] = useState('todos');
  const [filterOrigem, setFilterOrigem] = useState('todos');

  const monthKey = getMonthKey(currentMonth);
  const currentMonthText = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const filteredCards = useMemo(() => {
    const todayKey = dataHoje();
    const cards = recorrentes
      .map((recorrente) => {
        const contaMes = getContaDoMes(contas, recorrente, monthKey);
        return { recorrente, contaMes };
      })
      .filter((item) => item.contaMes && item.recorrente);

    const tags = (c) => (Array.isArray(c?.tags) ? c.tags : []);

    let out = cards;

    if (filterPagamento === 'pagas') {
      out = out.filter((x) => x.contaMes?.status === 'Pago');
    } else if (filterPagamento === 'em_aberto') {
      out = out.filter((x) => x.contaMes?.status !== 'Pago');
    }

    if (filterPrazo === 'vencidas') {
      out = out.filter((x) => {
        const p = x.contaMes?.status === 'Pago';
        const o = !p && x.contaMes?.data_vencimento && x.contaMes.data_vencimento < todayKey;
        return o;
      });
    } else if (filterPrazo === 'em_dia') {
      out = out.filter((x) => {
        const p = x.contaMes?.status === 'Pago';
        const o = !p && x.contaMes?.data_vencimento && x.contaMes.data_vencimento < todayKey;
        return p || !o;
      });
    }

    if (filterOrigem === 'atualizadas') {
      out = out.filter((x) => tags(x.contaMes).includes(TAG_LF_BOLETO_PDF));
    } else if (filterOrigem === 'automaticas') {
      out = out.filter((x) => {
        const t = tags(x.contaMes);
        return t.includes(TAG_LF_GERADO_AUTO) && !t.includes(TAG_LF_BOLETO_PDF);
      });
    }

    return [...out].sort((a, b) =>
      (a.recorrente.nome_despesa || '').localeCompare(b.recorrente.nome_despesa || '', 'pt-BR', { sensitivity: 'base' })
    );
  }, [recorrentes, contas, monthKey, filterPagamento, filterPrazo, filterOrigem]);

  const chip = (active) =>
    `px-3 py-2 rounded-full whitespace-nowrap text-xs font-medium transition-all md:text-sm ${
      active ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-card text-muted-foreground shadow-sm dark:bg-background dark:text-foreground/90'
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/40 dark:bg-background">
      <div className="shrink-0 border-b border-border/40 px-4 py-3 dark:border-border/40">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onVoltar}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Vincular boleto</p>
            <p className="text-xs text-muted-foreground">Mude o mês, filtre e toque no card certo</p>
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-3 border-b border-border/40 bg-card px-4 py-3 dark:border-border/40 dark:bg-background">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 w-10 shrink-0 rounded-full p-0"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="min-w-0 flex-1 text-center text-sm font-semibold capitalize text-foreground">{currentMonthText}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 w-10 shrink-0 rounded-full p-0"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pagamento</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(filterPagamento === 'todos')} onClick={() => setFilterPagamento('todos')}>
              Todas
            </button>
            <button type="button" className={chip(filterPagamento === 'pagas')} onClick={() => setFilterPagamento('pagas')}>
              Pagas
            </button>
            <button type="button" className={chip(filterPagamento === 'em_aberto')} onClick={() => setFilterPagamento('em_aberto')}>
              Em aberto
            </button>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Prazo</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(filterPrazo === 'todos')} onClick={() => setFilterPrazo('todos')}>
              Todas
            </button>
            <button type="button" className={chip(filterPrazo === 'vencidas')} onClick={() => setFilterPrazo('vencidas')}>
              Vencidas
            </button>
            <button type="button" className={chip(filterPrazo === 'em_dia')} onClick={() => setFilterPrazo('em_dia')}>
              Em dia
            </button>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Origem</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(filterOrigem === 'todos')} onClick={() => setFilterOrigem('todos')}>
              Todas
            </button>
            <button type="button" className={chip(filterOrigem === 'atualizadas')} onClick={() => setFilterOrigem('atualizadas')}>
              Atualizadas (PDF)
            </button>
            <button type="button" className={chip(filterOrigem === 'automaticas')} onClick={() => setFilterOrigem('automaticas')}>
              Automáticas
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-border/40 border-t-primary dark:border-border/40 dark:border-t-foreground" />
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="rounded-[28px] bg-card py-12 text-center text-sm text-muted-foreground shadow-sm dark:bg-background dark:text-muted-foreground">
            Nenhuma conta neste mês com estes filtros.
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 md:max-w-3xl">
            {filteredCards.map(({ recorrente, contaMes }) => (
              <PickerCard key={recorrente.id} recorrente={recorrente} contaMes={contaMes} onSelect={onSelectCard} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
