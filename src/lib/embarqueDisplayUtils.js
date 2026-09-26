/**
 * Código de exibição (AB6-PPQ-A) e ordenação cronológica dos splits.
 * A = primeiro despacho; B, C… seguem a ordem de criação/despacho (nunca o mais recente).
 */

import { isEmbarqueSaldoPendente } from '@/lib/embarqueTipoSaldoPendente';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function normCodigo(value = '') {
  return String(value || '').trim().replace(/\s+/g, '');
}

function timestampEmbarque(embarque = {}) {
  const raw = embarque.data_embarque || embarque.created_date || embarque.created_at;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function isEmbarqueNecessidadeTipo(embarque = {}) {
  return isEmbarqueSaldoPendente(embarque);
}

function embarqueIdKey(embarque = {}) {
  return String(embarque?.id || '');
}

function pedidoComEmbarques(pedido = {}, embarques = []) {
  const lista = embarques.length ? embarques : (pedido?._embarques || []);
  return { ...pedido, _embarques: lista };
}

function sufixoGravadoEmbarque(embarque = {}) {
  const codigo = embarque?.codigo_exibicao || embarque?.dados?.codigo_exibicao;
  if (!codigo) return '';
  const m = normCodigo(codigo).match(/-([A-Z])$/i);
  return m ? m[1].toUpperCase() : '';
}

/**
 * Ordena splits para UI: mais antigo primeiro (A), Necessidade após embarques reais no mesmo instante.
 */
export function sortEmbarquesParaExibicao(embarques = [], pedido = {}) {
  return [...(embarques || [])].sort((a, b) => {
    const ta = timestampEmbarque(a);
    const tb = timestampEmbarque(b);
    if (ta !== tb) return ta - tb;

    const necA = isEmbarqueNecessidadeTipo(a) ? 1 : 0;
    const necB = isEmbarqueNecessidadeTipo(b) ? 1 : 0;
    if (necA !== necB) return necA - necB;

    return embarqueIdKey(a).localeCompare(embarqueIdKey(b));
  });
}

/** Índice 0-based na sequência A,B,C… (cronológico entre todos os splits do pedido). */
export function indiceOrdinalEmbarque(embarque, pedido = {}) {
  const embarques = pedido?._embarques || [];
  if (!embarques.length || !embarqueIdKey(embarque)) return 0;
  const ordenados = sortEmbarquesParaExibicao(embarques, pedido);
  const idx = ordenados.findIndex((item) => embarqueIdKey(item) === embarqueIdKey(embarque));
  return idx >= 0 ? idx : ordenados.length;
}

/** Letra final do código (A, B, C…) — posição cronológica, não o sufixo gravado errado. */
export function parseSufixoCodigoEmbarque(embarque, pedido = {}) {
  const embarques = pedido?._embarques || [];
  if (embarques.length && embarqueIdKey(embarque)) {
    const idx = indiceOrdinalEmbarque(embarque, pedidoComEmbarques(pedido, embarques));
    return LETTERS[idx] || sufixoGravadoEmbarque(embarque) || 'A';
  }
  return sufixoGravadoEmbarque(embarque) || 'A';
}

/** Código de exibição — requer pedido._embarques com todos os splits para sufixo correcto. */
export function resolveEmbarqueCodigoExibicao(pedido, embarque) {
  const base = String(pedido?.numero || '').replace(/\s+/g, '');
  const sufixo = parseSufixoCodigoEmbarque(embarque, pedido);
  return sufixo ? `${base}-${sufixo}` : base;
}

/** Próxima letra para novo despacho (ignora duplicados de sufixo). */
export function proximaLetraEmbarquePedido(embarques = [], pedido = {}) {
  const ctx = pedidoComEmbarques(pedido, embarques);
  const usadas = new Set(
    sortEmbarquesParaExibicao(embarques, ctx)
      .map((emb) => parseSufixoCodigoEmbarque(emb, ctx))
      .filter(Boolean),
  );
  for (const letter of LETTERS) {
    if (!usadas.has(letter)) return letter;
  }
  return 'Z';
}

export function ordinalEmbarqueLabel(embarque, pedido = {}) {
  const idx = indiceOrdinalEmbarque(embarque, pedido);
  return `#${String(idx + 1).padStart(2, '0')}`;
}
