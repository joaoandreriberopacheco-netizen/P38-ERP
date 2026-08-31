import React, { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import TreeGrid from '@/components/produtos/treegrid/TreeGrid';
import MobileHierarquica, { CatalogoMobileScrollShell } from '@/components/produtos/MobileHierarquica';
import ProdutosCommandBar from '@/components/produtos/ProdutosCommandBar';
import ProdutosPlanaTable from '@/components/produtos/ProdutosPlanaTable';
import ColumnSelector from '@/components/produtos/ColumnSelector';
import CadastroSkuProdutoEditor from '@/components/cadastro-produto-v2/CadastroSkuProdutoEditor';
import { useDesktopContent } from '@/hooks/use-breakpoint';
import { filterProdutos } from '@/lib/filterProdutos';
import { loadCatalogProdutoColumns, saveCatalogProdutoColumns } from '@/lib/catalogProdutoColumnsStorage';

const formatarNumero = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Catálogo Novo Ecosistema — mesma UI de Produtos (TreeGrid / mobile / plana),
 * árvore pathway via pseudo h1–h4; dados Excel + enrich comercial opcional do cadastro.
 */
export default function CatalogoNovoCatalogPanel({
  catalogProdutos = [],
  portalFilters,
  salesVelocityMap = {},
  catalogStockContext = null,
  loading = false,
  onRefresh,
}) {
  const isDesktop = useDesktopContent();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState('dinamica');
  const [sortOrder, setSortOrder] = useState('az');
  const [treeLevel] = useState(4);
  const [groupTreeByCategory, setGroupTreeByCategory] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => loadCatalogProdutoColumns());
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState(null);

  const filteredProdutos = useMemo(
    () =>
      filterProdutos(catalogProdutos, portalFilters, {
        salesVelocityMap,
        catalogStockContext,
      }),
    [catalogProdutos, portalFilters, salesVelocityMap, catalogStockContext],
  );

  const handleEdit = useCallback((produto) => {
    setSelectedProduto(produto);
    setEditorOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    setEditorOpen(false);
    setSelectedProduto(null);
    queryClient.invalidateQueries({ queryKey: ['catalogo-estudo', 'produtos-ativos'] });
    await onRefresh?.();
  }, [queryClient, onRefresh]);

  const handleExpandedKeysChange = useCallback((keys) => {
    setExpandedKeys(keys);
  }, []);

  if (loading && !catalogProdutos.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        A carregar catálogo…
      </p>
    );
  }

  const commandBar = (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2">
      <ProdutosCommandBar
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        viewMode={viewMode}
        setViewMode={setViewMode}
        groupTreeByCategory={groupTreeByCategory}
        onGroupTreeByCategoryChange={setGroupTreeByCategory}
      />
      <ColumnSelector
        visibleColumns={visibleColumns}
        onColumnsChange={(columns) => {
          setVisibleColumns(columns);
          saveCatalogProdutoColumns(columns);
        }}
        open={columnSelectorOpen}
        onClose={() => setColumnSelectorOpen(false)}
      />
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
        onClick={() => setColumnSelectorOpen(true)}
      >
        Colunas
      </button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-0 w-full">
      {isDesktop ? commandBar : null}

      {!isDesktop ? (
        <CatalogoMobileScrollShell>
          <MobileHierarquica
            produtos={filteredProdutos}
            onEdit={handleEdit}
            flatList={false}
            groupByCategory={false}
            masterLevel={treeLevel}
            sortOrder={sortOrder}
            onExpandedKeysChange={handleExpandedKeysChange}
            catalogFilters={portalFilters}
            salesVelocityMap={salesVelocityMap}
            catalogStockContext={catalogStockContext}
          />
        </CatalogoMobileScrollShell>
      ) : null}

      {isDesktop && viewMode === 'dinamica' ? (
        <div className="flex flex-col w-full min-h-[420px] flex-1">
          <TreeGrid
            produtos={filteredProdutos}
            onEdit={handleEdit}
            visibleColumns={visibleColumns}
            masterLevel={treeLevel}
            sortOrder={sortOrder}
            groupByCategory={groupTreeByCategory}
            onExpandedKeysChange={handleExpandedKeysChange}
            salesVelocityMap={salesVelocityMap}
            catalogStockContext={catalogStockContext}
            catalogFilters={portalFilters}
          />
        </div>
      ) : null}

      {isDesktop && viewMode === 'plana' ? (
        <ProdutosPlanaTable
          filteredProdutos={filteredProdutos}
          visibleColumns={visibleColumns}
          handleEdit={handleEdit}
          setProdutoParaExcluir={() => {}}
          formatarNumero={formatarNumero}
          fornecedorMap={{}}
          handleCreateSimilar={() => {}}
          readOnly
          salesVelocityMap={salesVelocityMap}
          catalogStockContext={catalogStockContext}
        />
      ) : null}

      {editorOpen ? (
        <CadastroSkuProdutoEditor
          produto={selectedProduto}
          onSave={handleSave}
          onClose={() => {
            setEditorOpen(false);
            setSelectedProduto(null);
          }}
        />
      ) : null}

      <p className="text-[10px] text-muted-foreground/80 text-center mt-3 px-2 leading-relaxed">
        Árvore pathway (Edificações → … → LINHA → produto compra). Comercial do cadastro quando há match por código.
      </p>
    </div>
  );
}
