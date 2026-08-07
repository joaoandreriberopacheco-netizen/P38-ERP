import { normalizeSearchText } from '@/lib/normalizeSearchText';

/**
 * Busca no Fluxo de Caixa.
 * Prefixo \\ (duas barras) filtra por conta: \\PP → "CAIXA PP".
 * Texto após espaço combina com busca normal: \\PP pagamento
 */
export function parseBuscaFluxoCaixa(search = '') {
  const raw = String(search || '').trim();
  if (!raw) {
    return { modo: 'texto', contaQuery: null, texto: '' };
  }
  if (raw.startsWith('\\\\')) {
    const rest = raw.slice(2);
    const spaceIdx = rest.search(/\s/);
    const contaQuery = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).trim();
    const texto = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).trim();
    return { modo: 'conta', contaQuery, texto };
  }
  return { modo: 'texto', contaQuery: null, texto: raw };
}

export function contaFinanceiraMatchBusca(conta, contaQuery) {
  if (!conta || !contaQuery) return false;
  const q = normalizeSearchText(contaQuery);
  const nome = normalizeSearchText(conta.nome);
  return nome.includes(q);
}

/** Resolve se o lançamento pertence à conta indicada na busca \\conta. */
export function lancamentoMatchBuscaConta(l, contaQuery, contas = [], contasById = {}) {
  if (!contaQuery) return true;
  const q = normalizeSearchText(contaQuery);

  const nomeLanc = normalizeSearchText(l.conta_financeira_nome);
  if (nomeLanc && nomeLanc.includes(q)) return true;

  if (l.conta_financeira_id) {
    const conta = contasById[l.conta_financeira_id];
    if (contaFinanceiraMatchBusca(conta, contaQuery)) return true;
  }

  if (!l.conta_financeira_id) {
    return contas.some((c) => c.is_caixa_geral && contaFinanceiraMatchBusca(c, contaQuery));
  }

  return false;
}

export function lancamentoMatchBuscaTexto(l, texto) {
  if (!texto) return true;
  const q = normalizeSearchText(texto);
  return (
    normalizeSearchText(l.descricao).includes(q) ||
    normalizeSearchText(l.categoria).includes(q) ||
    normalizeSearchText(l.conta_financeira_nome).includes(q) ||
    normalizeSearchText(l.referencia_numero).includes(q) ||
    (Array.isArray(l.tags) && l.tags.some((t) => normalizeSearchText(t).includes(q)))
  );
}

export function lancamentoPassaBuscaFluxo(l, search, contas = [], contasById = {}) {
  if (!String(search || '').trim()) return true;

  const { modo, contaQuery, texto } = parseBuscaFluxoCaixa(search);

  if (modo === 'conta') {
    if (!contaQuery) return true;
    if (!lancamentoMatchBuscaConta(l, contaQuery, contas, contasById)) return false;
    return lancamentoMatchBuscaTexto(l, texto);
  }

  return lancamentoMatchBuscaTexto(l, texto);
}

/** Contas cujo nome corresponde à busca \\conta (null = sem filtro de conta na busca). */
export function contasMatchBuscaFluxo(search, contas = []) {
  const { modo, contaQuery } = parseBuscaFluxoCaixa(search);
  if (modo !== 'conta' || !contaQuery) return null;
  return contas.filter((c) => contaFinanceiraMatchBusca(c, contaQuery));
}

/**
 * Contas usadas no saldo acumulado: intersecta filtro de contas com \\conta na busca.
 * Retorna null quando não há restrição extra (mesma regra de contasSel vazio = todas).
 */
export function contasSelEfetivasFluxo(contasSel = [], contasAtivas = [], contasBusca = null) {
  if (!contasBusca?.length) return null;
  const base = contasSel.length
    ? contasAtivas.filter((c) => contasSel.includes(c.id))
    : [...contasAtivas];
  const buscaIds = new Set(contasBusca.map((c) => c.id));
  return base.filter((c) => buscaIds.has(c.id)).map((c) => c.id);
}

/** Lista de contas para saldo/KPIs a partir de contasSel + opcional restrição da busca \\conta. */
export function contasVisiveisFluxo(contasSel = [], contasAtivas = [], contasSelBusca = null) {
  if (contasSelBusca !== null) {
    return contasAtivas.filter((c) => contasSelBusca.includes(c.id));
  }
  if (contasSel.length) {
    return contasAtivas.filter((c) => contasSel.includes(c.id));
  }
  return contasAtivas;
}

/** IDs para filtrar movimentos/KPIs (vazio = sem filtro por conta). */
export function idsFiltroContasFluxo(contasSel = [], contasSelBusca = null) {
  if (contasSelBusca !== null) return contasSelBusca;
  return contasSel;
}
