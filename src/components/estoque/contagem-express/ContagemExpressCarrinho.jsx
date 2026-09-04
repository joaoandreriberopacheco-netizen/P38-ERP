import {
  ArrowLeft, Loader2, Package, Printer, Save, Trash2, TrendingDown, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCountQuantity, getGroupDisplayFromBase } from '@/lib/inventoryCountUnits';
import { P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';

function DiffBadge({ diferenca, unidade }) {
  if (diferenca === null || Math.abs(diferenca) < 1e-6) {
    return (
      <span className="text-xs font-semibold text-[#4A5D23] dark:text-[#a4ce33]">OK</span>
    );
  }

  const positivo = diferenca > 0;
  const Icon = positivo ? TrendingUp : TrendingDown;
  const tone = positivo ? 'text-foreground' : 'text-red-500 dark:text-red-400';

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}>
      <Icon className="h-3 w-3" />
      {positivo ? '+' : ''}{formatCountQuantity(diferenca)} {unidade || 'UN'}
    </span>
  );
}

function ResumoCard({ valor, label, destaque }) {
  return (
    <div className={cn('rounded-xl px-2 py-2 text-center', P38_FIELD_SURFACE)}>
      <div className={`text-lg font-bold font-glacial ${destaque || 'text-foreground'}`}>{valor}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

export default function ContagemExpressCarrinho({
  itensAgrupados,
  comparativo,
  loadingComparativo,
  finalizando,
  imprimindo,
  onVoltar,
  onSalvar,
  onImprimir,
  onEditarItem,
  onRemoverItem,
}) {
  const mapaComparativo = Object.fromEntries((comparativo || []).map((r) => [r.produto_id, r]));

  const totais = (comparativo || []).reduce(
    (acc, row) => {
      if (!row.temDiferenca) {
        acc.ok += 1;
        return acc;
      }
      if (row.diferenca > 0) acc.sobras += 1;
      else acc.faltas += 1;
      return acc;
    },
    { ok: 0, sobras: 0, faltas: 0 }
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
        <button
          type="button"
          onClick={onVoltar}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold font-glacial text-foreground">Carrinho</h2>
      </div>

      {!loadingComparativo && comparativo?.length > 0 && (
        <div className="grid grid-cols-3 gap-2 border-b border-border/40 px-4 py-3">
          <ResumoCard
            valor={totais.ok}
            label="Conferem"
            destaque="text-[#4A5D23] dark:text-[#a4ce33]"
          />
          <ResumoCard valor={totais.sobras} label="Sobras" />
          <ResumoCard valor={totais.faltas} label="Faltas" destaque="text-red-500 dark:text-red-400" />
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3 pb-28">
        {itensAgrupados.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">Carrinho vazio</div>
        )}

        {itensAgrupados.map((grupo) => {
          const row = mapaComparativo[grupo.produto_id];
          const produto = grupo._produto;
          const display = grupo.display;
          const sistemaDisplay = row && produto
            ? getGroupDisplayFromBase(produto, row.saldoExtrato)
            : null;
          const diffDisplay = row && produto && row.temDiferenca
            ? getGroupDisplayFromBase(produto, Math.abs(row.diferenca))
            : null;
          const diffValor = row?.diferenca != null && diffDisplay
            ? (row.diferenca > 0 ? diffDisplay.quantidade : -diffDisplay.quantidade)
            : row?.diferenca ?? null;

          const Wrapper = onEditarItem ? 'button' : 'div';

          return (
            <div
              key={grupo.produto_id}
              className="flex items-stretch gap-2"
            >
              <Wrapper
                type={onEditarItem ? 'button' : undefined}
                onClick={onEditarItem ? () => onEditarItem(grupo) : undefined}
                className={cn(
                  'min-w-0 flex-1 rounded-2xl p-4 text-left transition-all active:scale-[0.99]',
                  P38_FIELD_SURFACE,
                  onEditarItem && 'hover:opacity-95',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-foreground break-words whitespace-normal">
                      {grupo.produto_nome}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-card px-2 py-1.5">
                        <div className="text-muted-foreground">Sistema</div>
                        <div className="font-semibold text-foreground">
                          {loadingComparativo || !sistemaDisplay
                            ? '…'
                            : `${formatCountQuantity(sistemaDisplay.quantidade)} ${sistemaDisplay.unidade}`}
                        </div>
                      </div>
                      <div className="rounded-lg bg-card px-2 py-1.5">
                        <div className="text-muted-foreground">Contado</div>
                        <div className="font-semibold text-foreground">
                          {formatCountQuantity(display?.quantidade ?? grupo.totalBase)}{' '}
                          {display?.unidade || 'UN'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      {loadingComparativo ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <DiffBadge
                          diferenca={diffValor}
                          unidade={diffDisplay?.unidade || display?.unidade}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </Wrapper>

              {onRemoverItem ? (
                <button
                  type="button"
                  onClick={() => onRemoverItem(grupo)}
                  aria-label={`Remover ${grupo.produto_nome} do carrinho`}
                  className="flex w-11 shrink-0 items-center justify-center rounded-2xl text-red-500 transition-colors hover:bg-red-500/10 active:bg-red-500/15 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border/40 bg-card/95 p-4 backdrop-blur-sm dark:bg-background">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onImprimir}
            disabled={imprimindo || itensAgrupados.length === 0 || loadingComparativo}
            className="h-12 flex-1 rounded-2xl"
          >
            {imprimindo ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Printer className="mr-2 h-5 w-5" />
                Imprimir
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={onSalvar}
            disabled={finalizando || itensAgrupados.length === 0 || loadingComparativo}
            className="h-12 flex-1 rounded-2xl p38-btn-primary font-semibold shadow-none"
          >
            {finalizando ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
