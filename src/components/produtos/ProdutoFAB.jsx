import React from 'react';
import { Plus } from 'lucide-react';

export default function ProdutoFAB({ onNovoClicked }) {
  return (
    <div className="fixed right-6 z-[55] p38-bottom-fab1 md:bottom-6 md:right-6">
      <button
        onClick={() => onNovoClicked?.()}
        className="flex items-center justify-center w-14 h-14 rounded-full bg-card text-card-foreground shadow-lg hover:shadow-xl transition-all duration-200"
        title="Novo Produto"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}