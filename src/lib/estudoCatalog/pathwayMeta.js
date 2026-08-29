/** Pathway ·N / ·C / ·R — papéis dentro do core (Excel AB, Legenda A-B). */

export const PATHWAY_PAPEL_LABEL = {
  nucleo: 'Núcleo',
  complemento: 'Complementos',
  receita: 'Receita pronta',
  default: 'Geral',
};

export const PATHWAY_PAPEL_ORDER = {
  nucleo: 10,
  receita: 20,
  complemento: 30,
  default: 90,
};

export function parsePathwayFromLinhaCell(linhaCell) {
  const linha_raw = String(linhaCell || '').trim();
  const match = linha_raw.match(/^(.*)·([NRC])$/i);
  if (!match) {
    return {
      linha_raw,
      linha_display: linha_raw.replace(/·[NRC]$/i, '').trim() || linha_raw,
      pathway_sufixo: '',
      pathway_papel: 'default',
    };
  }
  const sufixo = match[2].toUpperCase();
  const pathway_papel = { N: 'nucleo', C: 'complemento', R: 'receita' }[sufixo] || 'default';
  return {
    linha_raw,
    linha_display: match[1].trim(),
    pathway_sufixo: sufixo,
    pathway_papel,
  };
}

export function linhaPathwayKey(linhaCodigo, pathwaySufixo) {
  const cod = String(linhaCodigo || '').trim();
  const suf = String(pathwaySufixo || '').trim().toUpperCase();
  return suf ? `${cod}::${suf}` : cod;
}

export function pathwayPapelLabel(papel) {
  return PATHWAY_PAPEL_LABEL[papel] || PATHWAY_PAPEL_LABEL.default;
}
