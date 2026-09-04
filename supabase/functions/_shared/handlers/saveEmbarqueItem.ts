// Port automático de base44/functions/saveEmbarqueItem/entry.ts
import type { createP38Client } from '../p38Client.ts';

/* ============================================================================
 * saveEmbarqueItem
 *
 * Servico canonico para mutacao de itens de embarque. Mesmo padrao de
 * savePedidoCompraItem, mas com 3 quantidades (pedida/embarcada/recebida) e
 * sem preco. A linha pode referenciar `pedido_compra_item_id` para rastreio.
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

const resolveUnidadeForEmbarque = (produto: any, input: any) => {
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

const deriveEmbarqueItem = (embarque: any, produto: any, pedidoCompraItem: any, input: any) => {
  const errors: string[] = [];
  if (!embarque?.id) errors.push('embarque_id obrigatorio');
  if (!produto?.id) errors.push('produto_id obrigatorio');

  const resolvido = resolveUnidadeForEmbarque(produto, input);
  if (!resolvido.found && input?.produto_unidade_id) {
    errors.push(`produto_unidade_id ${input.produto_unidade_id} nao encontrado em Produto.unidades[]`);
  }
  const u = resolvido.unidade;
  const fatorInput = asNumber(input?.fator_aplicado ?? input?.fator_apresentacao, 0);
  const fatorUnidade = asNumber(u?.fator_conversao, 1) || 1;
  const siglaInput = normalizeSigla(input?.unidade_sigla || input?.unidade_medida || input?.unidade_apresentacao);
  const siglaUnidade = normalizeSigla(u?.sigla);
  const fator =
    fatorInput > 0 && siglaInput && (siglaInput === siglaUnidade || !resolvido.found)
      ? fatorInput
      : fatorUnidade;

  const qPedida = asNumber(input?.quantidade_pedida_comercial ?? input?.quantidade_pedida, 0);
  const qEmbarcada = asNumber(input?.quantidade_embarcada_comercial ?? input?.quantidade_embarcada, 0);
  const qRecebida = asNumber(input?.quantidade_recebida_comercial ?? input?.quantidade_recebida, 0);
  if (qEmbarcada <= 0) errors.push('quantidade_embarcada_comercial deve ser > 0');

  return {
    valid: errors.length === 0,
    errors,
    item: {
      embarque_id: embarque?.id || '',
      embarque_numero: embarque?.numero || '',
      pedido_compra_id: embarque?.pedido_compra_id || pedidoCompraItem?.pedido_compra_id || '',
      pedido_compra_item_id: pedidoCompraItem?.id || input?.pedido_compra_item_id || '',
      produto_id: produto?.id || '',
      produto_nome: produto?.nome || input?.produto_nome || '',
      produto_unidade_id: u?.id || '',
      unidade_sigla: normalizeSigla(u?.sigla) || 'UN',
      fator_aplicado: fator,
      quantidade_pedida_comercial: round6(qPedida),
      quantidade_pedida_base: round6(qPedida * fator),
      quantidade_embarcada_comercial: round6(qEmbarcada),
      quantidade_embarcada_base: round6(qEmbarcada * fator),
      quantidade_recebida_comercial: round6(qRecebida),
      quantidade_recebida_base: round6(qRecebida * fator),
      divergencia_tipo: input?.divergencia_tipo || 'Nenhuma',
      produto_id_recebido_diferente: typeof input?.produto_id_recebido_diferente === 'string' ? input.produto_id_recebido_diferente : '',
      produto_nome_recebido_diferente: typeof input?.produto_nome_recebido_diferente === 'string' ? input.produto_nome_recebido_diferente : '',
      acordo_financeiro_lancamento_id: typeof input?.acordo_financeiro_lancamento_id === 'string' ? input.acordo_financeiro_lancamento_id : '',
      ordem: asNumber(input?.ordem, 0),
      observacoes: typeof input?.observacoes === 'string' ? input.observacoes : '',
    },
  };
};

const itemToLegacyMirror = (item: any) => ({
  produto_id: item?.produto_id || '',
  produto_nome: item?.produto_nome || '',
  produto_unidade_id: item?.produto_unidade_id || '',
  pedido_compra_item_id: item?.pedido_compra_item_id || '',
  fator_aplicado: asNumber(item?.fator_aplicado, 1) || 1,
  fator_apresentacao: asNumber(item?.fator_aplicado, 1) || 1,
  fator_conversao: asNumber(item?.fator_aplicado, 1) || 1,
  quantidade_pedida: asNumber(item?.quantidade_pedida_comercial, 0),
  quantidade_embarcada: asNumber(item?.quantidade_embarcada_comercial, 0),
  quantidade_recebida: asNumber(item?.quantidade_recebida_comercial, 0),
  quantidade_pedida_base: asNumber(item?.quantidade_pedida_base, 0) || undefined,
  quantidade_embarcada_base: asNumber(item?.quantidade_embarcada_base, 0) || undefined,
  quantidade_recebida_base: asNumber(item?.quantidade_recebida_base, 0) || undefined,
  quantidade_pedida_apresentacao: asNumber(item?.quantidade_pedida_comercial, 0),
  quantidade_embarcada_apresentacao: asNumber(item?.quantidade_embarcada_comercial, 0),
  quantidade_recebida_apresentacao: asNumber(item?.quantidade_recebida_comercial, 0),
  unidade_medida: item?.unidade_sigla || 'UN',
  unidade_apresentacao: item?.unidade_sigla || 'UN',
  unidade_sigla: item?.unidade_sigla || 'UN',
  divergencia_tipo: item?.divergencia_tipo || 'Nenhuma',
  produto_id_recebido_diferente: item?.produto_id_recebido_diferente || '',
  produto_nome_recebido_diferente: item?.produto_nome_recebido_diferente || '',
  acordo_financeiro_lancamento_id: item?.acordo_financeiro_lancamento_id || '',
  embarque_item_id: item?.id || undefined,
});

/** Conta linhas SQL — espelho JSON `itens` / `itens_embarcados` deixou de ser gravado. */
const recomporEmbarque = async (base44: any, embarqueId: string) => {
  const linhas = await base44.asServiceRole.entities.EmbarqueItem.filter({ embarque_id: embarqueId });
  const count = Array.isArray(linhas) ? linhas.length : 0;
  return { itens_count: count, espelho_json: false };
};

