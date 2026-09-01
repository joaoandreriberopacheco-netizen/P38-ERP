import { base44 } from '@/api/base44Client';
import { atualizarDadosEmpresa } from '@/lib/dadosEmpresaMerge';
import {
  calcularTotaisCompetencia,
  clonarRubricas,
  criarModeloComDefaults,
  criarRubricasPadrao,
  competenciaDeveEstarFechada,
  competenciaEstaFechada,
  dataVencimentoPagamentoFolha,
  FOLHA_DIA_VENCIMENTO,
  gerarGrupoLancamentoId,
  gerarIdInterno,
  isMesDesligamento,
  modeloEstaAtivoNaCompetencia,
  SITUACAO_FOLHA,
} from '@/lib/folhaPrevisaoCalculos';

export async function listarModelos() {
  return base44.entities.FolhaPrevisaoModelo.list('-created_date');
}

export async function listarCompetencias(competencia) {
  if (competencia) {
    return base44.entities.FolhaPrevisaoCompetencia.filter({ competencia }, '-colaborador_nome');
  }
  return base44.entities.FolhaPrevisaoCompetencia.list('-created_date');
}

export async function listarColaboradoresAtivos() {
  const todos = await base44.entities.Colaborador.list();
  return (todos || []).filter((c) => c.ativo !== false);
}

function normalizarNomeCentro(nome) {
  return String(nome || '').trim();
}

function ordenarNomesCentro(nomes) {
  return [...new Set((nomes || []).map(normalizarNomeCentro).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
  );
}

function ordenarCentrosRegistros(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ordemA = Number(a?.ordem) || 0;
    const ordemB = Number(b?.ordem) || 0;
    if (ordemA !== ordemB) return ordemA - ordemB;
    return normalizarNomeCentro(a?.nome).localeCompare(normalizarNomeCentro(b?.nome), 'pt-BR', {
      sensitivity: 'base',
    });
  });
}

/** Id legado sintético (antes da tabela FolhaCentroCusto). */
function isCentroCustoIdLegado(id) {
  return String(id || '').startsWith('cc:');
}

function idCentroCustoFromNome(nome) {
  return `cc:${normalizarNomeCentro(nome).toLocaleLowerCase('pt-BR')}`;
}

function enrichCentroCustoRecord(row, idx = 0) {
  const nome = normalizarNomeCentro(typeof row === 'string' ? row : row?.nome);
  if (!nome) return null;
  const idBruto = typeof row === 'object' && row?.id ? String(row.id) : '';
  return {
    id: idBruto || idCentroCustoFromNome(nome),
    nome,
    ativo: typeof row === 'object' && row ? row.ativo !== false : true,
    ordem:
      typeof row?.ordem === 'number'
        ? row.ordem
        : Number(row?.ordem) || idx,
  };
}

function normalizarCentroEntidade(row, idx = 0) {
  return enrichCentroCustoRecord(row, idx);
}

async function obterRegistroDadosEmpresa() {
  const dados = await base44.entities.DadosEmpresa.list();
  return dados?.[0] || null;
}

function extrairCentrosCustoDaEmpresa(empresa) {
  const rich = Array.isArray(empresa?.folha_centros_custo) ? empresa.folha_centros_custo : [];
  if (rich.length) {
    return ordenarCentrosRegistros(
      rich.map((row, idx) => enrichCentroCustoRecord(row, idx)).filter(Boolean),
    );
  }

  const legado = Array.isArray(empresa?.centros_custo_financeiros)
    ? empresa.centros_custo_financeiros
    : [];
  return ordenarCentrosRegistros(
    legado.map((nome, idx) => enrichCentroCustoRecord(nome, idx)).filter(Boolean),
  );
}

/** Espelho de nomes activos em DadosEmpresa — compat com código que ainda lê só o array. */
async function espelharCentrosEmDadosEmpresa(registros) {
  const ordenados = ordenarCentrosRegistros(registros);
  const centros_custo_financeiros = ordenarNomesCentro(
    ordenados.filter((row) => row.ativo !== false).map((row) => row.nome),
  );
  const folha_centros_custo = ordenados.map(({ id, nome, ativo, ordem }) => ({
    id,
    nome,
    ativo: ativo !== false,
    ordem: Number(ordem) || 0,
  }));
  await atualizarDadosEmpresa(base44, { folha_centros_custo, centros_custo_financeiros });
  return ordenados;
}

