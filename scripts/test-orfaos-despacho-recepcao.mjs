#!/usr/bin/env node
/**
 * Órfãos: não confundir saldo recepcionado com falta de despacho.
 * node scripts/test-orfaos-despacho-recepcao.mjs
 */
import assert from 'node:assert/strict';
import {
  calcularItensOrfaosPedido,
  calcularPercentuaisLogistica,
  qtyDespachadaEfetivaBaseLinha,
} from '../src/lib/embarqueLogisticaHelpers.js';

const pedidoFortlev = {
  id: 'p1',
  numero: 'VD9-SQ2',
  itens: [{
    produto_id: 'prod1',
    produto_nome: "CAIXA D'ÁGUA 1000L",
    quantidade: 6,
    quantidade_base: 6,
    unidade_medida: 'UN',
    fator_conversao: 1,
  }],
};

const embarqueRecebidoSemEspelhoEmbarcado = {
  eta: '2026-08-15',
  status_recebimento: 'Recebido OK',
  _linhas: [{
    produto_id: 'prod1',
    quantidade_embarcada: 0,
    quantidade_embarcada_base: 0,
    quantidade_recebida: 6,
    quantidade_recebida_base: 6,
    quantidade_recebida_apresentacao: 6,
    fator_conversao: 1,
    unidade_medida: 'UN',
  }],
};

assert.equal(qtyDespachadaEfetivaBaseLinha(embarqueRecebidoSemEspelhoEmbarcado._linhas[0]), 6);

const orfaosFortlev = calcularItensOrfaosPedido(pedidoFortlev, [embarqueRecebidoSemEspelhoEmbarcado], {});
assert.equal(orfaosFortlev.length, 0, 'pedido 100% recebido não deve gerar órfão de despacho');

const pctFortlev = calcularPercentuaisLogistica(pedidoFortlev, [embarqueRecebidoSemEspelhoEmbarcado]);
assert.equal(pctFortlev.despachado, 100);
assert.equal(pctFortlev.concluido, 100);

const pedidoParcial = {
  id: 'p2',
  itens: [{
    produto_id: 'prod2',
    quantidade: 10,
    quantidade_base: 10,
    unidade_medida: 'UN',
    fator_conversao: 1,
  }],
};

const embarqueParcial = {
  eta: '2026-08-20',
  _linhas: [{
    produto_id: 'prod2',
    quantidade_embarcada: 4,
    quantidade_embarcada_base: 4,
    quantidade_recebida: 0,
    fator_conversao: 1,
  }],
};

const orfaosParcial = calcularItensOrfaosPedido(pedidoParcial, [embarqueParcial], {});
assert.equal(orfaosParcial.length, 1);
assert.equal(orfaosParcial[0].qtd_pendente, 6);

const pedidoEmTransito = {
  id: 'p3',
  itens: [{
    produto_id: 'prod3',
    quantidade: 6,
    quantidade_base: 6,
    unidade_medida: 'UN',
    fator_conversao: 1,
  }],
};

const embarqueEmTransito = {
  eta: '2026-09-15',
  transportadora_nome: 'F/B SOLIMÕES',
  status_recebimento: 'Pendente',
  _linhas: [{
    produto_id: 'prod3',
    quantidade_embarcada: 6,
    quantidade_embarcada_base: 6,
    quantidade_embarcada_apresentacao: 6,
    quantidade_recebida: 0,
    fator_conversao: 1,
    unidade_medida: 'UN',
  }],
};

const pctTransito = calcularPercentuaisLogistica(pedidoEmTransito, [embarqueEmTransito]);
assert.equal(pctTransito.despachado, 100);
assert.equal(pctTransito.concluido, 0);

const orfaosTransito = calcularItensOrfaosPedido(pedidoEmTransito, [embarqueEmTransito], {});
assert.equal(orfaosTransito.length, 0, '6/6 despachado sem recepção não é órfão');

console.log('OK — órfãos distinguem despacho de recepção (max embarcado/recebido).');
