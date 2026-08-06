import React, { useState, useMemo, useRef } from 'react';
import { ChevronRight, ChevronDown, Package, MoreHorizontal, Edit, Copy, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { P38Paginator } from '@/components/ui/p38-paginator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import CamposEdicaoSistema from './CamposEdicaoSistema';
import { formatEstoqueApresentacao } from '@/lib/productUnits';

const PAGE_SIZE = 50; // produtos por página

const formatarNumero = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '0,00';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getStockDot = (produto) => {
  if (!produto.ativo) return 'bg-muted-foreground/40';
  const e = produto.estoque_atual || 0;
  const m = produto.estoque_minimo || 0;
  if (e <= 0 || e <= m / 2) return 'bg-red-500';
  if (e <= m) return 'bg-orange-400';
  return 'bg-green-500';
};

function GroupRow({ label, count, valorEstoque, abaixoMin, estoqueTotal, depth, expanded, onToggle }) {
  const indent = depth * 16;
  return (
    <tr
      className="cursor-pointer select-none hover:bg-muted/40 dark:hover:bg-muted/40 border-b border-border/40"
      onClick={onToggle}
    >
      <td className="p-0 w-8 sticky left-0 z-10 bg-card" />
      <td
        className="py-2 pr-3"
        style={{ paddingLeft: 12 + indent }}
        colSpan={3}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          <span className="text-xs font-semibold text-foreground/90 uppercase tracking-wide">{label}</span>
          <span className="text-[10px] text-muted-foreground">{count} SKU{count !== 1 ? 's' : ''}</span>
          {/* Estoque somado — visível no mobile também */}
          {estoqueTotal > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              ∑ {formatarNumero(estoqueTotal)}
            </span>
          )}
          {abaixoMin > 0 && (
            <span className="text-[10px] text-red-500 dark:text-red-400">{abaixoMin} abaixo mín.</span>
          )}
        </div>
      </td>
      <td className="py-2 px-3 text-right text-[10px] text-muted-foreground hidden md:table-cell">
        R$ {formatarNumero(valorEstoque)}
      </td>
      <td className="py-2 px-3 text-right text-[10px] hidden md:table-cell">
        {abaixoMin > 0 ? (
          <span className="text-red-500 dark:text-red-400">{abaixoMin} abaixo mín.</span>
        ) : (
          <span className="text-muted-foreground dark:text-muted-foreground">—</span>
        )}
      </td>
      <td colSpan={99} />
    </tr>
  );
}

