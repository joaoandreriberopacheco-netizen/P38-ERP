import React, { useMemo } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  ShoppingCart,
  Wallet,
  Plus,
  Link2,
  FileUp,
  Anchor,
  RefreshCw,
  FileText,
  Receipt,
  RadioTower,
} from 'lucide-react';
import { formatarValorBRL } from '@/lib/extrairDadosComprovante';
import {
  obterFilhosWidget,
  obterNoAtualWidget,
  titulosBreadcrumb,
  widgetPathParent,
} from '@/lib/torreWidgetTree';
import { P38_FIELD_SURFACE, P38_KPI_SHELL, P38_ACCENT } from '@/components/financeiro/fluxo/financeiroP38';
import { cn } from '@/lib/utils';

const ICON_MAP = {
  'shopping-cart': ShoppingCart,
  wallet: Wallet,
  plus: Plus,
  link: Link2,
  'file-up': FileUp,
  anchor: Anchor,
  'refresh-cw': RefreshCw,
  'file-text': FileText,
  receipt: Receipt,
  'radio-tower': RadioTower,
};

function resolveIcon(name) {
  return ICON_MAP[name] || FileText;
}

function WidgetCard({ icon: Icon, titulo, descricao, onClick, disabled, nivel = 'pai' }) {
  const isPai = nivel === 'pai';
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 text-left transition-colors',
        isPai
          ? cn(
              'rounded-2xl p-4',
              P38_FIELD_SURFACE,
              disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-muted/30 active:scale-[0.99]',
            )
          : cn(
              'rounded-xl border border-border/40 px-4 py-3.5 dark:border-white/10',
              disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-muted/20',
            ),
      )}
    >
      {isPai ? (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/50 md:h-12 md:w-12">
          <Icon className={cn('h-5 w-5', P38_ACCENT)} />
        </div>
      ) : (
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('text-foreground', isPai ? 'text-sm font-semibold' : 'text-sm font-medium')}>
          {titulo}
        </p>
        {descricao ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export default function TorreWidgetDestinos({
  widgetPath,
  onWidgetPathChange,
  dadosComprovante,
  lendoComprovante,
  temArquivo,
  onAction,
}) {
  const valorLabel = dadosComprovante?.valor != null ? formatarValorBRL(dadosComprovante.valor) : null;

  const noAtual = useMemo(() => {
    if (!widgetPath?.length) return obterNoAtualWidget([]);
    return obterNoAtualWidget(widgetPath);
  }, [widgetPath]);

  const filhos = useMemo(() => {
    const parentId = widgetPath?.length ? widgetPath[widgetPath.length - 1] : 'raiz';
    return obterFilhosWidget(parentId);
  }, [widgetPath]);

  const breadcrumb = useMemo(() => titulosBreadcrumb(widgetPath), [widgetPath]);

  const enriquecerDescricao = (no) => {
    if (!no) return no?.descricao || '';
    if (no.id === 'financeiro_novo' && valorLabel) {
      return `Abrir formulário com ${valorLabel}`;
    }
    if (no.id === 'financeiro_existente' && valorLabel) {
      return `Buscar conta com valor ${valorLabel}`;
    }
    return no.descricao || '';
  };

  const handleItemClick = (no) => {
    if (no.action) {
      onAction?.(no.action, no);
      return;
    }
    if (no.children?.length) {
      onWidgetPathChange([...(widgetPath || []), no.id]);
    }
  };

  const nivelUi = widgetPath?.length === 0 ? 'pai' : widgetPath.length === 1 ? 'filho' : 'neto';

  return (
    <div className="flex flex-col gap-3 px-4 md:px-5">
      {(valorLabel || lendoComprovante || dadosComprovante?.descricao) && (
        <div className={cn('rounded-2xl px-4 py-3', P38_KPI_SHELL)}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Leitura do comprovante
          </p>
          {lendoComprovante ? (
            <p className="mt-2 text-sm text-muted-foreground">A ler valor e descrição…</p>
          ) : (
            <>
              {valorLabel ? (
                <p className={cn('mt-2 text-xl font-semibold tabular-nums', P38_ACCENT)}>{valorLabel}</p>
              ) : null}
              {dadosComprovante?.descricao ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">{dadosComprovante.descricao}</p>
              ) : null}
              {!valorLabel && !dadosComprovante?.descricao ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Não foi possível detectar o valor automaticamente.
                </p>
              ) : null}
            </>
          )}
        </div>
      )}

      {widgetPath?.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onWidgetPathChange(widgetPathParent(widgetPath))}
            className="flex items-center gap-2 self-start rounded-full bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
          {breadcrumb.length > 0 ? (
            <p className="px-0.5 text-xs text-muted-foreground">{breadcrumb.join(' › ')}</p>
          ) : null}
        </div>
      )}

      {widgetPath?.length === 0 ? (
        <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Para onde vai este arquivo?
        </p>
      ) : null}

      {widgetPath?.length > 0 && noAtual && !noAtual.action ? (
        <p className="px-0.5 text-sm font-semibold text-foreground">{noAtual.titulo}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        {filhos.map((no) => {
          const Icon = resolveIcon(no.icon);
          const disabled = Boolean(no.requiresFile && !temArquivo);
          const isPaiNivel = widgetPath?.length === 0;
          return (
            <WidgetCard
              key={no.id}
              icon={Icon}
              titulo={no.titulo}
              descricao={enriquecerDescricao(no)}
              disabled={disabled}
              nivel={isPaiNivel ? 'pai' : nivelUi === 'neto' ? 'neto' : 'filho'}
              onClick={() => handleItemClick(no)}
            />
          );
        })}
      </div>
    </div>
  );
}
