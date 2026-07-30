import { base44 } from '@/api/base44Client';
import {
  TAG_LF_GERADO_AUTO,
  lancamentoRecorrenteContaPagarParaListaBoleto,
  mesReferenciaLancamento,
} from '@/lib/agefinLancamentosRecorrencia';
import { lancamentoPago, lancamentoCancelado } from '@/lib/agefinConsultaFilters';
import {
  competenciaDeveEstarFechada,
  competenciaBloqueadaEdicao,
  competenciaAncoraSerie,
  criarSerieComDefaults,
  dataVencimentoNaCompetencia,
  escolherFrequenciaCadastro,
  gerarGrupoLancamentoId,
  getCompetenciaAtual,
  indiceFrequenciaSerie,
  mapaFrequenciaPorGrupoLancamento,
  normalizarFrequenciaSerie,
  FREQUENCIA_SERIE,
  serieDeveAparecerNaCompetencia,
  serieEstaAtivaNaCompetencia,
} from '@/lib/agefinPrevisaoCalculos';
import { listarCentrosCustoRegistros } from '@/lib/folhaPrevisaoService';
import {
  atualizarDadosEmpresa,
  obterRegistroDadosEmpresa as obterDadosEmpresa,
} from '@/lib/dadosEmpresaMerge';
import {
  invalidarCacheLancamentosFinanceiros,
  listarContasPagarAgefinCache,
  listarLancamentosFinanceirosAgefinBruto,
  listarLancamentosRecorrentesCache,
  listarLancamentosVencimentoCompetenciaCache,
} from '@/lib/lancamentoFinanceiroCache';
import {
  filtrarLancamentosPlanejamento,
  grupoLancamentosPareceContaFixa,
  lancamentoEntraEmContasFixas,
} from '@/lib/agefinConsultaData';
import { competenciaParaIntervalo } from '@/lib/relatorioMargemCalculos';

export { listarCentrosCustoRegistros };

const DADOS_EMPRESA_SERIES_KEY = 'agefin_series_modelo';
const DADOS_EMPRESA_SERIES_EXCLUIDAS_KEY = 'agefin_series_excluidas';
const DADOS_EMPRESA_SERIES_BACKUP_KEY = 'agefin_series_modelo_backup';
const DADOS_EMPRESA_SERIES_BACKUP_AT_KEY = 'agefin_series_modelo_backup_at';

function lerSeriesExcluidasEmpresa(empresa) {
  if (!empresa) return [];
  const raw =
    empresa[DADOS_EMPRESA_SERIES_EXCLUIDAS_KEY] ??
    (empresa.dados && typeof empresa.dados === 'object'
      ? empresa.dados[DADOS_EMPRESA_SERIES_EXCLUIDAS_KEY]
      : undefined);
  return Array.isArray(raw) ? raw : [];
}

async function lerChavesSeriesExcluidas() {
  const empresa = await obterRegistroDadosEmpresa();
  const rows = lerSeriesExcluidasEmpresa(empresa);
  const keys = new Set();
  for (const row of rows) {
    for (const k of row?.chaves || []) keys.add(k);
  }
  return keys;
}

function chavesExclusaoSerie(serie = {}) {
  const keys = new Set();
  if (serie?.id) keys.add(`id:${serie.id}`);
  if (serie?.grupo_lancamento_id) keys.add(`grp:${serie.grupo_lancamento_id}`);
  const nome = String(serie?.nome || '').trim().toLowerCase();
  const terceiro = String(serie?.terceiro_nome || '').trim().toLowerCase();
  if (nome || terceiro) keys.add(`avulso:${nome}-${terceiro}`);
  return [...keys];
}

function serieEstaExcluida(serie, chavesExcluidas) {
  if (!chavesExcluidas?.size) return false;
  return chavesExclusaoSerie(serie).some((k) => chavesExcluidas.has(k));
}

async function marcarSerieExcluida(serie) {
  if (!serie) return;
  const chaves = chavesExclusaoSerie(serie);
  if (!chaves.length) return;
  const empresa = await obterRegistroDadosEmpresa();
  const atual = lerSeriesExcluidasEmpresa(empresa);
  const chavesAtuais = new Set(atual.flatMap((r) => r.chaves || []));
  if (chaves.every((k) => chavesAtuais.has(k))) return;
  const next = [
    ...atual.filter((r) => !chaves.some((k) => (r.chaves || []).includes(k))),
    {
      chaves,
      nome: serie.nome || '',
      grupo_lancamento_id: serie.grupo_lancamento_id || null,
      removido_em: new Date().toISOString(),
    },
  ];
  await atualizarDadosEmpresa(base44, { [DADOS_EMPRESA_SERIES_EXCLUIDAS_KEY]: next });
}

