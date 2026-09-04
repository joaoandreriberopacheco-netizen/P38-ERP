import { norm } from '@/lib/hierarquiaPortal/planLinhaCompra';

export const LINHAS_MESTRE = [
  { ordem: 10, codigo: 'CIMENTO', nome: 'CIMENTO', tipo: 'solo', notas: 'Pilot — sem grelha; marca/embalagem no SKU' },
  { ordem: 20, codigo: 'ARGAMASSA', nome: 'ARGAMASSA', tipo: 'mix', notas: 'Pilot — classe × embalagem' },
  { ordem: 30, codigo: 'PISO', nome: 'PISO / CERÂMICA DE PISO', tipo: 'portfolio', notas: 'Formato × modelo' },
  { ordem: 40, codigo: 'PORCELANATO', nome: 'PORCELANATO', tipo: 'portfolio', notas: '' },
  { ordem: 50, codigo: 'REVESTIMENTO', nome: 'REVESTIMENTO', tipo: 'portfolio', notas: '' },
  { ordem: 60, codigo: 'SOLDAVEL', nome: 'SOLDÁVEL', tipo: 'mix', notas: 'Peça × medida' },
  { ordem: 70, codigo: 'ESGOTO', nome: 'ESGOTO', tipo: 'mix', notas: '' },
  { ordem: 80, codigo: 'ROSCAVEL', nome: 'ROSCÁVEL', tipo: 'mix', notas: '' },
  { ordem: 90, codigo: 'TINTA', nome: 'TINTA', tipo: 'portfolio', notas: '' },
  { ordem: 100, codigo: 'VERNIZ', nome: 'VERNIZ', tipo: 'portfolio', notas: '' },
  { ordem: 110, codigo: 'MASSA_CORRIDA', nome: 'MASSA CORRIDA', tipo: 'mix', notas: '' },
  { ordem: 120, codigo: 'MASSA_ACRILICA', nome: 'MASSA ACRÍLICA', tipo: 'mix', notas: '' },
  { ordem: 130, codigo: 'REJUNTE', nome: 'REJUNTE', tipo: 'mix', notas: '' },
  { ordem: 140, codigo: 'PREGO', nome: 'PREGO', tipo: 'solo', notas: '' },
  { ordem: 150, codigo: 'PARAFUSO', nome: 'PARAFUSO', tipo: 'mix', notas: '' },
  { ordem: 160, codigo: 'TORNEIRA', nome: 'TORNEIRA', tipo: 'portfolio', notas: '' },
  { ordem: 170, codigo: 'METAIS_SANITARIOS', nome: 'METAIS SANITÁRIOS', tipo: 'portfolio', notas: '' },
  { ordem: 180, codigo: 'TUBO', nome: 'TUBO (geral)', tipo: 'mix', notas: '' },
  { ordem: 190, codigo: 'LIXA', nome: 'LIXA', tipo: 'mix', notas: '' },
  { ordem: 200, codigo: 'ELETRICA', nome: 'MATERIAL ELÉTRICO', tipo: 'mix', notas: '' },
  { ordem: 210, codigo: 'FERRAGEM', nome: 'FERRAGEM', tipo: 'mix', notas: '' },
  { ordem: 220, codigo: 'IMPERMEABILIZANTE', nome: 'IMPERMEABILIZANTE', tipo: 'mix', notas: '' },
  { ordem: 230, codigo: 'ADESIVO', nome: 'ADESIVO', tipo: 'mix', notas: '' },
  { ordem: 900, codigo: 'OUTROS', nome: 'OUTROS / A CLASSIFICAR', tipo: 'solo', notas: '' },
];

function isSoldavel(p) {
  const h2 = norm(p.campo_hierarquico_2);
  return h2 === 'SOLDÁVEL' || h2 === 'SOLDAVEL';
}

function h1(p) {
  return norm(p.campo_hierarquico_1);
}

function h2(p) {
  return norm(p.campo_hierarquico_2);
}

export function inferirLinhaCodigo(produto) {
  if (isSoldavel(produto)) return 'SOLDAVEL';
  const n1 = h1(produto);
  const n2 = h2(produto);

  if (n1.includes('CIMENTO')) return 'CIMENTO';
  if (n1 === 'ARGAMASSA') return 'ARGAMASSA';
  if (n1 === 'PISO') return 'PISO';
  if (n1 === 'PORCELANATO' || n1 === 'PORCELENATO') return 'PORCELANATO';
  if (n1 === 'REVESTIMENTO') return 'REVESTIMENTO';
  if (n1 === 'TINTA' || n1 === 'TINTA SPRAY') return 'TINTA';
  if (n1 === 'VERNIZ') return 'VERNIZ';
  if (n1.includes('MASSA CORRIDA')) return 'MASSA_CORRIDA';
  if (n1.includes('MASSA ACR')) return 'MASSA_ACRILICA';
  if (n1 === 'REJUNTE' || n1.includes('REJUNTE')) return 'REJUNTE';
  if (n1 === 'PREGO') return 'PREGO';
  if (n1.includes('PARAFUSO')) return 'PARAFUSO';
  if (n2.includes('ESGOTO') || n1.includes('ESGOTO')) return 'ESGOTO';
  if (n2.includes('ROSC') || n1.includes('ROSC')) return 'ROSCAVEL';
  if (n1.includes('TORNEIRA')) return 'TORNEIRA';
  if (['CHUVEIRO', 'REGISTRO', 'REGISTRO ESFERA', 'VALVULA', 'VALVULA DE DESCARGA', 'CAIXA DE DESCARGA', 'ASSENTO SANITÁRIO', 'MONOCOMANDO'].some((k) => n1.includes(k))) {
    return 'METAIS_SANITARIOS';
  }
  if (n1 === 'TUBO' || n1.includes('TUBO')) return 'TUBO';
  if (n1 === 'LIXA') return 'LIXA';
  if (['DISJUNTOR', 'CABO', 'LAMPADA', 'LUMINÁRIA', 'TOMADA', 'INTERRUPTOR'].some((k) => n1.includes(k))) return 'ELETRICA';
  if (['FECHADURA', 'DOBRADIÇA', 'PUXADOR', 'TRINCO'].some((k) => n1.includes(k))) return 'FERRAGEM';
  if (n1.includes('IMPERMEAB')) return 'IMPERMEABILIZANTE';
  if (n1.includes('ADESIVO') || n1.includes('COLA ')) return 'ADESIVO';

  return 'OUTROS';
}

export function findLinhaMeta(codigo) {
  return LINHAS_MESTRE.find((l) => l.codigo === codigo) ?? LINHAS_MESTRE.find((l) => l.codigo === 'OUTROS');
}
