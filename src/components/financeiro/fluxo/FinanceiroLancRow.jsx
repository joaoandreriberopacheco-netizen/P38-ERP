import React from 'react';
import { formatarDataCurta } from '@/components/utils/dateUtils';
import { AlertCircle, ArrowRightLeft, Clock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  P38MobileLine,
  P38StatusLabel,
  P38StatusPill,
  p38StatusTone,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';
import { formatFinanceiroValor } from './FinanceiroListaShared';
import { isTransferenciaEntreContas } from '@/lib/saldoContaFinanceira';

const LINE_TITLE_CLASS =
  '[&>div>div:first-child]:text-[15px] [&>div>div:first-child]:font-semibold sm:[&>div>div:first-child]:text-base';

const TAGS_OCULTAS = new Set([
  'conta_pagar',
  'conta_receber',
  'recorrente',
  'importação pendente',
  'importacao pendente',
]);

export function tagsVisiveisFinanceiro(tags) {
  return (tags || [])
    .filter((t) => !TAGS_OCULTAS.has(String(t).toLowerCase()))
    .slice(0, 2);
}

function lancStatusTone(status) {
  if (status === 'Vencido') return 'danger';
  if (status === 'Em Aberto') return 'warning';
  if (status === 'Cancelado') return 'muted';
  return p38StatusTone(status);
}

function tipoLinha(l) {
  if (l.tipoExibicao) return l.tipoExibicao;
  if (isTransferenciaEntreContas(l)) return 'Transferência';
  return l.tipo;
}

/** Barra lateral — mesmo critério do Fluxo de Caixa: verde receita, vermelho despesa. */
function rowAccent(l, { dimPago = false } = {}) {
  const tipo = tipoLinha(l);
  const isR = tipo === 'Receita';
  const isT = tipo === 'Transferência';
  const cancelado = l.status === 'Cancelado';
  const isPago = l.status === 'Pago' || !!l.data_pagamento;

  if (dimPago && isPago) return 'muted';
  if (cancelado) return 'muted';
  if (isT) return 'muted';
  if (isR) return 'success';
  return 'danger';
}

function valorNode(l) {
  const tipo = tipoLinha(l);
  const isR = tipo === 'Receita';
  const isT = tipo === 'Transferência';
  const cancelado = l.status === 'Cancelado';

  if (cancelado) return '—';
  if (isT) return formatFinanceiroValor(Math.abs(l.valor || 0));

  return (
    <>
      <span
        className={
          isR
            ? 'text-[#4A5D23] dark:text-[#a4ce33]'
            : l.status === 'Vencido'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-foreground/85'
        }
      >
        {isR ? '+' : '−'}
      </span>
      {formatFinanceiroValor(Math.abs(l.valor || 0))}
    </>
  );
}

function rowMeta(l, { showPago = false, dimProgramada = false } = {}) {
  const cancelado = l.status === 'Cancelado';
  const isPago = l.status === 'Pago' || !!l.data_pagamento;
  const visiveis = tagsVisiveisFinanceiro(l.tags);
  const programada = l._isProgramada || dimProgramada;

  return (
    <>
      {l.categoria && l.categoria !== 'Transferência entre Contas' && <span>{l.categoria}</span>}
      {isTransferenciaEntreContas(l) && !l.isTransferenciaConsolidada && <span>Transferência entre contas</span>}
      {l.reforcoCaixaStatus === 'aguardando_caixa' && (
        <P38StatusLabel tone="warning">Aguardando caixa</P38StatusLabel>
      )}
      {l.reforcoCaixaStatus === 'aceito_caixa' && (
        <P38StatusLabel tone="success">Aceito no caixa</P38StatusLabel>
      )}
      {programada && !isPago && (
        <P38StatusLabel tone="warning">Programado</P38StatusLabel>
      )}
      {l.status && l.status !== 'Pago' && !programada && (
        showPago && l.status === 'Vencido' ? (
          <P38StatusPill tone="danger">{l.status}</P38StatusPill>
        ) : (
          <P38StatusLabel tone={lancStatusTone(l.status)}>{l.status}</P38StatusLabel>
        )
      )}
      {showPago && isPago && <P38StatusLabel tone="success">Pago</P38StatusLabel>}
      {cancelado && <P38StatusLabel tone="muted">Cancelado</P38StatusLabel>}
      {(l.is_recorrente || l.frequencia_recorrencia) && (
        <span>
          {l.frequencia_recorrencia === 'Parcelado' && l.parcela_atual != null
            ? `${l.parcela_atual}/${l.numero_parcelas_total ?? '—'}`
            : l.frequencia_recorrencia || 'Recorrente'}
        </span>
      )}
      {visiveis.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </>
  );
}

export default function FinanceiroLancRow({
  l,
  onClick,
  striped,
  dataField = 'auto',
  showPago = false,
  dimProgramada = false,
  emSelecao = false,
  selecionarPagos = false,
  selecionado = false,
  onToggleSelecionado,
}) {
  const cancelado = l.status === 'Cancelado';
  const isPago = l.status === 'Pago' || !!l.data_pagamento;
  const podeSelecionar = emSelecao && (selecionarPagos ? isPago : !isPago);
  const conc = l.status_conciliacao || 'N/A';
  const isTransfConsolidada = l.isTransferenciaConsolidada;
  const data =
    dataField === 'vencimento'
      ? l.data_vencimento
      : dataField === 'pagamento'
        ? l.data_pagamento || l.data_vencimento
        : l.data_pagamento || l.data_vencimento;

  const trailing = (
    <>
      {podeSelecionar && (
        <Checkbox checked={selecionado} onCheckedChange={() => onToggleSelecionado?.(l.id)} />
      )}
      {conc === 'Pendente' && <Clock className="h-2.5 w-2.5 text-muted-foreground" />}
      {conc === 'Discrepância' && <AlertCircle className="h-2.5 w-2.5 text-muted-foreground" />}
    </>
  );

  const subtitle = isTransfConsolidada ? (
    <>
      {data ? formatarDataCurta(data) : '—'}
      {l.notaTransferencia ? ` · ${l.notaTransferencia}` : ''}
    </>
  ) : (
    <>
      {data ? formatarDataCurta(data) : '—'}
      {l.conta_financeira_nome ? ` · ${l.conta_financeira_nome}` : ''}
    </>
  );

  const title = isTransfConsolidada ? (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">
        {l.contaOrigemNome}
        <span className="mx-1 text-muted-foreground">&gt;</span>
        {l.contaDestinoNome}
      </span>
    </span>
  ) : (
    <span className={cancelado ? 'line-through' : undefined}>{l.descricao}</span>
  );

  const lancamentoClick = isTransfConsolidada ? (l._lancamentoDespesa || l) : l;

  const esmaecido = cancelado || (showPago && isPago) || dimProgramada || l._isProgramada;

  const commonProps = {
    thinAccent: true,
    striped,
    accent: p38AccentKeyFromTone(rowAccent(l, { dimPago: showPago || dimProgramada || l._isProgramada })),
    className: `w-full text-left ${LINE_TITLE_CLASS} max-md:!py-3.5 max-md:min-h-[58px] [&>div:last-child]:max-w-[50%] sm:[&>div:last-child]:max-w-[46%] [&>div:first-child]:min-w-0 ${esmaecido ? 'opacity-50' : ''}`,
    title,
    subtitle,
    meta: rowMeta(l, { showPago, dimProgramada: dimProgramada || l._isProgramada }),
    value: valorNode(l),
    trailing,
  };

  if (podeSelecionar) {
    return (
      <P38MobileLine
        {...commonProps}
        onClick={() => onToggleSelecionado?.(l.id)}
        className={`${commonProps.className} cursor-pointer`}
      />
    );
  }

  return (
    <P38MobileLine
      {...commonProps}
      as="button"
      type="button"
      onClick={() => onClick?.(lancamentoClick)}
    />
  );
}
