import React from 'react';
import { P38Data } from '@/components/ui/p38-data';
import {
  dataVencimentoNaCompetencia,
  formatDataBr,
  isCompetenciaPlanejamento,
  valorEfetivoCompetencia,
} from '@/lib/agefinPrevisaoCalculos';
import { labelParcelaCurta } from '@/lib/agefinParcelamentoCalculos';
import { formatFinanceiroValor } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import { cn } from '@/lib/utils';

function labelVencimento(competencia, modelo, parcela) {
  const dia = modelo?.dia_vencimento || competencia.dia_vencimento || 10;
  const venc = parcela
    ? competencia._parcelaDataVencimento ||
      dataVencimentoNaCompetencia(competencia.competencia, dia)
    : competencia.lancamento_id && competencia._lancamento?.data_vencimento
      ? (competencia._lancamento.data_vencimento || '').slice(0, 10)
      : dataVencimentoNaCompetencia(competencia.competencia, dia);
  return formatDataBr(venc) || 'Sem vencimento';
}

/**
 * Linha da lista — Tailwind rigoroso (flex + hierarquia Dado > Contexto).
 */
export default function AgefinPrevisaoRow({ competencia, modelo, onClick }) {
  const fantasma = Boolean(competencia._fantasmaParcelamento);
  const parcela = Boolean(competencia._modoParcela);
  const valor =
    parcela && competencia.valor_previsto != null
      ? Number(competencia.valor_previsto) || 0
      : valorEfetivoCompetencia(competencia, modelo);
  const planejamento = isCompetenciaPlanejamento(competencia);
  const parcelaLabel = labelParcelaCurta(competencia);

  const title =
    parcela && parcelaLabel
      ? `${competencia.serie_nome} · ${parcelaLabel}`
      : competencia.serie_nome;

  // Contas de previsão são despesas → valor negativo (vermelho suave)
  const valueClass = fantasma
    ? 'text-base font-semibold text-gray-400 line-through'
    : 'text-base font-semibold text-red-500';

  return (
    <button
      type="button"
      onClick={() => onClick?.(competencia)}
      className={cn(
        'flex w-full items-center justify-between gap-3 border-b border-gray-50 py-4 text-left',
        'last:border-b-0 active:bg-gray-50/80',
        planejamento && 'opacity-95',
        fantasma && 'opacity-70',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <P38Data as="span" className="truncate text-sm font-medium text-gray-900">
          {title}
        </P38Data>
        <span className="text-xs font-normal text-gray-400">
          {labelVencimento(competencia, modelo, parcela)}
        </span>
      </div>
      <span className={cn('shrink-0 tabular-nums', valueClass)}>
        −{formatFinanceiroValor(valor)}
      </span>
    </button>
  );
}
