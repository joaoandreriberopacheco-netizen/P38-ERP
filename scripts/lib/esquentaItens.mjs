/** Lista esquenta + preços acordados (sem Supabase). */
export const PRECO_TABELA_M2 = 28.5;
export const DESCONTO = 0.15;
export const PRECO_LIQUIDO_M2 = PRECO_TABELA_M2 * (1 - DESCONTO);

export const ITENS = [
  'PISO 18X114 A ENGENHO RETIFICADO (2.13)',
  'PISO 31X120 CARBONO PLUS RETIFICADO (2.2)',
  'PISO 34X34 A ADELAIDE ESM. (2.10)(PPF341)',
  'PISO 34X34 A FLORIDA (2.10)(PPF34030) BR',
  'PISO 34X34 A MONTEREY ESM. (2.10)(PPF341)',
  'PISO 37X59 A FLOX HD (2.43)(543121) BRIL',
  'PISO 45X45 A (2.32) (PD-35199) GRANILHA',
  'PISO 45X45 A (2.32) (PD-35739) BRILHANT',
  'PISO 45X45 A ALLURE BR HD 45 (2) PEI 4',
  'PISO 45X45 A ALLURE PT HD 45 (2) PEI 2',
  'PISO 45X45 A AMENDOA 45 (2) PEI 4 FORM',
  'PISO 45X45 A ARGUS HD 45 (2) PEI 4 GARN',
  'PISO 45X45 A ASTRA BG 45 (2) PEI 4 STA',
  'PISO 45X45 A (PD-45389) (2.32) ACET. BOL',
  'PISO 45X45 A CRISTAL AZUL 45 (2) GEOM. P',
  'PISO 45X45 A DELUX 45 (2) PEI 3 STAR GOL',
  'PISO 45X45 A DELUX CL 45 (2) PEI 3 STAR',
  'PISO 45X45 A DESIGN ESM. (2.32)(PD-33010)',
  'PISO 45X45 A DESIGN ESM. (2.32)(PD-35709)',
  'PISO 45X45 A DESIGN ESM. (2.32)(PD-45029)',
  'PISO 45X45 A DESIGN ESM. (2.32)(PD-45079)',
  'PISO 45X45 A ETNA BG HD 45 (2) PEI 4 GRA',
  'PISO 45X45 A ETNA CZ HD 45 (2) PEI 4 GRAN',
  'PISO 45X45 A GLACIAL BG 45 (2) PEI 5 LE',
  'PISO 45X45 A GRIMES (2)(123241) ACETINAD',
  'PISO 45X45 A IMBUIA CL 45 (2) PEI 4 BRIL',
  'PISO 45X45 A IMBUIA M 45 (2) PEI 3 BRILH',
  'PISO 45X45 A MATRIX WHITE 45 (2) PEI 4 B',
  'PISO 45X45 A MINERALE HD 45 (2) PEI 3 JG',
  'PISO 45X45 A PASSARELA HD 45 (2) PEI 4',
  'PISO 45X45 A PLANALTO 45 (2) PEI 4 PR',
  'PISO 45X45 A SAUDI AZUL HD (2)(2064D) BR',
  'PISO 45X45 A SAUDI MADERA HD 45 (2) BRI',
  'PISO 45X45 A SHANGAI BEGE 45 (2) PEI 4 GR',
  'PISO 45X45 A SOL RED 45 (2) PEI 4 GARNIL',
  'PISO 45X45 A TRAVERTINO CINZA 45 (2) PEI',
  'PISO 45X45 A VITORIA (2)(1252PE) BRILHAN',
  'PISO 46X46 A AURORA BEGE (1.005101) (2',
  'PISO 46X46 A CARPINA DECK HD (2.3) PEI',
];

export function extractPdCode(desc) {
  const m = String(desc || '').match(/PD[- ]?(\d+)/i);
  return m ? `PD-${m[1]}` : '';
}

export function normFmtFromDesc(desc) {
  const m = String(desc || '').match(/(\d{2,3})\s*[xX]\s*(\d{2,3})/);
  return m ? `${m[1]}x${m[2]}`.toLowerCase() : '';
}

export function m2FromDesc(desc) {
  const m = String(desc || '').match(/\((\d+[,.]?\d*)\)/);
  return m ? m[1].replace(',', '.') : '';
}

export function precoCaixa(m2Caixa) {
  const m2 = parseFloat(String(m2Caixa).replace(',', '.')) || 0;
  if (!m2) return { preco_caixa: '—', preco_liquido_m2: PRECO_LIQUIDO_M2.toFixed(2) };
  const total = m2 * PRECO_LIQUIDO_M2;
  return {
    preco_caixa: total.toFixed(2),
    preco_liquido_m2: PRECO_LIQUIDO_M2.toFixed(2),
  };
}

/** Roteamento por fabricante (negócio esquenta). */
export function routeFabricante(desc, formato) {
  if (extractPdCode(desc) || /DESIGN ESM/i.test(desc)) return 'Incefra';
  if (/\bETNA\b/i.test(desc)) return 'Cecafi';
  if (/\bGRIMES\b/i.test(desc)) return 'Fioranno';
  if (formato === '46x46') return 'Cerbras';
  if (formato === '45x45') return 'Formigres';
  return null;
}

export function inEsquentaScope(formato) {
  return formato === '45x45' || formato === '46x46';
}
