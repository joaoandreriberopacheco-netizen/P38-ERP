#!/usr/bin/env node
/**
 * Valida persistência da config de dedutibilidade por competência.
 */
import { DIZIMO_MODOS } from '../src/lib/dizimoCalculos.js';
import {
  carregarConfigDedutivelDizimo,
  salvarItemConfigDedutivelDizimo,
} from '../src/lib/dizimoConfigStorage.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => memStore.get(k) ?? null,
  setItem: (k, v) => memStore.set(k, v),
};

const ctx = { recorrentes: ['fixa-a', 'fixa-b'], ocasionais: ['pauta-1'] };
const padraoMar = carregarConfigDedutivelDizimo('2026-03', ctx);
assert(padraoMar['fixa-a'].modo === DIZIMO_MODOS.TOTAL, 'março inicia total');

salvarItemConfigDedutivelDizimo('2026-03', 'fixa-a', {
  modo: DIZIMO_MODOS.PARCIAL,
  percentual: 40,
});

const aposSalvar = carregarConfigDedutivelDizimo('2026-03', ctx);
assert(aposSalvar['fixa-a'].modo === DIZIMO_MODOS.PARCIAL, 'março persiste parcial');
assert(aposSalvar['fixa-a'].percentual === 40, 'março persiste percentual');

const outroMes = carregarConfigDedutivelDizimo('2026-04', ctx);
assert(outroMes['fixa-a'].modo === DIZIMO_MODOS.PARCIAL, 'abril herda recorrente do mês salvo anterior');
assert(outroMes['pauta-1'].modo === DIZIMO_MODOS.NAO_DEDUTIVEL, 'pauta ocasional padrão em mês novo');

const voltaMar = carregarConfigDedutivelDizimo('2026-03', ctx);
assert(voltaMar['fixa-a'].percentual === 40, 'volta ao março mantém 40%');

console.log('validate-dizimo-storage: OK');
