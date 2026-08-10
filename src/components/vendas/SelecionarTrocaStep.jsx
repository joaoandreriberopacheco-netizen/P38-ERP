import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { P38MobileLine, P38MobileLineList, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { Camera, Minus, Plus, Search, ShoppingBag, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import {
  calcularCreditoDevolucao,
  calcularLinhaCreditoDevolucao,
  calcularPrecoUnitarioCredito,
  formatValorBRL,
  pedidoItemKey,
} from '@/lib/creditoDevolucaoTroca';

function precoVendaProduto(produto) {
  return Number(produto?.preco_venda_padrao) || 0;
}

export default function SelecionarTrocaStep({ pedido, onConfirm }) {
  const [qtds, setQtds] = useState(
    Object.fromEntries((pedido.itens || []).map((i) => [pedidoItemKey(i), 0]))
  );
  const [focusedKey, setFocusedKey] = useState(null);
  const [substitutos, setSubstitutos] = useState([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtos, setProdutos] = useState([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const [motivo, setMotivo] = useState('');
  const [fotos, setFotos] = useState([]);
  const [uploadingFotos, setUploadingFotos] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

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

  const creditoDevolucao = useMemo(
    () => calcularCreditoDevolucao(pedido, qtds),
    [pedido, qtds]
  );

  const valorSubstitutos = useMemo(
    () => substitutos.reduce((sum, s) => sum + (Number(s.total) || 0), 0),
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

  const pedidoTeveDesconto =
    Number(pedido?.valor_desconto) > 0 ||
    (pedido.itens || []).some((i) => Number(i.desconto_unitario) > 0);

  const adicionarSubstituto = (produto) => {
    const preco = precoVendaProduto(produto);
    setSubstitutos((prev) => {
      const existente = prev.find((s) => s.produto_id === produto.id);
      if (existente) {
        return prev.map((s) =>
          s.produto_id === produto.id
            ? {
                ...s,
                quantidade: s.quantidade + 1,
                total: (s.quantidade + 1) * s.preco_unitario,
              }
            : s
        );
      }
      return [
        ...prev,
        {
          produto_id: produto.id,
          produto_nome: produto.nome,
          quantidade: 1,
          preco_unitario: preco,
          total: preco,
        },
      ];
    });
    setBuscaProduto('');
  };

  const alterarQtdSubstituto = (produtoId, delta) => {
    setSubstitutos((prev) =>
      prev
        .map((s) => {
          if (s.produto_id !== produtoId) return s;
          const qtd = Math.max(0, s.quantidade + delta);
          return { ...s, quantidade: qtd, total: qtd * s.preco_unitario };
        })
        .filter((s) => s.quantidade > 0)
    );
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
    onConfirm({
      itensSelecionados,
      qtds,
      substitutos,
      creditoDevolucao,
      valorSubstitutos,
      saldoLiquido,
      saldoVale,
      diferencaPagar,
      motivo,
      fotosUrls,
    });
  };

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
        {pedidoTeveDesconto && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            O crédito da troca usa o valor que o cliente pagou (com desconto do pedido), não só o preço de tabela.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">1. Itens que o cliente devolve</p>
        </div>
        <P38MobileLineList allViewports>
          {(pedido.itens || []).map((item, index) => {
            const key = pedidoItemKey(item);
            const qtd = qtds[key] || 0;
            const linha = calcularLinhaCreditoDevolucao(item, pedido, qtd);
            const unitCredito = calcularPrecoUnitarioCredito(item, pedido);
            const temDescontoLinha = unitCredito < linha.unitLista - 0.009;

            return (
              <P38MobileLine
                key={key}
                striped={index % 2 === 1}
                accent={p38AccentKeyFromTone(qtd > 0 ? 'danger' : 'muted')}
                className="flex items-center gap-3 px-4 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.produto_nome}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {item.quantidade}x ·{' '}
                    {temDescontoLinha ? (
                      <>
                        <span className="line-through">{formatValorBRL(linha.unitLista)}</span>{' '}
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">
                          {formatValorBRL(unitCredito)}/un
                        </span>
                      </>
                    ) : (
                      <>{formatValorBRL(linha.unitLista)}/un</>
                    )}
                  </div>
                  {qtd > 0 && (
                    <div className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                      Crédito: {formatValorBRL(linha.total)}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQtds((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) - 1) }))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary active:scale-95"
                  >
                    <Minus className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <input
                    autoComplete="off"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={item.quantidade}
                    value={focusedKey === key ? (qtd === 0 ? '' : qtd) : qtd}
                    onFocus={(e) => {
                      setFocusedKey(key);
                      e.target.select();
                    }}
                    onBlur={() => setFocusedKey(null)}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10) || 0;
                      setQtds((prev) => ({
                        ...prev,
                        [key]: Math.min(item.quantidade, Math.max(0, v)),
                      }));
                    }}
                    className={`w-14 rounded-lg border-0 bg-transparent text-center text-base font-bold tabular-nums focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:bg-blue-900/20 ${qtd > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setQtds((prev) => ({
                        ...prev,
                        [key]: Math.min(item.quantidade, (prev[key] || 0) + 1),
                      }))
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary active:scale-95"
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
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
              {produtosBusca.map((produto) => (
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
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatValorBRL(precoVendaProduto(produto))}
                  </div>
                </button>
              ))}
              {produtosBusca.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado</p>
              )}
            </div>
          )}

          {substitutos.length > 0 && (
            <P38MobileLineList allViewports className="rounded-xl border border-border/60">
              {substitutos.map((sub, index) => (
                <P38MobileLine
                  key={sub.produto_id}
                  striped={index % 2 === 1}
                  accent={p38AccentKeyFromTone('success')}
                  className="flex items-center gap-3 px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{sub.produto_nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatValorBRL(sub.preco_unitario)}/un · Total {formatValorBRL(sub.total)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => alterarQtdSubstituto(sub.produto_id, -1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold tabular-nums">{sub.quantidade}</span>
                    <button
                      type="button"
                      onClick={() => alterarQtdSubstituto(sub.produto_id, 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </P38MobileLine>
              ))}
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
    </div>
  );
}
