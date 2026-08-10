/**
 * Interpreta flags de configuração vindas do Base44 ou Supabase (colunas text).
 */
export function parseConfigBoolean(value, defaultValue = false) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'sim') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'nao' || normalized === 'não') {
    return false;
  }
  return defaultValue;
}

/** Vendas (ConfiguracoesVenda) ou Estoque (ConfiguracoesEstoque) podem autorizar venda sem saldo. */
export function isVendaSemEstoquePermitida(configVenda, configEstoque) {
  return parseConfigBoolean(configVenda?.vender_sem_estoque)
    || parseConfigBoolean(configEstoque?.permitir_venda_estoque_negativo);
}
