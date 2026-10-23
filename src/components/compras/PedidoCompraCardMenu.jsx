import React, { useState } from 'react';
import { Loader2, MoreVertical, Printer } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/components/utils';
import { COMPRAS_DROPDOWN, COMPRAS_DROPDOWN_ITEM } from '@/lib/comprasP38Theme';
import { exportMinutaPedidoComAnexos } from '@/lib/exportMinutaPedidoComAnexos';
import { toast } from 'sonner';

const TRIGGER_CLASS =
  'h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 shrink-0 touch-manipulation';

export default function PedidoCompraCardMenu({
  pedidoId,
  pedidoNumero = '',
  className = '',
  align = 'end',
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);

  if (!pedidoId || disabled) return null;

  const handleImprimirMinuta = async (event) => {
    event?.preventDefault?.();
    if (loading) return;
    setLoading(true);
    toast.loading('Gerando minuta (consulta + anexos)...', { id: 'minuta-pedido-card' });
    try {
      await exportMinutaPedidoComAnexos({ pedidoId, pedidoNumero });
      toast.success('Minuta gerada', { id: 'minuta-pedido-card' });
    } catch (error) {
      const msg = error?.message || 'Não foi possível gerar o PDF.';
      toast.error('Erro ao gerar minuta', {
        id: 'minuta-pedido-card',
        description: msg.length > 220 ? `${msg.slice(0, 218)}…` : msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const stopCardActivation = (event) => {
    event.stopPropagation();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(TRIGGER_CLASS, className)}
          aria-label="Opções do pedido"
          disabled={loading}
          onClick={stopCardActivation}
          onPointerDown={stopCardActivation}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MoreVertical className="w-4 h-4" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={COMPRAS_DROPDOWN}
        onClick={stopCardActivation}
        onPointerDown={stopCardActivation}
      >
        <DropdownMenuItem
          className={COMPRAS_DROPDOWN_ITEM}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            void handleImprimirMinuta(event);
          }}
        >
          <Printer className="w-4 h-4 mr-2 shrink-0" />
          Imprimir minuta (PDF + anexos)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
