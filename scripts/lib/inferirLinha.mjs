/**
 * Inferir LINHA de compra por chaves comuns (h2 primeiro, depois h1).
 * Ex.: JOELHO + SOLDÁVEL → linha SOLDÁVEL (não linha JOELHO).
 */

export function norm(s) {
  return String(s || '').trim().toUpperCase();
}

export function trim(s) {
  return String(s || '').trim();
}

/** LINHAS enxutas — agrupamento por chave comum, não por h1 isolado. */
export const LINHAS_MESTRE = [
  {
    ordem: 10,
    codigo: 'CIMENTO',
    nome: 'CIMENTO',
    tipo: 'solo',
    chave: 'h1 contém CIMENTO',
    notas: 'Sem grelha na 1ª fase',
  },
  {
    ordem: 20,
    codigo: 'ARGAMASSA',
    nome: 'ARGAMASSA',
    tipo: 'mix',
    chave: 'h1 = ARGAMASSA',
    notas: 'Classe × embalagem (eixos depois)',
  },
  {
    ordem: 30,
    codigo: 'CERAMICA',
    nome: 'CERÂMICA / PISO / REVESTIMENTO',
    tipo: 'portfolio',
    chave: 'h1 = PISO | PORCELANATO | REVESTIMENTO',
    notas: 'Formato × modelo',
  },
  {
    ordem: 40,
    codigo: 'SOLDAVEL',
    nome: 'SOLDÁVEL',
    tipo: 'mix',
    chave: 'h2 = SOLDÁVEL ou h1 contém SOLDÁVEL (JOELHO, LUVA, TE, ADAPTADOR…)',
    notas: 'Peça (produto compra) × medida — eixos depois',
  },
  {
    ordem: 50,
    codigo: 'ESGOTO',
    nome: 'ESGOTO',
    tipo: 'mix',
    chave: 'h2 = ESGOTO ou h1 contém ESGOTO',
    notas: 'Tubos e conexões esgoto',
  },
  {
    ordem: 60,
    codigo: 'ROSCAVEL',
    nome: 'ROSCÁVEL',
    tipo: 'mix',
    chave: 'h2 = ROSCÁVEL ou h1 contém ROSC',
    notas: 'Conexões roscáveis',
  },
  {
    ordem: 70,
    codigo: 'TINTA',
    nome: 'TINTA & VERNIZ',
    tipo: 'portfolio',
    chave: 'h1 = TINTA | VERNIZ | TINTA SPRAY | THINNER | SELADOR',
    notas: 'Apresentação × cor (eixos depois)',
  },
  {
    ordem: 80,
    codigo: 'MASSA',
    nome: 'MASSA CORRIDA / ACRÍLICA',
    tipo: 'mix',
    chave: 'h1 contém MASSA CORRIDA ou MASSA ACR',
    notas: '',
  },
  {
    ordem: 90,
    codigo: 'REJUNTE',
    nome: 'REJUNTE',
    tipo: 'mix',
    chave: 'h1 contém REJUNTE',
    notas: 'Marca × cor',
  },
  {
    ordem: 100,
    codigo: 'HIDRAULICA',
    nome: 'TORNEIRA & METAIS SANITÁRIOS',
    tipo: 'portfolio',
    chave: 'h1 TORNEIRA, CHUVEIRO, REGISTRO, VÁLVULA, CAIXA D\'ÁGUA…',
    notas: 'Aplicação × modelo (template futuro)',
  },
  {
    ordem: 110,
    codigo: 'FIXACAO',
    nome: 'PREGO & PARAFUSO',
    tipo: 'mix',
    chave: 'h1 = PREGO | PARAFUSO',
    notas: '',
  },
  {
    ordem: 120,
    codigo: 'ELETRICA',
    nome: 'MATERIAL ELÉTRICO',
    tipo: 'mix',
    chave: 'DISJUNTOR, LÂMPADA, CABO, FIO, ELETRODUTO, TOMADA…',
    notas: '',
  },
  {
    ordem: 130,
    codigo: 'FERRAGEM',
    nome: 'FERRAGEM',
    tipo: 'mix',
    chave: 'FECHADURA, DOBRADIÇA, PUXADOR…',
    notas: '',
  },
  {
    ordem: 140,
    codigo: 'IMPERMEABILIZACAO',
    nome: 'IMPERMEABILIZANTE & ADESIVO',
    tipo: 'mix',
    chave: 'h1 IMPERMEAB | ADESIVO | COLA',
    notas: '',
  },
  {
    ordem: 900,
    codigo: 'OUTROS',
    nome: 'OUTROS / A CLASSIFICAR',
    tipo: 'solo',
    chave: 'sem chave clara — IA + massa',
    notas: '',
  },
];

