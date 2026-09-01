import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import { formatFinanceiroValor } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import DedutibilidadeBlocoToggle from '@/components/financeiro/dizimo/DedutibilidadeBlocoToggle';

function DizimoGrupoColapsavel({
  titulo,
  subtotal,
  subtotalDedutivel,
  nivel = 0,
  defaultOpen = true,
  children,
  vazio = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const paddingLeft = nivel === 0 ? 'pl-3' : nivel === 1 ? 'pl-5' : 'pl-7';

  return (
    <div
      className={cn(
        nivel === 0 && 'rounded-2xl overflow-hidden',
        nivel === 0 ? P38_FIELD_SURFACE : 'rounded-xl border border-border/40 bg-muted/10',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between gap-3 py-3 pr-3 text-left transition-colors hover:bg-muted/20',
          paddingLeft,
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight
            className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
          />
          <span className={cn('truncate', nivel === 0 ? 'text-sm font-semibold' : 'text-sm font-medium')}>
            {titulo}
          </span>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium tabular-nums">{formatFinanceiroValor(subtotal)}</p>
          {subtotalDedutivel != null && subtotalDedutivel !== subtotal ? (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              Deduz {formatFinanceiroValor(subtotalDedutivel)}
            </p>
          ) : null}
        </div>
      </button>

      {open ? (
        <div className={cn('border-t border-border/40', vazio && 'px-3 py-3 text-xs text-muted-foreground')}>
          {vazio ? 'Nenhum item nesta competência.' : children}
        </div>
      ) : null}
    </div>
  );
}

function DizimoItemLinha({ item, onConfigChange }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-3 pl-9 pr-3 border-b border-border/30 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.nome}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
          {formatFinanceiroValor(item.valorBruto)}
          {item.categoria ? ` · ${item.categoria}` : ''}
          {item.detalhe && item.detalhe !== 'Sócio' ? ` · ${item.detalhe}` : ''}
        </p>
      </div>
      <DedutibilidadeBlocoToggle value={item.config} onChange={onConfigChange} className="sm:shrink-0" />
    </div>
  );
}

function DizimoSubsecao({ subsecao, onConfigItem }) {
  const vazio = !subsecao.itens.length;

  return (
    <DizimoGrupoColapsavel
      titulo={subsecao.label}
      subtotal={subsecao.valorBruto}
      subtotalDedutivel={subsecao.valorDedutivel}
      nivel={1}
      defaultOpen={!vazio}
      vazio={vazio}
    >
      {subsecao.itens.map((item) => (
        <DizimoItemLinha
          key={item.id}
          item={item}
          onConfigChange={(next) => onConfigItem(item.id, next)}
        />
      ))}
    </DizimoGrupoColapsavel>
  );
}

function DizimoSecao({ secao, onConfigItem }) {
  const temSubsecoes = secao.subsecoes?.length > 0;
  const vazio = temSubsecoes
    ? secao.subsecoes.every((sub) => !sub.itens.length)
    : !secao.itens.length;

  return (
    <DizimoGrupoColapsavel
      titulo={secao.label}
      subtotal={secao.valorBruto}
      subtotalDedutivel={secao.valorDedutivel}
      nivel={0}
      defaultOpen
      vazio={vazio}
    >
      {temSubsecoes ? (
        <div className="space-y-2 p-2">
          {secao.subsecoes.map((sub) => (
            <DizimoSubsecao key={sub.id} subsecao={sub} onConfigItem={onConfigItem} />
          ))}
        </div>
      ) : (
        secao.itens.map((item) => (
          <DizimoItemLinha
            key={item.id}
            item={item}
            onConfigChange={(next) => onConfigItem(item.id, next)}
          />
        ))
      )}
    </DizimoGrupoColapsavel>
  );
}

export default function DizimoArvoreDespesas({ secoes = [], onConfigItem }) {
  return (
    <div className="space-y-3">
      {secoes.map((secao) => (
        <DizimoSecao key={secao.id} secao={secao} onConfigItem={onConfigItem} />
      ))}
    </div>
  );
}