const fetchProduto = async (base44: any, id: string) => {
  const list = await base44.asServiceRole.entities.Produto.filter({ id }, null, 1);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
};

const fetchEmbarque = async (base44: any, id: string) => {
  const list = await base44.asServiceRole.entities.Embarque.filter({ id }, null, 1);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
};

const fetchPedidoCompraItem = async (base44: any, id: string) => {
  if (!id) return null;
  const list = await base44.asServiceRole.entities.PedidoCompraItem.filter({ id }, null, 1);
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
      const linhas = await base44.asServiceRole.entities.EmbarqueItem.filter({ id }, null, 1);
      if (!linhas || linhas.length === 0) return Response.json({ error: 'item nao encontrado' }, { status: 404 });
      const embarqueId = linhas[0].embarque_id;
      await base44.asServiceRole.entities.EmbarqueItem.delete(id);
      const recomp = embarqueId ? await recomporEmbarque(base44, embarqueId) : null;
      return Response.json({ success: true, recomposto: recomp });
    }

    if (action === 'create' || action === 'update') {
      const input = body?.input || {};
      const embarqueId = String(input?.embarque_id || body?.embarque_id || '').trim();
      const produtoId = String(input?.produto_id || '').trim();
      if (!embarqueId) return Response.json({ error: 'embarque_id obrigatorio' }, { status: 400 });
      if (!produtoId) return Response.json({ error: 'produto_id obrigatorio' }, { status: 400 });

      const [embarque, produto, pedidoItem] = await Promise.all([
        fetchEmbarque(base44, embarqueId),
        fetchProduto(base44, produtoId),
        fetchPedidoCompraItem(base44, String(input?.pedido_compra_item_id || '')),
      ]);
      if (!embarque) return Response.json({ error: 'Embarque nao encontrado' }, { status: 404 });
      if (!produto) return Response.json({ error: 'Produto nao encontrado' }, { status: 404 });

      const derivation = deriveEmbarqueItem(embarque, produto, pedidoItem, input);
      if (!derivation.valid) return Response.json({ error: 'Validacao falhou', details: derivation.errors }, { status: 422 });

      let saved: any = null;
      if (action === 'create') {
        saved = await base44.asServiceRole.entities.EmbarqueItem.create(derivation.item);
      } else {
        const id = String(input?.id || body?.id || '').trim();
        if (!id) return Response.json({ error: 'id obrigatorio para update' }, { status: 400 });
        await base44.asServiceRole.entities.EmbarqueItem.update(id, derivation.item);
        saved = { id, ...derivation.item };
      }
      const recomp = await recomporEmbarque(base44, embarqueId);
      return Response.json({ success: true, item: saved, recomposto: recomp });
    }

    if (action === 'replaceAll') {
      const embarqueId = String(body?.embarque_id || '').trim();
      if (!embarqueId) return Response.json({ error: 'embarque_id obrigatorio' }, { status: 400 });
      const inputs = Array.isArray(body?.items) ? body.items : [];

      const embarque = await fetchEmbarque(base44, embarqueId);
      if (!embarque) return Response.json({ error: 'Embarque nao encontrado' }, { status: 404 });

      const produtoIds = Array.from(new Set(inputs.map((it: any) => String(it?.produto_id || '')).filter(Boolean)));
      const produtosMap: Record<string, any> = {};
      for (const pid of produtoIds) {
        const p = await fetchProduto(base44, pid);
        if (p) produtosMap[pid] = p;
      }

      const linhasDerivadas: any[] = [];
      const erros: any[] = [];
      for (let idx = 0; idx < inputs.length; idx++) {
        const input = inputs[idx];
        const produto = produtosMap[String(input?.produto_id)];
        if (!produto) {
          erros.push({ index: idx, errors: [`produto_id ${input?.produto_id} nao encontrado`] });
          continue;
        }
        const pedidoItem = input?.pedido_compra_item_id ? await fetchPedidoCompraItem(base44, String(input.pedido_compra_item_id)) : null;
        const d = deriveEmbarqueItem(embarque, produto, pedidoItem, { ...input, ordem: input?.ordem ?? idx });
        if (!d.valid) { erros.push({ index: idx, errors: d.errors }); continue; }
        linhasDerivadas.push(d.item);
      }

      if (erros.length > 0) return Response.json({ error: 'Validacao falhou', details: erros }, { status: 422 });

      const linhasAtuais = await base44.asServiceRole.entities.EmbarqueItem.filter({ embarque_id: embarqueId });
      for (const linha of (linhasAtuais || [])) {
        try {
          await base44.asServiceRole.entities.EmbarqueItem.delete(linha.id);
        } catch (e) {
          console.warn('falha ao apagar linha legada:', linha.id, (e as Error).message);
        }
      }

      const criadas: any[] = [];
      for (const item of linhasDerivadas) {
        const novo = await base44.asServiceRole.entities.EmbarqueItem.create(item);
        criadas.push(novo);
      }

      const recomp = await recomporEmbarque(base44, embarqueId);
      return Response.json({ success: true, items: criadas, recomposto: recomp });
    }

    return Response.json({ error: `acao desconhecida: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('saveEmbarqueItem erro:', error);
    return Response.json({ error: (error as Error).message || String(error) }, { status: 500 });
  }
}
