/**
 * Modelo 3×3: ETAPA > CATEGORIA > LINHA + Comp1·Comp2·Comp3
 *
 * Etapas (Cat drill 1): Edificações · Instalações · Acabamentos · Transversal
 */

export const ETAPA = {
  EDIFICACOES: 'Edificações',
  INSTALACOES: 'Instalações',
  ACABAMENTOS: 'Acabamentos',
  TRANSVERSAL: 'Transversal',
  DIVERSOS: 'Diversos',
};

export function linhaBase(linha = '') {
  return String(linha ?? '').replace(/·[NRC]$/i, '').trim();
}

export function cellStr(value) {
  if (value == null) return '';
  if (typeof value === 'object' && value.result != null) return String(value.result).trim();
  return String(value).trim();
}

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/** Match exact token or produto/sku phrase — evita falso positivo (ex.: DR dentro de HIDRÁULICA). */
function pcMatch(row, patterns = []) {
  const pc = norm(row.produto_compra);
  const sku = norm(row.sku_atual || row.novo_sku);
  const linha = norm(linhaBase(row.linha));
  return patterns.some((p) => {
    const n = norm(p);
    return pc.includes(n) || sku.includes(n) || linha === n || linha.startsWith(`${n} `);
  });
}

const CORES_HID = new Set(['ESGOTO', 'AGUA_FRIA_SOLDAVEL', 'AGUA_FRIA_ROSCAVEL', 'HIDRAULICA_GERAL']);
const CORES_ELE = new Set(['PADRAO_ELETRICO', 'INFRA_ELETRICA', 'QUADRO_ELETRICO', 'PONTOS_ELETRICOS', 'ILUMINACAO']);

const ETAPAS_EDIFICACOES = new Set([
  '1 — Estrutura / alvenaria',
  '2 — Cobertura',
]);

export function isRevestimentos(row) {
  const etapa = String(row.etapa ?? '').trim();
  const core = String(row.core ?? '').trim();
  return etapa === '4 — Revestimentos' || core === 'ASSENTAMENTO_CERAMICA';
}

export function isForro(row) {
  if (pcMatch(row, ['FORRO PVC', 'PERFIL DE PVC', 'PERFIL PVC'])) return true;
  return norm(linhaBase(row.linha)).includes('FORRO');
}

export function isPerfilForro(row) {
  return pcMatch(row, ['PERFIL DE PVC', 'PERFIL PVC']);
}

export function isPintura(row) {
  const core = String(row.core ?? '').trim();
  if (core === 'PINTURA_OBRA') return true;
  if (pcMatch(row, ['TINTA', 'THINNER', 'LATEX', 'LÁTEX', 'ESMALTE', 'VERNIZ', 'ADITIVO PLASTIFICANTE'])) return true;
  const lb = norm(linhaBase(row.linha));
  return lb.includes('PINTURA') || lb === 'THINNER';
}

export function isPortasEsquadrias(row) {
  const core = String(row.core ?? '').trim();
  if (core === 'ESQUADRIAS') return true;
  if (pcMatch(row, ['PORTA MADEIRA', 'PORTA MDF', 'DOBRADIÇA', 'DOBRADICA', 'FECHADURA', 'MACANETA', 'MAÇANETA'])) return true;
  if (norm(row.produto_compra).startsWith('PORTA ') && !norm(row.produto_compra).includes('PORTA-CADEADO')) return true;
  return norm(linhaBase(row.linha)).includes('ESQUADRIA');
}

export function isBanheiro(row) {
  const etapa = String(row.etapa ?? '').trim();
  const core = String(row.core ?? '').trim();
  return etapa === '5 — Áreas molhadas' || core === 'BANHEIRO';
}

export function isImpermeabilizacao(row) {
  return String(row.core ?? '').trim() === 'IMPERMEABILIZACAO';
}

export function isHidraulica(row) {
  const core = String(row.core ?? '').trim();
  const linha = linhaBase(row.linha);
  if (CORES_HID.has(core)) return true;
  if (['SOLDÁVEL', 'ESGOTO', 'ROSCÁVEL', 'HIDRÁULICA'].includes(linha)) return true;
  return false;
}

