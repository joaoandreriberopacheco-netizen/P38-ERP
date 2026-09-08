/**
 * Modelo 3×3: ETAPA > CATEGORIA > LINHA + Comp1·Comp2·Comp3
 *
 * Etapas (drill 1): a. Edificações · b. Instalações · c. Acabamentos · d. Transversal
 */

export const ETAPA = {
  EDIFICACOES: 'a. Edificações',
  INSTALACOES: 'b. Instalações',
  ACABAMENTOS: 'c. Acabamentos',
  TRANSVERSAL: 'd. Transversal',
  DIVERSOS: 'e. Diversos',
};

const CATEGORIAS_UNIFICAR_HID = new Set(['05. Banheiro']);
const CATEGORIAS_UNIFICAR_ELE = new Set(['07. Iluminação', '08. Pontos elétricos']);

export function etapaSemPrefixo(etapa = '') {
  return String(etapa ?? '').replace(/^[a-e]\.\s*/i, '').trim();
}

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
const CORES_ELE_INSTALACAO = new Set(['PADRAO_ELETRICO', 'INFRA_ELETRICA', 'QUADRO_ELETRICO']);

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

export function isTorneira(row) {
  return pcMatch(row, ['TORNEIRA']);
}

export function isCuba(row) {
  const pc = norm(row.produto_compra);
  return pc.startsWith('CUBA') || pc.includes('CUBA DE APOIO') || pc.includes('CUBA EMBUTIR');
}

export function isLoucasSanitarias(row) {
  if (pcMatch(row, [
    'VASO SANITARIO',
    'VASO SANITÁRIO',
    'PRIVADA',
    'ASSENTO SANITARIO',
    'ASSENTO SANITÁRIO',
    'CAIXA DE DESCARGA',
    'MICTORIO',
    'MICTÓRIO',
    'PIA',
    'LAVATORIO',
    'LAVATÓRIO',
    'BANHEIRA',
    'TANQUE DECORALITA',
  ])) return true;
  return norm(linhaBase(row.linha)).includes('LOUCA') || norm(linhaBase(row.linha)).includes('LOUÇA');
}

export function isChuveiroAcabamento(row) {
  return pcMatch(row, ['CHUVEIRO', 'DUCHA HIGIENICA', 'DUCHA HIGIÊNICA', 'AQUECEDOR'])
    && !pcMatch(row, ['RESISTÊNCIA', 'RESISTENCIA']);
}

/** Lâmpadas, luminárias, plugs — acabamento visível de iluminação. */
export function isIluminacao(row) {
  if (pcMatch(row, ['CAIXINHA DE LUZ', 'CAIXA DE LUZ', 'PLACA CEGA', 'TAPA-FURO'])) return false;
  if (pcMatch(row, [
    'LAMPADA',
    'LÁMPADA',
    'LUMINÁRIA',
    'LUMINARIA',
    'PLAFON',
    'SPOT LED',
    'PLUG MACHO',
    'PLUG FEMEA',
    'PLUG FÊMEA',
  ])) return true;
  const core = String(row.core ?? '').trim();
  const lb = norm(linhaBase(row.linha));
  return core === 'ILUMINACAO' || lb.includes('ILUMIN');
}

/** Tomadas e interruptores — acabamento visível de pontos. */
export function isPontosEletricos(row) {
  if (pcMatch(row, ['CAIXINHA DE LUZ', 'CAIXA DE LUZ', 'PLACA CEGA', 'TAPA-FURO'])) return false;
  if (pcMatch(row, ['TOMADA', 'INTERRUPTOR'])) return true;
  const core = String(row.core ?? '').trim();
  return core === 'PONTOS_ELETRICOS';
}

/** @deprecated use isIluminacao / isPontosEletricos */
export function isAcabamentoEletricoVisivel(row) {
  return isIluminacao(row) || isPontosEletricos(row);
}

export function deriveLinhaIluminacao(row) {
  const pc = norm(row.produto_compra);
  if (pc.includes('LAMPADA') || pc.includes('LÂMPADA')) return 'Lâmpadas';
  if (pc.includes('LUMINÁRIA') || pc.includes('LUMINARIA') || pc.includes('PLAFON') || pc.includes('SPOT')) {
    return 'Luminárias';
  }
  if (pc.includes('PLUG')) return 'Plugs e acessórios';
  const core = String(row.core ?? '').trim();
  if (core === 'ILUMINACAO') return 'Lâmpadas';
  return 'Iluminação';
}

