import React from 'react';
import { Eye } from 'lucide-react';
import { caixaClasses, caixaPanel, caixaPanelBody, caixaStormSurfaceHover, caixaTypo, conferenciaTone } from '@/lib/caixaP38Theme';
import CaixaValorDisplay from '@/components/vendas/caixa/CaixaValorDisplay';
import { selectAllOnFocus } from '@/lib/inputFocusUtils';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { cn } from '@/components/utils';

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
      className={cn(
        `${ROW_GRID} py-2 px-1 rounded-xl`,
        muted && 'bg-muted/60 dark:bg-[#1a2035]/80 opacity-60',
      )}
    >
      <div className="flex justify-center">
        {onEye ? (
          <button
            type="button"
            onClick={onEye}
            className="p-1 rounded-lg transition-colors hover:bg-muted dark:hover:bg-white/10"
            style={{ minWidth: '28px', minHeight: '28px' }}
            aria-label={`Ver vendas: ${label}`}
          >
            <Eye className="w-4 h-4 text-foreground/70 dark:text-foreground/80" />
          </button>
        ) : (
          <span className="w-7" aria-hidden />
        )}
      </div>
      <div className="min-w-0">
        <span className={`${caixaTypo.label} block truncate`}>{label}</span>
        {sublabel && (
          <span className={`${caixaTypo.meta} block truncate normal-case`}>{sublabel}</span>
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

function DinheiroConferenciaRow({
  label = 'Dinheiro',
  sublabel,
  valorReferencia,
  recebimentosDinheiro,
  onChange,
  onFocus,
  onBlur,
  disabled = false,
  placeholder,
  onEye,
}) {
  return (
    <div
      className={cn(
        `${ROW_GRID} py-2 px-1 rounded-xl transition-colors`,
        disabled
          ? 'bg-muted/60 dark:bg-[#1a2035]/80 opacity-60'
          : `bg-muted/40 dark:bg-[#1a2035] cursor-pointer hover:bg-muted ${caixaStormSurfaceHover}`,
      )}
      onClick={() => {
        if (disabled) return;
        const el = document.getElementById('input-dinheiro-conferido');
        el?.focus();
        el?.select();
      }}
    >
      <div className="flex justify-center">
        {onEye ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEye();
            }}
            className="p-1 rounded-lg transition-colors hover:bg-muted dark:hover:bg-white/10"
            style={{ minWidth: '28px', minHeight: '28px' }}
            aria-label={`Ver vendas: ${label}`}
          >
            <Eye className="w-4 h-4 text-foreground/70 dark:text-foreground/80" />
          </button>
        ) : (
          <span className="w-7" aria-hidden />
        )}
      </div>
      <div className="min-w-0">
        <span className={`${caixaTypo.label} block truncate`}>{label}</span>
        {sublabel && (
          <span className={`${caixaTypo.meta} block truncate normal-case`}>{sublabel}</span>
        )}
      </div>
      <div className="text-right">
        {disabled ? (
          <CaixaValorDisplay valor={valorReferencia} tone="neutral" signed={false} size="md" />
        ) : (
          <input
            autoComplete="off"
            id="input-dinheiro-conferido"
            type="text"
            inputMode="decimal"
            value={recebimentosDinheiro}
            onChange={onChange}
            onFocus={(e) => {
              onFocus?.(e);
              selectAllOnFocus(e);
            }}
            onBlur={onBlur}
            className="w-full max-w-[8.5rem] text-right text-lg font-bold bg-transparent border-0 focus:outline-none text-foreground cursor-pointer tabular-nums"
            placeholder={placeholder}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Painel «Recebimentos do Turno» — olhinho por forma + conferência no PDV aberto.
 */
export default function CaixaRecebimentosTurno({
  dinheiroNaGaveta = 0,
  recebimentos = {},
  fiado = 0,
  totalConferido = 0,
  liquidez = 0,
  modoFechado = false,
  modoConferenciaAtivo = false,
  modoVisualizacao = false,
  recebimentosDinheiro = '',
  onRecebimentosDinheiroChange,
  onRecebimentosDinheiroFocus,
  onRecebimentosDinheiroBlur,
  dinheiroPlaceholder,
  dinheiroConferidoFechamento = 0,
  totalConferidoFechamento = 0,
  diferencaFechamento = 0,
  conferenciaOk = true,
  usuarioFechamentoNome,
  formatValor,
  onVerFormaPagamento,
}) {
  const { pix = 0, credito = 0, debito = 0, vale = 0 } = recebimentos;

  const dinheiroConferidoLive = roundToTwoDecimals(
    parseFloat(String(recebimentosDinheiro).replace(/\./g, '').replace(',', '.')) || 0,
  );
  const totalConferidoLive = roundToTwoDecimals(
    dinheiroConferidoLive + pix + credito + debito,
  );
  const esperadoLive = roundToTwoDecimals(liquidez - vale);
  const diferencaLive = roundToTwoDecimals(totalConferidoLive - esperadoLive);
  const temDiferencaLive = Math.abs(diferencaLive) > 0.01;

  const renderConferenciaRodape = () => {
    if (modoFechado) {
      return (
        <>
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-medium text-foreground/90">Dinheiro conferido</span>
            <span className="font-semibold text-foreground tabular-nums">
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
                className={`text-2xl font-bold font-glacial tabular-nums ${
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
            <p className="text-xs text-center text-muted-foreground normal-case">
              Fechado por {usuarioFechamentoNome}
            </p>
          )}
        </>
      );
    }

    if (modoConferenciaAtivo) {
      const toneKey = conferenciaTone({ temDiferenca: temDiferencaLive, diferenca: diferencaLive });
      return (
        <div className={`p-4 rounded-xl transition-colors ${caixaClasses(toneKey).panel}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${caixaClasses(toneKey).panelText}`}>
              {!temDiferencaLive ? '✓ Confere' : diferencaLive > 0 ? 'Sobrando' : 'Faltando'}
            </span>
            <CaixaValorDisplay
              valor={!temDiferencaLive ? 0 : Math.abs(diferencaLive)}
              tone={toneKey}
              signed={temDiferencaLive}
              size="lg"
            />
          </div>
          {temDiferencaLive && (
            <p className="text-xs text-muted-foreground mt-1 normal-case">
              Esperado: {formatValor(esperadoLive)}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className={`p-4 rounded-xl opacity-60 ${caixaClasses('success').panel}`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${caixaClasses('success').panelText}`}>
            ✓ Valores Conferem
          </span>
          <span className={`text-2xl font-bold font-glacial tabular-nums ${caixaClasses('success').panelText}`}>
            {formatValor(0)}
          </span>
        </div>
      </div>
    );
  };

  const totalRodape = modoFechado
    ? totalConferidoFechamento
    : modoConferenciaAtivo
      ? totalConferidoLive
      : totalConferido;

  return (
    <div className={caixaPanel}>
      <div className="p38-panel__accent-bar" aria-hidden />
      <div className={`${caixaPanelBody} space-y-1`}>
        <h3 className={`${caixaTypo.title} mb-3 text-foreground`}>
          Recebimentos do Turno
        </h3>

        {modoConferenciaAtivo ? (
          <DinheiroConferenciaRow
            sublabel={modoVisualizacao ? 'somente leitura' : 'toque para conferir'}
            valorReferencia={dinheiroNaGaveta}
            recebimentosDinheiro={recebimentosDinheiro}
            onChange={onRecebimentosDinheiroChange}
            onFocus={onRecebimentosDinheiroFocus}
            onBlur={onRecebimentosDinheiroBlur}
            disabled={modoVisualizacao}
            placeholder={dinheiroPlaceholder}
            onEye={onVerFormaPagamento ? () => onVerFormaPagamento('dinheiro') : undefined}
          />
        ) : (
          <RecebimentoRow
            label="Dinheiro"
            sublabel="somente leitura"
            valor={dinheiroNaGaveta}
            muted
            onEye={onVerFormaPagamento ? () => onVerFormaPagamento('dinheiro') : undefined}
          />
        )}

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
            label="Conta a Pagar"
            sublabel="a receber"
            valor={fiado}
            onEye={onVerFormaPagamento ? () => onVerFormaPagamento('fiado') : undefined}
          />
        )}

        <div className="pt-3 mt-1 border-t border-border/40 dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className={caixaTypo.section}>Total Conferido</span>
            <CaixaValorDisplay valor={totalRodape} tone="neutral" signed={false} size="lg" />
          </div>
          {renderConferenciaRodape()}
        </div>
      </div>
    </div>
  );
}