export function isEletricaInstalacao(row) {
  if (isHidraulica(row)) return false;
  const etapa = String(row.etapa ?? '').trim();
  const core = String(row.core ?? '').trim();
  const linha = linhaBase(row.linha);
  if (CORES_ELE.has(core)) return true;
  if (etapa === '3 — Instalações brutas' && ['ELETRODUTO', 'FIOS ELÉTRICOS', 'MATERIAL ELÉTRICO'].includes(linha)) return true;
  if (etapa === '7 — Instalação elétrica') return true;
  if (pcMatch(row, [
    'CAIXINHA DE LUZ',
    'CAIXA DE LUZ',
    'DISJUNTOR',
    'ELETRODUTO',
    'FIOS ELÉTRICOS',
    'CABO FLEX',
    'FIO ELÉTRICO',
    'FIO PARALELO',
  ])) return true;
  return false;
}

export function isEletricaVisivel(row) {
  if (isEletricaInstalacao(row)) return false;
  if (pcMatch(row, ['TOMADA', 'INTERRUPTOR', 'LAMPADA', 'LÂMPADA', 'LUMINÁRIA', 'LUMINARIA', 'PLAFON'])) return true;
  const core = String(row.core ?? '').trim();
  return ['ILUMINACAO', 'PONTOS_ELETRICOS'].includes(core)
    && !pcMatch(row, ['CAIXINHA DE LUZ', 'CAIXA DE LUZ', 'PLACA CEGA', 'TAPA-FURO']);
}

export function isEdificacoes(row) {
  const etapa = String(row.etapa ?? '').trim();
  if (!ETAPAS_EDIFICACOES.has(etapa)) return false;
  return !isForro(row);
}

function isAbHidraulica(abHit) {
  return abHit?.sub && /0[1-5]|Soldável|Esgoto|Roscável|Captação|Componentes/i.test(abHit.sub)
    && !/0[6-9]|Padrão|Quadro|Caixas/i.test(abHit.sub);
}

function isAbEletrica(abHit) {
  return abHit?.sub && /0[6-9]|Padrão|Infra|Quadro|Caixas/i.test(abHit.sub);
}

function linhaFromAbSubEletrica(subBloco) {
  const s = String(subBloco ?? '');
  if (/06|Padrão/i.test(s)) return 'Padrão';
  if (/07|Infra/i.test(s)) return 'Infra';
  if (/08|Quadro/i.test(s)) return 'Quadro';
  if (/09|Caixas/i.test(s)) return 'Caixas de espera';
  return 'Infra';
}

export function deriveLinhaEletrica(row, abHit) {
  if (abHit?.sub && isAbEletrica(abHit)) return linhaFromAbSubEletrica(abHit.sub);
  const core = String(row.core ?? '').trim();
  if (core === 'PADRAO_ELETRICO') return 'Padrão';
  if (core === 'QUADRO_ELETRICO') return 'Quadro';
  if (core === 'INFRA_ELETRICA' || ['ELETRODUTO', 'FIOS ELÉTRICOS'].includes(linhaBase(row.linha))) return 'Infra';
  if (pcMatch(row, ['CAIXINHA DE LUZ', 'CAIXA DE LUZ', 'PLACA CEGA', 'TAPA-FURO'])) return 'Caixas de espera';
  if (core === 'PONTOS_ELETRICOS') return 'Caixas de espera';
  return 'Infra';
}

export function deriveLinhaHidraulica(row, abHit) {
  if (abHit?.sub && isAbHidraulica(abHit)) {
    const s = String(abHit.sub);
    if (/01|Soldável/i.test(s)) return 'Soldável';
    if (/02|Esgoto/i.test(s)) return 'Esgoto';
    if (/03|Roscável/i.test(s)) return 'Roscável';
    if (/04|Captação/i.test(s)) return 'Captação';
    if (/05|Componentes/i.test(s)) return 'Componentes';
  }
  const core = String(row.core ?? '').trim();
  const linha = linhaBase(row.linha);
  if (core === 'AGUA_FRIA_SOLDAVEL' || linha === 'SOLDÁVEL') return 'Soldável';
  if (core === 'ESGOTO' || linha === 'ESGOTO') return 'Esgoto';
  if (core === 'AGUA_FRIA_ROSCAVEL' || linha === 'ROSCÁVEL') return 'Roscável';
  if (pcMatch(row, ["CAIXA D'ÁGUA", 'CAIXA D AGUA', 'ADAPTADOR CAIXA', 'POÇO', 'POCO'])) return 'Captação';
  return 'Componentes';
}