async function desmarcarSerieExcluida(serie) {
  const chaves = chavesExclusaoSerie(serie);
  if (!chaves.length) return;
  const empresa = await obterRegistroDadosEmpresa();
  const atual = lerSeriesExcluidasEmpresa(empresa);
  const next = atual.filter((r) => !(r.chaves || []).some((k) => chaves.includes(k)));
  if (next.length === atual.length) return;
  await atualizarDadosEmpresa(base44, { [DADOS_EMPRESA_SERIES_EXCLUIDAS_KEY]: next });
}

function filtrarSeriesNaoExcluidas(series, chavesExcluidas) {
  return (series || []).filter((s) => !serieEstaExcluida(s, chavesExcluidas));
}


async function obterRegistroDadosEmpresa() {
  return obterDadosEmpresa(base44);
}

function empresaTemArmazenamentoSeries(empresa) {
  return empresa != null && DADOS_EMPRESA_SERIES_KEY in empresa;
}

function lerSeriesEmpresa(empresa) {
  if (!empresa) return [];
  const raw =
    empresa[DADOS_EMPRESA_SERIES_KEY] ??
    (empresa.dados && typeof empresa.dados === 'object'
      ? empresa.dados[DADOS_EMPRESA_SERIES_KEY]
      : undefined);
  return Array.isArray(raw) ? raw : [];
}

function lerSeriesBackupEmpresa(empresa) {
  if (!empresa) return [];
  const raw =
    empresa[DADOS_EMPRESA_SERIES_BACKUP_KEY] ??
    (empresa.dados && typeof empresa.dados === 'object'
      ? empresa.dados[DADOS_EMPRESA_SERIES_BACKUP_KEY]
      : undefined);
  return Array.isArray(raw) ? raw : [];
}

/** Une listas por id; listas posteriores sobrescrevem campos das anteriores. */
function mesclarSeriesPorId(...listas) {
  const map = new Map();
  for (const lista of listas) {
    for (const serie of lista || []) {
      if (!serie?.id) continue;
      map.set(serie.id, { ...map.get(serie.id), ...serie });
    }
  }
  return [...map.values()];
}

function prioridadeSerieId(id = '') {
  if (String(id).startsWith('serie-lf-')) return 10;
  if (String(id).startsWith('serie-recuperada-')) return 1;
  if (String(id).startsWith('serie-import-') || String(id).startsWith('serie-agefin-')) return 2;
  return 5;
}

/** ID estável da série — derivado do grupo recorrente no LancamentoFinanceiro. */
export function serieIdFromGrupoLancamento(grupoId) {
  if (!grupoId) return undefined;
  return `serie-lf-${grupoId}`;
}

function agruparLancamentosPorGrupo(lancamentos = []) {
  const map = new Map();
  for (const lf of lancamentos || []) {
    const gid = lf?.grupo_lancamento_id;
    if (!gid) continue;
    if (!map.has(gid)) map.set(gid, []);
    map.get(gid).push(lf);
  }
  return map;
}

function frequenciaDoGrupoLancamentos(grupoId, rows = []) {
  const mapa = mapaFrequenciaPorGrupoLancamento(rows);
  if (grupoId && mapa[grupoId]) return mapa[grupoId];
  return FREQUENCIA_SERIE.MENSAL;
}

/** Deriva o template da aba Contas fixas a partir de um grupo de lançamentos recorrentes. */
function derivarSerieDoGrupoLancamentos(grupoId, rows = []) {
  if (!grupoId || !grupoLancamentosPareceContaFixa(rows)) return null;

  const sorted = [...rows].sort((a, b) =>
    (b.data_vencimento || '').localeCompare(a.data_vencimento || ''),
  );
  const sortedAsc = [...rows].sort((a, b) =>
    (a.data_vencimento || '').localeCompare(b.data_vencimento || ''),
  );
  const rep =
    sorted.find(lancamentoRecorrenteContaPagarParaListaBoleto) ||
    sorted.find((lf) => !lancamentoCancelado(lf)) ||
    sorted[0];
  const ancora =
    sortedAsc.find((lf) => !lancamentoCancelado(lf)) ||
    sortedAsc[0] ||
    rep;
  if (!rep) return null;

  const abertos = rows.filter((lf) => !lancamentoPago(lf) && !lancamentoCancelado(lf));
  const freq = frequenciaDoGrupoLancamentos(grupoId, rows);
  const venAncora = ancora?.data_vencimento || rep.data_vencimento || '';

  return criarSerieComDefaults({
    id: serieIdFromGrupoLancamento(grupoId),
    nome: rep.descricao || rep.terceiro_nome || 'Conta recorrente',
    terceiro_nome: rep.terceiro_nome || '',
    terceiro_id: rep.terceiro_id || '',
    categoria_id: rep.categoria_id || '',
    categoria_nome: rep.categoria || '',
    valor_previsto: Number(rep.valor) || 0,
    dia_vencimento: Number((venAncora || '').slice(8, 10)) || 10,
    mes_vencimento: Number((venAncora || '').slice(5, 7)) || new Date().getMonth() + 1,
    frequencia: freq,
    grupo_lancamento_id: grupoId,
    // Anuais/trimestrais etc. seguem na previsão mesmo sem parcela em aberto no mês
    ativo: abertos.length > 0 || freq !== FREQUENCIA_SERIE.MENSAL,
  });
}

