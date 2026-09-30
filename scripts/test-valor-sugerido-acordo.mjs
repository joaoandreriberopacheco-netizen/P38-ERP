import { calcularValorSugeridoAcordoOrfao } from '../src/lib/pedidoCompraFinanceiro.js';

const pedido = {
  itens: [
    {
      produto_id: 'p1',
      quantidade: 10,
      total: 100,
      custo_final_unitario_apresentacao: 10,
    },
    {
      produto_id: 'p2',
      quantidade: 20,
      total: 70,
    },
  ],
};
const orfaos = [{ produto_id: 'p1' }, { produto_id: 'p2' }];
const qtd = { p1: '2', p2: '5' };
const v = calcularValorSugeridoAcordoOrfao(orfaos, qtd, pedido);
// p1: 2*10=20, p2: 5/20*70=17.5 → 37.5
if (v !== 37.5) {
  console.error('valor sugerido esperado 37.5', v);
  process.exit(1);
}
console.log('OK — valor sugerido acordo órfão');
