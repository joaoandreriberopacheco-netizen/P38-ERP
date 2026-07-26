import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/financialUtils';

export default function CatalogoLinhaListaSolo({
  produtos = [],
  onOpenProduto,
  onCreateSibling,
}) {
  if (!produtos.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Nenhum SKU nesta linha ainda.</p>
        <Button variant="outline" size="sm" onClick={() => onCreateSibling?.({})} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Novo SKU
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-right">Estoque</TableHead>
            <TableHead className="w-[100px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {produtos.map((p) => (
            <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpenProduto?.(p)}>
              <TableCell className="font-medium text-sm max-w-[280px] truncate" title={p.nome}>{p.nome}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{p.marca || '—'}</TableCell>
              <TableCell className="text-right text-xs">
                {Number(p.preco_venda_padrao) > 0 ? `R$ ${formatCurrency(p.preco_venda_padrao)}` : '—'}
              </TableCell>
              <TableCell className="text-right text-xs">{p.estoque_atual ?? 0}</TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateSibling?.({ irmao: p });
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Irmão
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="p-3 border-t border-border/40 bg-muted/20">
        <Button variant="outline" size="sm" onClick={() => onCreateSibling?.({})} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Novo SKU (a partir de irmão)
        </Button>
      </div>
    </div>
  );
}
