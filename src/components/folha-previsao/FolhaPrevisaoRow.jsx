import React from 'react';
import {
  P38MobileLine,
  P38StatusLabel,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';
import { formatFinanceiroValor } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import {
  calcularTotaisCompetencia,
  SITUACAO_FOLHA,
  TIPO_VINCULO,
  TIPO_VINCULO_LABELS,
  formatCicloFolhaCompetencia,
  isCompetenciaPlanejamento,
  statusCompetenciaEfetivo,
} from '@/lib/folhaPrevisaoCalculos';

const LINE_TITLE_CLASS =
  '[&>div>div:first-child]:text-[15px] [&>div>div:first-child]:font-semibold sm:[&>div>div:first-child]:text-base';

function rowAccent(competencia, modelo) {
  if (isCompetenciaPlanejamento(competencia)) return 'info';
  if (competencia.situacao_mes === 'ultimo_mes') return 'warning';
  if (modelo?.situacao === SITUACAO_FOLHA.DESLIGADO) return 'muted';
  return 'danger';
}

export default function FolhaPrevisaoRow({ competencia, modelo, onClick, striped }) {
  const totais = calcularTotaisCompetencia(competencia, modelo);
  const ehSocio = (modelo?.tipo_vinculo || competencia.tipo_vinculo) === TIPO_VINCULO.SOCIO;
  const desligado = modelo?.situacao === SITUACAO_FOLHA.DESLIGADO;
  const ultimoMes = competencia.situacao_mes === 'ultimo_mes';
  const statusEfetivo = statusCompetenciaEfetivo(competencia);
  const fechada = statusEfetivo === 'fechado';
  const planejamento = isCompetenciaPlanejamento(competencia);

  const meta = (
    <>
      <span>{TIPO_VINCULO_LABELS[ehSocio ? TIPO_VINCULO.SOCIO : TIPO_VINCULO.FUNCIONARIO]}</span>
      {planejamento ? (
        <P38StatusLabel tone="info">Planejamento</P38StatusLabel>
      ) : (
        <P38StatusLabel tone={fechada ? 'success' : 'warning'}>
          {fechada ? 'Fechada' : 'Em aberto'}
        </P38StatusLabel>
      )}
      {ultimoMes && <P38StatusLabel tone="warning">Último mês</P38StatusLabel>}
      {desligado && !ultimoMes && <P38StatusLabel tone="muted">Desligou</P38StatusLabel>}
      {totais.resumoProporcional && (
        <P38StatusLabel tone="info">Proporcional {totais.resumoProporcional}</P38StatusLabel>
      )}
      {totais.totalValesPendentes > 0 && (
        <P38StatusLabel tone="warning">Vale em aberto</P38StatusLabel>
      )}
      {totais.totalDecimo > 0 && <span>13º {formatFinanceiroValor(totais.totalDecimo)}</span>}
      {totais.totalFerias > 0 && <span>Férias {formatFinanceiroValor(totais.totalFerias)}</span>}
      {totais.totalRetiradaSocio > 0 && (
        <span>Retirada {formatFinanceiroValor(totais.totalRetiradaSocio)}</span>
      )}
    </>
  );

  return (
    <P38MobileLine
      as="button"
      type="button"
      thinAccent
      striped={striped}
      accent={p38AccentKeyFromTone(rowAccent(competencia, modelo))}
      onClick={() => onClick?.(competencia)}
      className={`w-full text-left ${LINE_TITLE_CLASS} max-md:!py-3.5 max-md:min-h-[58px] [&>div:last-child]:max-w-[46%] sm:[&>div:last-child]:max-w-[42%] ${desligado ? 'opacity-75' : ''} ${planejamento ? 'opacity-95' : ''}`}
      title={competencia.colaborador_nome}
      subtitle={`${formatCicloFolhaCompetencia(competencia.competencia)}`}
      meta={meta}
      value={
        <>
          <span className="text-foreground/85">−</span>
          {formatFinanceiroValor(Math.abs(totais.liquido || 0))}
        </>
      }
      valueSub={
        totais.totalVales > 0 ? (
          <span className="text-amber-700 dark:text-amber-400">
            Vales {formatFinanceiroValor(totais.totalVales)}
          </span>
        ) : null
      }
    />
  );
}