export function deriveCategoriaEdificacoes(row) {
  const etapa = String(row.etapa ?? '').trim();
  if (etapa === '1 — Estrutura / alvenaria') return '01. Alvenaria';
  if (etapa === '2 — Cobertura') return '02. Cobertura';
  return '01. Alvenaria';
}

export function deriveLinhaEdificacoes(row) {
  const core = String(row.core ?? '').trim();
  const map = {
    ARMADURA: 'Armaduras',
    ALVENARIA: 'Alvenaria',
    COBERTURA: 'Cobertura',
    FERRAGEM_GERAL: 'Ferragem',
    FIXACAO: 'Fixação',
  };
  if (map[core]) return map[core];
  const lb = linhaBase(row.linha);
  if (lb && lb !== 'DIVERSOS') return lb.charAt(0) + lb.slice(1).toLowerCase();
  return '(sem linha)';
}

/**
 * @param {object} row
 * @param {{ bloco?: string, sub?: string, core?: string }} [abHit]
 * @returns {{ etapa: string, categoria: string, linha: string }}
 */
export function classify3x3(row, abHit) {
  if (isRevestimentos(row)) {
    return { etapa: ETAPA.ACABAMENTOS, categoria: '01. Revestimentos', linha: 'Cerâmica' };
  }
  if (isForro(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: '02. Forro',
      linha: isPerfilForro(row) ? 'Perfis' : 'Forro PVC',
    };
  }
  if (isPintura(row)) {
    return { etapa: ETAPA.ACABAMENTOS, categoria: '03. Pintura', linha: 'Pintura' };
  }
  if (isPortasEsquadrias(row)) {
    return { etapa: ETAPA.ACABAMENTOS, categoria: '04. Portas', linha: 'Esquadrias' };
  }
  if (isImpermeabilizacao(row)) {
    return { etapa: ETAPA.ACABAMENTOS, categoria: '06. Impermeabilização', linha: 'Impermeabilização' };
  }
  if (isBanheiro(row)) {
    return { etapa: ETAPA.ACABAMENTOS, categoria: '05. Áreas molhadas', linha: 'Banheiro' };
  }
  if (isEletricaVisivel(row)) {
    return { etapa: ETAPA.ACABAMENTOS, categoria: '07. Elétrica visível', linha: 'Pontos visíveis' };
  }

  // Instalações — hidráulica antes de elétrica
  if (isHidraulica(row) || isAbHidraulica(abHit)) {
    return {
      etapa: ETAPA.INSTALACOES,
      categoria: '01. Hidráulica',
      linha: deriveLinhaHidraulica(row, abHit),
    };
  }

  if (isEletricaInstalacao(row) || isAbEletrica(abHit)) {
    return {
      etapa: ETAPA.INSTALACOES,
      categoria: '02. Elétrica',
      linha: deriveLinhaEletrica(row, abHit),
    };
  }

  if (isEdificacoes(row) || (abHit?.bloco && String(abHit.bloco).startsWith('A'))) {
    return {
      etapa: ETAPA.EDIFICACOES,
      categoria: deriveCategoriaEdificacoes(row),
      linha: deriveLinhaEdificacoes(row),
    };
  }

  if (String(row.etapa ?? '').trim() === '8 — Transversal') {
    return {
      etapa: ETAPA.TRANSVERSAL,
      categoria: '01. Transversal',
      linha: deriveLinhaEdificacoes(row),
    };
  }

  return { etapa: ETAPA.DIVERSOS, categoria: '(sem categoria)', linha: '(sem linha)' };
}

/** @param {object} row @param {{ bloco?: string, sub?: string, core?: string }} [abHit] */
export function to3x3(row, abHit) {
  const { etapa, categoria, linha } = classify3x3(row, abHit);
  return {
    etapa,
    categoria,
    linha,
    comp1: cellStr(row.produto_compra),
    comp2: cellStr(row.eixo_a),
    comp3: cellStr(row.eixo_b),
    codigo_interno: cellStr(row.codigo_interno).toUpperCase(),
    novo_sku: cellStr(row.novo_sku),
    sku_atual: cellStr(row.sku_atual),
    etapa_origem: cellStr(row.etapa),
    core_origem: cellStr(row.core),
    linha_origem: cellStr(row.linha),
  };
}
