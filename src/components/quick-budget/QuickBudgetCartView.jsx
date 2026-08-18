import React from 'react';
import {
  Check,
  Loader2,
  MessageCircle,
  ShoppingCart,
  Store,
  Save,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  formatCurrency,
  ORCAMENTO_RAPIDO_AVISO_PRECO,
} from './quickBudgetUtils';
import { selectAllOnFocus } from '@/lib/inputFocusUtils';
import ProdutoThumb from '@/components/produtos/ProdutoThumb';

export default function QuickBudgetCartView({
  items,
  descontoResumo,
  ajustePercentual,
  ajusteValor,
  onAjustePercentualChange,
  onAjusteValorChange,
  limiteTabela = 0,
  clienteNome,
  setClienteNome,
  onSaveCart,
  onSalvarOrcamento,
  onEnviarPdv,
  onClose,
  onShare,
  isSharing,
  isSaving,
  compact = false,
}) {
  if (items.length === 0) {
    return null;
  }

  const {
    subtotal,
    catalogSubtotal,
    valorDesconto,
    total,
    limite,
    ajusteExcedido,
    abaixoCatalogo,
  } = descontoResumo || {};

  return (
    <div className="space-y-3">
      <div className="rounded-3xl bg-card shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Carrinho</p>
            <p className="text-sm text-foreground/90">
              {items.reduce((s, i) => s + (Number(i.quantidade) || 0), 0)} qtd · {items.length} itens
            </p>
          </div>
          <div className="text-right">
            {valorDesconto > 0 && (
              <p className="text-xs text-muted-foreground line-through">{formatCurrency(subtotal)}</p>
            )}
            <p className="text-2xl font-bold text-foreground font-glacial">{formatCurrency(total)}</p>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.item_key || item.produto_id} className="rounded-2xl bg-muted/50 px-3 py-3 flex items-center justify-between gap-3">
              <ProdutoThumb
                produto={{
                  id: item.produto_id,
                  nome: item.produto_nome,
                  imagem_url: item.imagem_url,
                }}
                size="sm"
                roundedClassName="rounded-xl"
                asDiv
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{item.produto_nome}</p>
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-0.5">
                  <span>{item.quantidade} {item.unidade || 'UN'} ×</span>
                  {item.tem_ajuste_tabela && Number(item.preco_venda_lista) > 0 && (
                    <span className="line-through text-muted-foreground">{formatCurrency(item.preco_venda_lista)}</span>
                  )}
                  <span className={item.tem_ajuste_tabela && Number(item.preco_venda_lista) > 0 ? 'font-semibold text-foreground/90' : ''}>
                    {formatCurrency(item.preco_unitario)}
                  </span>
                </p>
              </div>
              <p className="text-sm font-semibold text-foreground">{formatCurrency(item.total)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 px-3 py-2.5 flex gap-2 text-xs text-amber-900 dark:text-amber-100">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{ORCAMENTO_RAPIDO_AVISO_PRECO}</span>
      </div>

      <div className="rounded-3xl bg-card shadow-sm p-4 space-y-2">
        <Input
          placeholder="Nome do cliente (opcional)"
          value={clienteNome}
          onChange={(e) => setClienteNome(e.target.value)}
          className="border-0 bg-muted h-10 text-sm rounded-xl shadow-none focus-visible:ring-0 mb-2"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Desconto</span>
          {limiteTabela > 0 && (
            <span className="text-[10px] text-muted-foreground">máx {limiteTabela}%</span>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={ajustePercentual}
              onChange={(e) => onAjustePercentualChange(e.target.value)}
              onFocus={selectAllOnFocus}
              className="pr-6 h-10 bg-muted/50 border-0 shadow-sm rounded-xl text-sm text-right focus:ring-1 focus:ring-border/40"
              placeholder="0"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <span className="text-muted-foreground text-xs">=</span>
          <div className="relative flex-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={ajusteValor}
              onChange={(e) => onAjusteValorChange(e.target.value)}
              onFocus={selectAllOnFocus}
              className="pl-7 h-10 bg-muted/50 border-0 shadow-sm rounded-xl text-sm focus:ring-1 focus:ring-border/40"
              placeholder="0,00"
            />
          </div>
        </div>
        {ajusteExcedido && (
          <p className="text-xs text-red-500">Excede limite de {limite}%</p>
        )}
        {abaixoCatalogo && !ajusteExcedido && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Abaixo do preço de catálogo (limite: {formatCurrency(catalogSubtotal)})
          </p>
        )}
        {catalogSubtotal > 0 && catalogSubtotal < subtotal && (
          <p className="text-[10px] text-muted-foreground text-right">
            Limite catálogo (sem tabela): {formatCurrency(catalogSubtotal)}
          </p>
        )}
        {valorDesconto > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            Desconto aplicado: −{formatCurrency(valorDesconto)}
          </p>
        )}
      </div>

      <Button
        type="button"
        onClick={onSaveCart}
        className="w-full h-11 rounded-2xl bg-muted hover:bg-muted/80 shadow-none text-foreground"
      >
        <ShoppingCart className="w-4 h-4 mr-2" /> Continuar buscando
      </Button>

      <Button
        type="button"
        onClick={onSalvarOrcamento}
        disabled={isSaving || ajusteExcedido}
        className="w-full h-12 rounded-2xl bg-background hover:bg-primary dark:bg-card dark:text-foreground shadow-none"
      >
        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Salvar orçamento
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={onEnviarPdv}
        disabled={ajusteExcedido}
        className="w-full h-12 rounded-2xl border-0 bg-muted shadow-none"
      >
        <Store className="w-4 h-4 mr-2" /> Enviar para o PDV
      </Button>

      {!compact && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-12 rounded-2xl border-0 bg-muted shadow-none text-foreground/90"
          >
            <Check className="w-4 h-4 mr-2" /> Concluir
          </Button>
          <Button
            onClick={onShare}
            disabled={isSharing}
            className="h-12 rounded-2xl bg-background hover:bg-primary dark:bg-card dark:text-foreground shadow-none"
          >
            {isSharing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
            Compartilhar
          </Button>
        </div>
      )}
    </div>
  );
}
