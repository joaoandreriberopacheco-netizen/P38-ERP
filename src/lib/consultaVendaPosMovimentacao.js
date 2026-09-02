/**
 * Consulta por comprovante — estado dos produtos após devolução/troca no pedido origem.
 */
import {
  devolucaoItensRetorno,
  devolucaoItensSubstitutos,
} from '@/lib/substituicoesVendaCaixa';
import { formatQuantidadeDisplay } from '@/lib/parseQuantidadeInput';
import { roundToTwoDecimals } from '@/lib/financialUtils';

function round2(n) {
  return roundToTwoDecimals(n);
}

function normNumero(numero) {
  return String(numero || '').trim().toUpperCase();
}

function devolucaoDados(dt) {
  return dt?.dados && typeof dt.dados === 'object' ? dt.dados : {};
}

function devolucaoAtiva(dt) {
  return Boolean(dt?.numero) && String(dt?.status || '').toLowerCase() !== 'cancelada';
}

function devolucaoSaldoLiquido(dt) {
  const top = Number(dt?.saldo_liquido);
  if (Number.isFinite(top)) return round2(top);
  const dados = devolucaoDados(dt);
  if (Number.isFinite(Number(dados.saldo_liquido))) return round2(dados.saldo_liquido);
  const credito = round2(Number(dt?.valor_total_devolvido) || 0);
  const substitutos = round2(Number(dt?.valor_substitutos) || Number(dados.valor_substitutos) || 0);
  if (substitutos > 0 || credito > 0) return round2(credito - substitutos);
  return 0;
}

function itemLinhaKey(item) {
  return `${item?.produto_id || ''}::${item?.produto_nome || ''}`;
}

function resolveUnidadePedido(pedido, produtoId, produtoNome) {
  const item = (pedido?.itens || []).find(
    (linha) =>
      (produtoId && String(linha.produto_id) === String(produtoId)) ||
      (produtoNome && String(linha.produto_nome) === String(produtoNome))
  );
  return item?.unidade_medida || item?.unidade_sigla || 'UN';
}

function cloneLinhaPedido(item) {
  const quantidade = Number(item?.quantidade) || 0;
  const preco = Number(item?.preco_unitario_praticado ?? item?.preco_unitario) || 0;
  const desconto = Number(item?.desconto_unitario) || 0;
  const total = Number(item?.total);
  return {
    produto_id: item?.produto_id || '',
    produto_nome: item?.produto_nome || 'Produto',
    unidade_medida: item?.unidade_medida || item?.unidade_sigla || 'UN',
    quantidade,
    preco_unitario_praticado: preco,
    desconto_unitario: desconto,
    total: Number.isFinite(total) ? round2(total) : round2(quantidade * Math.max(0, preco - desconto)),
  };
}

function recalcLinhaTotal(linha) {
  const qtd = Number(linha.quantidade) || 0;
  const unit = Math.max(
    0,
    (Number(linha.preco_unitario_praticado) || 0) - (Number(linha.desconto_unitario) || 0)
  );
  linha.total = round2(qtd * unit);
  return linha;
}

function ordenarDevolucoes(devolucoes = []) {
  return [...devolucoes].sort(
    (a, b) => new Date(a?.created_date || 0).getTime() - new Date(b?.created_date || 0).getTime()
  );
}

/** Índice pedido origem → devoluções/trocas processadas. */
export function buildIndiceDevolucaoPorPedido(devolucoes = []) {
  const porPedidoId = new Map();
  const porPedidoNumero = new Map();

  for (const dt of devolucoes || []) {
    if (!devolucaoAtiva(dt)) continue;
    const pid = dt.pedido_origem_id ? String(dt.pedido_origem_id) : '';
    const pnum = normNumero(dt.pedido_origem_numero);
    if (pid) {
      if (!porPedidoId.has(pid)) porPedidoId.set(pid, []);
      porPedidoId.get(pid).push(dt);
    }
    if (pnum) {
      if (!porPedidoNumero.has(pnum)) porPedidoNumero.set(pnum, []);
      porPedidoNumero.get(pnum).push(dt);
    }
  }

  for (const lista of porPedidoId.values()) ordenarDevolucoes(lista);
  for (const lista of porPedidoNumero.values()) ordenarDevolucoes(lista);

  return { porPedidoId, porPedidoNumero };
}

export function resolverDevolucoesPedidoConsulta(pedido, indice = { porPedidoId: new Map(), porPedidoNumero: new Map() }) {
  if (!pedido) return [];
  const porId = indice.porPedidoId?.get(String(pedido.id)) || [];
  const porNumero = indice.porPedidoNumero?.get(normNumero(pedido.numero)) || [];
  const merged = new Map();
  [...porId, ...porNumero].forEach((dt) => {
    if (dt?.numero) merged.set(normNumero(dt.numero), dt);
  });
  return ordenarDevolucoes([...merged.values()]);
}

