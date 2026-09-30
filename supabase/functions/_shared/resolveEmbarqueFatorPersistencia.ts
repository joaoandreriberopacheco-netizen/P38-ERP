/** Espelho de src/lib/resolveEmbarqueFatorPersistencia.js (Edge saveEmbarqueItem). */

const SIGLA_NORMALIZE_MAP: Record<string, string> = {
  CAIXA: 'CX', CAIXAS: 'CX',
  'M²': 'M2', 'METRO QUADRADO': 'M2', 'METROS QUADRADOS': 'M2',
  PEÇA: 'PC', PEÇAS: 'PC', PECA: 'PC', PECAS: 'PC',
  UNIDADE: 'UN', UNIDADES: 'UN',
};

export const normalizeUnitCodeEmbarque = (raw: unknown): string => {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return '';
  const noAccents = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (SIGLA_NORMALIZE_MAP[s]) return SIGLA_NORMALIZE_MAP[s];
  if (SIGLA_NORMALIZE_MAP[noAccents]) return SIGLA_NORMALIZE_MAP[noAccents];
  return s.replace('²', '2');
};

function fatorNum(item: Record<string, unknown> = {}): number {
  return (
    Number(item?.fator_apresentacao ?? item?.fator_aplicado ?? item?.fator_conversao) || 0
  );
}

function unidadeSigla(item: Record<string, unknown> = {}): string {
  return normalizeUnitCodeEmbarque(
    item?.unidade_apresentacao || item?.unidade_sigla || item?.unidade_medida || '',
  );
}

export function resolveFatorParaGravacaoEmbarque(
  linhaPedido: Record<string, unknown> = {},
  it: Record<string, unknown> = {},
): number {
  const fatorAcao = fatorNum(it);
  const fatorPed = fatorNum(linhaPedido);
  const unAcao = unidadeSigla(it);
  const unPed = unidadeSigla(linhaPedido);
  const unidadesDiferentes = Boolean(unAcao && unPed && unAcao !== unPed);

  if (fatorAcao > 0 && (unidadesDiferentes || fatorAcao > 1.001)) {
    return fatorAcao;
  }
  if (fatorPed > 0) return fatorPed;
  return fatorAcao > 0 ? fatorAcao : 1;
}

export function resolveUnidadeSiglaParaGravacaoEmbarque(
  linhaPedido: Record<string, unknown> = {},
  it: Record<string, unknown> = {},
): string {
  const unAcao = unidadeSigla(it);
  if (unAcao) return unAcao;
  const unPed = unidadeSigla(linhaPedido);
  return unPed || 'UN';
}

export function resolveFatorPedidoCompraLinha(linhaPedido: Record<string, unknown> = {}): number {
  const f = fatorNum(linhaPedido);
  return f > 0 ? f : 1;
}
