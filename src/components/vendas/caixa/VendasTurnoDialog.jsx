import { Dialog } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { Badge } from '@/components/ui/badge';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { ArrowLeft, Printer, Receipt, Eye, ArrowDownUp } from 'lucide-react';
import { format } from 'date-fns';
import { formatarDataHora } from '@/components/utils/dateUtils';
import { openPrintWindowOrShareHtml } from '@/lib/mobilePrintAndShare';
import { formatarDiferencaSubstituicao, partitionVendasConsultaCaixa } from '@/lib/substituicoesVendaCaixa';
import TrocaCaixaCard from '@/components/vendas/caixa/TrocaCaixaCard';
import { CAIXA_PRINT, caixaClasses } from '@/lib/caixaP38Theme';
import FormaPagamentoBadges from '@/components/vendas/FormaPagamentoBadges';

const fmtHora = (d) => {
  const dataHora = formatarDataHora(d);
  return dataHora === '—' ? '--:--' : dataHora.split(' ')[1];
};
const fmtDtHora = (d) => formatarDataHora(d);

function BlocoSubstituicao({ meta, formatValor }) {
  if (meta?.papel !== 'substituto' || !meta.origem) return null;
  const origem = meta.origem;
  return (
    <div className="mt-2 pt-2 border-t border-dashed border-amber-200/80 dark:border-amber-800/50 flex items-start gap-2">
      <ArrowDownUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0 text-xs text-muted-foreground">
        <span>Substitui </span>
        <span className="font-medium text-muted-foreground">{origem.numero}</span>
        <span> (</span>
        <span className="line-through">{formatValor(origem.valor_total)}</span>
        <span>)</span>
      </div>
      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
        {formatarDiferencaSubstituicao(meta.diferenca, formatValor)}
      </span>
    </div>
  );
}

