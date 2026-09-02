/**
 * Snapshot persistido do lucro bruto por competência (Relatório de Margem).
 * Meses civilmente fechados: lê do Supabase (ou localStorage) em vez de recalcular.
 */

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { competenciaDeveEstarFechada } from '@/lib/folhaPrevisaoCalculos';

const LS_KEY = 'p38_margem_competencia_v1';
export const MARGEM_SNAPSHOT_SOURCE_VERSION = 'relatorio_margem_v1';

export function competenciaMargemPodeUsarSnapshot(competencia) {
  return competenciaDeveEstarFechada(competencia);
}

function normalizeTotais(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    receita_liquida: Number(row.receita_liquida) || 0,
    custo_total: Number(row.custo_total) || 0,
    lucro_bruto: Number(row.lucro_bruto) || 0,
    quantidade_produtos: Number(row.quantidade_produtos) || 0,
  };
}

function lerMapaLocal() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_KEY));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function gravarMapaLocal(mapa) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(mapa || {}));
  } catch {
    /* quota */
  }
}

function lerLocalSnapshot(competencia) {
  const prefix = String(competencia || '').slice(0, 7);
  if (!prefix) return null;
  const row = lerMapaLocal()[prefix];
  return normalizeTotais(row);
}

function gravarLocalSnapshot(competencia, totals) {
  const prefix = String(competencia || '').slice(0, 7);
  const normalized = normalizeTotais(totals);
  if (!prefix || !normalized) return;
  const mapa = lerMapaLocal();
  mapa[prefix] = { ...normalized, savedAt: new Date().toISOString() };
  gravarMapaLocal(mapa);
}

/** @returns {Promise<object|null>} totais margem ou null */
export async function lerMargemCompetenciaSnapshot(competencia) {
  const prefix = String(competencia || '').slice(0, 7);
  if (!prefix || !competenciaMargemPodeUsarSnapshot(prefix)) return null;

  if (isSupabaseBrowserConfigured()) {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('margem_competencia_snapshot')
        .select('receita_liquida,custo_total,lucro_bruto,quantidade_produtos,source_version')
        .eq('competencia', prefix)
        .maybeSingle();

      if (!error && data) {
        const normalized = normalizeTotais(data);
        if (normalized) {
          gravarLocalSnapshot(prefix, normalized);
          return normalized;
        }
      }
    } catch {
      /* fallback local */
    }
  }

  return lerLocalSnapshot(prefix);
}

/** Grava snapshot após cálculo (meses fechados). Falha silenciosa. */
export async function gravarMargemCompetenciaSnapshot(competencia, totals) {
  const prefix = String(competencia || '').slice(0, 7);
  const normalized = normalizeTotais(totals);
  if (!prefix || !normalized || !competenciaMargemPodeUsarSnapshot(prefix)) return;

  gravarLocalSnapshot(prefix, normalized);

  if (!isSupabaseBrowserConfigured()) return;

  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from('margem_competencia_snapshot').upsert(
      {
        competencia: prefix,
        receita_liquida: normalized.receita_liquida,
        custo_total: normalized.custo_total,
        lucro_bruto: normalized.lucro_bruto,
        quantidade_produtos: normalized.quantidade_produtos,
        source_version: MARGEM_SNAPSHOT_SOURCE_VERSION,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'competencia' },
    );
    if (error) console.warn('[margem] snapshot upsert:', error.message);
  } catch (error) {
    console.warn('[margem] snapshot upsert falhou', error);
  }
}

/** Remove snapshot (recalcular mês fechado após correção de vendas). */
export async function invalidarMargemCompetenciaSnapshot(competencia) {
  const prefix = String(competencia || '').slice(0, 7);
  if (!prefix) return;

  const mapa = lerMapaLocal();
  if (mapa[prefix]) {
    delete mapa[prefix];
    gravarMapaLocal(mapa);
  }

  if (!isSupabaseBrowserConfigured()) return;

  try {
    const supabase = getSupabaseBrowserClient();
    await supabase.from('margem_competencia_snapshot').delete().eq('competencia', prefix);
  } catch {
    /* noop */
  }
}
