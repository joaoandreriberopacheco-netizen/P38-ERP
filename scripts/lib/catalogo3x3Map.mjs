/**
 * Modelo 3×3: ETAPA > CATEGORIA > LINHA + Comp1·Comp2·Comp3
 *
 * Etapas (drill 1): a. Edificações · b. Instalações · c. Acabamentos · d. Transversal
 */

export const CATEGORIA_ACAB = {
  REVESTIMENTOS: '01. Revestimentos',
  FORRO: '02. Forro',
  PINTURA: '03. Pintura',
  PORTAS: '04. Portas',
  TORNEIRAS: '05. Torneiras',
  CUBAS: '06. Cubas',
  LOUCAS: '07. Louças sanitárias',
  CHUVEIROS: '08. Chuveiros',
  METAIS: '09. Metais e acessórios',
  ILUMINACAO: '10. Iluminação',
  PONTOS_ELETRICOS: '11. Pontos elétricos',
};

export const ETAPA = {
  EDIFICACOES: 'a. Edificações',
  INSTALACOES: 'b. Instalações',
  ACABAMENTOS: 'c. Acabamentos',
  TRANSVERSAL: 'd. Transversal',
  DIVERSOS: 'e. Diversos',
};

const CATEGORIAS_UNIFICAR_HID = new Set([
  CATEGORIA_ACAB.TORNEIRAS,
  CATEGORIA_ACAB.CUBAS,
  CATEGORIA_ACAB.LOUCAS,
  CATEGORIA_ACAB.CHUVEIROS,
  CATEGORIA_ACAB.METAIS,
]);
const CATEGORIAS_UNIFICAR_ELE = new Set([
  CATEGORIA_ACAB.ILUMINACAO,
  CATEGORIA_ACAB.PONTOS_ELETRICOS,
]);

export function etapaSemPrefixo(etapa = '') {
  return String(etapa ?? '').replace(/^[a-e]\.\s*/i, '').trim();
}

const ETAPA_CODIGO_LETRA = {
  Edificações: 'A',
  Instalações: 'B',
  Acabamentos: 'C',
  Transversal: 'D',
  Diversos: 'E',
};

export function pathKey(etapa, categoria, linha) {
  return [etapa, categoria, linha].map((p) => String(p ?? '').trim()).join('\x00');
}

export function categoriaSemPrefixo(categoria = '') {
  return String(categoria ?? '').replace(/^\d+\.\s*/, '').trim() || String(categoria ?? '').trim();
}

/** Legenda legível: Edificações · Alvenaria · Armaduras */
export function legendaCaminho3x(etapa, categoria, linha) {
  const e = etapaSemPrefixo(etapa);
  const c = categoriaSemPrefixo(categoria);
  return `${e} · ${c} · ${linha}`;
}

function etapaCodigoLetra(etapa) {
  return ETAPA_CODIGO_LETRA[etapaSemPrefixo(etapa)] ?? 'Z';
}

function categoriaCodigoNumero(categoria) {
  const m = String(categoria ?? '').match(/^(\d{2})\./);
  if (m) return m[1];
  return '00';
}

function linhaCodigoLetra(indice) {
  const i = Math.max(0, Math.min(25, indice));
  return String.fromCharCode(65 + i);
}

/**
 * Gera códigos A01B para caminhos ETAPA · CATEGORIA · LINHA.
 * A = etapa · 01 = categoria · B = linha (ordem alfabética dentro da categoria).
 *
 * @param {Array<{ etapa: string, categoria: string, linha: string }>} paths
 * @returns {Map<string, string>}
 */
export function buildCodigosCaminho3x(paths) {
  const porGrupo = new Map();
  for (const p of paths) {
    const gk = pathKey(p.etapa, p.categoria);
    if (!porGrupo.has(gk)) porGrupo.set(gk, []);
    porGrupo.get(gk).push(p);
  }

  const registry = new Map();
  for (const grupo of porGrupo.values()) {
    const ordenado = [...grupo].sort((a, b) =>
      String(a.linha).localeCompare(String(b.linha), 'pt-BR', { sensitivity: 'base' }),
    );
    ordenado.forEach((p, i) => {
      const codigo = `${etapaCodigoLetra(p.etapa)}${categoriaCodigoNumero(p.categoria)}${linhaCodigoLetra(i)}`;
      registry.set(pathKey(p.etapa, p.categoria, p.linha), codigo);
    });
  }
  return registry;
}

