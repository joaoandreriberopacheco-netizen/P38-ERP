import { Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/financialUtils';
import { axisCellKey } from '@/lib/produtoGradeCompra/indexGradeMatrix';
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

export default function GradeSkuMatrix({
  rowsA = [],
  colsB = [],
  cells = new Map(),
  eixoARotulo = 'Eixo A',
  eixoBRotulo = 'Eixo B',
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

  return (
    <div className="overflow-auto rounded-xl border border-border/40">
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/80 px-3 py-2 text-left font-medium text-muted-foreground border-b border-r border-border/40 min-w-[120px]">
              {eixoARotulo}
              {' '}
              ↓ /
              {' '}
              {eixoBRotulo}
              {' '}
              →
            </th>
            {colsB.map((col) => (
              <th
                key={col.id || col.nome}
                className="px-2 py-2 text-center font-medium text-foreground border-b border-border/40 min-w-[100px]"
              >
                {col.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowsA.map((row) => (
            <tr key={row.id || row.nome} className="border-b border-border/30 last:border-0">
              <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground border-r border-border/40 whitespace-nowrap">
                {row.nome}
              </td>
              {colsB.map((col) => {
                const key = axisCellKey(row, col);
                const produto = cells.get(key);
                const ruptura = !produto;
                const estoqueBaixo = produto && Number(produto.estoque_atual) <= Number(produto.estoque_minimo || 0);

                return (
                  <td key={`${row.id || row.nome}-${col.id || col.nome}`} className="p-1 align-top">
                    {produto ? (
                      <button
                        type="button"
                        onClick={() => onOpenProduto?.(produto)}
                        className={cn(
                          'w-full rounded-lg border px-2 py-2 text-left transition-colors hover:bg-muted/60',
                          estoqueBaixo
                            ? 'border-amber-500/40 bg-amber-500/5'
                            : 'border-border/40 bg-card',
                        )}
                        title={produto.nome}
                      >
                        <p className="font-semibold text-foreground truncate">{formatPreco(produto.preco_venda_padrao)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Est.
                          {' '}
                          {formatEstoque(produto.estoque_atual)}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={produto.nome}>
                          {produto.nome}
                        </p>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onCreateSibling?.({ eixoA: row, eixoB: col })}
                        className="w-full min-h-[64px] rounded-lg border border-dashed border-border/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-[#4a5240]/50 hover:bg-muted/30 dark:hover:border-[#a4ce33]/40 transition-colors"
                        title="Criar SKU nesta célula"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-[10px]">Novo</span>
                      </button>
                    )}
                    {ruptura && produto === undefined && (
                      <span className="sr-only">Célula vazia — ruptura</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