const HIDRAULICA_H1 = [
  'TORNEIRA', 'CHUVEIRO', 'REGISTRO', 'REGISTRO ESFERA', 'VALVULA', 'VÁLVULA',
  'ASSENTO SANITÁRIO', 'MONOCOMANDO', 'CAIXA DE DESCARGA', 'MISTURADOR',
  'TORNEIRA DE MESA', 'TORNEIRA P/ LAVATÓRIO', 'DUCHA', "CAIXA D'ÁGUA", 'CAIXA D AGUA',
];

const ELETRICA_H1 = [
  'DISJUNTOR', 'LAMPADA', 'LÂMPADA', 'LUMINÁRIA', 'CABO', 'TOMADA', 'INTERRUPTOR',
  'CORANTE', 'SOQUETE', 'REATOR', 'FIO ELÉTRICO', 'FIO PARALELO', 'ELETRODUTO',
];

const FERRAGEM_H1 = ['FECHADURA', 'DOBRADIÇA', 'PUXADOR', 'TRINCO', 'FECHO'];

function h1(p) {
  return norm(p.campo_hierarquico_1);
}

function h2(p) {
  return norm(p.campo_hierarquico_2);
}

function h1starts(p, prefix) {
  return h1(p).startsWith(norm(prefix)) || h1(p).includes(norm(prefix));
}

/**
 * @returns {string} codigo da linha
 */
export function inferirLinhaCodigo(produto) {
  const n2 = h2(produto);
  const n1 = h1(produto);

  // Chaves h2 primeiro (agrupa h1 diferentes na mesma linha)
  if (n2 === 'SOLDÁVEL' || n2 === 'SOLDAVEL') return 'SOLDAVEL';
  if (n2.includes('ESGOTO')) return 'ESGOTO';
  if (n2.includes('ROSC')) return 'ROSCAVEL';

  // h1 com tipo de conexão (h2 pode ser só medida: "100 MM")
  if (n1.includes('SOLDÁVEL') || n1.includes('SOLDAVEL')) return 'SOLDAVEL';
  if (n1.includes('ESGOTO')) return 'ESGOTO';
  if (n1.includes('ROSC')) return 'ROSCAVEL';

  if (n1.includes('CIMENTO')) return 'CIMENTO';
  if (n1 === 'ARGAMASSA') return 'ARGAMASSA';
  if (['PISO', 'PORCELANATO', 'PORCELENATO', 'REVESTIMENTO'].includes(n1)) return 'CERAMICA';

  if (n1 === 'TINTA' || n1 === 'VERNIZ' || n1 === 'TINTA SPRAY') return 'TINTA';
  if (n1.includes('THINNER') || n1.includes('SELADOR')) return 'TINTA';
  if (n1.includes('MASSA CORRIDA')) return 'MASSA';
  if (n1.includes('MASSA ACR')) return 'MASSA';
  if (n1.includes('REJUNTE')) return 'REJUNTE';

  if (HIDRAULICA_H1.some((k) => n1.includes(norm(k)))) return 'HIDRAULICA';

  if (n1 === 'PREGO' || n1.includes('PARAFUSO')) return 'FIXACAO';
  if (ELETRICA_H1.some((k) => n1.includes(norm(k)))) return 'ELETRICA';
  if (n2.includes('ELETRODUTO') || n1.includes('ELETRODUTO')) return 'ELETRICA';
  if (FERRAGEM_H1.some((k) => n1.includes(norm(k)))) return 'FERRAGEM';
  if (n1.includes('IMPERMEAB')) return 'IMPERMEABILIZACAO';
  if (n1.includes('ADESIVO') || n1.startsWith('COLA ')) return 'IMPERMEABILIZACAO';

  if (n1 === 'LIXA') return 'OUTROS'; // pode virar linha própria se quiser

  return 'OUTROS';
}

export function inferirChaveAgrupamento(produto) {
  const n2 = h2(produto);
  const n1 = h1(produto);
  if (n2 === 'SOLDÁVEL' || n2 === 'SOLDAVEL' || n1.includes('SOLDÁVEL') || n1.includes('SOLDAVEL')) {
    return `SOLDÁVEL + h1=${trim(produto.campo_hierarquico_1) || '?'}`;
  }
  if (n2.includes('ESGOTO') || n1.includes('ESGOTO')) {
    return `ESGOTO + h1=${trim(produto.campo_hierarquico_1) || '?'}`;
  }
  if (n2.includes('ROSC') || n1.includes('ROSC')) {
    return `ROSCÁVEL + h1=${trim(produto.campo_hierarquico_1) || '?'}`;
  }
  return `h1=${trim(produto.campo_hierarquico_1) || '?'} | h2=${trim(produto.campo_hierarquico_2) || '—'}`;
}

export function findLinhaMeta(codigo) {
  return LINHAS_MESTRE.find((l) => l.codigo === codigo) || LINHAS_MESTRE.find((l) => l.codigo === 'OUTROS');
}
