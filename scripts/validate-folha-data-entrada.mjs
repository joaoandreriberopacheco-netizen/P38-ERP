/**
 * Validação rápida dos cálculos de data_entrada na folha.
 * Uso: node scripts/validate-folha-data-entrada.mjs
 */
import {
  avosTrabalhadosNoAno,
  calcularTotaisCompetencia,
  competenciaDireitoFerias,
  diasTrabalhadosNaCompetencia,
  fatorDecimoTerceiroProporcional,
  fatorProporcionalCompetencia,
  modeloEstaAtivoNaCompetencia,
} from '../src/lib/folhaPrevisaoCalculos.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const modeloNovo = {
  tipo_vinculo: 'funcionario',
  data_entrada: '2026-09-17',
  rubricas: [{ tipo: 'provento', nome: 'Salário base', valor_base: 3000 }],
  decimo_terceiro_ativo: true,
};

// Entrada dia 17 em setembro: 14 dias em mês de 30
assert(diasTrabalhadosNaCompetencia(modeloNovo, '2026-09') === 14, 'dias set/2026');
assert(
  Math.abs(fatorProporcionalCompetencia(modeloNovo, '2026-09') - 14 / 30) < 0.001,
  'fator set/2026',
);
assert(!modeloEstaAtivoNaCompetencia(modeloNovo, '2026-08'), 'inativo antes da entrada');
assert(modeloEstaAtivoNaCompetencia(modeloNovo, '2026-10'), 'ativo após entrada');

const totaisSet = calcularTotaisCompetencia(
  { competencia: '2026-09', rubricas: modeloNovo.rubricas, movimentos: [] },
  modeloNovo,
);
assert(
  Math.abs(totaisSet.proventosFixos - 3000 * (14 / 30)) < 0.02,
  `salário proporcional set (${totaisSet.proventosFixos})`,
);
assert(totaisSet.resumoProporcional === '14/30 dias', 'resumo proporcional');

const totaisOut = calcularTotaisCompetencia(
  { competencia: '2026-10', rubricas: modeloNovo.rubricas, movimentos: [] },
  modeloNovo,
);
assert(totaisOut.proventosFixos === 3000, 'salário integral out');

const avosNov = avosTrabalhadosNoAno(modeloNovo, '2026-11');
assert(avosNov >= 2.4 && avosNov <= 2.5, `avos até nov (${avosNov})`);
const fatorDecimo = fatorDecimoTerceiroProporcional(modeloNovo, '2026-11');
assert(fatorDecimo < 0.25, `13º proporcional nov (${fatorDecimo})`);

assert(competenciaDireitoFerias(modeloNovo) === '2027-09', 'direito férias');

const modeloLegado = {
  tipo_vinculo: 'funcionario',
  rubricas: [{ tipo: 'provento', nome: 'Salário base', valor_base: 2000 }],
};
assert(fatorProporcionalCompetencia(modeloLegado, '2026-09') === 1, 'legado fator 1');
assert(fatorDecimoTerceiroProporcional(modeloLegado, '2026-11') === 1, 'legado 13º cheio');
assert(competenciaDireitoFerias(modeloLegado) === null, 'legado sem data férias');

console.log('OK — validate-folha-data-entrada');
