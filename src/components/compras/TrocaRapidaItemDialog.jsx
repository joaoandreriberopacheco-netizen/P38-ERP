import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, RefreshCw, Search } from 'lucide-react';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import { calcularPreviewTrocaPedidoCompra } from '@/lib/trocaRapidaPedidoCompra';
import { formatCurrency as formatCurrencyValue } from '@/lib/financialUtils';
import { cn } from '@/lib/utils';
import { P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';
import QuantidadeFracionadaInput from '@/components/vendas/QuantidadeFracionadaInput';
import ProductUnitSelectorDialog from '@/components/produtos/ProductUnitSelectorDialog';
import {
  buildPurchaseUnitOptions,
  getItemCompraExibicaoVitrine,
  pickDefaultPurchaseUnit,
} from '@/lib/productUnits';
import { formatQuantidadeDisplay, roundQuantidade } from '@/lib/parseQuantidadeInput';

function initSubstituicaoFromItem(itemOriginal = {}, produto = null) {
  const unitOption = produto ? pickDefaultPurchaseUnit(produto) : null;
  const quantidadeComercial = roundQuantidade(Number(itemOriginal?.quantidade) || 1);
  return { quantidadeComercial, unitOption };
}

export default function TrocaRapidaItemDialog({
  open,
  onOpenChange,
  pedido,
  itemIndex,
  itemOriginal,
  products = [],
  onConfirm,
  submitting = false,
}) {
  const [busca, setBusca] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [quantidadeComercial, setQuantidadeComercial] = useState(1);
  const [unitOption, setUnitOption] = useState(null);
  const [unitSelectorOpen, setUnitSelectorOpen] = useState(false);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!open) {
      setBusca('');
      setProdutoSelecionado(null);
      setQuantidadeComercial(1);
      setUnitOption(null);
      setUnitSelectorOpen(false);
      setMotivo('');
    }
  }, [open]);

  const produtoItemOriginal = useMemo(
    () => products.find((p) => String(p.id) === String(itemOriginal?.produto_id)),
    [products, itemOriginal?.produto_id],
  );

  const exibOriginal = useMemo(
    () => getItemCompraExibicaoVitrine(itemOriginal, produtoItemOriginal),
    [itemOriginal, produtoItemOriginal],
  );

  const opcoesUnidade = useMemo(() => {
    if (!produtoSelecionado) return [];
    return buildPurchaseUnitOptions(produtoSelecionado);
  }, [produtoSelecionado]);

  const temUnidadesAlternativas = opcoesUnidade.length > 1;

  const produtosFiltrados = useMemo(() => {
    if (!busca.trim()) return [];
    return filterAndSortProducts(products, busca, { limit: 12 });
  }, [busca, products]);

  const { preview, previewErro } = useMemo(() => {
    if (!produtoSelecionado || !pedido || itemIndex < 0 || !unitOption) {
      return { preview: null, previewErro: '' };
    }
    try {
      const result = calcularPreviewTrocaPedidoCompra(pedido, itemIndex, produtoSelecionado, {
        quantidadeComercial,
        unitOption,
      });
      return { preview: result, previewErro: '' };
    } catch (error) {
      return { preview: null, previewErro: error?.message || 'Não foi possível calcular a troca.' };
    }
  }, [produtoSelecionado, pedido, itemIndex, quantidadeComercial, unitOption]);

  const formatCurrency = (value) => formatCurrencyValue(value);

  const selecionarProduto = (produto) => {
    const init = initSubstituicaoFromItem(itemOriginal, produto);
    setProdutoSelecionado(produto);
    setQuantidadeComercial(init.quantidadeComercial);
    setUnitOption(init.unitOption);
  };

  const handleConfirm = async () => {
    if (!produtoSelecionado || !preview || !unitOption) return;
    await onConfirm?.({
      itemIndex,
      produtoSubstituto: produtoSelecionado,
      substituicao: { quantidadeComercial, unitOption },
      motivo: motivo.trim(),
      preview,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Troca rápida de item
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className={cn('rounded-2xl p-4', P38_FIELD_SURFACE)}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Item atual</p>
              <p className="font-medium text-foreground">{itemOriginal?.produto_nome || 'Produto'}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {exibOriginal.quantidade_formatada} {exibOriginal.unidade_medida} × {formatCurrency(exibOriginal.preco_unitario)}
              </p>
              <p className="text-sm text-muted-foreground">
                Total da linha: {formatCurrency(itemOriginal?.total || 0)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="troca-busca-produto">Substituir por</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="troca-busca-produto"
                  data-pulse-sensor="pedido-compra.troca-rapida.busca"
                  placeholder="Buscar produto substituto..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>

            {produtoSelecionado ? (
              <div className={cn('rounded-2xl p-4 border border-[#a4ce33]/40 space-y-4', P38_FIELD_SURFACE)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Novo item</p>
                    <p className="font-medium text-foreground">{produtoSelecionado.nome}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setProdutoSelecionado(null)}>
                    Trocar
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Quantidade do substituto</Label>
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 p-3">
                    <QuantidadeFracionadaInput
                      value={quantidadeComercial}
                      onChange={setQuantidadeComercial}
                    />
                    {temUnidadesAlternativas ? (
                      <button
                        type="button"
                        data-pulse-sensor="pedido-compra.troca-rapida.unidade"
                        onClick={() => setUnitSelectorOpen(true)}
                        className="flex items-center gap-1 shrink-0"
                      >
                        <Badge className="bg-muted text-foreground/90 dark:bg-muted dark:text-foreground border-0 shadow-sm">
                          {unitOption?.unidade || 'UN'}
                        </Badge>
                        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">trocar</span>
                      </button>
                    ) : (
                      <Badge className="bg-muted text-foreground/90 dark:bg-muted dark:text-foreground border-0 shadow-sm shrink-0">
                        {unitOption?.unidade || 'UN'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ajuste livremente — pode ser 1×1, 2×1, frações como 0,66 M², etc.
                    {unitOption?.fator_conversao && Number(unitOption.fator_conversao) !== 1 ? (
                      <> Base: {formatQuantidadeDisplay(quantidadeComercial * Number(unitOption.fator_conversao))}</>
                    ) : null}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {produtosFiltrados.map((produto) => (
                  <button
                    key={produto.id}
                    type="button"
                    data-pulse-sensor="pedido-compra.troca-rapida.selecionar-produto"
                    onClick={() => selecionarProduto(produto)}
                    className={cn(
                      'w-full rounded-xl p-3 text-left transition-colors',
                      P38_FIELD_SURFACE,
                      'hover:bg-muted/60',
                    )}
                  >
                    <div className="font-medium text-foreground">{produto.nome}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {produto.codigo_interno || produto.codigo_barras || 'Sem código'}
                    </div>
                  </button>
                ))}
                {busca.trim() && produtosFiltrados.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto encontrado.</p>
                )}
              </div>
            )}

            {previewErro ? (
              <p className="text-sm text-red-600 dark:text-red-400">{previewErro}</p>
            ) : null}

            {preview && (
              <div className={cn('rounded-2xl p-4 space-y-3', P38_FIELD_SURFACE)}>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="truncate">{preview.itemOriginal.produto_nome}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                  <span className="truncate text-foreground font-medium">{preview.itemNovo.produto_nome}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Qtd. antes</p>
                    <p className="font-medium">{formatLinhaQuantidade(preview.itemOriginal)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Qtd. depois</p>
                    <p className="font-medium text-foreground">{formatLinhaQuantidade(preview.itemNovo)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Pedido antes</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(preview.valorAnterior)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pedido depois</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(preview.valorNovo)}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/20">
                  <p className="text-sm text-muted-foreground">Diferença no pagamento</p>
                  <p
                    className={cn(
                      'text-lg font-bold tabular-nums',
                      preview.diferencaPedido > 0
                        ? 'text-red-600 dark:text-red-400'
                        : preview.diferencaPedido < 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-foreground',
                    )}
                  >
                    {preview.diferencaPedido > 0 ? '+' : ''}
                    {formatCurrency(preview.diferencaPedido)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {preview.diferencaPedido > 0
                      ? 'Será gerada uma conta a pagar com o valor da diferença, se o pedido já tiver parcelas pagas.'
                      : preview.diferencaPedido < 0
                        ? 'Será gerada uma conta a receber com o crédito da diferença, se o pedido já tiver parcelas pagas.'
                        : 'Sem alteração de valor — só troca de produto e/ou quantidade.'}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="troca-motivo">Motivo (opcional)</Label>
              <Textarea
                id="troca-motivo"
                data-pulse-sensor="pedido-compra.troca-rapida.motivo"
                placeholder="Ex.: fornecedor enviou modelo diferente em outra quantidade"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              data-pulse-sensor="pedido-compra.troca-rapida.confirmar"
              onClick={handleConfirm}
              disabled={!preview || submitting || quantidadeComercial <= 0}
            >
              {submitting ? 'Salvando...' : 'Confirmar troca'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductUnitSelectorDialog
        open={unitSelectorOpen}
        product={produtoSelecionado}
        mode="purchase"
        onClose={() => setUnitSelectorOpen(false)}
        onConfirm={(selectedUnit) => {
          setUnitOption(selectedUnit);
          setUnitSelectorOpen(false);
        }}
      />
    </>
  );
}

function formatLinhaQuantidade(item = {}) {
  const qty = formatQuantidadeDisplay(Number(item.quantidade) || 0);
  const unidade = item.unidade_medida || item.unidade_apresentacao || 'UN';
  return `${qty} ${unidade}`;
}
