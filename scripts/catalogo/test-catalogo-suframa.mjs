#!/usr/bin/env node
/**
 * Unit smoke: ICMS + incentivo Suframa (Formigres SC → comprador AM).
 */
import { calcRegimeIncentivoFromState, icmsInterestadual } from '../lib/catalogoSuframa.mjs';

const cases = [
  {
    label: 'SC→AM ZFM presumido',
    input: { fabricanteUf: 'SC', compradorUf: 'AM', destino: 'zfm', tributario: 'lucro_presumido' },
    icms: 25,
    incentivo: 16.25,
  },
  {
    label: 'SC→AM ALC real',
    input: { fabricanteUf: 'SC', compradorUf: 'AM', destino: 'alc', tributario: 'lucro_real' },
    icms: 25,
    incentivo: 7,
  },
  {
    label: 'BA→AM ZFM presumido',
    input: { fabricanteUf: 'BA', compradorUf: 'AM', destino: 'zfm', tributario: 'lucro_presumido' },
    icms: 12,
    incentivo: 7.8,
  },
];

let ok = true;
for (const c of cases) {
  const icms = icmsInterestadual(c.input.fabricanteUf, c.input.compradorUf);
  const { icms: icmsCalc, incentivo } = calcRegimeIncentivoFromState(c.input);
  const pass = icms === c.icms && icmsCalc === c.icms && incentivo === c.incentivo;
  if (!pass) ok = false;
  console.log(pass ? 'OK' : 'FAIL', c.label, { icms, icmsCalc, incentivo, expected: { icms: c.icms, incentivo: c.incentivo } });
}

process.exit(ok ? 0 : 1);
