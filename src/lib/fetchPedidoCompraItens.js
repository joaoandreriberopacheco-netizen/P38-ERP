import { pedidoCompraItemToLegacyMirror } from '@/lib/pedidoCompraItemContract';
import { normalizePedidoCompraItemCustoLiquidoParaPersist } from '@/lib/productUnits';
import { savePedidoCompraItem } from '@/functions/savePedidoCompraItem';
import { hydrateEmbarquesPedidoFromSql } from '@/lib/fetchEmbarqueItens';

const CHUNK_SIZE = 40;

async function fetchRowsByCampoIn(entity, field, ids = []) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length || !entity?.filter) return [];

  const allRows = [];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    try {
      const rows = await entity.filter({ [field]: { $in: chunk } });
      if (Array.isArray(rows) && rows.length > 0) {
        allRows.push(...rows);
        continue;
      }
    } catch {
      /* fallback abaixo */
    }
    const batches = await Promise.all(
      chunk.map((id) => entity.filter({ [field]: id }).catch(() => [])),
    );
    batches.flat().forEach((row) => allRows.push(row));
  }
  return allRows;
}

/**
 * Busca linhas canónicas PedidoCompraItem para vários pedidos.
 * @returns {Map<string, object[]>} pedido_compra_id → linhas ordenadas
 */
export async function fetchPedidoCompraItensPorPedidos(base44, pedidoIds = []) {
  const ids = [...new Set((pedidoIds || []).filter(Boolean))];
  const byPedido = new Map();
  if (!ids.length) return byPedido;

  const pci = base44?.entities?.PedidoCompraItem;
  if (!pci?.filter) return byPedido;

  const allRows = await fetchRowsByCampoIn(pci, 'pedido_compra_id', ids);

  for (const row of allRows) {
    const pid = row?.pedido_compra_id;
    if (!pid) continue;
    const key = String(pid);
    if (!byPedido.has(key)) byPedido.set(key, []);
    byPedido.get(key).push(row);
  }

  for (const rows of byPedido.values()) {
    rows.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
  }

  return byPedido;
}

export function linhasPedidoCompraToLegacyItens(linhas = []) {
  return (linhas || []).map(pedidoCompraItemToLegacyMirror).filter((item) => item?.produto_id);
}

function attachItensPedido(pedido, itens, fonte) {
  const { itens: _i, _itens_fonte: _f, ...rest } = pedido || {};
  return {
    ...rest,
    itens,
    _itens_fonte: fonte,
  };
}

/** Espelho legado: coluna `itens` ou `dados.itens` (só leitura). */
export function readLegacyItensPedidoCompra(pedido = {}) {
  if (Array.isArray(pedido?.itens) && pedido.itens.some((item) => item?.produto_id)) {
    return pedido.itens.filter((item) => item?.produto_id);
  }
  const dadosItens = pedido?.dados?.itens;
  if (Array.isArray(dadosItens) && dadosItens.length > 0) {
    return dadosItens.filter((item) => item?.produto_id);
  }
  return [];
}

/** Converte itens legado do formulário/espelho para payload replaceAll em PedidoCompraItem. */
export function legacyItensPedidoCompraToCanonicalPayload(itens = []) {
  return (Array.isArray(itens) ? itens : [])
    .map((it, idx) => {
      const qty = Number(it?.quantidade) || 0;
      const normalizado = normalizePedidoCompraItemCustoLiquidoParaPersist({
        ...it,
        custo_unitario_fator1: Number(it?.custo_unitario) || 0,
        quantidade_comercial: qty,
        quantidade_base: Number(it?.quantidade_base) || 0,
        fator_aplicado: Number(it?.fator_conversao) || 1,
        frete_unitario_fator1: Number(it?.custo_frete_unitario) || 0,
        outros_unitario_fator1: Number(it?.custo_outros_unitario) || 0,
        desconto_unitario_fator1: Number(it?.valor_desconto_item ?? it?.desconto_unitario) || 0,
        total: Number(it?.total) || 0,
      });
      return {
        id: it?.pedido_compra_item_id || it?.id || undefined,
        produto_id: it?.produto_id || '',
        produto_unidade_id: it?.produto_unidade_id || '',
        unidade_sigla: it?.unidade_medida || it?.unidade_apresentacao || '',
        quantidade_comercial: (normalizado.quantidade_comercial ?? qty) || 0,
        custo_unitario_fator1: normalizado.custo_unitario_fator1,
        frete_unitario_fator1: normalizado.frete_unitario_fator1 ?? 0,
        outros_unitario_fator1: normalizado.outros_unitario_fator1 ?? 0,
        desconto_unitario_fator1: 0,
        valor_desconto_item: 0,
        total: normalizado.total ?? (Number(it?.total) || 0),
        quantidade_vinculada: Number(it?.quantidade_vinculada) || 0,
        ordem: idx,
        observacoes: typeof it?.observacoes === 'string' ? it.observacoes : '',
        status_recebimento: it?.status_recebimento || 'Pendente',
      };
    })
    .filter((it) => it.produto_id && it.quantidade_comercial > 0);
}

