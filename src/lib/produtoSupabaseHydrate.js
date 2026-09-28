/**
 * Hidrata linha `produto` do Postgres/Supabase para consumo de unidades (relatórios, scripts).
 * Fonte de verdade: `unidades[]` no cadastro ou migração de `unidades_alternativas` legado.
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

export function hydrateProdutoFromSupabaseRow(row = {}) {
  const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
  let unidades = row.unidades ?? dados.unidades;
  unidades = parseJsonField(unidades, unidades);
  const base = {
    ...dados,
    ...row,
    id: row.id || dados.id,
    nome: row.nome || dados.nome,
    unidades: Array.isArray(unidades) ? unidades : [],
  };
  delete base.dados;
  const { unidades: unidadesCanon } = migrateLegacyToUnidades(base);
  return {
    ...base,
    unidades: unidadesCanon,
  };
}
