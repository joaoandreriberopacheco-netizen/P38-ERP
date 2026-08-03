/**
 * Backfill: pedidos de compra em Rascunho com desconto de linha gravado em separado
 * passam a ter custo unitário líquido (desconto incorporado).
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function resolveDescontoFator1Mirror(item = {}) {
  const direto = Number(item?.desconto_unitario ?? item?.valor_desconto_item) || 0;
  if (direto !== 0) return direto;
  const pct = Number(item?.desconto_pct_item) || 0;
  if (pct <= 0) return 0;
  const custo = Number(item?.custo_unitario) || 0;
  if (custo <= 0) return 0;
  return round2((custo * pct) / 100);
}

function calcValorTotalPedidoCompra(pedido = {}, itens = []) {
  const valorItens = round2(
    (Array.isArray(itens) ? itens : []).reduce((s, it) => s + (Number(it?.total) || 0), 0),
  );
  const frete = Number(pedido?.valor_frete) || 0;
  const desconto = Number(pedido?.valor_desconto) || 0;
  return round2(valorItens + frete - desconto);
}

/** Normaliza item do espelho `PedidoCompra.itens[]`. */
export function normalizeMirrorItemDescontoLiquido(item = {}) {
  const desconto = resolveDescontoFator1Mirror(item);
  if (desconto === 0) return { item, changed: false };

  const fator = Number(item?.fator_conversao) || 1;
  const qty = Number(item?.quantidade) || 0;
  const qb = Number(item?.quantidade_base);
  const qBase = Number.isFinite(qb) && qb > 0 ? qb : qty * fator;

  const custoBruto = Number(item?.custo_unitario) || 0;
  const frete = Number(item?.custo_frete_unitario) || 0;
  const outros = Number(item?.custo_outros_unitario) || 0;
  const custoLiquido = round2(custoBruto - desconto);
  const custoFinal = round2(custoLiquido + frete + outros);
  const total = round2(qBase * custoFinal);

  return {
    changed: true,
    item: {
      ...item,
      quantidade_base: qBase,
      preco_eixo: 'FATOR_1',
      unidade_apresentacao: item?.unidade_apresentacao || item?.unidade_medida || 'UN',
      custo_unitario: custoLiquido,
      custo_unitario_base: custoLiquido,
      custo_final_unitario: custoFinal,
      custo_final_unitario_base: custoFinal,
      custo_unitario_apresentacao: round2(custoLiquido * fator),
      custo_final_unitario_apresentacao: round2(custoFinal * fator),
      desconto_unitario: 0,
      valor_desconto_item: 0,
      desconto_pct_item: 0,
      subtotal: round2(qBase * custoLiquido),
      total,
    },
  };
}

/** Normaliza linha canónica `PedidoCompraItem`. */
export function normalizeCanonicalItemDescontoLiquido(linha = {}) {
  const desconto = Number(linha?.desconto_unitario_fator1) || 0;
  if (desconto === 0) return { item: linha, changed: false };

  const custoBruto = Number(linha?.custo_unitario_fator1) || 0;
  const frete = Number(linha?.frete_unitario_fator1) || 0;
  const outros = Number(linha?.outros_unitario_fator1) || 0;
  const fator = Number(linha?.fator_aplicado) || 1;
  const custoLiquido = round2(custoBruto - desconto);
  const custoTotal = round2(custoLiquido + frete + outros);
  const qBase = Number(linha?.quantidade_base) || 0;

  return {
    changed: true,
    item: {
      ...linha,
      custo_unitario_fator1: custoLiquido,
      custo_unitario_comercial: round2(custoLiquido * fator),
      desconto_unitario_fator1: 0,
      custo_total_unitario_fator1: custoTotal,
      total: round2(qBase * custoTotal),
    },
  };
}

function getEntityClient(base44) {
  if (base44?.entities) return base44;
  return base44?.asServiceRole ?? base44;
}

async function listPedidosRascunho(client, limit = 500) {
  const out = [];
  const pageSize = 200;
  let offset = 0;

  while (out.length < limit) {
    const chunk = await client.entities.PedidoCompra.list('-created_date', pageSize, offset);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    for (const pedido of chunk) {
      if (String(pedido?.status || '').trim() !== 'Rascunho') continue;
      out.push(pedido);
      if (out.length >= limit) break;
    }
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  return out;
}

/**
 * @param {object} base44
 * @param {{ dryRun?: boolean, limit?: number }} [opts]
 */
export async function normalizarPedidosCompraRascunhoDesconto(base44, opts = {}) {
  const dryRun = opts.dryRun !== false;
  const limit = Math.min(Number(opts.limit) || 500, 2000);
  const client = getEntityClient(base44);

  const alvo = await listPedidosRascunho(client, limit);

  const relatorio = {
    dry_run: dryRun,
    pedidos_lidos: alvo.length,
    pedidos_alterados: 0,
    itens_alterados_espelho: 0,
    itens_alterados_canonicos: 0,
    pedidos: [],
  };

  for (const pedido of alvo) {
    const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
    if (!itens.length) continue;

    let itensChanged = 0;
    const itensNorm = itens.map((it) => {
      const { item, changed } = normalizeMirrorItemDescontoLiquido(it);
      if (changed) itensChanged += 1;
      return item;
    });

    const linhas = await client.entities.PedidoCompraItem.filter({ pedido_compra_id: pedido.id });
    let canonicosChanged = 0;
    const linhasNorm = (linhas || []).map((linha) => {
      const { item, changed } = normalizeCanonicalItemDescontoLiquido(linha);
      if (changed) canonicosChanged += 1;
      return { original: linha, item };
    });

    if (itensChanged === 0 && canonicosChanged === 0) continue;

    const valorItens = round2(itensNorm.reduce((s, it) => s + (Number(it.total) || 0), 0));
    const payload = {
      itens: itensNorm,
      valor_itens: valorItens,
      valor_total: calcValorTotalPedidoCompra({ ...pedido, valor_itens: valorItens }, itensNorm),
    };

    relatorio.pedidos_alterados += 1;
    relatorio.itens_alterados_espelho += itensChanged;
    relatorio.itens_alterados_canonicos += canonicosChanged;
    relatorio.pedidos.push({
      id: pedido.id,
      numero: pedido.numero,
      itens_espelho: itensChanged,
      itens_canonicos: canonicosChanged,
      valor_itens: payload.valor_itens,
      valor_total: payload.valor_total,
    });

    if (!dryRun) {
      await client.entities.PedidoCompra.update(pedido.id, payload);
      for (const { original, item } of linhasNorm) {
        if (Number(original?.desconto_unitario_fator1) === 0) continue;
        await client.entities.PedidoCompraItem.update(original.id, {
          custo_unitario_fator1: item.custo_unitario_fator1,
          custo_unitario_comercial: item.custo_unitario_comercial,
          desconto_unitario_fator1: 0,
          custo_total_unitario_fator1: item.custo_total_unitario_fator1,
          total: item.total,
        });
      }
    }
  }

  return relatorio;
}
