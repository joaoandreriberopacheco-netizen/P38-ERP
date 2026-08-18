#!/usr/bin/env node
/**
 * Enriquece lista de pisos (Excel) com specs + imagem do site Formigres.
 *
 * Uso:
 *   node scripts/enriquecer-pisos-formigres.mjs
 *   node scripts/enriquecer-pisos-formigres.mjs --limit 20
 *   node scripts/enriquecer-pisos-formigres.mjs --no-images
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const BASE = 'https://www.formigres.com.br';
const EXCEL = path.join(process.cwd(), 'docs', 'pisos pop e premium.XLSX');
const SHEET = 'pisos pop e premium';
const OUT_DIR = path.join(process.cwd(), 'docs', 'imports-local', 'pisos-pop-premium-formigres');

const FORMATOS_SITE = new Set([
  '20x120', '20x60', '32x45', '32x66', '33x59', '34x60', '40x81', '43x88',
  '45x45', '50x50', '60x120', '60x60', '61x61', '66x66', '81x81', '88x88',
]);

const args = process.argv.slice(2);
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : null;
const noImages = args.includes('--no-images');

function normFmt(s) {
  const m = String(s || '').match(/(\d{2,3})\s*[xX]\s*(\d{2,3})/);
  return m ? `${m[1]}x${m[2]}`.toLowerCase() : '';
}

function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Variantes com acento pt (uma vogal de cada vez). */
function generateAccentVariants(word) {
  const w = stripAccents(word).toUpperCase();
  const map = { A: ['Á', 'Ã'], E: ['Ê', 'É'], I: ['Í'], O: ['Ó', 'Ô'], U: ['Ú'] };
  const out = new Set([w]);
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    if (!map[c]) continue;
    for (const acc of map[c]) out.add(w.slice(0, i) + acc + w.slice(i + 1));
  }
  return [...out];
}

/** Grafias alternativas conhecidas no site vs Excel. */
function spellingAliases(text) {
  const t = String(text || '');
  const out = [];
  if (/CIMENTOCOLOR/i.test(t)) out.push('CIMENTCOLOR', 'CIMENTO');
  if (/CALENDULA/i.test(t)) out.push('CALÊNDULA');
  if (/TRAFEGO/i.test(t)) out.push('TRÁFEGO');
  if (/CORUMBA/i.test(t)) out.push('CORUMBÁ', 'CORU');
  if (/TIMBO/i.test(t)) out.push('TIMBÓ', 'TIM');
  if (/AVELA/i.test(t)) out.push('AVELÃ');
  if (/ARDOSIA/i.test(t)) out.push('ARDÓSIA');
  return out;
}

function buildBuscaVariantes(busca, tokens) {
  const set = new Set();
  const words = [...new Set([busca, ...tokens].filter(Boolean))];

  for (const w of words) {
    set.add(w);
    set.add(stripAccents(w));
    for (const v of generateAccentVariants(w)) set.add(v);
    for (const alias of spellingAliases(w)) set.add(alias);
    if (w.length >= 4) {
      const pre4 = w.slice(0, 4);
      set.add(pre4);
      for (const v of generateAccentVariants(pre4)) set.add(v);
    }
    if (w.length >= 5) {
      const pre5 = w.slice(0, 5);
      set.add(pre5);
      for (const v of generateAccentVariants(pre5)) set.add(v);
    }
  }

  return [...set].filter(Boolean);
}

