import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProdutosSomentePositivosToggle from '@/components/produtos/ProdutosSomentePositivosToggle';
import ProdutosEstoqueVirtualToggle from '@/components/produtos/ProdutosEstoqueVirtualToggle';
import { isSomentePositivosFilter } from '@/lib/filterProdutos';

const STATUS_ESTOQUE = [
  { value: 'all', label: 'Qualquer estoque' },
  { value: 'ok', label: 'Estoque OK' },
  { value: 'baixo', label: 'Abaixo do mínimo' },
  { value: 'critico', label: 'Crítico / zerado' },
];

/**
 * Atalhos do catálogo no portal: busca, globo (só positivos), estoque virtual, status.
 */
export default function PortalCatalogFilters({
  filters,
  setFilters,
  filtroLinha,
  onFiltroLinhaChange,
  linhas = [],
  extra,
}) {
  const somentePositivos = isSomentePositivosFilter(filters);
  const estoqueVirtual = filters.estoqueVirtual === true;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={filters.searchTerm || ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, searchTerm: e.target.value }))}
          placeholder="Buscar SKU, código ou esquadra…"
          className="pl-8 h-9"
        />
      </div>

      <ProdutosSomentePositivosToggle filters={filters} setFilters={setFilters} />
      <ProdutosEstoqueVirtualToggle filters={filters} setFilters={setFilters} />

      <Select
        value={filters.statusEstoque || 'all'}
        onValueChange={(v) => setFilters((prev) => ({ ...prev, statusEstoque: v }))}
      >
        <SelectTrigger className="w-[160px] h-9 text-xs">
          <SelectValue placeholder="Estoque" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ESTOQUE.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {linhas.length > 0 && (
        <Select value={filtroLinha || 'all'} onValueChange={onFiltroLinhaChange}>
          <SelectTrigger className="w-[200px] h-9 text-xs">
            <SelectValue placeholder="LINHA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todas as LINHAS</SelectItem>
            {linhas.map((l) => (
              <SelectItem key={l.codigo} value={l.codigo} className="text-xs">
                {l.nome} ({l.tipo})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {extra}

      {(somentePositivos || estoqueVirtual) && (
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          {somentePositivos ? '· só positivos' : ''}
          {estoqueVirtual ? ' · estoque virtual ~' : ''}
        </span>
      )}
    </div>
  );
}
