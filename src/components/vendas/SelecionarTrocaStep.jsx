import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { P38MobileLine, P38MobileLineList, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { Camera, Search, ShoppingBag, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import QuantidadeFracionadaInput from '@/components/vendas/QuantidadeFracionadaInput';
import ProductUnitSelectorDialog from '@/components/produtos/ProductUnitSelectorDialog';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import { formatQuantidadeDisplay, resolveQuantidadeStep, roundQuantidade } from '@/lib/parseQuantidadeInput';
import { buildSaleUnitOptions, calculateBaseQuantity } from '@/lib/productUnits';
import {
  calcularCreditoDevolucaoTabela,
  calcularLinhaCreditoTabela,
  calcularPrecoUnitarioCredito,
  formatValorBRL,
  getQuantidadeBaseMaxItem,
  maxQuantidadeNaUnidade,
  pedidoItemKey,
  resolveUnidadeDevolucaoInicial,
} from '@/lib/creditoDevolucaoTroca';

function precoVendaProdutoTabela(produto, priceMultiplier = 1) {
  const mult = Number(priceMultiplier) || 1;
  return (Number(produto?.preco_venda_padrao) || 0) * mult;
}

function totalSubstituto(sub) {
  const qtd = Number(sub.quantidade) || 0;
  const preco = Number(sub.preco_unitario) || 0;
  return qtd * preco;
}

export default function SelecionarTrocaStep({ pedido, onConfirm }) {
  const [qtds, setQtds] = useState(
    Object.fromEntries((pedido.itens || []).map((i) => [pedidoItemKey(i), 0]))
  );
  const [unidadesDevolucao, setUnidadesDevolucao] = useState({});
  const [substitutos, setSubstitutos] = useState([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtos, setProdutos] = useState([]);
  const [tabelaPreco, setTabelaPreco] = useState(null);
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const [motivo, setMotivo] = useState('');
  const [fotos, setFotos] = useState([]);
  const [uploadingFotos, setUploadingFotos] = useState(false);
  const [unitSelector, setUnitSelector] = useState({
    open: false,
    mode: null,
    product: null,
    itemKey: null,
    substitutoId: null,
  });
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const priceMultiplier = tabelaPreco?.fator_ajuste || 1;

  const produtosMap = useMemo(
    () => Object.fromEntries((produtos || []).map((p) => [p.id, p])),
    [produtos]
  );

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const lista = await base44.entities.Produto.list();
        if (ativo) setProdutos(lista || []);
      } catch {
        if (ativo) toast({ title: 'Erro ao carregar produtos', variant: 'destructive' });
      } finally {
        if (ativo) setCarregandoProdutos(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [toast]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        let tabela = null;
        if (pedido?.tabela_preco_id) {
          tabela = await base44.entities.TabelaPreco.get(pedido.tabela_preco_id);
        }
        if (!tabela) {
          const defaults = await base44.entities.TabelaPreco.filter({ ativo: true, is_default: true });
          tabela = defaults?.[0] || null;
        }
        if (ativo) setTabelaPreco(tabela);
      } catch {
        if (ativo) setTabelaPreco(null);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [pedido?.tabela_preco_id]);

  const unidadesDevolucaoIniciais = useMemo(() => {
    const map = {};
    for (const item of pedido.itens || []) {
      const key = pedidoItemKey(item);
      const produto = produtosMap[item.produto_id];
      map[key] = resolveUnidadeDevolucaoInicial(item, produto, priceMultiplier);
    }
    return map;
  }, [pedido.itens, produtosMap, priceMultiplier]);

  useEffect(() => {
    setUnidadesDevolucao(unidadesDevolucaoIniciais);
  }, [unidadesDevolucaoIniciais]);

  const creditoDevolucao = useMemo(
    () => calcularCreditoDevolucaoTabela(pedido, qtds, unidadesDevolucao),
    [pedido, qtds, unidadesDevolucao]
  );

  const valorSubstitutos = useMemo(
    () => substitutos.reduce((sum, s) => sum + totalSubstituto(s), 0),
    [substitutos]
  );

  const saldoLiquido = creditoDevolucao - valorSubstitutos;
  const saldoVale = Math.max(0, saldoLiquido);
  const diferencaPagar = Math.max(0, -saldoLiquido);

  const itensSelecionados = (pedido.itens || []).filter((item) => (qtds[pedidoItemKey(item)] || 0) > 0);

  const produtosBusca = useMemo(() => {
    if (!buscaProduto.trim()) return [];
    return filterAndSortProducts(produtos, buscaProduto, { limit: 12 });
  }, [buscaProduto, produtos]);

  const aplicarUnidadeDevolucao = (itemKey, unitOption) => {
    if (!itemKey || !unitOption) return;
    setUnidadesDevolucao((prev) => ({ ...prev, [itemKey]: unitOption }));
    const item = (pedido.itens || []).find((i) => pedidoItemKey(i) === itemKey);
    if (!item) return;
    const maxQtd = maxQuantidadeNaUnidade(getQuantidadeBaseMaxItem(item), unitOption.fator_conversao);
    setQtds((prev) => {
      const atual = prev[itemKey] || 0;
      if (atual <= maxQtd) return prev;
      return { ...prev, [itemKey]: roundQuantidade(maxQtd) };
    });
  };

  const criarSubstitutoFromProduto = (produto, unitOption) => {
    const precoTabela = Number(unitOption?.valor_unitario) || precoVendaProdutoTabela(produto, priceMultiplier);
    const step = resolveQuantidadeStep(0);
    return {
      produto_id: produto.id,
      produto_nome: produto.nome,
      quantidade: step,
      unidade_medida: unitOption?.unidade || produto.unidade_principal || 'UN',
      fator_conversao: unitOption?.fator_conversao || 1,
      preco_tabela_unitario: precoTabela,
      preco_unitario: precoTabela,
      com_desconto: false,
      total: precoTabela * step,
    };
  };

  const adicionarSubstituto = (produto) => {
    const opcoes = buildSaleUnitOptions(produto, priceMultiplier);
    const existenteIdx = substitutos.findIndex(
      (s) => s.produto_id === produto.id && s.unidade_medida === (opcoes[0]?.unidade || 'UN')
    );

    if (opcoes.length > 1) {
      setUnitSelector({
        open: true,
        mode: 'substituto',
        product: produto,
        itemKey: null,
        substitutoId: null,
      });
      setBuscaProduto('');
      return;
    }

    const novo = criarSubstitutoFromProduto(produto, opcoes[0]);
    if (existenteIdx >= 0) {
      setSubstitutos((prev) =>
        prev.map((s, idx) => {
          if (idx !== existenteIdx) return s;
          const qtd = roundQuantidade(s.quantidade + novo.quantidade);
          return { ...s, quantidade: qtd, total: totalSubstituto({ ...s, quantidade: qtd }) };
        })
      );
    } else {
      setSubstitutos((prev) => [...prev, novo]);
    }
    setBuscaProduto('');
  };

  const setQuantidadeSubstituto = (produtoId, unidadeMedida, quantidade) => {
    setSubstitutos((prev) =>
      prev
        .map((s) => {
          if (s.produto_id !== produtoId || s.unidade_medida !== unidadeMedida) return s;
          const qtd = roundQuantidade(quantidade);
          return { ...s, quantidade: qtd, total: totalSubstituto({ ...s, quantidade: qtd }) };
        })
        .filter((s) => s.quantidade > 0)
    );
  };

  const toggleDescontoSubstituto = (produtoId, unidadeMedida, ativo) => {
    setSubstitutos((prev) =>
      prev.map((s) => {
        if (s.produto_id !== produtoId || s.unidade_medida !== unidadeMedida) return s;
        const preco = ativo ? s.preco_unitario : s.preco_tabela_unitario;
        return {
          ...s,
          com_desconto: ativo,
          preco_unitario: preco,
          total: totalSubstituto({ ...s, preco_unitario: preco }),
        };
      })
    );
  };

  const setPrecoSubstituto = (produtoId, unidadeMedida, rawPreco) => {
    const preco = parseFloat(String(rawPreco).replace(',', '.'));
    if (!Number.isFinite(preco) || preco < 0) return;
    setSubstitutos((prev) =>
      prev.map((s) => {
        if (s.produto_id !== produtoId || s.unidade_medida !== unidadeMedida) return s;
        return {
          ...s,
          preco_unitario: preco,
          total: totalSubstituto({ ...s, preco_unitario: preco }),
        };
      })
    );
  };

  const handleUnitSelectorConfirm = (unitOption) => {
    if (unitSelector.mode === 'devolucao' && unitSelector.itemKey) {
      aplicarUnidadeDevolucao(unitSelector.itemKey, unitOption);
    }
    if (unitSelector.mode === 'substituto' && unitSelector.product) {
      const produto = unitSelector.product;
      const novo = criarSubstitutoFromProduto(produto, unitOption);
      const existenteIdx = substitutos.findIndex(
        (s) => s.produto_id === produto.id && s.unidade_medida === novo.unidade_medida
      );
      if (existenteIdx >= 0) {
        setSubstitutos((prev) =>
          prev.map((s, idx) => {
            if (idx !== existenteIdx) return s;
            const qtd = roundQuantidade(s.quantidade + novo.quantidade);
            return { ...s, quantidade: qtd, total: totalSubstituto({ ...s, quantidade: qtd }) };
          })
        );
      } else {
        setSubstitutos((prev) => [...prev, novo]);
      }
    }
    if (unitSelector.mode === 'substituto-edit' && unitSelector.substitutoId) {
      const { produtoId, unidadeMedida } = unitSelector.substitutoId;
      setSubstitutos((prev) =>
        prev.map((s) => {
          if (s.produto_id !== produtoId || s.unidade_medida !== unidadeMedida) return s;
          const precoTabela = Number(unitOption?.valor_unitario) || s.preco_tabela_unitario;
          const preco = s.com_desconto ? s.preco_unitario : precoTabela;
          return {
            ...s,
            unidade_medida: unitOption.unidade,
            fator_conversao: unitOption.fator_conversao || 1,
            preco_tabela_unitario: precoTabela,
            preco_unitario: preco,
            total: totalSubstituto({ ...s, preco_unitario: preco }),
          };
        })
      );
    }
    setUnitSelector({ open: false, mode: null, product: null, itemKey: null, substitutoId: null });
  };

  const handleAdicionarFotos = async (files) => {
    const novasFotos = Array.from(files).slice(0, 5 - fotos.length);
    if (novasFotos.length === 0) return;

    const previews = novasFotos.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      uploading: true,
      url: null,
    }));
    setFotos((prev) => [...prev, ...previews]);
    setUploadingFotos(true);

    const uploadadas = await Promise.all(
      novasFotos.map(async (file, idx) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return { ...previews[idx], uploading: false, url: file_url };
      })
    );

    setFotos((prev) => {
      const base = prev.slice(0, prev.length - novasFotos.length);
      return [...base, ...uploadadas];
    });
    setUploadingFotos(false);
  };

  const removerFoto = (idx) => {
    setFotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildItensDevolucaoPayload = () =>
    itensSelecionados.map((item) => {
      const key = pedidoItemKey(item);
      const qtd = qtds[key] || 0;
      const unit = unidadesDevolucao[key];
      const linha = calcularLinhaCreditoTabela(unit, qtd);
      const unitPago = calcularPrecoUnitarioCredito(item, pedido);
      return {
        item,
        key,
        qtd,
        linha,
        unitPago,
      };
    });

  const handleConfirmarClick = () => {
    if (uploadingFotos) {
      toast({ title: 'Aguarde o upload das fotos', variant: 'destructive' });
      return;
    }
    if (itensSelecionados.length === 0 || creditoDevolucao <= 0) {
      toast({ title: 'Selecione ao menos um item para trocar', variant: 'destructive' });
      return;
    }
    if (substitutos.length === 0) {
      toast({ title: 'Adicione os produtos novos da troca', variant: 'destructive' });
      return;
    }

    const fotosUrls = fotos.filter((f) => f.url).map((f) => f.url);
    const itensDevolucao = buildItensDevolucaoPayload();
    const substitutosPayload = substitutos.map((sub) => ({
      ...sub,
      quantidade_base: calculateBaseQuantity(sub.quantidade, sub.fator_conversao || 1),
      total: totalSubstituto(sub),
    }));

    onConfirm({
      itensSelecionados,
      itensDevolucao,
      qtds,
      substitutos: substitutosPayload,
      creditoDevolucao,
      valorSubstitutos,
      saldoLiquido,
      saldoVale,
      diferencaPagar,
      motivo,
      fotosUrls,
      tabela_preco_id: tabelaPreco?.id,
    });
  };

  const tabelaLabel = tabelaPreco?.nome || 'Tabela padrão';

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 pb-[calc(13rem+68px+env(safe-area-inset-bottom,0px))]">
      <div className="rounded-2xl bg-card px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-foreground">{pedido.numero}</div>
            <div className="text-sm text-muted-foreground">{pedido.cliente_nome}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Pedido</div>
            <div className="text-base font-bold text-foreground">{formatValorBRL(pedido.valor_total)}</div>
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Crédito e produtos novos usam a <strong className="text-foreground">{tabelaLabel}</strong>. Você pode
          escolher unidade de vitrine e, nos itens novos, optar por aplicar desconto.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">1. Itens que o cliente devolve</p>
        </div>
        <P38MobileLineList allViewports>
          {(pedido.itens || []).map((item, index) => {
            const key = pedidoItemKey(item);
            const qtd = qtds[key] || 0;
            const produto = produtosMap[item.produto_id];
            const unit = unidadesDevolucao[key];
            const linha = calcularLinhaCreditoTabela(unit, qtd);
            const unitPago = calcularPrecoUnitarioCredito(item, pedido);
            const maxQtd = maxQuantidadeNaUnidade(getQuantidadeBaseMaxItem(item), unit?.fator_conversao || 1);
            const temDescontoPedido = unitPago < (Number(item.preco_unitario_apresentacao) || linha.unitLista) - 0.009;
            const opcoesUnidade = buildSaleUnitOptions(produto || {}, priceMultiplier);

            return (
              <P38MobileLine
                key={key}
                striped={index % 2 === 1}
                accent={p38AccentKeyFromTone(qtd > 0 ? 'danger' : 'muted')}
                className="flex items-center gap-3 px-4 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.produto_nome}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {formatQuantidadeDisplay(item.quantidade)} {item.unidade_medida || 'UN'} no pedido
                    </span>
                    {produto && opcoesUnidade.length > 1 ? (
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() =>
                          setUnitSelector({
                            open: true,
                            mode: 'devolucao',
                            product: produto,
                            itemKey: key,
                            substitutoId: null,
                          })
                        }
                      >
                        Unidade: {unit?.unidade || item.unidade_medida || 'UN'}
                      </button>
                    ) : (
                      <span>Unidade: {unit?.unidade || item.unidade_medida || 'UN'}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Tabela: {formatValorBRL(linha.unitLista || 0)}/{unit?.unidade || 'UN'}
                    {temDescontoPedido && (
                      <span className="ml-2 text-amber-700 dark:text-amber-400">
                        (pago {formatValorBRL(unitPago)}/{item.unidade_medida || 'UN'})
                      </span>
                    )}
                  </div>
                  {qtd > 0 && (
                    <div className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                      Crédito: {formatValorBRL(linha.total)}
                    </div>
                  )}
                </div>
                <QuantidadeFracionadaInput
                  value={qtd}
                  max={maxQtd}
                  onChange={(next) => setQtds((prev) => ({ ...prev, [key]: next }))}
                />
              </P38MobileLine>
            );
          })}
        </P38MobileLineList>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">2. Produtos novos que o cliente leva</p>
        </div>
        <div className="space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              variant="search"
              placeholder="Buscar produto para a troca..."
              value={buscaProduto}
              onChange={(e) => setBuscaProduto(e.target.value)}
              className="h-12 rounded-xl border-0 bg-muted/40 pl-10 dark:bg-muted"
            />
          </div>

          {carregandoProdutos && (
            <p className="text-center text-sm text-muted-foreground">Carregando produtos...</p>
          )}

          {buscaProduto.trim() && !carregandoProdutos && (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {produtosBusca.map((produto) => {
                const opcoes = buildSaleUnitOptions(produto, priceMultiplier);
                const precoRef = opcoes[0]?.valor_unitario ?? precoVendaProdutoTabela(produto, priceMultiplier);
                return (
                  <button
                    key={produto.id}
                    type="button"
                    onClick={() => adicionarSubstituto(produto)}
                    className="flex w-full items-center gap-3 rounded-xl bg-muted/30 px-3 py-3 text-left active:bg-muted/50"
                  >
                    <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{produto.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        Estoque: {Number(produto.estoque_atual || 0).toLocaleString('pt-BR')}
                        {opcoes.length > 1 ? ' · várias unidades' : ''}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatValorBRL(precoRef)}
                    </div>
                  </button>
                );
              })}
              {produtosBusca.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado</p>
              )}
            </div>
          )}

          {substitutos.length > 0 && (
            <P38MobileLineList allViewports className="rounded-xl border border-border/60">
              {substitutos.map((sub, index) => {
                const produto = produtosMap[sub.produto_id];
                const opcoesSub = produto ? buildSaleUnitOptions(produto, priceMultiplier) : [];
                const podeTrocarUnidade = opcoesSub.length > 1;
                return (
                  <P38MobileLine
                    key={`${sub.produto_id}_${sub.unidade_medida}`}
                    striped={index % 2 === 1}
                    accent={p38AccentKeyFromTone('success')}
                    className="flex flex-col gap-2 px-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{sub.produto_nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {sub.com_desconto ? (
                            <>
                              <span className="line-through">{formatValorBRL(sub.preco_tabela_unitario)}</span>{' '}
                              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                {formatValorBRL(sub.preco_unitario)}
                              </span>
                            </>
                          ) : (
                            formatValorBRL(sub.preco_unitario)
                          )}
                          /{sub.unidade_medida} · Total {formatValorBRL(totalSubstituto(sub))}
                        </div>
                        {podeTrocarUnidade && (
                          <button
                            type="button"
                            className="mt-1 text-xs font-medium text-primary hover:underline"
                            onClick={() =>
                              setUnitSelector({
                                open: true,
                                mode: 'substituto-edit',
                                product: produto,
                                itemKey: null,
                                substitutoId: {
                                  produtoId: sub.produto_id,
                                  unidadeMedida: sub.unidade_medida,
                                },
                              })
                            }
                          >
                            Unidade: {sub.unidade_medida}
                          </button>
                        )}
                      </div>
                      <QuantidadeFracionadaInput
                        value={sub.quantidade}
                        onChange={(next) =>
                          setQuantidadeSubstituto(sub.produto_id, sub.unidade_medida, next)
                        }
                        activeClassName="text-emerald-700 dark:text-emerald-400"
                        buttonClassName="h-9 w-9 rounded-lg"
                        inputClassName="w-14 text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pl-0.5">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch
                          checked={sub.com_desconto}
                          onCheckedChange={(c) =>
                            toggleDescontoSubstituto(sub.produto_id, sub.unidade_medida, !!c)
                          }
                        />
                        Desconto no item
                      </label>
                      {sub.com_desconto && (
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-9 w-28 rounded-lg border-0 bg-muted/40 text-sm"
                          value={String(sub.preco_unitario)}
                          onChange={(e) =>
                            setPrecoSubstituto(sub.produto_id, sub.unidade_medida, e.target.value)
                          }
                        />
                      )}
                    </div>
                  </P38MobileLine>
                );
              })}
            </P38MobileLineList>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-card px-4 py-4 shadow-sm space-y-3">
        <p className="text-sm font-medium text-foreground">3. Resumo da troca</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Crédito da devolução</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {formatValorBRL(creditoDevolucao)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Novos produtos</span>
            <span className="font-semibold text-foreground">− {formatValorBRL(valorSubstitutos)}</span>
          </div>
          <div className="border-t border-dashed border-border/60 pt-2 flex justify-between items-center">
            <span className="font-medium text-foreground">Saldo</span>
            <span
              className={`text-lg font-bold font-glacial ${
                saldoLiquido >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {formatValorBRL(saldoLiquido)}
            </span>
          </div>
        </div>

        {saldoVale > 0 && (
          <div className="rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
            Será gerado um <strong>vale troca</strong> de {formatValorBRL(saldoVale)} para o cliente usar depois.
          </div>
        )}

        {diferencaPagar > 0 && (
          <div className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            O cliente deve pagar <strong>{formatValorBRL(diferencaPagar)}</strong> no caixa (troca no balcão).
          </div>
        )}

        {saldoLiquido === 0 && substitutos.length > 0 && creditoDevolucao > 0 && (
          <div className="rounded-xl bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
            Troca fechada — crédito e novos produtos ficaram no mesmo valor.
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-card px-4 py-5 shadow-sm space-y-4">
        <div>
          <label className="mb-2 block text-sm text-muted-foreground">Motivo</label>
          <Input
            placeholder="Ex: Tamanho errado, defeito, preferiu outro modelo..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="h-12 rounded-xl border-0 bg-muted/40 text-sm dark:bg-muted"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-card px-4 py-5 shadow-sm">
        <label className="mb-3 block text-sm text-muted-foreground">Fotos da mercadoria (opcional)</label>
        <div className="flex flex-wrap gap-3">
          {fotos.map((foto, idx) => (
            <div key={idx} className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
              <img src={foto.previewUrl} alt="" className="h-full w-full object-cover" />
              {foto.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )}
              {!foto.uploading && (
                <button
                  type="button"
                  onClick={() => removerFoto(idx)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              )}
            </div>
          ))}
          {fotos.length < 5 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border/40 text-muted-foreground"
            >
              <Camera className="h-5 w-5" />
              <span className="text-xs">Foto</span>
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(e) => handleAdicionarFotos(e.target.files)}
          className="hidden"
        />
      </div>

      <div className="fixed left-0 right-0 z-[55] space-y-3 border-t border-border/40 bg-card p-4 p38-bottom-dock dark:border-border/40 dark:bg-background">
        <Button
          disabled={
            itensSelecionados.length === 0 ||
            creditoDevolucao <= 0 ||
            substitutos.length === 0 ||
            valorSubstitutos <= 0
          }
          onClick={handleConfirmarClick}
          className="mx-auto block h-14 w-full max-w-lg rounded-2xl bg-primary text-base font-semibold text-primary-foreground dark:bg-card dark:text-foreground"
        >
          Confirmar troca
          {saldoVale > 0 ? ` · Vale ${formatValorBRL(saldoVale)}` : ''}
        </Button>
      </div>

      <ProductUnitSelectorDialog
        open={unitSelector.open}
        product={unitSelector.product}
        priceMultiplier={priceMultiplier}
        onClose={() =>
          setUnitSelector({ open: false, mode: null, product: null, itemKey: null, substitutoId: null })
        }
        onConfirm={handleUnitSelectorConfirm}
      />
    </div>
  );
}
