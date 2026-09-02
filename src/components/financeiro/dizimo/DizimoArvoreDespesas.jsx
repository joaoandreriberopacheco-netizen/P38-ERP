import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  FinanceiroGrupo,
  formatFinanceiroValor,
} from '@/components/financeiro/fluxo/FinanceiroListaShared';
import DizimoItemDedutibilidadeDrawer from '@/components/financeiro/dizimo/DizimoItemDedutibilidadeDrawer';
import DizimoDedutibilidadeIconCol, { dizimoRowBorderClass } from '@/components/financeiro/dizimo/DizimoDedutibilidadeIconCol';
import { p38Table } from '@/lib/p38TableSurfaces';
import { cn } from '@/lib/utils';

const GRUPO_LABEL_CLASS =
  'text-sm font-semibold normal-case tracking-normal text-foreground print:text-black';
const SUBGRUPO_LABEL_CLASS =
  'text-[11px] font-semibold normal-case tracking-normal text-foreground/85';

function DizimoItemRow({ item, onOpen, striped }) {
  const subtitle =
    item.detalhe && item.detalhe !== 'Sócio' ? item.detalhe : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'flex w-full min-w-0 items-stretch text-left font-din-1451',
        'border-b border-border/35 dark:border-white/10 border-l-[3px] bg-background',
        dizimoRowBorderClass(item.config),
        striped && 'bg-secondary/15 dark:bg-secondary/20',
        'hover:bg-muted/15 transition-colors',
      )}
    >
      <DizimoDedutibilidadeIconCol config={item.config} />

      <div className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-2.5 pr-2 max-md:min-h-[58px]">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug line-clamp-2 break-words text-foreground sm:text-base">
            {item.nome}
          </p>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] font-light text-muted-foreground line-clamp-1">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className={cn('text-right tabular-nums', p38Table.mobileLineValue)}>
            <span className="text-foreground/85">−</span>
            {formatFinanceiroValor(item.valorBruto)}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
        </div>
      </div>
    </button>
  );
}

function ListaItensDizimo({ itens, onOpenItem }) {
  if (!itens?.length) {
    return <p className="px-3 py-4 text-xs text-muted-foreground">Nenhum item nesta competência.</p>;
  }

  return itens.map((item, index) => (
    <DizimoItemRow
      key={item.id}
      item={item}
      striped={index % 2 === 1}
      onOpen={onOpenItem}
    />
  ));
}

function DizimoSubsecao({ subsecao, onOpenItem }) {
  if (!subsecao.itens?.length) return null;

  return (
    <FinanceiroGrupo
      label={`${subsecao.label} (${subsecao.itens.length})`}
      labelClassName={SUBGRUPO_LABEL_CLASS}
      despesas={subsecao.valorBruto}
      liquido={-subsecao.valorBruto}
      card={false}
      defaultOpen
    >
      <div className="pl-1 sm:pl-2">
        <ListaItensDizimo itens={subsecao.itens} onOpenItem={onOpenItem} />
      </div>
    </FinanceiroGrupo>
  );
}

function DizimoSecao({ secao, onOpenItem }) {
  const temSubsecoes = secao.subsecoes?.length > 0;
  const itensDiretos = secao.itens || [];
  const vazio = temSubsecoes
    ? secao.subsecoes.every((sub) => !sub.itens?.length)
    : !itensDiretos.length;
  const qtdItens = temSubsecoes
    ? secao.subsecoes.reduce((acc, sub) => acc + (sub.itens?.length || 0), 0)
    : itensDiretos.length;

  if (vazio) return null;

  return (
    <FinanceiroGrupo
      label={`${secao.label} (${qtdItens})`}
      labelClassName={GRUPO_LABEL_CLASS}
      despesas={secao.valorBruto}
      liquido={-secao.valorBruto}
      card
      defaultOpen
    >
      {temSubsecoes ? (
        <div className="space-y-1 pl-0.5 sm:pl-1">
          {secao.subsecoes.map((sub) => (
            <DizimoSubsecao key={sub.id} subsecao={sub} onOpenItem={onOpenItem} />
          ))}
        </div>
      ) : (
        <ListaItensDizimo itens={itensDiretos} onOpenItem={onOpenItem} />
      )}
    </FinanceiroGrupo>
  );
}

export default function DizimoArvoreDespesas({ secoes = [], onConfigItem }) {
  const [itemAbertoId, setItemAbertoId] = useState(null);

  const itemAberto = useMemo(() => {
    if (!itemAbertoId) return null;
    for (const secao of secoes) {
      for (const item of secao.itens || []) {
        if (item.id === itemAbertoId) return item;
      }
      for (const sub of secao.subsecoes || []) {
        for (const item of sub.itens || []) {
          if (item.id === itemAbertoId) return item;
        }
      }
    }
    return null;
  }, [secoes, itemAbertoId]);

  const handleConfigChange = (next) => {
    if (!itemAbertoId) return;
    onConfigItem(itemAbertoId, next);
  };

  return (
    <>
      <div className="min-w-0 w-full max-w-full space-y-2 overflow-x-hidden pb-2 md:pb-0">
        {secoes.map((secao) => (
          <DizimoSecao key={secao.id} secao={secao} onOpenItem={(item) => setItemAbertoId(item.id)} />
        ))}
      </div>

      <DizimoItemDedutibilidadeDrawer
        item={itemAberto}
        open={!!itemAberto}
        onOpenChange={(open) => {
          if (!open) setItemAbertoId(null);
        }}
        onConfigChange={handleConfigChange}
      />
    </>
  );
}