export function deriveLinhaPontosEletricos(row) {
  const pc = norm(row.produto_compra);
  if (pc.includes('TOMADA') && pc.includes('INTERRUPTOR')) return 'Combinados';
  if (pc.includes('TOMADA')) return 'Tomadas';
  if (pc.includes('INTERRUPTOR')) return 'Interruptores';
  const core = String(row.core ?? '').trim();
  if (core === 'PONTOS_ELETRICOS') return 'Tomadas';
  return 'Pontos elétricos';
}

export function deriveLinhaBanheiro(row) {
  if (isChuveiroAcabamento(row)) return 'Chuveiros';
  if (norm(linhaBase(row.linha)).includes('METAL')) return 'Metais sanitários';
  return 'Acessórios';
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
  if (isIluminacao(row) || isPontosEletricos(row)) return false;
  const etapa = String(row.etapa ?? '').trim();
  const core = String(row.core ?? '').trim();
  const linha = linhaBase(row.linha);
  if (CORES_ELE_INSTALACAO.has(core)) return true;
  if (etapa === '3 — Instalações brutas' && ['ELETRODUTO', 'FIOS ELÉTRICOS', 'MATERIAL ELÉTRICO'].includes(linha)) return true;
  if (etapa === '7 — Instalação elétrica' && ['ELETRODUTO', 'FIOS ELÉTRICOS', 'MATERIAL ELÉTRICO'].includes(linha)) return true;
  if (pcMatch(row, [
    'CAIXINHA DE LUZ',
    'CAIXA DE LUZ',
    'DISJUNTOR',
    'ELETRODUTO',
    'CONDUITE',
    'FIO ELÉTRICO',
    'FIO PARALELO',
    'CABO FLEX',
    'CABO PP',
    'QUADRO DE DISTRIB',
    'PONTALETE',
    'ISOLADOR',
    'BORNE',
    'CONECTOR',
    'TERMINAL',
    'EMENDA',
  ])) return true;
  return false;
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
  if (/06|Padrão/i.test(s)) return 'Padrão de entrada';
  if (/07|Infra/i.test(s)) return 'Infraestrutura';
  if (/08|Quadro/i.test(s)) return 'Quadros e disjuntores';
  if (/09|Caixas/i.test(s)) return 'Caixas de espera';
  return 'Infraestrutura';
}

export function deriveLinhaEletrica(row, abHit) {
  if (pcMatch(row, ['DISJUNTOR', 'QUADRO DE DISTRIB', 'QUADRO DE DISTRIBUIÇÃO', 'QUADRO DE DISTRIBUICAO'])) {
    return 'Quadros e disjuntores';
  }
  if (pcMatch(row, [
    'ELETRODUTO',
    'BUCHA ELETRODUTO',
    'CURVA ELETRODUTO',
    'ARRUELA ELETRODUTO',
    'LUVA ELETRODUTO',
    'ADAPTADOR ELETRODUTO',
  ])) return 'Eletroduto';
  if (pcMatch(row, [
    'FIO ELÉTRICO',
    'FIO PARALELO',
    'CABO FLEX',
    'CABO PP',
    'CABO DE FORÇA',
    'CABO MULTIPOLAR',
    'CABO',
  ])) return 'Fios e cabos';
  if (pcMatch(row, ['CONDUITE'])) return 'Conduítes';
  if (pcMatch(row, ['CAIXINHA DE LUZ', 'CAIXA DE LUZ', 'PLACA CEGA', 'TAPA-FURO'])) return 'Caixas de espera';
  if (pcMatch(row, [
    'PONTALETE',
    'ISOLADOR',
    'BENJAMIN',
    'HASTE ATERR',
    'DR ',
    'PADRAO DE ENTRADA',
    'PADRÃO DE ENTRADA',
  ])) return 'Padrão de entrada';
  if (pcMatch(row, ['BORNE', 'CONECTOR', 'EMENDA', 'TERMINAL', 'LIGAÇÃO', 'LIGACAO', 'REGLET'])) return 'Ligações';

  if (abHit?.sub && isAbEletrica(abHit)) return linhaFromAbSubEletrica(abHit.sub);

  const core = String(row.core ?? '').trim();
  if (core === 'PADRAO_ELETRICO') return 'Padrão de entrada';
  if (core === 'QUADRO_ELETRICO') return 'Quadros e disjuntores';
  if (core === 'INFRA_ELETRICA') {
    const lb = linhaBase(row.linha);
    if (lb === 'ELETRODUTO') return 'Eletroduto';
    if (lb === 'FIOS ELÉTRICOS') return 'Fios e cabos';
    return 'Infraestrutura';
  }
  return 'Infraestrutura';
}

