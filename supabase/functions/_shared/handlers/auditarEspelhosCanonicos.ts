// Port automático de base44/functions/auditarEspelhosCanonicos/entry.ts
import type { createP38Client } from '../p38Client.ts';

/* ============================================================================
 * auditarEspelhosCanonicos
 *
 * Auditoria global. Detecta:
 *   - Produtos com `unidades[]` violando invariantes (mais de 1 is_principal,
 *     fator_conversao invalido, sigla duplicada, etc.)
 *   - PedidoCompra cujo `itens[]` (espelho) diverge do que esta em
 *     PedidoCompraItem (entidade canonica) — mesma logica para PedidoVenda,
 *     Embarque e ConferenciaEstoque.
 *
 * Retorna um relatorio agregado para inspecao humana antes de qualquer
 * decisao de regravar / corrigir.
 * ============================================================================ */

const round6 = (n: any) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;
const asNumber = (value: any, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const validateUnidades = (unidades: any[]): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!Array.isArray(unidades) || unidades.length === 0) {
    return { ok: false, errors: ['unidades vazio'] };
  }
  if (unidades.length > 5) errors.push(`max 5 unidades (atual: ${unidades.length})`);
  const ids = new Set<string>();
  const siglas = new Set<string>();
  let countPrincipal = 0;
  let countComercial = 0;
  let principalFator1 = false;
  for (const u of unidades) {
    if (!u?.id) errors.push('unidade sem id');
    else if (ids.has(u.id)) errors.push(`id duplicado: ${u.id}`);
    else ids.add(u.id);
    const sigla = String(u?.sigla || '').trim().toUpperCase();
    if (!sigla) errors.push('unidade sem sigla');
    else if (u?.ativo !== false) {
      if (siglas.has(sigla)) errors.push(`sigla duplicada: ${sigla}`);
      else siglas.add(sigla);
    }
    const fator = Number(u?.fator_conversao);
    if (!Number.isFinite(fator) || fator <= 0) {
      errors.push(`unidade ${sigla}: fator_conversao invalido`);
    }
    if (u?.is_principal && u?.ativo !== false) {
      countPrincipal++;
      if (fator === 1) principalFator1 = true;
    }
    if (u?.is_comercial && u?.ativo !== false) countComercial++;
  }
  if (countPrincipal !== 1) errors.push(`exatamente 1 is_principal (atual: ${countPrincipal})`);
  else if (!principalFator1) errors.push('is_principal deve ter fator_conversao = 1');
  if (countComercial !== 1) errors.push(`exatamente 1 is_comercial (atual: ${countComercial})`);
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
};

const compararLista = (espelho: any[], canonico: any[], camposChave: string[]) => {
  const divergencias: string[] = [];
  if (espelho.length !== canonico.length) {
    divergencias.push(`tamanho diferente (espelho=${espelho.length}, canonico=${canonico.length})`);
    return divergencias;
  }
  for (let i = 0; i < espelho.length; i++) {
    const e = espelho[i] || {};
    const c = canonico[i] || {};
    for (const campo of camposChave) {
      const ve = e[campo];
      const vc = c[campo];
      const ne = typeof ve === 'number' ? round6(ve) : ve;
      const nc = typeof vc === 'number' ? round6(vc) : vc;
      if (ne !== nc) {
        divergencias.push(`linha[${i}].${campo}: espelho=${ne} vs canonico=${nc}`);
      }
    }
  }
  return divergencias;
};

