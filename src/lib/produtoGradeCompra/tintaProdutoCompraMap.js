/**
 * Mapeamento explícito h3 (cadastro legado TINTA) → produto_compra (nome de compra).
 * Sem inferência por IA — só regras claras.
 */
const TINTA_H3_TO_PRODUTO_COMPRA = {
  ESMALTE: { codigo: 'TINTA_ESMALTE_SINTETICO', nome: 'TINTA ESMALTE SINTÉTICO' },
  'P/ PISO': { codigo: 'TINTA_P_PISO', nome: 'TINTA P/ PISO' },
  'ACR. FOSCO ECON.': { codigo: 'TINTA_ACR_FOSCO_ECON', nome: 'TINTA ACRÍLICA FOSCO ECONÔMICO' },
  'SEMI-BRILHO': { codigo: 'TINTA_SEMI_BRILHO', nome: 'TINTA SEMI-BRILHO' },
  STANDARD: { codigo: 'TINTA_STANDARD', nome: 'TINTA STANDARD' },
  'STANDARD POUPE+': { codigo: 'TINTA_STANDARD_POUPE', nome: 'TINTA STANDARD POUPE+' },
  'INT/EXT STAND': { codigo: 'TINTA_INT_EXT_STAND', nome: 'TINTA INT/EXT STANDARD' },
};

export function mapTintaH3ToProdutoCompra(h3Raw) {
  const h3 = String(h3Raw || '').trim().toUpperCase();
  if (!h3) return null;
  const direct = TINTA_H3_TO_PRODUTO_COMPRA[h3];
  if (direct) return direct;
  return { codigo: `TINTA_${h3.replace(/[^A-Z0-9]+/g, '_')}`, nome: `TINTA ${h3}` };
}

export function listTintaProdutoCompraDefs() {
  return Object.values(TINTA_H3_TO_PRODUTO_COMPRA);
}
