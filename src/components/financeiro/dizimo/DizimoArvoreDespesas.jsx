import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFinanceiroValor } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import { formatarNomeItemDizimoLista } from '@/lib/dizimoCalculos';
import DedutibilidadeBlocoToggle from '@/components/financeiro/dizimo/DedutibilidadeBlocoToggle';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import CaixaValorDisplay from '@/components/vendas/caixa/CaixaValorDisplay';
import { COMPRAS_HIER_L1, COMPRAS_HIER_L2, COMPRAS_SEP } from '@/lib/comprasP38Theme';

const ITEM_TITLE =
  'font-light text-sm uppercase tracking-wide text-foreground leading-snug line-clamp-3 break-words';
const ITEM_META = 'text-[11px] font-light text-muted-foreground line-clamp-2 break-words normal-case';

function DizimoGrupoHeader({ titulo, subtotal, subtotalDedutivel, open, onToggle, nivel = 0, vazio = false }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={vazio}
      className={cn(
        'w-full min-w-0 text-left flex items-start gap-2 py-2.5 pr-1 transition-colors',
        COMPRAS_SEP,
        !vazio && 'hover:bg-muted/15',
        nivel > 0 && 'pl-1',
      )}
    >
      <div className="flex-1 min-w-0 overflow-hidden space-y-0.5">
        <span
          className={cn(
            'block min-w-0',
            nivel === 0
              ? 'text-sm font-semibold uppercase tracking-wide text-foreground'
              : 'text-sm font-medium text-foreground/90 normal-case',
          )}
        >
          {titulo}
        </span>
        {subtotalDedutivel != null && subtotalDedutivel !== subtotal ? (
          <span className="block text-[10px] text-muted-foreground tabular-nums">
            Deduz {formatFinanceiroValor(subtotalDedutivel)}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
        <CaixaValorDisplay valor={subtotal} tone="neutral" signed={false} size="sm" />
        {!vazio ? (
          <ChevronDown
            className={cn(
              'w-4 h-4 text-foreground/70 transition-transform duration-200',
              open ? '' : '-rotate-90',
            )}
            aria-hidden
          />
        ) : null}
      </div>
    </button>
  );
}

function DizimoItemCard({ item, onConfigChange, isLast = false }) {
  const metaParts = [
    item.categoria || null,
    item.detalhe && item.detalhe !== 'Sócio' ? item.detalhe : null,
  ].filter(Boolean);

  return (
    <div className={cn('min-w-0 max-w-full py-3 pr-1 space-y-2.5', !isLast && COMPRAS_SEP)}>
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1 space-y-1">
          <p className={ITEM_TITLE}>{formatarNomeItemDizimoLista(item)}</p>
          {metaParts.length ? (
            <p className={ITEM_META}>{metaParts.join(' · ')}</p>
          ) : null}
        </div>
        <CaixaValorDisplay
          valor={item.valorBruto}
          tone="neutral"
          signed={false}
          size="sm"
          className="shrink-0 pt-0.5"
        />
      </div>
      <DedutibilidadeBlocoToggle
        value={item.config}
        onChange={onConfigChange}
        fullWidth
      />
    </div>
  );
}

function DizimoSubsecao({ subsecao, onConfigItem }) {
  const vazio = !subsecao.itens.length;
  const [open, setOpen] = useState(!vazio);

  return (
    <div className="w-full min-w-0 max-w-full">
      <DizimoGrupoHeader
        titulo={subsecao.label}
        subtotal={subsecao.valorBruto}
        subtotalDedutivel={subsecao.valorDedutivel}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        nivel={1}
        vazio={vazio}
      />
      {open && !vazio ? (
        <div className={COMPRAS_HIER_L2}>
          {subsecao.itens.map((item, index) => (
            <DizimoItemCard
              key={item.id}
              item={item}
              onConfigChange={(next) => onConfigItem(item.id, next)}
              isLast={index === subsecao.itens.length - 1}
            />
          ))}
        </div>
      ) : vazio && open ? (
        <p className={cn(COMPRAS_HIER_L2, 'py-3 text-xs text-muted-foreground')}>
          Nenhum item nesta competência.
        </p>
      ) : null}
    </div>
  );
}

function DizimoSecao({ secao, onConfigItem }) {
  const temSubsecoes = secao.subsecoes?.length > 0;
  const vazio = temSubsecoes
    ? secao.subsecoes.every((sub) => !sub.itens.length)
    : !secao.itens.length;
  const [open, setOpen] = useState(true);

  return (
    <div className="w-full min-w-0 max-w-full">
      <DizimoGrupoHeader
        titulo={secao.label}
        subtotal={secao.valorBruto}
        subtotalDedutivel={secao.valorDedutivel}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        nivel={0}
        vazio={vazio}
      />
      {open && !vazio ? (
        temSubsecoes ? (
          <div className={cn(COMPRAS_HIER_L1, 'space-y-0')}>
            {secao.subsecoes.map((sub) => (
              <DizimoSubsecao key={sub.id} subsecao={sub} onConfigItem={onConfigItem} />
            ))}
          </div>
        ) : (
          <div className={COMPRAS_HIER_L1}>
            {secao.itens.map((item, index) => (
              <DizimoItemCard
                key={item.id}
                item={item}
                onConfigChange={(next) => onConfigItem(item.id, next)}
                isLast={index === secao.itens.length - 1}
              />
            ))}
          </div>
        )
      ) : vazio && open ? (
        <p className={cn(COMPRAS_HIER_L1, 'py-3 text-xs text-muted-foreground')}>
          Nenhum item nesta competência.
        </p>
      ) : null}
    </div>
  );
}

export default function DizimoArvoreDespesas({ secoes = [], onConfigItem }) {
  return (
    <P38MobileLineList allViewports className="rounded-xl max-w-full overflow-hidden">
      {secoes.map((secao, index) => (
        <div key={secao.id} className={cn(index > 0 && COMPRAS_SEP)}>
          <DizimoSecao secao={secao} onConfigItem={onConfigItem} />
        </div>
      ))}
    </P38MobileLineList>
  );
}
