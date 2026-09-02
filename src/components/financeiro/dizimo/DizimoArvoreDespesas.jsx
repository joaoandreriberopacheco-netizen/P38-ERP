import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  FinanceiroGrupo,
  formatFinanceiroValor,
} from '@/components/financeiro/fluxo/FinanceiroListaShared';
import {
  DIZIMO_MODOS,
  formatarNomeItemDizimoLista,
} from '@/lib/dizimoCalculos';
import DizimoItemDedutibilidadeDrawer from '@/components/financeiro/dizimo/DizimoItemDedutibilidadeDrawer';
import { P38MobileLine, P38StatusPill, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { cn } from '@/lib/utils';

const GRUPO_LABEL_CLASS =
  'text-sm font-semibold normal-case tracking-normal text-foreground print:text-black';
const SUBGRUPO_LABEL_CLASS =
  'text-[11px] font-semibold normal-case tracking-normal text-foreground/85';

function accentDedutivel(config = {}) {
  const modo = config?.modo || DIZIMO_MODOS.TOTAL;
  if (modo === DIZIMO_MODOS.NAO_DEDUTIVEL) return 'muted';
  if (modo === DIZIMO_MODOS.PARCIAL) return 'info';
  return 'default';
}

function DizimoItemRow({ item, onOpen, striped }) {
  const modo = item.config?.modo || DIZIMO_MODOS.TOTAL;
  const foraDaBase = modo === DIZIMO_MODOS.NAO_DEDUTIVEL;

  const subtitle =
    item.detalhe && item.detalhe !== 'Sócio' ? item.detalhe : null;

  return (
    <P38MobileLine
      as="button"
      type="button"
      thinAccent
      striped={striped}
      accent={p38AccentKeyFromTone(accentDedutivel(item.config))}
      onClick={() => onOpen(item)}
      className={cn(
        'w-full text-left max-md:!py-3.5 max-md:min-h-[58px]',
        '[&>div>div:first-child]:text-[15px] [&>div>div:first-child]:font-semibold sm:[&>div>div:first-child]:text-base',
        '[&>div:last-child]:max-w-[46%] sm:[&>div:last-child]:max-w-[42%]',
      )}
      title={formatarNomeItemDizimoLista(item)}
      subtitle={subtitle}
      meta={
        foraDaBase ? (
          <P38StatusPill tone="muted">Fora da base</P38StatusPill>
        ) : null
      }
      value={
        <>
          <span className="text-foreground/85">−</span>
          {formatFinanceiroValor(item.valorBruto)}
        </>
      }
      trailing={<ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
    />
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
