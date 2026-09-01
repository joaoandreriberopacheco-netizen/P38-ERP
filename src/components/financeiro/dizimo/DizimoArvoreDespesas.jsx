import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFinanceiroValor } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import DedutibilidadeBlocoToggle from '@/components/financeiro/dizimo/DedutibilidadeBlocoToggle';

const LINHA_FINA = 'border-black/[0.06] dark:border-white/10';
const DIVISOR = `divide-y ${LINHA_FINA}`;

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
        'overflow-hidden bg-background',
        nivel === 0 ? `rounded-xl border ${LINHA_FINA}` : `rounded-lg border ${LINHA_FINA} mx-2`,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between gap-3 py-2.5 pr-3 text-left transition-colors hover:bg-muted/15',
          paddingLeft,
          `border-b ${LINHA_FINA}`,
          open && !vazio && 'border-b',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight
            className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
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
        <div className={cn(vazio && 'px-3 py-3 text-xs text-muted-foreground')}>
          {vazio ? 'Nenhum item nesta competência.' : children}
        </div>
      ) : null}
    </div>
  );
}

function DizimoItemLinha({ item, onConfigChange }) {
  return (
    <div
      className={cn(
        'flex flex-row items-center justify-between gap-3 py-2.5 pl-9 pr-3',
        `border-b ${LINHA_FINA} last:border-b-0`,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.nome}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
          {formatFinanceiroValor(item.valorBruto)}
          {item.categoria ? ` · ${item.categoria}` : ''}
          {item.detalhe && item.detalhe !== 'Sócio' ? ` · ${item.detalhe}` : ''}
        </p>
      </div>
      <DedutibilidadeBlocoToggle value={item.config} onChange={onConfigChange} />
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
      <div className={DIVISOR}>{subsecao.itens.map((item) => (
        <DizimoItemLinha
          key={item.id}
          item={item}
          onConfigChange={(next) => onConfigItem(item.id, next)}
        />
      ))}</div>
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
        <div className={cn('space-y-2 py-2', DIVISOR)}>
          {secao.subsecoes.map((sub) => (
            <DizimoSubsecao key={sub.id} subsecao={sub} onConfigItem={onConfigItem} />
          ))}
        </div>
      ) : (
        <div className={DIVISOR}>
          {secao.itens.map((item) => (
            <DizimoItemLinha
              key={item.id}
              item={item}
              onConfigChange={(next) => onConfigItem(item.id, next)}
            />
          ))}
        </div>
      )}
    </DizimoGrupoColapsavel>
  );
}

export default function DizimoArvoreDespesas({ secoes = [], onConfigItem }) {
  return (
    <div className="space-y-2">
      {secoes.map((secao) => (
        <DizimoSecao key={secao.id} secao={secao} onConfigItem={onConfigItem} />
      ))}
    </div>
  );
}
