/**
 * Mapeamento estudo → modelo 3×3 (Cat1·Cat2·Cat3 + Comp1·Comp2·Comp3).
 */

export function linhaBase(linha = '') {
  return String(linha ?? '').replace(/·[NRC]$/i, '').trim();
}

export function cellStr(value) {
  if (value == null) return '';
  if (typeof value === 'object' && value.result != null) return String(value.result).trim();
  return String(value).trim();
}

/** @param {string} etapa */
export function etapaToCat2(etapa) {
  const raw = String(etapa ?? '').trim();
  if (!raw) return '(sem sub-bloco)';
  const m = raw.match(/^(\d+)\s*[—–-]\s*(.+)$/);
  if (!m) return raw;
  const num = m[1].padStart(2, '0');
  let name = m[2].trim();
  if (name === 'Estrutura / alvenaria') name = 'Alvenaria';
  if (name === 'Instalação elétrica') name = 'Instalação elétrica';
  return `${num}. ${name}`;
}

const CORE_CAT3 = {
  ARMADURA: 'a. Armaduras',
  ALVENARIA: 'a. Alvenaria',
  ASSENTAMENTO_CERAMICA: 'a. Cerâmica',
  PINTURA_OBRA: 'a. Pintura',
  COBERTURA: 'a. Cobertura',
  IMPERMEABILIZACAO: 'a. Impermeabilização',
  ESQUADRIAS: 'a. Esquadrias',
  AGUA_FRIA_SOLDAVEL: 'a. Soldável',
  ESGOTO: 'a. Esgoto',
  AGUA_FRIA_ROSCAVEL: 'a. Roscável',
  HIDRAULICA_GERAL: 'a. Hidráulica geral',
  PADRAO_ELETRICO: 'a. Padrão elétrico',
  INFRA_ELETRICA: 'a. Infra elétrica',
  QUADRO_ELETRICO: 'a. Quadro elétrico',
  ILUMINACAO: 'a. Iluminação',
  PONTOS_ELETRICOS: 'a. Pontos elétricos',
  BANHEIRO: 'a. Banheiro',
  FIXACAO: 'a. Fixação',
  FERRAGEM_GERAL: 'a. Ferragem',
};

const ETAPAS_A = new Set([
  '1 — Estrutura / alvenaria',
  '2 — Cobertura',
  '4 — Revestimentos',
  '6 — Acabamento seco',
]);

const CORES_HID = new Set(['ESGOTO', 'AGUA_FRIA_SOLDAVEL', 'AGUA_FRIA_ROSCAVEL', 'HIDRAULICA_GERAL']);
const CORES_ELE = new Set(['PADRAO_ELETRICO', 'INFRA_ELETRICA', 'QUADRO_ELETRICO', 'PONTOS_ELETRICOS', 'ILUMINACAO']);

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function pcMatch(row, patterns = []) {
  const pc = norm(row.produto_compra);
  const sku = norm(row.sku_atual || row.novo_sku);
  return patterns.some((p) => {
    const n = norm(p);
    return pc.includes(n) || sku.includes(n);
  });
}

/** @param {{ etapa?: string, core?: string, linha?: string, produto_compra?: string }} row */
export function deriveCat2B(row) {
  const core = String(row.core ?? '').trim();
  const linha = linhaBase(row.linha);

  if (core === 'AGUA_FRIA_SOLDAVEL' || linha === 'SOLDÁVEL') return '01. Soldável';
  if (core === 'ESGOTO' || linha === 'ESGOTO') return '02. Esgoto';
  if (core === 'AGUA_FRIA_ROSCAVEL' || linha === 'ROSCÁVEL') return '03. Roscável';
  if (pcMatch(row, ["CAIXA D'ÁGUA", 'CAIXA D AGUA', 'ADAPTADOR CAIXA', 'POÇO', 'POCO'])) return '04. Captação';
  if (core === 'PADRAO_ELETRICO') return '06. Padrão de entrada';
  if (core === 'INFRA_ELETRICA' || ['ELETRODUTO', 'FIOS ELÉTRICOS'].includes(linha)) return '07. Infra elétrica';
  if (core === 'QUADRO_ELETRICO') return '08. Quadro e proteção';
  if (pcMatch(row, ['CAIXINHA DE LUZ', 'CAIXA DE LUZ', 'PLACA CEGA', 'TAPA-FURO'])) return '09. Caixas de espera';
  if (core === 'HIDRAULICA_GERAL' || linha === 'HIDRÁULICA') return '05. Componentes';
  if (CORES_ELE.has(core)) return '07. Infra elétrica';
  return etapaToCat2(row.etapa);
}

