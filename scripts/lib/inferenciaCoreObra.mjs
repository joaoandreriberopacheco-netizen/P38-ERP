/**
 * Core de obra — agrupa SKUs cross-LINHA no mesmo pathway de construção.
 * Camada Excel (estudo); não altera LINHA portal.
 */

function trim(s) {
  return String(s ?? '').trim();
}

function norm(s) {
  return trim(s).replace(/\s+/g, ' ').toUpperCase();
}

function blob(row) {
  return norm([row.h1, row.h2, row.h3, row.sku_atual, row.produto_compra, row.linha].filter(Boolean).join(' '));
}

/** Catálogo de cores (mantido enxuto — ~20 unidades). */
export const CORES_OBRA = {
  ALVENARIA: {
    codigo: 'ALVENARIA',
    nome: 'Alvenaria e cimentícios',
    etapa: '1 — Estrutura / alvenaria',
    descricao: 'Cimento, agregados, argamassa, cal, aditivos de mistura, alvenaria',
  },
  ARMADURA: {
    codigo: 'ARMADURA',
    nome: 'Armadura / concreto armado',
    etapa: '1 — Estrutura / alvenaria',
    descricao: 'Vergalhão, estribo, tela, arame estrutural',
  },
  COBERTURA: {
    codigo: 'COBERTURA',
    nome: 'Cobertura e forros',
    etapa: '2 — Cobertura',
    descricao: 'Telha, forro PVC, perfis',
  },
  ESGOTO: {
    codigo: 'ESGOTO',
    nome: 'Esgoto',
    etapa: '3 — Instalações brutas',
    descricao: 'Tubos e conexões esgoto',
  },
  AGUA_FRIA_SOLDAVEL: {
    codigo: 'AGUA_FRIA_SOLDAVEL',
    nome: 'Água fria soldável',
    etapa: '3 — Instalações brutas',
    descricao: 'Tubos e conexões PVC soldável',
  },
  AGUA_FRIA_ROSCAVEL: {
    codigo: 'AGUA_FRIA_ROSCAVEL',
    nome: 'Água fria roscável',
    etapa: '3 — Instalações brutas',
    descricao: 'Tubos e conexões roscáveis / galvanizados',
  },
  HIDRAULICA_GERAL: {
    codigo: 'HIDRAULICA_GERAL',
    nome: 'Hidráulica geral',
    etapa: '3 — Instalações brutas',
    descricao: "Caixa d'água, registros, ralos, sifões, grelhas",
  },
  PADRAO_ELETRICO: {
    codigo: 'PADRAO_ELETRICO',
    nome: 'Padrão elétrico de entrada',
    etapa: '3 — Instalações brutas',
    descricao: 'Pontalete, caixa contador, roldana, aterramento, armação padrão',
  },
  INFRA_ELETRICA: {
    codigo: 'INFRA_ELETRICA',
    nome: 'Infraestrutura elétrica',
    etapa: '3 — Instalações brutas',
    descricao: 'Eletroduto, fios, conduítes, grampos, curvas',
  },
  QUADRO_ELETRICO: {
    codigo: 'QUADRO_ELETRICO',
    nome: 'Quadro e proteção',
    etapa: '7 — Instalação elétrica',
    descricao: 'Quadro de distribuição, disjuntores',
  },
  PONTOS_ELETRICOS: {
    codigo: 'PONTOS_ELETRICOS',
    nome: 'Pontos elétricos',
    etapa: '7 — Instalação elétrica',
    descricao: 'Tomadas, interruptores, caixinhas',
  },
  ILUMINACAO: {
    codigo: 'ILUMINACAO',
    nome: 'Iluminação',
    etapa: '7 — Instalação elétrica',
    descricao: 'Spots, plafons, lâmpadas, plugs',
  },
  ASSENTAMENTO_CERAMICA: {
    codigo: 'ASSENTAMENTO_CERAMICA',
    nome: 'Assentamento cerâmico',
    etapa: '4 — Revestimentos',
    descricao: 'Cerâmica, porcelanato, piso, rejunte, adesivo p/ piso',
  },
  BANHEIRO: {
    codigo: 'BANHEIRO',
    nome: 'Banheiro e áreas molhadas',
    etapa: '5 — Áreas molhadas',
    descricao: 'Chuveiro, assento, caixa acoplada, metais, torneiras',
  },
  PINTURA_OBRA: {
    codigo: 'PINTURA_OBRA',
    nome: 'Pintura e acabamento',
    etapa: '6 — Acabamento seco',
    descricao: 'Tinta, verniz, thinner, massa, lixa',
  },
  IMPERMEABILIZACAO: {
    codigo: 'IMPERMEABILIZACAO',
    nome: 'Impermeabilização',
    etapa: '6 — Acabamento seco',
    descricao: 'Impermeabilizante, manta líquida, Vedacit',
  },
  ESQUADRIAS: {
    codigo: 'ESQUADRIAS',
    nome: 'Esquadrias e ferragens de porta',
    etapa: '6 — Acabamento seco',
    descricao: 'Portas, fechaduras, dobradiças, puxadores',
  },
  FIXACAO: {
    codigo: 'FIXACAO',
    nome: 'Fixação',
    etapa: '8 — Transversal',
    descricao: 'Parafusos, pregos, barra roscada, buchas',
  },
  FERRAGEM_GERAL: {
    codigo: 'FERRAGEM_GERAL',
    nome: 'Ferragens gerais',
    etapa: '8 — Transversal',
    descricao: 'Fechaduras avulsas, discos, ferragens diversas',
  },
};

