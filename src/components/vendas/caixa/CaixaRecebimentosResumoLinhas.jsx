import React from 'react';
import { caixaClasses } from '@/lib/caixaP38Theme';

function formatBRL(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const LINHAS_PADRAO = [
  { key: 'dinheiro', label: 'Dinheiro', destaque: true, sublabel: 'na gaveta' },
  { key: 'pix', label: 'PIX' },
  { key: 'credito', label: 'Cartão Crédito', hideZero: true },
  { key: 'debito', label: 'Cartão Débito', hideZero: true },
  { key: 'vale', label: 'Vale Troca', hideZero: true, naoMonetario: true },
  { key: 'fiado', label: 'Conta a Pagar', hideZero: true, aReceber: true },
];

function LinhaPontilhada({ label, valor, destaque, sublabel, aReceber, naoMonetario, compact }) {
  const valorClass = destaque
    ? 'text-base font-bold font-mono tabular-nums text-foreground'
    : compact
      ? 'text-[11px] font-mono tabular-nums text-foreground/90'
      : 'text-sm font-mono tabular-nums text-foreground/90';
  const labelClass = destaque
    ? 'text-sm font-semibold uppercase tracking-wide text-foreground'
    : compact
      ? 'text-[10px] uppercase tracking-wider text-muted-foreground font-medium'
      : 'text-xs uppercase tracking-wide text-muted-foreground font-medium';

  const rowClass = destaque
    ? 'flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl bg-muted/50 dark:bg-muted/30 border border-border/30'
    : 'flex items-baseline gap-1 min-w-0 py-0.5';

  return (
    <div className={rowClass}>
      <div className="min-w-0 shrink">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`${labelClass} truncate`}>{label}</span>
          {aReceber && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${caixaClasses('warning').pill}`}>
              a receber
            </span>
          )}
          {naoMonetario && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${caixaClasses('success').pill}`}>
              não monetário
            </span>
          )}
        </div>
        {destaque && sublabel && (
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{sublabel}</p>
        )}
      </div>
      {!destaque && (
        <span
          className="flex-1 min-w-[8px] border-b border-dotted border-muted-foreground/30 mb-[3px]"
          aria-hidden
        />
      )}
      <span className={`shrink-0 ${valorClass}`}>R$ {formatBRL(valor)}</span>
    </div>
  );
}

export function CaixaRecebimentosResumoSkeleton({ rows = 4, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-muted/60 animate-pulse" style={{ width: `${88 - i * 8}%` }} />
      ))}
    </div>
  );
}

/**
 * Listagem de recebimentos do turno — seletor de caixas e painéis compactos.
 */
export default function CaixaRecebimentosResumoLinhas({
  recebimentos = {},
  compact = true,
  variant = 'seletor',
  className = '',
}) {
  const linhas = LINHAS_PADRAO.filter(({ key, hideZero }) => {
    const valor = recebimentos[key] ?? 0;
    if (hideZero && Math.abs(valor) < 0.009) return false;
    return true;
  });

  if (!linhas.length) {
    return (
      <p className="text-xs text-muted-foreground uppercase tracking-wide py-2">
        Sem movimentação no turno
      </p>
    );
  }

  const panelClass =
    variant === 'seletor'
      ? 'rounded-xl border border-border/40 bg-muted/20 dark:bg-card/40 p-2.5 space-y-1.5'
      : 'space-y-1';

  return (
    <div className={`${panelClass} ${className}`}>
      {linhas.map((linha) => (
        <LinhaPontilhada
          key={linha.key}
          label={linha.label}
          valor={recebimentos[linha.key] ?? 0}
          destaque={linha.destaque}
          sublabel={linha.sublabel}
          aReceber={linha.aReceber}
          naoMonetario={linha.naoMonetario}
          compact={compact}
        />
      ))}
    </div>
  );
}