function ProdutoRow({ produto, visibleColumns, fornecedorMap, onEdit, depth, onEditInline }) {
  const indent = depth * 16;
  const margem = produto.preco_venda_padrao > 0
    ? ((produto.preco_venda_padrao - (produto.preco_custo_calculado || 0)) / produto.preco_venda_padrao) * 100
    : 0;
  
  const [editingField, setEditingField] = useState(null);
  const estoqueApresent = formatEstoqueApresentacao(produto);
  const estoqueExibicao = estoqueApresent ? estoqueApresent.quantidade : produto.estoque_atual;
  const unidadeExibicao = estoqueApresent ? estoqueApresent.sigla : (produto.unidade_principal || 'UN');

  return (
    <tr className="hover:bg-muted/40 dark:hover:bg-muted/30 border-b border-border/30 dark:border-border/40/60 group">
      {/* Ações */}
      <td className="p-1 w-8 sticky left-0 z-10 bg-card">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="dark:bg-muted dark:border-border/40 z-50">
            <DropdownMenuItem onClick={() => onEdit(produto)} className="dark:text-foreground dark:hover:bg-primary/90 text-xs">
              <Edit className="mr-2 h-3.5 w-3.5" />Editar
            </DropdownMenuItem>
            <DropdownMenuItem className="dark:text-foreground dark:hover:bg-primary/90 text-xs">
              <Copy className="mr-2 h-3.5 w-3.5" />Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 dark:text-red-400 dark:hover:bg-primary/90 text-xs">
              <Archive className="mr-2 h-3.5 w-3.5" />Inativar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>

      {/* Imagem */}
      <td className="p-1 w-10">
        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center overflow-hidden mx-auto">
          {produto.imagem_url
            ? <img src={produto.imagem_url} alt="" className="w-full h-full object-cover" />
            : <Package className="w-3.5 h-3.5 text-muted-foreground dark:text-muted-foreground" />
          }
        </div>
      </td>

      {/* Nome */}
      <td className="py-2 pr-3" style={{ paddingLeft: 12 + indent }}>
        <div
          className="text-xs font-medium text-foreground/90 uppercase leading-tight cursor-pointer hover:text-foreground dark:hover:text-white"
          onClick={() => onEdit(produto)}
        >
          {produto.nome || [produto.campo_hierarquico_1, produto.campo_hierarquico_2, produto.campo_hierarquico_3, produto.campo_hierarquico_4, produto.campo_hierarquico_5].filter(Boolean).join(' | ')}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {produto.codigo_interno && <span className="mr-2">{produto.codigo_interno}</span>}
          {produto.marca && <span className="italic">{produto.marca}</span>}
        </div>
      </td>

      {/* Status */}
      {visibleColumns.includes('status') && (
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${getStockDot(produto)}`} />
            <span className="text-[10px] text-muted-foreground">
              {!produto.ativo ? 'Inativo' : produto.estoque_atual <= 0 ? 'Crítico' : produto.estoque_atual <= produto.estoque_minimo ? 'Baixo' : 'OK'}
            </span>
          </div>
        </td>
      )}

      {/* Fornecedor */}
      {visibleColumns.includes('fornecedor') && (
        <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
          {fornecedorMap[produto.fornecedor_padrao_id] || <span className="text-muted-foreground">—</span>}
        </td>
      )}

      {/* Preço Venda */}
      {visibleColumns.includes('preco_venda') && (
        <td className="px-3 py-2 text-right text-xs text-foreground/90 hidden md:table-cell">
          R$ {formatarNumero(produto.preco_venda_padrao)}
        </td>
      )}

      {/* Margem */}
      {visibleColumns.includes('margem') && (
        <td className="px-3 py-2 text-right text-xs hidden md:table-cell">
          <span className={margem < 15 ? 'text-red-500 dark:text-red-400' : margem < 25 ? 'text-orange-500 dark:text-orange-400' : 'p38-text-accent font-medium'}>
            {formatarNumero(margem)}%
          </span>
        </td>
      )}

      {/* Estoque */}
      {visibleColumns.includes('estoque_atual') && (
        <td className="px-3 py-2 text-right text-xs text-muted-foreground hidden md:table-cell">
          {formatarNumero(estoqueExibicao)} <span className="text-muted-foreground text-[10px]">{unidadeExibicao}</span>
        </td>
      )}

      {/* Outros campos extras */}
      {visibleColumns.includes('preco_custo') && (
        <td className="px-3 py-2 text-right text-xs text-muted-foreground hidden md:table-cell">
          R$ {formatarNumero(produto.preco_custo_calculado)}
        </td>
      )}
      {visibleColumns.includes('markup') && (
        <td className="px-3 py-2 text-right text-xs text-muted-foreground hidden md:table-cell">
          {formatarNumero(produto.preco_venda_percentual || 0)}%
        </td>
      )}
      {visibleColumns.includes('categoria') && (
        <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
          {produto.categoria_nome || '—'}
        </td>
      )}
      {visibleColumns.includes('estoque_minimo') && (
        <td className="px-3 py-2 text-right text-xs text-muted-foreground hidden md:table-cell cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => setEditingField('estoque_minimo')}>
          {editingField === 'estoque_minimo' ? (
            <CamposEdicaoSistema
              produto={produto}
              campo="estoque_minimo"
              valor={produto.estoque_minimo}
              onSave={async (field, value) => {
                try {
                  await onEditInline(produto.id, field, value);
                  setEditingField(null);
                  toast.success('Campo atualizado!');
                } catch {
                  toast.error('Erro ao atualizar');
                }
              }}
              onCancel={() => setEditingField(null)}
            />
          ) : (
            <span>{formatarNumero(produto.estoque_minimo)}</span>
          )}
        </td>
      )}

      {/* Campos de Sistema (Casas Decimais, Tempo Reposição, Estoque, etc) */}
      {visibleColumns.includes('sistema_casas_decimais') && (
        <td className="px-3 py-2 text-center text-xs text-muted-foreground hidden md:table-cell cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => setEditingField('casas_decimais')}>
          {editingField === 'casas_decimais' ? (
            <CamposEdicaoSistema
              produto={produto}
              campo="casas_decimais"
              valor={produto.casas_decimais || 0}
              onSave={async (field, value) => {
                try {
                  await onEditInline(produto.id, field, value);
                  setEditingField(null);
                  toast.success('Casas decimais atualizado!');
                } catch {
                  toast.error('Erro ao atualizar');
                }
              }}
              onCancel={() => setEditingField(null)}
            />
          ) : (
            <span>{produto.casas_decimais || 0}</span>
          )}
        </td>
      )}

      {visibleColumns.includes('sistema_tempo_reposicao') && (
        <td className="px-3 py-2 text-center text-xs text-muted-foreground hidden md:table-cell cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => setEditingField('tempo_reposicao_dias')}>
          {editingField === 'tempo_reposicao_dias' ? (
            <CamposEdicaoSistema
              produto={produto}
              campo="tempo_reposicao_dias"
              valor={produto.tempo_reposicao_dias || 0}
              onSave={async (field, value) => {
                try {
                  await onEditInline(produto.id, field, value);
                  setEditingField(null);
                  toast.success('Tempo de reposição atualizado!');
                } catch {
                  toast.error('Erro ao atualizar');
                }
              }}
              onCancel={() => setEditingField(null)}
            />
          ) : (
            <span>{produto.tempo_reposicao_dias || 0}</span>
          )}
        </td>
      )}

      {visibleColumns.includes('sistema_estoque_ideal') && (
        <td className="px-3 py-2 text-right text-xs text-muted-foreground hidden md:table-cell cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => setEditingField('estoque_ideal')}>
          {editingField === 'estoque_ideal' ? (
            <CamposEdicaoSistema
              produto={produto}
              campo="estoque_ideal"
              valor={produto.estoque_ideal || 0}
              onSave={async (field, value) => {
                try {
                  await onEditInline(produto.id, field, value);
                  setEditingField(null);
                  toast.success('Estoque ideal atualizado!');
                } catch {
                  toast.error('Erro ao atualizar');
                }
              }}
              onCancel={() => setEditingField(null)}
            />
          ) : (
            <span>{formatarNumero(produto.estoque_ideal || 0)}</span>
          )}
        </td>
      )}

      {visibleColumns.includes('sistema_estoque_maximo') && (
        <td className="px-3 py-2 text-right text-xs text-muted-foreground hidden md:table-cell cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => setEditingField('estoque_maximo')}>
          {editingField === 'estoque_maximo' ? (
            <CamposEdicaoSistema
              produto={produto}
              campo="estoque_maximo"
              valor={produto.estoque_maximo || 0}
              onSave={async (field, value) => {
                try {
                  await onEditInline(produto.id, field, value);
                  setEditingField(null);
                  toast.success('Estoque máximo atualizado!');
                } catch {
                  toast.error('Erro ao atualizar');
                }
              }}
              onCancel={() => setEditingField(null)}
            />
          ) : (
            <span>{formatarNumero(produto.estoque_maximo || 0)}</span>
          )}
        </td>
      )}
      </tr>
      );
      }

function buildTree(produtos) {
  const root = {};
  produtos.forEach(p => {
    const niveis = [
      p.campo_hierarquico_1,
      p.campo_hierarquico_2,
      p.campo_hierarquico_3,
      p.campo_hierarquico_4,
      p.campo_hierarquico_5,
    ].filter(Boolean);

    const l1 = niveis[0] || '(Sem Categoria)';
    if (!root[l1]) root[l1] = { children: {}, items: [] };

    if (niveis.length <= 2) {
      // Cai direto no L1, sem subgrupo
      root[l1].items.push(p);
    } else {
      // Agrupa por L2, produto cai no L2
      const l2 = niveis[1];
      if (!root[l1].children[l2]) root[l1].children[l2] = { items: [] };
      root[l1].children[l2].items.push(p);
    }
  });
  return root;
}

export default function TabelaDinamica({ produtos, visibleColumns, fornecedorMap, onEdit }) {
  const [expanded, setExpanded] = useState({});
  const [page, setPage] = useState(0);

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const handleEditInline = async (produtoId, field, value) => {
    await base44.entities.Produto.update(produtoId, { [field]: value });
  };

  // Paginação: fatia os produtos antes de construir a árvore
  const totalPages = Math.ceil(produtos.length / PAGE_SIZE);
  const produtosPaginados = useMemo(() => {
    const start = page * PAGE_SIZE;
    return produtos.slice(start, start + PAGE_SIZE);
  }, [produtos, page]);

  // Reset página quando lista muda
  const prevProdutosLength = React.useRef(produtos.length);
  if (prevProdutosLength.current !== produtos.length) {
    prevProdutosLength.current = produtos.length;
    if (page !== 0) setPage(0);
  }

  const tree = useMemo(() => buildTree(produtosPaginados), [produtosPaginados]);

  const cols = ['status', 'fornecedor', 'preco_venda', 'margem', 'estoque_atual', 'preco_custo', 'markup', 'categoria', 'estoque_minimo'];
  const activeCols = cols.filter(c => visibleColumns.includes(c));

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden bg-card">
      <div className="overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-muted/50 sticky top-0 z-20">
            <tr>
              <th className="w-8 p-1 sticky left-0 z-30 bg-muted/50" />
              <th className="w-10 p-1 text-[10px] text-muted-foreground uppercase text-center">Img</th>
              <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold min-w-[220px]">Produto</th>
              {visibleColumns.includes('status') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold min-w-[80px]">Status</th>}
              {visibleColumns.includes('fornecedor') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold min-w-[130px] hidden md:table-cell">Fornecedor</th>}
              {visibleColumns.includes('preco_venda') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold text-right min-w-[100px] hidden md:table-cell">Preço Venda</th>}
              {visibleColumns.includes('margem') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold text-right min-w-[80px] hidden md:table-cell">Margem</th>}
              {visibleColumns.includes('estoque_atual') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold text-right min-w-[90px] hidden md:table-cell">Estoque</th>}
              {visibleColumns.includes('preco_custo') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold text-right min-w-[100px] hidden md:table-cell">Custo Total</th>}
              {visibleColumns.includes('markup') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold text-right min-w-[80px] hidden md:table-cell">Markup</th>}
              {visibleColumns.includes('categoria') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold min-w-[120px] hidden md:table-cell">Categoria</th>}
              {visibleColumns.includes('estoque_minimo') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold text-right min-w-[80px] hidden md:table-cell">Est. Mín.</th>}
              {visibleColumns.includes('sistema_casas_decimais') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold text-center min-w-[70px] hidden md:table-cell">Casas</th>}
              {visibleColumns.includes('sistema_tempo_reposicao') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold text-center min-w-[70px] hidden md:table-cell">Repos (d)</th>}
              {visibleColumns.includes('sistema_estoque_ideal') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold text-right min-w-[80px] hidden md:table-cell">Est. Ideal</th>}
              {visibleColumns.includes('sistema_estoque_maximo') && <th className="py-2 px-3 text-[10px] text-muted-foreground uppercase font-semibold text-right min-w-[80px] hidden md:table-cell">Est. Máx.</th>}
            </tr>
          </thead>
          <tbody>
            {Object.entries(tree).map(([l1Key, l1Node]) => {
              const l1Expanded = expanded[l1Key] !== false; // aberto por padrão
              const allL1Items = [
                ...l1Node.items,
                ...Object.values(l1Node.children).flatMap(c => c.items)
              ];
              const l1ValorEstoque = allL1Items.reduce((s, p) => s + Math.max(0, p.estoque_atual || 0) * (p.preco_custo_calculado || 0), 0);
              const l1AbaixoMin = allL1Items.filter(p => p.ativo && p.estoque_atual <= p.estoque_minimo).length;
              const l1EstoqueTotal = allL1Items.reduce((s, p) => s + (p.estoque_atual || 0), 0);
              const hasChildren = Object.keys(l1Node.children).length > 0;

              return (
                <React.Fragment key={l1Key}>
                  <GroupRow
                    label={l1Key}
                    count={allL1Items.length}
                    valorEstoque={l1ValorEstoque}
                    abaixoMin={l1AbaixoMin}
                    estoqueTotal={l1EstoqueTotal}
                    depth={0}
                    expanded={l1Expanded}
                    onToggle={() => toggle(l1Key)}
                  />

                  {l1Expanded && (
                    <>
                      {/* Itens diretos no nível 1 (sem subtipo) */}
                      {l1Node.items.map(p => (
                        <ProdutoRow
                          key={p.id}
                          produto={p}
                          visibleColumns={visibleColumns}
                          fornecedorMap={fornecedorMap}
                          onEdit={onEdit}
                          onEditInline={handleEditInline}
                          depth={1}
                        />
                      ))}

                      {/* Subgrupos nível 2 */}
                      {Object.entries(l1Node.children).map(([l2Key, l2Node]) => {
                        const l2FullKey = `${l1Key}::${l2Key}`;
                        const l2Expanded = expanded[l2FullKey] !== false;
                        const l2ValorEstoque = l2Node.items.reduce((s, p) => s + Math.max(0, p.estoque_atual || 0) * (p.preco_custo_calculado || 0), 0);
                        const l2AbaixoMin = l2Node.items.filter(p => p.ativo && p.estoque_atual <= p.estoque_minimo).length;
                        const l2EstoqueTotal = l2Node.items.reduce((s, p) => s + (p.estoque_atual || 0), 0);

                        return (
                          <React.Fragment key={l2FullKey}>
                            <GroupRow
                              label={l2Key}
                              count={l2Node.items.length}
                              valorEstoque={l2ValorEstoque}
                              abaixoMin={l2AbaixoMin}
                              estoqueTotal={l2EstoqueTotal}
                              depth={1}
                              expanded={l2Expanded}
                              onToggle={() => toggle(l2FullKey)}
                            />
                            {l2Expanded && l2Node.items.map(p => (
                               <ProdutoRow
                                 key={p.id}
                                 produto={p}
                                 visibleColumns={visibleColumns}
                                 fornecedorMap={fornecedorMap}
                                 onEdit={onEdit}
                                 onEditInline={handleEditInline}
                                 depth={2}
                               />
                             ))}
                          </React.Fragment>
                        );
                      })}
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {produtos.length === 0 && (
          <div className="py-16 text-center">
            <Package className="w-8 h-8 text-muted-foreground dark:text-foreground/90 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Nenhum produto encontrado</p>
          </div>
        )}
      </div>

      <P38Paginator
        page={page}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        totalItems={produtos.length}
        onPageChange={setPage}
        itemLabel="produtos"
      />
    </div>
  );
}