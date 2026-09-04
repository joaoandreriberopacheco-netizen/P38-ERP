import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const roundQty = (n: number) => Math.round((Number(n) || 0) * 1_000_000) / 1_000_000;

function parseEmbarquesRegistrados(pedido: Record<string, unknown>): unknown[] {
  const raw = pedido?.embarques_registrados;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function fatorProdutoPedido(pedido: Record<string, unknown>, produtoId: string): number {
  const itens = Array.isArray(pedido?.itens) ? (pedido.itens as Record<string, unknown>[]) : [];
  const hit = itens.find((it) => String(it?.produto_id) === produtoId);
  const f = Number(hit?.fator_conversao ?? hit?.fator_aplicado ?? 1) || 1;
  return f > 0 ? f : 1;
}

function sumReceivedByProduct(embarques: unknown[], pedido?: Record<string, unknown>): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const emb of embarques) {
    const e = emb as Record<string, unknown>;
    const arr =
      Array.isArray(e?.itens_embarcados) && (e.itens_embarcados as unknown[]).length
        ? (e.itens_embarcados as Record<string, unknown>[])
        : Array.isArray(e?.itens)
          ? (e.itens as Record<string, unknown>[])
          : [];
    for (const item of arr) {
      const q = Number(item?.quantidade_recebida) || 0;
      if (q <= 0) continue;
      const pid = String(item?.produto_id_recebido_diferente || item?.produto_id || '');
      if (!pid) continue;
      const fator = pedido ? fatorProdutoPedido(pedido, pid) : 1;
      acc[pid] = roundQty((acc[pid] || 0) + q * fator);
    }
  }
  return acc;
}

