import { Plus } from 'lucide-react';
import { COMPRAS_FAB } from '@/lib/comprasP38Theme';

/** FAB dedicado — apenas criar novo pedido de compra. */
export default function ComprasNovoPedidoFab({ onNovopedido }) {
  return (
    <button
      type="button"
      onClick={onNovopedido}
      data-pulse-sensor="pedidos-compra.novo-pedido"
      className={`fixed right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-full ${COMPRAS_FAB} p38-bottom-fab1 md:bottom-6 md:right-6`}
      title="Novo pedido de compra"
      aria-label="Novo pedido de compra"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
