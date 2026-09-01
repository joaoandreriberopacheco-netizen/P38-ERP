/**
 * Dízimo — demonstrativo espiritual sobre o lucro operacional estimado.
 * Deduções configuráveis por item (conta fixa, colaborador, budget, pauta).
 */

export const DIZIMO_MODOS = {
  TOTAL: 'total',
  PARCIAL: 'parcial',
  NAO_DEDUTIVEL: 'nao_dedutivel',
};

export const DIZIMO_PERCENTUAL = 10;

const GRUPO_PLANO = {
  FIXAS: 'fixas_recorrentes',
  FOLHA: 'folha',
  BUDGETS: 'budgets',
  PONTUAIS: 'pontuais',
};

export const DIZIMO_SECOES = [
  { id: GRUPO_PLANO.FIXAS, grupoId: GRUPO_PLANO.FIXAS, label: 'Contas fixas' },
  {
    id: GRUPO_PLANO.FOLHA,
    grupoId: GRUPO_PLANO.FOLHA,
    label: 'Folha',
    subsecoes: [
      {
        id: 'folha_funcionarios',
        label: 'Funcionários',
        filtro: (item) => item.detalhe !== 'Sócio',
      },
      {
        id: 'folha_pro_labore',
        label: 'Pró-labore',
        filtro: (item) => item.detalhe === 'Sócio',
      },
    ],
  },
  { id: GRUPO_PLANO.BUDGETS, grupoId: GRUPO_PLANO.BUDGETS, label: 'Budgets' },
  {
    id: GRUPO_PLANO.PONTUAIS,
    grupoId: GRUPO_PLANO.PONTUAIS,
    label: 'Pauta do mês',
    somenteEntraNoTotal: true,
  },
];

export function criarConfigDedutivelPadrao() {
  return {};
}

export function normalizarConfigItemDizimo(raw = {}) {
  const modo = Object.values(DIZIMO_MODOS).includes(raw.modo) ? raw.modo : DIZIMO_MODOS.TOTAL;
  const percentual = Math.min(100, Math.max(0, Number(raw.percentual) || 0));
  return {
    modo,
    percentual: modo === DIZIMO_MODOS.PARCIAL ? (percentual || 100) : 100,
  };
}

export function configPadraoItemDizimo({ recorrente = true } = {}) {
  if (recorrente) {
    return { modo: DIZIMO_MODOS.TOTAL, percentual: 100 };
  }
  return { modo: DIZIMO_MODOS.NAO_DEDUTIVEL, percentual: 0 };
}

export function isItemDizimoRecorrente(itemId, grupoId) {
  if (grupoId === GRUPO_PLANO.PONTUAIS) return false;
  if (String(itemId || '').startsWith('pauta-')) return false;
  return true;
}

/** Extrai ids de itens do plano para herança de configuração. */
export function extrairContextoItensDizimo(planoConsolidado) {
  const recorrentes = [];
  const ocasionais = [];
  for (const grupo of planoConsolidado?.grupos || []) {
    const recorrente = isItemDizimoRecorrente(null, grupo.id);
    for (const item of grupo.items || []) {
      if ((Number(item.valor) || 0) <= 0) continue;
      if (grupo.id === GRUPO_PLANO.PONTUAIS && item.entraNoTotal === false) continue;
      if (recorrente && isItemDizimoRecorrente(item.id, grupo.id)) {
        recorrentes.push(item.id);
      } else {
        ocasionais.push(item.id);
      }
    }
  }
  return { recorrentes, ocasionais };
}

/**
 * Resolve configuração completa para todos os itens visíveis.
 * Recorrentes sem entrada explícita: herdam mês anterior ou Total.
 * Ocasionais sem entrada: Não dedutível.
 */
export function resolverConfigItensDizimo({
  configExplicita = {},
  configMesAnterior = {},
  recorrentes = [],
  ocasionais = [],
}) {
  const out = {};
  for (const id of recorrentes) {
    if (configExplicita[id]) {
      out[id] = normalizarConfigItemDizimo(configExplicita[id]);
    } else if (configMesAnterior[id]) {
      out[id] = normalizarConfigItemDizimo(configMesAnterior[id]);
    } else {
      out[id] = configPadraoItemDizimo({ recorrente: true });
    }
  }
  for (const id of ocasionais) {
    if (configExplicita[id]) {
      out[id] = normalizarConfigItemDizimo(configExplicita[id]);
    } else {
      out[id] = configPadraoItemDizimo({ recorrente: false });
    }
  }
  return out;
}

/** @deprecated alias — configuração por item */
export function normalizarConfigBlocoDizimo(raw = {}) {
  return normalizarConfigItemDizimo(raw);
}

export function normalizarConfigDedutivelDizimo(raw = {}) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [itemId, cfg] of Object.entries(raw)) {
    if (cfg && typeof cfg === 'object') {
      out[itemId] = normalizarConfigItemDizimo(cfg);
    }
  }
  return out;
}

