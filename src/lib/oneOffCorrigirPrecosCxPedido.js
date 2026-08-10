/**
 * Corrige totais inflados em linhas CX/PAC quando o custo fator-1 foi arredondado
 * antes de voltar ao preço da embalagem (ex.: importação NXJ-53K).
 *
 * Uso: scripts/corrigir-precos-cx-pedido.mjs --numero=NXJ-53K [--apply]
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function normalizarNumero(value = '') {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function isDiscretePackaging(unit = '') {
  return ['CX', 'PAC', 'CT', 'FD', 'SC', 'PCT', 'PCT', 'PT', 'DZ'].includes(
    String(unit || '').trim().toUpperCase(),
  );
}

/**
 * Reaplica preço da embalagem preservando precisão no fator-1.
 * @param {object} item
 * @param {number} precoEmbalagem — preço unitário na UM comercial (CX)
 */
export function corrigirLinhaCxPreco(item = {}, precoEmbalagem) {
  const fator = Number(item.fator_conversao) || 1;
  const qty = Number(item.quantidade) || 0;
  const apres = round2(precoEmbalagem);
  const custoF1 = fator > 0 ? apres / fator : apres;
  const total = round2(qty * apres);

  return {
    ...item,
    custo_unitario: custoF1,
    custo_unitario_base: custoF1,
    custo_final_unitario: custoF1,
    custo_final_unitario_base: custoF1,
    custo_unitario_apresentacao: apres,
    custo_final_unitario_apresentacao: apres,
    preco_eixo: 'FATOR_1',
    subtotal: total,
    total,
    valor_total_item: total,
  };
}

/**
 * Detecta linhas CX com preço inflado pelo arredondamento fator-1.
 * Retorna sugestão apenas quando o preço atual parece derivado de round2(custo_f1)×fator.
 */
export function detectarLinhasCxInfladas(item = {}) {
  const fator = Number(item.fator_conversao) || 1;
  const unit = item.unidade_medida || item.unidade_apresentacao || '';
  if (!(fator > 1) || !isDiscretePackaging(unit)) return null;

  const apresAtual = round2(item.custo_unitario_apresentacao ?? 0);
  const custoF1Atual = Number(item.custo_unitario) || 0;
  if (!(apresAtual > 0) || !(custoF1Atual > 0)) return null;

  const apresDerivada = round2(round2(custoF1Atual) * fator);
  if (Math.abs(apresDerivada - apresAtual) > 0.001) return null;

  const custoF1Preciso = apresAtual / fator;
  const apresRecuperada = round2(custoF1Preciso * fator);
  if (Math.abs(apresRecuperada - apresAtual) < 0.001) return null;

  return {
    produto_id: item.produto_id,
    produto_nome: item.produto_nome,
    preco_atual: apresAtual,
    preco_sugerido: round2(custoF1Preciso * fator),
    preco_preciso: round2(custoF1Preciso * fator),
    diferenca_por_caixa: round2((apresAtual - round2(custoF1Preciso * fator))),
  };
}

/** Preços conhecidos do documento NXJ-53K (GSP Metais). */
export const PRECOS_DOCUMENTO_NXJ_53K = {
  '69bd5bb179dbebad0676aecf': 73.5, // ESTRIBO 7x17
  '69bd5bb037b785a845b26bd3': 105.68, // ESTRIBO 17x17
};

export function corrigirItensPedidoCompra(itens = [], overridesPorProduto = {}) {
  return (itens || []).map((item) => {
    const override = overridesPorProduto[item.produto_id];
    if (override != null && Number(override) > 0) {
      return corrigirLinhaCxPreco(item, override);
    }
    const detectado = detectarLinhasCxInfladas(item);
    if (detectado && detectado.preco_preciso < detectado.preco_atual) {
      return corrigirLinhaCxPreco(item, detectado.preco_preciso);
    }
    return item;
  });
}

export function calcularTotaisPedido(itens = [], pedido = {}) {
  const valorItens = round2(
    (itens || []).reduce((acc, item) => acc + (Number(item.total) || 0), 0),
  );
  const frete = Number(pedido.valor_frete) || 0;
  const desconto = Number(pedido.valor_desconto) || 0;
  const valorTotal = round2(valorItens + frete - desconto);
  return { valorItens, valorTotal };
}

/**
 * @param {import('pg').Client} client
 * @param {{ numero?: string, pedidoId?: string, apply?: boolean, overrides?: Record<string, number> }} opts
 */
export async function corrigirPrecosCxPedidoSupabase(client, opts = {}) {
  const numeroNorm = normalizarNumero(opts.numero || '');
  const overrides = opts.overrides || {};

  let row;
  if (opts.pedidoId) {
    const res = await client.query('select * from pedido_compra where id = $1', [opts.pedidoId]);
    row = res.rows[0];
  } else if (numeroNorm) {
    const res = await client.query(
      "select * from pedido_compra where upper(replace(numero, ' ', '')) = $1",
      [numeroNorm],
    );
    row = res.rows[0];
  }

  if (!row) {
    return { ok: false, error: `Pedido ${opts.numero || opts.pedidoId} não encontrado.` };
  }

  const itensAntes = Array.isArray(row.itens)
    ? row.itens
    : typeof row.itens === 'string'
      ? JSON.parse(row.itens)
      : [];

  const itensDepois = corrigirItensPedidoCompra(itensAntes, overrides);
  const { valorItens, valorTotal } = calcularTotaisPedido(itensDepois, row);
  const dados = typeof row.dados === 'object' && row.dados ? { ...row.dados } : {};

  const mudancas = itensAntes
    .map((antes, idx) => {
      const depois = itensDepois[idx];
      const apresAntes = round2(antes.custo_unitario_apresentacao ?? 0);
      const apresDepois = round2(depois.custo_unitario_apresentacao ?? 0);
      const totalAntes = round2(antes.total ?? 0);
      const totalDepois = round2(depois.total ?? 0);
      if (Math.abs(apresAntes - apresDepois) < 0.001 && Math.abs(totalAntes - totalDepois) < 0.01) {
        return null;
      }
      return {
        produto_nome: antes.produto_nome,
        preco_antes: apresAntes,
        preco_depois: apresDepois,
        total_antes: totalAntes,
        total_depois: totalDepois,
      };
    })
    .filter(Boolean);

  const resultado = {
    ok: true,
    apply: Boolean(opts.apply),
    pedido_id: row.id,
    numero: row.numero,
    status: row.status,
    valor_total_antes: round2(row.valor_total),
    valor_total_depois: valorTotal,
    valor_itens_antes: round2(dados.valor_itens ?? row.valor_total),
    valor_itens_depois: valorItens,
    mudancas,
  };

  if (!opts.apply) return resultado;

  if (row.status !== 'Rascunho') {
    return {
      ...resultado,
      ok: false,
      error: `Pedido em status "${row.status}" — correção automática só em Rascunho.`,
    };
  }

  if (!mudancas.length) {
    return { ...resultado, skipped: true, message: 'Nenhuma linha precisava de correção.' };
  }

  dados.valor_itens = valorItens;
  await client.query(
    `update pedido_compra
     set itens = $2::jsonb,
         valor_total = $3,
         dados = $4::jsonb,
         updated_at = now()
     where id = $1`,
    [row.id, JSON.stringify(itensDepois), valorTotal, JSON.stringify(dados)],
  );

  return { ...resultado, updated: true };
}
