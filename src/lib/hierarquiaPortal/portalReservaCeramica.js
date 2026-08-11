import { CERAM_META_VAGAS } from '@/lib/modeloCatalogo/regrasCeramica';
import { portalEstoqueCx } from '@/lib/hierarquiaPortal/buildPortalSupplyCeramica';

/** Tag no produto para distinguir inactivação por reserva do portal (vs. inactivo genérico). */
export const PORTAL_RESERVA_TAG = 'reserva-ceramica';

const BATCH_SIZE = 8;

function normalizeTag(tag) {
  return String(tag || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ');
}

export function getProdutoTags(produto) {
  return Array.isArray(produto?.tags) ? produto.tags : [];
}

export function isProdutoReservaPortal(produto) {
  if (!produto) return false;
  const tags = getProdutoTags(produto).map((t) => normalizeTag(t).toLowerCase());
  return tags.includes(PORTAL_RESERVA_TAG);
}

export function mergeTags(existing = [], { add = [], remove = [] } = {}) {
  const removeSet = new Set(remove.map((t) => normalizeTag(t).toLowerCase()).filter(Boolean));
  const out = [];
  const seen = new Set();

  for (const tag of existing) {
    const cleaned = normalizeTag(tag);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (removeSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }

  for (const tag of add) {
    const cleaned = normalizeTag(tag);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }

  return out;
}

/** SKUs activos sugeridos para reserva quando a esquadra excede a meta de posições (menor estoque primeiro). */
export function sugerirSkusExcedente(line, metaVagas = CERAM_META_VAGAS) {
  const skus = (line?.skus || []).filter((s) => s.produto?.ativo !== false);
  if (skus.length <= metaVagas) return [];

  const ordenados = [...skus].sort((a, b) => {
    const ea = portalEstoqueCx(a);
    const eb = portalEstoqueCx(b);
    if (ea !== eb) return ea - eb;
    return String(a.produto?.nome || '').localeCompare(String(b.produto?.nome || ''), 'pt-BR');
  });

  const excesso = skus.length - metaVagas;
  return ordenados.slice(0, excesso).map((s) => s.produto.id).filter(Boolean);
}

export function contagemReservaLine(line) {
  const skus = line?.skus || [];
  const activos = skus.filter((s) => s.produto?.ativo !== false);
  const reservados = skus.filter((s) => isProdutoReservaPortal(s.produto));
  return {
    total: skus.length,
    activos: activos.length,
    reservados: reservados.length,
    meta_vagas: line?.meta_vagas ?? CERAM_META_VAGAS,
    excedente: Math.max(0, activos.length - (line?.meta_vagas ?? CERAM_META_VAGAS)),
  };
}

async function runBatchUpdates(base44, items, onProgress) {
  let done = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(({ id, patch }) => base44.entities.Produto.update(id, patch)),
    );
    done += batch.length;
    onProgress?.(done, items.length);
  }
}

/** Inactiva SKUs e marca tag reserva-ceramica (não apaga do cadastro). */
export async function enviarSkusParaReserva(base44, produtos, { onProgress } = {}) {
  const lista = (produtos || []).filter((p) => p?.id && p.ativo !== false);
  const items = lista.map((p) => ({
    id: p.id,
    patch: {
      ativo: false,
      tags: mergeTags(getProdutoTags(p), { add: [PORTAL_RESERVA_TAG] }),
    },
  }));
  await runBatchUpdates(base44, items, onProgress);
  return items.length;
}

/** Reativa SKUs previamente na reserva do portal. */
export async function reativarSkusDaReserva(base44, produtos, { onProgress } = {}) {
  const lista = (produtos || []).filter((p) => p?.id && isProdutoReservaPortal(p));
  const items = lista.map((p) => ({
    id: p.id,
    patch: {
      ativo: true,
      tags: mergeTags(getProdutoTags(p), { remove: [PORTAL_RESERVA_TAG] }),
    },
  }));
  await runBatchUpdates(base44, items, onProgress);
  return items.length;
}