function result(coreCodigo, papel = '') {
  const meta = CORES_OBRA[coreCodigo];
  if (!meta) return { core: '', core_nome: '', etapa_obra: '', papel_core: papel };
  return {
    core: meta.codigo,
    core_nome: meta.nome,
    etapa_obra: meta.etapa,
    papel_core: papel,
  };
}

function isAditivoCimenticio(t, pc) {
  if (/\bADITIVO PLASTIFIC/i.test(t) || /\bPLASTIFICANTE\b/.test(t)) return true;
  if (norm(pc).includes('ADITIVO PLASTIFIC')) return true;
  return false;
}

function isAlvenariaBasica(t, pc, linha) {
  const ln = norm(linha);
  if (ln === 'CIMENTO' || ln === 'ARGAMASSA') return true;
  if (/\bCIMENTO PORTLAND\b|\bCIMENTO BRANCO\b/.test(t)) return true;
  if (/^ARGAMASSA\b/.test(t) || norm(pc).startsWith('ARGAMASSA')) return true;
  if (/^AREIA\b|^SEIXO\b|^TIJOLO\b|^BLOCO DE CONCRETO\b|^CAL SUPERCAL\b|^CAL\b/.test(t)) return true;
  if (['AREIA', 'SEIXO', 'TIJOLO', 'BLOCO DE CONCRETO', 'CAL SUPERCAL'].includes(norm(pc))) return true;
  return false;
}

function isArmadura(linha, t, pc) {
  if (norm(linha) === 'VERGALHÃO' || norm(linha) === 'VERGALHAO') return true;
  if (/^VERGALH|^ESTRIBO\b|^TELA /.test(t) || norm(pc) === 'VERGALHÃO' || norm(pc) === 'ESTRIBO') return true;
  if (/^ARAME (GALVANIZADO|RECOZIDO)\b/.test(t) && !/GRAMPO P\/CERCA/.test(t)) return true;
  return false;
}

function isPadraoEletrico(t, pc) {
  if (/PONTALETE GALVANIZADO|PONTALETE/.test(t) && /MONOF|BIFAS|TRIFAS/i.test(t)) return true;
  if (/ARMAÇÃO NUCLEAR P\/ PONTALETE|ARMAÇAO NUCLEAR P\/ PONTALETE/i.test(t)) return true;
  if (/CAIXA DE LUZ P\/ CONTADOR|CAIXA DE LUZ.*MONOF|CAIXA DE LUZ.*BIFAS|CAIXA DE LUZ.*TRIFAS/i.test(t)) return true;
  if (norm(pc) === 'CAIXA DE LUZ' && /MONOF|BIFAS|TRIFAS/i.test(t)) return true;
  if (/ISOLADOR TIPO ROLDANA|ISOLADOR.*ROLDANA/i.test(t)) return true;
  if (/HASTE DE ATERRAMENTO|CONECTOR P\/HASTE ATERRAM/i.test(t)) return true;
  if (/BENJAMIN PADRÃO|BENJAMIN PADRAO/i.test(t)) return true;
  if (norm(pc).includes('PONTALETE') || norm(pc).includes('ROLDANA')) return true;
  return false;
}

