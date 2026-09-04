/**
 * Tabela de preços Formigres por formato e linha (Cerâmica vs Premium).
 */
import { normFmt } from './formigresCatalog.mjs';

/** 87×87 ≈ 88×88 no catálogo web. */
const FORMATO_ALIASES = {
  '87x87': '88x88',
};

const CERAMICA_BASE = {
  '45x45': 13.9,
  '32x45': 13.9,
  '50x50': 13.9,
  '61x61': 14.9,
  '34x60': 14.9,
};

const CERAMICA_RT = {
  '60x60': 15.9,
  '33x59': 15.9,
};

const PREMIUM_MATE = {
  '66x66': 17.9,
  '88x88': 23.9,
  '60x120': 23.9,
  '20x120': 23.9,
};

const PREMIUM_POLIDO = {
  '32x66': 24.9,
  '66x66': 27.9,
  '88x88': 33.9,
  '60x120': 33.9,
};

export const TABELA_FORMIGRES_META = {
  tipo: 'formigres-tabela-m2',
};

function normFormato(raw) {
  let fmt = normFmt(raw);
  if (FORMATO_ALIASES[fmt]) fmt = FORMATO_ALIASES[fmt];
  return fmt;
}

function normUpper(s) {
  return String(s || '').trim().toUpperCase();
}

function isRetificada(prod, classif) {
  const tipo = normUpper(prod.tipo);
  const titulo = normUpper(prod.titulo);
  return classif.linha === 'retificada'
    || tipo.includes('RETIFICAD')
    || /\bRT\b/.test(titulo);
}

function isPolida(prod, classif) {
  const acab = normUpper(prod.acabamento);
  const titulo = normUpper(prod.titulo);
  return classif.linha === 'polida'
    || acab === 'POLIDO'
    || /RT\s*POLIDO|\bPOLIDO\b/.test(titulo);
}

function isMate(prod, classif) {
  const acab = normUpper(prod.acabamento);
  return acab === 'MATE'
    || classif.variante_lisa === 'mate'
    || (classif.subtipo === 'lisa' && acab !== 'POLIDO' && acab !== 'BRILHANTE');
}

/**
 * @returns {{ preco: number|null, faixa: string|null, motivo?: string }}
 */
export function resolvePrecoFormigres(prod, classif) {
  const fmt = normFormato(prod.formato || prod.titulo);
  if (!fmt) return { preco: null, faixa: null, motivo: 'sem-formato' };

  const rt = isRetificada(prod, classif);
  const polida = isPolida(prod, classif);
  const mate = isMate(prod, classif);

  if (polida && PREMIUM_POLIDO[fmt] != null) {
    return { preco: PREMIUM_POLIDO[fmt], faixa: 'premium-polido' };
  }
  if (mate && PREMIUM_MATE[fmt] != null) {
    return { preco: PREMIUM_MATE[fmt], faixa: 'premium-mate' };
  }
  if (rt && CERAMICA_RT[fmt] != null) {
    return { preco: CERAMICA_RT[fmt], faixa: 'ceramica-rt' };
  }
  if (CERAMICA_BASE[fmt] != null) {
    return { preco: CERAMICA_BASE[fmt], faixa: 'ceramica' };
  }

  // Formatos próximos da tabela (81×81 ≈ premium 88×88; 60×60 bold ≈ cerâmica)
  if (fmt === '81x81') {
    if (polida) return { preco: PREMIUM_POLIDO['88x88'], faixa: 'premium-polido-inferido' };
    if (mate) return { preco: PREMIUM_MATE['88x88'], faixa: 'premium-mate-inferido' };
    return { preco: PREMIUM_MATE['88x88'], faixa: 'premium-mate-inferido' };
  }
  if (fmt === '60x60' && !rt) {
    return { preco: CERAMICA_BASE['61x61'], faixa: 'ceramica-inferido' };
  }
  if (fmt === '20x60') {
    return { preco: CERAMICA_BASE['34x60'], faixa: 'ceramica-inferido' };
  }
  if (fmt === '43x88' || fmt === '40x81') {
    return { preco: PREMIUM_MATE['60x120'], faixa: 'premium-mate-inferido' };
  }

  return { preco: null, faixa: null, motivo: 'fora-tabela' };
}
