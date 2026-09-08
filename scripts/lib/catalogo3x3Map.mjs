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
  HIDRAULICA: '05. Hidráulica',
  ELETRICA: '06. Elétrica',
};

/** Subcategorias de acabamento — função (não ambiente). */
export const SUB_ACAB_HID = {
  PONTOS_AGUA: 'Pontos de água',
  CUBAS: 'Cubas',
  LOUCAS: 'Louças sanitárias',
  CHUVEIROS: 'Chuveiros',
  METAIS: 'Metais e acessórios',
};

export const SUB_ACAB_ELE = {
  ILUMINACAO: 'Iluminação',
  PONTOS_ELETRICOS: 'Pontos elétricos',
};

export const ETAPA = {
  EDIFICACOES: 'a. Edificações',
  INSTALACOES: 'b. Instalações',
  ACABAMENTOS: 'c. Acabamentos',
  TRANSVERSAL: 'd. Transversal',
  DIVERSOS: 'e. Diversos',
};

const CATEGORIAS_UNIFICAR_HID = new Set([CATEGORIA_ACAB.HIDRAULICA]);
const CATEGORIAS_UNIFICAR_ELE = new Set([CATEGORIA_ACAB.ELETRICA]);

/** Linha intermédia 3×3: subcategoria|linha (expandTo4x3 faz o split). */
function acabLinha(subcategoria, linha) {
  return `${subcategoria}|${linha}`;
}

function parseAcabLinha(linha = '') {
  const parts = String(linha ?? '').split('|');
  if (parts.length !== 2) return null;
  return { subcategoria: parts[0].trim(), linha: parts[1].trim() };
}

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

/** Compacta comp2/comp3: se comp2 vazio, comp3 passa para comp2. */
const SUFIXOS_PRODUTO_CONEXAO = new Set(['CURTA', 'LONGA', 'MISTA', 'MISTO', 'ESGOTO']);
const COMPRIMENTOS_VERGALHAO = /^(0?6M|12M)$/i;

function comp1ContainsToken(comp1, token) {
  const c1 = norm(comp1);
  const t = norm(token);
  return c1 === t || c1.endsWith(` ${t}`) || c1.includes(` ${t} `) || c1.startsWith(`${t} `);
}

function isVergalhao(comp1 = '') {
  return norm(comp1) === 'VERGALHAO';
}

