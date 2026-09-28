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
  transportadora_nome: 'Transporte Teste',
  created_date: '2026-08-10T12:00:00Z',
  _linhas: [
    {
      produto_id: 'p1',
      produto_nome: 'Produto A',
      quantidade_embarcada_comercial: 8,
      quantidade_recebida_comercial: 8,
      quantidade_pedida_comercial: 10,
      quantidade_embarcada: 80,
      quantidade_recebida: 80,
      quantidade_embarcada_base: 80,
      quantidade_recebida_base: 80,
      quantidade_pedida_base: 100,
      fator_conversao: 10,
      unidade_medida: 'CX',
    },
  ],
};

const relatorio = buildRelatorioPendenteEmbarqueFornecedor([pedido], [embarque], {}, {
  dataEmissaoMin: '2026-07-20',
  somenteSaldoAvaria: false,
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
if (!row?.embarque_codigo) {
  console.error('embarque export inesperado', row);
  process.exit(1);
}

if (pedBloco.total_cx_pedido !== 10 || pedBloco.total_cx_pendente !== 2) {
  console.error('Totais cx pedido inesperados:', pedBloco.total_cx_pedido, pedBloco.total_cx_pendente);
  process.exit(1);
}
if (pedBloco.pct_cx_avaria_sobre_pedido !== 20 || relatorio.pct_cx_avaria_geral !== 20) {
  console.error('pct cx inesperado:', pedBloco.pct_cx_avaria_sobre_pedido, relatorio.pct_cx_avaria_geral);
  process.exit(1);
}
const linha = pedBloco.linhas[0];
if (linha.quantidade_comprada !== 10 || linha.quantidade_em_transito !== 0 || linha.quantidade_recebida !== 8 || linha.quantidade_pendente !== 2) {
  console.error('Folha 4 colunas inesperada:', linha);
  process.exit(1);
}

const html = renderRelatorioPendenteEmbarqueFornecedorHtml(relatorio);
if (!html.includes('Despacho principal') || !html.includes('TST-AAA')) {
  console.error('HTML não contém contexto de pedido/despacho');
  process.exit(1);
}
if (!html.includes('Trânsito (cx)') || !html.includes('Pendente (cx)')) {
  console.error('HTML não contém colunas da folha logística');
  process.exit(1);
}

console.log('OK — relatorio pendente embarque fornecedor');
console.log(`  ${row.embarque_codigo}: ${pedBloco.total_cx_pendente}/${pedBloco.total_cx_pedido} cx (${pedBloco.pct_cx_avaria_sobre_pedido}%) · ${row.motivo}`);
