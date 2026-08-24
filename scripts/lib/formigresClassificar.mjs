/**
 * Classificação Formigres → linha comercial (Bold / Retificada / Polida)
 * e superfície (antiderrapante, semiderrapante, lisa mate/brilhante).
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

/** Inferência a partir da descrição Tintão / Excel quando não há match no catálogo. */
export function inferirDaDescricao(descricao = '') {
  const raw = String(descricao || '').toUpperCase();
  const hints = {
    lista_polidos: /RT\s*POLIDO|\bPOLIDO\b/.test(raw),
    retificada: /\bRT\b|RETIFICAD/.test(raw),
    bold: /\bHD\b|\bBOLD\b/.test(raw) && !/\bRT\b/.test(raw),
    antiderrapante: /\bAD\b|ADERENTE|ABS\b|MATE\s*ABS|GRANILHADO\s*ABS/.test(raw),
    semiderrapante: /GRANILHAD|GOTEJAD|SEMIDERRAP/.test(raw) && !/ABS/.test(raw),
    mate: /\bMATE\b|\bMAT\b/.test(raw),
    brilhante: /BRILH/.test(raw),
    polido: /RT\s*POLIDO|\bPOLIDO\b/.test(raw),
  };
  return hints;
}

/**
 * @param {{ tipo?: string, acabamento?: string, titulo?: string, descricao?: string, lista?: string }} input
 */
export function classificarFormigres(input = {}) {
  const tipo = normTipo(input.tipo);
  const acab = normAcab(input.acabamento);
  const titulo = normTitulo(input.titulo || input.descricao);
  const desc = normTitulo(input.descricao);
  const hints = inferirDaDescricao(desc);

  const isPolida = acab === 'POLIDO'
    || hints.polido
    || hints.lista_polidos
    || input.lista === 'polidos'
    || /RT\s*POLIDO|\bPOLIDO\b/.test(titulo);

  if (isPolida) {
    return {
      linha: 'polida',
      subtipo: 'polida',
      variante_lisa: null,
      rotulo: 'Polida',
      confianca: input.tipo || input.acabamento ? 'alta' : 'media',
      motivo: acab === 'POLIDO' ? 'acabamento POLIDO' : 'título/lista polida',
    };
  }

  const isRetificada = tipo.includes('RETIFICAD')
    || hints.retificada
    || /\bRT\b/.test(titulo)
    || input.lista?.includes('retific');

  const isBold = tipo === 'BOLD'
    || hints.bold
    || (!isRetificada && (tipo === '' || tipo.includes('BOLD')));

  const linha = isRetificada ? 'retificada' : (isBold ? 'bold' : 'desconhecida');

  let subtipo = null;
  let varianteLisa = null;
  let motivo = '';
  let confianca = 'alta';

  const textoAcab = `${acab} ${titulo} ${desc}`;

  if (/PROTETIVA\s*ADERENTE|GRANILHADO\s*ABS|MATE\s*ABS/.test(textoAcab)
    || (/\bABS\b/.test(textoAcab) && /GRANILHAD|MATE|EXT/.test(textoAcab))
    || /ADERENTE/.test(textoAcab)
    || hints.antiderrapante) {
    subtipo = 'antiderrapante';
    motivo = acab ? `acabamento ${acab}` : 'hint descrição (aderente/ABS)';
  } else if (acab === 'GRANILHADO' || acab === 'GOTEJADO'
    || (/GRANILHAD|GOTEJAD/.test(titulo) && !/\bABS\b/.test(textoAcab))
    || hints.semiderrapante) {
    subtipo = 'semiderrapante';
    motivo = acab ? `acabamento ${acab}` : 'hint descrição (granilhado/gotejado)';
  } else if (acab === 'BRILHANTE' || acab === 'MATE' || hints.mate || hints.brilhante) {
    subtipo = 'lisa';
    if (acab === 'MATE' || hints.mate) varianteLisa = 'mate';
    else if (acab === 'BRILHANTE' || hints.brilhante) varianteLisa = 'brilhante';
    motivo = acab ? `acabamento ${acab}` : 'hint descrição (mate/brilhante)';
  } else if (linha === 'desconhecida') {
    confianca = 'baixa';
    motivo = 'sem tipo/acabamento reconhecido';
  } else {
    confianca = 'media';
    motivo = 'linha inferida; superfície não identificada';
  }

  let rotulo;
  if (linha === 'bold') {
    rotulo = subtipo === 'lisa' ? 'Bold — lisa' : `Bold — ${subtipo || '?'}`;
  } else if (linha === 'retificada') {
    if (subtipo === 'lisa' && varianteLisa) {
      rotulo = `Retificada — lisa ${varianteLisa}`;
    } else {
      rotulo = subtipo ? `Retificada — ${subtipo}` : 'Retificada — ?';
    }
  } else {
    rotulo = 'Desconhecida';
  }

  return {
    linha,
    subtipo,
    variante_lisa: varianteLisa,
    rotulo,
    confianca,
    motivo,
  };
}

/** Agrupa contagens para relatório. */
export function resumirClassificacoes(rows) {
  const porRotulo = {};
  const porLinha = {};
  const detalhe = {
    bold: { antiderrapante: 0, semiderrapante: 0, lisa: 0 },
    retificada: { antiderrapante: 0, semiderrapante: 0, lisa_mate: 0, lisa_brilhante: 0, lisa: 0 },
    polida: 0,
    desconhecida: 0,
  };

  for (const row of rows) {
    const key = row.rotulo || 'sem_classificacao';
    porRotulo[key] = (porRotulo[key] || 0) + 1;
    const linha = row.linha || 'desconhecida';
    porLinha[linha] = (porLinha[linha] || 0) + 1;

    if (linha === 'bold' && row.subtipo && detalhe.bold[row.subtipo] != null) {
      detalhe.bold[row.subtipo] += 1;
    } else if (linha === 'retificada' && row.subtipo) {
      if (row.subtipo === 'lisa' && row.variante_lisa) {
        detalhe.retificada[`lisa_${row.variante_lisa}`] += 1;
      } else if (detalhe.retificada[row.subtipo] != null) {
        detalhe.retificada[row.subtipo] += 1;
      }
    } else if (linha === 'polida') {
      detalhe.polida += 1;
    } else if (linha === 'desconhecida') {
      detalhe.desconhecida += 1;
    }
  }

  return { porRotulo, porLinha, detalhe, total: rows.length };
}
