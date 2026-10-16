#!/usr/bin/env node
/**
 * Classifica estoque PagLeve (CSV raio-x) → JSON no formato do catálogo Tintão.
 * npm run catalogo:classificar-pagleve
 */
import fs from 'node:fs';
import path from 'node:path';
import { classificarFormigres, resumirClassificacoes } from '../lib/formigresClassificar.mjs';
import { referenciaResistenciaCatalogo } from '../lib/paglevePeiResistencia.mjs';

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
  return { tipo, acabamento: acab };
}

function inferAcabamentoLabel(descErp, descSite, classif, row = {}) {
  const siteAcabExtra = String(row.site_acabamento_label || '').trim();
  if (siteAcabExtra) return siteAcabExtra;
  const { acabamento: siteAcab } = parseTipoAcabFromSite(descSite);
  if (siteAcab && !/CONHEÇA|MODELOS/i.test(siteAcab)) {
    if (/ACETINAD/i.test(siteAcab)) return 'Acetinado';
    if (/^MATE$/i.test(siteAcab)) return 'Mate';
    if (/BRILHANTE/i.test(siteAcab)) return 'Brilhante';
    if (/GRANILHAD/i.test(siteAcab)) return 'Granilhado';
    if (/POLIDO/i.test(siteAcab)) return 'Polido';
    if (/GOTEJAD/i.test(siteAcab)) return 'Gotejado';
    return siteAcab.charAt(0) + siteAcab.slice(1).toLowerCase();
  }
  const u = String(descErp || '').toUpperCase();
  if (/RT\s*POLIDO|\bPOLIDO\b/.test(u) && classif.linha === 'polida') return 'Polido';
  if (/GRANILHAD/.test(u)) return 'Granilhado';
  if (/GOTEJAD/.test(u)) return 'Gotejado';
  if (/ACETINAD/.test(u)) return 'Acetinado';
  if (/\bMATE\b/.test(u)) return 'Mate';
  if (/BRILH/.test(u)) return 'Brilhante';
  if (/brilhante/i.test(descSite)) return 'Brilhante';
  if (classif.subtipo === 'antiderrapante') return 'Protetiva aderente';
  if (classif.subtipo === 'semiderrapante') return 'Granilhado';
  if (classif.variante_lisa === 'mate') return 'Mate';
  if (classif.variante_lisa === 'brilhante') return 'Brilhante';
  return '';
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

function tituloCatalogo(row, descricao) {
  const site = String(row.descricao_no_site || '').trim();
  if (site) return site;
  const modelo = String(row.modelo || '').trim();
  if (modelo && !/^\(ver descri/i.test(modelo)) return modelo;
  return descricao;
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
  const items = rows.map((row) => {
    const descricao = row.descricao_erp || row.modelo || row.codigo;
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
    const imagens = parseImagensJson(row.imagens_json, row.imagem_url);
    return {
      codigo_tintao: row.codigo,
      modelo: row.modelo || '',
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
      formigres_titulo: tituloCatalogo(row, descricao),
      formigres_tipo: siteHints.tipo,
      formigres_acabamento: siteHints.acabamento || acabLabel.toUpperCase(),
      acabamento_label: acabLabel,
      marca_nome: row.marca_no_site || row.fabricante_grupo || '',
      fabricante_grupo: row.fabricante_grupo || '',
      referencia: referenciaResistenciaCatalogo(descricao, row.site_classificacao_pei) || row.codigo,
      produto_url: row.evidencia_url || '',
      imagem_url: row.imagem_url || imagens[0]?.url || '',
      imagens,
      preco_m2: null,
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
