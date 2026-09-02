import { base44 } from '@/api/base44Client';
import { atualizarDadosEmpresa, obterRegistroDadosEmpresa } from '@/lib/dadosEmpresaMerge';
import {
  criarCompetenciaComDefaults,
  criarModeloComDefaults,
  filtrarLancamentosBudgetMes,
  lancamentoElegivelBudget,
} from '@/lib/budgetCalculos';
import { calcularLucroBrutoCompetencia, competenciaParaIntervalo } from '@/lib/relatorioMargemCalculos';
import { fetchPedidosOrigemTrocaMargem, fetchPedidosVendaParaMargem } from '@/lib/fetchPedidosVenda90d';
import { fetchAllProdutosCatalogo } from '@/lib/fetchProdutosAtivos';
import { listarCentrosCustoRegistros } from '@/lib/folhaPrevisaoService';
import {
  listarLancamentosMesCompetenciaCache,
  listarLancamentosVencimentoCompetenciaCache,
} from '@/lib/lancamentoFinanceiroCache';

export { listarCentrosCustoRegistros };

const DADOS_EMPRESA_MODELOS_KEY = 'budget_modelos';
const DADOS_EMPRESA_COMPETENCIAS_KEY = 'budget_competencias';
const LS_MODELOS_KEY = 'p38_budget_modelos_v1';
const LS_COMPETENCIAS_KEY = 'p38_budget_competencias_v1';

function lerArrayEmpresa(empresa, key) {
  if (!empresa) return [];
  const raw =
    empresa[key] ??
    (empresa.dados && typeof empresa.dados === 'object' ? empresa.dados[key] : undefined);
  return Array.isArray(raw) ? raw : [];
}

function lerLocalStorage(key) {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function salvarLocalStorage(key, rows) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(rows || []));
  } catch {
    /* quota */
  }
}

function mesclarPorId(...listas) {
  const map = new Map();
  for (const lista of listas) {
    for (const row of lista || []) {
      if (!row?.id) continue;
      map.set(row.id, { ...map.get(row.id), ...row });
    }
  }
  return [...map.values()];
}

