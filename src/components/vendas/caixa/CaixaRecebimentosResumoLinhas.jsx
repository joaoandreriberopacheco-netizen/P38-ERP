import React from 'react';

function formatBRL(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const LINHAS_PADRAO = [
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'pix', label: 'PIX' },
  { key: 'credito', label: 'Cartão Crédito' },
  { key: 'debito', label: 'Cartão Débito' },
  { key: 'fiado', label: 'Conta a Pagar', hideZero: true },
  { key: 'vale', label: 'Vale Troca', hideZero: true },
];

/**
 * Listagem compacta de recebimentos (rótulo ····· valor) — usada no seletor de caixas.
 */
export default function CaixaRecebimentosResumoLinhas({
  recebimentos = {},
  compact = true,
  className = '',
}) {
  const textClass = compact ? 'text-[11px]' : 'text-sm';
  const valorClass = compact ? 'text-[11px] font-mono tabular-nums' : 'text-sm font-mono tabular-nums';

  return (
    <div className={`space-y-1 ${className}`}>
      {LINHAS_PADRAO.map(({ key, label, hideZero }) => {
        const valor = recebimentos[key] ?? 0;
        if (hideZero && Math.abs(valor) < 0.009) return null;
        return (
          <div key={key} className={`flex items-baseline gap-1 min-w-0 ${textClass}`}>
            <span className="shrink-0 uppercase tracking-wide text-muted-foreground font-medium truncate">
              {label}
            </span>
            <span
              className="flex-1 min-w-[12px] border-b border-dotted border-muted-foreground/35 mb-[3px]"
              aria-hidden
            />
            <span className={`shrink-0 text-foreground/90 ${valorClass}`}>
              R$ {formatBRL(valor)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