async function listarCentrosDaTabela() {
  try {
    const rows = await base44.entities.FolhaCentroCusto.list();
    return ordenarCentrosRegistros(
      (rows || []).map((row, idx) => normalizarCentroEntidade(row, idx)).filter(Boolean),
    );
  } catch (err) {
    console.warn('[folha] FolhaCentroCusto.list falhou — a usar DadosEmpresa:', err?.message || err);
    return null;
  }
}

async function migrarCentrosEmpresaParaTabela(empresa) {
  const legado = extrairCentrosCustoDaEmpresa(empresa);
  if (!legado.length) return [];

  const criados = [];
  for (let i = 0; i < legado.length; i += 1) {
    const row = legado[i];
    const saved = await base44.entities.FolhaCentroCusto.create({
      nome: row.nome,
      ativo: row.ativo !== false,
      ordem: Number(row.ordem) || i,
    });
    criados.push(normalizarCentroEntidade(saved, i));
  }
  await espelharCentrosEmDadosEmpresa(criados);
  return ordenarCentrosRegistros(criados);
}

export async function listarCentrosCustoRegistros() {
  const daTabela = await listarCentrosDaTabela();
  if (daTabela === null) {
    const empresa = await obterRegistroDadosEmpresa();
    return extrairCentrosCustoDaEmpresa(empresa);
  }
  if (daTabela.length) return daTabela;

  const empresa = await obterRegistroDadosEmpresa();
  const legado = extrairCentrosCustoDaEmpresa(empresa);
  if (!legado.length) return [];

  try {
    return await migrarCentrosEmpresaParaTabela(empresa);
  } catch (err) {
    console.warn('[folha] migração de centros para FolhaCentroCusto falhou:', err?.message || err);
    return legado;
  }
}

export async function listarCentrosCustoFinanceiros() {
  const registros = await listarCentrosCustoRegistros();
  return ordenarNomesCentro(
    registros.filter((row) => row.ativo !== false).map((row) => row.nome),
  );
}

export async function adicionarCentroCustoFinanceiro(nome) {
  await salvarCentroCustoRegistro({ nome });
  return listarCentrosCustoFinanceiros();
}

export async function salvarCentroCustoRegistro({ id = null, nome, ativo = true, ordem }) {
  const nomeLimpo = normalizarNomeCentro(nome);
  if (!nomeLimpo) throw new Error('Informe o nome do centro de custo.');

  const todos = await listarCentrosCustoRegistros();
  const chaveNova = nomeLimpo.toLocaleLowerCase('pt-BR');
  const dup = todos.find(
    (row) =>
      row.id !== id &&
      normalizarNomeCentro(row?.nome).toLocaleLowerCase('pt-BR') === chaveNova,
  );
  if (dup) throw new Error('Já existe um centro com este nome.');

  const body = {
    nome: nomeLimpo,
    ativo: ativo !== false,
    ...(typeof ordem === 'number' ? { ordem } : {}),
  };

  const usarTabela = (await listarCentrosDaTabela()) !== null;

  if (usarTabela) {
    if (id && !isCentroCustoIdLegado(id)) {
      await base44.entities.FolhaCentroCusto.update(id, body);
    } else {
      await base44.entities.FolhaCentroCusto.create({
        ...body,
        ordem: typeof ordem === 'number' ? ordem : todos.length,
      });
    }
    const lista = await listarCentrosCustoRegistros();
    await espelharCentrosEmDadosEmpresa(lista);
    return lista;
  }

  // Fallback: só DadosEmpresa (ambiente sem entidade)
  let atualizados;
  if (id) {
    const idx = todos.findIndex((row) => row.id === id);
    if (idx < 0) throw new Error('Centro não encontrado.');
    atualizados = [...todos];
    atualizados[idx] = {
      ...atualizados[idx],
      nome: nomeLimpo,
      ativo: ativo !== false,
      ...(typeof ordem === 'number' ? { ordem } : {}),
    };
  } else {
    atualizados = [
      ...todos,
      {
        id: idCentroCustoFromNome(nomeLimpo),
        nome: nomeLimpo,
        ativo: ativo !== false,
        ordem: typeof ordem === 'number' ? ordem : todos.length,
      },
    ];
  }
  return espelharCentrosEmDadosEmpresa(atualizados);
}