function isInfraEletrica(linha, t, pc) {
  const ln = norm(linha);
  if (ln === 'ELETRODUTO' || ln === 'FIOS ELÉTRICOS' || ln === 'FIO') return true;
  if (/ELETRODUTO|CONDUITE CORRUGADO|GRAMPO P\/ FIO|CANALETA ELETRODUTO/i.test(t)) return true;
  if (norm(pc).includes('ELETRODUTO') || norm(pc) === 'CONDUITE CORRUGADO' || norm(pc).includes('GRAMPO P/ FIO')) return true;
  if (norm(pc) === 'FIO ELÉTRICO' || norm(pc) === 'FIO PARALELO') return true;
  return false;
}

function isQuadroEletrico(t, pc) {
  if (/QUADRO DE DISTRIBUI/i.test(t) || norm(pc).includes('QUADRO DE DISTRIBUI')) return true;
  if (/^DISJUNTOR\b/.test(t) || norm(pc) === 'DISJUNTOR') return true;
  return false;
}

function isPontosEletricos(t, pc, linha) {
  if (norm(linha) === 'ILUMINAÇÃO' || norm(linha) === 'ILUMINACAO') return false;
  if (/^TOMADA\b|^INTERRUPTOR\b|CAIXINHA DE LUZ|CAIXA DE LUZ 4X4/i.test(t)) return true;
  if (/^TOMADA|^INTERRUPTOR|^INTERRUPTOR \+|^INTERRUPTOR\+/i.test(norm(pc))) return true;
  if (norm(pc) === 'CAIXA DE LUZ' && !/MONOF|BIFAS|TRIFAS/i.test(t)) return true;
  if (norm(pc) === 'CAIXINHA DE LUZ') return true;
  return false;
}

function isIluminacao(linha, t) {
  if (['ILUMINAÇÃO', 'ILUMINACAO'].includes(norm(linha))) return true;
  if (/^SPOT LED\b|^PLAFON\b|^LAMPADA FLUORESCENTE|^LÂMPADA|^LAMPADA/i.test(t)) return true;
  if (/^PLUG MACHO|^PLUG FEMEA|^NICHO EMBUTIR/i.test(t)) return true;
  if (/RESISTENCIA.*SHOWER/i.test(t)) return true;
  return false;
}

function isAssentamentoCeramica(linha, t, pc) {
  const ln = norm(linha);
  if (['CERÂMICA BOLD', 'CERAMICA BOLD', 'CERÂMICA RETIF', 'CERAMICA RETIF', 'PISO / CERÂMICA DE PISO', 'PISO', 'PORCELANATO', 'REVESTIMENTO'].some((x) => ln.includes(x.replace('CERAMICA', 'CERÂMICA')) || ln === norm(x))) {
    if (ln.includes('PISO') || ln.includes('CERÂMICA') || ln.includes('PORCELANATO') || ln.includes('REVESTIMENTO')) return true;
  }
  if (/^PISO\b|^PORCELANATO\b|^REVESTIMENTO\b/.test(t) && norm(linha).includes('PISO')) return true;
  if (ln.includes('CERÂMICA') || ln === 'PORCELANATO' || ln === 'REVESTIMENTO' || ln.startsWith('PISO')) return true;
  if (norm(linha) === 'REJUNTE') return true;
  if (norm(linha) === 'ADESIVO' && (/ADESIVO PLÁSTICO|ADESIVO PLASTICO|ARGAMASSA COLANTE|COLANTE|P\/ PISO/i.test(t) || /ADESIVO PLÁSTICO|ADESIVO PLASTICO/i.test(norm(pc)))) return true;
  if (/^REJUNTE\b/.test(t) || norm(pc).startsWith('REJUNTE')) return true;
  return false;
}

function isBanheiro(linha, t) {
  const ln = norm(linha);
  if (ln === 'METAIS SANITÁRIOS' || ln === 'METAIS SANITARIOS' || ln === 'TORNEIRA') return true;
  if (/^CHUVEIRO\b|^ASSENTO SANIT|^CAIXA DE DESCARGA|^MONOCOMANDO\b|^CUBA\b|^PIA\b/i.test(t)) return true;
  return false;
}

function isPinturaObra(linha, t) {
  const ln = norm(linha);
  if (['TINTA', 'VERNIZ', 'THINNER', 'MASSA CORRIDA', 'MASSA ACRÍLICA', 'MASSA ACRILICA', 'LIXA', 'PINTURA E QUÍMICOS'].includes(ln)) return true;
  if (/^TINTA\b|^VERNIZ\b|^THINNER\b|^MASSA CORRIDA\b|^MASSA ACR|^ROLO DE|^PINCEL\b|^LIXA\b|^CORANTE\b|^XADREZ\b|^TINTA SPRAY/i.test(t)) return true;
  return false;
}