export function calcularFatorDedutivel(config = {}) {
  const normalizado = normalizarConfigItemDizimo(config);
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

function agregarTotais(itens = []) {
  return itens.reduce(
    (acc, item) => ({
      valorBruto: acc.valorBruto + item.valorBruto,
      valorDedutivel: acc.valorDedutivel + item.valorDedutivel,
      valorNaoDedutivel: acc.valorNaoDedutivel + item.valorNaoDedutivel,
    }),
    { valorBruto: 0, valorDedutivel: 0, valorNaoDedutivel: 0 },
  );
}

function montarItemDizimo(linha, configItens, grupoId) {
  const recorrente = isItemDizimoRecorrente(linha.id, grupoId);
  const config = configItens[linha.id]
    ? normalizarConfigItemDizimo(configItens[linha.id])
    : configPadraoItemDizimo({ recorrente });
  const valorBruto = Number(linha.valor) || 0;
  const fatorDedutivel = calcularFatorDedutivel(config);
  const valorDedutivel = valorBruto * fatorDedutivel;
  return {
    id: linha.id,
    nome: linha.nome,
    detalhe: linha.detalhe || '',
    categoria: linha.categoria || '',
    centroCusto: linha.centroCusto || '',
    valorBruto,
    config,
    fatorDedutivel,
    valorDedutivel,
    valorNaoDedutivel: valorBruto - valorDedutivel,
    link: linha.link || null,
  };
}

function filtrarLinhasPlano(linhas = [], { somenteEntraNoTotal = false } = {}) {
  return (linhas || []).filter((linha) => {
    if (somenteEntraNoTotal && linha.entraNoTotal === false) return false;
    return (Number(linha.valor) || 0) > 0;
  });
}

function mapaGruposPlano(planoConsolidado) {
  const mapa = {};
  for (const grupo of planoConsolidado?.grupos || []) {
    mapa[grupo.id] = grupo.items || [];
  }
  return mapa;
}

function montarSubsecaoDizimo(def, linhas, configItens, grupoId) {
  const filtradas = def.filtro ? linhas.filter(def.filtro) : linhas;
  const itens = filtradas.map((linha) => montarItemDizimo(linha, configItens, grupoId));
  return {
    id: def.id,
    label: def.label,
    itens,
    ...agregarTotais(itens),
  };
}

function montarSecaoDizimo(def, linhas, configItens) {
  if (def.subsecoes?.length) {
    const subsecoes = def.subsecoes.map((sub) => montarSubsecaoDizimo(sub, linhas, configItens, def.grupoId));
    const itens = subsecoes.flatMap((sub) => sub.itens);
    return {
      id: def.id,
      label: def.label,
      subsecoes,
      itens: [],
      ...agregarTotais(itens),
    };
  }

  const filtradas = filtrarLinhasPlano(linhas, { somenteEntraNoTotal: def.somenteEntraNoTotal });
  const itens = filtradas.map((linha) => montarItemDizimo(linha, configItens, def.grupoId));
  return {
    id: def.id,
    label: def.label,
    subsecoes: [],
    itens,
    ...agregarTotais(itens),
  };
}

/**
 * @param {object} planoConsolidado
 * @param {object} configItens — mapa itemId → { modo, percentual }
 */
export function montarDemonstrativoDizimo(planoConsolidado, configItens = {}) {
  const config = normalizarConfigDedutivelDizimo(configItens);
  const contexto = extrairContextoItensDizimo(planoConsolidado);
  const configResolvida = resolverConfigItensDizimo({
    configExplicita: config,
    configMesAnterior: {},
    ...contexto,
  });
  const resumo = planoConsolidado?.resumo || {};
  const lucroBruto = Number(resumo.lucroBruto) || 0;
  const gruposMap = mapaGruposPlano(planoConsolidado);

  const secoes = DIZIMO_SECOES.map((def) =>
    montarSecaoDizimo(def, gruposMap[def.grupoId] || [], configResolvida),
  );

  const totalOperacionalBruto = secoes.reduce((acc, sec) => acc + sec.valorBruto, 0);
  const totalDedutivel = secoes.reduce((acc, sec) => acc + sec.valorDedutivel, 0);
  const totalNaoDedutivel = secoes.reduce((acc, sec) => acc + sec.valorNaoDedutivel, 0);

  const lucroLiquidoOperacional = lucroBruto - totalDedutivel;
  const basePositiva = Math.max(0, lucroLiquidoOperacional);
  const dizimo = basePositiva * (DIZIMO_PERCENTUAL / 100);

  return {
    competencia: planoConsolidado?.competencia || '',
    margemDetalhe: planoConsolidado?.margemDetalhe || null,
    lucroBruto,
    secoes,
    totalOperacionalBruto,
    totalDedutivel,
    totalNaoDedutivel,
    lucroLiquidoOperacional,
    dizimo,
    percentualDizimo: DIZIMO_PERCENTUAL,
    resultadoOperacionalPlano: Number(resumo.resultadoOperacional) || 0,
  };
}
