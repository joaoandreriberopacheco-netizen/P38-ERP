/**
 * Ficha pública Carmelo Fior (HTML da página /produto/{slug}).
 */
import { stripAccents } from './formigresCatalog.mjs';

const SUPERFICIES = ['Brilhante', 'Mate', 'Acetinado', 'Polido', 'Granilhado', 'Natural', 'Soft'];
const USO_PEI = ['LEI', 'LCI', 'LA', 'LB', 'LC', 'LD', 'LE'];

/** Marca na ficha (category.title) — site usa "Fioranno" para Fiorano. */
export function normalizeMarcaCarmeloSite(title = '') {
  const t = String(title || '').trim();
  if (!t) return '';
  if (/^fiorann?o$/i.test(t)) return 'Fiorano';
  if (/^cecafi$/i.test(t)) return 'Cecafi';
  if (/^idealle$/i.test(t)) return 'Idealle';
  if (/^arielle$/i.test(t)) return 'Arielle';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function parseMarcaFromCarmeloHtml(raw = '') {
  const m = String(raw).match(/"category":\[\{"id":\d+,"title":"([^"]+)"/);
  return normalizeMarcaCarmeloSite(m?.[1] || '');
}

export function parseCarmeloProdutoHtml(html) {
  const raw = String(html || '');
  const title = raw.match(/<title>([^<|]+)/i)?.[1]?.trim() || '';
  if (!title || /conheça nossos modelos|^error$/i.test(title)) return null;

  const formato = raw.match(/"title":"(\d{2}x\d{2}\s*cm[^"]*)"/i)?.[1]?.replace(/\s+/g, ' ') || '';
  const superficie = SUPERFICIES.find((s) => raw.includes(`"title":"${s}"`)) || '';
  const linha = raw.includes('"title":"Retificado"') && !raw.includes('"title":"Bold","description":null}')
    ? 'Retificada'
    : raw.includes('"title":"Bold"')
      ? 'Bold'
      : '';
  const parts = [title];
  if (formato) parts.push(formato);
  if (linha) parts.push(linha);
  if (superficie) parts.push(superficie);

  const marca_site = parseMarcaFromCarmeloHtml(raw);

  return {
    titulo: title,
    descricao_no_site: parts.join(' · '),
    superficie,
    linha_site: linha,
    marca_site,
    fabricante_grupo: 'Carmelo Fior',
    classificacao_uso: '',
    classificacao_pei: '',
  };
}

export function carmeloSlugFromModelo(modelo) {
  return stripAccents(modelo || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');
}

/** Remove “0X90”, “9X75” etc. do início do modelo (OCR SIAH). */
export function carmeloModeloBaseFromRow(row) {
  const desc = String(row.descricao_erp || row.descricao || '');
  let modelo = String(row.modelo || '').trim();
  modelo = modelo.replace(/^0?\s*x\s*\d+\s*/gi, '').trim();
  modelo = modelo.replace(/^9\s*x\s*\d+\s*/gi, '').trim();
  if (!modelo || /^0?\s*x\s*\d/i.test(modelo)) {
    let d = desc.replace(/^\s*\d+\s*x\s*\d+\s*/i, '').replace(/^\s*0\s*x\s*\d+\s*/i, '');
    d = d.replace(/\(HD[^)]*\)/gi, ' ').split('(')[0];
    modelo = d.trim();
  }
  const words = stripAccents(modelo)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(plus|soft|mre|rt|esm|hd|mru|a|b)$/.test(w));
  const first = words[0] || '';
  return first ? carmeloSlugFromModelo(first) : '';
}

