import React from 'react';
import {
  P38MobileLine,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';
import {
  dataVencimentoNaCompetencia,
  formatDataBr,
  isCompetenciaPlanejamento,
  valorEfetivoCompetencia,
  SITUACAO_SERIE,
} from '@/lib/agefinPrevisaoCalculos';
import { labelParcelaCurta } from '@/lib/agefinParcelamentoCalculos';
import { formatFinanceiroValor } from '@/components/financeiro/fluxo/FinanceiroListaShared';

const LINE_TITLE_CLASS =
  '[&>div>div:first-child]:text-[15px] [&>div>div:first-child]:font-semibold sm:[&>div>div:first-child]:text-base';

function rowAccent(competencia, modelo) {
  if (isCompetenciaPlanejamento(competencia)) return 'info';
  if (competencia.origem_boleto === 'pdf') return 'success';
  if ((modelo?.situacao || '') === SITUACAO_SERIE.ENCERRADA) return 'muted';
  return 'warning';
}

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
 * Linha limpa na lista: descrição + vencimento + valor.
 * Fornecedor, CC, tags e estado vão para o drawer ao tocar.
 */
export default function AgefinPrevisaoRow({ competencia, modelo, onClick, striped }) {
  const fantasma = Boolean(competencia._fantasmaParcelamento);
  const parcela = Boolean(competencia._modoParcela);
  const valor =
    parcela && competencia.valor_previsto != null
      ? Number(competencia.valor_previsto) || 0
      : valorEfetivoCompetencia(competencia, modelo);
  const planejamento = isCompetenciaPlanejamento(competencia);
  const parcelaLabel = labelParcelaCurta(competencia);

  const title = parcela && parcelaLabel
    ? `${competencia.serie_nome} · ${parcelaLabel}`
    : competencia.serie_nome;

  return (
    <P38MobileLine
      as="button"
      type="button"
      thinAccent
      striped={striped}
      accent={p38AccentKeyFromTone(rowAccent(competencia, modelo))}
      onClick={() => onClick?.(competencia)}
      className={`w-full text-left ${LINE_TITLE_CLASS} max-md:!py-3.5 max-md:min-h-[58px] ${planejamento ? 'opacity-95' : ''} ${fantasma ? 'opacity-70' : ''}`}
      title={title}
      subtitle={labelVencimento(competencia, modelo, parcela)}
      value={
        fantasma ? (
          <span className="text-muted-foreground line-through tabular-nums">
            {formatFinanceiroValor(valor)}
          </span>
        ) : (
          <>
            <span className="text-foreground/85">−</span>
            {formatFinanceiroValor(valor)}
          </>
        )
      }
    />
  );
}
