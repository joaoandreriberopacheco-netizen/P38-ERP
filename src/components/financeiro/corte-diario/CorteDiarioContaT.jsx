import React from 'react';
import { ArrowRight } from 'lucide-react';

function formatValor(valor) {
  return (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function LinhaMovimento({ descricao, valor, lado, compact }) {
  const isEntrada = lado === 'entrada';
  return (
    <div className={compact ? 'py-0.5 text-[8px] leading-tight' : 'py-1.5 text-[11px] leading-snug'}>
      <p className="line-clamp-2 break-words text-foreground/90">{descricao}</p>
      <p
        className={`mt-0.5 font-semibold tabular-nums ${
          isEntrada
            ? 'text-emerald-800 dark:text-emerald-400'
            : 'text-rose-800 dark:text-rose-400'
        }`}
      >
        {isEntrada ? '+' : '−'} R$ {formatValor(valor)}
      </p>
    </div>
  );
}

function ColunaLado({ titulo, items, lado, vazio, compact }) {
  return (
    <div className={compact ? 'min-h-[4.5rem] flex-1 px-1.5 py-1.5' : 'min-h-[9rem] flex-1 px-3 py-3'}>
      <p
        className={`mb-1 border-b pb-0.5 font-bold uppercase tracking-wider ${
          compact ? 'text-[7px]' : 'text-[10px]'
        } ${
          lado === 'entrada'
            ? 'border-emerald-500/30 text-emerald-800/80 dark:text-emerald-400/90'
            : 'border-rose-500/30 text-rose-800/80 dark:text-rose-400/90'
        }`}
      >
        {titulo}
      </p>
      <div className="space-y-0.5">
        {items.length === 0 ? (
          <p className={`italic text-muted-foreground/80 ${compact ? 'text-[8px]' : 'text-[11px]'}`}>{vazio}</p>
        ) : (
          items.map((item) => (
            <LinhaMovimento
              key={item.id}
              descricao={
                item.isTransferencia ? (
                  <span className="inline-flex items-start gap-0.5">
                    <span>{item.descricao}</span>
                    <ArrowRight className={`shrink-0 opacity-50 ${compact ? 'mt-0 h-2 w-2' : 'mt-0.5 h-3 w-3'}`} />
                  </span>
                ) : (
                  item.descricao
                )
              }
              valor={item.valor}
              lado={lado}
              compact={compact}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Palito em T — título, saldo inicial, entradas/saídas, saldo final.
 */
export default function CorteDiarioContaT({ conta, compact = false }) {
  if (!conta) return null;

  return (
    <article
      className={`balancete-palito flex h-full flex-1 flex-col overflow-hidden rounded-lg border-2 border-border/60 bg-[#faf9f6] dark:border-border/50 dark:bg-card ${
        compact ? 'shadow-sm' : 'min-w-[18rem] max-w-[24rem] shadow-md'
      }`}
    >
      <header
        className={`border-b-2 border-border/50 bg-card shadow-sm text-center dark:bg-muted/40 ${
          compact ? 'px-1.5 py-1' : 'px-3 py-2.5'
        }`}
      >
        <h3
          className={`font-glacial font-bold uppercase tracking-wide text-foreground ${
            compact ? 'text-[9px] leading-tight' : 'text-sm'
          }`}
        >
          {conta.contaNome}
        </h3>
        {conta.isCaixaPDV && (
          <p className={`uppercase tracking-widest text-muted-foreground ${compact ? 'text-[6px]' : 'mt-0.5 text-[9px]'}`}>
            Só dinheiro
          </p>
        )}
        {conta.isCaixaGeral && (
          <p className={`uppercase tracking-widest text-muted-foreground ${compact ? 'text-[6px]' : 'mt-0.5 text-[9px]'}`}>
            Central
          </p>
        )}
      </header>

      <div
        className={`border-b border-border/40 bg-white/60 text-center dark:bg-muted/20 ${
          compact ? 'px-1.5 py-1' : 'px-3 py-2'
        }`}
      >
        <p className={`font-semibold uppercase tracking-widest text-muted-foreground ${compact ? 'text-[6px]' : 'text-[9px]'}`}>
          Saldo inicial
        </p>
        <p className={`font-bold tabular-nums text-foreground ${compact ? 'text-[10px]' : 'text-sm'}`}>
          R$ {formatValor(conta.saldoInicial)}
        </p>
      </div>

      <div
        className={`relative flex flex-1 divide-x-2 divide-border/50 ${
          compact ? 'min-h-[5rem]' : 'min-h-[11rem]'
        }`}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-border/60"
          aria-hidden
        />
        <ColunaLado titulo="Entradas" items={conta.entradas} lado="entrada" vazio="—" compact={compact} />
        <ColunaLado titulo="Saídas" items={conta.saidas} lado="saida" vazio="—" compact={compact} />
      </div>

      <footer
        className={`border-t-2 border-emerald-600/40 bg-emerald-50 text-center dark:border-emerald-500/35 dark:bg-emerald-950/30 ${
          compact ? 'px-1.5 py-1' : 'px-3 py-2.5'
        }`}
      >
        <p
          className={`font-bold uppercase tracking-widest text-emerald-900/70 dark:text-emerald-300/80 ${
            compact ? 'text-[6px]' : 'text-[9px]'
          }`}
        >
          Saldo final
        </p>
        <p
          className={`font-bold tabular-nums text-emerald-900 dark:text-emerald-300 ${
            compact ? 'text-[11px]' : 'text-base'
          }`}
        >
          R$ {formatValor(conta.saldoFinal)}
        </p>
      </footer>
    </article>
  );
}
