import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ArrowDown, ArrowUp, Columns, Package, DollarSign, Truck, Settings, RotateCcw, BarChart3 } from 'lucide-react';
import { DEFAULT_CATALOG_PRODUTO_COLUMNS } from '@/lib/catalogProdutoColumnsStorage';
import { cn } from '@/components/utils';
import { P38_CHIP_ACTIVE, PRODUTOS_DROPDOWN_ITEM } from '@/lib/produtosP38Theme';

export default function ColumnSelector({ visibleColumns, onColumnsChange, open, onClose }) {
  // Ensure visibleColumns is always an array
  const [tempColumns, setTempColumns] = useState(Array.isArray(visibleColumns) ? visibleColumns : []);

  useEffect(() => {
    if (open) {
      setTempColumns(Array.isArray(visibleColumns) ? visibleColumns : []);
    }
  }, [open, visibleColumns]);

  const columnGroups = {
    descritivo: {
      name: 'Descritivos',
      icon: Package,
      columns: [
        { id: 'status', label: 'Status' },
        { id: 'codigo_interno', label: 'Código Interno' },
        { id: 'codigo_barras', label: 'Código de Barras' },
        { id: 'categoria', label: 'Categoria' },
        { id: 'tags', label: 'Tags' }
      ]
    },
    comercial: {
      name: 'Comerciais',
      icon: DollarSign,
      columns: [
        { id: 'fornecedor', label: 'Fornecedor Padrão' },
        { id: 'preco_venda', label: 'Preço Venda' },
        { id: 'margem', label: 'Margem Bruta' },
        { id: 'show_comercial', label: 'Unidade comercial (PDV)' }
      ],
      subgroups: [
        {
          name: 'Custos & Markup',
          columns: [
            { id: 'preco_custo', label: 'Custo Total' },
            { id: 'valor_compra', label: 'Valor Compra' },
            { id: 'markup', label: 'Markup %' },
            { id: 'inventario_valorizado', label: 'Inventário Valorizado' }
          ]
        }
      ]
    },
    logistico: {
      name: 'Logísticos',
      icon: Truck,
      columns: [
        { id: 'estoque_atual', label: 'Estoque Atual' },
        { id: 'media_30d', label: 'Média 30d' },
        { id: 'ponto_futuro', label: 'Ponto futuro' },
        { id: 'ponto_esperado_lt', label: 'Ponto esperado (0,5× LT)' },
        { id: 'show_logistica', label: 'Unidade de exibição (sigla)' },
        { id: 'estoque_minimo', label: 'Estoque Mínimo' },
        { id: 'estoque_ideal', label: 'Estoque Ideal' },
        { id: 'estoque_maximo', label: 'Estoque Máximo' },
        { id: 'tempo_reposicao', label: 'Tempo Reposição' },
        { id: 'peso', label: 'Peso' },
        { id: 'dimensoes', label: 'Dimensões' }
      ]
    },
    sistema: {
      name: 'Sistema',
      icon: Settings,
      columns: [
        { id: 'tipo', label: 'Tipo' },
        { id: 'unidade', label: 'Unidade' },
        { id: 'unidades_pacote', label: 'Unidades/Pacote' }
      ]
    },
    performance: {
      name: 'Performance (ABCD / IEP)',
      icon: BarChart3,
      columns: [
        { id: 'abcd', label: 'Classe ABCD' },
        { id: 'iep_score', label: 'Score IEP' },
        { id: 'iep_codigo_comportamento', label: 'Código comportamento IEP' },
        { id: 'iep_score_nivel_1', label: 'Média nível 1' },
        { id: 'iep_score_nivel_2', label: 'Média nível 2' },
        { id: 'iep_score_nivel_3', label: 'Média nível 3' },
        { id: 'iep_score_nivel_4', label: 'Média nível 4' },
        { id: 'iep_score_nivel_5', label: 'Média nível 5' },
      ]
    }
  };

  const handleToggleColumn = (columnId) => {
    if (columnId === 'produto') return; // Produto sempre visível
    setTempColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(c => c !== columnId)
        : [...prev, columnId]
    );
  };

  const moveColumn = (columnId, direction) => {
    setTempColumns((prev) => {
      const index = prev.indexOf(columnId);
      if (index === -1) return prev;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const allColumns = Object.values(columnGroups).flatMap((group) => [
    ...(Array.isArray(group.columns) ? group.columns : []),
    ...(Array.isArray(group.subgroups)
      ? group.subgroups.flatMap((subgroup) => Array.isArray(subgroup.columns) ? subgroup.columns : [])
      : []),
  ]);
  const columnLabelById = allColumns.reduce((acc, column) => {
    acc[column.id] = column.label;
    return acc;
  }, {});
  const orderedSelectedColumns = tempColumns.filter((columnId) => columnLabelById[columnId]);

  const handleSave = () => {
    onColumnsChange(tempColumns);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-background dark:text-foreground dark:border-border/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Columns className="w-5 h-5 text-muted-foreground" />
            Selecionar Colunas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">

          {orderedSelectedColumns.length > 0 && (
            <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Columns className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                <Label className="text-sm font-medium text-foreground">Ordem das colunas</Label>
              </div>
              <div className="space-y-1.5">
                {orderedSelectedColumns.map((columnId, index) => (
                  <div key={columnId} className="flex items-center gap-2 p-2 bg-card rounded border border-indigo-100 dark:border-indigo-900/40">
                    <span className="w-5 text-[10px] font-mono text-muted-foreground">{index + 1}</span>
                    <span className="flex-1 min-w-0 truncate text-sm text-foreground/90">{columnLabelById[columnId]}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => moveColumn(columnId, -1)}
                      className="h-7 w-7 disabled:opacity-30"
                      title="Mover para a esquerda"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === orderedSelectedColumns.length - 1}
                      onClick={() => moveColumn(columnId, 1)}
                      className="h-7 w-7 disabled:opacity-30"
                      title="Mover para a direita"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">A ordem de cima para baixo vira esquerda para direita na tabela.</p>
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium text-foreground">Coluna Fixa</Label>
            </div>
            <div className="flex items-center gap-2 p-2 bg-card dark:bg-muted rounded">
              <Checkbox checked={true} disabled className="dark:border-border/40" />
              <Label className="text-sm text-muted-foreground">Produto (sempre visível)</Label>
            </div>
          </div>

          {Object.entries(columnGroups).map(([groupKey, group]) => {
            const Icon = group.icon;
            const allMainColumns = Array.isArray(group.columns) ? group.columns.map(c => c.id) : [];
            const allSubColumns = Array.isArray(group.subgroups) 
              ? group.subgroups.flatMap(sg => Array.isArray(sg.columns) ? sg.columns.map(c => c.id) : []) 
              : [];
            const allColumns = [...allMainColumns, ...allSubColumns];
            const allSelected = allColumns.every(col => tempColumns.includes(col));
            
            return (
              <div key={groupKey} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm font-medium text-foreground">{group.name}</Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (allSelected) {
                        setTempColumns(prev => prev.filter(c => !allColumns.includes(c)));
                      } else {
                        setTempColumns(prev => [...new Set([...prev, ...allColumns])]);
                      }
                    }}
                    className={cn('h-7 text-xs hover:bg-muted/60', PRODUTOS_DROPDOWN_ITEM)}
                  >
                    {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
                  </Button>
                </div>
                
                {/* Colunas principais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {Array.isArray(group.columns) && group.columns.map(column => (
                    <div
                      key={column.id}
                      className="flex items-center gap-2 p-2 bg-card dark:bg-muted rounded hover:bg-muted dark:hover:bg-muted cursor-pointer"
                      onClick={() => handleToggleColumn(column.id)}
                    >
                      <Checkbox
                        checked={tempColumns.includes(column.id)}
                        onCheckedChange={() => handleToggleColumn(column.id)}
                        className="dark:border-border/40"
                      />
                      <Label className="text-sm cursor-pointer text-foreground/90">{column.label}</Label>
                    </div>
                  ))}
                </div>

                {/* Subgrupos */}
                {Array.isArray(group.subgroups) && group.subgroups.map((subgroup, idx) => (
                  <div key={idx} className="mt-3 pt-3 border-t border-border/40">
                    <div className="text-xs font-medium text-muted-foreground mb-2">{subgroup.name}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Array.isArray(subgroup.columns) && subgroup.columns.map(column => (
                        <div
                          key={column.id}
                          className="flex items-center gap-2 p-2 bg-card dark:bg-muted rounded hover:bg-muted dark:hover:bg-muted cursor-pointer"
                          onClick={() => handleToggleColumn(column.id)}
                        >
                          <Checkbox
                            checked={tempColumns.includes(column.id)}
                            onCheckedChange={() => handleToggleColumn(column.id)}
                            className="dark:border-border/40"
                          />
                          <Label className="text-sm cursor-pointer text-foreground/90">{column.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTempColumns([...DEFAULT_CATALOG_PRODUTO_COLUMNS])}
            className="dark:text-foreground/90 dark:hover:bg-muted"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Resetar padrão
          </Button>
          <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className={cn('hover:bg-muted/60 dark:hover:bg-muted', PRODUTOS_DROPDOWN_ITEM)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className={cn(P38_CHIP_ACTIVE, 'hover:opacity-90')}
          >
            Aplicar
          </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}