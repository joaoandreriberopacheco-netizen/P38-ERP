#!/usr/bin/env node
/**
 * Valida conversão preço caixa → preço/m².
 * npm run catalogo:test-ecuaceramica-precos
 */
import { resolvePrecoEcuaceramica } from '../lib/ecuaceramicaTabelaPrecos.mjs';

const classif = { linha: 'retificada' };
const r = resolvePrecoEcuaceramica({ formato: '60x60', preco_caixa: 43.2 }, classif);
const esperado = Math.round((43.2 / 1.8) * 100) / 100;

if (r.preco !== esperado || r.preco_caixa !== 43.2 || r.motivo !== 'site_caixa_div_m2_oficial') {
  console.error(JSON.stringify({ ok: false, r, esperado }, null, 2));
  process.exit(1);
}

const sem = resolvePrecoEcuaceramica({ formato: '60x60', preco_caixa: null }, classif);
if (sem.preco != null) process.exit(1);

console.log(JSON.stringify({ ok: true, exemplo: r, semPreco: sem.motivo }, null, 2));