function papelAlvenaria(t, pc, linha) {
  if (isAditivoCimenticio(t, pc)) return 'complemento';
  if (norm(linha) === 'ARGAMASSA' || norm(pc).startsWith('ARGAMASSA')) return 'receita_pronta';
  if (/^CAL\b|CAL SUPERCAL/i.test(t) || norm(pc).includes('CAL')) return 'complemento';
  if (/^CIMENTO\b|CIMENTO PORTLAND|CIMENTO BRANCO/i.test(t) || norm(linha) === 'CIMENTO') return 'nucleo';
  if (/^AREIA\b|^SEIXO\b|^TIJOLO\b|^BLOCO/i.test(t) || ['AREIA', 'SEIXO'].includes(norm(pc))) return 'nucleo';
  return '';
}

/**
 * @param {object} row — linha do export estudo
 * @returns {{ core: string, core_nome: string, etapa_obra: string, papel_core: string }}
 */
export function inferirCoreObra(row = {}) {
  const t = blob(row);
  const pc = row.produto_compra || '';
  const linha = row.linha || '';

  if (isAditivoCimenticio(t, pc)) {
    return result('ALVENARIA', 'complemento');
  }

  if (isPadraoEletrico(t, pc)) {
    return result('PADRAO_ELETRICO', 'nucleo');
  }

  if (isArmadura(linha, t, pc)) {
    return result('ARMADURA', 'nucleo');
  }

  if (isAlvenariaBasica(t, pc, linha)) {
    return result('ALVENARIA', papelAlvenaria(t, pc, linha));
  }

  const ln = norm(linha);
  if (ln === 'ESGOTO') return result('ESGOTO');
  if (ln === 'SOLDÁVEL' || ln === 'SOLDAVEL') return result('AGUA_FRIA_SOLDAVEL');
  if (ln === 'ROSCÁVEL' || ln === 'ROSCAVEL') return result('AGUA_FRIA_ROSCAVEL');
  if (ln === 'HIDRÁULICA' || ln === 'HIDRAULICA') return result('HIDRAULICA_GERAL');

  if (isQuadroEletrico(t, pc)) return result('QUADRO_ELETRICO');
  if (isPontosEletricos(t, pc, linha)) return result('PONTOS_ELETRICOS');
  if (isIluminacao(linha, t)) return result('ILUMINACAO');
  if (isInfraEletrica(linha, t, pc)) return result('INFRA_ELETRICA');

  if (isAssentamentoCeramica(linha, t, pc)) return result('ASSENTAMENTO_CERAMICA');
  if (isBanheiro(linha, t)) return result('BANHEIRO');
  if (isPinturaObra(linha, t)) return result('PINTURA_OBRA');

  if (ln === 'IMPERMEABILIZANTE' || /IMPERMEABIL|MANTA LÍQUIDA|^VEDACIT\b/i.test(t)) {
    return result('IMPERMEABILIZACAO');
  }

  if (ln === 'COBERTURAS E FORROS' || ln === 'COBERTURAS') return result('COBERTURA');
  if (ln === 'ESQUADRIAS E FERRAGENS' || ln === 'ESQUADRIAS') return result('ESQUADRIAS');

  if (ln === 'PARAFUSO' || ln === 'PREGO') return result('FIXACAO');
  if (ln === 'FERRAGEM') return result('FERRAGEM_GERAL');

  if (ln === 'ADESIVO') {
    if (/TUBOS|TUBO|SOLDÁVEL|SOLDAVEL/i.test(t)) return result('AGUA_FRIA_SOLDAVEL', 'complemento');
    return result('ASSENTAMENTO_CERAMICA', 'complemento');
  }

  if (ln === 'MATERIAIS BÁSICOS' || ln === 'MATERIAIS BASICOS') {
    if (/COMPENSADO|MADEIRIT|^ARAME\b|^FORRO PVC\b|^PERFIL U\b/i.test(t)) return result('ALVENARIA', 'complemento');
  }

  // FERRAMENTAS, DIVERSOS, OUTROS — transversal sem core
  return { core: '', core_nome: '', etapa_obra: '', papel_core: '' };
}

export function listarCoresObra() {
  return Object.values(CORES_OBRA);
}
