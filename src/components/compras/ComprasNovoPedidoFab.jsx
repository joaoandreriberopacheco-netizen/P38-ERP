import { Plus } from 'lucide-react';

/** FAB dedicado — apenas criar novo pedido de compra. */
export default function ComprasNovoPedidoFab({ onNovopedido }) {
  return (
    <button
      type="button"
      onClick={onNovopedido}
      className="fixed right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-full bg-[#4a5240] text-white shadow-xl transition-all active:scale-95 hover:bg-[#4a5240]/90 dark:bg-[#a4ce33] dark:text-[#1f1d22] dark:hover:bg-[#a4ce33]/90 p38-bottom-fab1 md:bottom-6 md:right-6"
      title="Novo pedido de compra"
      aria-label="Novo pedido de compra"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
