/**
 * Classificação de uso PEI na descrição SIAH (LA … LE).
 */
const ORDEM = ['LEI', 'LCI', 'LA', 'LB', 'LC', 'LD', 'LE'];

/** Códigos de uso (resistência) — não são textura/acabamento de catálogo. */
export const PEI_USO_CLASSES = ['LA', 'LB', 'LC', 'LD', 'LE', 'LCI', 'LEI'];

export function isClasseUsoPei(token = '') {
  const t = String(token || '').trim().toUpperCase().replace(/^PEI\s+/, '');
  return PEI_USO_CLASSES.includes(t);
}

export function extrairClassificacaoPei(descricao = '') {
  const u = String(descricao || '').toUpperCase();
  const m = u.match(/\bPEI\s+(LEI|LCI|LA|LB|LC|LD|LE)\b/);
  if (m) return m[1];
  for (const c of ORDEM) {
    if (new RegExp(`\\b${c}\\b`).test(u)) return c;
  }
  return '';
}

export function referenciaResistenciaCatalogo(descricao, classificacaoSite = '') {
  const erp = extrairClassificacaoPei(descricao);
  const uso = String(classificacaoSite || '').trim().toUpperCase();
  const code = erp || uso;
  if (!code) return '';
  return code.startsWith('PEI') ? code : `PEI ${code}`;
}