const LINHAS_HID_CANOS_CONEXOES = new Set(['Soldável', 'Esgoto', 'Roscável']);

/** Canos e conexões — prefixo c&c nas linhas soldável, esgoto e roscável. */
export function linhaHidraulicaComPrefixo(linha) {
  if (LINHAS_HID_CANOS_CONEXOES.has(linha)) return `c&c ${linha}`;
  return linha;
}

export function deriveLinhaHidraulica(row, abHit) {
  let linha;
  if (abHit?.sub && isAbHidraulica(abHit)) {
    const s = String(abHit.sub);
    if (/01|Soldável/i.test(s)) linha = 'Soldável';
    else if (/02|Esgoto/i.test(s)) linha = 'Esgoto';
    else if (/03|Roscável/i.test(s)) linha = 'Roscável';
    else if (/04|Captação/i.test(s)) linha = 'Captação';
    else if (/05|Componentes/i.test(s)) linha = 'Componentes';
  }
  if (!linha) {
    const core = String(row.core ?? '').trim();
    const lb = linhaBase(row.linha);
    if (core === 'AGUA_FRIA_SOLDAVEL' || lb === 'SOLDÁVEL') linha = 'Soldável';
    else if (core === 'ESGOTO' || lb === 'ESGOTO') linha = 'Esgoto';
    else if (core === 'AGUA_FRIA_ROSCAVEL' || lb === 'ROSCÁVEL') linha = 'Roscável';
    else if (pcMatch(row, ["CAIXA D'ÁGUA", 'CAIXA D AGUA', 'ADAPTADOR CAIXA', 'POÇO', 'POCO'])) linha = 'Captação';
    else linha = 'Componentes';
  }
  return linhaHidraulicaComPrefixo(linha);
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
 * Colapsa acabamentos de domínio (banheiro, iluminação, pontos) para Instalações.
 * Revestimentos, forro, pintura, portas e impermeabilização mantêm c. Acabamentos.
 *
 * @param {{ etapa: string, categoria: string, linha: string }} classified
 */
export function unify3x3(classified) {
  const base = etapaSemPrefixo(classified.etapa);
  if (base === 'Acabamentos') {
    if (CATEGORIAS_UNIFICAR_HID.has(classified.categoria)) {
      return {
        etapa: ETAPA.INSTALACOES,
        categoria: '01. Hidráulica',
        linha: classified.linha,
      };
    }
    if (CATEGORIAS_UNIFICAR_ELE.has(classified.categoria)) {
      return {
        etapa: ETAPA.INSTALACOES,
        categoria: '02. Elétrica',
        linha: classified.linha,
      };
    }
  }
  return { ...classified };
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
  if (isIluminacao(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: '07. Iluminação',
      linha: deriveLinhaIluminacao(row),
    };
  }
  if (isPontosEletricos(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: '08. Pontos elétricos',
      linha: deriveLinhaPontosEletricos(row),
    };
  }
  if (isTorneira(row)) {
    return { etapa: ETAPA.ACABAMENTOS, categoria: '05. Banheiro', linha: 'Torneiras' };
  }
  if (isCuba(row)) {
    return { etapa: ETAPA.ACABAMENTOS, categoria: '05. Banheiro', linha: 'Cubas' };
  }
  if (isLoucasSanitarias(row)) {
    return { etapa: ETAPA.ACABAMENTOS, categoria: '05. Banheiro', linha: 'Louças sanitárias' };
  }
  if (isBanheiro(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: '05. Banheiro',
      linha: deriveLinhaBanheiro(row),
    };
  }

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
  const classified = classify3x3(row, abHit);
  const unified = unify3x3(classified);
  return {
    ...classified,
    etapa_u: unified.etapa,
    categoria_u: unified.categoria,
    linha_u: unified.linha,
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
