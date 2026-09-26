/**
 * Colunas da aba SKU_Completo — espelho do importador em massa (subset operacional).
 * editavel: false = emprestado do Supabase na exportação (estilo calculado/bloqueado).
 */
export const TURBO_SKU_COMPLETO_COLS = [
  { key: 'codigo_interno', label: 'Cód. Interno', editavel: false, width: 14, tipo: 'string' },
  { key: 'nome', label: 'Nome cadastro', editavel: false, width: 42, tipo: 'string', calculado: true },
  { key: 'categoria_nome', label: 'Categoria', editavel: false, width: 22, tipo: 'string', calculado: true },
  { key: 'valor_compra', label: 'Valor Compra (R$)', editavel: false, width: 16, tipo: 'numero', calculado: true },
  { key: 'preco_venda_padrao', label: 'Preço Venda (*)', editavel: false, width: 16, tipo: 'numero', calculado: true },
  { key: 'custo_total_calculado', label: 'Custo Total Calculado', editavel: false, width: 18, tipo: 'numero', calculado: true },
  { key: 'estoque_atual', label: 'Estoque atual', editavel: false, width: 14, tipo: 'numero', calculado: true },
  { key: 'unidade_principal', label: 'Unidade', editavel: false, width: 10, tipo: 'string', calculado: true },
  { key: 'ativo', label: 'Ativo', editavel: false, width: 8, tipo: 'string', calculado: true },
  { key: 'novo_sku_4x3', label: 'Nome 4×3 (TurboCharger)', editavel: false, width: 40, tipo: 'string', calculado: true },
];
