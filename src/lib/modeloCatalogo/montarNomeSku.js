export function slugCodigo(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'ITEM';
}

export function montarNomeModeloSku({ produtoCompraNome, eixoA, eixoB, marca, linhaNome, solo }) {
  const parts = [];
  if (solo && linhaNome) parts.push(linhaNome);
  if (produtoCompraNome) parts.push(produtoCompraNome);
  if (eixoA) parts.push(eixoA);
  if (eixoB) parts.push(eixoB);
  if (marca) parts.push(marca);
  return parts.join(' ').trim();
}

export function mapTipoLinhaUi(tipo) {
  if (tipo === 'solo' || tipo === 'linha_mix' || tipo === 'portfolio') return tipo;
  return 'linha_mix';
}

export const TIPO_LINHA_LABEL = {
  solo: 'Solo',
  linha_mix: 'Mix',
  portfolio: 'Portfolio',
};
