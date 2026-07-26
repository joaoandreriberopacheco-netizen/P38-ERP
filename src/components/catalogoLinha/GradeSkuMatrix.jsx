import { Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/financialUtils';
import { matrixCellKey } from '@/lib/produtoGradeCompra/indexGradeMatrix';
import { cn } from '@/components/utils';

function formatPreco(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `R$ ${formatCurrency(n)}`;
}

function formatEstoque(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function MatrixCell({ produto, onOpenProduto, onCreateSibling, eixoA, eixoB, compact = false }) {
  const estoqueBaixo = produto && Number(produto.estoque_atual) <= Number(produto.estoque_minimo || 0);

  if (produto) {
    return (
      <button
        type="button"
        onClick={() => onOpenProduto?.(produto)}
        className={cn(
          'w-full min-h-[72px] rounded-lg border px-2 py-2 text-left transition-colors hover:ring-2 hover:ring-[#4a5240]/20 dark:hover:ring-[#a4ce33]/25',
          estoqueBaixo
            ? 'border-amber-500/50 bg-amber-500/10'
            : 'border-border/50 bg-card hover:bg-muted/40',
        )}
        title={produto.nome}
      >
        <p className="text-sm font-semibold text-foreground tabular-nums">{formatPreco(produto.preco_venda_padrao)}</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Est.
          {' '}
          <span className={cn(estoqueBaixo && 'text-amber-700 dark:text-amber-400 font-medium')}>
            {formatEstoque(produto.estoque_atual)}
          </span>
        </p>
        {!compact && produto.marca ? (
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{produto.marca}</p>
        ) : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onCreateSibling?.({ eixoA, eixoB })}
      className="w-full min-h-[72px] rounded-lg border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-[#4a5240]/60 hover:bg-muted/30 dark:hover:border-[#a4ce33]/50 transition-colors"
      title="Criar SKU nesta célula"
    >
      <Plus className="w-4 h-4 opacity-70" />
      <span className="text-[10px] font-medium">Novo</span>
    </button>
  );
}

export default function GradeSkuMatrix({
  rowsA = [],
  colsB = [],
  cells = new Map(),
  gridMode = 'a_x_b',
  eixoARotulo = 'Eixo A',
  eixoBRotulo = 'Eixo B',
  sectionTitle = '',
  onOpenProduto,
  onCreateSibling,
}) {
  if (!rowsA.length || !colsB.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 p-8 text-center text-sm text-muted-foreground">
        Sem eixos definidos para esta grelha. Atribua produtos ou configure valores de eixo no cadastro.
      </div>
    );
  }

  const hideRowHeader = gridMode === 'cols_only';
  const rowHeaderLabel = gridMode === 'produto_compra_x_b' ? 'Peça' : eixoARotulo;
  const colMinWidth = gridMode === 'produto_compra_x_b' ? 88 : 96;

  return (
    <div className="space-y-2">
      {sectionTitle ? (
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{sectionTitle}</h3>
      ) : null}

      <div className="overflow-auto rounded-xl border border-border/50 shadow-sm bg-card">
        <table className="w-full min-w-[480px] border-collapse text-xs">
          <thead>
            <tr className="bg-muted/60">
              {!hideRowHeader ? (
                <th
                  className="sticky left-0 z-20 bg-muted px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-r border-border/50 min-w-[140px]"
                >
                  {rowHeaderLabel}
                </th>
              ) : null}
              {colsB.map((col) => (
                <th
                  key={col.id || col.nome}
                  className="px-2 py-2.5 text-center text-[11px] font-semibold text-foreground border-b border-border/50"
                  style={{ minWidth: colMinWidth }}
                >
                  <span className="inline-block px-1">{col.nome}</span>
                </th>
              ))}
            </tr>
            {!hideRowHeader ? (
              <tr className="bg-muted/30 text-[10px] text-muted-foreground">
                <th
                  colSpan={1}
                  className="sticky left-0 z-20 bg-muted/30 px-3 py-1 text-left border-b border-r border-border/40 font-normal"
                >
                  {eixoBRotulo}
                  {' '}
                  →
                </th>
                {colsB.map((col) => (
                  <th key={`sub-${col.id || col.nome}`} className="border-b border-border/30 font-normal py-1" />
                ))}
              </tr>
            ) : (
              <tr className="bg-muted/30">
                <th
                  colSpan={colsB.length}
                  className="px-3 py-1 text-left text-[10px] font-normal text-muted-foreground border-b border-border/40"
                >
                  {eixoBRotulo}
                  {' '}
                  (cada coluna = um SKU)
                </th>
              </tr>
            )}
          </thead>
          <tbody>
            {rowsA.map((row) => (
              <tr key={row.id || row.nome || '__row__'} className="border-b border-border/25 last:border-0">
                {!hideRowHeader ? (
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold text-sm text-foreground border-r border-border/40 whitespace-nowrap align-middle">
                    {row.nome || '—'}
                  </td>
                ) : null}
                {colsB.map((col) => {
                  const key = matrixCellKey(gridMode, row, col);
                  const produto = cells.get(key);
                  const eixoA = gridMode === 'produto_compra_x_b'
                    ? { id: row.id, nome: row.nome, isProdutoCompra: true }
                    : row;
                  const eixoB = col;

                  return (
                    <td key={`${row.id || row.nome}-${col.id || col.nome}`} className="p-1.5 align-top">
                      <MatrixCell
                        produto={produto}
                        eixoA={eixoA}
                        eixoB={eixoB}
                        onOpenProduto={onOpenProduto}
                        onCreateSibling={onCreateSibling}
                        compact={gridMode === 'produto_compra_x_b'}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