async function loadEmbarquesForPedido(svc: any, pedido: Record<string, unknown>): Promise<unknown[]> {
  const embedded = parseEmbarquesRegistrados(pedido);
  if (embedded.length > 0) return embedded;
  try {
    const rows = await svc.entities.Embarque.filter({ pedido_compra_id: pedido.id }, '-created_date', 500);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Pelo menos um embarque com recepção já registada (não «Pendente» nos campos usados na UI). */
function temRecepcaoConcluidaEmAlgumEmbarque(embarques: unknown[]): boolean {
  for (const emb of embarques) {
    const e = emb as Record<string, unknown>;
    const st = String(e.status_recebimento || e.status_recebimento_embarque || '').trim();
    if (st && st !== 'Pendente') return true;
  }
  return false;
}

async function sumMovedByProduct(svc: any, pedidoId: string): Promise<Record<string, number>> {
  const seen = new Set<string>();
  const acc: Record<string, number> = {};

  const ingest = (movs: any[]) => {
    for (const m of movs || []) {
      if (m?.id && seen.has(m.id)) continue;
      if (m?.id) seen.add(m.id);
      if (m.tipo !== 'Entrada' || m.motivo !== 'Compra') continue;
      const pid = m.produto_id;
      if (!pid) continue;
      const q = Number(m.quantidade) || 0;
      acc[pid] = roundQty((acc[pid] || 0) + q);
    }
  };

  let movs = await svc.entities.MovimentacaoEstoque.filter(
    { referencia_tipo: 'PedidoCompra', referencia_id: pedidoId },
    '-created_date',
    2000,
  );
  ingest(movs);
  const alt = await svc.entities.MovimentacaoEstoque.filter(
    { referencia_tipo: 'PedidoCompra', referencia_id: String(pedidoId) },
    '-created_date',
    2000,
  );
  ingest(alt);

  return acc;
}

type DeltaRow = { produto_id: string; recebido_documental: number; ja_movimentado: number; faltante: number };

function buildDeltas(
  recebido: Record<string, number>,
  movimentado: Record<string, number>,
): DeltaRow[] {
  const produtoIds = new Set([...Object.keys(recebido), ...Object.keys(movimentado)]);
  const deltas: DeltaRow[] = [];
  for (const pid of produtoIds) {
    const r = recebido[pid] || 0;
    const m = movimentado[pid] || 0;
    const faltante = roundQty(Math.max(0, r - m));
    if (faltante > 0) {
      deltas.push({
        produto_id: pid,
        recebido_documental: r,
        ja_movimentado: m,
        faltante,
      });
    }
  }
  return deltas;
}

async function computeDeltasPedido(svc: any, pedido: Record<string, unknown>) {
  const embarques = await loadEmbarquesForPedido(svc, pedido);
  const recebido = sumReceivedByProduct(embarques, pedido);
  const movimentado = await sumMovedByProduct(svc, String(pedido.id));
  const deltas = buildDeltas(recebido, movimentado);
  return { embarques, recebido, movimentado, deltas };
}

function nomeProdutoPedido(pedido: Record<string, unknown>, produtoId: string): string {
  const itens = Array.isArray(pedido?.itens) ? (pedido.itens as Record<string, unknown>[]) : [];
  const hit = itens.find((it) => String(it?.produto_id) === produtoId);
  return String(hit?.produto_nome || '');
}

function linhaProdutoPedido(pedido: Record<string, unknown>, produtoId: string): Record<string, unknown> | undefined {
  const itens = Array.isArray(pedido?.itens) ? (pedido.itens as Record<string, unknown>[]) : [];
  return itens.find((it) => String(it?.produto_id) === produtoId);
}

async function recalcularEstoqueLocal(svc: any, produtoId: string) {
  const [produto] = await svc.entities.Produto.filter({ id: produtoId });
  if (!produto) return;
  const movimentacoes = await svc.entities.MovimentacaoEstoque.filter({ produto_id: produtoId }, '-created_date', 1000);
  const saldoMovimentos = (movimentacoes || []).reduce((acc: number, mov: Record<string, unknown>) => {
    const quantidade = Number(mov.quantidade) || 0;
    if (mov.tipo === 'Entrada') return acc + quantidade;
    if (mov.tipo === 'Saída') return acc - quantidade;
    return acc;
  }, 0);
  const estoqueAvariado = Number(produto.estoque_avariado) || 0;
  const estoqueAtual = saldoMovimentos - estoqueAvariado;
  await svc.entities.Produto.update(produtoId, { estoque_atual: estoqueAtual });
}

function inDateRange(isoDate: string | undefined | null, start: Date, end: Date): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  return d >= start && d <= end;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Use POST com JSON.' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      dataInicio,
      dataFim,
      pedidoIds,
      dryRun = true,
      varreduraCompletaPedidos = false,
      limitePedidos = 8000,
      /** Modo simples: só pedidos com recepção já concluída (≠ Pendente) e com stock em falta. */
      somenteConcluidosRecepcaoSemStock = false,
    } = body as {
      dataInicio?: string;
      dataFim?: string;
      pedidoIds?: string[];
      dryRun?: boolean;
      varreduraCompletaPedidos?: boolean;
      limitePedidos?: number;
      somenteConcluidosRecepcaoSemStock?: boolean;
    };

    const svc = base44.asServiceRole;
    let pedidos: Record<string, unknown>[] = [];
    /** No modo simples pré-calculamos deltas uma vez por pedido candidato. */
    let trabalhoPre: { pedido: Record<string, unknown>; deltas: DeltaRow[] }[] | null = null;
    let pedidosRevistosNaLista = 0;
    let escopoUsado = '';

    if (somenteConcluidosRecepcaoSemStock === true) {
      escopoUsado = 'somente_concluidos_recepcao_sem_stock';
      const lim = Math.min(Math.max(Number(limitePedidos) || 3000, 1), 15000);
      const todos = await svc.entities.PedidoCompra.list('-created_date', lim);
      pedidosRevistosNaLista = (todos || []).length;
      const pre: { pedido: Record<string, unknown>; deltas: DeltaRow[] }[] = [];
      for (const p of todos || []) {
        const pedido = p as Record<string, unknown>;
        try {
          const { embarques, deltas } = await computeDeltasPedido(svc, pedido);
          if (!temRecepcaoConcluidaEmAlgumEmbarque(embarques)) continue;
          if (!deltas.length) continue;
          pre.push({ pedido, deltas });
        } catch {
          /* ignora pedido problemático na pré-listagem */
        }
      }
      trabalhoPre = pre;
      pedidos = pre.map((x) => x.pedido);
    } else if (Array.isArray(pedidoIds) && pedidoIds.length > 0) {
      escopoUsado = 'lista_ids';
      for (const id of pedidoIds) {
        const [p] = await svc.entities.PedidoCompra.filter({ id });
        if (p) pedidos.push(p as Record<string, unknown>);
      }
    } else if (varreduraCompletaPedidos === true) {
      escopoUsado = 'varredura_todos';
      const lim = Math.min(Math.max(Number(limitePedidos) || 8000, 1), 15000);
      const todos = await svc.entities.PedidoCompra.list('-created_date', lim);
      for (const p of todos || []) {
        pedidos.push(p as Record<string, unknown>);
      }
    } else {
      escopoUsado = 'intervalo_created_date';
      if (!dataInicio || !dataFim || !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
        return Response.json(
          {
            error:
              'Use somenteConcluidosRecepcaoSemStock:true, ou pedidoIds, ou varreduraCompletaPedidos, ou dataInicio+dataFim.',
          },
          { status: 400 },
        );
      }
      const start = new Date(`${dataInicio}T00:00:00.000Z`);
      const end = new Date(`${dataFim}T23:59:59.999Z`);
      const todos = await svc.entities.PedidoCompra.list();
      for (const p of todos || []) {
        const po = p as Record<string, unknown>;
        if (inDateRange(po.created_date as string, start, end)) pedidos.push(po);
      }
    }

    const report: Record<string, unknown>[] = [];
    let linhasCorrigidas = 0;
    const produtosRecalc = new Set<string>();
    const erros: Record<string, unknown>[] = [];

    const mapaPre =
      trabalhoPre != null
        ? new Map(trabalhoPre.map((t) => [String(t.pedido.id), t.deltas]))
        : null;

    for (const pedido of pedidos) {
      try {
        const deltas =
          mapaPre?.get(String(pedido.id)) ?? (await computeDeltasPedido(svc, pedido)).deltas;

        if (!deltas.length) {
          report.push({
            pedido_id: pedido.id,
            numero: pedido.numero,
            skipped: true,
            motivo: 'sem_delta',
          });
          continue;
        }

        const linhaReport = {
          pedido_id: pedido.id,
          numero: pedido.numero,
          deltas,
        };

        if (dryRun) {
          report.push({ ...linhaReport, dryRun: true });
          continue;
        }

        const obsBase = `Correção retroativa recepção→estoque (admin ${user.email || ''}); reconcilia embarques vs MovimentacaoEstoque Compra.`;

        for (const d of deltas) {
          const linha = linhaProdutoPedido(pedido, d.produto_id);
          const fator = fatorProdutoPedido(pedido, d.produto_id);
          const unidade = String(linha?.unidade_medida || linha?.unidade_sigla || '');
          await svc.entities.MovimentacaoEstoque.create({
            produto_id: d.produto_id,
            produto_nome: nomeProdutoPedido(pedido, d.produto_id) || 'Produto',
            tipo: 'Entrada',
            motivo: 'Compra',
            quantidade: d.faltante,
            quantidade_base: d.faltante,
            ...(fator > 1 ? { fator_conversao: fator } : {}),
            ...(unidade ? { unidade_medida: unidade, unidade_sigla: unidade } : {}),
            referencia_tipo: 'PedidoCompra',
            referencia_id: pedido.id,
            referencia_numero: pedido.numero,
            observacoes: obsBase,
          });
          linhasCorrigidas += 1;
          produtosRecalc.add(d.produto_id);
        }

        try {
          const tag = `\n[CORREÇÃO MOVIMENTOS RECEPÇÃO RETROATIVA | PC ${pedido.numero || pedido.id} | ${deltas.length} linha(s) | ${new Date().toISOString()}]`;
          await svc.entities.PedidoCompra.update(String(pedido.id), {
            historico: String(pedido.historico || '') + tag,
          });
        } catch (e) {
          erros.push({ pedido_id: pedido.id, etapa: 'historico', erro: (e as Error).message });
        }

        report.push({ ...linhaReport, aplicado: true });
      } catch (e) {
        erros.push({ pedido_id: pedido?.id, erro: (e as Error).message });
      }
    }

    if (!dryRun) {
      for (const produtoId of produtosRecalc) {
        try {
          await recalcularEstoqueLocal(svc, produtoId);
        } catch (e) {
          erros.push({ produto_id: produtoId, etapa: 'recalcular_estoque', erro: (e as Error).message });
        }
      }
    }

    const comDelta = (report || []).filter(
      (r) => Array.isArray((r as { deltas?: unknown[] }).deltas) && ((r as { deltas: unknown[] }).deltas?.length ?? 0) > 0,
    ).length;

    return Response.json({
      success: true,
      dryRun,
      escopo: escopoUsado,
      pedidos_revistos_na_fonte: pedidosRevistosNaLista || undefined,
      pedidos_analisados: pedidos.length,
      pedidos_com_delta: comDelta,
      linhas_corrigidas: dryRun ? 0 : linhasCorrigidas,
      produtos_recalculados: dryRun ? 0 : produtosRecalc.size,
      detalhes: report,
      erros,
      executadoPor: user.email,
    });
  } catch (error) {
    console.error('corrigirMovimentosRecepcaoRetroativos:', error);
    return Response.json({ error: (error as Error)?.message || 'Erro inesperado' }, { status: 500 });
  }
});
