/**
 * Classificação Arielle (Carmelo Fior):
 * - Linha comercial: só Bold ou Retificada (atributo "Acabamento" / tipo BOLD|RETIFICADO).
 * - Superfície (Polida, Mate, Brilhante, Granilhado…): acabamento para agrupamento e preço.
 */

function normTipo(tipo) {
  return String(tipo || '').trim().toUpperCase();
}

function normAcab(acabamento) {
  return String(acabamento || '').trim().toUpperCase();
}

function normTitulo(titulo) {
  return String(titulo || '').trim().toUpperCase();
}

/** Código interno → rótulo legível no catálogo. */
export function labelAcabamentoArielle(code = '') {
  const acab = normAcab(code);
  if (acab === 'POLIDO') return 'Polida';
  if (acab === 'BRILHANTE') return 'Brilhante';
  if (acab === 'MATE') return 'Mate';
  if (acab.includes('GRANILH') || acab.includes('ABS')) return 'Granilhado';
  if (!acab) return 'Sem acabamento';
  return acab.charAt(0) + acab.slice(1).toLowerCase();
}

/**
 * @param {{ tipo?: string, acabamento?: string, titulo?: string, descricao?: string }} input
 */
export function classificarArielle(input = {}) {
  const tipo = normTipo(input.tipo);
  const acab = normAcab(input.acabamento);
  const titulo = normTitulo(input.titulo || input.descricao);

  const isRetificada = tipo.includes('RETIFICAD') || /\bRT\b/.test(titulo);
  const linha = isRetificada ? 'retificada' : 'bold';

  let subtipo = null;
  let varianteLisa = null;
  let motivo = '';
  let confianca = 'alta';

  const textoAcab = `${acab} ${titulo}`;

  if (/GRANILHADO\s*ABS|MATE\s*ABS/.test(textoAcab)
    || (/\bABS\b/.test(textoAcab) && /GRANILHAD|MATE|EXT/.test(textoAcab))) {
    subtipo = 'antiderrapante';
    motivo = acab ? `superfície ${acab}` : 'granilhado ABS';
  } else if (acab === 'GRANILHADO' || acab.includes('GRANILH')) {
    subtipo = 'semiderrapante';
    motivo = acab ? `superfície ${acab}` : 'granilhado';
  } else if (acab === 'BRILHANTE' || acab === 'MATE') {
    subtipo = 'lisa';
    varianteLisa = acab === 'MATE' ? 'mate' : 'brilhante';
    motivo = `superfície ${acab}`;
  } else if (acab === 'POLIDO') {
    motivo = 'superfície polida';
  } else if (acab) {
    confianca = 'media';
    motivo = `linha ${linha}; superfície ${acab}`;
  } else {
    confianca = 'media';
    motivo = `linha ${linha}; superfície não informada`;
  }

  const linhaLabel = linha === 'bold' ? 'Bold' : 'Retificada';
  const acabamentoLabel = labelAcabamentoArielle(acab);
  const rotulo = acab ? `${linhaLabel} — ${acabamentoLabel}` : linhaLabel;

  return {
    linha,
    subtipo,
    variante_lisa: varianteLisa,
    rotulo,
    confianca,
    motivo,
    acabamento: acab,
    acabamento_label: acabamentoLabel,
  };
}

/** Agrupa contagens para relatório Arielle. */
export function resumirClassificacoesArielle(rows) {
  const porRotulo = {};
  const porLinha = {};
  const porAcabamento = {};

  for (const row of rows) {
    const rotulo = row.rotulo || 'sem_classificacao';
    porRotulo[rotulo] = (porRotulo[rotulo] || 0) + 1;

    const linha = row.linha || 'desconhecida';
    porLinha[linha] = (porLinha[linha] || 0) + 1;

    const acab = row.acabamento_label || labelAcabamentoArielle(row.formigres_acabamento);
    porAcabamento[acab] = (porAcabamento[acab] || 0) + 1;
  }

  return { porRotulo, porLinha, porAcabamento, total: rows.length };
}