export async function handle(req: Request, base44: Awaited<ReturnType<typeof createP38Client>>): Promise<Response> {
  try {
    // base44 injetado por servePorted
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit) || 100, 500);
    const escopo: string[] = Array.isArray(body?.escopo) && body.escopo.length > 0
      ? body.escopo
      : ['produto', 'pedido_compra', 'pedido_venda', 'embarque', 'conferencia'];

    const relatorio: any = { stats: {}, problemas: {} };

    // ── Produto.unidades[] ────────────────────────────────────────────────
    if (escopo.includes('produto')) {
      const produtos = await base44.asServiceRole.entities.Produto.list();
      const itens = (produtos || []).slice(0, limit);
      let invalidos = 0;
      let semCanonico = 0;
      const detalhe: any[] = [];
      for (const p of itens) {
        if (!Array.isArray(p?.unidades) || p.unidades.length === 0) {
          semCanonico++;
          continue;
        }
        const v = validateUnidades(p.unidades);
        if (!v.ok) {
          invalidos++;
          if (detalhe.length < 30) detalhe.push({ id: p.id, nome: p.nome, errors: v.errors });
        }
      }
      relatorio.stats.produto = { total: itens.length, sem_canonico: semCanonico, invalidos };
      relatorio.problemas.produto = detalhe;
    }

    // ── PedidoCompra: espelho vs canonico ─────────────────────────────────
    if (escopo.includes('pedido_compra')) {
      const pedidos = await base44.asServiceRole.entities.PedidoCompra.list();
      const amostra = (pedidos || []).slice(0, limit);
      let semLinhasSql = 0;
      const detalhe: any[] = [];
      for (const pedido of amostra) {
        const canonico = await base44.asServiceRole.entities.PedidoCompraItem.filter({ pedido_compra_id: pedido.id });
        if (!Array.isArray(canonico) || canonico.length === 0) {
          semLinhasSql++;
          if (detalhe.length < 30) detalhe.push({ id: pedido.id, numero: pedido.numero });
        }
      }
      relatorio.stats.pedido_compra = { total: amostra.length, sem_canonico: semLinhasSql, com_divergencia: 0 };
      relatorio.problemas.pedido_compra = detalhe;
    }

    // ── PedidoVenda ───────────────────────────────────────────────────────
    if (escopo.includes('pedido_venda')) {
      const pedidos = await base44.asServiceRole.entities.PedidoVenda.list();
      const itens = (pedidos || []).slice(0, limit);
      let comDivergencia = 0;
      let semCanonico = 0;
      const detalhe: any[] = [];
      for (const pedido of itens) {
        const espelho = Array.isArray(pedido?.itens) ? pedido.itens : [];
        const canonico = await base44.asServiceRole.entities.PedidoVendaItem.filter({ pedido_venda_id: pedido.id });
        if (!Array.isArray(canonico) || canonico.length === 0) {
          if (espelho.length > 0) semCanonico++;
          continue;
        }
        const ordenadas = canonico.slice().sort((a: any, b: any) => asNumber(a.ordem, 0) - asNumber(b.ordem, 0));
        const canonicoEspelhoEquivalente = ordenadas.map((it: any) => ({
          produto_id: it.produto_id,
          quantidade: asNumber(it.quantidade_comercial, 0),
          preco_unitario_praticado: asNumber(it.preco_unitario_fator1, 0),
          total: asNumber(it.total, 0),
        }));
        const espelhoLite = espelho.map((it: any) => ({
          produto_id: it.produto_id,
          quantidade: asNumber(it.quantidade, 0),
          preco_unitario_praticado: asNumber(it.preco_unitario_praticado, 0),
          total: asNumber(it.total, 0),
        }));
        const divs = compararLista(espelhoLite, canonicoEspelhoEquivalente, ['produto_id', 'quantidade', 'preco_unitario_praticado', 'total']);
        if (divs.length > 0) {
          comDivergencia++;
          if (detalhe.length < 30) detalhe.push({ id: pedido.id, numero: pedido.numero, divergencias: divs.slice(0, 8) });
        }
      }
      relatorio.stats.pedido_venda = { total: itens.length, sem_canonico: semCanonico, com_divergencia: comDivergencia };
      relatorio.problemas.pedido_venda = detalhe;
    }

    // ── Embarque ──────────────────────────────────────────────────────────
    if (escopo.includes('embarque')) {
      const embs = await base44.asServiceRole.entities.Embarque.list();
      const itens = (embs || []).slice(0, limit);
      let semLinhasSql = 0;
      const detalhe: any[] = [];
      for (const emb of itens) {
        const canonico = await base44.asServiceRole.entities.EmbarqueItem.filter({ embarque_id: emb.id });
        if (!Array.isArray(canonico) || canonico.length === 0) {
          semLinhasSql++;
          if (detalhe.length < 30) detalhe.push({ id: emb.id, numero: emb.numero, codigo: emb.codigo_exibicao });
        }
      }
      relatorio.stats.embarque = { total: itens.length, sem_canonico: semLinhasSql, com_divergencia: 0 };
      relatorio.problemas.embarque = detalhe;
    }

    // ── ConferenciaEstoque ────────────────────────────────────────────────
    if (escopo.includes('conferencia')) {
      const confs = await base44.asServiceRole.entities.ConferenciaEstoque.list();
      const itens = (confs || []).slice(0, limit);
      let comDivergencia = 0;
      let semCanonico = 0;
      const detalhe: any[] = [];
      for (const conf of itens) {
        const espelho = Array.isArray(conf?.itens_conferidos) ? conf.itens_conferidos : [];
        const canonico = await base44.asServiceRole.entities.ConferenciaItem.filter({ conferencia_id: conf.id });
        if (!Array.isArray(canonico) || canonico.length === 0) {
          if (espelho.length > 0) semCanonico++;
          continue;
        }
        const ordenadas = canonico.slice().sort((a: any, b: any) => asNumber(a.ordem, 0) - asNumber(b.ordem, 0));
        const canonicoEspelhoEquivalente = ordenadas.map((it: any) => ({
          produto_id: it.produto_id,
          quantidade_contada: asNumber(it.quantidade_contada_base, 0),
        }));
        // O espelho legado pode ter multiplas linhas pro mesmo produto (contagens).
        const agrupadoEspelho = espelho.reduce((acc: any, it: any) => {
          const k = it.produto_id;
          if (!acc[k]) acc[k] = { produto_id: k, quantidade_contada: 0 };
          acc[k].quantidade_contada += asNumber(it.quantidade_contada, 0);
          return acc;
        }, {});
        const espelhoLite = Object.values(agrupadoEspelho);
        const divs = compararLista(espelhoLite, canonicoEspelhoEquivalente, ['produto_id', 'quantidade_contada']);
        if (divs.length > 0) {
          comDivergencia++;
          if (detalhe.length < 30) detalhe.push({ id: conf.id, nome: conf.nome_conferencia, divergencias: divs.slice(0, 8) });
        }
      }
      relatorio.stats.conferencia = { total: itens.length, sem_canonico: semCanonico, com_divergencia: comDivergencia };
      relatorio.problemas.conferencia = detalhe;
    }

    return Response.json({ success: true, ...relatorio });
  } catch (error) {
    console.error('auditarEspelhosCanonicos erro:', error);
    return Response.json({ error: (error as Error).message || String(error) }, { status: 500 });
  }
}
