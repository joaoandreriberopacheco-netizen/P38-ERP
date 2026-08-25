#!/usr/bin/env node
/**
 * Valida embalagem oficial Ecuaceramica (packing list).
 * npm run catalogo:test-ecuaceramica-embalagem
 */
import { resolveEmbalagemEcuaceramica } from '../lib/ecuaceramicaEmbalagem.mjs';

const CASOS = [
  { formato: '60x60', m2: 1.8, cx: 32, kg: 35, pecas: 5 },
  { formato: '20x120', m2: 1.65, cx: 45, kg: 36.2, pecas: 7 },
  { formato: '30x120', m2: 1.79, cx: 36, kg: 40, pecas: 5 },
  { formato: '15x60', m2: 1.06, cx: 64, kg: 20, pecas: 12 },
];

let ok = 0;
for (const c of CASOS) {
  const emb = resolveEmbalagemEcuaceramica({ formato: c.formato });
  const pass = emb.m2_por_caixa === c.m2
    && emb.caixas_por_palete === c.cx
    && emb.peso_kg_caixa === c.kg
    && emb.pecas_por_caixa === c.pecas
    && emb.embalagem_fonte === 'ecuaceramica_informacion_embalaje';
  if (pass) ok += 1;
  console.log(JSON.stringify({ ...c, pass, emb }, null, 2));
}

if (ok !== CASOS.length) process.exit(1);
console.log(JSON.stringify({ ok: true, total: CASOS.length }, null, 2));
