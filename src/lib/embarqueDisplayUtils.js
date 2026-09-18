/**
 * Código de exibição (AB6-PPQ-A) e ordenação cronológica dos splits.
 * A = primeiro despacho; B, C… seguem a ordem de criação/despacho.
 */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function normCodigo(value = '') {
  return String(value || '').trim().replace(/\s+/g, '');
}

/** Código gravado no embarque ou fallback pelo pedido. */
export function resolveEmbarqueCodigoExibicao(pedido, embarque) {
  const direto = embarque?.codigo_exibicao || embarque?.dados?.codigo_exibicao;
  if (direto && normCodigo(direto)) return normCodigo(direto);

  const base = String(pedido?.numero || '').replace(/\s+/g, '');
  const sufixo = parseSufixoCodigoEmbarque(embarque, pedido);
  return sufixo ? `${base}-${sufixo}` : base;
}

/** Letra final do código (A, B, C…). */
export function parseSufixoCodigoEmbarque(embarque, pedido = {}) {
  const codigo = embarque?.codigo_exibicao || embarque?.dados?.codigo_exibicao;
  if (codigo) {
    const m = normCodigo(codigo).match(/-([A-Z])$/i);
    if (m) return m[1].toUpperCase();
  }

  const idx = indiceOrdinalEmbarque(embarque, pedido);
  return LETTERS[idx] || 'A';
}

function timestampEmbarque(embarque = {}) {
  const raw = embarque.data_embarque || embarque.created_date || embarque.created_at;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function isEmbarqueNecessidadeTipo(embarque = {}) {
  return embarque?.tipo === 'Necessidade';
}

/** Índice 0-based na sequência A,B,C… (reais primeiro, depois Necessidade). */
export function indiceOrdinalEmbarque(embarque, pedido = {}) {
  const ordenados = sortEmbarquesParaExibicao(pedido?._embarques || [], pedido);
  const idx = ordenados.findIndex((item) => item.id === embarque?.id);
  return idx >= 0 ? idx : 0;
}

/**
 * Ordena splits para UI: sufixo A→Z quando existir; senão data_embarque/created.
 * Embarques reais antes de Necessidade quando empate de data.
 */
export function sortEmbarquesParaExibicao(embarques = [], pedido = {}) {
  return [...(embarques || [])].sort((a, b) => {
    const sa = parseSufixoCodigoEmbarque(a, { ...pedido, _embarques: embarques });
    const sb = parseSufixoCodigoEmbarque(b, { ...pedido, _embarques: embarques });
    const na = sa ? sa.charCodeAt(0) : null;
    const nb = sb ? sb.charCodeAt(0) : null;
    if (na != null && nb != null && na !== nb) return na - nb;

    const ta = timestampEmbarque(a);
    const tb = timestampEmbarque(b);
    if (ta !== tb) return ta - tb;

    const necA = isEmbarqueNecessidadeTipo(a) ? 1 : 0;
    const necB = isEmbarqueNecessidadeTipo(b) ? 1 : 0;
    if (necA !== necB) return necA - necB;

    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

/** Próxima letra para novo despacho (ignora duplicados de sufixo). */
export function proximaLetraEmbarquePedido(embarques = [], pedido = {}) {
  const usadas = new Set(
    (embarques || [])
      .map((emb) => parseSufixoCodigoEmbarque(emb, { ...pedido, _embarques: embarques }))
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
