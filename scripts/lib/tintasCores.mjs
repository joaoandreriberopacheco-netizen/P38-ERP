/** Paleta partilhada — esmaltes, acrílicos e tons de madeira (verniz). */

export const TINTA_CORES = {
  AMARELO: '#ffac00',
  'AMARELO CATERPILAR': '#ffcc00',
  'AMARELO CARTEPILA': '#ffcc00',
  'AMARELO CATERPILLAR': '#ffcc00',
  'AMARELO FREVO': '#ffd700',
  'AMARELO DEMARCAO': '#ffcc00',
  'AMARELO DEMARÇÃO': '#ffcc00',
  AREIA: '#E0CDB4',
  'AZUL DEL REY': '#00315c',
  'AZUL FRANCA': '#0066cc',
  'AZUL FRANÇA': '#0066cc',
  'AZUL MAR': '#1a3a5c',
  'AZUL PROFUNDO': '#003366',
  BRANCO: '#f8f8f8',
  'BRANCO NEVE': '#F5F4F2',
  BRRANCO: '#F5F4F2',
  CINZA: '#9e9e9e',
  'CINZA MEDIO': '#808080',
  'CINZA MÉDIO': '#808080',
  'CINZA ESCURO': '#4a4a4a',
  CREME: '#f5f0dc',
  GEADA: '#e8eaf0',
  LARANJA: '#ff6600',
  MARFIM: '#fffff0',
  POENTE: '#ff7f50',
  PRETO: '#1a1a1a',
  TABACO: '#573512',
  VERMELHO: '#cc0000',
  'VERDE FOLHA': '#228B22',
  'VERDE LIMAO': '#adff2f',
  'VERDE LIMAO': '#adff2f',
  // Verniz — tom de madeira no fundo
  CEREJEIRA: '#C96B4B',
  COPAIBA: '#D4A574',
  IMBUIA: '#C4A574',
  INCOLOR: '#f5f0e8',
  'IPE': '#DAA520',
  'IPÊ': '#DAA520',
  MOGNO: '#5C3317',
  'MOGNO COLONIAL': '#6B3A2A',
  NOGUEIRA: '#8B5A2B',
  VINHO: '#722F37',
  YPE: '#C9A86C',
};

export function normalizeCorKey(raw = '') {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+#G$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function resolveTintaHex(cor) {
  if (!cor) return '#f5f5f5';
  const key = normalizeCorKey(cor);
  if (TINTA_CORES[key]) return TINTA_CORES[key];
  // match parcial (ex.: "AMARELO CATERPILAR" contém AMARELO)
  const hit = Object.entries(TINTA_CORES).find(([k]) => key.includes(k) || k.includes(key));
  return hit?.[1] || '#f5f5f5';
}