/** Slugs comuns no site Carmelo (ex. Alaska Plus 32×57 → alaska-plus-32-75). */
/** Linhas Etna/Cecafi/Fiorano no ERP — fichas no portal do grupo Carmelo Fior. */
export function cecafiCarmeloSlugCandidates(row, modeloRaw = '') {
  const desc = stripAccents(String(row.descricao_erp || row.descricao || '').toLowerCase());
  const modelo = stripAccents(String(modeloRaw || '').toLowerCase());
  const blob = `${desc} ${modelo}`;
  const slugs = new Set();
  const add = (s) => {
    if (s) slugs.add(s);
  };

  if (/selah\s*white|selah white/.test(blob)) {
    add('selah-white-lux-plus');
    add('selah-white');
  }
  const fmt = String(row.formato || '').toLowerCase();

  if (/alvor/.test(blob)) add('alvor');
  if (/selena bege/.test(blob)) add('selena-bege');
  if (/selena cinza/.test(blob)) add('selena-cinza');
  if (/vino/.test(blob)) add('vino');
  if (/melinda/.test(blob)) add('melinda');
  if (/theo/.test(blob)) add('theo');

  if (fmt === '38x75') {
    if (/clean/.test(blob)) add('clean-plus-38-75');
    if (/branco neve/.test(blob)) add('branco-neve-plus-38-75');
  }
  if (fmt === '57x57' || fmt === '32x57') {
    if (/noble/.test(blob)) add('noble-57x57');
    if (/branco neve/.test(blob)) {
      add('branco-neve-57x57');
      if (/mate/.test(blob)) add('branco-neve-mate-57x57');
    }
    if (/clean/.test(blob) && fmt === '57x57') add('clean-57x57');
    if (/bolt/.test(blob)) add('bolt-mre');
    if (/dritto cinza/.test(blob)) add('dritto-cinza-mre');
    if (/dritto bege/.test(blob)) add('dritto-bege-mre');
    if (/minerati/.test(blob)) add('minerati-mre');

    const nome57 = stripAccents(modelo)
      .toLowerCase()
      .replace(/^0?\s*x\s*\d+\s*/g, ' ')
      .replace(/\b(mru|vru|mac|mre|hd|acet|bold|esm|pei|jun|ju|lb|le|ld|lc|la|a|b)\b/gi, ' ')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    if (nome57.length >= 2 && fmt === '57x57') add(`${nome57.slice(0, 2).join('-')}-57x57`);
    if (nome57[0] && fmt === '57x57') add(`${nome57[0]}-57x57`);
  }

  const words = modelo
    .replace(/\b(a|b|mre|hd|acet|bold|esm|pei|jun|ju|lb|le|ld|lc|la)\b/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length >= 2) add(carmeloSlugFromModelo(words.slice(0, 2).join(' ')));
  if (words[0]) add(carmeloSlugFromModelo(words[0]));

  return [...slugs];
}

export function acabamentoFromErpDesc(descricao = '') {
  const u = String(descricao || '').toUpperCase();
  if (/\bACET/.test(u)) return 'Acetinado';
  if (/\bMATE\b/.test(u)) return 'Mate';
  if (/BRILH/.test(u)) return 'Brilhante';
  if (/\bESM\b/.test(u)) return 'Esmaltado';
  return '';
}

export function carmeloSlugCandidates(row, modelo) {
  const fmt = String(row.formato || '').toLowerCase();
  const desc = String(row.descricao_erp || row.descricao || '');
  const u = desc.toUpperCase();
  let base = carmeloModeloBaseFromRow(row) || carmeloSlugFromModelo(modelo);
  if (base.startsWith('0x') || /^\d+x/.test(base)) base = carmeloModeloBaseFromRow(row) || base;
  const out = [];
  if (!base) return out;

  if (fmt === '32x57') {
    out.push(`${base}-plus-32-75`, `${base}-plus-32-57`);
  }
  if (fmt === '74x74') out.push(`${base}-po-rt`, `${base}-plus-po-rt`);
  if (fmt === '90x90') {
    if (/PLUS\s+MRE|MRE\s+PLUS|CRONOS/i.test(u) || /\bMRE\b/.test(u)) out.push(`${base}-plus-mre-rt-90x90`);
    if (/\bSOFT\b/.test(u)) out.push(`${base}-soft-rt-90x90`);
    if (/\bPLUS\b/.test(u)) out.push(`${base}-plus-rt-90x90`);
    out.push(`${base}-plus-rt-90x90`, `${base}-soft-rt-90x90`, `${base}-plus-mre-rt-90x90`);
  }
  if (fmt === '57x57') out.push(`${base}-plus-hd`, `${base}-hd`);
  out.push(base);
  return [...new Set(out.filter(Boolean))];
}