async function tryListEntity(apiName) {
  try {
    const api = base44.entities?.[apiName];
    if (!api?.list) return null;
    const rows = await api.list('-created_date');
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

async function upsertEntity(apiName, row, normalizer) {
  const api = base44.entities?.[apiName];
  if (!api?.create) return null;
  const body = normalizer(row);
  let existente = [];
  try {
    existente = (await api.filter?.({ id: body.id })) || [];
  } catch {
    try {
      const one = await api.get?.(body.id);
      if (one?.id) existente = [one];
    } catch {
      /* novo */
    }
  }
  if (existente?.length) {
    return normalizer(await api.update(body.id, body));
  }
  return normalizer(await api.create(body));
}

async function deleteEntity(apiName, id) {
  try {
    const api = base44.entities?.[apiName];
    if (!api?.delete || !id) return false;
    await api.delete(id);
    return true;
  } catch {
    return false;
  }
}

function normalizarListaModelos(rows) {
  return (rows || []).map(criarModeloComDefaults).filter((m) => m?.id);
}

async function lerModelosArmazenados() {
  const empresa = await obterRegistroDadosEmpresa(base44);
  const empresaRows = normalizarListaModelos(lerArrayEmpresa(empresa, DADOS_EMPRESA_MODELOS_KEY));
  const localRows = normalizarListaModelos(lerLocalStorage(LS_MODELOS_KEY));
  const entityRows = normalizarListaModelos((await tryListEntity('BudgetModelo')) ?? []);

  // Fonte canônica: DadosEmpresa > localStorage > entidade (bootstrap inicial).
  // Não faz union — union trazia de volta itens já excluídos de outra camada.
  let canonical = [];
  if (empresaRows.length) {
    canonical = empresaRows;
    salvarLocalStorage(LS_MODELOS_KEY, canonical);
  } else if (localRows.length) {
    canonical = localRows;
  } else if (entityRows.length) {
    canonical = entityRows;
  }

  return {
    empresa,
    empresaRows,
    localRows,
    entityRows,
    merged: canonical,
  };
}

async function substituirModelosNaEntidade(modelos) {
  const api = base44.entities?.BudgetModelo;
  if (!api?.list) return;
  const idsAtivos = new Set((modelos || []).map((m) => m.id));
  const existentes = normalizarListaModelos((await api.list('-created_date')) || []);

  for (const row of existentes) {
    if (row?.id && !idsAtivos.has(row.id)) {
      try {
        await api.delete(row.id);
      } catch (error) {
        console.error('[budgets] Falha ao excluir BudgetModelo na entidade:', row.id, error);
        throw new Error('Não foi possível remover o budget na base. Tente novamente.');
      }
    }
  }

  for (const m of modelos || []) {
    await upsertEntity('BudgetModelo', m, criarModeloComDefaults);
  }
}

async function persistirModelos(modelos) {
  const norm = normalizarListaModelos(modelos);
  try {
    await atualizarDadosEmpresa(base44, { [DADOS_EMPRESA_MODELOS_KEY]: norm });
  } catch (error) {
    console.error('[budgets] Falha ao gravar em DadosEmpresa:', error);
    throw new Error('Não foi possível salvar os budgets. Tente novamente.');
  }
  salvarLocalStorage(LS_MODELOS_KEY, norm);
  try {
    await substituirModelosNaEntidade(norm);
  } catch (error) {
    console.error('[budgets] Falha ao espelhar BudgetModelo:', error);
    // DadosEmpresa + local já estão corretos; não bloqueia a operação.
  }
  return norm;
}

async function lerCompetenciasArmazenadas(competencia) {
  const empresa = await obterRegistroDadosEmpresa(base44);
  const empresaRows = lerArrayEmpresa(empresa, DADOS_EMPRESA_COMPETENCIAS_KEY);
  const entityRows = competencia
    ? ((await (async () => {
        try {
          const api = base44.entities?.BudgetCompetencia;
          if (!api?.filter) return null;
          return await api.filter({ competencia });
        } catch {
          return null;
        }
      })()) ?? [])
    : ((await tryListEntity('BudgetCompetencia')) ?? []);
  const localRows = lerLocalStorage(LS_COMPETENCIAS_KEY);
  const merged = mesclarPorId(localRows, entityRows, empresaRows).map(criarCompetenciaComDefaults);
  return competencia ? merged.filter((c) => c.competencia === competencia) : merged;
}

async function persistirCompetencias(competencias) {
  const norm = (competencias || []).map(criarCompetenciaComDefaults);
  salvarLocalStorage(LS_COMPETENCIAS_KEY, norm);
  await atualizarDadosEmpresa(base44, { [DADOS_EMPRESA_COMPETENCIAS_KEY]: norm });
  for (const c of norm) {
    await upsertEntity('BudgetCompetencia', c, criarCompetenciaComDefaults);
  }
  return norm;
}

export async function listarModelos() {
  const { merged } = await lerModelosArmazenados();
  return merged;
}

export async function salvarModelo(partial) {
  if (!partial?.id) {
    throw new Error('Budget sem identificador — feche e abra o formulário novamente.');
  }
  const { merged } = await lerModelosArmazenados();
  const body = criarModeloComDefaults(partial);
  const idx = merged.findIndex((m) => m.id === body.id);
  const next = [...merged];
  if (idx >= 0) next[idx] = { ...next[idx], ...body };
  else next.push(body);
  return (await persistirModelos(next)).find((m) => m.id === body.id);
}

export async function inativarModelo(modeloId) {
  const { merged } = await lerModelosArmazenados();
  const modelo = merged.find((m) => m.id === modeloId);
  if (!modelo) throw new Error('Budget não encontrado.');
  return salvarModelo({ ...modelo, ativo: false });
}

export async function reativarModelo(modeloId) {
  const { merged } = await lerModelosArmazenados();
  const modelo = merged.find((m) => m.id === modeloId);
  if (!modelo) throw new Error('Budget não encontrado.');
  return salvarModelo({ ...modelo, ativo: true });
}

export async function removerModelo(modeloId) {
  if (!modeloId) throw new Error('Budget inválido.');
  const { merged } = await lerModelosArmazenados();
  if (!merged.some((m) => m.id === modeloId)) {
    throw new Error('Budget não encontrado.');
  }
  const next = merged.filter((m) => m.id !== modeloId);
  const gravados = await persistirModelos(next);
  if (gravados.some((m) => m.id === modeloId)) {
    throw new Error('O budget não foi removido. Tente novamente.');
  }

  const comps = await lerCompetenciasArmazenadas();
  const compsNext = comps.filter((c) => c.budget_modelo_id !== modeloId);
  await persistirCompetencias(compsNext);
  return gravados;
}

/** Remove duplicatas exatas (mesmo nome + categoria + centro), mantendo a primeira ocorrência. */
export async function limparDuplicatasBudgets() {
  const { merged } = await lerModelosArmazenados();
  const vistos = new Map();
  const unicos = [];
  let removidos = 0;

  for (const modelo of merged) {
    const chave = [
      String(modelo.nome || '').trim().toLocaleLowerCase('pt-BR'),
      modelo.categoria_id || '',
      String(modelo.centro_custo || '').trim().toLocaleLowerCase('pt-BR'),
      modelo.modo_estimativa || '',
      String(modelo.valor_entrada || ''),
    ].join('|');
    if (vistos.has(chave)) {
      removidos += 1;
      continue;
    }
    vistos.set(chave, true);
    unicos.push(modelo);
  }

  if (removidos === 0) return { removidos: 0, total: merged.length };
  const gravados = await persistirModelos(unicos);
  return { removidos, total: gravados.length };
}

export async function listarCompetencias(competencia) {
  return lerCompetenciasArmazenadas(competencia);
}

export async function salvarAjusteCompetencia(budgetModeloId, competencia, { valorAjustado, motivoAjuste }) {
  const comps = await lerCompetenciasArmazenadas();
  const id = `${budgetModeloId}:${competencia}`;
  const existente = comps.find((c) => c.budget_modelo_id === budgetModeloId && c.competencia === competencia);
  const body = criarCompetenciaComDefaults({
    ...existente,
    id: existente?.id || id,
    budget_modelo_id: budgetModeloId,
    competencia,
    valor_ajustado: valorAjustado != null && valorAjustado !== '' ? Number(valorAjustado) : null,
    motivo_ajuste: motivoAjuste || '',
  });
  const next = comps.filter((c) => c.budget_modelo_id !== budgetModeloId || c.competencia !== competencia);
  next.push(body);
  return (await persistirCompetencias(next)).find((c) => c.id === body.id);
}

export async function listarLancamentosMes(competencia) {
  const lancamentos = await listarLancamentosMesCompetenciaCache(competencia);
  return filtrarLancamentosBudgetMes(lancamentos, competencia);
}

/** Contas cujo vencimento pertence à competência, independentemente da data de pagamento. */
export async function listarLancamentosVencimentoMes(competencia) {
  const prefix = String(competencia || '').slice(0, 7);
  if (!prefix) return [];
  const lancamentos = await listarLancamentosVencimentoCompetenciaCache(competencia);
  return (lancamentos || []).filter(
    (lancamento) => String(lancamento?.data_vencimento || '').slice(0, 7) === prefix,
  );
}

export async function listarLancamentosDespesas(competencia) {
  const mes = await listarLancamentosMes(competencia);
  return mes.filter(lancamentoElegivelBudget);
}

export async function listarCategoriasDespesa() {
  const cats = await base44.entities.CategoriaFinanceira.list();
  return (cats || []).filter((c) => c.tipo === 'Despesa' && c.ativo !== false && c.ativa !== false);
}

export async function obterLucroBrutoCompetencia(competencia) {
  const intervalo = competenciaParaIntervalo(competencia);
  if (!intervalo) {
    return { receita_liquida: 0, custo_total: 0, lucro_bruto: 0, quantidade_produtos: 0 };
  }

  const [sales, products, devolucoes] = await Promise.all([
    fetchPedidosVendaParaMargem(),
    fetchAllProdutosCatalogo(),
    base44.entities.DevolucaoTroca.list(),
  ]);

  const devolucoesTroca = Array.isArray(devolucoes) ? devolucoes : [];
  const pedidosOrigemTroca = await fetchPedidosOrigemTrocaMargem(devolucoesTroca);

  return calcularLucroBrutoCompetencia(
    sales,
    products,
    competencia,
    devolucoesTroca,
    pedidosOrigemTroca,
  );
}

export async function salvarCategoriaDespesa(partial = {}) {
  const nome = String(partial.nome || '').trim();
  if (!nome) throw new Error('Informe o nome da categoria.');

  const body = {
    nome,
    tipo: 'Despesa',
    ativo: partial.ativo !== false,
    ativa: partial.ativo !== false,
    cor: partial.cor || '#3B82F6',
    orcamento_mensal: Number(partial.orcamento_mensal) || 0,
  };

  if (partial.id) {
    return base44.entities.CategoriaFinanceira.update(partial.id, { ...partial, ...body });
  }
  return base44.entities.CategoriaFinanceira.create(body);
}
