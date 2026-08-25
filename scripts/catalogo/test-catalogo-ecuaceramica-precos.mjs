#!/usr/bin/env node
import { resolvePrecoEcuaceramica } from '../lib/ecuaceramicaTabelaPrecos.mjs';

const classif = { linha: 'retificada' };
const r = resolvePrecoEcuaceramica({ formato: '60x60' }, classif);
const esperado = 41.0; // 40 + 1 retificada

if (r.preco !== esperado || r.moeda !== 'BRL' || r.motivo !== 'demo_brl_por_formato') {
  console.error(JSON.stringify({ ok: false, r, esperado }, null, 2));
  process.exit(1);
}

const site = resolvePrecoEcuaceramica({ formato: '60x60', preco_caixa: 72 }, classif);
if (site.preco !== 40 || site.moeda !== 'USD') {
  console.error(JSON.stringify({ ok: false, site }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, demo: r, site }, null, 2));
