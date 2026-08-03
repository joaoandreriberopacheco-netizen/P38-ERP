import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const round6 = (n: number) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const isPedidoNaoConcluido = (pedido: any) => {
  const status = String(pedido?.status || '').trim();
  const statusReceb = String(pedido?.status_recebimento_geral || '').trim();
  return status !== 'Concluído' && !statusReceb.startsWith('Concluído');
};

const isPedidoRascunho = (pedido: any) => String(pedido?.status || '').trim() === 'Rascunho';

const resolveDescontoFator1Mirror = (item: any = {}) => {
  const direto = Number(item?.desconto_unitario ?? item?.valor_desconto_item) || 0;
  if (direto !== 0) return direto;
  const pct = Number(item?.desconto_pct_item) || 0;
  if (pct <= 0) return 0;
  const custo = Number(item?.custo_unitario) || 0;
  if (custo <= 0) return 0;
  return round2((custo * pct) / 100);
};

const normalizeItemDescontoLiquido = (item: any = {}) => {
  const desconto = resolveDescontoFator1Mirror(item);
  if (desconto === 0) return { item, changed: false };

  const fator = Number(item?.fator_conversao) || 1;
  const quantidade = Number(item?.quantidade) || 0;
  const quantidadeBase = Number(item?.quantidade_base);
  const quantidadeBaseFinal = Number.isFinite(quantidadeBase) && quantidadeBase > 0
    ? quantidadeBase
    : (quantidade * fator);

  const custoBruto = Number(item?.custo_unitario) || 0;
  const frete = Number(item?.custo_frete_unitario) || 0;
  const outros = Number(item?.custo_outros_unitario) || 0;
  const custoLiquido = round6(custoBruto - desconto);
  const custoFinal = round6(custoLiquido + frete + outros);
  const total = round6(quantidadeBaseFinal * custoFinal);

  return {
    changed: true,
    item: {
      ...item,
      quantidade_base: round6(quantidadeBaseFinal),
      preco_eixo: 'FATOR_1',
      unidade_apresentacao: item?.unidade_apresentacao || item?.unidade_medida || 'UN',
      custo_unitario: custoLiquido,
      custo_unitario_base: custoLiquido,
      custo_final_unitario: custoFinal,
      custo_final_unitario_base: custoFinal,
      custo_unitario_apresentacao: round6(custoLiquido * fator),
      custo_final_unitario_apresentacao: round6(custoFinal * fator),
      desconto_unitario: 0,
      valor_desconto_item: 0,
      desconto_pct_item: 0,
      subtotal: round6(quantidadeBaseFinal * custoLiquido),
      total,
    },
  };
};

const normalizeItemCanonical = (item: any = {}) => {
  const fator = Number(item?.fator_conversao) || 1;
  const quantidade = Number(item?.quantidade) || 0;
  const quantidadeBase = Number(item?.quantidade_base);
  const quantidadeBaseFinal = Number.isFinite(quantidadeBase) && quantidadeBase > 0
    ? quantidadeBase
    : (quantidade * fator);

  const custoUnit = Number(item?.custo_unitario) || 0;
  const custoFinal = Number.isFinite(Number(item?.custo_final_unitario))
    ? Number(item?.custo_final_unitario)
    : custoUnit;

  const totalRecalculado = quantidadeBaseFinal * custoFinal;

  return {
    ...item,
    quantidade_base: round6(quantidadeBaseFinal),
    preco_eixo: 'FATOR_1',
    unidade_apresentacao: item?.unidade_apresentacao || item?.unidade_medida || 'UN',
    custo_unitario_base: round6(custoUnit),
    custo_final_unitario_base: round6(custoFinal),
    custo_unitario_apresentacao: round6(custoUnit * fator),
    custo_final_unitario_apresentacao: round6(custoFinal * fator),
    subtotal: round6(quantidadeBaseFinal * custoUnit),
    total: round6(totalRecalculado),
  };
};

const normalizeCanonicalLinhaDescontoLiquido = (linha: any = {}) => {
  const desconto = Number(linha?.desconto_unitario_fator1) || 0;
  if (desconto === 0) return { item: linha, changed: false };

  const custoBruto = Number(linha?.custo_unitario_fator1) || 0;
  const frete = Number(linha?.frete_unitario_fator1) || 0;
  const outros = Number(linha?.outros_unitario_fator1) || 0;
  const fator = Number(linha?.fator_aplicado) || 1;
  const custoLiquido = round6(custoBruto - desconto);
  const custoTotal = round6(custoLiquido + frete + outros);
  const qBase = Number(linha?.quantidade_base) || 0;

  return {
    changed: true,
    item: {
      ...linha,
      custo_unitario_fator1: custoLiquido,
      custo_unitario_comercial: round6(custoLiquido * fator),
      desconto_unitario_fator1: 0,
      custo_total_unitario_fator1: custoTotal,
      total: round6(qBase * custoTotal),
    },
  };
};