function VendaTurnoCard({ venda, meta, formatValor, onVerDetalhes, compact }) {
  const isSubstituto = meta?.papel === 'substituto';
  const padding = compact ? 'p-4' : 'p-5';

  if (compact) {
    return (
      <div
        className={`bg-card rounded-2xl ${padding} shadow-sm ${
          isSubstituto ? 'ring-1 ring-amber-200/60 dark:ring-amber-800/40' : ''
        }`}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-semibold text-foreground">{venda.numero}</span>
              <span className="text-xs text-muted-foreground">{fmtHora(venda.created_date)}</span>
              <FormaPagamentoBadges pagamentos={venda.pagamentos} size="xs" />
              {isSubstituto && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                  Substituição
                </Badge>
              )}
            </div>
          </div>
          <button
            onClick={() => onVerDetalhes(venda)}
            className="p-2 hover:bg-muted rounded-lg flex-shrink-0"
            style={{ minWidth: '40px', minHeight: '40px' }}
          >
            <Eye className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="text-sm text-foreground/90 mb-1">{venda.cliente_nome}</div>
        <div className="text-xs text-muted-foreground mb-2">{venda.vendedor_nome}</div>
        <BlocoSubstituicao meta={meta} formatValor={formatValor} />
        <div className="flex justify-between items-center pt-3 border-t border-border/40">
          <span className="text-xs text-muted-foreground">{venda.itens?.length || 0} itens</span>
          <span className="text-xl font-bold text-foreground font-glacial">{formatValor(venda.valor_total)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-card rounded-2xl ${padding} shadow-sm hover:shadow-md transition-shadow ${
        isSubstituto ? 'ring-1 ring-amber-200/60 dark:ring-amber-800/40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-sm font-semibold text-foreground">{venda.numero}</span>
            <span className="text-xs text-muted-foreground">{fmtHora(venda.created_date)}</span>
            <FormaPagamentoBadges pagamentos={venda.pagamentos} size="xs" />
            {isSubstituto && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                Substituição
              </Badge>
            )}
          </div>
          <div className="text-sm text-foreground/90 mb-1">{venda.cliente_nome}</div>
          <div className="text-xs text-muted-foreground">{venda.vendedor_nome}</div>
          <BlocoSubstituicao meta={meta} formatValor={formatValor} />
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-bold text-foreground font-glacial mb-1">{formatValor(venda.valor_total)}</div>
          <div className="text-xs text-muted-foreground mb-2">{venda.itens?.length || 0} itens</div>
          <button
            onClick={() => onVerDetalhes(venda)}
            className="p-2 hover:bg-muted rounded-lg transition-colors ml-auto"
            style={{ minWidth: '40px', minHeight: '40px' }}
          >
            <Eye className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

function htmlLinhaVenda(v, meta) {
  const pags = (v.pagamentos || []).map((p) => `${p.forma_pagamento} R$ ${(p.valor || 0).toFixed(2)}`).join(' | ');
  let sub = '';
  if (meta?.papel === 'substituto' && meta.origem) {
    const diff = formatarDiferencaSubstituicao(meta.diferenca, (n) => `R$ ${Number(n).toFixed(2)}`);
    sub = `<div style="font-size:10px;color:#b45309;margin-top:2px">↔ Substitui ${meta.origem.numero} (<s>R$ ${(meta.origem.valor_total || 0).toFixed(2)}</s>) · ${diff}</div>`;
  }
  return `<div style="border-bottom:1px solid #f3f4f6;padding:6px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span>${v.numero} · ${v.cliente_nome || ''} · ${fmtHora(v.created_date)}</span><span style="color:${CAIXA_PRINT.success};font-weight:600">+R$ ${(v.valor_total || 0).toFixed(2)}</span></div>${sub}<div style="font-size:10px;color:#9ca3af">${pags}</div></div>`;
}

export default function VendasTurnoDialog({
  open,
  onOpenChange,
  vendasFinalizadas,
  turnoAtivo,
  caixaData,
  formatValor,
  metaPorPedidoId = {},
  onVerDetalhes,
}) {
  const qtdSub = caixaData?.qtdSubstituicoes || 0;
  const valorNaoSoma = caixaData?.valorSubstituidoNaoSoma || 0;
  const { trocas, normais } = partitionVendasConsultaCaixa(vendasFinalizadas, metaPorPedidoId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CaixaDialogContent className="max-w-full w-full h-full m-0 p-0 rounded-none bg-background flex flex-col">
        <div className="bg-card border-b border-border/40 px-4 py-3 flex items-center flex-shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <ArrowLeft className="w-6 h-6 text-foreground/90" />
          </button>
          <h2 className="flex-1 text-center text-lg font-semibold text-foreground font-glacial">
            Vendas do Turno
          </h2>
          <button
            onClick={async () => {
              const linhas = vendasFinalizadas
                .map((v) => htmlLinhaVenda(v, metaPorPedidoId[v.id]))
                .join('');
              const cancelamentos = turnoAtivo?.cancelamentos_rastro || [];
              const linhasCancelamentos =
                cancelamentos.length > 0
                  ? cancelamentos
                      .map(
                        (c) =>
                          `<div style="border-bottom:1px solid #fee2e2;padding:6px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:${CAIXA_PRINT.danger}">${c.pedido_numero} · ${c.cliente_nome || ''}</span><span style="color:${CAIXA_PRINT.danger};font-weight:600">CANCELADO</span></div><div style="font-size:10px;color:#9ca3af">${c.motivo_cancelamento || ''} · ${c.cancelado_por || ''}</div></div>`
                      )
                      .join('')
                  : '<p style="font-size:11px;color:#9ca3af;margin:4px 0">Nenhuma venda cancelada</p>';
              const notaSub =
                qtdSub > 0
                  ? `<p style="font-size:10px;color:#9ca3af;margin:4px 0">${qtdSub} substituição(ões) — R$ ${valorNaoSoma.toFixed(2)} não somam no total</p>`
                  : '';
              const html = `<html><head><title>Extrato de Vendas</title><style>
                body{font-family:'DIN 1451',DINish,system-ui,sans-serif;font-size:13px;padding:20px;max-width:700px;margin:0 auto}
                h2{font-size:13px;font-weight:600;margin:14px 0 6px;color:#374151}
                .dashed{border-top:1px dashed #aaa;margin:8px 0}
              </style></head><body>
                <div style="text-align:center;margin-bottom:14px"><b style="font-size:16px">VAREJOSYNC</b><br/><span style="color:#9ca3af;font-size:11px">Extrato de Vendas do Turno</span></div>
                <div class="dashed"></div>
                <h2>Turno: ${turnoAtivo?.numero || '-'} · Abertura: ${turnoAtivo?.data_abertura ? fmtDtHora(turnoAtivo.data_abertura) : '-'}</h2>
                <div class="dashed"></div>
                <h2>Vendas (${vendasFinalizadas.length})</h2>
                ${linhas || '<p style="color:#9ca3af;font-size:11px">Nenhuma venda</p>'}
                <div class="dashed"></div>
                <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;margin:8px 0"><span>Total útil:</span><span>R$ ${(caixaData.totalVendas || 0).toFixed(2)}</span></div>
                ${notaSub}
                <div class="dashed"></div>
                <h2>Cancelamentos do Turno (${cancelamentos.length})</h2>
                ${linhasCancelamentos}
                <div class="dashed"></div>
                <p style="text-align:center;font-size:10px;color:#9ca3af;margin-top:14px">Não é documento fiscal</p>
              </body></html>`;
              try {
                await openPrintWindowOrShareHtml(
                  html,
                  `extrato-vendas-turno-${turnoAtivo?.numero || 'turno'}.html`,
                  'Extrato de vendas',
                  { windowFeatures: 'width=800,height=900' }
                );
              } catch {
                alert('Permita pop-ups para imprimir.');
              }
            }}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            style={{ minWidth: '44px', minHeight: '44px' }}
            title="Imprimir extrato"
          >
            <Printer className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {vendasFinalizadas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <Receipt className="w-10 h-10 text-muted-foreground" />
              </div>
              <p className="text-base font-medium text-muted-foreground">Nenhuma venda registrada</p>
            </div>
          ) : (
            <>
              {turnoAtivo?.cancelamentos_rastro?.length > 0 && (
                <div className="mb-4">
                  <p className={`text-xs font-semibold px-1 mb-2 ${caixaClasses('danger').text}`}>
                    Cancelamentos do turno ({turnoAtivo.cancelamentos_rastro.length})
                  </p>
                  <div className="space-y-2">
                    {turnoAtivo.cancelamentos_rastro.map((c, idx) => (
                      <div key={idx} className={`rounded-2xl p-4 shadow-sm ${caixaClasses('danger').panel}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className={`text-sm font-semibold ${caixaClasses('danger').panelText}`}>
                              {c.pedido_numero} · {c.cliente_nome}
                            </div>
                            <div className={`text-xs mt-0.5 ${caixaClasses('danger').text}`}>{c.motivo_cancelamento}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {c.cancelado_por}
                              {c.data_cancelamento ? ` · ${format(new Date(c.data_cancelamento), 'HH:mm')}` : ''}
                            </div>
                          </div>
                          <span className={`text-base font-bold font-glacial ${caixaClasses('danger').text}`}>
                            -{formatValor(c.valor_total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {trocas.length > 0 && (
                <div className="mb-4 space-y-3">
                  <p className="text-xs font-semibold px-1 text-muted-foreground">
                    Trocas ({trocas.length})
                  </p>
                  {trocas.map((venda) => (
                    <TrocaCaixaCard
                      key={venda.id}
                      venda={venda}
                      meta={metaPorPedidoId[venda.id]}
                      onVerDetalhes={onVerDetalhes}
                    />
                  ))}
                </div>
              )}
              {normais.length > 0 && trocas.length > 0 && (
                <p className="text-xs font-semibold px-1 text-muted-foreground mb-2">
                  Vendas ({normais.length})
                </p>
              )}
              <VirtualizedList
                items={normais}
                estimateSize={132}
                className="hidden md:block h-[calc(100vh-190px)] pr-1"
                contentClassName="max-w-4xl mx-auto"
                itemClassName="pb-3"
                getItemKey={(venda) => venda.id}
                renderItem={(venda) => (
                    <VendaTurnoCard
                      venda={venda}
                      meta={metaPorPedidoId[venda.id]}
                      formatValor={formatValor}
                      onVerDetalhes={onVerDetalhes}
                      compact={false}
                    />
                )}
              />
              {trocas.length > 0 && (
                <div className="mb-4 space-y-3">
                  <p className="text-xs font-semibold px-1 text-muted-foreground">
                    Trocas ({trocas.length})
                  </p>
                  {trocas.map((venda) => (
                    <TrocaCaixaCard
                      key={venda.id}
                      venda={venda}
                      meta={metaPorPedidoId[venda.id]}
                      onVerDetalhes={onVerDetalhes}
                    />
                  ))}
                </div>
              )}
              {normais.length > 0 && trocas.length > 0 && (
                <p className="text-xs font-semibold px-1 text-muted-foreground mb-2">
                  Vendas ({normais.length})
                </p>
              )}
              <VirtualizedList
                items={normais}
                estimateSize={150}
                className="md:hidden h-[calc(100vh-190px)] pr-1"
                itemClassName="pb-3"
                getItemKey={(venda) => venda.id}
                renderItem={(venda) => (
                    <VendaTurnoCard
                      venda={venda}
                      meta={metaPorPedidoId[venda.id]}
                      formatValor={formatValor}
                      onVerDetalhes={onVerDetalhes}
                      compact
                    />
                )}
              />
            </>
          )}
        </div>

        {vendasFinalizadas.length > 0 && (
          <div className="flex-shrink-0 bg-card border-t border-border/40 p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Total útil do turno</span>
                <span className="text-2xl font-bold text-foreground font-glacial">
                  {formatValor(caixaData.totalVendas)}
                </span>
              </div>
              {qtdSub > 0 && (
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {qtdSub} substituição{qtdSub > 1 ? 'ões' : ''} — {formatValor(valorNaoSoma)} não somam
                </p>
              )}
            </div>
          </div>
        )}
      </CaixaDialogContent>
    </Dialog>
  );
}
