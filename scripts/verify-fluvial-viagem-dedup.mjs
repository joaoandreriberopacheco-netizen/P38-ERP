#!/usr/bin/env node
/**
 * Verifica dedupe de viagens (transportadora + data_saida_origem).
 */
import {
  dedupeLogisticaEventosPorViagem,
  viagemLogisticaDedupKey,
} from '../src/components/logistica-sandbox/fluvialDataUtils.jsx';

const tid = 'transportadora-1';
const saida = '2026-10-22';

const brutos = [
  { id: 'a', transportadora_id: tid, data_saida_origem: saida, codigo: 'ABC-123' },
  { id: 'b', transportadora_id: tid, data_saida_origem: saida },
  { id: 'c', transportadora_id: tid, data_saida_origem: saida },
];

const deduped = dedupeLogisticaEventosPorViagem(brutos);

if (deduped.length !== 1) {
  console.error('Esperava 1 viagem após dedupe, obteve', deduped.length);
  process.exit(1);
}

if (deduped[0].id !== 'a') {
  console.error('Deveria manter registo com código, obteve id', deduped[0].id);
  process.exit(1);
}

const key = viagemLogisticaDedupKey({ embarcacao_template_id: tid, data_saida_origem: saida });
if (key !== `${tid}::${saida}`) {
  console.error('Chave dedupe inesperada:', key);
  process.exit(1);
}

console.log('verify-fluvial-viagem-dedup: OK');
