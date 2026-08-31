import React from 'react';
import CadastroProdutoV2Form from '@/components/cadastro-produto-v2/CadastroProdutoV2Form';

/** Cadastro estrutural — LINHA, produto compra, eixo A/B (só Novo Ecosistema). */
export default function CatalogoNovoCadastroPanel() {
  return (
    <div className="w-full min-w-0 -mx-1 sm:mx-0">
      <CadastroProdutoV2Form />
    </div>
  );
}