/** Une cadastro (overlay) com dados do LF — frequência mais específica vence. */
function aplicarOverlaySerie(serie, overlay) {
  if (!overlay || !serie) return serie;
  const frequencia = escolherFrequenciaCadastro(overlay, serie);
  const mesOverlay = overlay.mes_vencimento != null ? Number(overlay.mes_vencimento) : null;
  return criarSerieComDefaults({
    ...serie,
    nome: String(overlay.nome || '').trim() ? overlay.nome : serie.nome,
    terceiro_nome: overlay.terceiro_nome != null ? overlay.terceiro_nome : serie.terceiro_nome,
    terceiro_id: overlay.terceiro_id || serie.terceiro_id,
    categoria_id: overlay.categoria_id || serie.categoria_id,
    categoria_nome: overlay.categoria_nome || serie.categoria_nome,
    frequencia,
    mes_vencimento: mesOverlay || serie.mes_vencimento,
    dia_vencimento:
      overlay.dia_vencimento != null ? Number(overlay.dia_vencimento) : serie.dia_vencimento,
    valor_previsto:
      overlay.valor_previsto != null && overlay.valor_previsto !== ''
        ? Number(overlay.valor_previsto)
        : serie.valor_previsto,
    centro_custo: overlay.centro_custo || serie.centro_custo,
    observacoes: overlay.observacoes || serie.observacoes,
    situacao: overlay.situacao || serie.situacao,
    data_encerramento: overlay.data_encerramento || serie.data_encerramento,
    ativo: overlay.ativo === false ? false : serie.ativo,
  });
}

function indexarOverlaysSeries(overlays = []) {
  const byGrupo = new Map();
  const byId = new Map();
  for (const row of overlays || []) {
    if (row?.grupo_lancamento_id) {
      const prev = byGrupo.get(row.grupo_lancamento_id);
      if (
        !prev ||
        indiceFrequenciaSerie(row.frequencia) > indiceFrequenciaSerie(prev.frequencia)
      ) {
        byGrupo.set(row.grupo_lancamento_id, row);
      }
    }
    if (row?.id) byId.set(row.id, row);
  }
  return { byGrupo, byId };
}

function overlayParaSerie(serie, { byGrupo, byId }) {
  return (
    (serie.grupo_lancamento_id ? byGrupo.get(serie.grupo_lancamento_id) : null) ||
    byId.get(serie.id) ||
    null
  );
}

function serieRascunhoSemLancamento(overlay, gruposLf) {
  if (!overlay || overlay.ativo === false) return false;
  const gid = overlay.grupo_lancamento_id;
  if (gid && gruposLf.has(gid)) return false;
  return Boolean((overlay.nome || '').trim() || gid);
}

/** Evita duplicatas do mesmo grupo (import/recuperação vs cadastro manual). */
function deduplicarSeriesPorGrupo(series = []) {
  const porGrupo = new Map();
  const semGrupo = [];

  for (const serie of series || []) {
    const gid = serie?.grupo_lancamento_id;
    if (!gid) {
      semGrupo.push(serie);
      continue;
    }
    const prev = porGrupo.get(gid);
    if (!prev || prioridadeSerieId(serie.id) > prioridadeSerieId(prev.id)) {
      porGrupo.set(gid, serie);
    }
  }

  return [...porGrupo.values(), ...semGrupo];
}

/** Fonte de verdade: entidade + DadosEmpresa (sem localStorage). */
async function lerSeriesNaNuvem() {
  const [empresa, entityRows] = await Promise.all([
    obterRegistroDadosEmpresa(),
    tryListEntitySeries(),
  ]);
  const empresaRows = lerSeriesEmpresa(empresa);
  return deduplicarSeriesPorGrupo(mesclarSeriesPorId(entityRows ?? [], empresaRows));
}

async function lerTodasSeriesArmazenadas() {
  const empresa = await obterRegistroDadosEmpresa();
  const empresaRows = lerSeriesEmpresa(empresa);
  const backupRows = lerSeriesBackupEmpresa(empresa);
  const entityRows = (await tryListEntitySeries()) ?? [];
  const localRows = lerSeriesLocalStorage();
  const merged = await lerSeriesNaNuvem();
  return {
    empresa,
    empresaRows,
    backupRows,
    entityRows,
    localRows,
    merged,
  };
}

