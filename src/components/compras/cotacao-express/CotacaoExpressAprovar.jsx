import { useState } from 'react';
import { ArrowLeft, CheckCircle, ExternalLink, Loader2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatCurrency } from '@/lib/financialUtils';

export default function CotacaoExpressAprovar({
  cotacao,
  resumo,
  gerando = false,
  onVoltar,
  onConfirmarGeracao,
  onVerPedido,
  pedidosGerados = [],
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (pedidosGerados.length > 0) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <div className="shrink-0 border-b border-border/40 px-3 py-2.5">
          <h2 className="text-base font-semibold font-glacial text-foreground">
            Pedidos gerados
          </h2>
          <p className="text-xs text-muted-foreground">{cotacao?.titulo}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-center dark:bg-emerald-950/30">
            <CheckCircle className="mx-auto mb-2 h-10 w-10 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              {pedidosGerados.length === 1
                ? '1 pedido de compra criado em rascunho.'
                : `${pedidosGerados.length} pedidos de compra criados em rascunho.`}
            </p>
          </div>
          {pedidosGerados.map((po) => (
            <button
              key={po.id}
              type="button"
              onClick={() => onVerPedido(po)}
              className="flex w-full items-center justify-between rounded-2xl border border-border/40 bg-card p-4 text-left hover:bg-muted/30"
            >
              <div>
                <p className="text-sm font-medium">{po.numero}</p>
                <p className="text-xs text-muted-foreground">{po.fornecedor_nome}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{formatCurrency(po.valor_total)}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
        <div className="shrink-0 border-t border-border/40 p-3">
          <Button type="button" className="h-12 w-full rounded-2xl" variant="outline" onClick={onVoltar}>
            Voltar ao hub
          </Button>
        </div>
      </div>
    );
  }

  const { grupos = [], totalGeral = 0, economiaTotal = 0, itensPendentesCount = 0 } = resumo || {};

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onVoltar}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold font-glacial text-foreground">
              Confirmar aprovação
            </h2>
            <p className="truncate text-xs text-muted-foreground">{cotacao?.titulo}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {itensPendentesCount > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800">
            {itensPendentesCount} produto(s) sem vencedor definido — não entrarão no pedido.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-muted/40 p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Total aprovado</p>
            <p className="text-lg font-semibold">{formatCurrency(totalGeral)}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50/80 p-3 text-center dark:bg-emerald-950/30">
            <p className="text-[10px] uppercase text-muted-foreground">Economia vs custo</p>
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(economiaTotal)}
            </p>
          </div>
        </div>

        {grupos.map((grupo) => (
          <div key={grupo.fornecedor_id} className="rounded-2xl border border-border/40 bg-card overflow-hidden">
            <div className="border-b border-border/30 bg-muted/30 px-3 py-2">
              <p className="text-sm font-medium">{grupo.fornecedor_nome}</p>
              <p className="text-xs text-muted-foreground">
                {grupo.itens.length} itens · {formatCurrency(grupo.total)}
              </p>
            </div>
            <ul className="divide-y divide-border/30">
              {grupo.itens.map((item) => (
                <li key={item.produto_id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{item.produto_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantidade} {item.unidade} × {formatCurrency(item.preco_unitario)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium">{formatCurrency(item.subtotal)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-border/40 bg-card/80 p-3 backdrop-blur-sm">
        <Button
          type="button"
          className="h-14 w-full rounded-2xl p38-btn-primary text-base"
          onClick={() => setConfirmOpen(true)}
          disabled={gerando || grupos.length === 0}
        >
          {gerando ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <ShoppingCart className="mr-2 h-5 w-5" />
              Aprovar e gerar pedido(s)
            </>
          )}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar geração de pedidos?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão criados {grupos.length} pedido(s) de compra em <strong>Rascunho</strong>, totalizando{' '}
              <strong>{formatCurrency(totalGeral)}</strong>. A cotação será marcada como finalizada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl p38-btn-primary"
              onClick={() => {
                setConfirmOpen(false);
                onConfirmarGeracao();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