/**
 * Hidrata `itens` a partir de PedidoCompraItem (SQL).
 * Fallback de leitura: coluna `itens` ou `dados.itens` (sem gravar).
 */
export async function hydratePedidosCompraItensFromSql(base44, pedidos = []) {
  if (!Array.isArray(pedidos) || !pedidos.length) return pedidos || [];

  const byPedido = await fetchPedidoCompraItensPorPedidos(
    base44,
    pedidos.map((p) => p.id).filter(Boolean),
  );

  return pedidos.map((pedido) => {
    const pid = String(pedido?.id ?? '');
    const sqlRows = byPedido.get(pid) ?? byPedido.get(pedido.id);
    if (sqlRows?.length) {
      return attachItensPedido(pedido, linhasPedidoCompraToLegacyItens(sqlRows), 'sql');
    }
    const legado = readLegacyItensPedidoCompra(pedido);
    return attachItensPedido(pedido, legado, legado.length ? 'json-legado' : 'vazio');
  });
}

/**
 * Garante PedidoCompraItem (SQL) + `pedido.itens` hidratado.
 * Se SQL vazio mas existe espelho legado, sincroniza replaceAll uma vez.
 */
export async function ensurePedidoCompraItensCanonico(base44, pedido) {
  if (!pedido?.id) return pedido;

  const [hydrated] = await hydratePedidosCompraItensFromSql(base44, [pedido]);
  if ((hydrated?.itens || []).length > 0) return hydrated;

  const legado = readLegacyItensPedidoCompra(pedido);
  if (!legado.length) return hydrated || pedido;

  const items = legacyItensPedidoCompraToCanonicalPayload(legado);
  if (!items.length) {
    return attachItensPedido(pedido, legado, 'json-legado');
  }

  try {
    await savePedidoCompraItem({
      action: 'replaceAll',
      pedido_compra_id: pedido.id,
      items,
    });
    const [synced] = await hydratePedidosCompraItensFromSql(base44, [pedido]);
    if ((synced?.itens || []).length > 0) return synced;
  } catch (err) {
    console.warn('ensurePedidoCompraItensCanonico: falha ao sincronizar PedidoCompraItem', err);
  }

  return attachItensPedido(pedido, legado, 'json-legado');
}

/** Recarrega cabeçalho + itens canónicos + embarques hidratados (Logística/Recepção). */
export async function refreshPedidoCompraComLogistica(base44, pedidoId, { filterEmbarques } = {}) {
  if (!pedidoId) return null;

  const [atualizado, embarquesAtualizados] = await Promise.all([
    base44.entities.PedidoCompra.filter({ id: pedidoId }),
    base44.entities.Embarque.filter({ pedido_compra_id: pedidoId }),
  ]);
  if (!atualizado?.[0]) return null;

  const pedidoComItens = await ensurePedidoCompraItensCanonico(base44, atualizado[0]);
  const embarquesHidratados = await hydrateEmbarquesPedidoFromSql(
    base44,
    pedidoId,
    embarquesAtualizados || [],
  );
  const embarquesVisiveis = typeof filterEmbarques === 'function'
    ? filterEmbarques(embarquesHidratados)
    : embarquesHidratados;

  return { ...pedidoComItens, _embarques: embarquesVisiveis };
}
