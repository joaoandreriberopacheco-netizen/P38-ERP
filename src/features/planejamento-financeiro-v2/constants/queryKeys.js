/** Chaves estáveis do React Query — partilhadas com invalidações existentes. */
export const AGEFIN_PREVISAO_ROOT = ['agefin-previsao'];

export const agefinQueryKeys = {
  modelos: [...AGEFIN_PREVISAO_ROOT, 'modelos'],
  centros: [...AGEFIN_PREVISAO_ROOT, 'centros-custo-registros'],
  lancamentos: (competencia) => [...AGEFIN_PREVISAO_ROOT, 'lancamentos', competencia],
  parcelamentos: [...AGEFIN_PREVISAO_ROOT, 'parcelamentos'],
  contas: [...AGEFIN_PREVISAO_ROOT, 'contas'],
  recorrentes: [...AGEFIN_PREVISAO_ROOT, 'lancamentos-recorrentes'],
  overridesCompetencia: [...AGEFIN_PREVISAO_ROOT, 'competencias-mes'],
  categorias: [...AGEFIN_PREVISAO_ROOT, 'categorias-despesa'],
};
