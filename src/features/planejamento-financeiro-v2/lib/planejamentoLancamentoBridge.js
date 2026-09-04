import { salvarSerie } from '@/lib/agefinPrevisaoService';
import { normalizarFrequenciaSerie } from '@/lib/agefinPrevisaoCalculos';

/**
 * Grava centro de custo / categoria no overlay após criar LF recorrente no planejamento.
 */
export async function persistirOverlayPlanejamentoAposLancamento({
  grupo_lancamento_id,
  descricao,
  valor,
  categoria_id,
  categoria,
  centro_custo,
  centro_custo_id,
  frequencia,
  data_vencimento,
}) {
  if (!grupo_lancamento_id) return null;

  const ven = String(data_vencimento || '').slice(0, 10);
  return salvarSerie(
    {
      nome: descricao,
      valor_previsto: Number(valor) || 0,
      categoria_id: categoria_id || '',
      categoria_nome: categoria || '',
      centro_custo: centro_custo || '',
      centro_custo_id: centro_custo_id || '',
      frequencia: normalizarFrequenciaSerie(frequencia),
      grupo_lancamento_id,
      dia_vencimento: Number(ven.slice(8, 10)) || 10,
      mes_vencimento: Number(ven.slice(5, 7)) || 1,
      ativo: true,
    },
    { competenciaMinima: ven.slice(0, 7) },
  );
}
