import {
  FinanceiroGrupo,
  formatFinanceiroValor,
} from '@/components/financeiro/fluxo/FinanceiroListaShared';
import {
  DIZIMO_MODOS,
  formatarNomeItemDizimoLista,
} from '@/lib/dizimoCalculos';
import DedutibilidadeBlocoToggle from '@/components/financeiro/dizimo/DedutibilidadeBlocoToggle';
import { P38MobileLine, P38StatusLabel, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
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

function DizimoItemRow({ item, onConfigChange, striped }) {
  const modo = item.config?.modo || DIZIMO_MODOS.TOTAL;
  const metaParts = [];

  if (modo === DIZIMO_MODOS.NAO_DEDUTIVEL) {
    metaParts.push(
      <P38StatusLabel key="nao" tone="muted">
        Fora da base
      </P38StatusLabel>,
    );
  } else if (modo === DIZIMO_MODOS.PARCIAL) {
    metaParts.push(
      <P38StatusLabel key="parcial" tone="info">
        Parcial na base
      </P38StatusLabel>,
    );
  }

  if (item.categoria) {
    metaParts.push(
      <span key="cat" className="text-xs text-muted-foreground">
        {item.categoria}
      </span>,
    );
  }

  const subtitle =
    item.detalhe && item.detalhe !== 'Sócio'
      ? item.detalhe
      : item.valorDedutivel !== item.valorBruto
        ? `Na base: ${formatFinanceiroValor(item.valorDedutivel)}`
        : null;

  return (
    <div className="w-full min-w-0 border-b border-border/30 last:border-b-0 dark:border-white/[0.06]">
      <P38MobileLine
        thinAccent
        striped={striped}
        accent={p38AccentKeyFromTone(accentDedutivel(item.config))}
        className={cn(
          'w-full text-left max-md:!py-3.5 max-md:min-h-[58px]',
          '[&>div>div:first-child]:text-[15px] [&>div>div:first-child]:font-semibold sm:[&>div>div:first-child]:text-base',
          '[&>div:last-child]:max-w-[46%] sm:[&>div:last-child]:max-w-[42%]',
        )}
        title={formatarNomeItemDizimoLista(item)}
        subtitle={subtitle}
        meta={metaParts.length ? <>{metaParts}</> : null}
        value={
          <>
            <span className="text-foreground/85">−</span>
            {formatFinanceiroValor(item.valorBruto)}
          </>
        }
      />
      <div className="px-3 pb-3 pt-0">
        <DedutibilidadeBlocoToggle
          value={item.config}
          onChange={onConfigChange}
          fullWidth
          compact
        />
      </div>
    </div>
  );
}

function ListaItensDizimo({ itens, onConfigItem }) {
  if (!itens?.length) {
    return <p className="px-3 py-4 text-xs text-muted-foreground">Nenhum item nesta competência.</p>;
  }

  return itens.map((item, index) => (
    <DizimoItemRow
      key={item.id}
      item={item}
      striped={index % 2 === 1}
      onConfigChange={(next) => onConfigItem(item.id, next)}
    />
  ));
}

function DizimoSubsecao({ subsecao, onConfigItem }) {
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
        <ListaItensDizimo itens={subsecao.itens} onConfigItem={onConfigItem} />
      </div>
    </FinanceiroGrupo>
  );
}

function DizimoSecao({ secao, onConfigItem }) {
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
            <DizimoSubsecao key={sub.id} subsecao={sub} onConfigItem={onConfigItem} />
          ))}
        </div>
      ) : (
        <ListaItensDizimo itens={itensDiretos} onConfigItem={onConfigItem} />
      )}
    </FinanceiroGrupo>
  );
}

export default function DizimoArvoreDespesas({ secoes = [], onConfigItem }) {
  return (
    <div className="min-w-0 w-full max-w-full space-y-2 overflow-x-hidden pb-2 md:pb-0">
      {secoes.map((secao) => (
        <DizimoSecao key={secao.id} secao={secao} onConfigItem={onConfigItem} />
      ))}
    </div>
  );
}