export async function excluirCentroCustoRegistro(id) {
  if (!id) return listarCentrosCustoRegistros();

  const todos = await listarCentrosCustoRegistros();
  const alvo = todos.find((row) => row.id === id);
  if (!alvo) throw new Error('Centro não encontrado.');

  const daTabela = await listarCentrosDaTabela();
  if (daTabela !== null && !isCentroCustoIdLegado(id)) {
    try {
      await base44.entities.FolhaCentroCusto.delete(id);
    } catch {
      await base44.entities.FolhaCentroCusto.update(id, { ...alvo, ativo: false });
      const lista = await listarCentrosCustoRegistros();
      await espelharCentrosEmDadosEmpresa(lista);
      return lista;
    }
    const lista = await listarCentrosCustoRegistros();
    await espelharCentrosEmDadosEmpresa(lista);
    return lista;
  }

  const filtrado = todos.filter((row) => row.id !== id);
  return espelharCentrosEmDadosEmpresa(filtrado);
}

/** Cria colaborador mínimo para cadastro na folha (quando a pessoa ainda não existe no sistema). */
export async function criarColaboradorParaFolha({ nome, email }) {
  const nomeNorm = String(nome || '').trim();
  if (!nomeNorm) throw new Error('Informe o nome da pessoa.');
  const emailFinal =
    String(email || '').trim() ||
    `folha.${Date.now()}-${Math.random().toString(36).slice(2, 7)}@cadastro.local`;
  return base44.entities.Colaborador.create({
    nome: nomeNorm,
    email: emailFinal,
    perfil: 'Vendedor',
    ativo: true,
  });
}

/** Sincroniza nome no cadastro de colaborador e competências abertas. */
async function sincronizarNomeColaboradorFolha(colaboradorId, nomeNovo) {
  const nome = String(nomeNovo || '').trim();
  if (!colaboradorId || !nome) return;

  try {
    await base44.entities.Colaborador.update(colaboradorId, { nome });
  } catch {
    /* cadastro legado pode não permitir update — segue com modelo/competências */
  }

  const competencias = await base44.entities.FolhaPrevisaoCompetencia.filter({
    colaborador_id: colaboradorId,
  });
  for (const comp of competencias || []) {
    if (comp.colaborador_nome !== nome) {
      await base44.entities.FolhaPrevisaoCompetencia.update(comp.id, { colaborador_nome: nome });
    }
  }
}

/** Uma pessoa = um cadastro na folha; alimenta a programação automaticamente. */
export async function salvarCadastroPessoaFolha(payload, modeloId = null) {
  if (!payload?.colaborador_id) {
    throw new Error('Selecione ou cadastre a pessoa.');
  }
  const nomeFinal = String(payload.colaborador_nome || payload.nome || '').trim();
  if (!nomeFinal) {
    throw new Error('Informe o nome da pessoa.');
  }

  const existentes = await listarModelos();
  const dup = existentes.find(
    (m) => m.colaborador_id === payload.colaborador_id && m.id !== modeloId,
  );
  if (dup) {
    throw new Error(`${nomeFinal} já está cadastrada na folha.`);
  }

  const body = {
    ...payload,
    custo_direto:
      typeof payload.custo_direto === 'boolean'
        ? payload.custo_direto
        : payload.classificacao_despesa !== 'indireta',
    classificacao_despesa:
      (typeof payload.custo_direto === 'boolean'
        ? payload.custo_direto
        : payload.classificacao_despesa !== 'indireta')
        ? 'direta'
        : 'indireta',
    nome: nomeFinal,
    colaborador_nome: nomeFinal,
    dia_vencimento: FOLHA_DIA_VENCIMENTO,
    ativo: payload.ativo !== false,
  };

  let modelo;
  if (modeloId) {
    modelo = await base44.entities.FolhaPrevisaoModelo.update(modeloId, body);
    await sincronizarNomeColaboradorFolha(payload.colaborador_id, nomeFinal);
  } else {
    modelo = await base44.entities.FolhaPrevisaoModelo.create(body);
  }
  return modelo;
}

