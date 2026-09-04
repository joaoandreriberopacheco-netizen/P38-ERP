/**
 * Parcelamento de contas na Previsão do mês — cálculos e montagem da visão.
 */

import {
  dataVencimentoNaCompetencia,
  formatCompetenciaLabel,
  montarCompetenciasVisao,
  shiftCompetencia,
  valorEfetivoCompetencia,
} from '@/lib/agefinPrevisaoCalculos';

export function gerarParcelamentoId() {
  return `parc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function gerarParcelaItemId() {
  return `parc-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Reparte valor + juros/multa em N parcelas mensais consecutivas a partir da competência âncora. */
export function gerarParcelasProposta({
  competenciaOrigem,
  valorOriginal = 0,
  jurosMulta = 0,
  totalParcelas = 2,
  diaVencimento = 10,
}) {
  const n = Math.max(1, Math.min(60, Number(totalParcelas) || 1));
  const total = (Number(valorOriginal) || 0) + (Number(jurosMulta) || 0);
  const base = Math.floor((total / n) * 100) / 100;
  const parcelas = [];
  let acumulado = 0;

  for (let i = 0; i < n; i += 1) {
    const competencia = shiftCompetencia(competenciaOrigem, i);
    const valor =
      i === n - 1 ? Math.round((total - acumulado) * 100) / 100 : base;
    acumulado += valor;
    const dia = Math.min(28, Math.max(1, Number(diaVencimento) || 10));
    parcelas.push({
      id: gerarParcelaItemId(),
      numero: i + 1,
      competencia,
      valor,
      dia_vencimento: dia,
      data_vencimento: dataVencimentoNaCompetencia(competencia, dia),
    });
  }

  return parcelas;
}

export function normalizarParcelamento(raw, modelo) {
  if (!raw?.serie_id || !raw?.competencia_origem) return null;
  const valorOriginal =
    Number(raw.valor_original) ||
    Number(modelo?.valor_previsto) ||
    0;
  const jurosMulta = Number(raw.juros_multa) || 0;
  const totalParcelas = Math.max(1, Number(raw.total_parcelas) || raw.parcelas?.length || 1);
  const dia = Number(modelo?.dia_vencimento) || 10;
  const parcelas =
    Array.isArray(raw.parcelas) && raw.parcelas.length
      ? raw.parcelas.map((p, idx) => ({
          id: p.id || gerarParcelaItemId(),
          numero: Number(p.numero) || idx + 1,
          competencia: String(p.competencia || raw.competencia_origem).slice(0, 7),
          valor: Number(p.valor) || 0,
          dia_vencimento: Number(p.dia_vencimento) || dia,
          data_vencimento:
            p.data_vencimento ||
            dataVencimentoNaCompetencia(
              String(p.competencia || raw.competencia_origem).slice(0, 7),
              Number(p.dia_vencimento) || dia,
            ),
        }))
      : gerarParcelasProposta({
          competenciaOrigem: raw.competencia_origem,
          valorOriginal,
          jurosMulta,
          totalParcelas,
          diaVencimento: dia,
        });

  return {
    id: raw.id || gerarParcelamentoId(),
    serie_id: raw.serie_id,
    competencia_origem: String(raw.competencia_origem).slice(0, 7),
    valor_original: valorOriginal,
    juros_multa: jurosMulta,
    total_parcelas: parcelas.length,
    ativo: raw.ativo !== false,
    parcelas,
  };
}

export function parcelamentoPorSerieCompetencia(parcelamentos, serieId, competenciaOrigem) {
  return (parcelamentos || []).find(
    (p) =>
      p?.ativo !== false &&
      p.serie_id === serieId &&
      String(p.competencia_origem).slice(0, 7) === String(competenciaOrigem).slice(0, 7),
  );
}

export function parcelamentoAfetaSerieNoMes(parcelamentos, serieId, competenciaMes) {
  const mes = String(competenciaMes).slice(0, 7);
  return (parcelamentos || []).find((p) => {
    if (p?.ativo === false || p.serie_id !== serieId) return false;
    if (String(p.competencia_origem).slice(0, 7) === mes) return true;
    return (p.parcelas || []).some((par) => String(par.competencia).slice(0, 7) === mes);
  });
}

function criarLinhaParcela(modelo, parcelamento, parcela, baseComp = null) {
  const dia = Number(parcela.dia_vencimento) || Number(modelo?.dia_vencimento) || 10;
  return {
    id: `parc-linha-${parcelamento.id}-${parcela.numero}`,
    serie_id: parcelamento.serie_id,
    serie_nome: modelo?.nome || baseComp?.serie_nome || 'Conta parcelada',
    terceiro_nome: modelo?.terceiro_nome || baseComp?.terceiro_nome,
    categoria_nome: modelo?.categoria_nome || baseComp?.categoria_nome,
    centro_custo: modelo?.centro_custo || baseComp?.centro_custo,
    competencia: String(parcela.competencia).slice(0, 7),
    frequencia: modelo?.frequencia || baseComp?.frequencia,
    mes_vencimento: modelo?.mes_vencimento || baseComp?.mes_vencimento,
    dia_vencimento: dia,
    valor_previsto: Number(parcela.valor) || 0,
    valor_real: null,
    status: 'rascunho',
    grupo_lancamento_id: modelo?.grupo_lancamento_id || baseComp?.grupo_lancamento_id,
    lancamento_id: null,
    origem_boleto: null,
    _modoPlanejamento: true,
    _modoParcela: true,
    _parcelamentoId: parcelamento.id,
    _parcelaNumero: parcela.numero,
    _parcelaTotal: parcelamento.total_parcelas || parcelamento.parcelas?.length,
    _competenciaOrigem: parcelamento.competencia_origem,
    _parcelaDataVencimento: parcela.data_vencimento,
    _lancamento: null,
  };
}

/**
 * Mescla visão normal com linhas fantasma (mês âncora) e parcelas.
 */
export function montarCompetenciasVisaoComParcelas(
  competenciaMes,
  modelos,
  lancamentosMes = [],
  parcelamentos = [],
  lancamentosRecorrentes = [],
  overridesPorSerie = {},
) {
  const mes = String(competenciaMes).slice(0, 7);
  const base = montarCompetenciasVisao(
    mes,
    modelos,
    lancamentosMes,
    lancamentosRecorrentes,
    overridesPorSerie,
  );
  const modelosMap = {};
  for (const m of modelos || []) {
    if (m?.id) modelosMap[m.id] = m;
  }

  const ativos = (parcelamentos || []).filter((p) => p?.ativo !== false);
  const resultado = [];
  const parcelasInseridas = new Set();

  const pushParcelasDoMes = (parc, baseComp = null) => {
    const modelo = modelosMap[parc.serie_id];
    for (const par of parc.parcelas || []) {
      if (String(par.competencia).slice(0, 7) !== mes) continue;
      const chave = `${parc.id}:${par.numero}`;
      if (parcelasInseridas.has(chave)) continue;
      parcelasInseridas.add(chave);
      resultado.push(criarLinhaParcela(modelo, parc, par, baseComp));
    }
  };

  for (const comp of base) {
    const parcAnchor = parcelamentoPorSerieCompetencia(
      ativos,
      comp.serie_id,
      mes,
    );
    const parcOutroMes = ativos.find(
      (p) =>
        p.serie_id === comp.serie_id &&
        String(p.competencia_origem).slice(0, 7) !== mes &&
        (p.parcelas || []).some((par) => String(par.competencia).slice(0, 7) === mes),
    );

    if (parcOutroMes) {
      pushParcelasDoMes(parcOutroMes, comp);
      continue;
    }

    if (parcAnchor) {
      resultado.push({
        ...comp,
        _fantasmaParcelamento: true,
        _parcelamentoId: parcAnchor.id,
        _excluirDoTotal: true,
      });
      pushParcelasDoMes(parcAnchor, comp);
      continue;
    }

    resultado.push(comp);
  }

  for (const parc of ativos) {
    const modelo = modelosMap[parc.serie_id];
    const temParcelaMes = (parc.parcelas || []).some(
      (par) => String(par.competencia).slice(0, 7) === mes,
    );
    if (!temParcelaMes) continue;
    const jaNaBase = base.some((c) => c.serie_id === parc.serie_id);
    if (jaNaBase) continue;
    pushParcelasDoMes(parc);
  }

  return resultado.sort((a, b) =>
    (a.serie_nome || '').localeCompare(b.serie_nome || '', 'pt-BR'),
  );
}

export function competenciaExcluidaDoTotal(comp) {
  return Boolean(comp?._fantasmaParcelamento || comp?._excluirDoTotal);
}

export function labelParcelaCurta(comp) {
  if (!comp?._modoParcela) return '';
  const n = comp._parcelaNumero;
  const t = comp._parcelaTotal;
  const origem = formatCompetenciaLabel(comp._competenciaOrigem);
  return `Parcela ${n}/${t}${origem ? ` · origem ${origem}` : ''}`;
}

export function valorEfetivoCompetenciaComParcela(comp, modelo) {
  if (comp?._modoParcela && comp.valor_previsto != null) {
    return Number(comp.valor_previsto) || 0;
  }
  return valorEfetivoCompetencia(comp, modelo);
}