/**
 * @returns {null | {
 *   itensAjustados: object[],
 *   substituicoes: { tipo: 'entrou'|'saiu', quantidade, produto_nome, unidade_medida, total }[],
 *   saldoOperacao: number,
 *   devolucoes: object[],
 * }}
 */
export function montarConsultaComprovantePosMovimentacao(pedido, indiceDevolucoes) {
  const devolucoes = resolverDevolucoesPedidoConsulta(pedido, indiceDevolucoes);
  if (!devolucoes.length) return null;

  const mapa = new Map();
  for (const item of pedido?.itens || []) {
    const linha = cloneLinhaPedido(item);
    if (!linha.produto_id && !linha.produto_nome) continue;
    mapa.set(itemLinhaKey(linha), linha);
  }

  const substituicoes = [];
  let saldoOperacao = 0;

  for (const dt of devolucoes) {
    saldoOperacao = round2(saldoOperacao + devolucaoSaldoLiquido(dt));

    for (const retorno of devolucaoItensRetorno(dt)) {
      const qtd = Number(retorno.quantidade_devolvida) || 0;
      if (qtd <= 0) continue;
      const key = itemLinhaKey(retorno);
      const existente = mapa.get(key);
      if (existente) {
        existente.quantidade = round2(Math.max(0, (Number(existente.quantidade) || 0) - qtd));
        recalcLinhaTotal(existente);
        if (existente.quantidade <= 0) mapa.delete(key);
      }
      substituicoes.push({
        tipo: 'saiu',
        produto_id: retorno.produto_id,
        produto_nome: retorno.produto_nome || 'Produto',
        quantidade: qtd,
        unidade_medida: resolveUnidadePedido(pedido, retorno.produto_id, retorno.produto_nome),
        total: round2(Number(retorno.total) || (Number(retorno.preco_unitario) || 0) * qtd),
        devolucaoNumero: dt.numero,
      });
    }

    for (const sub of devolucaoItensSubstitutos(dt)) {
      const qtd = Number(sub.quantidade) || 0;
      if (qtd <= 0) continue;
      const key = itemLinhaKey(sub);
      const preco = Number(sub.preco_unitario) || 0;
      const existente = mapa.get(key);
      if (existente) {
        existente.quantidade = round2((Number(existente.quantidade) || 0) + qtd);
        recalcLinhaTotal(existente);
      } else {
        mapa.set(
          key,
          recalcLinhaTotal({
            produto_id: sub.produto_id,
            produto_nome: sub.produto_nome || 'Produto',
            unidade_medida: sub.unidade_medida || 'UN',
            quantidade: qtd,
            preco_unitario_praticado: preco,
            desconto_unitario: 0,
            total: round2(Number(sub.total) || preco * qtd),
          })
        );
      }
      substituicoes.push({
        tipo: 'entrou',
        produto_id: sub.produto_id,
        produto_nome: sub.produto_nome || 'Produto',
        quantidade: qtd,
        unidade_medida: sub.unidade_medida || 'UN',
        total: round2(Number(sub.total) || preco * qtd),
        devolucaoNumero: dt.numero,
      });
    }
  }

  const itensAjustados = [...mapa.values()].filter((item) => (Number(item.quantidade) || 0) > 0);

  if (!substituicoes.length && !itensAjustados.length) return null;

  return {
    itensAjustados,
    substituicoes,
    saldoOperacao,
    devolucoes,
  };
}

export function formatSubstituicaoQuantidade(quantidade, unidade) {
  return `${formatQuantidadeDisplay(quantidade)} ${String(unidade || 'UN').toUpperCase()}`;
}

/** Agrega quantidades por produto usando o estado pós devolução/troca de cada pedido. */
export function aggregateProdutosConsulta(vendas = [], indiceDevolucoes) {
  const map = new Map();

  for (const venda of vendas) {
    const posMovimentacao = montarConsultaComprovantePosMovimentacao(venda, indiceDevolucoes);
    const itens = posMovimentacao?.itensAjustados?.length
      ? posMovimentacao.itensAjustados
      : venda?.itens || [];

    for (const item of itens) {
      const key = item.produto_id || item.produto_nome || 'sem-id';
      const qtd = Number(item.quantidade) || 0;
      if (qtd <= 0) continue;
      const total =
        Number(item.total) ||
        round2((Number(item.preco_unitario_praticado ?? item.preco_unitario) || 0) * qtd);
      const prev = map.get(key) || {
        key,
        nome: item.produto_nome || 'Produto',
        unidade: item.unidade_medida || item.unidade_sigla || 'UN',
        quantidade: 0,
        total: 0,
      };
      prev.quantidade = round2(prev.quantidade + qtd);
      prev.total = round2(prev.total + total);
      map.set(key, prev);
    }
  }

  return [...map.values()]
    .filter((p) => (Number(p.quantidade) || 0) > 0)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
}
