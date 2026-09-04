import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/* ============================================================================
 * saveConferenciaItem
 *
 * Servico canonico para mutacao de itens de conferencia de estoque.
 * Mesmo padrao dos demais saveXxxItem.
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

const resolveUnidade = (produto: any, input: any) => {
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

const deriveConferenciaItem = (conferencia: any, produto: any, input: any) => {
  const errors: string[] = [];
  if (!conferencia?.id) errors.push('conferencia_id obrigatorio');
  if (!produto?.id) errors.push('produto_id obrigatorio');

  const resolvido = resolveUnidade(produto, input);
  if (!resolvido.found && input?.produto_unidade_id) {
    errors.push(`produto_unidade_id ${input.produto_unidade_id} nao encontrado em Produto.unidades[]`);
  }
  const u = resolvido.unidade;
  const fator = asNumber(u?.fator_conversao, 1) || 1;

  const qContadaComercial = asNumber(input?.quantidade_contada_comercial ?? input?.quantidade_contada, 0);
  if (qContadaComercial < 0) errors.push('quantidade_contada nao pode ser negativa');
  const qContadaBase = round6(qContadaComercial * fator);
  const qSistemaBase = asNumber(input?.quantidade_sistema_base ?? produto?.estoque_atual, 0);
  const divergencia = round6(qContadaBase - qSistemaBase);
  let sinal = 'zero';
  if (divergencia > 1e-6) sinal = 'positivo';
  else if (divergencia < -1e-6) sinal = 'negativo';

  return {
    valid: errors.length === 0,
    errors,
    item: {
      conferencia_id: conferencia?.id || '',
      conferencia_nome: conferencia?.nome_conferencia || '',
      produto_id: produto?.id || '',
      produto_nome: produto?.nome || input?.produto_nome || '',
      produto_unidade_id: u?.id || '',
      unidade_sigla: normalizeSigla(u?.sigla) || 'UN',
      fator_aplicado: fator,
      quantidade_sistema_base: round6(qSistemaBase),
      quantidade_contada_comercial: round6(qContadaComercial),
      quantidade_contada_base: qContadaBase,
      divergencia_base: divergencia,
      divergencia_sinal: sinal,
      ordem: asNumber(input?.ordem, 0),
      observacoes: typeof input?.observacoes === 'string' ? input.observacoes : '',
    },
  };
};

const itemToLegacyMirror = (item: any) => ({
  produto_id: item?.produto_id || '',
  produto_nome: item?.produto_nome || '',
  quantidade_contada: asNumber(item?.quantidade_contada_base, 0),
  conferencia_item_id: item?.id || undefined,
});

const fetchProduto = async (base44: any, id: string) => {
  const list = await base44.asServiceRole.entities.Produto.filter({ id }, null, 1);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
};

const fetchConferencia = async (base44: any, id: string) => {
  const list = await base44.asServiceRole.entities.ConferenciaEstoque.filter({ id }, null, 1);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    if (!action) return Response.json({ error: 'action obrigatoria' }, { status: 400 });

    if (action === 'delete') {
      const id = String(body?.id || '').trim();
      if (!id) return Response.json({ error: 'id obrigatorio' }, { status: 400 });
      const linhas = await base44.asServiceRole.entities.ConferenciaItem.filter({ id }, null, 1);
      if (!linhas || linhas.length === 0) return Response.json({ error: 'item nao encontrado' }, { status: 404 });
      const conferenciaId = linhas[0].conferencia_id;
      await base44.asServiceRole.entities.ConferenciaItem.delete(id);
      return Response.json({ success: true });
    }

    if (action === 'create' || action === 'update') {
      const input = body?.input || {};
      const conferenciaId = String(input?.conferencia_id || body?.conferencia_id || '').trim();
      const produtoId = String(input?.produto_id || '').trim();
      if (!conferenciaId) return Response.json({ error: 'conferencia_id obrigatorio' }, { status: 400 });
      if (!produtoId) return Response.json({ error: 'produto_id obrigatorio' }, { status: 400 });

      const [conferencia, produto] = await Promise.all([
        fetchConferencia(base44, conferenciaId),
        fetchProduto(base44, produtoId),
      ]);
      if (!conferencia) return Response.json({ error: 'ConferenciaEstoque nao encontrada' }, { status: 404 });
      if (!produto) return Response.json({ error: 'Produto nao encontrado' }, { status: 404 });

      const derivation = deriveConferenciaItem(conferencia, produto, input);
      if (!derivation.valid) return Response.json({ error: 'Validacao falhou', details: derivation.errors }, { status: 422 });

      let saved: any = null;
      if (action === 'create') {
        saved = await base44.asServiceRole.entities.ConferenciaItem.create(derivation.item);
      } else {
        const id = String(input?.id || body?.id || '').trim();
        if (!id) return Response.json({ error: 'id obrigatorio para update' }, { status: 400 });
        await base44.asServiceRole.entities.ConferenciaItem.update(id, derivation.item);
        saved = { id, ...derivation.item };
      }
      return Response.json({ success: true, item: saved });
    }

    if (action === 'replaceAll') {
      const conferenciaId = String(body?.conferencia_id || '').trim();
      if (!conferenciaId) return Response.json({ error: 'conferencia_id obrigatorio' }, { status: 400 });
      const inputs = Array.isArray(body?.items) ? body.items : [];

      const conferencia = await fetchConferencia(base44, conferenciaId);
      if (!conferencia) return Response.json({ error: 'ConferenciaEstoque nao encontrada' }, { status: 404 });

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
        const d = deriveConferenciaItem(conferencia, produto, { ...input, ordem: input?.ordem ?? idx });
        if (!d.valid) { erros.push({ index: idx, errors: d.errors }); return; }
        linhasDerivadas.push(d.item);
      });

      if (erros.length > 0) return Response.json({ error: 'Validacao falhou', details: erros }, { status: 422 });

      const linhasAtuais = await base44.asServiceRole.entities.ConferenciaItem.filter({ conferencia_id: conferenciaId });
      for (const linha of (linhasAtuais || [])) {
        try {
          await base44.asServiceRole.entities.ConferenciaItem.delete(linha.id);
        } catch (e) {
          console.warn('falha ao apagar linha legada:', linha.id, (e as Error).message);
        }
      }

      const criadas: any[] = [];
      for (const item of linhasDerivadas) {
        const novo = await base44.asServiceRole.entities.ConferenciaItem.create(item);
        criadas.push(novo);
      }

      return Response.json({ success: true, items: criadas, itens_count: criadas.length });
    }

    return Response.json({ error: `acao desconhecida: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('saveConferenciaItem erro:', error);
    return Response.json({ error: (error as Error).message || String(error) }, { status: 500 });
  }
});
