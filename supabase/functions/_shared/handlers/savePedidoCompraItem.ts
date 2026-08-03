// Port automático de base44/functions/savePedidoCompraItem/entry.ts
import type { createP38Client } from '../p38Client.ts';

/* ============================================================================
 * savePedidoCompraItem
 *
 * Servico canonico de mutacao de itens de pedido de compra. Recebe a acao
 * (create/update/delete/replaceAll) e:
 *   1. Resolve a unidade canonica via `produto_unidade_id` no Produto.unidades[]
 *   2. Deriva campos canonicos (quantidade_base, custo_total, total)
 *   3. Persiste em PedidoCompraItem
 *   4. Recompoe o espelho `PedidoCompra.itens[]`
 *   5. Recalcula `PedidoCompra.valor_total`
 *
 * Sem regex, sem heuristica — o id da unidade e a unica fonte de verdade.
 * ============================================================================ */

const round6 = (n: any) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;
const asNumber = (value: any, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const SIGLA_NORMALIZE_MAP: Record<string, string> = {
  CAIXA: 'CX', CAIXAS: 'CX',
  'M²': 'M2', 'METRO QUADRADO': 'M2', 'METROS QUADRADOS': 'M2',
  PEÇA: 'PC', PEÇAS: 'PC', PECA: 'PC', PECAS: 'PC',
  UNIDADE: 'UN', UNIDADES: 'UN',
};

const normalizeSigla = (raw: any): string => {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return '';
  const noAccents = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (SIGLA_NORMALIZE_MAP[s]) return SIGLA_NORMALIZE_MAP[s];
  if (SIGLA_NORMALIZE_MAP[noAccents]) return SIGLA_NORMALIZE_MAP[noAccents];
  return s.replace('²', '2');
};

interface UnidadeCanonical {
  id: string;
  nome?: string;
  sigla: string;
  fator_conversao: number;
  fator_preco: number;
  is_principal?: boolean;
  is_comercial?: boolean;
  ativo?: boolean;
}

const buildPrincipalFromLegacy = (produto: any): UnidadeCanonical => ({
  id: 'principal',
  nome: 'Unidade base',
  sigla: normalizeSigla(produto?.unidade_principal || 'UN') || 'UN',
  fator_conversao: 1,
  fator_preco: 1,
  is_principal: true,
  is_comercial: false,
  ativo: true,
});

const buildAlternativaFromLegacy = (a: any): UnidadeCanonical => ({
  id: a?.id || '',
  nome: a?.nome || a?.rotulo || '',
  sigla: normalizeSigla(a?.unidade),
  fator_conversao: asNumber(a?.fator_conversao, 1) || 1,
  fator_preco: asNumber(a?.fator_preco, 1) || 1,
  is_principal: false,
  is_comercial: false,
  ativo: a?.ativo !== false,
});

const getUnidadesCanonical = (produto: any): UnidadeCanonical[] => {
  if (Array.isArray(produto?.unidades) && produto.unidades.length > 0) {
    return produto.unidades as UnidadeCanonical[];
  }
  const principal = buildPrincipalFromLegacy(produto);
  const alternativas = (Array.isArray(produto?.unidades_alternativas) ? produto.unidades_alternativas : [])
    .filter((a: any) => a?.unidade)
    .map(buildAlternativaFromLegacy);
  return [principal, ...alternativas];
};

const resolveUnidadeForItem = (produto: any, input: any) => {
  const unidades = getUnidadesCanonical(produto);
  if (input?.produto_unidade_id) {
    const byId = unidades.find(u => u.id === input.produto_unidade_id);
    if (byId) return { unidade: byId, source: 'produto_unidade_id', found: true };
  }
  const sigla = normalizeSigla(input?.unidade_sigla || input?.unidade_medida);
  if (sigla) {
    const bySigla = unidades.find(u => normalizeSigla(u.sigla) === sigla);
    if (bySigla) return { unidade: bySigla, source: 'sigla_match', found: true };
  }
  const comercial = unidades.find(u => u.is_comercial && u.ativo !== false) || unidades.find(u => u.is_principal) || unidades[0];
  return { unidade: comercial, source: 'comercial_default', found: false };
};

/** Persistência: valor de compra na BD é líquido (bruto − desconto). */
const normalizePedidoCompraItemCustoLiquidoParaPersist = (item: any) => {
  const frete = asNumber(item?.frete_unitario_fator1 ?? item?.custo_frete_unitario, 0);
  const outros = asNumber(item?.outros_unitario_fator1 ?? item?.custo_outros_unitario, 0);
  const custoBruto = asNumber(item?.custo_unitario_fator1 ?? item?.custo_unitario, 0);
  const desconto = asNumber(
    item?.desconto_unitario_fator1 ?? item?.valor_desconto_item ?? item?.desconto_unitario,
    0,
  );
  const custoLiquidoF1 = round6(custoBruto - desconto);
  const fator = asNumber(item?.fator_aplicado ?? item?.fator_conversao, 1) || 1;
  const custoTotalUnit = round6(custoLiquidoF1 + frete + outros);
  const qb = asNumber(item?.quantidade_base, NaN);
  const qty = asNumber(item?.quantidade ?? item?.quantidade_comercial, 0);
  const qBase = Number.isFinite(qb) && qb > 0 ? qb : qty * fator;
  const totalExplicito = asNumber(item?.total ?? item?.valor_total_item ?? item?.subtotal, 0);
  const total = totalExplicito > 0 ? round6(totalExplicito) : round6(qBase * custoTotalUnit);

  return {
    ...item,
    custo_unitario_fator1: custoLiquidoF1,
    custo_unitario_comercial: round6(custoLiquidoF1 * fator),
    desconto_unitario_fator1: 0,
    custo_total_unitario_fator1: custoTotalUnit,
    total,
  };
};

const derivePedidoCompraItem = (pedido: any, produto: any, input: any) => {
  const errors: string[] = [];
  if (!produto?.id) errors.push('produto_id obrigatorio');
  if (!pedido?.id) errors.push('pedido_compra_id obrigatorio');

  const resolvido = resolveUnidadeForItem(produto, input);
  if (!resolvido.found && input?.produto_unidade_id) {
    errors.push(`produto_unidade_id ${input.produto_unidade_id} nao encontrado em Produto.unidades[]`);
  }

  const u = resolvido.unidade;
  const fator = asNumber(u?.fator_conversao, 1) || 1;
  const fatorPreco = asNumber(u?.fator_preco, 1) || 1;

  const qComercial = asNumber(input?.quantidade_comercial ?? input?.quantidade, 0);
  if (qComercial <= 0) errors.push('quantidade_comercial deve ser > 0');
  const qBase = round6(qComercial * fator);

  const custoFator1 = asNumber(input?.custo_unitario_fator1 ?? input?.custo_unitario, 0);
  if (custoFator1 < 0) errors.push('custo_unitario_fator1 nao pode ser negativo');

  const frete = asNumber(input?.frete_unitario_fator1 ?? input?.custo_frete_unitario, 0);
  const outros = asNumber(input?.outros_unitario_fator1 ?? input?.custo_outros_unitario, 0);
  let desconto = asNumber(
    input?.valor_desconto_item ?? input?.desconto_unitario_fator1 ?? input?.desconto_unitario,
    0,
  );

  let custoTotalUnit = round6(custoFator1 + frete + outros - desconto);
  const totalCalculado = round6(qBase * custoTotalUnit);
  const totalExplicito = asNumber(input?.total ?? input?.valor_total_item ?? input?.subtotal, 0);
  let total = totalCalculado;
  if (totalExplicito > 0) {
    total = round6(totalExplicito);
    if (qBase > 0) {
      custoTotalUnit = round6(total / qBase);
      desconto = round6(custoFator1 + frete + outros - custoTotalUnit);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    item: normalizePedidoCompraItemCustoLiquidoParaPersist({
      pedido_compra_id: pedido?.id || '',
      pedido_compra_numero: pedido?.numero || '',
      produto_id: produto?.id || '',
      produto_nome: produto?.nome || '',
      produto_unidade_id: u?.id || '',
      unidade_sigla: normalizeSigla(u?.sigla) || 'UN',
      fator_aplicado: fator,
      fator_preco_aplicado: fatorPreco,
      quantidade_comercial: round6(qComercial),
      quantidade_base: qBase,
      custo_unitario_fator1: round6(custoFator1),
      custo_unitario_comercial: round6(custoFator1 * fator),
      frete_unitario_fator1: round6(frete),
      outros_unitario_fator1: round6(outros),
      desconto_unitario_fator1: round6(desconto),
      custo_total_unitario_fator1: custoTotalUnit,
      total,
      quantidade_vinculada: asNumber(input?.quantidade_vinculada, 0),
      ordem: asNumber(input?.ordem, 0),
      observacoes: typeof input?.observacoes === 'string' ? input.observacoes : '',
      status_recebimento: input?.status_recebimento || 'Pendente',
    }),
  };
};

const itemToLegacyMirror = (item: any) => {
  const fator = asNumber(item?.fator_aplicado, 1) || 1;
  return {
    produto_id: item?.produto_id || '',
    produto_nome: item?.produto_nome || '',
    produto_unidade_id: item?.produto_unidade_id || '',
    quantidade: asNumber(item?.quantidade_comercial, 0),
    unidade_medida: item?.unidade_sigla || 'UN',
    fator_conversao: fator,
    quantidade_base: asNumber(item?.quantidade_base, 0),
    quantidade_vinculada: asNumber(item?.quantidade_vinculada, 0),
    custo_unitario: asNumber(item?.custo_unitario_fator1, 0),
    custo_final_unitario: asNumber(item?.custo_total_unitario_fator1, 0),
    custo_unitario_base: asNumber(item?.custo_unitario_fator1, 0),
    custo_final_unitario_base: asNumber(item?.custo_total_unitario_fator1, 0),
    custo_unitario_apresentacao: asNumber(item?.custo_unitario_comercial, 0),
    custo_final_unitario_apresentacao: round6(asNumber(item?.custo_total_unitario_fator1, 0) * fator),
    custo_frete_unitario: asNumber(item?.frete_unitario_fator1, 0),
    custo_outros_unitario: asNumber(item?.outros_unitario_fator1, 0),
    desconto_unitario: asNumber(item?.desconto_unitario_fator1, 0),
    valor_desconto_item: asNumber(item?.desconto_unitario_fator1, 0),
    total: asNumber(item?.total, 0),
    preco_eixo: 'FATOR_1',
    unidade_apresentacao: item?.unidade_sigla || 'UN',
    pedido_compra_item_id: item?.id || undefined,
  };
};

/** Recompoe `PedidoCompra.itens[]` (espelho) e totais a partir das linhas canonicas. */
const recomporPedido = async (base44: any, pedidoId: string) => {
  const pedido = await fetchPedido(base44, pedidoId);
  const linhas = await base44.asServiceRole.entities.PedidoCompraItem.filter({ pedido_compra_id: pedidoId });
  const ordenadas = (linhas || []).slice().sort((a: any, b: any) => asNumber(a.ordem, 0) - asNumber(b.ordem, 0));
  const itensEspelho = ordenadas.map(itemToLegacyMirror);
  const valorItens = round6(itensEspelho.reduce((acc: number, it: any) => acc + asNumber(it.total, 0), 0));
  const frete = asNumber(pedido?.valor_frete, 0);
  const desconto = asNumber(pedido?.valor_desconto, 0);
  const valorTotal = round6(valorItens + frete - desconto);
  await base44.asServiceRole.entities.PedidoCompra.update(pedidoId, {
    itens: itensEspelho,
    valor_itens: valorItens,
    valor_total: valorTotal,
  });
  return { itens_count: itensEspelho.length, valor_itens: valorItens, valor_total: valorTotal };
};

const fetchProduto = async (base44: any, produtoId: string) => {
  const list = await base44.asServiceRole.entities.Produto.filter({ id: produtoId }, null, 1);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
};

const fetchPedido = async (base44: any, pedidoId: string) => {
  const list = await base44.asServiceRole.entities.PedidoCompra.filter({ id: pedidoId }, null, 1);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
};

export async function handle(req: Request, base44: Awaited<ReturnType<typeof createP38Client>>): Promise<Response> {
  try {
    // base44 injetado por servePorted
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (!action) return Response.json({ error: 'action obrigatoria' }, { status: 400 });

    /* ----- DELETE ----- */
    if (action === 'delete') {
      const id = String(body?.id || '').trim();
      if (!id) return Response.json({ error: 'id obrigatorio' }, { status: 400 });
      const linhas = await base44.asServiceRole.entities.PedidoCompraItem.filter({ id }, null, 1);
      if (!linhas || linhas.length === 0) return Response.json({ error: 'item nao encontrado' }, { status: 404 });
      const pedidoId = linhas[0].pedido_compra_id;
      await base44.asServiceRole.entities.PedidoCompraItem.delete(id);
      const recomp = pedidoId ? await recomporPedido(base44, pedidoId) : null;
      return Response.json({ success: true, recomposto: recomp });
    }

    /* ----- CREATE / UPDATE ----- */
    if (action === 'create' || action === 'update') {
      const input = body?.input || {};
      const pedidoId = String(input?.pedido_compra_id || body?.pedido_compra_id || '').trim();
      const produtoId = String(input?.produto_id || '').trim();
      if (!pedidoId) return Response.json({ error: 'pedido_compra_id obrigatorio' }, { status: 400 });
      if (!produtoId) return Response.json({ error: 'produto_id obrigatorio' }, { status: 400 });

      const [pedido, produto] = await Promise.all([
        fetchPedido(base44, pedidoId),
        fetchProduto(base44, produtoId),
      ]);
      if (!pedido) return Response.json({ error: 'PedidoCompra nao encontrado' }, { status: 404 });
      if (!produto) return Response.json({ error: 'Produto nao encontrado' }, { status: 404 });

      const derivation = derivePedidoCompraItem(pedido, produto, input);
      if (!derivation.valid) {
        return Response.json({ error: 'Validacao falhou', details: derivation.errors }, { status: 422 });
      }

      let saved: any = null;
      if (action === 'create') {
        saved = await base44.asServiceRole.entities.PedidoCompraItem.create(derivation.item);
      } else {
        const id = String(input?.id || body?.id || '').trim();
        if (!id) return Response.json({ error: 'id obrigatorio para update' }, { status: 400 });
        await base44.asServiceRole.entities.PedidoCompraItem.update(id, derivation.item);
        saved = { id, ...derivation.item };
      }
      const recomp = await recomporPedido(base44, pedidoId);
      return Response.json({ success: true, item: saved, recomposto: recomp });
    }

    /* ----- REPLACE ALL: substitui todas as linhas do pedido (usado pelo form) ----- */
    if (action === 'replaceAll') {
      const pedidoId = String(body?.pedido_compra_id || '').trim();
      if (!pedidoId) return Response.json({ error: 'pedido_compra_id obrigatorio' }, { status: 400 });
      const inputs = Array.isArray(body?.items) ? body.items : [];

      const pedido = await fetchPedido(base44, pedidoId);
      if (!pedido) return Response.json({ error: 'PedidoCompra nao encontrado' }, { status: 404 });

      // Carrega produtos referenciados em batch.
      const produtoIds = Array.from(new Set(inputs.map((it: any) => String(it?.produto_id || '')).filter(Boolean)));
      const produtosMap: Record<string, any> = {};
      for (const pid of produtoIds) {
        const p = await fetchProduto(base44, pid);
        if (p) produtosMap[pid] = p;
      }

      // Deriva e valida cada linha.
      const linhasDerivadas: any[] = [];
      const erros: any[] = [];
      inputs.forEach((input: any, idx: number) => {
        const produto = produtosMap[String(input?.produto_id)];
        if (!produto) {
          erros.push({ index: idx, errors: [`produto_id ${input?.produto_id} nao encontrado`] });
          return;
        }
        const d = derivePedidoCompraItem(pedido, produto, { ...input, ordem: input?.ordem ?? idx });
        if (!d.valid) {
          erros.push({ index: idx, errors: d.errors });
          return;
        }
        linhasDerivadas.push({ ...d.item, _input_id: input?.id || null });
      });

      if (erros.length > 0) {
        return Response.json({ error: 'Validacao falhou', details: erros }, { status: 422 });
      }

      // Apaga todas as linhas atuais e recria — abordagem simples e robusta.
      const linhasAtuais = await base44.asServiceRole.entities.PedidoCompraItem.filter({ pedido_compra_id: pedidoId });
      for (const linha of (linhasAtuais || [])) {
        try {
          await base44.asServiceRole.entities.PedidoCompraItem.delete(linha.id);
        } catch (e) {
          console.warn('falha ao apagar linha legada:', linha.id, (e as Error).message);
        }
      }

      const criadas: any[] = [];
      for (const item of linhasDerivadas) {
        const { _input_id, ...payload } = item;
        const novo = await base44.asServiceRole.entities.PedidoCompraItem.create(payload);
        criadas.push(novo);
      }

      const recomp = await recomporPedido(base44, pedidoId);
      return Response.json({ success: true, items: criadas, recomposto: recomp });
    }

    return Response.json({ error: `acao desconhecida: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('savePedidoCompraItem erro:', error);
    return Response.json({ error: (error as Error).message || String(error) }, { status: 500 });
  }
}
