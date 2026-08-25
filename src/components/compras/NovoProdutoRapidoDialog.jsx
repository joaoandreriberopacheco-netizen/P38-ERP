import React from 'react';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import ProdutoFormCompleto from '@/components/produtos/ProdutoFormCompleto';

export default function NovoProdutoRapidoDialog({ isOpen, onClose, onSuccess, nomeInicial = '' }) {
  // Produto "semente" com o nome digitado na busca preenchido
  const produtoSemente = nomeInicial
    ? { campo_hierarquico_1: nomeInicial, nome: nomeInicial }
    : null;

  const handleSave = async (savedProduto) => {
    if (!savedProduto?.id) {
      onClose();
      return;
    }

    try {
      const fresh = await base44.entities.Produto.get(savedProduto.id);
      onSuccess(fresh?.id ? fresh : savedProduto);
    } catch {
      onSuccess(savedProduto);
    }
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-w-3xl w-full h-[90vh] mx-4 overflow-hidden bg-card shadow-2xl rounded-2xl">
        <ProdutoFormCompleto
          produto={produtoSemente}
          onSave={handleSave}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body
  );
}
