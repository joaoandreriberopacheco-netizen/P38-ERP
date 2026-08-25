#!/usr/bin/env node
/**
 * Unit smoke: desconto Suframa (ICMS variável + PIS/COFINS fixos).
 */
import {
  calcRegimeIncentivoFromState,
  icmsInterestadual,
  PIS_DESONERADO_PCT,
  COFINS_DESONERADO_PCT,
} from '../lib/catalogoSuframa.mjs';

const cases = [
  {
    label: 'SP→AM ZFM presumido (Formigres)',
    input: { fabricanteUf: 'SP', compradorUf: 'AM', destino: 'zfm', tributario: 'lucro_presumido' },
    icms: 25,
    icmsDesconto: 7,
    pis: PIS_DESONERADO_PCT,
    cofins: COFINS_DESONERADO_PCT,
    incentivo: 16.25,
  },
  {
    label: 'SP→AM ALC lucro real (só ICMS)',
    input: { fabricanteUf: 'SP', compradorUf: 'AM', destino: 'alc', tributario: 'lucro_real' },
    icms: 25,
    icmsDesconto: 7,
    pis: 0,
    cofins: 0,
    incentivo: 7,
  },
  {
    label: 'BA→AM ALC presumido',
    input: { fabricanteUf: 'BA', compradorUf: 'AM', destino: 'alc', tributario: 'lucro_presumido' },
    icms: 12,
    icmsDesconto: 12,
    pis: PIS_DESONERADO_PCT,
    cofins: COFINS_DESONERADO_PCT,
    incentivo: 21.25,
  },
];

let ok = true;
for (const c of cases) {
  const icms = icmsInterestadual(c.input.fabricanteUf, c.input.compradorUf);
  const r = calcRegimeIncentivoFromState(c.input);
  const pass = icms === c.icms
    && r.icmsDesconto === c.icmsDesconto
    && r.pis === c.pis
    && r.cofins === c.cofins
    && r.incentivo === c.incentivo;
  if (!pass) ok = false;
  console.log(pass ? 'OK' : 'FAIL', c.label, r);
}

process.exit(ok ? 0 : 1);