export async function atualizarCentroCustoPessoaFolha(
  modeloId,
  centroCusto,
  custoDireto = null,
  centroCustoId = '',
) {
  if (!modeloId) throw new Error('Modelo da folha não informado.');
  const nome = String(centroCusto || '').trim();
  let idResolvido = centroCustoId || '';
  if (!idResolvido && nome) {
    try {
      const centros = await listarCentrosCustoRegistros();
      const match = (centros || []).find(
        (c) =>
          String(c.nome || '').toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'),
      );
      idResolvido = match?.id || '';
    } catch {
      /* ignore */
    }
  }
  const payload = {
    centro_custo: nome,
    centro_custo_id: nome ? idResolvido : '',
  };
  if (typeof custoDireto === 'boolean') {
    payload.custo_direto = custoDireto;
    payload.classificacao_despesa = custoDireto ? 'direta' : 'indireta';
  }
  return base44.entities.FolhaPrevisaoModelo.update(modeloId, payload);
}

export function resolverModeloColaborador(modelos, colaboradorId) {
  const ativos = (modelos || []).filter((m) => m.ativo !== false);
  return (
    ativos.find((m) => m.colaborador_id === colaboradorId) ||
    ativos.find((m) => !m.colaborador_id) ||
    ativos[0] ||
    null
  );
}

/** Duplica um modelo existente (padrão "irmão") */
export async function duplicarModelo(modelo, overrides = {}) {
  const rubricas = clonarRubricas(modelo?.rubricas?.length ? modelo.rubricas : criarRubricasPadrao());
  return base44.entities.FolhaPrevisaoModelo.create(
    criarModeloComDefaults({
      nome: overrides.nome || `${modelo?.nome || 'Modelo'} (cópia)`,
      descricao: modelo?.descricao || '',
      colaborador_id: overrides.colaborador_id ?? modelo?.colaborador_id ?? '',
      colaborador_nome: overrides.colaborador_nome ?? modelo?.colaborador_nome ?? '',
      dia_vencimento: FOLHA_DIA_VENCIMENTO,
      decimo_terceiro_ativo: modelo?.decimo_terceiro_ativo,
      decimo_mes_parcela_1: modelo?.decimo_mes_parcela_1,
      decimo_mes_parcela_2: modelo?.decimo_mes_parcela_2,
      decimo_percentual_parcela: modelo?.decimo_percentual_parcela,
      ferias_programadas: clonarFerias(modelo?.ferias_programadas),
      tipo_vinculo: modelo?.tipo_vinculo,
      retirada_frequencia: modelo?.retirada_frequencia,
      retirada_valor_fixo: modelo?.retirada_valor_fixo,
      rubricas,
      situacao: SITUACAO_FOLHA.ATIVO,
      data_desligamento: '',
      data_entrada: modelo?.data_entrada || null,
      valor_rescisao_previsto: 0,
      ...overrides,
    }),
  );
}

function clonarFerias(ferias) {
  return (ferias || []).map((f) => ({ ...f, id: gerarIdInterno('fer') }));
}

export async function criarModeloPadrao(nome = 'Modelo padrão') {
  return base44.entities.FolhaPrevisaoModelo.create(criarModeloComDefaults({ nome }));
}

/** Registra desligamento — para de gerar meses futuros */
export async function registrarDesligamento(modeloId, { data_desligamento, valor_rescisao_previsto = 0, observacoes }) {
  const modelo = await base44.entities.FolhaPrevisaoModelo.update(modeloId, {
    situacao: SITUACAO_FOLHA.DESLIGADO,
    data_desligamento,
    valor_rescisao_previsto: Number(valor_rescisao_previsto) || 0,
    observacoes_desligamento: observacoes || '',
  });

  const mesDeslig = String(data_desligamento).slice(0, 7);
  const existentes = await base44.entities.FolhaPrevisaoCompetencia.filter({
    colaborador_id: modelo.colaborador_id,
    competencia: mesDeslig,
  });

  if (existentes?.length) {
    await base44.entities.FolhaPrevisaoCompetencia.update(existentes[0].id, {
      situacao_mes: 'ultimo_mes',
      observacoes: observacoes || existentes[0].observacoes,
    });
  }

  return modelo;
}

