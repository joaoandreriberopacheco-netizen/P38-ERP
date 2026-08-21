/**
 * Pedidos/embarques excluídos de Necessidade e Consulta (legado / decisão operacional).
 * Normalização: trim, sem espaços, maiúsculas (ex.: E62-67G, 49K-PKG-A).
 */
export const EMBARQUE_CODIGOS_EXCLUIDOS_OPERACIONAL = [
  'E62-67G',
  '49K-PKG',
  'MHK-S8W',
  'FKJ-2GF',
  'WX7-A5N',
  '6DB-B2S',
  'EHJ-BM9',
  'G62-HUF',
  'EXC-FQZ',
  'NXJ-53K',
];

/** @deprecated alias — prefer EMBARQUE_CODIGOS_EXCLUIDOS_OPERACIONAL */
export const NECESSIDADE_EMBARQUE_CODIGOS_EXCLUIDOS = EMBARQUE_CODIGOS_EXCLUIDOS_OPERACIONAL;

function normalizarCodigoEmbarque(codigo = '') {
  return String(codigo || '').trim().replace(/\s+/g, '').toUpperCase();
}

function codigoCorrespondeExclusao(norm = '', excluido = '') {
  const base = normalizarCodigoEmbarque(excluido);
  if (!base || !norm) return false;
  return norm === base || norm.startsWith(`${base}-`);
}

export function codigoEmbarqueExcluidoOperacional(codigo = '') {
  const norm = normalizarCodigoEmbarque(codigo);
  return EMBARQUE_CODIGOS_EXCLUIDOS_OPERACIONAL.some((excluido) =>
    codigoCorrespondeExclusao(norm, excluido),
  );
}

export function resolverCodigoEmbarqueExibicao(pedido, embarque) {
  if (!embarque) return '';
  const direto = embarque.codigo_exibicao || embarque.numero || '';
  if (direto) return String(direto).trim();
  const base = String(pedido?.numero || '').replace(/\s+/g, '');
  return base;
}

/** Exclui card da Necessidade e da Consulta de embarques. */
export function embarqueExcluidoOperacional(pedido, embarque, displayCode = '') {
  const candidatos = [
    displayCode,
    pedido?.numero,
    embarque?.codigo_exibicao,
    embarque?.numero,
  ].filter(Boolean);
  if (candidatos.some((c) => codigoEmbarqueExcluidoOperacional(c))) return true;
  return codigoEmbarqueExcluidoOperacional(resolverCodigoEmbarqueExibicao(pedido, embarque));
}
