import React from 'react';
import {
  Check,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  Printer,
  Save,
  ShoppingCart,
  Store,
  AlertCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  P38_FIELD_SURFACE,
  P38_ACCENT,
} from '@/components/financeiro/fluxo/financeiroP38';
import { cn } from '@/lib/utils';
import {
  formatCurrency,
  ORCAMENTO_RAPIDO_AVISO_PRECO,
} from './quickBudgetUtils';
import { selectAllOnFocus } from '@/lib/inputFocusUtils';
import ProdutoThumb from '@/components/produtos/ProdutoThumb';

function CartItemRow({
  item,
  onRemoveItem,
  onUpdateQuantity,
  sidebar = false,
}) {
  const qty = Number(item.quantidade) || 0;

  return (
    <div
      className={cn(
        'group rounded-2xl bg-muted/50 dark:bg-muted/30 px-3 py-3',
        sidebar ? 'space-y-2.5' : 'flex items-center justify-between gap-3',
      )}
    >
      <div className={cn('flex items-start gap-2.5', sidebar ? 'w-full' : 'min-w-0 flex-1')}>
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
          <p className="text-sm font-medium text-foreground leading-snug break-words">{item.produto_nome}</p>
          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-0.5 mt-0.5">
            {item.tem_ajuste_tabela && Number(item.preco_venda_lista) > 0 && (
              <span className="line-through">{formatCurrency(item.preco_venda_lista)}</span>
            )}
            <span className={item.tem_ajuste_tabela ? 'font-semibold text-foreground/90' : ''}>
              {formatCurrency(item.preco_unitario)}
            </span>
            <span>/{item.unidade || 'UN'}</span>
          </p>
        </div>
        {onRemoveItem && (
          <button
            type="button"
            onClick={() => onRemoveItem(item.item_key)}
            className={cn(
              'flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors',
              sidebar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
            aria-label="Remover item"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className={cn('flex items-center justify-between gap-2', sidebar && 'pl-12')}>
        {onUpdateQuantity ? (
          <div className="flex items-center bg-card dark:bg-background rounded-lg overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.item_key, qty - 1)}
              className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-bold w-9 text-center text-foreground tabular-nums">{qty}</span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(item.item_key, qty + 1)}
              className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{qty} {item.unidade || 'UN'}</span>
        )}
        <p className="text-sm font-semibold text-foreground tabular-nums ml-auto">{formatCurrency(item.total)}</p>
      </div>
    </div>
  );
}

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
  observacoes,
  setObservacoes,
  formatoImpressao,
  setFormatoImpressao,
  onSaveCart,
  onSalvarOrcamento,
  onImprimir,
  onEnviarPdv,
  onClose,
  onShare,
  isSharing,
  isSaving,
  compact = false,
  layout = 'stacked',
  onRemoveItem,
  onUpdateQuantity,
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

  const isSidebar = layout === 'sidebar';

  const itemsList = (
    <div className={cn('space-y-2 pr-1', isSidebar ? 'flex-1 min-h-0 overflow-y-auto' : 'max-h-64 overflow-y-auto')}>
      {items.map((item) => (
        <CartItemRow
          key={item.item_key || item.produto_id}
          item={item}
          onRemoveItem={onRemoveItem}
          onUpdateQuantity={onUpdateQuantity}
          sidebar={isSidebar}
        />
      ))}
    </div>
  );

  const formFields = (
    <div className={cn('space-y-3', !isSidebar && cn('rounded-[28px] p-4', P38_FIELD_SURFACE, 'bg-card dark:bg-background'))}>
      <Input
        placeholder="Nome do cliente (opcional)"
        value={clienteNome}
        onChange={(e) => setClienteNome(e.target.value)}
        className="border-0 bg-muted/60 dark:bg-muted/40 h-11 text-sm rounded-xl shadow-none focus-visible:ring-1 focus-visible:ring-border/40"
      />
      {setObservacoes && (
        <Textarea
          placeholder="Observações (opcional)"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="border-0 bg-muted/60 dark:bg-muted/40 text-sm rounded-xl shadow-none resize-none focus-visible:ring-1 focus-visible:ring-border/40"
        />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Desconto</span>
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
              className="pr-6 h-10 bg-muted/60 dark:bg-muted/40 border-0 shadow-sm rounded-xl text-sm text-right"
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
              className="pl-7 h-10 bg-muted/60 dark:bg-muted/40 border-0 shadow-sm rounded-xl text-sm"
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
          <p className={cn('text-[10px] text-right tabular-nums', P38_ACCENT)}>
            Limite catálogo (sem tabela): {formatCurrency(catalogSubtotal)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Formato impressão</span>
        <div className="flex gap-2">
          {['80mm', 'a4'].map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setFormatoImpressao(fmt)}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all',
                formatoImpressao === fmt
                  ? 'bg-[#4a5240] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]'
                  : 'bg-muted/60 dark:bg-muted/40 text-muted-foreground',
              )}
            >
              {fmt === '80mm' ? 'Cupom 80mm' : 'Folha A4'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const actions = (
    <div className="space-y-2">
      {!isSidebar && onSaveCart && (
        <Button
          type="button"
          onClick={onSaveCart}
          variant="ghost"
          className="w-full h-11 rounded-2xl text-foreground/90"
        >
          <ShoppingCart className="w-4 h-4 mr-2" /> Continuar buscando
        </Button>
      )}

      <Button
        type="button"
        onClick={onImprimir}
        disabled={ajusteExcedido}
        className="w-full h-12 rounded-2xl p38-btn-primary shadow-none border-0"
      >
        <Printer className="w-4 h-4 mr-2" /> Imprimir orçamento
      </Button>

      <Button
        type="button"
        onClick={onSalvarOrcamento}
        disabled={isSaving || ajusteExcedido}
        className="w-full h-12 rounded-2xl bg-card dark:bg-muted text-foreground shadow-none border border-border/30"
      >
        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Salvar orçamento
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={onEnviarPdv}
        disabled={ajusteExcedido}
        className="w-full h-12 rounded-2xl border-0 bg-muted/80 shadow-none"
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
            className="h-12 rounded-2xl bg-card dark:bg-muted shadow-none border border-border/30"
          >
            {isSharing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
            Compartilhar
          </Button>
        </div>
      )}
    </div>
  );

  if (isSidebar) {
    return (
      <div className="flex flex-col min-h-0 h-full rounded-[28px] bg-card dark:bg-background shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-border/30">
          <h2 className="text-base font-semibold text-foreground font-glacial">Carrinho</h2>
          <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
            {items.reduce((s, i) => s + (Number(i.quantidade) || 0), 0)} un · {items.length} itens
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-3">
          {itemsList}
        </div>

        <div className="flex-shrink-0 border-t border-border/40 p-4 space-y-3 max-h-[58%] overflow-y-auto">
          <div className="rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 px-3 py-2 flex gap-2 text-[11px] text-amber-900 dark:text-amber-100">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{ORCAMENTO_RAPIDO_AVISO_PRECO}</span>
          </div>

          {formFields}
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={cn('rounded-[28px] p-4 space-y-3', P38_FIELD_SURFACE, 'bg-card dark:bg-background')}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Carrinho</p>
            <p className="text-sm text-foreground/90">
              {items.reduce((s, i) => s + (Number(i.quantidade) || 0), 0)} qtd · {items.length} itens
            </p>
          </div>
          <div className="text-right">
            {valorDesconto > 0 && (
              <p className="text-xs text-muted-foreground line-through tabular-nums">{formatCurrency(subtotal)}</p>
            )}
            <p className="text-2xl font-bold text-foreground font-glacial tabular-nums">{formatCurrency(total)}</p>
          </div>
        </div>
        {itemsList}
      </div>

      <div className="rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 px-3 py-2.5 flex gap-2 text-xs text-amber-900 dark:text-amber-100">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{ORCAMENTO_RAPIDO_AVISO_PRECO}</span>
      </div>

      {formFields}
      {actions}
    </div>
  );
}
