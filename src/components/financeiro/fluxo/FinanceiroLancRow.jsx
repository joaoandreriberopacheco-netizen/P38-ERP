import React from 'react';
import { formatarDataCurta } from '@/components/utils/dateUtils';
import { AlertCircle, ArrowDown, ArrowRightLeft, ArrowUp, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  P38MobileLine,
  P38StatusLabel,
  P38StatusPill,
  p38StatusTone,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';
import { cn } from '@/lib/utils';
import { formatFinanceiroValor } from './FinanceiroListaShared';
import FluxoExtratoRowIcon from './FluxoExtratoRowIcon';
import { rotuloFormaPagamentoExtrato } from '@/lib/fluxoExtratoIconKind';
import { isTransferenciaEntreContas } from '@/lib/saldoContaFinanceira';
import { isLancamentoPago, statusRotuloListaFinanceiro } from '@/lib/lancamentoFinanceiroStatus';
import { EXIBIR_UI_CONCILIACAO_FINANCEIRO } from '@/lib/financeiroConciliacaoUiFlags';
import {
  P38_EXTRATO_V8_ROW_LINE,
  P38_EXTRATO_V8_ROW_META,
  P38_EXTRATO_V8_ROW_TITLE,
  P38_EXTRATO_V8_ROW_VALUE,
  extratoCompraMercadoriaMetaExtras,
} from './financeiroP38';

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

function rotuloFormaPagamento(l) {
  const direto = l?.forma_pagamento_tipo || l?.forma_pagamento;
  const dados = l?.dados?.forma_pagamento_tipo || l?.dados?.forma_pagamento;
  return String(direto || dados || '').trim();
}

/** Receitas geradas a partir de pedido de venda (PDV / gestão de vendas). */
function isLancamentoVenda(l) {
  const ref = l?.referencia_tipo || l?.dados?.referencia_tipo;
  return ref === 'PedidoVenda';
}

function descricaoComFormaPagamento(l) {
  const base = String(l?.descricao || '').trim();
  if (!isLancamentoVenda(l)) return base;
  const forma = rotuloFormaPagamento(l);
  if (!forma) return base;
  const sufixo = `(${forma})`;
  if (base.toLowerCase().includes(sufixo.toLowerCase())) return base;
  if (!base) return sufixo;
  return `${base} ${sufixo}`;
}

/** Barra lateral — mesmo critério do Fluxo de Caixa: verde receita, vermelho despesa. */
function rowAccent(l, { dimPago = false } = {}) {
  const tipo = tipoLinha(l);
  const isR = tipo === 'Receita';
  const isT = tipo === 'Transferência';
  const cancelado = l.status === 'Cancelado';
  const isPago = isLancamentoPago(l);

  if (dimPago && isPago) return 'muted';
  if (cancelado) return 'muted';
  if (isT) return 'muted';
  if (isR) return 'success';
  return 'danger';
}

function valorNode(
  l,
  {
    extratoMobile = false,
    perspectivaTransferencia = null,
    contaVisualizadaId = null,
  } = {},
) {
  const tipo = tipoLinha(l);
  const isR = tipo === 'Receita';
  const isT = tipo === 'Transferência';
  const cancelado = l.status === 'Cancelado';
  const pago = isLancamentoPago(l);
  const statusLista = statusRotuloListaFinanceiro(l);

  const perspectivaTransf =
    perspectivaTransferencia
    || (contaVisualizadaId ? resolverDirecaoSetaTransferencia(l, contaVisualizadaId) : null)
    || l.perspectivaTransferencia;

  if (cancelado) return '—';
  if (isT) {
    const valorFmt = formatFinanceiroValor(Math.abs(l.valor || 0));
    if (extratoMobile) {
      const valorExtratoTransferencia = (sign, signClass) => (
        <span className={cn(P38_EXTRATO_V8_ROW_VALUE, 'block w-full text-right', signClass)}>
          <span className="inline-block min-w-[0.65rem] text-right">{sign}</span>
          <span className="ml-px">{valorFmt}</span>
        </span>
      );
      if (perspectivaTransf === 'entrada') {
        return valorExtratoTransferencia('+', 'text-[#3d5a3d] dark:text-[#a4ce33]');
      }
      if (perspectivaTransf === 'saida') {
        return valorExtratoTransferencia('−', 'text-[#dc2626] dark:text-[#f87171]');
      }
      return (
        <span
          className={cn(
            P38_EXTRATO_V8_ROW_VALUE,
            'block w-full text-right text-[#374151] dark:text-[#d1d5db]',
          )}
        >
          {valorFmt}
        </span>
      );
    }
    return valorFmt;
  }

  const valorFmt = formatFinanceiroValor(Math.abs(l.valor || 0));
  const signClass = isR
    ? 'text-[#3d5a3d] dark:text-[#a4ce33]'
    : !pago && statusLista === 'Vencido'
      ? 'text-amber-600 dark:text-amber-400'
      : extratoMobile
        ? 'text-[#dc2626] dark:text-[#f87171]'
        : 'text-foreground/85';

  if (extratoMobile) {
    const sign = isR ? '+' : '−';
    return (
      <span className={cn(P38_EXTRATO_V8_ROW_VALUE, 'block w-full text-right', signClass)}>
        <span className="inline-block min-w-[0.65rem] text-right">{sign}</span>
        <span className="ml-px">{valorFmt}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-end gap-0.5 tabular-nums">
      <span className={signClass}>{isR ? '+' : '−'}</span>
      <span>{valorFmt}</span>
    </span>
  );
}

/** entrada = seta verde ↑ | saida = seta vermelha ↓ (extrato) | neutra = sem seta (fluxo multi-conta) */
export function resolverDirecaoSetaTransferencia(l, contaVisualizadaId = null) {
  if (!l || l.status === 'Cancelado') return null;
  const eTransfer = tipoLinha(l) === 'Transferência' || isTransferenciaEntreContas(l);
  if (!eTransfer) return null;

  const perspectiva = l.perspectivaTransferencia;
  if (perspectiva === 'entrada') return 'entrada';
  if (perspectiva === 'saida') return 'saida';
  if (perspectiva === 'neutra') return null;

  if (contaVisualizadaId) {
    const destinoId = l.conta_destino_id || (l.tipo === 'Receita' ? l.conta_financeira_id : null);
    const origemId =
      l.conta_origem_id || (l.tipo === 'Despesa' ? l.conta_financeira_id : null) || l.conta_financeira_id;
    if (destinoId === contaVisualizadaId && origemId !== contaVisualizadaId) return 'entrada';
    if (origemId === contaVisualizadaId && destinoId && destinoId !== contaVisualizadaId) return 'saida';
  }

  if (l.tipo === 'Receita' && isTransferenciaEntreContas(l)) return 'entrada';
  if (l.tipo === 'Despesa' && isTransferenciaEntreContas(l)) return 'saida';
  if (l.tipo === 'Transferência' && l.conta_destino_id) return 'saida';

  return null;
}

function setaTipoAoLadoValor(l, contaVisualizadaId = null) {
  const cancelado = l.status === 'Cancelado';
  if (cancelado) return null;

  const dirTransf = resolverDirecaoSetaTransferencia(l, contaVisualizadaId);
  if (dirTransf === 'entrada') {
    return (
      <ArrowUp
        className="h-3 w-3 shrink-0 opacity-80 text-green-600 dark:text-green-400"
        aria-hidden
      />
    );
  }
  if (dirTransf === 'saida') {
    return (
      <ArrowDown
        className="h-3 w-3 shrink-0 opacity-80 text-red-500 dark:text-red-400"
        aria-hidden
      />
    );
  }

  const tipo = tipoLinha(l);
  if (tipo === 'Transferência') return null;

  const isR = tipo === 'Receita';
  const Icon = isR ? ArrowUp : ArrowDown;
  const iconClass = isR
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-500 dark:text-red-400';
  return <Icon className={cn('h-3 w-3 shrink-0 opacity-80', iconClass)} aria-hidden />;
}

function rowMeta(l, { showPago = false, dimProgramada = false } = {}) {
  const cancelado = l.status === 'Cancelado';
  const isPago = isLancamentoPago(l);
  const statusExib = statusRotuloListaFinanceiro(l);
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
      {!programada && statusExib && statusExib !== 'Pago' && !isPago && (
        showPago && statusExib === 'Vencido' ? (
          <P38StatusPill tone="danger">{statusExib}</P38StatusPill>
        ) : (
          <P38StatusLabel tone={lancStatusTone(statusExib)}>{statusExib}</P38StatusLabel>
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
  contaVisualizadaId = null,
  extratoMobile = false,
}) {
  const cancelado = l.status === 'Cancelado';
  const isPago = isLancamentoPago(l);
  const podeSelecionar = emSelecao && (selecionarPagos ? isPago : !isPago);
  const conc = l.status_conciliacao || 'N/A';

  const dirExtrato = contaVisualizadaId ? resolverDirecaoSetaTransferencia(l, contaVisualizadaId) : null;
  const perspectiva = dirExtrato || l.perspectivaTransferencia;
  const isTransfConsolidada =
    !contaVisualizadaId && (l.isTransferenciaConsolidada || l.perspectivaTransferencia === 'neutra');

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
      {setaTipoAoLadoValor(l, contaVisualizadaId)}
      {EXIBIR_UI_CONCILIACAO_FINANCEIRO && conc === 'Discrepância' && (
        <AlertCircle className="h-2.5 w-2.5 text-muted-foreground" />
      )}
    </>
  );

  const subtitleExtratoMeta = () => {
    const categoria = String(l?.categoria || l?.dados?.categoria || '').trim();
    const parts = [
      data ? formatarDataCurta(data) : null,
      categoria || null,
      ...extratoCompraMercadoriaMetaExtras(l),
      l.conta_financeira_nome,
      rotuloFormaPagamentoExtrato(l) || null,
    ].filter(Boolean);
    return parts.join(' · ');
  };

  const subtitle = isTransfConsolidada || perspectiva ? (
    <span className="line-clamp-2 break-words">
      {data ? formatarDataCurta(data) : '—'}
      {l.notaTransferencia ? ` · ${l.notaTransferencia}` : ''}
    </span>
  ) : extratoMobile ? null : (
    <span className="line-clamp-2 break-words">
      {data ? formatarDataCurta(data) : '—'}
      {l.conta_financeira_nome ? ` · ${l.conta_financeira_nome}` : ''}
    </span>
  );

  const title = isTransfConsolidada ? (
    <span className="inline-flex min-w-0 items-center gap-1 text-[13px] sm:text-[15px]">
      <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="line-clamp-2 min-w-0 break-words normal-case leading-snug">
        {l.contaOrigemNome}
        <span className="mx-1 text-muted-foreground">&gt;</span>
        {l.contaDestinoNome}
      </span>
    </span>
  ) : perspectiva === 'saida' ? (
    <span className="inline-flex min-w-0 items-center gap-1 text-[13px] sm:text-[15px]">
      <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="line-clamp-2 min-w-0 break-words normal-case leading-snug">
        Transferência → {l.contaDestinoNome || 'Destino'}
      </span>
    </span>
  ) : perspectiva === 'entrada' ? (
    <span className="inline-flex min-w-0 items-center gap-1 text-[13px] sm:text-[15px]">
      <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="line-clamp-2 min-w-0 break-words normal-case leading-snug">
        Transferência ← {l.contaOrigemNome || 'Origem'}
      </span>
    </span>
  ) : (
    <span className={cn('line-clamp-2 normal-case leading-snug break-words', cancelado && 'line-through')}>
      {descricaoComFormaPagamento(l)}
    </span>
  );

  const lancamentoClick = l._lancamentoTransferencia || (isTransfConsolidada ? (l._lancamentoDespesa || l) : l);

  const esmaecido = cancelado || (showPago && isPago) || dimProgramada || l._isProgramada;

  const commonProps = {
    thinAccent: true,
    striped,
    accent: p38AccentKeyFromTone(rowAccent(l, { dimPago: showPago || dimProgramada || l._isProgramada })),
    className: `w-full text-left ${LINE_TITLE_CLASS} max-md:!py-3.5 max-md:min-h-[58px] [&>div:last-child]:max-w-[44%] sm:[&>div:last-child]:max-w-[38%] [&>div:first-child]:min-w-0 ${esmaecido ? 'opacity-50' : ''}`,
    title,
    subtitle,
    meta: rowMeta(l, { showPago, dimProgramada: dimProgramada || l._isProgramada }),
    value: valorNode(l, { extratoMobile, perspectivaTransferencia: perspectiva, contaVisualizadaId }),
    trailing,
  };

  if (extratoMobile) {
    const extratoTitlePlain = (() => {
      if (isTransfConsolidada) {
        return (
          <span className={cn('line-clamp-2 break-words', cancelado && 'line-through')}>
            {l.contaOrigemNome}
            <span className="text-[#6b7280] dark:text-muted-foreground"> › </span>
            {l.contaDestinoNome}
          </span>
        );
      }
      if (perspectiva === 'saida') {
        return (
          <span className={cn('line-clamp-2 break-words', cancelado && 'line-through')}>
            Transferência → {l.contaDestinoNome || 'Destino'}
          </span>
        );
      }
      if (perspectiva === 'entrada') {
        return (
          <span className={cn('line-clamp-2 break-words', cancelado && 'line-through')}>
            Transferência ← {l.contaOrigemNome || 'Origem'}
          </span>
        );
      }
      return (
        <span className={cn('line-clamp-2 break-words', cancelado && 'line-through')}>
          {descricaoComFormaPagamento(l)}
        </span>
      );
    })();

    const metaLinha = subtitleExtratoMeta();
    const metaExtra =
      (isTransfConsolidada || perspectiva) && l.notaTransferencia ? String(l.notaTransferencia).trim() : null;

    const extratoGridClass =
      'grid w-full grid-cols-[1rem_minmax(0,1fr)_7.25rem] items-center gap-x-2 gap-y-0';
    const extratoRow = (
      <div className={extratoGridClass}>
        <div className="flex w-4 shrink-0 items-center justify-start self-center">
          <FluxoExtratoRowIcon lancamento={l} compact />
        </div>
        <div className="min-w-0 text-left">
          <div className={cn(P38_EXTRATO_V8_ROW_TITLE, 'line-clamp-2 break-words text-left')}>
            {extratoTitlePlain}
          </div>
          <div className={cn(P38_EXTRATO_V8_ROW_META, 'text-left')}>
            <span className="line-clamp-2 break-words">{metaLinha}</span>
            {metaExtra ? (
              <>
                <br />
                <span className="line-clamp-2 break-words">{metaExtra}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex w-[7.25rem] shrink-0 items-center justify-end gap-1 self-center pl-0.5">
          {valorNode(l, {
            extratoMobile: true,
            perspectivaTransferencia: perspectiva,
            contaVisualizadaId,
          })}
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#6b7280] dark:text-muted-foreground" aria-hidden />
        </div>
      </div>
    );
    if (podeSelecionar) {
      return (
        <P38MobileLine
          thinAccent={false}
          accent="none"
          onClick={() => onToggleSelecionado?.(l.id)}
          className={P38_EXTRATO_V8_ROW_LINE}
        >
          {extratoRow}
        </P38MobileLine>
      );
    }
    return (
      <P38MobileLine
        thinAccent={false}
        accent="none"
        as="button"
        type="button"
        onClick={() => onClick?.(lancamentoClick)}
        className={P38_EXTRATO_V8_ROW_LINE}
      >
        {extratoRow}
      </P38MobileLine>
    );
  }

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