const LS_SERIES_KEY = 'p38_agefin_series_modelo_v1';

function lerSeriesLocalStorage() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_SERIES_KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function salvarSeriesLocalStorage(series) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_SERIES_KEY, JSON.stringify(series || []));
  } catch {
    /* quota / modo privado */
  }
}

/** Sincroniza outras abas/janelas quando o cache local é atualizado após gravação na nuvem. */
export function subscribeSeriesStorageChanges(onChange) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => {
    if (event.key === LS_SERIES_KEY) onChange?.();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

const LS_MIGRACAO_FEITA_KEY = 'p38_agefin_series_migradas_v1';

async function migrarSeriesLocalStorageParaNuvem() {
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(LS_MIGRACAO_FEITA_KEY) === '1') {
    return false;
  }

  const localRows = lerSeriesLocalStorage();
  if (!localRows.length) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(LS_MIGRACAO_FEITA_KEY, '1');
    return false;
  }

  const naNuvem = await lerSeriesNaNuvem();
  const idsNuvem = new Set(naNuvem.map((s) => s.id));
  const orfaos = localRows.filter((s) => s?.id && !idsNuvem.has(s.id));
  if (!orfaos.length) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(LS_MIGRACAO_FEITA_KEY, '1');
    return false;
  }

  await persistirSeriesModelo(orfaos, { modo: 'merge' });
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(LS_MIGRACAO_FEITA_KEY, '1');
  return true;
}