function normName(s) {
  return stripAccents(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Match flexível: CIMENTOCOLOR ≈ CIMENTCOLOR */
function namesLikelyMatch(a, b) {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const dropO = (s) => s.replace(/O/g, '');
  if (dropO(x).includes(dropO(y)) || dropO(y).includes(dropO(x))) return true;
  return false;
}

function splitGluedToken(t) {
  const m = String(t).match(/^([A-Za-zÀ-ÿ]+)(\d+)$/i);
  return m ? m[1] : t;
}

function parseDesc(desc) {
  const raw = String(desc || '').trim();
  const formato = normFmt(raw);
  const m2Match = raw.match(/\((\d+[,.]?\d*)\)/);
  const m2_excel = m2Match ? m2Match[1].replace(',', '.') : '';

  let rest = raw.replace(/^(PISO|REVESTIMENTO|REV\.?)\s+/i, '');
  if (formato) rest = rest.replace(new RegExp(formato.replace('x', '[xX]'), 'i'), ' ').trim();
  rest = rest.replace(/\s*\([^)]*\).*/g, '').replace(/["']/g, ' ').trim();
  rest = rest.replace(/\b(RT|HD|PEI|LD|LC|JU|P|BOLD|BRILH\w*|MAT\w*|POL\w*|SEMI\w*|ANTI\w*|AD|RELEV\/?\/?OUTS?\w*|RELEVO|OUTSIDE|MR|BG|EXT|PE|ACETINADO)\b/gi, ' ');
  rest = rest.replace(/[-/]+/g, ' ').replace(/\s+/g, ' ').trim();

  const tokens = rest.split(' ').filter(Boolean).map(splitGluedToken);
  const buscaTokens = [];
  for (const t of tokens) {
    const clean = t.replace(/[^A-Za-zÀ-ÿ0-9]/g, '');
    if (!clean || clean.length < 3) continue;
    if (/^\d+$/.test(clean)) continue;
    if (/^(REV|BR|HD|BG|CZ|CL|M)$/i.test(clean)) continue;
    buscaTokens.push(clean);
    if (buscaTokens.length >= 2) break;
  }
  const busca = buscaTokens.join(' ') || splitGluedToken(tokens[0] || '') || '';

  const acab_excel = /MATE/i.test(raw) ? 'mate'
    : /POLIDO|POL\b/i.test(raw) ? 'polido'
    : /BRILH/i.test(raw) ? 'brilhante'
    : /AD\b|ADERENTE|RELEV|OUTS/i.test(raw) ? 'aderente'
    : /SEMI/i.test(raw) ? 'semiderrapante'
    : /GRANILH/i.test(raw) ? 'granilhado'
    : '';

  const buscaVariantes = buildBuscaVariantes(busca, buscaTokens);

  return { raw, formato, m2_excel, busca, buscaVariantes, acab_excel, tokens };
}

function scoreMatch(prod, parsed) {
  let score = 0;
  const fmtSite = normFmt(prod.formato);
  if (parsed.formato && fmtSite === parsed.formato) score += 50;
  else if (parsed.formato && fmtSite) score -= 40;

  const title = stripAccents(prod.titulo).toUpperCase();
  const titleRaw = prod.titulo.toUpperCase();
  for (const tok of stripAccents(parsed.busca).toUpperCase().split(' ')) {
    if (tok && title.includes(tok)) score += 20;
    else if (tok && namesLikelyMatch(tok, prod.titulo)) score += 18;
  }
  for (const tok of parsed.tokens.map((t) => stripAccents(t).toUpperCase())) {
    if (tok.length >= 2 && (title.includes(tok) || titleRaw.includes(tok))) score += 5;
    else if (tok.length >= 4 && namesLikelyMatch(tok, prod.titulo)) score += 8;
  }
  // TAIKO BEGE / TAIKO CAFE
  for (const tok of parsed.tokens) {
    if (/^(BEGE|CAFE|CAFÉ|MARFIM|BG|CZ)$/i.test(tok) && title.includes(stripAccents(tok).toUpperCase())) score += 15;
  }
  // FREIJO CL45 → preferir título com CL
  if (/CL/i.test(parsed.raw) && title.includes('CL')) score += 12;
  if (/\bM[\s-]?45\b/i.test(parsed.raw) && /\bM\s*45\b/.test(prod.titulo)) score += 12;

  if ((prod.marca_nome || '').toLowerCase() === 'premium') score += 3;

  const acab = (prod.acabamento || '').toUpperCase();
  if (parsed.acab_excel === 'mate' && acab.includes('MATE')) score += 8;
  if (parsed.acab_excel === 'polido' && acab.includes('POLIDO')) score += 8;
  if (parsed.acab_excel === 'brilhante' && acab.includes('BRILH')) score += 8;
  if (parsed.acab_excel === 'aderente' && (acab.includes('ADERENTE') || acab.includes('ABS'))) score += 8;
  if (parsed.acab_excel === 'granilhado' && acab.includes('GRANILH')) score += 8;

  return score;
}

async function buscar(q) {
  const res = await fetch(`${BASE}/api/busca.php?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.produtos || [];
}

async function buscarComVariantes(parsed) {
  const seen = new Set();
  const all = [];
  for (const q of parsed.buscaVariantes) {
    const prods = await buscar(q);
    for (const p of prods) {
      if (!seen.has(p.id)) { seen.add(p.id); all.push(p); }
    }
  }
  return all;
}

function absUrl(rel) {
  if (!rel) return '';
  return rel.startsWith('http') ? rel : BASE + rel;
}

function safeName(s) {
  return String(s || 'sem-nome').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function maybeDownload(url, filePath) {
  if (!url || noImages) return false;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

async function main() {
  if (!fs.existsSync(EXCEL)) {
    console.error('Excel não encontrado:', EXCEL);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, 'imagens'), { recursive: true });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`Aba "${SHEET}" não encontrada`);

  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    rows.push({ n, desc: row.getCell(1).value, estoque: row.getCell(2).value });
  });

  const selected = limit ? rows.slice(0, limit) : rows;
  const results = [];
  let stats = { encontrado: 0, ignorado: 0, revisar: 0 };

  for (const row of selected) {
    const parsed = parseDesc(row.desc);

    if (!parsed.formato || !FORMATOS_SITE.has(parsed.formato)) {
      stats.ignorado++;
      results.push({
        linha: row.n,
        descricao_excel: parsed.raw,
        estoque_m2: row.estoque,
        termo_busca: parsed.busca,
        formato_excel: parsed.formato || '—',
        m2_excel: parsed.m2_excel,
        encontrado: '—',
        formato_site: '—',
        acabamento_site: '—',
        marca_site: '—',
        m2_caixa: parsed.m2_excel || '—',
        imagem_url: '—',
        imagem_arquivo: '—',
        status: 'ignorado (formato fora do site)',
      });
      continue;
    }

    const prods = parsed.busca ? await buscarComVariantes(parsed) : [];
    let best = null;
    let bestScore = -999;
    for (const p of prods) {
      const sc = scoreMatch(p, parsed);
      if (sc > bestScore) { bestScore = sc; best = p; }
    }

    const ok = best && bestScore >= 30;
    const imgUrl = ok ? absUrl(best.imagem_url) : '';
    let imgFile = '';
    if (imgUrl) {
      const ext = path.extname(new URL(imgUrl).pathname) || '.jpg';
      imgFile = `${String(row.n).padStart(3, '0')}-${safeName(best.titulo)}${ext}`;
      await maybeDownload(imgUrl, path.join(OUT_DIR, 'imagens', imgFile));
    }

    const status = ok ? 'encontrado' : 'revisar';
    if (ok) stats.encontrado++; else stats.revisar++;

    results.push({
      linha: row.n,
      descricao_excel: parsed.raw,
      estoque_m2: row.estoque,
      termo_busca: parsed.busca,
      formato_excel: parsed.formato,
      m2_excel: parsed.m2_excel,
      encontrado: ok ? best.titulo : '—',
      formato_site: ok ? best.formato : '—',
      acabamento_site: ok ? best.acabamento : '—',
      marca_site: ok ? best.marca_nome : '—',
      m2_caixa: parsed.m2_excel || '—',
      imagem_url: imgUrl || '—',
      imagem_arquivo: imgFile || '—',
      score: ok ? bestScore : 0,
      status,
    });

    if (row.n % 20 === 0) process.stderr.write(`… ${row.n}/${selected.length}\n`);
  }

  const header = Object.keys(results[0] || {});
  const csv = [
    header.join(';'),
    ...results.map((r) => header.map((k) => csvEscape(r[k])).join(';')),
  ].join('\n') + '\n';

  const csvPath = path.join(OUT_DIR, 'resultado-completo.csv');
  fs.writeFileSync(csvPath, csv);

  const summary = {
    total: results.length,
    ...stats,
    csv: csvPath,
    imagens: path.join(OUT_DIR, 'imagens'),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'resumo.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
