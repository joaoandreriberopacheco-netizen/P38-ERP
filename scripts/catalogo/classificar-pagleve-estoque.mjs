#!/usr/bin/env node
/**
 * Classifica estoque PagLeve (CSV raio-x) → JSON no formato do catálogo Tintão.
 * npm run catalogo:classificar-pagleve
 */
import fs from 'node:fs';
import path from 'node:path';
import { classificarFormigres, resumirClassificacoes } from '../lib/formigresClassificar.mjs';
import {
  extrairClassificacaoPei,
  isClasseUsoPei,
  referenciaResistenciaCatalogo,
} from '../lib/paglevePeiResistencia.mjs';
import { modeloComercialCatalogo, raioXProdutoDescricao } from '../lib/raioXProdutoDescricao.mjs';
import { resolveFormatoPagLeve } from '../lib/pagleveFormatoOcr.mjs';
import { loadPrecosSiah, resolvePrecoSiah } from '../lib/paglevePrecosSiah.mjs';

const ROOT = process.cwd();
const IN_CSV =
  process.env.PAGLEVE_CSV || path.join(ROOT, 'files', 'pagleve', 'raio-x-pagleve-site-verificado.csv');
const OUT_DIR = path.join(ROOT, 'files', 'pagleve', 'classificacao');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function loadCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCsvLine(lines[i]);
    const o = {};
    headers.forEach((h, j) => {
      o[h] = cols[j] ?? '';
    });
    rows.push(o);
  }
  return rows;
}

