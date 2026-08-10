// Port automático de base44/functions/savePedidoVendaItem/entry.ts
import type { createP38Client } from '../p38Client.ts';

/* ============================================================================
 * savePedidoVendaItem
 *
 * Servico canonico de mutacao de itens de pedido de venda. Mesmo padrao do
 * savePedidoCompraItem mas com eixo de preco de venda (preco_unitario_fator1).
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
  sigla: string;
  fator_conversao: number;
  fator_preco: number;
  is_principal?: boolean;
  is_comercial?: boolean;
  ativo?: boolean;
}

const getUnidadesProduto = (produto: any): UnidadeCanonical[] => {
  if (Array.isArray(produto?.unidades) && produto.unidades.length > 0) {
    return produto.unidades as UnidadeCanonical[];
  }
  const principal: UnidadeCanonical = {
    id: 'principal',
    sigla: normalizeSigla(produto?.unidade_principal || 'UN') || 'UN',
    fator_conversao: 1,
    fator_preco: 1,
    is_principal: true,
    is_comercial: false,
    ativo: true,
  };
  const alternativas: UnidadeCanonical[] = (Array.isArray(produto?.unidades_alternativas) ? produto.unidades_alternativas : [])
    .filter((a: any) => a?.unidade)
    .map((a: any) => ({
      id: a?.id || `alt_${normalizeSigla(a?.unidade)}`,
      sigla: normalizeSigla(a?.unidade),
      fator_conversao: asNumber(a?.fator_conversao, 1) || 1,
      fator_preco: asNumber(a?.fator_preco, 1) || 1,
      is_principal: false,
      is_comercial: false,
      ativo: a?.ativo !== false,
    }));
  return [principal, ...alternativas];
};

const resolveUnidadeForVendaItem = (produto: any, input: any) => {
  const unidades = getUnidadesProduto(produto);
  if (input?.produto_unidade_id) {
    const byId = unidades.find(u => u.id === input.produto_unidade_id);
    if (byId) return { unidade: byId, found: true };
  }
  const sigla = normalizeSigla(input?.unidade_sigla || input?.unidade_medida);
  if (sigla) {
    const bySigla = unidades.find(u => normalizeSigla(u.sigla) === sigla);
    if (bySigla) return { unidade: bySigla, found: true };
  }
  const comercial = unidades.find(u => u.is_comercial && u.ativo !== false) || unidades.find(u => u.is_principal) || unidades[0];
  return { unidade: comercial, found: false };
};

const derivePedidoVendaItem = (pedido: any, produto: any, input: any) => {
  const errors: string[] = [];
  if (!produto?.id) errors.push('produto_id obrigatorio');
  if (!pedido?.id) errors.push('pedido_venda_id obrigatorio');

  const resolvido = resolveUnidadeForVendaItem(produto, input);
  if (!resolvido.found && input?.produto_unidade_id) {
    errors.push(`produto_unidade_id ${input.produto_unidade_id} nao encontrado em Produto.unidades[]`);
  }
  const u = resolvido.unidade;
  const fator = asNumber(u?.fator_conversao, 1) || 1;
  const fatorPreco = asNumber(u?.fator_preco, 1) || 1;

  const qComercial = asNumber(input?.quantidade_comercial ?? input?.quantidade, 0);
  if (qComercial <= 0) errors.push('quantidade_comercial deve ser > 0');
  const qBase = round6(qComercial * fator);

  const precoFator1 = asNumber(input?.preco_unitario_fator1 ?? input?.preco_unitario_praticado, 0);
  if (precoFator1 < 0) errors.push('preco_unitario_fator1 nao pode ser negativo');

  const desconto = asNumber(input?.desconto_unitario_fator1 ?? input?.desconto_unitario, 0);
  const precoFinal = round6(precoFator1 - desconto);
  const total = round6(qBase * precoFinal);

  return {
    valid: errors.length === 0,
    errors,
    item: {
      pedido_venda_id: pedido?.id || '',
      pedido_venda_numero: pedido?.numero || '',
      produto_id: produto?.id || '',
      produto_nome: produto?.nome || '',
      produto_unidade_id: u?.id || '',
      unidade_sigla: normalizeSigla(u?.sigla) || 'UN',
      fator_aplicado: fator,
      fator_preco_aplicado: fatorPreco,
      quantidade_comercial: round6(qComercial),
      quantidade_base: qBase,
      preco_unitario_fator1: round6(precoFator1),
      preco_unitario_comercial: round6(precoFator1 * fator),
      desconto_unitario_fator1: round6(desconto),
      preco_final_unitario_fator1: precoFinal,
      tabela_preco_id: typeof input?.tabela_preco_id === 'string' ? input.tabela_preco_id : '',
      tabela_preco_multiplicador: asNumber(input?.tabela_preco_multiplicador, 1) || 1,
      total,
      ordem: asNumber(input?.ordem, 0),
      observacoes: typeof input?.observacoes === 'string' ? input.observacoes : '',
    },
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
    preco_unitario_praticado: asNumber(item?.preco_unitario_fator1, 0),
    preco_unitario_apresentacao: asNumber(item?.preco_unitario_comercial, 0),
    desconto_unitario: asNumber(item?.desconto_unitario_fator1, 0),
    total: asNumber(item?.total, 0),
    preco_eixo: 'FATOR_1',
    unidade_apresentacao: item?.unidade_sigla || 'UN',
    pedido_venda_item_id: item?.id || undefined,
  };
};

const recomporPedido = async (base44: any, pedidoId: string) => {
  const linhas = await base44.asServiceRole.entities.PedidoVendaItem.filter({ pedido_venda_id: pedidoId });
  const ordenadas = (linhas || []).slice().sort((a: any, b: any) => asNumber(a.ordem, 0) - asNumber(b.ordem, 0));
  const subtotal = round6(ordenadas.reduce((acc: number, it: any) => acc + asNumber(it?.total, 0), 0));

  const pedidoAtual = await base44.asServiceRole.entities.PedidoVenda.filter({ id: pedidoId }, null, 1);
  const desconto = asNumber(pedidoAtual?.[0]?.valor_desconto, 0);
  const frete = asNumber(pedidoAtual?.[0]?.valor_frete, 0);
  const valorTotal = round6(subtotal - desconto + frete);

  await base44.asServiceRole.entities.PedidoVenda.update(pedidoId, {
    subtotal,
    valor_total: valorTotal,
  });
  return { itens_count: ordenadas.length, subtotal, valor_total: valorTotal, espelho_json: false };
};

const fetchProduto = async (base44: any, id: string) => {
  const list = await base44.asServiceRole.entities.Produto.filter({ id }, null, 1);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
};

const fetchPedido = async (base44: any, id: string) => {
  const list = await base44.asServiceRole.entities.PedidoVenda.filter({ id }, null, 1);
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

    if (action === 'delete') {
      const id = String(body?.id || '').trim();
      if (!id) return Response.json({ error: 'id obrigatorio' }, { status: 400 });
      const linhas = await base44.asServiceRole.entities.PedidoVendaItem.filter({ id }, null, 1);
      if (!linhas || linhas.length === 0) return Response.json({ error: 'item nao encontrado' }, { status: 404 });
      const pedidoId = linhas[0].pedido_venda_id;
      await base44.asServiceRole.entities.PedidoVendaItem.delete(id);
      const recomp = pedidoId ? await recomporPedido(base44, pedidoId) : null;
      return Response.json({ success: true, recomposto: recomp });
    }

    if (action === 'create' || action === 'update') {
      const input = body?.input || {};
      const pedidoId = String(input?.pedido_venda_id || body?.pedido_venda_id || '').trim();
      const produtoId = String(input?.produto_id || '').trim();
      if (!pedidoId) return Response.json({ error: 'pedido_venda_id obrigatorio' }, { status: 400 });
      if (!produtoId) return Response.json({ error: 'produto_id obrigatorio' }, { status: 400 });

      const [pedido, produto] = await Promise.all([fetchPedido(base44, pedidoId), fetchProduto(base44, produtoId)]);
      if (!pedido) return Response.json({ error: 'PedidoVenda nao encontrado' }, { status: 404 });
      if (!produto) return Response.json({ error: 'Produto nao encontrado' }, { status: 404 });

      const derivation = derivePedidoVendaItem(pedido, produto, input);
      if (!derivation.valid) return Response.json({ error: 'Validacao falhou', details: derivation.errors }, { status: 422 });

      let saved: any = null;
      if (action === 'create') {
        saved = await base44.asServiceRole.entities.PedidoVendaItem.create(derivation.item);
      } else {
        const id = String(input?.id || body?.id || '').trim();
        if (!id) return Response.json({ error: 'id obrigatorio para update' }, { status: 400 });
        await base44.asServiceRole.entities.PedidoVendaItem.update(id, derivation.item);
        saved = { id, ...derivation.item };
      }
      const recomp = await recomporPedido(base44, pedidoId);
      return Response.json({ success: true, item: saved, recomposto: recomp });
    }

    if (action === 'replaceAll') {
      const pedidoId = String(body?.pedido_venda_id || '').trim();
      if (!pedidoId) return Response.json({ error: 'pedido_venda_id obrigatorio' }, { status: 400 });
      const inputs = Array.isArray(body?.items) ? body.items : [];

      const pedido = await fetchPedido(base44, pedidoId);
      if (!pedido) return Response.json({ error: 'PedidoVenda nao encontrado' }, { status: 404 });

      const produtoIds = Array.from(new Set(inputs.map((it: any) => String(it?.produto_id || '')).filter(Boolean)));
      const produtosMap: Record<string, any> = {};
      for (const pid of produtoIds) {
        const p = await fetchProduto(base44, pid);
        if (p) produtosMap[pid] = p;
      }

      const linhasDerivadas: any[] = [];
      const erros: any[] = [];
      inputs.forEach((input: any, idx: number) => {
        const produto = produtosMap[String(input?.produto_id)];
        if (!produto) {
          erros.push({ index: idx, errors: [`produto_id ${input?.produto_id} nao encontrado`] });
          return;
        }
        const d = derivePedidoVendaItem(pedido, produto, { ...input, ordem: input?.ordem ?? idx });
        if (!d.valid) { erros.push({ index: idx, errors: d.errors }); return; }
        linhasDerivadas.push(d.item);
      });

      if (erros.length > 0) {
        return Response.json({ error: 'Validacao falhou', details: erros }, { status: 422 });
      }

      const linhasAtuais = await base44.asServiceRole.entities.PedidoVendaItem.filter({ pedido_venda_id: pedidoId });
      for (const linha of (linhasAtuais || [])) {
        try {
          await base44.asServiceRole.entities.PedidoVendaItem.delete(linha.id);
        } catch (e) {
          console.warn('falha ao apagar linha legada:', linha.id, (e as Error).message);
        }
      }

      const criadas: any[] = [];
      for (const item of linhasDerivadas) {
        const novo = await base44.asServiceRole.entities.PedidoVendaItem.create(item);
        criadas.push(novo);
      }

      const recomp = await recomporPedido(base44, pedidoId);
      return Response.json({ success: true, items: criadas, recomposto: recomp });
    }

    return Response.json({ error: `acao desconhecida: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('savePedidoVendaItem erro:', error);
    return Response.json({ error: (error as Error).message || String(error) }, { status: 500 });
  }
}