/** Reativa colaborador na previsão de folha */
export async function reativarNaFolha(modeloId) {
  return base44.entities.FolhaPrevisaoModelo.update(modeloId, {
    situacao: SITUACAO_FOLHA.ATIVO,
    data_desligamento: '',
    valor_rescisao_previsto: 0,
    observacoes_desligamento: '',
  });
}

/** Garante competência do mês para um colaborador a partir de um modelo */
export async function garantirCompetencia({ colaborador, modelo, competencia }) {
  if (modelo && !modeloEstaAtivoNaCompetencia(modelo, competencia)) {
    return null;
  }

  const existentes = await base44.entities.FolhaPrevisaoCompetencia.filter({
    colaborador_id: colaborador.id,
    competencia,
  });
  if (existentes?.length) return existentes[0];

  const rubricas = clonarRubricas(modelo?.rubricas?.length ? modelo.rubricas : criarRubricasPadrao());
  const situacaoMes = isMesDesligamento(modelo, competencia) ? 'ultimo_mes' : 'normal';

  return base44.entities.FolhaPrevisaoCompetencia.create({
    colaborador_id: colaborador.id,
    colaborador_nome: colaborador.nome,
    tipo_vinculo: modelo?.tipo_vinculo || 'funcionario',
    modelo_id: modelo?.id || '',
    modelo_nome: modelo?.nome || '',
    competencia,
    dia_vencimento: FOLHA_DIA_VENCIMENTO,
    status: 'rascunho',
    situacao_mes: situacaoMes,
    grupo_lancamento_id: gerarGrupoLancamentoId(),
    rubricas,
    movimentos: [],
  });
}

/** Abre competências para colaboradores com modelo vinculado (respeita desligamento) */
export async function abrirCompetenciasDoMes(competencia) {
  const [modelos, colaboradores] = await Promise.all([listarModelos(), listarColaboradoresAtivos()]);
  const modelosVinculados = (modelos || []).filter((m) => m.colaborador_id && m.ativo !== false);

  const criados = [];
  const pulados = [];

  for (const modelo of modelosVinculados) {
    if (!modeloEstaAtivoNaCompetencia(modelo, competencia)) {
      pulados.push(modelo.colaborador_nome);
      continue;
    }
    const col = colaboradores.find((c) => c.id === modelo.colaborador_id) || {
      id: modelo.colaborador_id,
      nome: modelo.colaborador_nome,
    };
    const comp = await garantirCompetencia({ colaborador: col, modelo, competencia });
    if (comp) criados.push(comp);
  }

  return { criados, pulados };
}

/** Desfaz abertura do mês: remove competências sem movimentos e não fechadas. */
export async function desfazerAberturaCompetenciasDoMes(competencia) {
  const competencias = await base44.entities.FolhaPrevisaoCompetencia.filter({ competencia });
  const removidas = [];
  const bloqueadas = [];

  for (const comp of competencias || []) {
    if (comp.status === 'fechado') {
      bloqueadas.push({
        id: comp.id,
        colaborador_nome: comp.colaborador_nome,
        motivo: 'fechada',
      });
      continue;
    }

    if ((comp.movimentos || []).length > 0) {
      bloqueadas.push({
        id: comp.id,
        colaborador_nome: comp.colaborador_nome,
        motivo: 'com_movimentos',
      });
      continue;
    }

    await base44.entities.FolhaPrevisaoCompetencia.delete(comp.id);
    removidas.push(comp);
  }

  return {
    total: (competencias || []).length,
    removidas,
    bloqueadas,
  };
}

export async function adicionarMovimento(competenciaId, movimento) {
  const comp = await base44.entities.FolhaPrevisaoCompetencia.get(competenciaId);
  if (competenciaEstaFechada(comp)) {
    throw new Error('A folha deste mês já fechou (último dia do mês). Movimentos não podem ser alterados.');
  }
  const movimentos = [...(comp.movimentos || []), { ...movimento, id: movimento.id || gerarIdInterno('mov') }];
  return base44.entities.FolhaPrevisaoCompetencia.update(competenciaId, { movimentos });
}

