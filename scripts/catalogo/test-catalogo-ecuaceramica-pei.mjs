#!/usr/bin/env node
import { normalizePeiEcuaceramica, peiLegenda } from '../lib/ecuaceramicaPei.mjs';

const casos = [
  ['PEI 4', 4, 'PEI 4'],
  ['PEI 3', 3, 'PEI 3'],
  ['Si', null, 'Si'],
  ['', null, null],
];

for (const [raw, pei, label] of casos) {
  const r = normalizePeiEcuaceramica(raw);
  if (r.pei !== pei || r.pei_label !== label) {
    console.error({ raw, esperado: { pei, label }, obtido: r });
    process.exit(1);
  }
}

console.log(JSON.stringify({
  ok: true,
  legenda_pei4: peiLegenda(4),
}, null, 2));
