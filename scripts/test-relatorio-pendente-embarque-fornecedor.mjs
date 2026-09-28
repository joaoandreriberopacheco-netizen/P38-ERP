/**
 * Teste unitário leve — buildRelatorioPendenteEmbarqueFornecedor (sem BD).
 * npx vite-node --config legacy/vite/vite.config.js scripts/test-relatorio-pendente-embarque-fornecedor.mjs
 */
import {
  buildRelatorioPendenteEmbarqueFornecedor,
  renderRelatorioPendenteEmbarqueFornecedorHtml,
} from '../src/lib/relatorioPendenteEmbarqueFornecedor.js';

const pedidoId = 'ped-1';
const pedido = {
  id: pedidoId,
  numero: 'TST-AAA',
  fornecedor_nome: 'Fornecedor Teste',
  data_emissao: '2026-08-01',
  status: 'Aprovado',
  status_recebimento_geral: 'Concluído com Divergência',
  itens: [
    {
      produto_id: 'p1',
      produto_nome: 'Produto A',
      quantidade: 10,
      quantidade_base: 100,
      fator_conversao: 10,
      unidade_medida: 'CX',
      total: 1000,
      custo_unitario: 100,
    },
  ],
};

const embarque = {
  id: 'emb-1',
  pedido_compra_id: pedidoId,
  numero: 'TST-AAA-A',
  tipo: 'Despacho',
  status_recebimento: 'Com Divergência',
  data_embarque: '2026-08-10',
  created_date: '2026-08-10T12:00:00Z',
  _linhas: [
    {
      produto_id: 'p1',
      produto_nome: 'Produto A',
      quantidade_embarcada_comercial: 10,
      quantidade_recebida_comercial: 8,
      quantidade_pedida_comercial: 10,
      quantidade_embarcada: 10,
      quantidade_recebida: 8,
      quantidade_embarcada_base: 100,
      quantidade_recebida_base: 80,
      quantidade_pedida_base: 100,
      fator_conversao: 10,
      unidade_medida: 'CX',
    },
  ],
};

const relatorio = buildRelatorioPendenteEmbarqueFornecedor([pedido], [embarque], {}, {
  dataEmissaoMin: '2026-07-20',
});

if (relatorio.totalEmbarques !== 1 || relatorio.totalPedidos !== 1) {
  console.error('Esperava 1 embarque e 1 pedido, obteve', relatorio.totalEmbarques, relatorio.totalPedidos);
  process.exit(1);
}

const pedBloco = relatorio.pedidos[0];
if (!pedBloco?.despacho_principal?.codigo?.includes('TST-AAA')) {
  console.error('Despacho principal inesperado', pedBloco?.despacho_principal);
  process.exit(1);
}

const row = relatorio.embarques[0];
if (row.pct_base_sobre_pedido < 15 || row.pct_base_sobre_pedido > 25) {
  console.error('pct_base_sobre_pedido fora do esperado (~20%):', row.pct_base_sobre_pedido);
  process.exit(1);
}
if (!/diverg|avaria/i.test(row.motivo)) {
  console.error('motivo inesperado:', row.motivo);
  process.exit(1);
}

const html = renderRelatorioPendenteEmbarqueFornecedorHtml(relatorio);
if (!html.includes('Despacho principal') || !html.includes('TST-AAA')) {
  console.error('HTML não contém contexto de pedido/despacho');
  process.exit(1);
}

console.log('OK — relatorio pendente embarque fornecedor');
console.log(`  ${row.embarque_codigo}: ${row.pct_base_sobre_pedido}% base · ${row.pct_valor_sobre_pedido}% valor · ${row.motivo}`);
