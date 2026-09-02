/**
 * Regras partilhadas: parcelas do planejamento e avulsos do fluxo de caixa na pauta
 * (Dízimo, Visão Financeira, AGEFIN Consulta).
 */

import { dataVencimentoNaCompetencia, serieEhParcelada } from '@/lib/agefinPrevisaoCalculos';
import { competenciaDoMes } from '@/lib/superAgefinCompromissos';

function tagsLancamento(lancamento) {
  return (Array.isArray(lancamento?.tags) ? lancamento.tags : []).map((tag) =>
    String(tag).trim().toLocaleLowerCase('pt-BR'),
  );
}

export function lancamentoEhParcelaPlanejamento(lancamento) {
  if (!lancamento) return false;
  if (lancamento.frequencia_recorrencia === 'Parcelado') return true;
  const tags = tagsLancamento(lancamento);
  if (tags.includes('parcelado')) return true;
  if (lancamento.numero_parcelas_total && lancamento.parcela_atual) return true;
  return false;
}

/** Contas do planejamento / fluxo de caixa que entram na pauta (parcelas e avulsos). */
export function lancamentoEntraPautaAgefinPrevisao(lancamento, modelosAgefin = []) {
  const tags = tagsLancamento(lancamento);
  if (!tags.includes('agefin_previsao') || tags.includes('folha_previsao')) return false;
  if (lancamentoEhParcelaPlanejamento(lancamento)) return true;

  const recorrente = Boolean(lancamento.is_recorrente) || tags.includes('recorrente');
  if (!recorrente) return true;

  const modelo = (modelosAgefin || []).find(
    (m) => m?.grupo_lancamento_id && m.grupo_lancamento_id === lancamento.grupo_lancamento_id,
  );
  return serieEhParcelada(modelo);
}

export function grupoSerieEhParcelado(modelo, lancamentosRecorrentes = []) {
  if (serieEhParcelada(modelo)) return true;
  const gid = modelo?.grupo_lancamento_id;
  if (!gid) return false;
  return (lancamentosRecorrentes || []).some(
    (lf) =>
      lf?.grupo_lancamento_id === gid &&
      (lf.frequencia_recorrencia === 'Parcelado' || lancamentoEhParcelaPlanejamento(lf)),
  );
}

export function lancamentoCobreParcelaVirtual(lancamentos = [], modelo, parcela) {
  if (!modelo?.grupo_lancamento_id || !parcela) return false;
  const mes = String(parcela.competencia || '').slice(0, 7);
  return (lancamentos || []).some((lf) => {
    if (lf.grupo_lancamento_id !== modelo.grupo_lancamento_id) return false;
    if (String(lf.data_vencimento || '').slice(0, 7) !== mes) return false;
    if (lancamentoEhParcelaPlanejamento(lf)) {
      if (lf.parcela_atual != null && Number(lf.parcela_atual) === Number(parcela.numero)) {
        return true;
      }
      return true;
    }
    return false;
  });
}

/**
 * Parcelas do planejamento ainda sem LancamentoFinanceiro — formato compatível com SuperAgefin.
 */
export function montarContasSinteticasParcelasAgefin({
  competencia,
  modelosAgefin = [],
  parcelamentos = [],
  lancamentosMes = [],
}) {
  const mes = competenciaDoMes(competencia);
  const modelosMap = Object.fromEntries(
    (modelosAgefin || []).filter((m) => m?.id).map((m) => [m.id, m]),
  );
  const contas = [];

  for (const parc of parcelamentos || []) {
    if (parc?.ativo === false) continue;
    const modelo = modelosMap[parc.serie_id];
    if (!modelo) continue;

    for (const parcela of parc.parcelas || []) {
      if (String(parcela.competencia || '').slice(0, 7) !== mes) continue;
      if (lancamentoCobreParcelaVirtual(lancamentosMes, modelo, parcela)) continue;

      const valor = Number(parcela.valor) || 0;
      if (valor <= 0) continue;

      const total = parc.total_parcelas || parc.parcelas?.length || 1;
      const numero = parcela.numero || 1;
      const dia = Number(parcela.dia_vencimento) || Number(modelo.dia_vencimento) || 10;
      const dataVencimento =
        parcela.data_vencimento || dataVencimentoNaCompetencia(parcela.competencia, dia);
      const nome = String(modelo.nome || 'Conta parcelada').trim();

      contas.push({
        id: `superagefin-parc-${parc.id}-${numero}`,
        descricao: `${nome} (${numero}/${total})`,
        valor,
        data_vencimento: dataVencimento,
        status: 'Em Aberto',
        tipo: 'Despesa',
        tags: ['conta_pagar', 'agefin_previsao', 'parcelado'],
        terceiro_nome: modelo.terceiro_nome || '',
        categoria: modelo.categoria_nome || '',
        centro_custo: modelo.centro_custo || '',
        natureza: 'Parcelado',
        frequencia_recorrencia: 'Parcelado',
        parcela_atual: numero,
        numero_parcelas_total: total,
        grupo_lancamento_id: modelo.grupo_lancamento_id || '',
        _superagefin_parcela_planejamento: true,
        _superagefin_sintetico: true,
      });
    }
  }

  return contas.sort((a, b) => {
    const c = String(a.data_vencimento).localeCompare(String(b.data_vencimento));
    if (c !== 0) return c;
    return String(a.descricao).localeCompare(String(b.descricao), 'pt-BR', { sensitivity: 'base' });
  });
}