const calcValorTotalPedido = (pedido: any, itens: any[]) => {
  const valorItens = round2(itens.reduce((acc, it) => acc + (Number(it?.total) || 0), 0));
  const frete = Number(pedido?.valor_frete) || 0;
  const desconto = Number(pedido?.valor_desconto) || 0;
  return round2(valorItens + frete - desconto);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run !== false;
    const limit = Math.min(Number(body?.limit) || 200, 1000);
    const apenasRascunho = body?.apenas_rascunho === true;
    const incorporarDescontoLiquido = body?.incorporar_desconto_liquido === true;

    const pedidos = await base44.asServiceRole.entities.PedidoCompra.list();
    const pendentes = (pedidos || [])
      .filter((p: any) => (apenasRascunho ? isPedidoRascunho(p) : isPedidoNaoConcluido(p)))
      .slice(0, limit);

    const updates: Array<Record<string, unknown>> = [];
    let itensEspelhoAlterados = 0;
    let itensCanonicosAlterados = 0;

    for (const pedido of pendentes) {
      const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
      if (!itens.length) continue;

      let espelhoChanged = 0;
      const itensNorm = itens.map((item: any) => {
        const liquido = incorporarDescontoLiquido ? normalizeItemDescontoLiquido(item) : { item, changed: false };
        if (liquido.changed) espelhoChanged += 1;
        return normalizeItemCanonical(liquido.item);
      });

      const linhas = await base44.asServiceRole.entities.PedidoCompraItem.filter({ pedido_compra_id: pedido.id });
      let canonicosChanged = 0;
      const linhasNorm: Array<{ original: any; item: any }> = (linhas || []).map((linha: any) => {
        const norm = incorporarDescontoLiquido
          ? normalizeCanonicalLinhaDescontoLiquido(linha)
          : { item: linha, changed: false };
        if (norm.changed) canonicosChanged += 1;
        return { original: linha, item: norm.item };
      });

      if (incorporarDescontoLiquido && espelhoChanged === 0 && canonicosChanged === 0) continue;

      const valorItens = round2(itensNorm.reduce((acc: number, it: any) => acc + (Number(it?.total) || 0), 0));
      const valorTotal = calcValorTotalPedido(pedido, itensNorm);
      const payload = incorporarDescontoLiquido
        ? { itens: itensNorm, valor_itens: valorItens, valor_total: valorTotal }
        : { itens: itensNorm };

      if (dryRun) {
        updates.push({
          id: pedido.id,
          numero: pedido.numero,
          itens_count: itensNorm.length,
          itens_espelho_alterados: espelhoChanged,
          itens_canonicos_alterados: canonicosChanged,
          valor_itens: valorItens,
          valor_total: valorTotal,
        });
        itensEspelhoAlterados += espelhoChanged;
        itensCanonicosAlterados += canonicosChanged;
        continue;
      }

      await base44.asServiceRole.entities.PedidoCompra.update(pedido.id, payload);

      if (incorporarDescontoLiquido) {
        for (const { original, item } of linhasNorm) {
          if (Number(original?.desconto_unitario_fator1) === 0) continue;
          await base44.asServiceRole.entities.PedidoCompraItem.update(original.id, {
            custo_unitario_fator1: item.custo_unitario_fator1,
            custo_unitario_comercial: item.custo_unitario_comercial,
            desconto_unitario_fator1: 0,
            custo_total_unitario_fator1: item.custo_total_unitario_fator1,
            total: item.total,
          });
        }
      }

      updates.push({
        id: pedido.id,
        numero: pedido.numero,
        itens_count: itensNorm.length,
        itens_espelho_alterados: espelhoChanged,
        itens_canonicos_alterados: canonicosChanged,
        valor_itens: valorItens,
        valor_total: valorTotal,
      });
      itensEspelhoAlterados += espelhoChanged;
      itensCanonicosAlterados += canonicosChanged;
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      apenas_rascunho: apenasRascunho,
      incorporar_desconto_liquido: incorporarDescontoLiquido,
      total_lidos: pedidos?.length || 0,
      pendentes_processados: updates.length,
      itens_espelho_alterados: itensEspelhoAlterados,
      itens_canonicos_alterados: itensCanonicosAlterados,
      updates,
    });
  } catch (error) {
    console.error('normalizarPedidosCompraPendentes error:', error);
    return Response.json({ error: (error as Error)?.message || 'Erro inesperado' }, { status: 500 });
  }
});
