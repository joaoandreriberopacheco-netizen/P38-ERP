/**
 * Chaves relacionais pai (série / template) → filho (LancamentoFinanceiro da competência).
 * Sem heurística de nome, valor ou vencimento.
 */

import { lancamentoCancelado, lancamentoPago } from '@/lib/agefinConsultaFilters';
import { TAG_LF_GERADO_AUTO } from '@/lib/agefinLancamentosRecorrencia';

export function serieIdFromGrupoLancamento(grupoId) {
  if (!grupoId) return undefined;
  return `serie-lf-${grupoId}`;
}

/** IDs de referência aceitos no filho para apontar ao template. */
export function referenciaIdsSerieModelo(modelo) {
  const refs = new Set();
  if (modelo?.id) refs.add(modelo.id);
  const porGrupo = serieIdFromGrupoLancamento(modelo?.grupo_lancamento_id);
  if (porGrupo) refs.add(porGrupo);
  return refs;
}

export function lancamentoFilhoPertenceSerie(lf, modelo) {
  if (!lf || !modelo) return false;
  if (modelo.grupo_lancamento_id && lf.grupo_lancamento_id === modelo.grupo_lancamento_id) {
    return true;
  }
  if (lf.referencia_id && referenciaIdsSerieModelo(modelo).has(lf.referencia_id)) {
    return true;
  }
  return false;
}

export function resolverModeloPaiDoLancamento(lf, modelosByGrupo, modelosById) {
  if (!lf) return null;
  if (lf.grupo_lancamento_id && modelosByGrupo[lf.grupo_lancamento_id]) {
    return modelosByGrupo[lf.grupo_lancamento_id];
  }
  if (lf.referencia_id && modelosById[lf.referencia_id]) {
    return modelosById[lf.referencia_id];
  }
  const ref = String(lf.referencia_id || '');
  if (ref.startsWith('serie-lf-')) {
    const grupo = ref.slice('serie-lf-'.length);
    if (modelosByGrupo[grupo]) return modelosByGrupo[grupo];
  }
  return null;
}

/** Vários filhos no mesmo mês: escolhe pelo vínculo relacional (grupo / referencia_id). */
export function escolherFilhoCanonicRelacional(candidatos = [], modelo) {
  if (!candidatos.length) return null;
  if (candidatos.length === 1) return candidatos[0];

  const gid = modelo?.grupo_lancamento_id;
  const refs = referenciaIdsSerieModelo(modelo);

  const doGrupo = gid ? candidatos.filter((lf) => lf.grupo_lancamento_id === gid) : [];
  const porRef = candidatos.filter((lf) => lf.referencia_id && refs.has(lf.referencia_id));
  const pool = doGrupo.length ? doGrupo : porRef.length ? porRef : candidatos;

  const pontuacao = (lf) => {
    let score = 0;
    if (lancamentoPago(lf)) score += 1000;
    if (lancamentoCancelado(lf)) score -= 5000;
    const tags = Array.isArray(lf?.tags) ? lf.tags : [];
    if (!tags.includes(TAG_LF_GERADO_AUTO)) score += 200;
    if (modelo?.grupo_lancamento_id && lf?.grupo_lancamento_id === modelo.grupo_lancamento_id) {
      score += 50;
    }
    return score;
  };

  return [...pool].sort((a, b) => {
    const diff = pontuacao(b) - pontuacao(a);
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id));
  })[0];
}
