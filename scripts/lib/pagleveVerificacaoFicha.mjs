/**
 * Compara local de uso (PEI/ERP → NBR) e textura ERP vs ficha do site.
 * Reutiliza normalizeLocalUsoNbr (pagleveLocalUsoNbr.mjs).
 */
import { fabricanteKeyFromGrupo } from './pagleveLocalUsoNbr.mjs';

export function extractLocalUsoPeiErp(descricao = '') {
  const u = String(descricao).toUpperCase();
  const m = u.match(/\bPEI\s*[:.]?\s*(L[A-E])\b/) || u.match(/\bPEI\s+(L[A-E])\b/);
  return m ? m[1].toUpperCase() : '';
}

const TEXTURA_ALIASES = [
  ['polido', /\bRT\s*POLIDO\b|\bPOLIDO\b|\bPOL\b/],
  ['granilhado', /\bGRANILH/i, /\bBOLD\s+GRAN\b/i],
  ['acetinado', /\bACETINAD/i],
  ['mate', /\bMATE\b/],
  ['brilhante', /\bBRILH/i],
  ['gotejado', /\bGOTEJAD/i],
  ['protetiva', /\bPROTETIVA\b|\bHD-?\d+/i],
];

export function inferTexturaErp(descricao = '') {
  const u = String(descricao).toUpperCase();
  for (const [key, ...patterns] of TEXTURA_ALIASES) {
    if (patterns.some((re) => re.test(u))) return key;
  }
  return '';
}

export function normalizeTexturaKey(raw = '') {
  const t = String(raw)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
  if (!t) return '';
  if (/polid/.test(t)) return 'polido';
  if (/granilh|gran\b/.test(t)) return 'granilhado';
  if (/acetin/.test(t)) return 'acetinado';
  if (/\bmate\b/.test(t)) return 'mate';
  if (/brilh/.test(t)) return 'brilhante';
  if (/gotej/.test(t)) return 'gotejado';
  if (/protetiv|aderent/.test(t)) return 'protetiva';
  if (/bold/.test(t) && !/granilh/.test(t)) return 'bold';
  return t.slice(0, 32);
}

function texturaSiteFromFicha(ficha = {}) {
  return ficha.textura || ficha.acabamento || ficha.tipologia || '';
}

export function inferBordaErp(descricao = '') {
  const u = String(descricao).toUpperCase();
  if (/\bRETIFICAD/i.test(u)) return 'retificada';
  if (/\bBOLD\b/.test(u)) return 'bold';
  if (/\bRT\b/.test(u) && !/POLIDO/.test(u)) return 'retificada';
  return '';
}

function normalizeBordaKey(raw = '') {
  const t = String(raw).toLowerCase().trim();
  if (/retific/.test(t)) return 'retificada';
  if (/bold/.test(t)) return 'bold';
  return t.slice(0, 24);
}

function bordaCompativel(erpKey, siteRaw) {
  const siteKey = normalizeBordaKey(siteRaw);
  if (!erpKey && !siteKey) return { ok: true, motivo: 'sem_borda' };
  if (!erpKey) return { ok: true, motivo: 'erp_sem_borda' };
  if (!siteKey) return { ok: false, motivo: 'site_sem_borda' };
  if (erpKey === siteKey) return { ok: true, motivo: 'igual' };
  return { ok: false, motivo: 'borda_divergente' };
}

function localUsoCompativel(erpPei, siteNbr, fabricanteKey) {
  if (!erpPei && !siteNbr) return { ok: true, motivo: 'sem_dados' };
  if (!erpPei) return { ok: true, motivo: 'erp_sem_pei' };
  if (!siteNbr) return { ok: false, motivo: 'site_sem_local_uso_nbr' };
  if (erpPei === siteNbr) return { ok: true, motivo: 'nbr_igual' };
  /** Lume LZ→LC etc.: PEI no ERP muitas vezes espelha código fabricante; aceitar se ERP = fonte */
  if (fabricanteKey === 'lume' && erpPei.length === 2 && erpPei.startsWith('L')) {
    return { ok: erpPei === siteNbr, motivo: 'lume_pei_vs_nbr' };
  }
  return { ok: false, motivo: 'pei_erp_diferente_nbr_site' };
}

function texturaCompativel(erpKey, siteRaw) {
  const siteKey = normalizeTexturaKey(siteRaw);
  if (!erpKey && !siteKey) return { ok: true, motivo: 'sem_textura' };
  if (!erpKey) return { ok: true, motivo: 'erp_sem_textura' };
  if (!siteKey) return { ok: false, motivo: 'site_sem_textura' };
  if (erpKey === siteKey) return { ok: true, motivo: 'igual' };
  if (siteKey.includes(erpKey) || erpKey.includes(siteKey)) return { ok: true, motivo: 'substring' };
  if (erpKey === 'granilhado' && siteKey === 'bold') return { ok: true, motivo: 'bold_granilha' };
  if (erpKey === 'protetiva' && /aderent|protetiv/.test(siteKey)) return { ok: true, motivo: 'protetiva' };
  return { ok: false, motivo: 'textura_divergente' };
}

/**
 * @param {object} opts
 * @param {string} opts.descricao_erp
 * @param {object} opts.ficha
 * @param {string} opts.fabricante_grupo
 */
export function verificarFichaVsErp({ descricao_erp, ficha = {}, fabricante_grupo = '' }) {
  const fabricanteKey = fabricanteKeyFromGrupo(fabricante_grupo);
  const local_uso_erp = extractLocalUsoPeiErp(descricao_erp);
  const local_uso_site_nbr = String(ficha.local_uso_nbr || '').toUpperCase();
  const local_uso_fonte = String(ficha.local_uso_fonte || '').toUpperCase();
  const textura_erp = inferTexturaErp(descricao_erp);
  const textura_site = texturaSiteFromFicha(ficha);
  const borda_erp = inferBordaErp(descricao_erp);
  const borda_site = String(ficha.tipo_borda || '').trim();

  const lu = localUsoCompativel(local_uso_erp, local_uso_site_nbr, fabricanteKey);
  const tx = texturaCompativel(textura_erp, textura_site);
  const bd = bordaCompativel(borda_erp, borda_site);

  const divergencias = [];
  if (!lu.ok) {
    divergencias.push({
      campo: 'local_uso',
      erp: local_uso_erp,
      site_nbr: local_uso_site_nbr,
      site_fonte: local_uso_fonte,
      motivo: lu.motivo,
    });
  }
  if (!tx.ok) {
    divergencias.push({
      campo: 'textura',
      erp: textura_erp,
      site: textura_site,
      motivo: tx.motivo,
    });
  }
  if (!bd.ok) {
    divergencias.push({
      campo: 'borda',
      erp: borda_erp,
      site: borda_site,
      motivo: bd.motivo,
    });
  }

  return {
    local_uso_erp,
    local_uso_site_nbr,
    local_uso_fonte,
    local_uso_ok: lu.ok,
    local_uso_motivo: lu.motivo,
    textura_erp,
    textura_site,
    textura_ok: tx.ok,
    textura_motivo: tx.motivo,
    borda_erp,
    borda_site,
    borda_ok: bd.ok,
    borda_motivo: bd.motivo,
    divergencias,
  };
}