/**
 * Entidade auxiliar Base44 `ProdutoEmbalagem` (máx. 3 linhas por produto).
 * Comportamento: no-op se a entidade não existir no cliente ou se o flag estiver off.
 */
import { p38PublicEnvBool } from '@/lib/p38PublicEnv';

export const ENTITY_PRODUTO_EMBALAGEM = "ProdutoEmbalagem";

/** Máximo de linhas ativas: 1 base (fator 1) + 2 adicionais. */
export const MAX_EMBALAGENS = 3;

/** Papel lógico derivado dos booleanos persistidos. */
export const ROLE_BASE = "base";
export const ROLE_ALT = "alt";
export const ROLE_COMMERCIAL = "commercial";

export function embalagemRowRole(row) {
  if (row?.is_principal === true) return ROLE_BASE;
  if (row?.is_comercial === true) return ROLE_COMMERCIAL;
  return ROLE_ALT;
}

export function isProdutoEmbalagemEntityFlagOn() {
  return p38PublicEnvBool('VITE_USE_PRODUTO_EMBALAGEM_ENTITY', false);
}

/**
 * Resolve o repositório da entidade; devolve null se indisponível (SDK sem entidade).
 * @param {import('@/api/base44Client').base44 | { entities?: Record<string, unknown> }} base44
 */
export function getProdutoEmbalagemRepo(base44) {
  try {
    const repo = base44?.entities?.[ENTITY_PRODUTO_EMBALAGEM];
    if (!repo || typeof repo.filter !== "function" || typeof repo.create !== "function") {
      return null;
    }
    return repo;
  } catch {
    return null;
  }
}

/**
 * @param {import('@/api/base44Client').base44} base44
 * @param {string} produtoId
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function fetchEmbalagensByProdutoId(base44, produtoId) {
  if (!isProdutoEmbalagemEntityFlagOn() || !produtoId) return [];
  const repo = getProdutoEmbalagemRepo(base44);
  if (!repo) return [];
  try {
    const rows = await repo.filter({ produto_id: produtoId });
    const list = Array.isArray(rows) ? rows : [];
    return list
      .filter((r) => r && r.ativo !== false)
      .sort((a, b) => (Number(a?.ordem) || 0) - (Number(b?.ordem) || 0));
  } catch (e) {
    if (import.meta.env?.DEV) {
      console.warn("[ProdutoEmbalagem] fetchEmbalagensByProdutoId no-op:", e?.message || e);
    }
    return [];
  }
}

function assertEmbalagensInvariants(rows) {
  const active = (rows || []).filter((r) => r && r.ativo !== false).slice(0, MAX_EMBALAGENS);
  if (active.length > MAX_EMBALAGENS) {
    throw new Error(`No máximo ${MAX_EMBALAGENS} embalagens ativas.`);
  }
  let principals = 0;
  let commercials = 0;
  for (const r of active) {
    if (r.is_principal === true) principals += 1;
    if (r.is_comercial === true) commercials += 1;
  }
  if (principals !== 1) {
    throw new Error("Deve existir exatamente uma embalagem com is_principal=true.");
  }
  if (commercials !== 1) {
    throw new Error("Deve existir exatamente uma embalagem com is_comercial=true.");
  }
}

/**
 * Substitui todas as linhas do produto (delete + create), alinhado a padrões como
 * `rebuildReceitasLancamentosPedidoVenda` (filter → delete → create).
 *
 * @param {import('@/api/base44Client').base44} base44
 * @param {string} produtoId
 * @param {Array<Record<string, unknown>>} rows — payloads sem `id` (create)
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: Error }>}
 */
export async function replaceEmbalagensForProduto(base44, produtoId, rows) {
  if (!isProdutoEmbalagemEntityFlagOn() || !produtoId) {
    return { ok: true, skipped: true };
  }
  const repo = getProdutoEmbalagemRepo(base44);
  if (!repo || typeof repo.delete !== "function") {
    return { ok: true, skipped: true };
  }
  try {
    const normalized = (rows || []).slice(0, MAX_EMBALAGENS).map((r, i) => ({
      ...r,
      produto_id: produtoId,
      ordem: r.ordem != null ? Number(r.ordem) : i,
      ativo: r.ativo !== false,
    }));
    assertEmbalagensInvariants(normalized);

    const existing = await repo.filter({ produto_id: produtoId }).catch(() => []);
    const list = Array.isArray(existing) ? existing : [];
    for (const row of list) {
      if (row?.id) await repo.delete(row.id);
    }
    for (const payload of normalized) {
      const rest = { ...payload };
      delete rest.id;
      await repo.create(rest);
    }
    return { ok: true };
  } catch (e) {
    if (import.meta.env?.DEV) {
      console.warn("[ProdutoEmbalagem] replaceEmbalagensForProduto falhou (no-op de produção):", e?.message || e);
    }
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Após gravar embalagens, re-alinha campos de unidade no `Produto` com os ids devolvidos
 * pelo servidor (opcional mas evita drift de `unidade_comercial_id`).
 *
 * @param {import('@/api/base44Client').base44} base44
 * @param {string} produtoId
 * @param {(rows: Array<Record<string, unknown>>) => Record<string, unknown>} patchFromRows
 */
export async function patchProdutoUnidadesFromEmbalagensRows(base44, produtoId, patchFromRows) {
  if (!isProdutoEmbalagemEntityFlagOn() || !produtoId || typeof patchFromRows !== "function") return;
  const rows = await fetchEmbalagensByProdutoId(base44, produtoId);
  if (!rows.length) return;
  try {
    const patch = patchFromRows(rows);
    const allowedKeys = [
      "unidades",
      "unidade_principal",
      "unidades_alternativas",
      "unidade_vitrine",
      "unidade_apresentacao_default",
      "unidade_show_comercial",
      "unidade_show_logistica",
      "unidade_comercial_id",
    ];
    const slim = {};
    for (const k of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) slim[k] = patch[k];
    }
    if (Object.keys(slim).length === 0) return;
    await base44.entities.Produto.update(produtoId, slim);
  } catch (e) {
    if (import.meta.env?.DEV) {
      console.warn("[ProdutoEmbalagem] patchProdutoUnidadesFromEmbalagensRows:", e?.message || e);
    }
  }
}
