/** Tipos de rubrica fixa no modelo/competência */
export const RUBRICA_TIPOS = {
  PROVENTO: 'provento',
  DESCONTO: 'desconto',
  ENCARGO_EMPRESA: 'encargo_empresa',
};

/** Movimentos variáveis durante o mês */
export const MOVIMENTO_TIPOS = {
  VALE: 'vale',
  HORA_EXTRA: 'hora_extra',
  COMISSAO_VENDA: 'comissao_venda',
  AJUSTE_PROVENTO: 'ajuste_provento',
  AJUSTE_DESCONTO: 'ajuste_desconto',
  FERIAS: 'ferias',
};

export const MOVIMENTO_LABELS = {
  vale: 'Vale / adiantamento',
  hora_extra: 'Hora extra',
  comissao_venda: 'Comissão / venda',
  ajuste_provento: 'Ajuste (+)',
  ajuste_desconto: 'Ajuste (−)',
  ferias: 'Férias',
};

/** Situação do pagamento do movimento (vale ligado ao fluxo de caixa) */
export const MOVIMENTO_STATUS_PAGAMENTO = {
  PENDENTE: 'pendente',
  PAGO: 'pago',
  CANCELADO: 'cancelado',
};

export const MOVIMENTO_STATUS_PAGAMENTO_LABELS = {
  pendente: 'Em aberto',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

export const RUBRICA_LABELS = {
  provento: 'Provento',
  desconto: 'Desconto',
  encargo_empresa: 'Encargo empresa',
};

export const SITUACAO_FOLHA = {
  ATIVO: 'ativo',
  DESLIGADO: 'desligado',
};

export const SITUACAO_FOLHA_LABELS = {
  ativo: 'Ativo',
  desligado: 'Desligou',
};

export const TIPO_VINCULO = {
  FUNCIONARIO: 'funcionario',
  SOCIO: 'socio',
};

export const TIPO_VINCULO_LABELS = {
  funcionario: 'Funcionário',
  socio: 'Sócio',
};

export const CLASSIFICACAO_DESPESA_FOLHA = {
  DIRETA: 'direta',
  INDIRETA: 'indireta',
};

export const CLASSIFICACAO_DESPESA_FOLHA_LABELS = {
  direta: 'Direta do negócio',
  indireta: 'Indireta / apoio',
};

export const RETIRADA_FREQUENCIA = {
  SEMANAL: 'semanal',
  MENSAL: 'mensal',
};

export const RETIRADA_FREQUENCIA_LABELS = {
  semanal: 'Semanal',
  mensal: 'Mensal',
};

/** Rubricas padrão para funcionário */
export const RUBRICAS_MODELO_PADRAO = [
  { tipo: 'provento', nome: 'Salário base', valor_base: 0, ordem: 1 },
  { tipo: 'provento', nome: 'Comissões', valor_base: 0, ordem: 2 },
  { tipo: 'desconto', nome: 'INSS', valor_base: 0, ordem: 3 },
  { tipo: 'encargo_empresa', nome: 'FGTS', valor_base: 0, ordem: 4 },
  { tipo: 'encargo_empresa', nome: 'INSS patronal', valor_base: 0, ordem: 5 },
];

/** Rubricas padrão para sócio (retirada configurada à parte) */
export const RUBRICAS_MODELO_PADRAO_SOCIO = [
  { tipo: 'provento', nome: 'Pró-labore', valor_base: 0, ordem: 1 },
];

export const DECIMO_PADRAO = {
  decimo_terceiro_ativo: true,
  decimo_mes_parcela_1: 11,
  decimo_mes_parcela_2: 12,
  decimo_percentual_parcela: 50,
};

export function gerarIdInterno(prefix = 'rub') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function gerarGrupoLancamentoId() {
  return `grp-folha-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatCompetenciaLabel(competencia) {
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return competencia || '';
  const [y, m] = competencia.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[Number(m) - 1]}/${y}`;
}

export function formatDataBr(data) {
  if (!data) return '';
  const s = String(data).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

export function getCompetenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Pagamento fixo: dia 5 do mês seguinte à competência */
export const FOLHA_DIA_VENCIMENTO = 5;

export function dataHojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Último dia civil da competência (YYYY-MM) */
export function ultimoDiaCompetencia(competencia) {
  const [y, m] = String(competencia).slice(0, 7).split('-').map(Number);
  if (!y || !m) return null;
  const ultimo = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
}

/** Vencimento no fluxo: dia 5 do mês após a competência */
export function dataVencimentoPagamentoFolha(competencia) {
  const [y, m] = String(competencia).slice(0, 7).split('-').map(Number);
  if (!y || !m) return null;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-${String(FOLHA_DIA_VENCIMENTO).padStart(2, '0')}`;
}

/** Após o último dia do mês a folha fecha automaticamente */
export function competenciaDeveEstarFechada(competencia, hojeIso = dataHojeIso()) {
  const fim = ultimoDiaCompetencia(competencia);
  return fim ? hojeIso > fim : false;
}

export function statusCompetenciaEfetivo(comp, hojeIso = dataHojeIso()) {
  if (!comp) return 'rascunho';
  if (comp._modoPlanejamento) return 'planejamento';
  if (comp.status === 'fechado') return 'fechado';
  if (competenciaDeveEstarFechada(comp.competencia, hojeIso)) return 'fechado';
  return 'rascunho';
}

export function competenciaEstaFechada(comp, hojeIso = dataHojeIso()) {
  if (comp?._modoPlanejamento) return false;
  return statusCompetenciaEfetivo(comp, hojeIso) === 'fechado';
}

export function isCompetenciaPlanejamento(comp) {
  return Boolean(comp?._modoPlanejamento);
}

export function isCompetenciaFutura(competencia, ref = getCompetenciaAtual()) {
  return String(competencia).slice(0, 7) > ref;
}

/** Previsão virtual a partir do modelo (mês ainda não aberto no sistema). */
export function criarCompetenciaPlanejada(modelo, competencia) {
  return {
    id: `planej-${modelo.colaborador_id}-${competencia}`,
    colaborador_id: modelo.colaborador_id,
    colaborador_nome: modelo.colaborador_nome || modelo.nome,
    tipo_vinculo: modelo.tipo_vinculo || TIPO_VINCULO.FUNCIONARIO,
    modelo_id: modelo.id,
    modelo_nome: modelo.nome,
    competencia,
    dia_vencimento: FOLHA_DIA_VENCIMENTO,
    status: 'rascunho',
    situacao_mes: isMesDesligamento(modelo, competencia) ? 'ultimo_mes' : 'normal',
    rubricas: clonarRubricas(modelo.rubricas?.length ? modelo.rubricas : criarRubricasPadrao(modelo.tipo_vinculo)),
    movimentos: [],
    _modoPlanejamento: true,
  };
}

/**
 * Mescla competências abertas no banco com linhas de planejamento (modelos ativos sem registro do mês).
 */
export function montarCompetenciasVisao(competenciaMes, modelos, competenciasPersistidas = []) {
  const byColaborador = {};
  for (const c of competenciasPersistidas || []) {
    if (c.colaborador_id) {
      byColaborador[c.colaborador_id] = { ...c, _modoPlanejamento: false };
    }
  }

  for (const modelo of modelos || []) {
    if (!modelo.colaborador_id || modelo.ativo === false) continue;
    if (!modeloEstaAtivoNaCompetencia(modelo, competenciaMes)) continue;
    if (byColaborador[modelo.colaborador_id]) continue;
    byColaborador[modelo.colaborador_id] = criarCompetenciaPlanejada(modelo, competenciaMes);
  }

  return Object.values(byColaborador).sort((a, b) =>
    (a.colaborador_nome || '').localeCompare(b.colaborador_nome || '', 'pt-BR'),
  );
}

export function formatCicloFolhaCompetencia(competencia) {
  const fim = ultimoDiaCompetencia(competencia);
  const venc = dataVencimentoPagamentoFolha(competencia);
  if (!fim || !venc) return '';
  return `Fecha ${formatDataBr(fim)} · Paga ${formatDataBr(venc)}`;
}

export function shiftCompetencia(competencia, delta) {
  const [y, m] = competencia.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function competenciaParaMes(competencia) {
  return parseInt(String(competencia).slice(5, 7), 10);
}

/** Semanas no mês (para retirada semanal de sócio) */
export function semanasNoMes(competencia) {
  const [y, m] = String(competencia).slice(0, 7).split('-').map(Number);
  if (!y || !m) return 4;
  const dias = new Date(y, m, 0).getDate();
  return Math.max(4, Math.min(5, Math.ceil(dias / 7)));
}

export function isSocio(modeloOrComp) {
  return (modeloOrComp?.tipo_vinculo || TIPO_VINCULO.FUNCIONARIO) === TIPO_VINCULO.SOCIO;
}

export function valorRetiradaSocioNoMes(modelo, competenciaStr) {
  const valor = Number(modelo?.retirada_valor_fixo) || 0;
  if (valor <= 0 || !isSocio(modelo)) return 0;
  const freq = modelo.retirada_frequencia || RETIRADA_FREQUENCIA.MENSAL;
  if (freq === RETIRADA_FREQUENCIA.SEMANAL) {
    return valor * semanasNoMes(competenciaStr);
  }
  return valor;
}

export function formatCurrency(value) {
  return `R$ ${(Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Salário base = rubrica "Salário base" ou maior provento fixo */
export function obterSalarioBase(rubricas) {
  const lista = rubricas || [];
  const salario = lista.find(
    (r) => r.tipo === RUBRICA_TIPOS.PROVENTO && /sal[aá]rio/i.test(r.nome || ''),
  );
  if (salario) return Number(salario.valor_base) || 0;
  const proventos = lista.filter((r) => r.tipo === RUBRICA_TIPOS.PROVENTO);
  if (!proventos.length) return 0;
  return Math.max(...proventos.map((r) => Number(r.valor_base) || 0));
}

export function modeloEstaAtivoNaCompetencia(modelo, competencia) {
  if (!modelo) return true;

  const entrada = parseDataIso(modelo?.data_entrada);
  if (entrada && competencia < entrada.slice(0, 7)) return false;

  if (modelo.situacao === SITUACAO_FOLHA.DESLIGADO && modelo.data_desligamento) {
    const mesDeslig = String(modelo.data_desligamento).slice(0, 7);
    return competencia <= mesDeslig;
  }
  return modelo.ativo !== false && modelo.situacao !== SITUACAO_FOLHA.DESLIGADO;
}

export function isMesDesligamento(modelo, competencia) {
  if (!modelo?.data_desligamento) return false;
  return String(modelo.data_desligamento).slice(0, 7) === competencia;
}

export function isMesEntrada(modelo, competencia) {
  const entrada = parseDataIso(modelo?.data_entrada);
  if (!entrada) return false;
  return entrada.slice(0, 7) === competencia;
}

/** YYYY-MM-DD válido ou null */
export function parseDataIso(data) {
  if (!data) return null;
  const s = String(data).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function diasNoMes(competencia) {
  const fim = ultimoDiaCompetencia(competencia);
  if (!fim) return 30;
  return parseInt(fim.slice(8, 10), 10);
}

/**
 * Dias trabalhados na competência (entrada e desligamento). Sem data_entrada = mês integral no início.
 */
export function diasTrabalhadosNaCompetencia(modelo, competencia) {
  const diasMes = diasNoMes(competencia);
  let inicio = 1;
  let fim = diasMes;

  const entrada = parseDataIso(modelo?.data_entrada);
  if (entrada) {
    const mesEntrada = entrada.slice(0, 7);
    if (competencia < mesEntrada) return 0;
    if (competencia === mesEntrada) {
      inicio = Math.max(inicio, parseInt(entrada.slice(8, 10), 10));
    }
  }

  const deslig = parseDataIso(modelo?.data_desligamento);
  if (deslig && modelo?.situacao === SITUACAO_FOLHA.DESLIGADO) {
    const mesDeslig = deslig.slice(0, 7);
    if (competencia > mesDeslig) return 0;
    if (competencia === mesDeslig) {
      fim = Math.min(fim, parseInt(deslig.slice(8, 10), 10));
    }
  }

  if (fim < inicio) return 0;
  return fim - inicio + 1;
}

/** Fator 0–1 para salário/retirada/encargos no mês. Sem data_entrada = 1 (legado). */
export function fatorProporcionalCompetencia(modelo, competencia) {
  const diasMes = diasNoMes(competencia);
  const diasTrab = diasTrabalhadosNaCompetencia(modelo, competencia);
  if (diasTrab <= 0) return 0;
  if (!parseDataIso(modelo?.data_entrada) && diasTrab >= diasMes) return 1;
  return diasTrab / diasMes;
}

/**
 * Avos trabalhados no ano civil até o mês da competência (regra CLT: ≥15 dias no mês de entrada = mês integral).
 * Sem data_entrada retorna o número do mês (legado com 13º cheio nas parcelas).
 */
export function avosTrabalhadosNoAno(modelo, competencia) {
  const ano = parseInt(String(competencia).slice(0, 4), 10);
  const mesPagamento = competenciaParaMes(competencia);
  const entrada = parseDataIso(modelo?.data_entrada);

  if (!entrada) return mesPagamento;

  const anoEntrada = parseInt(entrada.slice(0, 4), 10);
  const mesEntrada = parseInt(entrada.slice(5, 7), 10);
  const diaEntrada = parseInt(entrada.slice(8, 10), 10);

  if (ano < anoEntrada) return 0;
  if (ano > anoEntrada) return mesPagamento;

  let avos = 0;
  for (let m = mesEntrada; m <= mesPagamento; m += 1) {
    const compMes = `${ano}-${String(m).padStart(2, '0')}`;
    if (m === mesEntrada) {
      const diasMes = diasNoMes(compMes);
      const diasTrab = diasMes - diaEntrada + 1;
      if (diasTrab >= 15) avos += 1;
      else avos += diasTrab / diasMes;
    } else {
      avos += 1;
    }
  }
  return avos;
}

/** Fator proporcional do 13º no ano. Sem data_entrada = 1 (legado). */
export function fatorDecimoTerceiroProporcional(modelo, competencia) {
  if (!parseDataIso(modelo?.data_entrada)) return 1;
  const avos = avosTrabalhadosNoAno(modelo, competencia);
  return Math.min(1, avos / 12);
}

/** Competência (YYYY-MM) em que completa 12 meses e passa a ter direito a férias. */
export function competenciaDireitoFerias(modelo) {
  const entrada = parseDataIso(modelo?.data_entrada);
  if (!entrada) return null;
  const [y, m, d] = entrada.split('-').map(Number);
  const dt = new Date(y, m - 1 + 12, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function resumoProporcionalCompetencia(modelo, competencia) {
  if (!parseDataIso(modelo?.data_entrada)) return null;
  const fator = fatorProporcionalCompetencia(modelo, competencia);
  if (fator >= 1) return null;
  const dias = diasTrabalhadosNaCompetencia(modelo, competencia);
  const total = diasNoMes(competencia);
  return `${dias}/${total} dias`;
}

function sumRubricas(rubricas, tipo) {
  return (rubricas || [])
    .filter((r) => r.tipo === tipo)
    .reduce((acc, r) => acc + (Number(r.valor_base) || 0), 0);
}

export function statusPagamentoMovimento(movimento) {
  return movimento?.status_pagamento || MOVIMENTO_STATUS_PAGAMENTO.PAGO;
}

export function movimentoAtivoNoCalculo(movimento) {
  return statusPagamentoMovimento(movimento) !== MOVIMENTO_STATUS_PAGAMENTO.CANCELADO;
}

function sumMovimentos(movimentos, tipos, { apenasStatus } = {}) {
  return (movimentos || [])
    .filter((m) => tipos.includes(m.tipo) && movimentoAtivoNoCalculo(m))
    .filter((m) => {
      if (!apenasStatus?.length) return true;
      return apenasStatus.includes(statusPagamentoMovimento(m));
    })
    .reduce((acc, m) => acc + Math.abs(Number(m.valor) || 0), 0);
}

/**
 * Provisões automáticas: 13º (nov/dez), férias programadas, rescisão no desligamento.
 */
export function calcularProvisoesEventos(competencia, modelo) {
  const provisoes = [];
  if (!modelo) return provisoes;

  const competenciaStr = typeof competencia === 'string' ? competencia : competencia?.competencia;
  if (!competenciaStr) return provisoes;

  const rubricas = competencia?.rubricas || modelo?.rubricas || [];
  const salarioBase = obterSalarioBase(rubricas);
  const mesNum = competenciaParaMes(competenciaStr);
  const socio = isSocio(modelo);
  const fatorMes = fatorProporcionalCompetencia(modelo, competenciaStr);
  const fatorDecimo = fatorDecimoTerceiroProporcional(modelo, competenciaStr);

  if (!socio && modelo.decimo_terceiro_ativo !== false && salarioBase > 0) {
    const p1 = modelo.decimo_mes_parcela_1 ?? DECIMO_PADRAO.decimo_mes_parcela_1;
    const p2 = modelo.decimo_mes_parcela_2 ?? DECIMO_PADRAO.decimo_mes_parcela_2;
    const pct = (modelo.decimo_percentual_parcela ?? DECIMO_PADRAO.decimo_percentual_parcela) / 100;

    if (mesNum === p1) {
      provisoes.push({
        id: `decimo-1-${competenciaStr}`,
        tipo: 'provento',
        nome: '13º salário — 1ª parcela',
        valor: salarioBase * pct * fatorDecimo,
        categoria: 'decimo_terceiro',
      });
    }
    if (mesNum === p2) {
      provisoes.push({
        id: `decimo-2-${competenciaStr}`,
        tipo: 'provento',
        nome: '13º salário — 2ª parcela',
        valor: salarioBase * pct * fatorDecimo,
        categoria: 'decimo_terceiro',
      });
    }
  }

  for (const f of modelo.ferias_programadas || []) {
    if (f.status === 'cancelado') continue;
    if (f.competencia_prevista === competenciaStr) {
      provisoes.push({
        id: f.id || `ferias-${f.competencia_prevista}`,
        tipo: 'provento',
        nome: f.descricao || 'Férias',
        valor: (Number(f.valor_previsto) || 0) * fatorMes,
        categoria: 'ferias',
      });
    }
  }

  const retiradaSocio = valorRetiradaSocioNoMes(modelo, competenciaStr) * fatorMes;
  if (retiradaSocio > 0) {
    const freq = modelo.retirada_frequencia || RETIRADA_FREQUENCIA.MENSAL;
    const detalhe =
      freq === RETIRADA_FREQUENCIA.SEMANAL
        ? ` (${semanasNoMes(competenciaStr)}× ${formatCurrency(modelo.retirada_valor_fixo)})`
        : '';
    provisoes.push({
      id: `retirada-socio-${competenciaStr}`,
      tipo: 'provento',
      nome: `Retirada sócio${detalhe}`,
      valor: retiradaSocio,
      categoria: 'retirada_socio',
    });
  }

  if (isMesDesligamento(modelo, competenciaStr)) {
    const rescisao = Number(modelo.valor_rescisao_previsto) || 0;
    if (rescisao > 0) {
      provisoes.push({
        id: `rescisao-${competenciaStr}`,
        tipo: 'provento',
        nome: 'Rescisão / verbas (previsto)',
        valor: rescisao,
        categoria: 'rescisao',
      });
    }
  }

  return provisoes;
}

/**
 * Calcula totais de uma competência (inclui 13º, férias e rescisão via modelo).
 */
export function calcularTotaisCompetencia(competencia, modelo = null) {
  const rubricas = competencia?.rubricas || [];
  const movimentos = competencia?.movimentos || [];
  const provisoes = calcularProvisoesEventos(competencia, modelo);
  const competenciaStr =
    typeof competencia === 'string' ? competencia : competencia?.competencia;
  const fatorMes =
    modelo && competenciaStr ? fatorProporcionalCompetencia(modelo, competenciaStr) : 1;

  const proventosFixos = sumRubricas(rubricas, RUBRICA_TIPOS.PROVENTO) * fatorMes;
  const descontosFixos = sumRubricas(rubricas, RUBRICA_TIPOS.DESCONTO) * fatorMes;
  const encargosEmpresa = sumRubricas(rubricas, RUBRICA_TIPOS.ENCARGO_EMPRESA) * fatorMes;

  const proventosEventos = provisoes
    .filter((p) => p.tipo === 'provento')
    .reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

  const movProventos = sumMovimentos(movimentos, [
    MOVIMENTO_TIPOS.HORA_EXTRA,
    MOVIMENTO_TIPOS.AJUSTE_PROVENTO,
    MOVIMENTO_TIPOS.FERIAS,
  ]);
  const movDescontos = sumMovimentos(movimentos, [
    MOVIMENTO_TIPOS.VALE,
    MOVIMENTO_TIPOS.COMISSAO_VENDA,
    MOVIMENTO_TIPOS.AJUSTE_DESCONTO,
  ]);

  const proventos = proventosFixos + proventosEventos + movProventos;
  const descontos = descontosFixos + movDescontos;
  const liquido = proventos - descontos;
  const custoTotalEmpresa = liquido + encargosEmpresa;

  const totalVales = sumMovimentos(movimentos, [MOVIMENTO_TIPOS.VALE]);
  const totalValesPendentes = sumMovimentos(movimentos, [MOVIMENTO_TIPOS.VALE], {
    apenasStatus: [MOVIMENTO_STATUS_PAGAMENTO.PENDENTE],
  });
  const totalValesPagos = sumMovimentos(movimentos, [MOVIMENTO_TIPOS.VALE], {
    apenasStatus: [MOVIMENTO_STATUS_PAGAMENTO.PAGO],
  });
  const totalHorasExtra = sumMovimentos(movimentos, [MOVIMENTO_TIPOS.HORA_EXTRA]);
  const totalComissoes = sumMovimentos(movimentos, [MOVIMENTO_TIPOS.COMISSAO_VENDA]);
  const totalDecimo = provisoes
    .filter((p) => p.categoria === 'decimo_terceiro')
    .reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const totalFerias = provisoes
    .filter((p) => p.categoria === 'ferias')
    .reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  const totalRetiradaSocio = provisoes
    .filter((p) => p.categoria === 'retirada_socio')
    .reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

  return {
    proventosFixos,
    descontosFixos,
    encargosEmpresa,
    proventosEventos,
    movProventos,
    movDescontos,
    proventos,
    descontos,
    liquido,
    custoTotalEmpresa,
    totalVales,
    totalValesPendentes,
    totalValesPagos,
    totalHorasExtra,
    totalComissoes,
    totalDecimo,
    totalFerias,
    totalRetiradaSocio,
    provisoes,
    tipoVinculo: modelo?.tipo_vinculo || competencia?.tipo_vinculo || TIPO_VINCULO.FUNCIONARIO,
    desligado: modelo?.situacao === SITUACAO_FOLHA.DESLIGADO,
    mesDesligamento: isMesDesligamento(modelo, competencia?.competencia),
    mesEntrada: isMesEntrada(modelo, competenciaStr),
    fatorProporcional: fatorMes,
    resumoProporcional:
      modelo && competenciaStr ? resumoProporcionalCompetencia(modelo, competenciaStr) : null,
  };
}

/** Agrega totais de várias competências com mapa de modelos por colaborador */
export function calcularTotaisGrupo(competencias, modelosPorColaborador = {}) {
  const lista = Array.isArray(competencias) ? competencias : [];
  return lista.reduce(
    (acc, c) => {
      const modelo = modelosPorColaborador[c.colaborador_id] || null;
      const t = calcularTotaisCompetencia(c, modelo);
      acc.proventos += t.proventos;
      acc.descontos += t.descontos;
      acc.liquido += t.liquido;
      acc.encargosEmpresa += t.encargosEmpresa;
      acc.custoTotalEmpresa += t.custoTotalEmpresa;
      acc.totalVales += t.totalVales;
      acc.totalValesPendentes += t.totalValesPendentes;
      acc.totalDecimo += t.totalDecimo;
      acc.totalFerias += t.totalFerias;
      acc.totalRetiradaSocio += t.totalRetiradaSocio;
      if (t.desligado) acc.desligados += 1;
      acc.count += 1;
      return acc;
    },
    {
      proventos: 0,
      descontos: 0,
      liquido: 0,
      encargosEmpresa: 0,
      custoTotalEmpresa: 0,
      totalVales: 0,
      totalValesPendentes: 0,
      totalDecimo: 0,
      totalFerias: 0,
      totalRetiradaSocio: 0,
      desligados: 0,
      count: 0,
    },
  );
}

/** Projeção de caixa: soma custo por mês para todos os modelos ativos */
export function calcularProjecaoCaixa(modelos, meses = 12, competenciaInicio = null) {
  const inicio = competenciaInicio || getCompetenciaAtual();
  const modelosVinculados = (modelos || []).filter((m) => m.colaborador_id && m.ativo !== false);

  const linhas = [];
  for (let i = 0; i < meses; i += 1) {
    const competencia = shiftCompetencia(inicio, i);
    let liquido = 0;
    let custoTotal = 0;
    let decimo = 0;
    let ferias = 0;
    let retiradasSocio = 0;
    let custoSocios = 0;
    let custoFuncionarios = 0;
    let adicionalFeriasEstimado = 0;
    let ativos = 0;

    for (const modelo of modelosVinculados) {
      if (!modeloEstaAtivoNaCompetencia(modelo, competencia)) continue;
      ativos += 1;
      const fakeComp = {
        competencia,
        rubricas: modelo.rubricas || [],
        movimentos: [],
      };
      const t = calcularTotaisCompetencia(fakeComp, modelo);
      const ehFuncionario =
        (modelo?.tipo_vinculo || TIPO_VINCULO.FUNCIONARIO) === TIPO_VINCULO.FUNCIONARIO;
      const salarioBaseFuncionario = ehFuncionario ? extrairSalarioBase(modelo) : 0;
      const fatorMes = fatorProporcionalCompetencia(modelo, competencia);
      // Provisão mensal do 1/3 adicional de férias: (salário / 3) / 12 = salário / 36.
      const provisaoTercoFeriasMensal = salarioBaseFuncionario > 0
        ? (salarioBaseFuncionario / 36) * fatorMes
        : 0;
      const custoTotalComProvisao = t.custoTotalEmpresa + provisaoTercoFeriasMensal;

      liquido += t.liquido;
      custoTotal += custoTotalComProvisao;
      decimo += t.totalDecimo;
      ferias += t.totalFerias;
      retiradasSocio += t.totalRetiradaSocio;
      adicionalFeriasEstimado += provisaoTercoFeriasMensal;
      if ((modelo?.tipo_vinculo || TIPO_VINCULO.FUNCIONARIO) === TIPO_VINCULO.SOCIO) {
        custoSocios += custoTotalComProvisao;
      } else {
        custoFuncionarios += custoTotalComProvisao;
      }
    }

    linhas.push({
      competencia,
      liquido,
      custoTotal,
      decimo,
      ferias,
      retiradasSocio,
      adicionalFeriasEstimado,
      custoSocios,
      custoFuncionarios,
      ativos,
    });
  }
  return linhas;
}

function resolverChaveCentroCusto(modelo, centrosRegistradosSet) {
  const centro = String(modelo?.centro_custo || '').trim();
  if (centro && centrosRegistradosSet?.has(centro.toLocaleLowerCase('pt-BR'))) return centro;
  return '__sem__';
}

function resolverNomePessoaFolha(modelo, colaboradoresMap = {}) {
  return (
    colaboradoresMap[modelo?.colaborador_id]?.nome ||
    modelo?.colaborador_nome ||
    modelo?.nome ||
    'Pessoa'
  );
}

/**
 * Projeção de 12 meses para uma pessoa: média mensal recorrente (sem 13º/férias)
 * e totais anuais de 13º e férias programadas.
 */
export function calcularProjecaoPessoaFolha(modelo, meses = 12, competenciaInicio = null) {
  const inicio = competenciaInicio || getCompetenciaAtual();
  let somaMensalRecorrente = 0;
  let mesesAtivos = 0;
  let totalDecimo = 0;
  let totalFerias = 0;

  for (let i = 0; i < meses; i += 1) {
    const competencia = shiftCompetencia(inicio, i);
    if (!modeloEstaAtivoNaCompetencia(modelo, competencia)) continue;

    mesesAtivos += 1;
    const fakeComp = {
      competencia,
      rubricas: modelo.rubricas || [],
      movimentos: [],
    };
    const t = calcularTotaisCompetencia(fakeComp, modelo);
    somaMensalRecorrente += Math.max(0, t.custoTotalEmpresa - t.totalDecimo - t.totalFerias);
    totalDecimo += t.totalDecimo;
    totalFerias += t.totalFerias;
  }

  return {
    mediaMensal: mesesAtivos > 0 ? somaMensalRecorrente / mesesAtivos : 0,
    totalDecimo,
    totalFerias,
    mesesAtivos,
  };
}

/**
 * Relatório agrupado por centro de custo com média mensal por pessoa (12 meses).
 */
export function calcularRelatorioFolhaPorCentroCusto({
  modelos = [],
  centrosRegistrados = [],
  colaboradoresMap = {},
  competenciaInicio = null,
  meses = 12,
  filtrarModelo = null,
} = {}) {
  const inicio = competenciaInicio || getCompetenciaAtual();
  const centrosSet = new Set(
    (centrosRegistrados || []).map((c) => String(c).trim().toLocaleLowerCase('pt-BR')),
  );
  const chaves = [...(centrosRegistrados || []), '__sem__'];
  const mapaSecoes = Object.fromEntries(chaves.map((c) => [c || '__sem__', []]));

  let totalMediaMensal = 0;
  let totalDecimo = 0;
  let totalFerias = 0;

  const lista = (modelos || []).filter((m) => m?.colaborador_id && m.ativo !== false);
  for (const modelo of lista) {
    if (typeof filtrarModelo === 'function' && !filtrarModelo(modelo)) continue;

    const projecao = calcularProjecaoPessoaFolha(modelo, meses, inicio);
    if (projecao.mesesAtivos === 0) continue;

    const chave = resolverChaveCentroCusto(modelo, centrosSet);
    const linha = {
      id: modelo.id,
      nome: resolverNomePessoaFolha(modelo, colaboradoresMap),
      tipo: modelo.tipo_vinculo || TIPO_VINCULO.FUNCIONARIO,
      tipoLabel: TIPO_VINCULO_LABELS[modelo.tipo_vinculo || TIPO_VINCULO.FUNCIONARIO],
      mediaMensal: projecao.mediaMensal,
      totalDecimo: projecao.totalDecimo,
      totalFerias: projecao.totalFerias,
    };

    if (!mapaSecoes[chave]) mapaSecoes[chave] = [];
    mapaSecoes[chave].push(linha);

    totalMediaMensal += linha.mediaMensal;
    totalDecimo += linha.totalDecimo;
    totalFerias += linha.totalFerias;
  }

  const secoes = chaves
    .map((centro) => {
      const chave = centro || '__sem__';
      const pessoas = (mapaSecoes[chave] || []).sort((a, b) =>
        ordenarTextoPtBr(a.nome, b.nome),
      );
      if (!pessoas.length) return null;
      const subtotalMediaMensal = pessoas.reduce((acc, p) => acc + p.mediaMensal, 0);
      return {
        chave,
        titulo: chave === '__sem__' ? 'Sem centro de custo' : centro,
        pessoas,
        subtotalMediaMensal,
      };
    })
    .filter(Boolean);

  return {
    competenciaInicio: inicio,
    meses,
    secoes,
    resumo: {
      totalMediaMensal,
      totalDecimo,
      totalFerias,
      totalPessoas: secoes.reduce((acc, s) => acc + s.pessoas.length, 0),
    },
  };
}

export function mapaModelosPorColaborador(modelos) {
  const map = {};
  for (const m of modelos || []) {
    if (m.colaborador_id) map[m.colaborador_id] = m;
  }
  return map;
}

/** Valor principal de provento (salário ou pró-labore) para exibição. */
export function extrairSalarioBase(modelo) {
  const rubricas = modelo?.rubricas || [];
  const alvo = rubricas.find(
    (r) =>
      r.tipo === RUBRICA_TIPOS.PROVENTO &&
      /salário|salario|pró-labore|pro-labore|provento/i.test(String(r.nome || '')),
  );
  if (alvo) return Number(alvo.valor_base) || 0;
  const primeiro = rubricas.find((r) => r.tipo === RUBRICA_TIPOS.PROVENTO);
  return Number(primeiro?.valor_base) || 0;
}

export function aplicarSalarioBaseNasRubricas(rubricas, valor, tipoVinculo = TIPO_VINCULO.FUNCIONARIO) {
  const nomeAlvo = tipoVinculo === TIPO_VINCULO.SOCIO ? 'Pró-labore' : 'Salário base';
  const lista = [...(rubricas?.length ? rubricas : criarRubricasPadrao(tipoVinculo))];
  const idx = lista.findIndex(
    (r) =>
      r.tipo === RUBRICA_TIPOS.PROVENTO &&
      (r.nome === nomeAlvo || /salário|salario|pró-labore|pro-labore/i.test(String(r.nome || ''))),
  );
  if (idx >= 0) {
    lista[idx] = { ...lista[idx], nome: nomeAlvo, valor_base: Number(valor) || 0 };
  } else {
    lista.unshift({
      id: gerarIdInterno('rub'),
      tipo: RUBRICA_TIPOS.PROVENTO,
      nome: nomeAlvo,
      valor_base: Number(valor) || 0,
      ordem: 1,
    });
  }
  return lista;
}

export function clonarRubricas(rubricas) {
  return (rubricas || []).map((r) => ({
    ...r,
    id: gerarIdInterno('rub'),
  }));
}

export function criarRubricasPadrao(tipoVinculo = TIPO_VINCULO.FUNCIONARIO) {
  const base = tipoVinculo === TIPO_VINCULO.SOCIO ? RUBRICAS_MODELO_PADRAO_SOCIO : RUBRICAS_MODELO_PADRAO;
  return base.map((r) => ({
    ...r,
    id: gerarIdInterno('rub'),
  }));
}

export function criarModeloComDefaults(extra = {}) {
  const tipo = extra.tipo_vinculo || TIPO_VINCULO.FUNCIONARIO;
  const socio = tipo === TIPO_VINCULO.SOCIO;
  const custoDiretoExtra =
    typeof extra.custo_direto === 'boolean'
      ? extra.custo_direto
      : extra.classificacao_despesa === CLASSIFICACAO_DESPESA_FOLHA.INDIRETA
        ? false
        : true;
  return {
    dia_vencimento: FOLHA_DIA_VENCIMENTO,
    ativo: true,
    situacao: SITUACAO_FOLHA.ATIVO,
    tipo_vinculo: tipo,
    retirada_frequencia: RETIRADA_FREQUENCIA.MENSAL,
    retirada_valor_fixo: 0,
    ...DECIMO_PADRAO,
    decimo_terceiro_ativo: socio ? false : true,
    centro_custo: '',
    centro_custo_id: '',
    custo_direto: custoDiretoExtra,
    classificacao_despesa: custoDiretoExtra
      ? CLASSIFICACAO_DESPESA_FOLHA.DIRETA
      : CLASSIFICACAO_DESPESA_FOLHA.INDIRETA,
    ferias_programadas: [],
    rubricas: criarRubricasPadrao(tipo),
    ...extra,
  };
}

/** Filtra competências por tipo de vínculo (funcionário / sócio) */
export function filtrarCompetenciasPorTipo(competencias, modelosMap, filtro) {
  if (!filtro || filtro === 'todos') return competencias || [];
  return (competencias || []).filter((c) => {
    const tipo = modelosMap[c.colaborador_id]?.tipo_vinculo || c.tipo_vinculo || TIPO_VINCULO.FUNCIONARIO;
    return tipo === filtro;
  });
}

export function agruparCompetenciasPorTipo(competencias, modelosMap) {
  const funcionarios = [];
  const socios = [];
  for (const c of competencias || []) {
    const tipo = modelosMap[c.colaborador_id]?.tipo_vinculo || c.tipo_vinculo || TIPO_VINCULO.FUNCIONARIO;
    if (tipo === TIPO_VINCULO.SOCIO) socios.push(c);
    else funcionarios.push(c);
  }
  return {
    funcionarios: ordenarCompetenciasPorNome(funcionarios, modelosMap),
    socios: ordenarCompetenciasPorNome(socios, modelosMap),
  };
}

function ordenarTextoPtBr(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
}

export function nomeColaboradorCompetencia(competencia, modelosMap = {}) {
  return (
    competencia?.colaborador_nome ||
    modelosMap[competencia?.colaborador_id]?.colaborador_nome ||
    modelosMap[competencia?.colaborador_id]?.nome ||
    ''
  );
}

export function centroCustoCompetencia(competencia, modelosMap = {}) {
  const modelo = modelosMap[competencia?.colaborador_id];
  return String(modelo?.centro_custo || competencia?.centro_custo || '').trim();
}

export function ordenarCompetenciasPorNome(competencias, modelosMap = {}) {
  return [...(competencias || [])].sort((a, b) =>
    ordenarTextoPtBr(nomeColaboradorCompetencia(a, modelosMap), nomeColaboradorCompetencia(b, modelosMap)),
  );
}

const CHAVE_SEM_CENTRO_CUSTO = '__sem__';

export function labelCentroCustoFolha(chave, nomeCentro = '') {
  if (chave === CHAVE_SEM_CENTRO_CUSTO || !String(nomeCentro || chave || '').trim()) {
    return 'Sem centro de custo';
  }
  return String(nomeCentro || chave).trim();
}

/** Agrupa competências por centro de custo (ordem alfabética; sem centro por último). */
export function agruparCompetenciasPorCentroCusto(competencias, modelosMap, centrosRegistrados = []) {
  const mapa = new Map();

  for (const c of competencias || []) {
    const centro = centroCustoCompetencia(c, modelosMap);
    const chave = centro ? centro : CHAVE_SEM_CENTRO_CUSTO;
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(c);
  }

  const centrosOrdenados = [...new Set((centrosRegistrados || []).map((n) => String(n || '').trim()).filter(Boolean))].sort(
    ordenarTextoPtBr,
  );
  const chavesExtras = [...mapa.keys()].filter((chave) => chave !== CHAVE_SEM_CENTRO_CUSTO && !centrosOrdenados.includes(chave));
  chavesExtras.sort(ordenarTextoPtBr);

  const chaves = [...centrosOrdenados.filter((c) => mapa.has(c)), ...chavesExtras];
  if (mapa.has(CHAVE_SEM_CENTRO_CUSTO)) chaves.push(CHAVE_SEM_CENTRO_CUSTO);

  return chaves
    .map((chave) => {
      const label = labelCentroCustoFolha(chave, chave === CHAVE_SEM_CENTRO_CUSTO ? '' : chave);
      const items = ordenarCompetenciasPorNome(mapa.get(chave), modelosMap);
      return { chave, label, items };
    })
    .filter((grupo) => grupo.items.length > 0);
}

/** Filtros da programação do mês — nome e centro de custo. */
export function filtrarCompetenciasPrevisao(competencias, modelosMap, { busca = '', centro = '' } = {}) {
  let lista = competencias || [];
  const termo = String(busca || '').trim().toLocaleLowerCase('pt-BR');

  if (termo) {
    lista = lista.filter((c) =>
      nomeColaboradorCompetencia(c, modelosMap).toLocaleLowerCase('pt-BR').includes(termo),
    );
  }

  const filtroCentro = String(centro || '').trim();
  if (filtroCentro && filtroCentro !== '__todos__') {
    lista = lista.filter((c) => {
      const cc = centroCustoCompetencia(c, modelosMap);
      if (filtroCentro === CHAVE_SEM_CENTRO_CUSTO) return !cc;
      return cc.toLocaleLowerCase('pt-BR') === filtroCentro.toLocaleLowerCase('pt-BR');
    });
  }

  return ordenarCompetenciasPorNome(lista, modelosMap);
}

export function ordenarPessoasFolhaPorCentroENome(lista = [], colaboradoresMap = {}) {
  return [...(lista || [])].sort((a, b) => {
    const centroA = String(a?.centro_custo || '').trim();
    const centroB = String(b?.centro_custo || '').trim();
    const temCentroA = centroA.length > 0;
    const temCentroB = centroB.length > 0;

    if (temCentroA && !temCentroB) return -1;
    if (!temCentroA && temCentroB) return 1;
    if (centroA && centroB) {
      const byCentro = ordenarTextoPtBr(centroA, centroB);
      if (byCentro !== 0) return byCentro;
    }

    const nomeA = colaboradoresMap[a?.colaborador_id]?.nome || a?.colaborador_nome || a?.nome || '';
    const nomeB = colaboradoresMap[b?.colaborador_id]?.nome || b?.colaborador_nome || b?.nome || '';
    return ordenarTextoPtBr(nomeA, nomeB);
  });
}
