/**
 * Contexto opcional enviado ao p38-core para telemetria de custo/tokens.
 */
export function buildLlmTelemetryContext({
  source,
  catalogProductCount = 0,
  fileCount = 0,
} = {}) {
  return {
    source: source || 'invoke_llm',
    catalog_product_count: Math.max(0, Number(catalogProductCount) || 0),
    file_count: Math.max(0, Number(fileCount) || 0),
  };
}