/** Reservatório (não adaptador, caixa de descarga, elétrica…). */
function isCaixaDAguaReservatorio(comp1 = '') {
  const c1 = norm(comp1).replace(/['\s]+/g, ' ').trim();
  return c1 === 'CAIXA D AGUA';
}

function mergeMarcaComp1(c1, c2, c3, marca) {
  if (marca && !comp1ContainsToken(c1, marca)) {
    c1 = `${c1} ${marca}`.trim();
  }
  if (marca && norm(c3) === norm(marca)) c3 = '';
  if (marca && norm(c2) === norm(marca)) {
    c2 = c3;
    c3 = '';
  }
  return { comp1: c1, comp2: c2, comp3: c3 };
}

function mergeSufixoProduto(c1, c2, c3) {
  if (!c2) return { comp1: c1, comp2: c2, comp3: c3 };
  if (!comp1ContainsToken(c1, c2)) {
    c1 = `${c1} ${c2}`.trim();
  }
  return { comp1: c1, comp2: c3, comp3: '' };
}

export function normalizeComponentes(comp1, comp2, comp3) {
  let c1 = cellStr(comp1);
  let c2 = cellStr(comp2);
  let c3 = cellStr(comp3);

  // Conexões: sufixo do produto (ex. CURTA em CURVA ESGOTO) entra no comp1; medida fica no comp2.
  if (c2 && SUFIXOS_PRODUTO_CONEXAO.has(norm(c2))) {
    ({ comp1: c1, comp2: c2, comp3: c3 } = mergeSufixoProduto(c1, c2, c3));
  }

  // Vergalhão: 12M / 06M são produtos de compra distintos; diâmetro fica no comp2.
  if (isVergalhao(c1) && c2 && COMPRIMENTOS_VERGALHAO.test(c2.trim())) {
    ({ comp1: c1, comp2: c2, comp3: c3 } = mergeSufixoProduto(c1, c2, c3));
  }

  // Caixas d'água — produto de compra canónico: CAIXA D'ÁGUA FORTLEV; volume no comp2.
  if (isCaixaDAguaReservatorio(c1)) {
    ({ comp1: c1, comp2: c2, comp3: c3 } = mergeMarcaComp1(c1, c2, c3, 'FORTLEV'));
  }

  if (!c2 && c3) {
    c2 = c3;
    c3 = '';
  }
  return { comp1: c1, comp2: c2, comp3: c3 };
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

/** Gama comercial — Premium vs Pop (47 torneiras no core). */
export function deriveLinhaTorneiraGama(row) {
  const pc = norm(row.produto_compra);
  if (
    pc.includes('MONOCOMANDO')
    || pc.includes('COZINHA')
    || pc.includes('PURIFICADOR')
    || pc.includes('BICA')
  ) {
    return 'Torneiras Premium';
  }
  return 'Torneiras Pop';
}

export function deriveAmbiente(row) {
  if (isTorneira(row)) {
    const lb = deriveLinhaTorneira(row);
    if (lb.includes('cozinha')) return 'Cozinha';
    if (lb.includes('serviço')) return 'Área de serviço';
    return 'Banheiro';
  }
  if (isCuba(row)) return isCubaCozinha(row) ? 'Cozinha' : 'Banheiro';
  if (isLoucasSanitarias(row)) {
    const pc = norm(row.produto_compra);
    if (pc.includes('TANQUE')) return 'Área de serviço';
    return 'Banheiro';
  }
  if (isChuveiroAcabamento(row)) return 'Banheiro';
  if (isBanheiro(row)) return 'Banheiro';
  return '';
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
  if (norm(linhaBase(row.linha)).includes('METAL')) return 'Metais sanitários';
  return 'Acessórios';
}

export function isLoucasSanitarias(row) {
  if (pcMatch(row, [
    'VASO SANITARIO',
    'VASO SANITÁRIO',
    'PRIVADA',
    'ASSENTO SANITARIO',
    'ASSENTO SANITÁRIO',
    'CAIXA DE DESCARGA',
    'TUBO DESCARGA',
    'MICTORIO',
    'MICTÓRIO',
    'LAVATORIO',
    'LAVATÓRIO',
    'BANHEIRA',
    'TANQUE DECORALITA',
  ])) return true;
  return norm(linhaBase(row.linha)).includes('LOUCA') || norm(linhaBase(row.linha)).includes('LOUÇA');
}

/** Vaso convencional + tubo de descarga — mesmo grupo comercial. */
export function isVasoConvencionalGrupo(row) {
  const pc = norm(row.produto_compra);
  const ea = norm(row.eixo_a);
  if (pc.includes('TUBO DESCARGA')) return true;
  return pc.includes('VASO SANIT') && ea.includes('CONVENCIONAL');
}

export function deriveLinhaLoucasAcab(row) {
  if (isVasoConvencionalGrupo(row)) return 'Vaso convencional';
  const pc = norm(row.produto_compra);
  const ea = norm(row.eixo_a);
  if (pc.includes('VASO SANIT') && ea.includes('CAIXA ACOPLADA')) return 'Vaso caixa acoplada';
  if (pc.includes('CAIXA DE DESCARGA')) return 'Caixa de descarga';
  if (pc.includes('ASSENTO SANIT')) return 'Assentos sanitários';
  if (pc.includes('MICTORIO') || pc.includes('MICTÓRIO')) return 'Mictório';
  if (pc.includes('LAVATORIO') || pc.includes('LAVATÓRIO')) return 'Lavatório';
  if (pc.includes('BANHEIRA')) return 'Banheira';
  return SUB_ACAB_HID.LOUCAS;
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

export function isAdaptadorCaixaAgua(row) {
  return pcMatch(row, ["ADAPTADOR CAIXA D'ÁGUA", 'ADAPTADOR CAIXA D AGUA', 'ADAPTADOR CAIXA']);
}

/** Caixas d'água marca GREEN — descontinuadas (substituídas por FORTLEV no mix). */
export function isCaixaAguaGreen(row) {
  if (!pcMatch(row, ["CAIXA D'ÁGUA", 'CAIXA D AGUA'])) return false;
  const sku = norm(row.sku_atual || row.novo_sku || '');
  return sku.includes('GREEN');
}

/** SKUs excluídos do catálogo activo (descontinuados). */
export function isSkuDescontinuado(row) {
  return isCaixaAguaGreen(row);
}

export function deriveLinhaHidraulica(row, abHit) {
  let linha;
  if (isAdaptadorCaixaAgua(row)) {
    linha = 'Soldável';
  }
  if (!linha && abHit?.sub && isAbHidraulica(abHit)) {
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
    else if (pcMatch(row, ["CAIXA D'ÁGUA", 'CAIXA D AGUA', 'POÇO', 'POCO'])) linha = 'Captação';
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
      categoria: CATEGORIA_ACAB.ELETRICA,
      linha: acabLinha(SUB_ACAB_ELE.ILUMINACAO, deriveLinhaIluminacao(row)),
    };
  }
  if (isPontosEletricos(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.ELETRICA,
      linha: acabLinha(SUB_ACAB_ELE.PONTOS_ELETRICOS, deriveLinhaPontosEletricos(row)),
    };
  }
  if (isTorneira(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.HIDRAULICA,
      linha: acabLinha(SUB_ACAB_HID.PONTOS_AGUA, deriveLinhaTorneiraGama(row)),
    };
  }
  if (isCuba(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.HIDRAULICA,
      linha: acabLinha(SUB_ACAB_HID.CUBAS, SUB_ACAB_HID.CUBAS),
    };
  }
  if (isLoucasSanitarias(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.HIDRAULICA,
      linha: acabLinha(SUB_ACAB_HID.LOUCAS, deriveLinhaLoucasAcab(row)),
    };
  }
  if (isChuveiroAcabamento(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.HIDRAULICA,
      linha: acabLinha(SUB_ACAB_HID.CHUVEIROS, SUB_ACAB_HID.CHUVEIROS),
    };
  }
  if (isBanheiro(row)) {
    return {
      etapa: ETAPA.ACABAMENTOS,
      categoria: CATEGORIA_ACAB.HIDRAULICA,
      linha: acabLinha(SUB_ACAB_HID.METAIS, deriveLinhaMetais(row)),
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
  if (categoria === CATEGORIA_ACAB.HIDRAULICA || categoria === CATEGORIA_ACAB.ELETRICA) {
    const parsed = parseAcabLinha(lb);
    if (parsed) return parsed;
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
  const comps = normalizeComponentes(row.produto_compra, row.eixo_a, row.eixo_b);
  return {
    ...classified,
    etapa_u: unified.etapa,
    categoria_u: unified.categoria,
    subcategoria_u: unified.subcategoria,
    linha_u: unified.linha,
    ...comps,
    codigo_interno: cellStr(row.codigo_interno).toUpperCase(),
    novo_sku: cellStr(row.novo_sku),
    sku_atual: cellStr(row.sku_atual),
    etapa_origem: cellStr(row.etapa),
    core_origem: cellStr(row.core),
    linha_origem: cellStr(row.linha),
    ambiente: deriveAmbiente(row),
    categoria_3x: legacy3.categoria,
    linha_3x: legacy3.linha,
  };
}

/** @param {object} row @param {{ bloco?: string, sub?: string, core?: string }} [abHit] */
export function to3x3(row, abHit) {
  const classified = classify3x3(row, abHit);
  const unified = unify3x3(classified);
  const comps = normalizeComponentes(row.produto_compra, row.eixo_a, row.eixo_b);
  return {
    ...classified,
    etapa_u: unified.etapa,
    categoria_u: unified.categoria,
    linha_u: unified.linha,
    ...comps,
    codigo_interno: cellStr(row.codigo_interno).toUpperCase(),
    novo_sku: cellStr(row.novo_sku),
    sku_atual: cellStr(row.sku_atual),
    etapa_origem: cellStr(row.etapa),
    core_origem: cellStr(row.core),
    linha_origem: cellStr(row.linha),
  };
}
