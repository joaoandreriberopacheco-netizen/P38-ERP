#!/usr/bin/env node
/**
 * PagLeve — enriquece raio-x com fabricante (regra + consenso por formato)
 * e descrição oficial no site da fábrica (sem imagem/preço).
 *
 * node scripts/catalogo/pagleve-enriquecer-fabrica.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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

function escapeCsv(val) {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, rows, fieldnames) {
  const lines = [fieldnames.join(',')];
  for (const r of rows) {
    lines.push(fieldnames.map((k) => escapeCsv(r[k])).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}
import {
  buildSnapshot,
  fetchAllProdutos,
  findInSnapshot,
} from '../lib/formigresSnapshot.mjs';
import { normFmt, stripAccents } from '../lib/formigresCatalog.mjs';

const IN_CSV = process.env.PAGLEVE_RAIO_X || '/opt/cursor/artifacts/raio-x-produtos.csv';
const OUT_CSV = process.env.PAGLEVE_FABRICA_OUT || '/opt/cursor/artifacts/raio-x-pagleve-fabrica.csv';
const OUT_FMT = process.env.PAGLEVE_FMT_OUT || '/opt/cursor/artifacts/raio-x-consenso-formato.csv';

const LUME_BASE = 'https://lumeceramica.com.br';
const UA = 'P38-PagLeve-catalogo/1.0';

function inferGrupoFromText(desc, fabricanteCol = '') {
  if (String(fabricanteCol).trim().toUpperCase() === 'LUME') return 'LUME';
  const u = String(desc || '').toUpperCase();
  if (/\bROCHAPRIME\b|\bROCHAMAXX\b/.test(u)) return 'FORMIGRES';
  if (/\bSEMI\s*GRES\b/.test(u) && /\b62\s*[xX]\s*119\b/.test(u)) return 'LUME';
  if (/\bREV\s+62\s*[xX]\s*119\b/.test(u) && /\bLAPAD|PIETRA|ARCADIA|TAURUS|PATAGONIA/i.test(u)) return 'LUME';
  if (/\b2\s*[xX]\s*90\b|\b22\s*[xX]\s*90\b/.test(u) && /\bRELEV|OUTSIDE|LEGNO|PEROBA|TECA|SUGI/i.test(u)) return 'LUME';
  if (/\b56\s*[xX]\s*113\b/.test(u) && /\bGI01|DIVINA|MARANATA|ILUMINADO/i.test(u)) return 'LUME';
  if (/\b5\s*[xX]\s*89\b|\b45\s*[xX]\s*89\b/.test(u) && /PORTORIO|ARTEMIS|CANNES/i.test(u)) return 'LUME';
  if (/\bETNA\b|\bCECAFI\b/.test(u)) return 'CECAFI';
  if (/\bINCEFRA\b|\bDESIGN\s*ESM/i.test(u)) return 'INCEFRA';
  if (/\b46\s*[xX]\s*46\b/.test(u) && /\bHD\b/.test(u)) return 'CERBRAS';
  if (/\bARIELLE\b|\bCARMELO\b/i.test(u)) return 'CARMELO_FIOR';
  if (/\bHD\b|\bPLUS\b|\bLUX\b|\bGRAN\s/.test(u) || /\b7[04]\s*[xX]\s*7[04]\b/.test(u)) return 'FORMIGRES';
  if (/\bPISO\b|\bREV\b/.test(u)) return 'FORMIGRES';
  return '';
}

function applyFormatConsensus(rows) {
  const byFmt = new Map();
  for (const r of rows) {
    const fmt = (r.formato || '').toLowerCase();
    if (!fmt) continue;
    if (!byFmt.has(fmt)) byFmt.set(fmt, []);
    byFmt.get(fmt).push(r);
  }

  const summary = [];
  for (const [fmt, list] of [...byFmt.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const counts = {};
    for (const r of list) {
      const g = r.grupo_inferido || '';
      if (!g) continue;
      counts[g] = (counts[g] || 0) + 1;
    }
    const total = list.length;
    const labeled = Object.values(counts).reduce((a, b) => a + b, 0);
    let winner = '';
    let winnerN = 0;
    for (const [g, n] of Object.entries(counts)) {
      if (n > winnerN) {
        winnerN = n;
        winner = g;
      }
    }
    const pct = labeled ? Math.round((winnerN / labeled) * 100) : 0;
    const apply = winner && labeled >= 3 && pct >= 60;
    summary.push({
      formato: fmt,
      total,
      labeled,
      grupo_majoritario: winner,
      pct_majoritario: pct,
      aplicar_consenso: apply ? 'sim' : 'não',
    });
    if (apply) {
      for (const r of list) {
        if (!r.grupo_inferido) {
          r.grupo_inferido = winner;
          r.grupo_fonte = `consenso_formato (${winnerN}/${labeled}=${pct}%)`;
        }
      }
    }
  }
  return summary;
}

function descricaoFabricaFormigres(match) {
  if (!match) return '';
  const parts = [
    match.titulo,
    match.formato ? `${match.formato}` : '',
    match.tipo,
    match.acabamento,
    match.marca_nome ? `marca ${match.marca_nome}` : '',
  ].filter(Boolean);
  return parts.join(' · ').replace(/\s+/g, ' ').trim();
}

function fabricanteSiteFromGrupo(grupo) {
  const map = {
    FORMIGRES: 'Grupo Formigres',
    LUME: 'Lume Cerâmica',
    CERBRAS: 'Cerbras',
    CARMELO_FIOR: 'Carmelo Fior',
    CERAL: 'Grupo Ceral',
    INCEFRA: 'Incefra',
    CECAFI: 'Cecafi',
  };
  return map[grupo] || '';
}

function marcaFromDesc(desc) {
  const u = String(desc || '').toUpperCase();
  if (/\bROCHAPRIME\b/.test(u)) return 'Rochaprime';
  if (/\bROCHAMAXX\b/.test(u)) return 'Rochamaxx';
  if (/\bPLUS\b|\bLUX\b/.test(u)) return 'Premium';
  if (/\bHD\d{2}\b|\bHD-?\d{2}\b/.test(u)) return 'Formigres HD';
  if (/\bSEMI\s*GRES\b/.test(u)) return 'Semi gres';
  return '';
}

function descricaoFallbackErp(row) {
  const parts = [
    row.formato ? `${row.formato}` : '',
    row.modelo,
    row.acab,
    row.superficie,
  ].filter(Boolean);
  return parts.join(' · ').replace(/\s+/g, ' ').trim();
}

async function buscaLume(query) {
  const url = `${LUME_BASE}/?s=${encodeURIComponent(query)}`;
  let html = '';
  try {
    html = execSync(`curl -sL --max-time 20 ${JSON.stringify(url)}`, {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    return null;
  }
  if (!html) return null;
  const re = /<h\d[^>]*>\s*([^<]{4,80}?)\s*<\/h\d>/gi;
  const titles = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const t = m[1].replace(/\s+/g, ' ').trim();
    if (t.length > 3 && !/filtrar|categorias|lançamento/i.test(t)) titles.push(t);
  }
  if (!titles.length) return null;
  const qn = stripAccents(query).toUpperCase();
  const best = titles.find((t) => stripAccents(t).toUpperCase().includes(qn.split(' ')[0])) || titles[0];
  return { titulo: best, fabricante: 'LUME', url };
}

function modeloBusca(row) {
  const m = String(row.modelo || '').replace(/\b0X\d+/gi, '').trim();
  const tokens = m.split(/\s+/).filter((t) => t.length > 2 && !/^(VER|PEI)$/i.test(t));
  return tokens.slice(0, 3).join(' ') || m.slice(0, 40);
}

async function main() {
  const rows = loadCsv(IN_CSV);

  for (const r of rows) {
    r.grupo_inferido = inferGrupoFromText(r.descricao_original, r.fabricante);
    r.grupo_fonte = r.grupo_inferido ? 'regra_descricao' : '';
    if (r.fabricante?.toUpperCase() === 'LUME' && !r.grupo_inferido) {
      r.grupo_inferido = 'LUME';
      r.grupo_fonte = 'coluna_fabricante';
    }
  }

  const fmtSummary = applyFormatConsensus(rows);
  writeCsv(OUT_FMT, fmtSummary, [
    'formato',
    'total',
    'labeled',
    'grupo_majoritario',
    'pct_majoritario',
    'aplicar_consenso',
  ]);

  console.log('Baixando catálogo Formigres (1 request)...');
  const snap = buildSnapshot(await fetchAllProdutos());
  console.log('Formigres produtos:', snap.count);

  let nForm = 0;
  let nLume = 0;
  let nPend = 0;

  for (const r of rows) {
    r.fabricante_site = '';
    r.marca_site = '';
    r.descricao_fabrica = '';
    r.match_score = '';
    r.match_fonte = '';
    r.match_url = '';

    const grupo = r.grupo_inferido || 'FORMIGRES';
    const descBusca = r.descricao_original || `${r.formato} ${r.modelo}`;

    const grupoEff = grupo || 'FORMIGRES';
    r.fabricante_site = fabricanteSiteFromGrupo(grupoEff);
    r.marca_site = marcaFromDesc(descBusca) || r.marca_site;

    if (grupoEff === 'LUME') {
      const q = modeloBusca(r);
      const hit = await buscaLume(q);
      if (hit) {
        r.marca_site = r.marca_site || 'Lume';
        r.descricao_fabrica = hit.titulo;
        r.match_fonte = 'lume_busca_site';
        r.match_url = `${LUME_BASE}/?s=${encodeURIComponent(q)}`;
        nLume++;
      } else {
        r.descricao_fabrica = descricaoFallbackErp(r);
        r.match_fonte = 'lume_erp_fallback';
        nPend++;
      }
      await new Promise((res) => setTimeout(res, 250));
      continue;
    }

    if (grupoEff === 'FORMIGRES') {
      const { match, score, reason } = findInSnapshot(snap, descBusca, {
        minScore: 28,
        requireFormato: true,
      });
      if (match) {
        r.marca_site = match.marca_nome || r.marca_site;
        r.descricao_fabrica = descricaoFabricaFormigres(match);
        r.match_score = String(score);
        r.match_fonte = 'formigres_site';
        r.match_url = match.produto_url || '';
        nForm++;
      } else {
        r.descricao_fabrica = descricaoFallbackErp(r);
        r.match_score = String(score ?? '');
        r.match_fonte = 'formigres_erp_fallback';
        if (/ROCHAPRIME|ROCHAMAXX/i.test(descBusca)) {
          r.match_fonte = 'formigres_linha_rocha_erp';
        }
        nPend++;
      }
      continue;
    }

    r.descricao_fabrica = descricaoFallbackErp(r);
    r.match_fonte = 'pendente_conector';
    nPend++;
  }

  const fieldnames = [
    'codigo',
    'formato',
    'modelo',
    'm2_cx',
    'grupo_inferido',
    'grupo_fonte',
    'fabricante_site',
    'marca_site',
    'descricao_fabrica',
    'match_score',
    'match_fonte',
    'match_url',
    'descricao_original',
  ];

  writeCsv(
    OUT_CSV,
    rows.map((r) => {
      const o = {};
      for (const k of fieldnames) o[k] = r[k] ?? '';
      return o;
    }),
    fieldnames,
  );

  console.log('Escrito:', OUT_CSV);
  console.log('Consenso formato:', OUT_FMT);
  console.log('Match Formigres:', nForm, 'Lume:', nLume, 'Pendente/sem:', nPend);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