async function tryListEntitySeries() {
  try {
    const api = base44.entities?.AgefinSerieModelo;
    if (!api?.list) return null;
    const rows = await api.list('-created_date');
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

async function buscarSerieEntidade(serieId) {
  try {
    const api = base44.entities?.AgefinSerieModelo;
    if (!api || !serieId) return null;
    if (api.filter) {
      const rows = await api.filter({ id: serieId });
      if (rows?.[0]?.id) return criarSerieComDefaults(rows[0]);
    }
    if (api.get) {
      const row = await api.get(serieId);
      if (row?.id) return criarSerieComDefaults(row);
    }
  } catch {
    /* entidade opcional */
  }
  return null;
}

async function upsertSerieEntidade(serie) {
  const api = base44.entities?.AgefinSerieModelo;
  if (!api?.create) return null;
  const body = criarSerieComDefaults(serie);
  let existente = [];
  try {
    existente = (await api.filter?.({ id: body.id })) || [];
  } catch {
    try {
      const row = await api.get?.(body.id);
      if (row?.id) existente = [row];
    } catch {
      /* nova série */
    }
  }
  if (existente?.length) {
    return criarSerieComDefaults(await api.update(body.id, body));
  }
  return criarSerieComDefaults(await api.create(body));
}

async function removerSerieEntidade(serieId) {
  try {
    const api = base44.entities?.AgefinSerieModelo;
    if (!api?.delete) return false;
    await api.delete(serieId);
    return true;
  } catch {
    return false;
  }
}

async function sincronizarSeriesParaEntidade(series) {
  for (const serie of series || []) {
    await upsertSerieEntidade(serie);
  }
}

async function gravarBackupSeries(empresa, series) {
  if (!Array.isArray(series) || series.length === 0) return;
  try {
    await atualizarDadosEmpresa(base44, {
      [DADOS_EMPRESA_SERIES_BACKUP_KEY]: series.map((s) => criarSerieComDefaults(s)),
      [DADOS_EMPRESA_SERIES_BACKUP_AT_KEY]: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[agefin] Falha ao gravar backup de séries:', error);
  }
}

async function persistirSeriesModelo(series, { modo = 'merge' } = {}) {
  const empresa = await obterRegistroDadosEmpresa();
  const atual = await lerSeriesNaNuvem();

  if (atual.length > 0) {
    await gravarBackupSeries(empresa, atual);
  }

  const incoming = (series || []).map((s) => criarSerieComDefaults(s));
  const seriesNorm =
    modo === 'substituir'
      ? deduplicarSeriesPorGrupo(incoming)
      : deduplicarSeriesPorGrupo(mesclarSeriesPorId(atual, incoming));

  let entityOk = false;
  try {
    await sincronizarSeriesParaEntidade(seriesNorm);
    entityOk = true;
  } catch (error) {
    console.error('[agefin] Falha ao gravar em AgefinSerieModelo:', error);
  }

  let empresaAtualizada = null;
  let empresaOk = false;
  try {
    empresaAtualizada = await atualizarDadosEmpresa(base44, {
      [DADOS_EMPRESA_SERIES_KEY]: seriesNorm,
    });
    const gravadas = lerSeriesEmpresa(empresaAtualizada);
    empresaOk =
      gravadas.length >= seriesNorm.length &&
      seriesNorm.every((serie) => gravadas.some((g) => g.id === serie.id));
  } catch (error) {
    console.error('[agefin] Falha ao gravar em DadosEmpresa:', error);
  }

  if (!entityOk && !empresaOk) {
    throw new Error('Não foi possível gravar as contas fixas na base de dados.');
  }

  salvarSeriesLocalStorage(seriesNorm);

  return {
    seriesNorm,
    empresaRows: lerSeriesEmpresa(empresaAtualizada),
    entityOk,
    empresaOk,
  };
}

async function verificarSeriePersistida(serieId, tentativas = 5) {
  for (let i = 0; i < tentativas; i += 1) {
    const fromEntity = await buscarSerieEntidade(serieId);
    if (fromEntity) return fromEntity;

    const naNuvem = await lerSeriesNaNuvem();
    const found = naNuvem.find((s) => s.id === serieId);
    if (found) return criarSerieComDefaults(found);

    if (i < tentativas - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  return null;
}

async function obterSeriesParaEdicao() {
  return lerSeriesNaNuvem();
}

export async function listarModelos() {
  try {
    await migrarSeriesLocalStorageParaNuvem();
  } catch (error) {
    console.warn('[agefin] Falha ao migrar contas fixas do cache local:', error);
  }

  const [recorrentes, overlaysNuvem, chavesExcluidas] = await Promise.all([
    listarLancamentosRecorrentes(),
    lerSeriesNaNuvem(),
    lerChavesSeriesExcluidas(),
  ]);

  const porGrupo = agruparLancamentosPorGrupo(
    (recorrentes || []).filter((lf) => lancamentoEntraEmContasFixas(lf)),
  );
  const overlays = indexarOverlaysSeries(overlaysNuvem);
  const series = [];

  for (const [grupoId, rows] of porGrupo) {
    const base = derivarSerieDoGrupoLancamentos(grupoId, rows);
    if (!base || serieEstaExcluida(base, chavesExcluidas)) continue;
    series.push(aplicarOverlaySerie(base, overlayParaSerie(base, overlays)));
  }

  const gruposLf = new Set(porGrupo.keys());
  const gruposNaLista = new Set(series.map((s) => s.grupo_lancamento_id).filter(Boolean));

  for (const overlay of overlaysNuvem || []) {
    if (serieEstaExcluida(overlay, chavesExcluidas) || overlay.ativo === false) continue;
    if (!serieRascunhoSemLancamento(overlay, gruposLf)) continue;
    const gid = overlay.grupo_lancamento_id;
    if (gid && gruposNaLista.has(gid)) continue;
    series.push(criarSerieComDefaults(overlay));
    if (gid) gruposNaLista.add(gid);
  }

  return deduplicarSeriesPorGrupo(filtrarSeriesNaoExcluidas(series, chavesExcluidas));
}

function tagsSerieFinanceiro(tags = []) {
  const base = new Set([...(Array.isArray(tags) ? tags : []), 'conta_pagar', 'recorrente', 'agefin_previsao']);
  base.delete('cancelado');
  base.delete('cancelada');
  base.delete('agefin_agenda_removida');
  return [...base];
}

async function listarLancamentosGrupoSerie(modelo) {
  if (!modelo?.grupo_lancamento_id) return [];
  const rows = await base44.entities.LancamentoFinanceiro.filter({
    grupo_lancamento_id: modelo.grupo_lancamento_id,
  });
  return Array.isArray(rows) ? rows : [];
}

/** Grava alterações da série no LancamentoFinanceiro (fonte da AGEFIN). */
async function sincronizarSerieNoFinanceiro(modelo) {
  if (!modelo?.grupo_lancamento_id || modelo.ativo === false) return { atualizados: 0, criados: 0 };

  const rows = await listarLancamentosGrupoSerie(modelo);
  const abertos = rows.filter((lf) => !lancamentoPago(lf) && !lancamentoCancelado(lf));
  const freq = normalizarFrequenciaSerie(modelo.frequencia);
  let atualizados = 0;

  for (const lf of rows) {
    if (lancamentoCancelado(lf)) continue;
    const aberto = !lancamentoPago(lf);
    if (!aberto) {
      await base44.entities.LancamentoFinanceiro.update(lf.id, {
        is_recorrente: true,
        frequencia_recorrencia: freq,
      });
      atualizados += 1;
      continue;
    }

    const ven =
      lf.data_vencimento && modelo.dia_vencimento
        ? dataVencimentoNaCompetencia(
            String(lf.data_vencimento).slice(0, 7),
            modelo.dia_vencimento,
          )
        : lf.data_vencimento;
    const valor = Number(modelo.valor_previsto) || Number(lf.valor) || 0;
    await base44.entities.LancamentoFinanceiro.update(lf.id, {
      descricao: modelo.nome,
      terceiro_id: modelo.terceiro_id || lf.terceiro_id,
      terceiro_nome: modelo.terceiro_nome || lf.terceiro_nome,
      valor,
      valor_liquido: valor,
      data_vencimento: ven,
      categoria: modelo.categoria_nome || lf.categoria,
      categoria_id: modelo.categoria_id || lf.categoria_id,
      referencia_id: serieIdFromGrupoLancamento(modelo.grupo_lancamento_id) || modelo.id,
      is_recorrente: true,
      frequencia_recorrencia: freq,
      tags: tagsSerieFinanceiro(lf.tags),
    });
    atualizados += 1;
  }

  let criados = 0;
  if (!rows.length) {
    const compAtual = getCompetenciaAtual();
    const comp =
      serieDeveAparecerNaCompetencia(modelo, compAtual) ? compAtual : competenciaAncoraSerie(modelo, compAtual);
    await base44.entities.LancamentoFinanceiro.create(payloadLancamentoAuto(modelo, comp));
    criados = 1;
  }

  if (atualizados || criados) invalidarCacheLancamentosFinanceiros();
  return { atualizados, criados };
}

/** Cancela lançamentos em aberto do grupo — some da AGEFIN e da agenda. */
async function cancelarLancamentosAbertosDaSerie(modelo) {
  const rows = modelo?.grupo_lancamento_id ? await listarLancamentosGrupoSerie(modelo) : [];
  let cancelados = 0;

  for (const lf of rows) {
    if (lancamentoPago(lf) || lancamentoCancelado(lf)) continue;
    const tags = [...new Set([...(lf.tags || []), 'cancelado', 'agefin_agenda_removida'])];
    await base44.entities.LancamentoFinanceiro.update(lf.id, {
      status: 'Cancelado',
      tags,
    });
    cancelados += 1;
  }

  if (cancelados) invalidarCacheLancamentosFinanceiros();
  return { cancelados };
}

export async function salvarSerie(payload) {
  const existente = payload.id
    ? (await obterSeriesParaEdicao()).find((s) => s.id === payload.id)
    : null;
  const grupoId =
    payload.grupo_lancamento_id || existente?.grupo_lancamento_id || gerarGrupoLancamentoId();
  const body = criarSerieComDefaults({
    ...(existente || {}),
    ...payload,
    id: serieIdFromGrupoLancamento(grupoId) || payload.id || existente?.id || undefined,
    grupo_lancamento_id: grupoId,
  });

  await sincronizarSerieNoFinanceiro(body);

  let entityRow = null;
  try {
    entityRow = await upsertSerieEntidade(body);
  } catch (error) {
    console.error('[agefin] AgefinSerieModelo indisponível:', error);
  }

  try {
    const { empresaRows } = await persistirSeriesModelo([body]);
    await desmarcarSerieExcluida(body);
    const naRespostaEmpresa = empresaRows.find(
      (s) => s.id === body.id || s.grupo_lancamento_id === body.grupo_lancamento_id,
    );
    if (naRespostaEmpresa) return criarSerieComDefaults({ ...naRespostaEmpresa, frequencia: body.frequencia });
  } catch (error) {
    console.warn('[agefin] Falha ao gravar overlay (centro de custo, etc.):', error);
  }

  if (entityRow?.id) return entityRow;

  const verificada = await verificarSeriePersistida(body.id);
  if (verificada) return verificada;

  return body;
}

export async function removerSerie(serieId, serieMeta = null) {
  const series = await obterSeriesParaEdicao();
  const alvo = serieMeta || series.find((s) => s.id === serieId);

  if (alvo) {
    await cancelarLancamentosAbertosDaSerie(alvo);
    await marcarSerieExcluida(alvo);
    await persistirSeriesModelo([criarSerieComDefaults({ ...alvo, ativo: false })], { modo: 'merge' });
  }

  await removerSerieEntidade(serieId);
  const next = series.filter((s) => s.id !== serieId);
  await persistirSeriesModelo(next, { modo: 'merge' });
  invalidarCacheLancamentosFinanceiros();
}

export async function atualizarCentroCustoSerie(serieId, centroCusto) {
  const existente = (await obterSeriesParaEdicao()).find((s) => s.id === serieId);
  if (!existente) throw new Error('Conta não encontrada.');
  const atualizada = criarSerieComDefaults({
    ...existente,
    centro_custo: centroCusto || '',
  });
  await persistirSeriesModelo([atualizada]);
  await sincronizarSerieNoFinanceiro(atualizada);
  return atualizada;
}

function derivarSeriesDeLancamentos(lancamentos = []) {
  const porGrupo = agruparLancamentosPorGrupo(
    (lancamentos || []).filter((lf) => lancamentoEntraEmContasFixas(lf)),
  );
  const series = [];
  for (const [grupoId, rows] of porGrupo) {
    const serie = derivarSerieDoGrupoLancamentos(grupoId, rows);
    if (serie) series.push(serie);
  }
  return series;
}

/** Recarrega a lista a partir dos LancamentoFinanceiro recorrentes (sem duplicar na nuvem). */
export async function sincronizarModelosDesdeLancamentos() {
  invalidarCacheLancamentosFinanceiros();
  return listarModelos();
}

export async function listarLancamentosCompetencia(competencia) {
  const limites = competenciaParaIntervalo(competencia);
  let rows = await listarLancamentosVencimentoCompetenciaCache(competencia);

  if (!rows?.length && limites) {
    const from = limites.from.toISOString().slice(0, 10);
    const to = limites.to.toISOString().slice(0, 10);
    const prefix = String(competencia || '').slice(0, 7);
    const todos = await listarLancamentosFinanceirosAgefinBruto();
    rows = todos.filter((lf) => {
      const venc = String(lf?.data_vencimento || '').slice(0, 10);
      return venc >= from && venc <= to && String(lf?.data_vencimento || '').slice(0, 7) === prefix;
    });
  }

  return filtrarLancamentosPlanejamento(rows);
}

/** Lançamentos recorrentes (conta a pagar) para alimentar a projeção de 12 meses. */
export async function listarLancamentosRecorrentes() {
  const lancamentos = await listarContasPagarAgefinCache();
  return (lancamentos || []).filter(lancamentoRecorrenteContaPagarParaListaBoleto);
}

function payloadLancamentoAuto(modelo, competencia) {
  const dataVencimento = dataVencimentoNaCompetencia(competencia, modelo.dia_vencimento);
  const valor = Number(modelo.valor_previsto) || 0;
  return {
    tipo: 'Despesa',
    descricao: modelo.nome,
    terceiro_id: modelo.terceiro_id || undefined,
    terceiro_nome: modelo.terceiro_nome || undefined,
    valor,
    valor_liquido: valor,
    data_vencimento: dataVencimento,
    status: 'Em Aberto',
    status_conciliacao: 'N/A',
    categoria: modelo.categoria_nome || undefined,
    categoria_id: modelo.categoria_id || undefined,
    referencia_tipo: 'Manual',
    referencia_id: serieIdFromGrupoLancamento(modelo.grupo_lancamento_id) || modelo.id,
    observacoes: `Competência ${competencia} — aberta pelo planejamento financeiro. Conta financeira será definida na execução.`,
    tags: ['conta_pagar', 'recorrente', TAG_LF_GERADO_AUTO, 'agefin_previsao', 'conta_a_definir'],
    is_recorrente: true,
    frequencia_recorrencia: normalizarFrequenciaSerie(modelo.frequencia),
    grupo_lancamento_id: modelo.grupo_lancamento_id,
  };
}

async function buscarLancamentoMes(modelo, competencia) {
  if (!modelo?.grupo_lancamento_id) return null;
  const rows = await base44.entities.LancamentoFinanceiro.filter({
    grupo_lancamento_id: modelo.grupo_lancamento_id,
  });
  return (rows || []).find((lf) => mesReferenciaLancamento(lf) === competencia) || null;
}

export async function abrirCompetenciasDoMes(competencia) {
  const modelos = await listarModelos();
  const criados = [];
  const pulados = [];

  for (const modelo of modelos) {
    if (!serieDeveAparecerNaCompetencia(modelo, competencia)) {
      pulados.push(modelo.nome);
      continue;
    }
    const existente = await buscarLancamentoMes(modelo, competencia);
    if (existente) {
      pulados.push(modelo.nome);
      continue;
    }
    const lf = await base44.entities.LancamentoFinanceiro.create(
      payloadLancamentoAuto(modelo, competencia),
    );
    criados.push(lf);
  }

  return { criados, pulados };
}

/** Abre só uma conta fixa no mês (sem abrir as demais). */
export async function abrirCompetenciaSerie(modelo, competencia) {
  if (!modelo?.id) throw new Error('Conta não encontrada.');
  if (!serieDeveAparecerNaCompetencia(modelo, competencia)) {
    throw new Error('Esta conta não entra neste mês.');
  }
  const existente = await buscarLancamentoMes(modelo, competencia);
  if (existente) return existente;
  return base44.entities.LancamentoFinanceiro.create(payloadLancamentoAuto(modelo, competencia));
}

export async function desfazerAberturaCompetenciasDoMes(competencia) {
  const modelos = await listarModelos();
  const removidas = [];
  const bloqueadas = [];

  for (const modelo of modelos) {
    const lf = await buscarLancamentoMes(modelo, competencia);
    if (!lf) continue;

    if (lancamentoPago(lf)) {
      bloqueadas.push({ nome: modelo.nome, motivo: 'pago' });
      continue;
    }
    if (lancamentoCancelado(lf)) {
      bloqueadas.push({ nome: modelo.nome, motivo: 'cancelado' });
      continue;
    }
    const tags = Array.isArray(lf.tags) ? lf.tags : [];
    if (!tags.includes(TAG_LF_GERADO_AUTO) && !tags.includes('agefin_previsao')) {
      bloqueadas.push({ nome: modelo.nome, motivo: 'com_boleto' });
      continue;
    }

    await base44.entities.LancamentoFinanceiro.delete(lf.id);
    removidas.push(lf);
  }

  return {
    total: removidas.length + bloqueadas.length,
    removidas,
    bloqueadas,
  };
}

export async function sincronizarFechamentoCompetencias(competencia) {
  const lancamentos = competencia
    ? await listarLancamentosCompetencia(competencia)
    : (await listarLancamentosRecorrentesCache()).filter(lancamentoRecorrenteContaPagarParaListaBoleto);

  let fechadas = 0;
  for (const lf of lancamentos || []) {
    const mes = mesReferenciaLancamento(lf);
    if (!mes || !competenciaDeveEstarFechada(mes)) continue;
    if (lancamentoPago(lf) || lancamentoCancelado(lf)) continue;
    fechadas += 1;
  }
  return fechadas;
}

export async function sincronizarLancamentoFinanceiro(competencia, opcoes = {}) {
  const { contaFinanceiraId, modelo } = opcoes;
  if (!contaFinanceiraId || !modelo) return null;

  const valor = Number(competencia.valor_real ?? competencia.valor_previsto ?? modelo.valor_previsto) || 0;
  if (valor <= 0) return null;

  const payload = {
    ...payloadLancamentoAuto(modelo, competencia.competencia),
    valor,
    valor_liquido: valor,
    conta_financeira_id: contaFinanceiraId,
    status: 'Pendente',
  };

  if (competencia.lancamento_id) {
    return base44.entities.LancamentoFinanceiro.update(competencia.lancamento_id, payload);
  }

  return base44.entities.LancamentoFinanceiro.create(payload);
}

export async function listarContasFinanceiras() {
  const contas = await base44.entities.ContasFinanceiras.list();
  return (contas || []).filter((c) => c.ativo !== false);
}

export async function registrarEncerramentoSerie(serieId, dataEncerramento) {
  const existente = (await listarModelos()).find((s) => s.id === serieId);
  if (!existente) throw new Error('Conta não encontrada.');
  const encerrada = criarSerieComDefaults({
    ...existente,
    situacao: 'encerrada',
    data_encerramento: dataEncerramento,
    ativo: false,
  });
  await persistirSeriesModelo([encerrada]);
  return encerrada;
}

export async function reativarSerie(serieId) {
  const existente = (await listarModelos()).find((s) => s.id === serieId);
  if (!existente) throw new Error('Conta não encontrada.');
  const reativada = criarSerieComDefaults({
    ...existente,
    situacao: 'ativa',
    data_encerramento: null,
    ativo: true,
  });
  await persistirSeriesModelo([reativada]);
  return reativada;
}

export function podeEditarCompetencia(comp) {
  return comp && !competenciaBloqueadaEdicao(comp);
}

/**
 * Atualiza valor e vencimento manualmente (sem ler o boleto).
 * — Com lançamento: grava no LancamentoFinanceiro.
 * — Em planejamento: grava no modelo (cadastro da série).
 */
export async function atualizarCompetenciaManual({ competencia, modelo, valor, dataVencimento, diaVencimento }) {
  const valorNum = Number(valor) || 0;
  if (valorNum < 0) throw new Error('O valor não pode ser negativo.');

  if (competencia?.lancamento_id) {
    const lf = await base44.entities.LancamentoFinanceiro.get(competencia.lancamento_id);
    const tags = new Set([...(lf?.tags || []), 'conta_pagar']);
    tags.delete(TAG_LF_GERADO_AUTO);
    const ven = (dataVencimento || '').slice(0, 10) || lf?.data_vencimento;
    const atualizado = await base44.entities.LancamentoFinanceiro.update(competencia.lancamento_id, {
      valor: valorNum,
      valor_liquido: valorNum,
      data_vencimento: ven,
      tags: [...tags],
    });
    if (modelo?.id) {
      const dia = Number(diaVencimento) || Number((ven || '').slice(8, 10)) || Number(modelo.dia_vencimento) || 10;
      await salvarSerie({
        ...modelo,
        valor_previsto: valorNum,
        dia_vencimento: dia,
      });
    }
    return atualizado;
  }

  if (!modelo?.id) throw new Error('Abra o mês antes de editar o valor desta conta.');

  const dia = Number(diaVencimento) || Number(modelo.dia_vencimento) || 10;
  return salvarSerie({
    ...modelo,
    valor_previsto: valorNum,
    dia_vencimento: dia,
  });
}
