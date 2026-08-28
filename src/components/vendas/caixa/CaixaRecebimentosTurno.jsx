import React from 'react';
import { Eye } from 'lucide-react';
import { caixaClasses, caixaTypo } from '@/lib/caixaP38Theme';
import CaixaValorDisplay from '@/components/vendas/caixa/CaixaValorDisplay';

const ROW_GRID = 'grid grid-cols-[28px_minmax(0,1fr)_minmax(8.5rem,auto)] items-center gap-x-2';

function RecebimentoRow({
  label,
  valor,
  sublabel,
  muted = false,
  onEye,
}) {
  return (
    <div
      className={`${ROW_GRID} py-2 px-1 rounded-xl ${muted ? 'bg-muted/60 opacity-60' : ''}`}
    >
      <div className="flex justify-center">
        {onEye ? (
          <button
            type="button"
            onClick={onEye}
            className="p-1 rounded-lg transition-colors hover:bg-muted"
            style={{ minWidth: '28px', minHeight: '28px' }}
            aria-label={`Ver vendas: ${label}`}
          >
            <Eye className="w-4 h-4 text-foreground/70" />
          </button>
        ) : (
          <span className="w-7" aria-hidden />
        )}
      </div>
      <div className="min-w-0">
        <span className={`${caixaTypo.label} block truncate`}>{label}</span>
        {sublabel && (
          <span className={`${caixaTypo.meta} block truncate`}>{sublabel}</span>
        )}
      </div>
      <div className="text-right">
        <CaixaValorDisplay
          valor={valor}
          tone="neutral"
          signed={false}
          size="md"
        />
      </div>
    </div>
  );
}

/**
 * Painel «Recebimentos do Turno» com olhinho por forma de pagamento.
 */
export default function CaixaRecebimentosTurno({
  dinheiroNaGaveta = 0,
  recebimentos = {},
  fiado = 0,
  totalConferido = 0,
  modoFechado = false,
  dinheiroConferidoFechamento = 0,
  totalConferidoFechamento = 0,
  diferencaFechamento = 0,
  conferenciaOk = true,
  usuarioFechamentoNome,
  formatValor,
  onVerFormaPagamento,
}) {
  const { pix = 0, credito = 0, debito = 0, vale = 0 } = recebimentos;

  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm">
      <h3 className="text-foreground mb-4 text-base font-semibold">Recebimentos do Turno</h3>
      <div className="space-y-1">
        <RecebimentoRow
          label="Dinheiro"
          sublabel="somente leitura"
          valor={dinheiroNaGaveta}
          muted
          onEye={onVerFormaPagamento ? () => onVerFormaPagamento('dinheiro') : undefined}
        />
        <RecebimentoRow
          label="PIX"
          valor={pix}
          onEye={onVerFormaPagamento ? () => onVerFormaPagamento('pix') : undefined}
        />
        <RecebimentoRow
          label="Cartão Crédito"
          valor={credito}
          onEye={onVerFormaPagamento ? () => onVerFormaPagamento('credito') : undefined}
        />
        <RecebimentoRow
          label="Cartão Débito"
          valor={debito}
          onEye={onVerFormaPagamento ? () => onVerFormaPagamento('debito') : undefined}
        />
        {vale > 0 && (
          <RecebimentoRow
            label="Vale Troca"
            sublabel="não monetário"
            valor={vale}
            onEye={onVerFormaPagamento ? () => onVerFormaPagamento('vale') : undefined}
          />
        )}
        {fiado > 0 && (
          <RecebimentoRow
            label="Fiado"
            sublabel="a receber"
            valor={fiado}
            onEye={onVerFormaPagamento ? () => onVerFormaPagamento('fiado') : undefined}
          />
        )}

        <div className="pt-3 mt-1 border-t border-border/40 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-medium text-foreground/90">Total Conferido</span>
            <span className="text-2xl font-bold text-foreground font-glacial">
              {modoFechado ? formatValor(totalConferidoFechamento) : formatValor(totalConferido)}
            </span>
          </div>
          {modoFechado ? (
            <>
              <div className="flex items-center justify-between px-1 text-sm">
                <span className="text-muted-foreground">Dinheiro conferido</span>
                <span className="font-semibold text-foreground">
                  {formatValor(dinheiroConferidoFechamento)}
                </span>
              </div>
              <div
                className={`p-4 rounded-xl ${
                  conferenciaOk
                    ? caixaClasses('success').panel
                    : caixaClasses('warning').panel
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-medium ${
                      conferenciaOk
                        ? caixaClasses('success').panelText
                        : caixaClasses('warning').panelText
                    }`}
                  >
                    {conferenciaOk ? '✓ Valores conferem' : 'Diferença no fechamento'}
                  </span>
                  <span
                    className={`text-2xl font-bold font-glacial ${
                      conferenciaOk
                        ? caixaClasses('success').panelText
                        : caixaClasses(diferencaFechamento > 0 ? 'info' : 'danger').panelText
                    }`}
                  >
                    {diferencaFechamento > 0 ? '+' : ''}
                    {formatValor(diferencaFechamento)}
                  </span>
                </div>
              </div>
              {usuarioFechamentoNome && (
                <p className="text-xs text-center text-muted-foreground">
                  Fechado por {usuarioFechamentoNome}
                </p>
              )}
            </>
          ) : (
            <div className={`p-4 rounded-xl opacity-60 ${caixaClasses('success').panel}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${caixaClasses('success').panelText}`}>
                  ✓ Valores Conferem
                </span>
                <span className={`text-2xl font-bold font-glacial ${caixaClasses('success').panelText}`}>
                  {formatValor(0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
