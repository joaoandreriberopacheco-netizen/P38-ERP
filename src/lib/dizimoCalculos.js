/**
 * Dízimo — demonstrativo espiritual sobre o lucro operacional estimado.
 * Reutiliza o plano consolidado (margem + despesas planejadas) e aplica
 * dedutibilidade por bloco antes de calcular os 10%.
 */

export const DIZIMO_MODOS = {
  TOTAL: 'total',
  PARCIAL: 'parcial',
  NAO_DEDUTIVEL: 'nao_dedutivel',
};

export const DIZIMO_PERCENTUAL = 10;

/** Blocos alinhados ao resumo operacional de `montarPlanoFinanceiroConsolidado`. */
export const DIZIMO_BLOCOS = [
  {
    id: 'fixas_recorrentes',
    resumoKey: 'fixasRecorrentes',
    label: 'Contas fixas (recorrentes)',
  },
  {
    id: 'folha',
    resumoKey: 'folha',
    label: 'Folha de pagamento',
  },
  {
    id: 'budgets',
    resumoKey: 'budgets',
    label: 'Budgets',
  },
  {
    id: 'pontuais',
    resumoKey: 'pontuaisExtraPlano',
    label: 'Pauta do mês (fora do plano fixo)',
  },
];

export function criarConfigDedutivelPadrao() {
  return Object.fromEntries(
    DIZIMO_BLOCOS.map((bloco) => [
      bloco.id,
      { modo: DIZIMO_MODOS.TOTAL, percentual: 100 },
    ]),
  );
}

export function normalizarConfigBlocoDizimo(raw = {}) {
  const modo = Object.values(DIZIMO_MODOS).includes(raw.modo) ? raw.modo : DIZIMO_MODOS.TOTAL;
  const percentual = Math.min(100, Math.max(0, Number(raw.percentual) || 0));
  return {
    modo,
    percentual: modo === DIZIMO_MODOS.PARCIAL ? (percentual || 50) : 100,
  };
}

export function normalizarConfigDedutivelDizimo(raw = {}) {
  const padrao = criarConfigDedutivelPadrao();
  const out = { ...padrao };
  for (const bloco of DIZIMO_BLOCOS) {
    if (raw[bloco.id]) {
      out[bloco.id] = normalizarConfigBlocoDizimo(raw[bloco.id]);
    }
  }
  return out;
}

/** Fator 0–1 do valor bruto que entra na base do dízimo. */
export function calcularFatorDedutivel(config = {}) {
  const normalizado = normalizarConfigBlocoDizimo(config);
  switch (normalizado.modo) {
    case DIZIMO_MODOS.TOTAL:
      return 1;
    case DIZIMO_MODOS.PARCIAL:
      return normalizado.percentual / 100;
    case DIZIMO_MODOS.NAO_DEDUTIVEL:
      return 0;
    default:
      return 1;
  }
}

export function labelModoDedutivel(modo) {
  switch (modo) {
    case DIZIMO_MODOS.TOTAL:
      return 'Total';
    case DIZIMO_MODOS.PARCIAL:
      return 'Parcial';
    case DIZIMO_MODOS.NAO_DEDUTIVEL:
      return 'Não dedutível';
    default:
      return 'Total';
  }
}

/**
 * Monta demonstrativo do dízimo para uma competência.
 * @param {object} planoConsolidado — retorno de `montarPlanoFinanceiroConsolidado`
 * @param {object} configBlocos — mapa blocoId → { modo, percentual }
 */
export function montarDemonstrativoDizimo(planoConsolidado, configBlocos = {}) {
  const resumo = planoConsolidado?.resumo || {};
  const config = normalizarConfigDedutivelDizimo(configBlocos);
  const lucroBruto = Number(resumo.lucroBruto) || 0;

  const blocos = DIZIMO_BLOCOS.map((def) => {
    const valorBruto = Number(resumo[def.resumoKey]) || 0;
    const blocoConfig = config[def.id];
    const fatorDedutivel = calcularFatorDedutivel(blocoConfig);
    const valorDedutivel = valorBruto * fatorDedutivel;
    const valorNaoDedutivel = valorBruto - valorDedutivel;

    return {
      ...def,
      config: blocoConfig,
      valorBruto,
      fatorDedutivel,
      valorDedutivel,
      valorNaoDedutivel,
    };
  });

  const totalOperacionalBruto = blocos.reduce((acc, bloco) => acc + bloco.valorBruto, 0);
  const totalDedutivel = blocos.reduce((acc, bloco) => acc + bloco.valorDedutivel, 0);
  const totalNaoDedutivel = blocos.reduce((acc, bloco) => acc + bloco.valorNaoDedutivel, 0);

  const lucroLiquidoOperacional = lucroBruto - totalDedutivel;
  const basePositiva = Math.max(0, lucroLiquidoOperacional);
  const dizimo = basePositiva * (DIZIMO_PERCENTUAL / 100);

  return {
    competencia: planoConsolidado?.competencia || '',
    margemDetalhe: planoConsolidado?.margemDetalhe || null,
    lucroBruto,
    blocos,
    totalOperacionalBruto,
    totalDedutivel,
    totalNaoDedutivel,
    lucroLiquidoOperacional,
    dizimo,
    percentualDizimo: DIZIMO_PERCENTUAL,
    resultadoOperacionalPlano: Number(resumo.resultadoOperacional) || 0,
  };
}
