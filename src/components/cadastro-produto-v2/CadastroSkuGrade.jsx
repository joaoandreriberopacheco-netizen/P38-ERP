import React, { useMemo } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  P38TableShell,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import { montarNovoSku, emptyGradeRow } from '@/lib/cadastroProdutoV2/montarNovoSku';

export default function CadastroSkuGrade({
  rows,
  onChange,
  linha,
  produtoCompra,
  eixos,
  solo,
}) {
  const updateRow = (key, field, value) => {
    onChange(rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const addRow = () => onChange([...rows, emptyGradeRow()]);
  const removeRow = (key) => {
    if (rows.length <= 1) return;
    onChange(rows.filter((r) => r.key !== key));
  };

  const copyPrecoFromAbove = (index) => {
    if (index <= 0) return;
    const prev = rows[index - 1];
    const cur = rows[index];
    onChange(rows.map((r, i) => (i === index ? {
      ...cur,
      valor_compra: prev.valor_compra,
      preco_venda: prev.preco_venda,
    } : r)));
  };

  const previews = useMemo(() => rows.map((row) => montarNovoSku({
    linha,
    produtoCompra,
    eixoA: eixos.useA ? row.eixo_a : '',
    eixoB: eixos.useB ? row.eixo_b : '',
    marca: row.marca,
    solo,
  })), [rows, linha, produtoCompra, eixos, solo]);

  if (eixos.count === 0 && !solo) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground">SKU único — sem variantes por eixo.</p>
        <P38TableShell className="border-border/40 overflow-x-auto">
          <Table>
            <TableHeader className={cn(p38Table.headerSolid, 'bg-muted dark:bg-[#383e47]')}>
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className={cn(p38Table.head, 'min-w-[200px]')}>novo_sku</TableHead>
                <TableHead className={cn(p38Table.head, 'w-[96px]')}>Código</TableHead>
                <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[88px]')}>Compra</TableHead>
                <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[88px]')}>Venda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className={cn(p38Table.cell, 'text-xs font-medium')}>
                    {montarNovoSku({ linha, produtoCompra, eixoA: '', eixoB: '', marca: row.marca, solo: false })}
                  </TableCell>
                  <TableCell className={p38Table.cell}>
                    <Input className="h-8 text-xs font-mono" value={row.codigo_interno} onChange={(e) => updateRow(row.key, 'codigo_interno', e.target.value.toUpperCase())} />
                  </TableCell>
                  <TableCell className={cn(p38Table.cell, p38Table.cellNumeric)}>
                    <Input className="h-8 text-xs text-right" type="number" step="0.01" value={row.valor_compra} onChange={(e) => updateRow(row.key, 'valor_compra', e.target.value)} />
                  </TableCell>
                  <TableCell className={cn(p38Table.cell, p38Table.cellNumeric)}>
                    <Input className="h-8 text-xs text-right" type="number" step="0.01" value={row.preco_venda} onChange={(e) => updateRow(row.key, 'preco_venda', e.target.value)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </P38TableShell>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Grade de SKUs · cada linha = um novo_sku
        </p>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" /> Linha
        </Button>
      </div>

      <P38TableShell className="border-border/40 dark:border-white/10 overflow-x-auto">
        <Table className="min-w-[880px]">
          <TableHeader className={cn(p38Table.headerSolid, 'bg-muted dark:bg-[#383e47]')}>
            <TableRow className="hover:bg-transparent border-none">
              {eixos.useA && (
                <TableHead className={cn(p38Table.head, 'min-w-[100px]')}>{eixos.rotuloA}</TableHead>
              )}
              {eixos.useB && (
                <TableHead className={cn(p38Table.head, 'min-w-[100px]')}>{eixos.rotuloB}</TableHead>
              )}
              <TableHead className={cn(p38Table.head, 'min-w-[200px]')}>novo_sku</TableHead>
              <TableHead className={cn(p38Table.head, 'w-[96px]')}>Código</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[88px]')}>Compra</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[88px]')}>Venda</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[72px]')}>Est.</TableHead>
              <TableHead className={cn(p38Table.head, 'w-[36px]')} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.key} className={cn(p38Table.row, 'h-10')}>
                {eixos.useA && (
                  <TableCell className={cn(p38Table.cell, 'py-1')}>
                    <Input
                      className="h-8 text-xs"
                      value={row.eixo_a}
                      onChange={(e) => updateRow(row.key, 'eixo_a', e.target.value)}
                      placeholder="50x50"
                    />
                  </TableCell>
                )}
                {eixos.useB && (
                  <TableCell className={cn(p38Table.cell, 'py-1')}>
                    <Input
                      className="h-8 text-xs"
                      value={row.eixo_b}
                      onChange={(e) => updateRow(row.key, 'eixo_b', e.target.value)}
                      placeholder="MEDINA"
                    />
                  </TableCell>
                )}
                <TableCell className={cn(p38Table.cell, 'py-1')}>
                  <span className="text-xs font-medium truncate block max-w-[240px]" title={previews[index]}>
                    {previews[index] || '—'}
                  </span>
                </TableCell>
                <TableCell className={cn(p38Table.cell, 'py-1')}>
                  <Input
                    className="h-8 text-xs font-mono"
                    value={row.codigo_interno}
                    onChange={(e) => updateRow(row.key, 'codigo_interno', e.target.value.toUpperCase())}
                    placeholder="VHF-U9A"
                  />
                </TableCell>
                <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'py-1')}>
                  <Input
                    className="h-8 text-xs text-right tabular-nums"
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.valor_compra}
                    onChange={(e) => updateRow(row.key, 'valor_compra', e.target.value)}
                  />
                </TableCell>
                <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'py-1')}>
                  <div className="flex items-center gap-0.5">
                    <Input
                      className="h-8 text-xs text-right tabular-nums"
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.preco_venda}
                      onChange={(e) => updateRow(row.key, 'preco_venda', e.target.value)}
                    />
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        title="Copiar preços da linha de cima"
                        onClick={() => copyPrecoFromAbove(index)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'py-1')}>
                  <Input
                    className="h-8 text-xs text-right tabular-nums"
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.estoque}
                    onChange={(e) => updateRow(row.key, 'estoque', e.target.value)}
                  />
                </TableCell>
                <TableCell className={cn(p38Table.cell, 'py-1 px-1')}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </P38TableShell>
    </div>
  );
}
