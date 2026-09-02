import { base44 } from '@/api/base44Client';
import { atualizarDadosEmpresa, obterRegistroDadosEmpresa } from '@/lib/dadosEmpresaMerge';

const DADOS_EMPRESA_KEY = 'agefin_competencias_mes';
const LS_KEY = 'p38_agefin_competencias_mes_v1';

function lerLocalStorage() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function salvarLocalStorage(rows) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows || []));
  } catch {
    /* quota */
  }
}

function lerEmpresa(empresa) {
  if (!empresa) return [];
  const raw =
    empresa[DADOS_EMPRESA_KEY] ??
    (empresa.dados && typeof empresa.dados === 'object'
      ? empresa.dados[DADOS_EMPRESA_KEY]
      : undefined);
  return Array.isArray(raw) ? raw : [];
}

function normalizarOverride(row) {
  if (!row?.serie_id || !row?.competencia) return null;
  const competencia = String(row.competencia).slice(0, 7);
  const valor = Number(row.valor);
  if (!competencia || !Number.isFinite(valor) || valor < 0) return null;
  const dataVencimento = String(row.data_vencimento || '').slice(0, 10) || null;
  const dia = Number(row.dia_vencimento) || Number((dataVencimento || '').slice(8, 10)) || null;
  return {
    id: `${row.serie_id}-${competencia}`,
    serie_id: row.serie_id,
    competencia,
    valor,
    data_vencimento: dataVencimento,
    dia_vencimento: dia,
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

function mesclarPorId(...listas) {
  const map = new Map();
  for (const lista of listas) {
    for (const row of lista || []) {
      const norm = normalizarOverride(row);
      if (!norm) continue;
      map.set(norm.id, { ...map.get(norm.id), ...norm });
    }
  }
  return [...map.values()];
}

async function persistir(rows) {
  const normalizados = (rows || []).map(normalizarOverride).filter(Boolean);
  salvarLocalStorage(normalizados);
  try {
    await atualizarDadosEmpresa(base44, { [DADOS_EMPRESA_KEY]: normalizados });
  } catch (error) {
    console.error('[agefin] Falha ao gravar competências do mês:', error);
  }
  return normalizados;
}

export async function listarOverridesCompetenciaMes() {
  const empresa = await obterRegistroDadosEmpresa(base44);
  return mesclarPorId(lerLocalStorage(), lerEmpresa(empresa));
}

export async function salvarOverrideCompetenciaMes({
  serieId,
  competencia,
  valor,
  dataVencimento,
  diaVencimento,
}) {
  const comp = String(competencia || '').slice(0, 7);
  if (!serieId || !comp) throw new Error('Competência inválida.');

  const ven = String(dataVencimento || '').slice(0, 10) || null;
  const row = normalizarOverride({
    serie_id: serieId,
    competencia: comp,
    valor: Number(valor) || 0,
    data_vencimento: ven,
    dia_vencimento: diaVencimento,
    updated_at: new Date().toISOString(),
  });
  if (!row) throw new Error('Dados da competência inválidos.');

  const todos = await listarOverridesCompetenciaMes();
  const next = [...todos.filter((item) => item.id !== row.id), row];
  await persistir(next);
  return row;
}

export function mapaOverridesCompetenciaMes(overrides = [], competenciaMes) {
  const mes = String(competenciaMes || '').slice(0, 7);
  const map = {};
  for (const row of overrides || []) {
    if (String(row.competencia).slice(0, 7) !== mes) continue;
    map[row.serie_id] = row;
  }
  return map;
}

export function aplicarOverrideCompetencia(comp, override) {
  if (!comp || !override || comp._modoParcela || comp._fantasmaParcelamento) return comp;
  if (comp.lancamento_id && !comp._modoPlanejamento) return comp;

  const dia = Number(override.dia_vencimento) || comp.dia_vencimento;
  return {
    ...comp,
    valor_previsto: Number(override.valor),
    valor_real: Number(override.valor),
    dia_vencimento: dia,
    _overrideCompetencia: true,
    _overrideDataVencimento: override.data_vencimento || null,
  };
}
