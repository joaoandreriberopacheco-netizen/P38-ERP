#!/usr/bin/env node
/**
 * Catálogo estático PagLeve — estoque com ficha no site (raio-x verificado).
 * npm run catalogo:publicar-pagleve
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const IN_CSV =
  process.env.PAGLEVE_CSV || path.join(ROOT, 'files', 'pagleve', 'raio-x-pagleve-site-verificado.csv');
const OUT_DEPLOY = path.join(ROOT, 'deploy', 'catalogo-pagleve', 'index.html');
const OUT_DOCS = path.join(ROOT, 'docs', 'imports-local', 'pagleve', 'Catalogo-Pague-Leve-Estoque.html');
const PUBLIC_URL = (
  process.env.CATALOGO_PAGLEVE_PUBLIC_URL || 'https://catalogo-pague-leve.vercel.app/'
).replace(/\/?$/, '/');

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

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtLabel(fmt) {
  return String(fmt || '—').replace(/x/gi, '×');
}

function buildHtml(items) {
  const generated = new Date().toISOString().slice(0, 10);
  const dataJson = JSON.stringify(items).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="pt-BR" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Catálogo de estoque PagLeve — pisos e porcelanatos, Novo Aleixo. Fichas com link oficial do fabricante." />
  <title>Pague Leve — Catálogo de estoque</title>
  <script>(function(){try{var t=localStorage.getItem('pagleve-catalog-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){}})();</script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --pl-red: #c41e2a;
      --pl-red-deep: #9a1520;
      --pl-red-soft: rgba(196, 30, 42, 0.1);
      --pl-gold: #c9a227;
      --pl-gold-soft: rgba(201, 162, 39, 0.15);
      --bg: #0c0c0e;
      --bg-elevated: #141418;
      --surface: #1a1a1f;
      --surface-2: #222228;
      --border: rgba(255,255,255,.08);
      --text: #b8b8c0;
      --text-strong: #f4f4f6;
      --muted: #7a7a88;
      --radius: 12px;
      --shadow: 0 20px 50px rgba(0,0,0,.45);
      font-family: "DM Sans", system-ui, sans-serif;
    }
    html[data-theme="light"] {
      --bg: #f7f5f2;
      --bg-elevated: #ffffff;
      --surface: #ffffff;
      --surface-2: #faf8f5;
      --border: rgba(0,0,0,.08);
      --text: #4a4a52;
      --text-strong: #121214;
      --muted: #6e6e78;
      --shadow: 0 16px 40px rgba(18,18,20,.08);
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.5; min-height: 100vh; }
    a { color: var(--pl-red); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .hero {
      background: linear-gradient(135deg, var(--pl-red-deep) 0%, #1a1a1f 55%, #0c0c0e 100%);
      color: #fff;
      padding: 2.5rem 1.25rem 3rem;
      position: relative;
      overflow: hidden;
    }
    html[data-theme="light"] .hero {
      background: linear-gradient(135deg, var(--pl-red) 0%, #2a2a30 50%, #1a1a1f 100%);
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 80% 60% at 100% 0%, var(--pl-gold-soft), transparent 55%);
      pointer-events: none;
    }
    .hero-inner { max-width: 1100px; margin: 0 auto; position: relative; z-index: 1; }
    .brand-row { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 1rem; }
    .brand h1 {
      font-family: "Playfair Display", Georgia, serif;
      font-size: clamp(1.75rem, 5vw, 2.5rem);
      font-weight: 600;
      margin: 0 0 .25rem;
      letter-spacing: -0.02em;
    }
    .brand .sub { opacity: .88; font-size: .95rem; max-width: 32rem; }
    .brand .tag {
      display: inline-block;
      margin-top: .75rem;
      padding: .35rem .75rem;
      border: 1px solid rgba(255,255,255,.25);
      border-radius: 999px;
      font-size: .75rem;
      text-transform: uppercase;
      letter-spacing: .08em;
      background: rgba(0,0,0,.2);
    }
    .toolbar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
    .btn {
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-strong);
      padding: .5rem .85rem;
      border-radius: 8px;
      font: inherit;
      cursor: pointer;
      font-size: .85rem;
    }
    .btn:hover { border-color: var(--pl-red); }
    .btn-primary { background: var(--pl-red); border-color: var(--pl-red); color: #fff; }
    .btn-primary:hover { background: var(--pl-red-deep); }
    main { max-width: 1100px; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: .75rem;
      margin-bottom: 1.5rem;
    }
    .stat {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1rem;
      box-shadow: var(--shadow);
    }
    .stat strong { display: block; font-size: 1.5rem; color: var(--text-strong); }
    .stat span { font-size: .8rem; color: var(--muted); }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: .75rem;
      margin-bottom: 1.25rem;
      align-items: center;
    }
    .filters input, .filters select {
      flex: 1;
      min-width: 160px;
      padding: .65rem .85rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-strong);
      font: inherit;
    }
    .fmt-section { margin-top: 2rem; }
    .fmt-section h2 {
      font-family: "Playfair Display", serif;
      font-size: 1.35rem;
      color: var(--text-strong);
      border-bottom: 2px solid var(--pl-red-soft);
      padding-bottom: .5rem;
      margin: 0 0 1rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow);
      transition: transform .15s ease, border-color .15s;
    }
    .card:hover { transform: translateY(-2px); border-color: var(--pl-red-soft); }
    .card-img {
      aspect-ratio: 4/3;
      background: var(--surface-2);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .card-img img { width: 100%; height: 100%; object-fit: cover; }
    .card-img .ph { color: var(--muted); font-size: .8rem; padding: 1rem; text-align: center; }
    .card-body { padding: 1rem; flex: 1; display: flex; flex-direction: column; gap: .35rem; }
    .card-body h3 { margin: 0; font-size: .95rem; color: var(--text-strong); line-height: 1.35; }
    .meta { font-size: .78rem; color: var(--muted); }
    .badge {
      display: inline-block;
      font-size: .65rem;
      text-transform: uppercase;
      letter-spacing: .06em;
      padding: .2rem .45rem;
      border-radius: 4px;
      background: var(--pl-red-soft);
      color: var(--pl-red);
      font-weight: 600;
    }
    .badge.ok { background: rgba(34, 150, 90, .15); color: #1a8f52; }
    .badge.pend { background: var(--pl-gold-soft); color: #9a7b10; }
    html[data-theme="dark"] .badge.ok { color: #5fd68a; }
    .card-actions { margin-top: .5rem; }
    .card-actions a {
      font-size: .8rem;
      font-weight: 600;
    }
    footer {
      text-align: center;
      padding: 2rem 1rem;
      font-size: .8rem;
      color: var(--muted);
      border-top: 1px solid var(--border);
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <header class="hero">
    <div class="hero-inner">
      <div class="brand-row">
        <div class="brand">
          <h1>Pague Leve</h1>
          <p class="sub">Pisos e porcelanatos · Posição de estoque Novo Aleixo · só entram itens com ficha no site do fabricante (ou indicação em revisão).</p>
          <span class="tag">Catálogo premium · ${generated}</span>
        </div>
        <div class="toolbar">
          <button type="button" class="btn" id="themeToggle" aria-label="Alternar tema">Tema</button>
          <a class="btn btn-primary" href="https://www.instagram.com/paguelevepisoseporcelanatos/" target="_blank" rel="noopener">Instagram</a>
        </div>
      </div>
    </div>
  </header>
  <main>
    <div class="stats" id="stats"></div>
    <div class="filters">
      <input type="search" id="q" placeholder="Buscar modelo, código, fabricante…" autocomplete="off" />
      <select id="fmtFilter"><option value="">Todos os formatos</option></select>
      <select id="statusFilter">
        <option value="">Todos os status</option>
        <option value="confirmado_site">Com URL oficial</option>
        <option value="indicacao_joao">Em revisão (indicação)</option>
        <option value="nao_encontrado">Sem ficha</option>
      </select>
    </div>
    <div id="catalog"></div>
  </main>
  <footer>
    Grupo Pague Leve · Inspirado na identidade da marca · Powered by <a href="https://p-38erp.vercel.app/" rel="noopener">P38 sistemas</a>
  </footer>
  <script type="application/json" id="catalog-data">${dataJson}</script>
  <script>
    const ITEMS = JSON.parse(document.getElementById('catalog-data').textContent);
    const fmtOrder = (f) => {
      const m = String(f||'').match(/^(\\d+)x(\\d+)$/i);
      if (!m) return [9999, 9999];
      const a = +m[1], b = +m[2];
      return [Math.min(a,b), Math.max(a,b)];
    };
    const byFmt = {};
    for (const it of ITEMS) {
      const f = it.formato || '—';
      if (!byFmt[f]) byFmt[f] = [];
      byFmt[f].push(it);
    }
    const fmtKeys = Object.keys(byFmt).sort((a,b) => {
      const [a1,a2]=fmtOrder(a), [b1,b2]=fmtOrder(b);
      return a1-b1 || a2-b2 || a.localeCompare(b);
    });
    const fmtSel = document.getElementById('fmtFilter');
    for (const f of fmtKeys) {
      const o = document.createElement('option');
      o.value = f;
      o.textContent = f.replace(/x/gi,'×') + ' (' + byFmt[f].length + ')';
      fmtSel.appendChild(o);
    }
    function badge(st) {
      if (st === 'confirmado_site') return '<span class="badge ok">Site</span>';
      if (st === 'indicacao_joao') return '<span class="badge pend">Revisão</span>';
      return '<span class="badge">Órfão</span>';
    }
    function card(it) {
      const img = it.imagem_url
        ? '<img src="'+it.imagem_url.replace(/"/g,'')+'" alt="" loading="lazy" />'
        : '<span class="ph">Sem imagem</span>';
      const link = it.evidencia_url
        ? '<a href="'+it.evidencia_url.replace(/"/g,'')+'" target="_blank" rel="noopener">Ver ficha oficial →</a>'
        : '';
      const title = it.descricao_no_site || it.descricao_erp || it.modelo || it.codigo;
      return '<article class="card" data-fmt="'+it.formato+'" data-status="'+it.status+'" data-q="'+(title+' '+it.codigo+' '+it.fabricante_grupo).toLowerCase()+'">'+
        '<div class="card-img">'+img+'</div>'+
        '<div class="card-body">'+
        badge(it.status)+
        '<h3>'+title.replace(/</g,'&lt;')+'</h3>'+
        '<div class="meta">'+it.codigo+' · '+ (it.formato||'').replace(/x/gi,'×') +'</div>'+
        '<div class="meta">'+ (it.fabricante_grupo||'—') + (it.marca_no_site ? ' · '+it.marca_no_site : '') +'</div>'+
        '<div class="card-actions">'+link+'</div></div></article>';
    }
    const root = document.getElementById('catalog');
    for (const f of fmtKeys) {
      const sec = document.createElement('section');
      sec.className = 'fmt-section';
      sec.dataset.fmt = f;
      sec.innerHTML = '<h2>'+f.replace(/x/gi,'×')+'</h2><div class="grid">'+byFmt[f].map(card).join('')+'</div>';
      root.appendChild(sec);
    }
    function renderStats() {
      const ok = ITEMS.filter(i=>i.status==='confirmado_site').length;
      const rev = ITEMS.filter(i=>i.status==='indicacao_joao').length;
      const orf = ITEMS.filter(i=>i.status==='nao_encontrado').length;
      document.getElementById('stats').innerHTML =
        '<div class="stat"><strong>'+ITEMS.length+'</strong><span>Itens no raio-x</span></div>'+
        '<div class="stat"><strong>'+ok+'</strong><span>Com URL oficial</span></div>'+
        '<div class="stat"><strong>'+rev+'</strong><span>Em revisão</span></div>'+
        '<div class="stat"><strong>'+orf+'</strong><span>Sem ficha</span></div>';
    }
    function applyFilters() {
      const q = document.getElementById('q').value.trim().toLowerCase();
      const fmt = document.getElementById('fmtFilter').value;
      const st = document.getElementById('statusFilter').value;
      document.querySelectorAll('.fmt-section').forEach(sec => {
        let any = false;
        sec.querySelectorAll('.card').forEach(c => {
          const match = (!q || c.dataset.q.includes(q)) &&
            (!fmt || c.dataset.fmt === fmt) &&
            (!st || c.dataset.status === st);
          c.classList.toggle('hidden', !match);
          if (match) any = true;
        });
        sec.classList.toggle('hidden', !any);
      });
    }
    document.getElementById('q').addEventListener('input', applyFilters);
    document.getElementById('fmtFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('themeToggle').addEventListener('click', () => {
      const html = document.documentElement;
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      try { localStorage.setItem('pagleve-catalog-theme', next); } catch(e) {}
    });
    renderStats();
  </script>
</body>
</html>`;
}

function main() {
  if (!fs.existsSync(IN_CSV)) {
    console.error('CSV não encontrado:', IN_CSV);
    process.exit(1);
  }
  const rows = loadCsv(IN_CSV);
  const items = rows.map((r) => ({
    codigo: r.codigo,
    formato: r.formato,
    modelo: r.modelo,
    descricao_erp: r.descricao_erp,
    fabricante_grupo: r.fabricante_grupo,
    marca_no_site: r.marca_no_site,
    descricao_no_site: r.descricao_no_site,
    evidencia_url: r.evidencia_url,
    imagem_url: r.imagem_url,
    status: r.status,
  }));

  const html = buildHtml(items);
  fs.mkdirSync(path.dirname(OUT_DEPLOY), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_DOCS), { recursive: true });
  fs.writeFileSync(OUT_DEPLOY, html);
  fs.writeFileSync(OUT_DOCS, html);
  console.log('Itens:', items.length);
  console.log('Deploy:', OUT_DEPLOY);
  console.log('URL pública (config):', PUBLIC_URL);
}

main();
