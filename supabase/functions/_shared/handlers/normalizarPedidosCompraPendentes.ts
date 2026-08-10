// Port automático de base44/functions/normalizarPedidosCompraPendentes/entry.ts
import type { createP38Client } from '../p38Client.ts';

const round6 = (n: number) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const isPedidoNaoConcluido = (pedido: any) => {
  const status = String(pedido?.status || '').trim();
  const statusReceb = String(pedido?.status_recebimento_geral || '').trim();
  return status !== 'Concluído' && !statusReceb.startsWith('Concluído');
};

const isPedidoRascunho = (pedido: any) => String(pedido?.status || '').trim() === 'Rascunho';

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

const calcValorTotalPedido = (pedido: any, linhas: any[]) => {
  const valorItens = round2(linhas.reduce((acc, it) => acc + (Number(it?.total) || 0), 0));
  const frete = Number(pedido?.valor_frete) || 0;
  const desconto = Number(pedido?.valor_desconto) || 0;
  return round2(valorItens + frete - desconto);
};

export async function handle(req: Request, base44: Awaited<ReturnType<typeof createP38Client>>): Promise<Response> {
  try {
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run !== false;
    const limit = Math.min(Number(body?.limit) || 200, 1000);
    const apenasRascunho = body?.apenas_rascunho === true;
    const incorporarDescontoLiquido = body?.incorporar_desconto_liquido === true;

    if (!incorporarDescontoLiquido) {
      return Response.json({
        success: true,
        dry_run: dryRun,
        message: 'SQL-only: use incorporar_desconto_liquido=true para normalizar PedidoCompraItem.',
        pendentes_processados: 0,
        updates: [],
      });
    }

    const pedidos = await base44.asServiceRole.entities.PedidoCompra.list();
    const pendentes = (pedidos || [])
      .filter((p: any) => (apenasRascunho ? isPedidoRascunho(p) : isPedidoNaoConcluido(p)))
      .slice(0, limit);

    const updates: Array<Record<string, unknown>> = [];
    let itensCanonicosAlterados = 0;

    for (const pedido of pendentes) {
      const linhas = await base44.asServiceRole.entities.PedidoCompraItem.filter({ pedido_compra_id: pedido.id });
      if (!Array.isArray(linhas) || !linhas.length) continue;

      let canonicosChanged = 0;
      const linhasNorm: Array<{ original: any; item: any }> = (linhas || []).map((linha: any) => {
        const norm = normalizeCanonicalLinhaDescontoLiquido(linha);
        if (norm.changed) canonicosChanged += 1;
        return { original: linha, item: norm.item };
      });

      if (canonicosChanged === 0) continue;

      const linhasAtualizadas = linhasNorm.map(({ item }) => item);
      const valorItens = round2(linhasAtualizadas.reduce((acc: number, it: any) => acc + (Number(it?.total) || 0), 0));
      const valorTotal = calcValorTotalPedido(pedido, linhasAtualizadas);

      if (dryRun) {
        updates.push({
          id: pedido.id,
          numero: pedido.numero,
          itens_count: linhasAtualizadas.length,
          itens_canonicos_alterados: canonicosChanged,
          valor_itens: valorItens,
          valor_total: valorTotal,
        });
        itensCanonicosAlterados += canonicosChanged;
        continue;
      }

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

      await base44.asServiceRole.entities.PedidoCompra.update(pedido.id, {
        valor_itens: valorItens,
        valor_total: valorTotal,
      });

      updates.push({
        id: pedido.id,
        numero: pedido.numero,
        itens_count: linhasAtualizadas.length,
        itens_canonicos_alterados: canonicosChanged,
        valor_itens: valorItens,
        valor_total: valorTotal,
      });
      itensCanonicosAlterados += canonicosChanged;
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      apenas_rascunho: apenasRascunho,
      incorporar_desconto_liquido: incorporarDescontoLiquido,
      total_lidos: pedidos?.length || 0,
      pendentes_processados: updates.length,
      itens_canonicos_alterados: itensCanonicosAlterados,
      updates,
    });
  } catch (error) {
    console.error('normalizarPedidosCompraPendentes error:', error);
    return Response.json({ error: (error as Error)?.message || 'Erro inesperado' }, { status: 500 });
  }
}
