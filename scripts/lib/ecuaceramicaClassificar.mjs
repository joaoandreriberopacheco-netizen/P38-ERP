/**
 * Classificação Ecuaceramica → linhas comerciais do template P38.
 * Mapeia campos em espanhol (Rectificado, Acabado, Tipología).
 */

function norm(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function classificarEcuaceramica(prod = {}) {
  const acab = norm(prod.acabamento);
  const rect = norm(prod.rectificado);
  const tip = norm(prod.tipologia);

  const isPolida = /brillante|pulido|polido/.test(acab) && !/satinado|mate/.test(acab);
  if (isPolida) {
    return {
      linha: 'polida',
      subtipo: 'polida',
      variante_lisa: null,
      rotulo: 'Polida',
      acabamento_label: 'Brilhante',
      confianca: 'alta',
      motivo: 'Acabado brillante/pulido',
    };
  }

  const isRetificada = rect === 'si' || rect === 'sí' || rect === 'yes';
  const linha = isRetificada ? 'retificada' : 'bold';

  let subtipo = 'lisa';
  let varianteLisa = null;
  let rotulo = 'Lisa';
  let acabamentoLabel = 'Satinado';

  if (/mate|satinado/.test(acab)) acabamentoLabel = /mate/.test(acab) && !/satinado/.test(acab) ? 'Mate' : 'Satinado';
  else if (/brillante/.test(acab)) acabamentoLabel = 'Brilhante';
  else if (acab) acabamentoLabel = prod.acabamento;

  if (/maderado|madera|wood/.test(tip)) {
    subtipo = 'lisa';
    varianteLisa = 'madeira';
    rotulo = 'Madeira';
  } else if (/marmol|marmoleado|marble/.test(tip)) {
    subtipo = 'lisa';
    varianteLisa = 'marmore';
    rotulo = 'Marmoreado';
  } else if (/cemento|concreto|urban/.test(tip)) {
    subtipo = 'lisa';
    varianteLisa = 'cimento';
    rotulo = 'Cimento';
  } else if (/piedra|stone|ardesia/.test(tip)) {
    subtipo = 'lisa';
    varianteLisa = 'pedra';
    rotulo = 'Pedra';
  } else if (/metal|oxido|óxido/.test(tip)) {
    subtipo = 'lisa';
    varianteLisa = 'metal';
    rotulo = 'Metal';
  }

  return {
    linha,
    subtipo,
    variante_lisa: varianteLisa,
    rotulo,
    acabamento_label: acabamentoLabel,
    confianca: prod.rectificado || prod.acabamento ? 'alta' : 'media',
    motivo: isRetificada ? 'Rectificado si' : 'Bold (não retificado)',
  };
}

export function resumirClassificacoes(rows) {
  const porLinha = {};
  const porFormato = {};
  for (const r of rows) {
    porLinha[r.linha || '?'] = (porLinha[r.linha || '?'] || 0) + 1;
    porFormato[r.formato || '?'] = (porFormato[r.formato || '?'] || 0) + 1;
  }
  return { porLinha, porFormato, total: rows.length };
}