function parseM2Caixa(descricao) {
  const m = String(descricao || '').match(/\((\d+[,.]\d+)\)/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseTipoAcabFromSite(descricaoNoSite) {
  const raw = String(descricaoNoSite || '');
  const upper = raw.toUpperCase();
  if (/\bMRE\b/.test(upper) || /MAIOR\s+RESIST/.test(upper) || /ESCORREGAMENTO/.test(upper)) {
    const partsEarly = raw.split('·').map((p) => p.trim()).filter(Boolean);
    const tipoPart = partsEarly.find((p) => /bold|retificad/i.test(p)) || '';
    let tipo = '';
    if (/bold/i.test(tipoPart)) tipo = 'BOLD';
    else if (/retificad/i.test(tipoPart)) tipo = 'RETIFICADO';
    return { tipo, acabamento: 'MRE' };
  }
  if (/RT\s*POLIDO|\bPOLIDO\b|\bPOLIDA\b/.test(upper)) {
    return { tipo: '', acabamento: 'POLIDO' };
  }
  const parts = raw.split('·').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { tipo: '', acabamento: '' };
  for (const p of parts) {
    if (/RT\s*POLIDO|\bPOLIDO\b|\bPOLIDA\b/i.test(p)) {
      return { tipo: '', acabamento: 'POLIDO' };
    }
  }
  const tipoPart = parts.find((p) => /bold|retificad/i.test(p)) || '';
  const acabPart = parts[parts.length - 1] || '';
  let tipo = '';
  if (/bold/i.test(tipoPart)) tipo = 'BOLD';
  else if (/retificad/i.test(tipoPart)) tipo = 'RETIFICADO';
  const acab = acabPart.toUpperCase().replace(/\s+/g, ' ').trim();
  if (isClasseUsoPei(acab)) return { tipo, acabamento: '' };
  return { tipo, acabamento: acab };
}

function inferAcabamentoFromDescricaoErp(descErp, classif) {
  const u = String(descErp || '').toUpperCase();
  if (/RT\s*POLIDO|\bPOLIDO\b/.test(u) && classif.linha === 'polida') return 'Polido';
  if (/\bMRE\b/.test(u)) return 'MRE';
  if (/GRANILHAD/.test(u)) return 'Granilhado';
  if (/GOTEJAD/.test(u)) return 'Gotejado';
  if (/ACETINAD/.test(u)) return 'Acetinado';
  if (/\bMATE\b/.test(u)) return 'Mate';
  if (/BRILH/.test(u)) return 'Brilhante';
  if (/ESMALT/.test(u)) return 'Esmaltado';
  if (classif.subtipo === 'antiderrapante') return 'Antiderrapante';
  if (classif.subtipo === 'semiderrapante') return 'Semiderrapante';
  if (classif.variante_lisa === 'mate') return 'Mate';
  if (classif.variante_lisa === 'brilhante') return 'Brilhante';
  return '';
}

function inferAcabamentoLabel(descErp, descSite, classif, row = {}) {
  const hasPeiUso = Boolean(extrairClassificacaoPei(descErp) || extrairClassificacaoPei(row.site_classificacao_pei || ''));
  const siteAcabExtra = String(row.site_acabamento_label || '').trim();
  if (siteAcabExtra && !/^(bold|ret|retificado)$/i.test(siteAcabExtra) && !isClasseUsoPei(siteAcabExtra)) {
    return siteAcabExtra;
  }

  const u = String(descErp || '').toUpperCase();
  const siteUpper = String(descSite || '').toUpperCase();
  if (/RT\s*POLIDO|\bPOLIDO\b/.test(u) && classif.linha === 'polida') return 'Polido';
  if (/\bMRE\b/.test(u) || (/\bMRE\b/.test(siteUpper) && !/BRILHANTE\s*$/i.test(String(descSite || '').trim()))) {
    return 'MRE';
  }
  if (/GRANILHAD/.test(u)) return 'Granilhado';
  if (/GOTEJAD/.test(u)) return 'Gotejado';
  if (/ACETINAD/.test(u)) return 'Acetinado';
  if (/\bMATE\b/.test(u)) return 'Mate';
  if (/BRILH/.test(u)) return 'Brilhante';
  if (/ESMALT/.test(u)) return 'Esmaltado';

  const { acabamento: siteAcab } = parseTipoAcabFromSite(descSite);
  if (hasPeiUso) return inferAcabamentoFromDescricaoErp(descErp, classif);
  if (siteAcab && !/CONHEÇA|MODELOS/i.test(siteAcab) && !/^(BOLD|RETIFICADO|RET)$/i.test(siteAcab)) {
    if (/ACETINAD/i.test(siteAcab)) return 'Acetinado';
    if (/^MATE$/i.test(siteAcab)) return 'Mate';
    if (/^MRE$/i.test(siteAcab)) return 'MRE';
    if (/BRILHANTE/i.test(siteAcab) && !/\bMRE\b/i.test(descSite)) return 'Brilhante';
    if (/GRANILHAD/i.test(siteAcab)) return 'Granilhado';
    if (/POLIDO/i.test(siteAcab)) return 'Polido';
    if (/GOTEJAD/i.test(siteAcab)) return 'Gotejado';
    if (isClasseUsoPei(siteAcab)) return inferAcabamentoFromDescricaoErp(descErp, classif);
    return siteAcab.charAt(0) + siteAcab.slice(1).toLowerCase();
  }
  if (/brilhante/i.test(descSite)) return 'Brilhante';
  if (classif.subtipo === 'antiderrapante') return 'Antiderrapante';
  if (classif.subtipo === 'semiderrapante') return 'Semiderrapante';
  if (classif.variante_lisa === 'mate') return 'Mate';
  if (classif.variante_lisa === 'brilhante') return 'Brilhante';
  return inferAcabamentoFromDescricaoErp(descErp, classif);
}

function parseImagensJson(raw, imagemUrl) {
  const out = [];
  try {
    const arr = JSON.parse(raw || '[]');
    if (Array.isArray(arr)) {
      for (const url of arr) {
        if (url) out.push({ url: String(url), tipo: 'principal' });
      }
    }
  } catch {
    /* ignore */
  }
  if (!out.length && imagemUrl) out.push({ url: imagemUrl, tipo: 'principal' });
  return out;
}

function mapStatus(status) {
  if (status === 'confirmado_site') return 'encontrado';
  if (status === 'indicacao_joao') return 'indicacao';
  return 'sem_ficha';
}

function titleCaseModelo(str = '') {
  return String(str || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function nomeModeloPrincipal(row, descricao) {
  return modeloComercialCatalogo(row.codigo, descricao, row.modelo);
}

function linhaCatalogoLabel(classif, siteHints, descErp) {
  if (classif.linha === 'bold') return 'BOLD';
  if (classif.linha === 'retificada' || classif.linha === 'polida') return 'RET';
  const u = String(descErp || '').toUpperCase();
  if (/\bBOLD\b/.test(u)) return 'BOLD';
  if (/\bRT\b|\bRET\b|\bRETIFIC/.test(u)) return 'RET';
  if (siteHints.tipo === 'BOLD') return 'BOLD';
  if (siteHints.tipo === 'RETIFICADO') return 'RET';
  return '';
}

/** Subtítulo: modelo · formato · BOLD|RET · textura (Brilhante, Mate, …). */
function subtituloCatalogoPagLeve(row, descricao, classif, acabLabel, siteHints) {
  const parts = [];
  const nome = nomeModeloPrincipal(row, descricao);
  if (nome) parts.push(nome);
  const fmt = String(row.formato || '').replace(/×/g, 'x').toLowerCase();
  if (fmt) parts.push(fmt);
  const linha = linhaCatalogoLabel(classif, siteHints, descricao);
  if (linha) parts.push(linha);
  const tex = String(acabLabel || '').trim();
  if (tex && !isClasseUsoPei(tex) && tex.toUpperCase() !== linha) parts.push(tex);
  return parts.join(' · ');
}

/** PagLeve: polida é textura (acabamento), não linha comercial à parte de Bold/Retificada. */
function normalizarLinhaPagLeve(classif, acabLabel) {
  if (classif.linha !== 'polida') return classif;
  const acab = String(acabLabel || '').trim();
  return {
    ...classif,
    linha: 'retificada',
    subtipo: 'polida',
    variante_lisa: null,
    rotulo: acab ? `Retificada — ${acab.toLowerCase()}` : 'Retificada — polido',
    motivo: classif.motivo ? `${classif.motivo}; polida→acabamento em retificada` : 'polida→acabamento em retificada',
  };
}

function main() {
  if (!fs.existsSync(IN_CSV)) {
    console.error('CSV não encontrado:', IN_CSV);
    process.exit(1);
  }
  const rows = loadCsv(IN_CSV);
  const precosSiah = loadPrecosSiah();
  const items = rows.map((row) => {
    const descricao = row.descricao_erp || row.modelo || row.codigo;
    row.formato = resolveFormatoPagLeve(descricao, row.formato) || row.formato;
    const siteHints = parseTipoAcabFromSite(row.descricao_no_site);
    const classif = classificarFormigres({
      tipo: siteHints.tipo,
      acabamento: siteHints.acabamento,
      titulo: row.descricao_no_site || descricao,
      descricao,
    });
    let acabLabel = inferAcabamentoLabel(descricao, row.descricao_no_site, classif, row);
    const classifPl = normalizarLinhaPagLeve(classif, acabLabel);
    if (classifPl.linha === 'retificada' && classif.linha === 'polida' && !acabLabel) {
      acabLabel = 'Polido';
    }
    if (isClasseUsoPei(acabLabel)) {
      acabLabel = inferAcabamentoFromDescricaoErp(descricao, classifPl);
    }
    const imagens = parseImagensJson(row.imagens_json, row.imagem_url);
    const catalogoNomeModelo = nomeModeloPrincipal(row, descricao);
    const catalogoSubtitulo = subtituloCatalogoPagLeve(row, descricao, classifPl, acabLabel, siteHints);
    const peiUso = extrairClassificacaoPei(descricao) || extrairClassificacaoPei(row.site_classificacao_pei || '');
    const precoHit = precosSiah
      ? resolvePrecoSiah(
          {
            codigo_tintao: row.codigo,
            modelo: catalogoNomeModelo || row.modelo,
            formato: (row.formato || '').replace(/×/g, 'x'),
            descricao,
          },
          precosSiah,
        )
      : { preco_m2: null };
    return {
      codigo_tintao: row.codigo,
      modelo: catalogoNomeModelo || row.modelo || '',
      catalogo_nome_modelo: catalogoNomeModelo,
      descricao,
      formato: (row.formato || '').replace(/×/g, 'x'),
      linha: classifPl.linha,
      subtipo: classifPl.subtipo,
      variante_lisa: classifPl.variante_lisa,
      rotulo: classifPl.rotulo,
      confianca: classifPl.confianca,
      motivo: classifPl.motivo,
      match_status: mapStatus(row.status),
      match_score: row.status === 'confirmado_site' ? 100 : 0,
      formigres_id: (String(row.evidencia_url || '').match(/formigres\.com\.br\/produto\/(\d+)/i) || [])[1] || '',
      formigres_titulo: catalogoSubtitulo,
      formigres_tipo: siteHints.tipo,
      formigres_acabamento:
        (siteHints.acabamento && !isClasseUsoPei(siteHints.acabamento) ? siteHints.acabamento : acabLabel.toUpperCase()),
      acabamento_label: acabLabel,
      marca_nome: row.marca_no_site || row.fabricante_grupo || '',
      fabricante_grupo: row.fabricante_grupo || '',
      pei_uso: peiUso,
      referencia: referenciaResistenciaCatalogo(descricao, row.site_classificacao_pei) || row.codigo,
      produto_url: row.evidencia_url || '',
      imagem_url: row.imagem_url || imagens[0]?.url || '',
      imagens,
      preco_m2: precoHit.preco_m2 ?? null,
      preco_fonte: precoHit.fonte || '',
      codigo_siah: precoHit.codigo_siah || '',
      m2_por_caixa: parseM2Caixa(descricao),
      unidade: '',
      status_site: row.status,
      observacao: row.observacao || '',
    };
  });

  const resumo = resumirClassificacoes(items);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(OUT_DIR, `pagleve-estoque-${stamp}.json`);
  const payload = {
    geradoEm: new Date().toISOString(),
    fonte: IN_CSV,
    resumo,
    itens: items,
  };
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    itens: items.length,
    resumo: resumo.porRotulo,
    json: jsonPath,
  }, null, 2));
}

main();
