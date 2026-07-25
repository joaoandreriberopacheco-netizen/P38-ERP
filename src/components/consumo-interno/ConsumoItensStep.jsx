import React from 'react';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

const formatCurrency = (value) => `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function ConsumoItensStep({ formData, totalAtual, onOpenSelector, onBack, onNext }) {
  return (
    <div className="rounded-[30px] bg-card p-5 shadow-sm dark:bg-muted">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-lg font-semibold text-foreground">Itens</p>
        <p className="text-sm text-muted-foreground">{formatCurrency(totalAtual)}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
        <Button type="button" variant="outline" onClick={onOpenSelector} className="h-12 justify-start rounded-2xl border-0 bg-muted text-foreground/90 shadow-sm hover:bg-muted dark:bg-background dark:text-foreground dark:hover:bg-muted">
          <Search className="mr-2 h-4 w-4" />Selecionar itens
        </Button>
        <div className="flex h-12 items-center rounded-2xl bg-muted px-4 text-sm text-muted-foreground shadow-sm dark:bg-background dark:text-foreground/90">
          Baixa pelo custo calculado do produto
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {formData.itens.map((item, index) => (
          <div key={`${item.produto_id}-${index}`} className="flex items-center justify-between rounded-[24px] bg-muted/40 px-4 py-3 shadow-sm dark:bg-background">
            <div>
              <p className="text-sm font-medium text-foreground">{item.produto_nome}</p>
              <p className="text-xs text-muted-foreground">{item.quantidade} {item.unidade_medida} · custo calc. {formatCurrency(item.custo_unitario)}</p>
            </div>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(item.subtotal)}</p>
          </div>
        ))}
        {!formData.itens.length && (
          <div className="rounded-[24px] bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground shadow-sm dark:bg-background dark:text-muted-foreground">
            Nenhum item adicionado ainda.
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button type="button" variant="outline" onClick={onBack} className="h-11 flex-1 rounded-2xl border-0 shadow-sm">
          Voltar
        </Button>
        <Button type="button" onClick={onNext} className="h-11 flex-1 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground">
          Próximo
        </Button>
      </div>
    </div>
  );
}