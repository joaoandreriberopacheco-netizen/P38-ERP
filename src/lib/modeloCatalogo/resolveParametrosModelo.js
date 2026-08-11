import {
  CERAM_MASSA_CRITICA_CX,
  CERAM_META_VAGAS,
  CERAM_MIN_LINHAS_SALDAVEL,
} from '@/lib/modeloCatalogo/regrasCeramica';

function pickNumber(pcVal, linhaVal, fallback) {
  if (pcVal != null && pcVal !== '' && !Number.isNaN(Number(pcVal))) return Number(pcVal);
  if (linhaVal != null && linhaVal !== '' && !Number.isNaN(Number(linhaVal))) return Number(linhaVal);
  return fallback;
}

function pickText(pcVal, linhaVal, fallback = '') {
  const p = String(pcVal ?? '').trim();
  if (p) return p;
  const l = String(linhaVal ?? '').trim();
  if (l) return l;
  return fallback;
}

/**
 * Parâmetros efectivos do produto compra (PC sobrescreve LINHA quando preenchido).
 */
export function resolveParametrosProdutoCompra(produtoCompra, linha) {
  const pc = produtoCompra || {};
  const ln = linha || {};

  const meta_vagas = pickNumber(pc.meta_vagas, ln.meta_vagas, CERAM_META_VAGAS);
  const massa_critica = pickNumber(pc.massa_critica, ln.massa_critica, CERAM_MASSA_CRITICA_CX);
  const min_linhas_saldavel = pickNumber(pc.min_linhas_saldavel, ln.min_linhas_saldavel, CERAM_MIN_LINHAS_SALDAVEL);
  const eixo_a_rotulo = pickText(pc.eixo_a_rotulo, ln.eixo_a_rotulo, 'Eixo A');
  const eixo_b_rotulo = pickText(pc.eixo_b_rotulo, ln.eixo_b_rotulo, 'Eixo B');

  return {
    meta_vagas,
    massa_critica,
    min_linhas_saldavel,
    eixo_a_rotulo,
    eixo_b_rotulo,
    overrides: {
      meta_vagas: pc.meta_vagas != null,
      massa_critica: pc.massa_critica != null,
      min_linhas_saldavel: pc.min_linhas_saldavel != null,
      eixo_a_rotulo: Boolean(String(pc.eixo_a_rotulo ?? '').trim()),
      eixo_b_rotulo: Boolean(String(pc.eixo_b_rotulo ?? '').trim()),
    },
    linha_id: ln.id || pc.linha_id,
    linha_nome: ln.nome,
    linha_codigo: ln.codigo,
  };
}

/** Mapa linha_id → linha para resolver em lote */
export function indexLinhasPorId(linhas) {
  return new Map((linhas || []).map((l) => [l.id, l]));
}

export function resolveProdutoCompraComLinha(produtoCompra, linhaById) {
  const linha = linhaById.get(produtoCompra.linha_id) || null;
  const params = resolveParametrosProdutoCompra(produtoCompra, linha);
  return { ...produtoCompra, ...params, _linha: linha };
}
