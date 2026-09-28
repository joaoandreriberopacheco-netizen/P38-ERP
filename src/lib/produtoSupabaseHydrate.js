/**
 * Linha `public.produto` (Postgres) → objeto Produto para relatórios/scripts.
 *
 * **Autoridade:** colunas SQL (migração 029+), por exemplo:
 *   `unidade_principal`, `unidade_vitrine`, `unidades_alternativas` (jsonb de embalagens).
 *
 * O jsonb `dados` é **legado Base44** (documento único antes do Postgres relacional).
 * Só entra aqui como **fallback** quando a coluna SQL ainda está vazia — nunca sobrescreve coluna preenchida.
 *
 * `unidades[]` canónico monta-se com `migrateLegacyToUnidades` (mesma regra do formulário de produto).
 */
import { migrateLegacyToUnidades } from '@/lib/productUnitsCrud';

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

/** Coluna SQL preenchida ganha; `dados` só preenche lacunas. */
export function mergeProdutoSqlRowWithDadosFallback(row = {}) {
  const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
  const merged = { ...dados };
  for (const [key, value] of Object.entries(row)) {
    if (key === 'dados') continue;
    if (value !== null && value !== undefined) {
      merged[key] = value;
    }
  }
  merged.id = row.id ?? merged.id ?? dados.id;
  merged.nome = row.nome ?? merged.nome ?? dados.nome;
  return merged;
}

export function hydrateProdutoFromSupabaseRow(row = {}) {
  const base = mergeProdutoSqlRowWithDadosFallback(row);
  let unidades = base.unidades;
  unidades = parseJsonField(unidades, unidades);
  base.unidades = Array.isArray(unidades) ? unidades : [];
  const { unidades: unidadesCanon } = migrateLegacyToUnidades(base);
  return {
    ...base,
    unidades: unidadesCanon,
  };
}