export async function removerMovimento(competenciaId, movimentoId) {
  const comp = await base44.entities.FolhaPrevisaoCompetencia.get(competenciaId);
  if (competenciaEstaFechada(comp)) {
    throw new Error('A folha deste mês já fechou (último dia do mês). Movimentos não podem ser alterados.');
  }
  const movimentos = (comp.movimentos || []).filter((m) => m.id !== movimentoId);
  return base44.entities.FolhaPrevisaoCompetencia.update(competenciaId, { movimentos });
}

/** Fecha competências cujo mês já passou do último dia (regra automática). */
export async function sincronizarFechamentoCompetencias(competencia) {
  const comps = competencia
    ? await base44.entities.FolhaPrevisaoCompetencia.filter({ competencia })
    : await base44.entities.FolhaPrevisaoCompetencia.list('-created_date', 500);

  let fechadas = 0;
  for (const c of comps || []) {
    if (c.status === 'fechado') continue;
    if (!competenciaDeveEstarFechada(c.competencia)) continue;
    await base44.entities.FolhaPrevisaoCompetencia.update(c.id, { status: 'fechado' });
    fechadas += 1;
  }
  return fechadas;
}

/**
 * Sincroniza previsão com LancamentoFinanceiro (opcional).
 * Inclui 13º, férias e rescisão no valor enviado.
 */
export async function sincronizarLancamentoFinanceiro(competencia, opcoes = {}) {
  const { contaFinanceiraId, categoriaId, categoriaNome, modelo } = opcoes;
  if (!contaFinanceiraId) return null;

  const totais = calcularTotaisCompetencia(competencia, modelo);
  const valor = totais.liquido;
  if (valor <= 0) return null;

  const grupoId = competencia.grupo_lancamento_id || gerarGrupoLancamentoId();
  const descricao = `Folha ${competencia.colaborador_nome} — ${competencia.competencia}`;
  const dataVencimento = dataVencimentoPagamentoFolha(competencia.competencia);
  if (!dataVencimento) return null;

  const extras = [];
  if (totais.totalDecimo > 0) extras.push(`13º ${totais.totalDecimo.toFixed(2)}`);
  if (totais.totalFerias > 0) extras.push(`férias ${totais.totalFerias.toFixed(2)}`);
  if (totais.totalRetiradaSocio > 0) extras.push(`retirada sócio ${totais.totalRetiradaSocio.toFixed(2)}`);

  const existentes = await base44.entities.LancamentoFinanceiro.filter({
    grupo_lancamento_id: grupoId,
  });

  const lfExistente = (existentes || []).find(
    (l) => Array.isArray(l.tags) && l.tags.includes('folha_previsao'),
  );

  const payload = {
    tipo: 'Despesa',
    descricao,
    valor,
    valor_liquido: valor,
    data_vencimento: dataVencimento,
    status: 'Em Aberto',
    conta_financeira_id: contaFinanceiraId,
    categoria_id: categoriaId || '',
    categoria: categoriaNome || (modelo?.tipo_vinculo === 'socio' ? 'Retirada sócio' : 'Salários'),
    centro_custo: String(modelo?.centro_custo || '').trim() || '',
    centro_custo_id: modelo?.centro_custo_id || '',
    custo_direto:
      typeof modelo?.custo_direto === 'boolean'
        ? modelo.custo_direto
        : modelo?.classificacao_despesa !== 'indireta',
    tags: [
      'conta_pagar',
      'folha_previsao',
      modelo?.tipo_vinculo === 'socio' ? 'folha_socio' : 'folha_funcionario',
    ],
    grupo_lancamento_id: grupoId,
    referencia_tipo: 'Manual',
    referencia_id: competencia.id,
    observacoes: `Previsão folha — líquido ${totais.liquido.toFixed(2)} | encargos ${totais.encargosEmpresa.toFixed(2)}${extras.length ? ` | ${extras.join(', ')}` : ''}`,
  };

  if (lfExistente) {
    return base44.entities.LancamentoFinanceiro.update(lfExistente.id, payload);
  }

  const criado = await base44.entities.LancamentoFinanceiro.create(payload);
  if (!competencia.grupo_lancamento_id) {
    await base44.entities.FolhaPrevisaoCompetencia.update(competencia.id, {
      grupo_lancamento_id: grupoId,
    });
  }
  return criado;
}