/** @param {{ etapa?: string, core?: string, linha?: string, produto_compra?: string, sku_atual?: string, novo_sku?: string }} row */
export function deriveCat1(row) {
  const etapa = String(row.etapa ?? '').trim();
  const core = String(row.core ?? '').trim();

  if (ETAPAS_A.has(etapa)) return 'A. Edificações';
  if (etapa === '5 — Áreas molhadas' || core === 'BANHEIRO') return 'C. Acabamentos';
  if (etapa === '8 — Transversal') return 'T. Transversal';
  if (etapa === '3 — Instalações brutas' || etapa === '7 — Instalação elétrica') return 'B. Instalações';
  if (CORES_HID.has(core) || CORES_ELE.has(core)) return 'B. Instalações';
  if (['ILUMINACAO', 'PONTOS_ELETRICOS'].includes(core) && etapa.includes('Acabamento')) return 'C. Acabamentos';
  if (!etapa && !core) return 'D. Diversos';
  if (ETAPAS_A.has(etapa) || ['4 — Revestimentos', '6 — Acabamento seco'].includes(etapa)) return 'A. Edificações';
  return 'D. Diversos';
}

/** @param {{ core?: string, linha?: string, produto_compra?: string }} row */
export function deriveCat3(row) {
  const core = String(row.core ?? '').trim();
  if (core && CORE_CAT3[core]) return CORE_CAT3[core];
  const linha = linhaBase(row.linha);
  if (linha && linha !== 'DIVERSOS') {
    const label = linha.charAt(0) + linha.slice(1).toLowerCase();
    return `a. ${label}`;
  }
  const pc = String(row.produto_compra ?? '').trim();
  if (pc) return `a. ${pc.charAt(0)}${pc.slice(1).toLowerCase()}`;
  return '(sem família)';
}

/** Normaliza bloco vindo do Excel estudo (A — Edificações → A. Edificações). */
export function normalizeCat1(bloco) {
  const s = String(bloco ?? '').trim();
  if (!s) return '';
  return s
    .replace(/^A\s*[—–-]\s*/i, 'A. ')
    .replace(/^B\s*[—–-]\s*/i, 'B. ')
    .replace(/^C\s*[—–-]\s*/i, 'C. ')
    .replace(/^T\s*[—–-]\s*/i, 'T. ')
    .replace(/^D\s*[—–-]\s*/i, 'D. ')
    .replace('Edificações', 'Edificações')
    .replace('Instalações', 'Instalações');
}

/** Normaliza sub_bloco (A1 Estrutura → 01. Alvenaria quando aplicável). */
export function normalizeCat2(subBloco, etapa) {
  const s = String(subBloco ?? '').trim();
  if (!s) return etapaToCat2(etapa);
  if (/^A1\b/i.test(s)) return '01. Alvenaria';
  if (/^A2\b/i.test(s)) return '02. Cobertura';
  if (/^A4\b/i.test(s)) return '04. Revestimentos';
  if (/^A6\b/i.test(s)) return '06. Acabamento seco';
  if (/^B0(\d)/i.test(s)) return s.replace(/^B0(\d+)\s*[—–-]\s*/i, '0$1. ');
  if (/^C5\b/i.test(s)) return '05. Áreas molhadas';
  if (/^(\d+)\s*[—–-]\s*/.test(s)) {
    return s.replace(/^(\d+)\s*[—–-]\s*/i, (_, d) => `${String(d).padStart(2, '0')}. `);
  }
  if (/^\d/.test(s)) return s;
  return etapaToCat2(etapa) || s;
}

/** @param {{ core?: string }} row */
export function deriveCat3FromCoreCode(core) {
  const c = String(core ?? '').trim();
  if (CORE_CAT3[c]) return CORE_CAT3[c];
  if (!c) return '';
  const words = c.toLowerCase().split('_').join(' ');
  return `a. ${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

/** @param {object} row */
export function to3x3(row, abHit) {
  const comp1 = cellStr(row.produto_compra);
  const comp2 = cellStr(row.eixo_a);
  const comp3 = cellStr(row.eixo_b);

  let cat1;
  let cat2;
  let cat3;

  if (abHit?.bloco) {
    cat1 = normalizeCat1(abHit.bloco);
    cat2 = normalizeCat2(abHit.sub, row.etapa);
    cat3 = deriveCat3FromCoreCode(abHit.core) || deriveCat3(row);
  } else {
    cat1 = deriveCat1(row);
    cat2 = cat1.startsWith('B.')
      ? deriveCat2B(row)
      : cat1 === 'C. Acabamentos'
        ? '05. Áreas molhadas'
        : cat1 === 'T. Transversal'
          ? '08. Transversal'
          : etapaToCat2(row.etapa);
    cat3 = deriveCat3(row);
  }

  return {
    cat1,
    cat2,
    cat3,
    comp1,
    comp2,
    comp3,
    codigo_interno: cellStr(row.codigo_interno).toUpperCase(),
    novo_sku: cellStr(row.novo_sku),
    sku_atual: cellStr(row.sku_atual),
    etapa_origem: cellStr(row.etapa),
    core_origem: cellStr(row.core),
    linha_origem: cellStr(row.linha),
  };
}