export function lookupCodigoCaminho(registry, etapa, categoria, linha) {
  return registry.get(pathKey(etapa, categoria, linha)) ?? '';
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

export function isArgamassaRejunte(row) {
  return pcMatch(row, ['ARGAMASSA', 'REJUNTE', 'LIMPADOR DE REJUNTE']);
}

export function deriveLinhaRevestimentos(row) {
  const pc = norm(row.produto_compra);
  if (pc.includes('ARGAMASSA')) return 'Argamassa';
  if (pc.includes('REJUNTE') || pc.includes('LIMPADOR DE REJUNTE')) return 'Rejunte';
  return 'Cerâmica';
}

export function isRevestimentos(row) {
  if (isArgamassaRejunte(row)) return true;
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
  if (pcMatch(row, ['TINTA', 'THINNER', 'LATEX', 'LÁTEX', 'ESMALTE', 'VERNIZ'])) return true;
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
  if (pc.startsWith('PIA') && !pc.includes('LAVATORIO') && !pc.includes('LAVATÓRIO')) return true;
  return pc.startsWith('CUBA') || pc.includes('CUBA DE APOIO') || pc.includes('CUBA EMBUTIR');
}

export function isCubaCozinha(row) {
  const pc = norm(row.produto_compra);
  const eixo = norm(row.eixo_a);
  const blob = `${pc} ${eixo}`;
  return blob.includes('INOX') || blob.includes('COZINHA') || pc.startsWith('PIA');
}

export function deriveLinhaTorneira(row) {
  const pc = norm(row.produto_compra);
  if (pc.includes('COZINHA') || pc.includes('PURIFICADOR')) return 'Torneira cozinha';
  if (pc.includes('TANQUE') || pc.includes('PLASTICA')) return 'Torneira área de serviço';
  return 'Torneira banheiro';
}

export function deriveLinhaCuba(row) {
  if (isCubaCozinha(row)) return 'Cuba cozinha';
  return 'Cuba banheiro';
}

export function deriveLinhaLoucas(row) {
  const pc = norm(row.produto_compra);
  if (pc.includes('TANQUE')) return 'Louça área de serviço';
  return 'Louça banheiro';
}

export function deriveLinhaChuveiro() {
  return 'Chuveiro banheiro';
}

export function deriveLinhaMetais(row) {
  if (norm(linhaBase(row.linha)).includes('METAL')) return 'Metais banheiro';
  return 'Acessórios banheiro';
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
  if (pc.includes('PLUG')) return 'Plugs e acessórios';
  if (
    pc.includes('LAMPADA')
    || pc.includes('LÂMPADA')
    || pc.includes('LUMINÁRIA')
    || pc.includes('LUMINARIA')
    || pc.includes('PLAFON')
    || pc.includes('SPOT')
  ) {
    return 'Lâmpadas e luminárias';
  }
  const core = String(row.core ?? '').trim();
  if (core === 'ILUMINACAO') return 'Lâmpadas e luminárias';
  return 'Lâmpadas e luminárias';
}

export function deriveLinhaPontosEletricos(row) {
  const pc = norm(row.produto_compra);
  if (pc.includes('TOMADA') || pc.includes('INTERRUPTOR')) return 'Interruptores e tomadas';
  const core = String(row.core ?? '').trim();
  if (core === 'PONTOS_ELETRICOS') return 'Interruptores e tomadas';
  return 'Interruptores e tomadas';
}

export function isAditivosImpermeabilizante(row) {
  if (String(row.core ?? '').trim() === 'IMPERMEABILIZACAO') return true;
  return pcMatch(row, [
    'IMPERMEABILIZANTE',
    'MANTA LÍQUIDA',
    'MANTA LIQUIDA',
    'VEDACIT',
    'ADITIVO PLASTIFICANTE',
  ]);
}

/** @deprecated use isAditivosImpermeabilizante */
export function isImpermeabilizacao(row) {
  return isAditivosImpermeabilizante(row);
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

const LINHAS_CANOS_CONEXOES = new Set(['Soldável', 'Esgoto', 'Roscável', 'Eletroduto']);

/** Canos e conexões — prefixo c&c (hidráulica soldável/esgoto/roscável + elétrica eletroduto). */
export function linhaComPrefixoCnc(linha) {
  if (LINHAS_CANOS_CONEXOES.has(linha)) return `c&c ${linha}`;
  return linha;
}

/** @deprecated use linhaComPrefixoCnc */
export function linhaHidraulicaComPrefixo(linha) {
  return linhaComPrefixoCnc(linha);
}

export function deriveLinhaEletrica(row, abHit) {
  let linha;
  if (pcMatch(row, ['DISJUNTOR', 'QUADRO DE DISTRIB', 'QUADRO DE DISTRIBUIÇÃO', 'QUADRO DE DISTRIBUICAO'])) {
    linha = 'Quadros e disjuntores';
  } else if (pcMatch(row, [
    'ELETRODUTO',
    'BUCHA ELETRODUTO',
    'CURVA ELETRODUTO',
    'ARRUELA ELETRODUTO',
    'LUVA ELETRODUTO',
    'ADAPTADOR ELETRODUTO',
  ])) {
    linha = 'Eletroduto';
  } else if (pcMatch(row, [
    'FIO ELÉTRICO',
    'FIO PARALELO',
    'CABO FLEX',
    'CABO PP',
    'CABO DE FORÇA',
    'CABO MULTIPOLAR',
    'CABO',
  ])) {
    linha = 'Fios e cabos';
  } else if (pcMatch(row, ['CONDUITE'])) {
    linha = 'Conduítes';
  } else if (pcMatch(row, ['CAIXINHA DE LUZ', 'CAIXA DE LUZ', 'PLACA CEGA', 'TAPA-FURO'])) {
    linha = 'Caixas de espera';
  } else if (pcMatch(row, [
    'PONTALETE',
    'ISOLADOR',
    'BENJAMIN',
    'HASTE ATERR',
    'DR ',
    'PADRAO DE ENTRADA',
    'PADRÃO DE ENTRADA',
  ])) {
    linha = 'Padrão de entrada';
  } else if (pcMatch(row, ['BORNE', 'CONECTOR', 'EMENDA', 'TERMINAL', 'LIGAÇÃO', 'LIGACAO', 'REGLET'])) {
    linha = 'Ligações';
  } else if (abHit?.sub && isAbEletrica(abHit)) {
    linha = linhaFromAbSubEletrica(abHit.sub);
  } else {
    const core = String(row.core ?? '').trim();
    if (core === 'PADRAO_ELETRICO') linha = 'Padrão de entrada';
    else if (core === 'QUADRO_ELETRICO') linha = 'Quadros e disjuntores';
    else if (core === 'INFRA_ELETRICA') {
      const lb = linhaBase(row.linha);
      if (lb === 'ELETRODUTO') linha = 'Eletroduto';
      else if (lb === 'FIOS ELÉTRICOS') linha = 'Fios e cabos';
      else linha = 'Infraestrutura';
    } else {
      linha = 'Infraestrutura';
    }
  }
  return linhaComPrefixoCnc(linha);
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
  return linhaComPrefixoCnc(linha);
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
 * Revestimentos, forro, pintura, portas mantêm c. Acabamentos.
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
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.REVESTIMENTOS,
      linha: deriveLinhaRevestimentos(row),
    };
  }
  if (isAditivosImpermeabilizante(row)) {
    return {
      etapa: ETAPA.EDIFICACOES,
      categoria: '01. Alvenaria',
      linha: 'Aditivos e impermeabilizante',
    };
  }
  if (isForro(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.FORRO,
      linha: isPerfilForro(row) ? 'Perfis' : 'Forro PVC',
    };
  }
  if (isPintura(row)) {
    return { etapa: ETAPA.ACABAMENTOS, categoria: CATEGORIA_ACAB.PINTURA, linha: 'Pintura' };
  }
  if (isPortasEsquadrias(row)) {
    return { etapa: ETAPA.ACABAMENTOS, categoria: CATEGORIA_ACAB.PORTAS, linha: 'Esquadrias' };
  }
  if (isIluminacao(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.ILUMINACAO,
      linha: deriveLinhaIluminacao(row),
    };
  }
  if (isPontosEletricos(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.PONTOS_ELETRICOS,
      linha: deriveLinhaPontosEletricos(row),
    };
  }
  if (isTorneira(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.TORNEIRAS,
      linha: deriveLinhaTorneira(row),
    };
  }
  if (isCuba(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.CUBAS,
      linha: deriveLinhaCuba(row),
    };
  }
  if (isLoucasSanitarias(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.LOUCAS,
      linha: deriveLinhaLoucas(row),
    };
  }
  if (isChuveiroAcabamento(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.CHUVEIROS,
      linha: deriveLinhaChuveiro(),
    };
  }
  if (isBanheiro(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.METAIS,
      linha: deriveLinhaMetais(row),
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

function stripPrefixoCnc(linha = '') {
  return String(linha).replace(/^c&c\s+/i, '').trim();
}

/** Expande classificação 3×3 para subcategoria + linha (modelo 4×3). */
export function expandTo4x3({ etapa, categoria, linha }) {
  const lb = String(linha ?? '').trim();

  if (lb === 'Aditivos e impermeabilizante') {
    return { subcategoria: 'Aditivos', linha: 'Impermeabilizante' };
  }
  if (categoria === '01. Alvenaria' && lb === 'Alvenaria') {
    return { subcategoria: 'Materiais', linha: 'Alvenaria' };
  }
  if (categoria === '01. Alvenaria' && lb === 'Armaduras') {
    return { subcategoria: 'Estrutura', linha: 'Armaduras' };
  }
  if (categoria === '01. Hidráulica' && lb.startsWith('c&c')) {
    return { subcategoria: 'Canos e conexões', linha: stripPrefixoCnc(lb) };
  }
  if (categoria === '01. Hidráulica') {
    return { subcategoria: lb, linha: lb };
  }
  if (categoria === '02. Elétrica' && (lb.startsWith('c&c') || lb === 'Conduítes')) {
    return {
      subcategoria: 'Canos e conexões',
      linha: lb.startsWith('c&c') ? stripPrefixoCnc(lb) : lb,
    };
  }
  if (categoria === '02. Elétrica' && lb === 'Fios e cabos') {
    return { subcategoria: 'Condutores', linha: 'Fios e cabos' };
  }
  if (categoria === '02. Elétrica' && lb === 'Quadros e disjuntores') {
    return { subcategoria: 'Quadros', linha: 'Quadros e disjuntores' };
  }
  if (categoria === '02. Elétrica' && lb === 'Caixas de espera') {
    return { subcategoria: 'Infra de pontos', linha: 'Caixas de espera' };
  }
  if (categoria === '02. Elétrica' && lb === 'Padrão de entrada') {
    return { subcategoria: 'Padrão', linha: 'Padrão de entrada' };
  }
  if (categoria === '02. Elétrica') {
    return { subcategoria: lb, linha: lb };
  }
  if (categoria === CATEGORIA_ACAB.REVESTIMENTOS) {
    return { subcategoria: 'Assentamento', linha: lb };
  }
  if (categoria === CATEGORIA_ACAB.FORRO) {
    return { subcategoria: 'Forro', linha: lb };
  }
  if (categoria === CATEGORIA_ACAB.PINTURA) {
    return { subcategoria: 'Pintura', linha: lb };
  }
  if (categoria === CATEGORIA_ACAB.PORTAS) {
    return { subcategoria: 'Esquadrias', linha: lb };
  }
  if (lb === 'Torneira banheiro') return { subcategoria: 'Banheiro', linha: 'Torneiras' };
  if (lb === 'Torneira cozinha') return { subcategoria: 'Cozinha', linha: 'Torneiras' };
  if (lb === 'Torneira área de serviço') return { subcategoria: 'Área de serviço', linha: 'Torneiras' };
  if (lb === 'Cuba banheiro') return { subcategoria: 'Banheiro', linha: 'Cubas' };
  if (lb === 'Cuba cozinha') return { subcategoria: 'Cozinha', linha: 'Cubas' };
  if (lb === 'Louça banheiro') return { subcategoria: 'Banheiro', linha: 'Louças sanitárias' };
  if (lb === 'Louça área de serviço') return { subcategoria: 'Área de serviço', linha: 'Louças sanitárias' };
  if (lb === 'Chuveiro banheiro') return { subcategoria: 'Banheiro', linha: 'Chuveiros' };
  if (lb === 'Metais banheiro') return { subcategoria: 'Banheiro', linha: 'Metais sanitários' };
  if (lb === 'Acessórios banheiro') return { subcategoria: 'Banheiro', linha: 'Acessórios' };
  if (categoria === CATEGORIA_ACAB.ILUMINACAO) {
    return { subcategoria: 'Iluminação', linha: lb };
  }
  if (categoria === CATEGORIA_ACAB.PONTOS_ELETRICOS) {
    return { subcategoria: 'Pontos', linha: lb };
  }
  if (categoria === '02. Cobertura') {
    return { subcategoria: 'Cobertura', linha: lb };
  }
  if (categoria === '01. Transversal') {
    return { subcategoria: 'Transversal', linha: lb };
  }
  if (categoria === '(sem categoria)') {
    return { subcategoria: '(sem subcategoria)', linha: lb };
  }
  return { subcategoria: categoriaSemPrefixo(categoria), linha: lb };
}

export function classify4x3(row, abHit) {
  const base = classify3x3(row, abHit);
  const expanded = expandTo4x3(base);
  return {
    etapa: base.etapa,
    categoria: base.categoria,
    subcategoria: expanded.subcategoria,
    linha: expanded.linha,
  };
}

export function legendaCaminho4x(etapa, categoria, subcategoria, linha) {
  const e = etapaSemPrefixo(etapa);
  const c = categoriaSemPrefixo(categoria);
  return `${e} · ${c} · ${subcategoria} · ${linha}`;
}

export function pathKey4(etapa, categoria, subcategoria, linha) {
  return [etapa, categoria, subcategoria, linha].map((p) => String(p ?? '').trim()).join('\x00');
}

export function buildCodigosCaminho4x(paths) {
  const byEtapaCat = new Map();
  for (const p of paths) {
    const gk = pathKey(p.etapa, p.categoria);
    if (!byEtapaCat.has(gk)) byEtapaCat.set(gk, []);
    byEtapaCat.get(gk).push(p);
  }

  const registry = new Map();
  for (const grupo of byEtapaCat.values()) {
    const subs = [...new Set(grupo.map((p) => p.subcategoria))].sort((a, b) =>
      String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' }),
    );
    subs.forEach((sub, si) => {
      const linhas = [...new Set(grupo.filter((p) => p.subcategoria === sub).map((p) => p.linha))].sort((a, b) =>
        String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' }),
      );
      linhas.forEach((linha, li) => {
        const sample = grupo.find((p) => p.subcategoria === sub && p.linha === linha);
        const codigo = `${etapaCodigoLetra(sample.etapa)}${categoriaCodigoNumero(sample.categoria)}${linhaCodigoLetra(si)}${linhaCodigoLetra(li)}`;
        registry.set(pathKey4(sample.etapa, sample.categoria, sub, linha), codigo);
      });
    });
  }
  return registry;
}

export function lookupCodigoCaminho4x(registry, etapa, categoria, subcategoria, linha) {
  return registry.get(pathKey4(etapa, categoria, subcategoria, linha)) ?? '';
}

/**
 * Colapsa acabamentos de domínio para Instalações (modelo 4×3).
 * @param {{ etapa: string, categoria: string, subcategoria: string, linha: string }} classified
 */
export function unify4x3(classified) {
  const base = etapaSemPrefixo(classified.etapa);
  if (base === 'Acabamentos') {
    if (CATEGORIAS_UNIFICAR_HID.has(classified.categoria)) {
      return {
        etapa: ETAPA.INSTALACOES,
        categoria: '01. Hidráulica',
        subcategoria: classified.subcategoria,
        linha: classified.linha,
      };
    }
    if (CATEGORIAS_UNIFICAR_ELE.has(classified.categoria)) {
      return {
        etapa: ETAPA.INSTALACOES,
        categoria: '02. Elétrica',
        subcategoria: classified.subcategoria,
        linha: classified.linha,
      };
    }
  }
  return { ...classified };
}

/** @param {object} row @param {{ bloco?: string, sub?: string, core?: string }} [abHit] */
export function to4x3(row, abHit) {
  const classified = classify4x3(row, abHit);
  const unified = unify4x3(classified);
  const legacy3 = classify3x3(row, abHit);
  return {
    ...classified,
    etapa_u: unified.etapa,
    categoria_u: unified.categoria,
    subcategoria_u: unified.subcategoria,
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
    categoria_3x: legacy3.categoria,
    linha_3x: legacy3.linha,
  };
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
