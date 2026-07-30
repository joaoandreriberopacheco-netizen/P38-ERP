/**
 * Catálogo UI — AST (Babel) página a página + ficheiros importados.
 * Códigos: CAT-PG-<Page>.<Âmbito>.<Widget>.<n> e CAT-PG-<Page>.<Componente>.<Âmbito>.<Widget>.<n>
 *
 * npm run catalogo:build-preview
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractPageAst } from './catalog-ast-extract.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pagesDir = join(root, 'src', 'pages');

const BOOTSTRAP = JSON.parse(
  readFileSync(join(root, 'docs', 'migration', 'catalogo_interface_bootstrap.json'), 'utf8')
);

function pageFileForKey(key) {
  const map = {
    Produtos: 'Produtos.jsx',
    Agefin: 'AgefinConsulta.jsx',
  };
  return join(pagesDir, map[key] || `${key}.jsx`);
}

function shortCodeFor(value) {
  const hex = createHash('sha1').update(String(value)).digest('hex').slice(0, 12);
  const num = BigInt(`0x${hex}`);
  const base36 = num.toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return base36.padStart(7, '0').slice(0, 7);
}

function attachShortCodes(widgets) {
  return (widgets || []).map((w) => ({
    ...w,
    short_code: shortCodeFor(w.code || `${w.kind}:${w.scope}:${w.hint || ''}`),
  }));
}

/** Marcadores explícitos no JSX (zonas: barra de pesquisa, etc.) */
function extractExplicitMarkers(code, pageStable) {
  const out = [];
  for (const m of code.matchAll(/\bdata-catalog-code\s*=\s*["']([^"']+)["']/g)) {
    const line = code.slice(0, m.index).split('\n').length;
    out.push({
      code: m[1],
      kind: 'marcador',
      scope: 'explicit',
      line,
      column: 0,
      hint: 'data-catalog-code',
      file: 'inline',
      source_location_raw: `inline:${line}:0`,
    });
  }
  for (const m of code.matchAll(/\{\/\*\s*@catalog\s+([A-Za-z0-9._-]+)\s*\*\/\s*\}/g)) {
    const line = code.slice(0, m.index).split('\n').length;
    out.push({
      code: m[1],
      kind: 'marcador',
      scope: 'comment',
      line,
      column: 0,
      hint: '@catalog',
      file: 'inline',
      source_location_raw: `inline:${line}:0`,
    });
  }
  return out;
}

function buildPayload() {
  const pageDetails = {};
  for (const mod of BOOTSTRAP.modules) {
    for (const pk of mod.pages) {
      const abs = pageFileForKey(pk);
      const ast = extractPageAst(pk, root, abs);
      if (!ast.missing && existsSync(abs)) {
        const src = readFileSync(abs, 'utf8');
        const markers = extractExplicitMarkers(src, ast.pageStable);
        if (markers.length && ast.sections[0]) {
          ast.sections[0].widgets = [...markers, ...ast.sections[0].widgets];
        }
      }
      ast.sections = (ast.sections || []).map((section) => ({
        ...section,
        widgets: attachShortCodes(section.widgets),
      }));
      pageDetails[pk] = ast;
    }
  }
  return {
    generated_at: new Date().toISOString(),
    description:
      'Widgets extraídos por AST no sistema inteiro (Button, Input, Tabs, Dialog, Table, …) por âmbito de função; cada item recebe código hierárquico e short_code alfanumérico de 7 caracteres.',
    modules: BOOTSTRAP.modules,
    pageDetails,
  };
}

function buildOverlayManifest(payload) {
  const items = [];
  for (const page of Object.values(payload.pageDetails || {})) {
    for (const section of page.sections || []) {
      for (const widget of section.widgets || []) {
        if (!widget.source_location_raw || String(widget.file || '').startsWith('inline')) continue;
        items.push({
          short_code: widget.short_code,
          code: widget.code,
          kind: widget.kind,
          scope: widget.scope,
          hint: widget.hint || null,
          file: widget.file,
          source_location_raw: widget.source_location_raw,
        });
      }
    }
  }
  const index = {};
  for (const item of items) index[item.source_location_raw] = item;
  return {
    generated_at: payload.generated_at,
    total: items.length,
    items,
    index,
  };
}

function main() {
  const payload = buildPayload();
  const overlayManifest = buildOverlayManifest(payload);
  const jsonStr = JSON.stringify(payload);
  const b64 = Buffer.from(jsonStr, 'utf8').toString('base64');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Catálogo de UI — inventário AST do sistema</title>
  <style>
    :root {
      --bg: #0a0d11;
      --panel: #121820;
      --text: #e8edf4;
      --muted: #7a8a9e;
      --accent: #5eb8e8;
      --teal: #5ed4b8;
      --gold: #e8c96b;
      --line: #243040;
      --tag: #1a2433;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 1.25rem 1.5rem 2.5rem;
      line-height: 1.45;
      max-width: 58rem;
      margin-inline: auto;
    }
    h1 { font-size: 1.35rem; font-weight: 600; margin: 0 0 0.35rem; color: var(--accent); }
    .sub { color: var(--muted); font-size: 0.88rem; margin-bottom: 1rem; max-width: 52rem; }
    details.mod > summary {
      cursor: pointer;
      font-weight: 600;
      color: var(--teal);
      padding: 0.4rem 0;
      list-style: none;
    }
    details.mod > summary::-webkit-details-marker { display: none; }
    details.mod > summary::before { content: "▸ "; color: var(--muted); }
    details.mod[open] > summary::before { content: "▾ "; }
    details.page > summary {
      cursor: pointer;
      font-size: 0.9rem;
      padding: 0.3rem 0 0.3rem 0.4rem;
      border-left: 2px solid var(--line);
      margin-left: 0.25rem;
    }
    details.sec > summary {
      cursor: pointer;
      font-size: 0.82rem;
      color: #a8c4e8;
      padding: 0.25rem 0 0.25rem 0.75rem;
    }
    details.scope > summary {
      cursor: pointer;
      font-size: 0.78rem;
      color: #c5d0dc;
      padding: 0.15rem 0 0.15rem 1.25rem;
    }
    .codez {
      font-family: ui-monospace, monospace;
      font-size: 0.7rem;
      color: var(--gold);
      background: #0e141c;
      padding: 0.1rem 0.38rem;
      border-radius: 4px;
      border: 1px solid #3d4f66;
    }
    .shortz {
      font-family: ui-monospace, monospace;
      font-size: 0.7rem;
      color: #7DFFB3;
      background: #0e1813;
      padding: 0.1rem 0.38rem;
      border-radius: 4px;
      border: 1px solid #2f5c45;
      margin-right: 0.35rem;
    }
    .kind { color: #7dffb3; font-size: 0.72rem; margin-right: 0.35rem; }
    .hint { color: var(--muted); font-size: 0.72rem; }
    table.w { width: 100%; border-collapse: collapse; font-size: 0.76rem; margin: 0.35rem 0 0.5rem 1rem; }
    table.w td { padding: 0.2rem 0.4rem; border-bottom: 1px solid var(--line); vertical-align: top; }
    table.w td:first-child { white-space: nowrap; }
    .diagram { text-align: center; margin-bottom: 1rem; }
    .diagram-root {
      display: inline-block;
      padding: 0.45rem 0.9rem;
      background: #151d28;
      border: 1px solid var(--accent);
      border-radius: 8px;
      font-weight: 600;
      margin-bottom: 0.65rem;
    }
    .diagram-children { display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: center; }
    .diagram-children span {
      font-size: 0.68rem;
      padding: 0.28rem 0.45rem;
      background: var(--tag);
      border: 1px solid var(--line);
      border-radius: 6px;
      color: #8ec5ff;
    }
    .parse-err { color: #f88; font-size: 0.75rem; margin-left: 1rem; }
    footer { color: var(--muted); font-size: 0.75rem; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <h1>Catálogo de UI — inventário AST do sistema inteiro</h1>
  <p class="sub">
    Cada linha é um controlo relevante (botão, input, tab, diálogo, tabela, …) com <strong>código hierárquico</strong>
    e <strong>código curto alfanumérico</strong> de 7 caracteres para apontar em correções
    («vamos tratar o <em>7X2A9QK</em> / <em>CAT-PG-Compras.PedidosCompraTab.Button.2</em>»).
    A rota analisa o ficheiro da página e os <strong>componentes de domínio importados</strong> (ex.: formulário de pedido).
    Isto não é só de Compras: cobre <strong>todo o sistema</strong> listado no catálogo. Actualização: voltar a correr o comando após alterar o código.
    Sem links — só tipo, código, âmbito e dica (placeholder quando existe).
  </p>
  <p class="sub" style="margin-top:-0.5rem">Gerado em <span id="gen"></span></p>

  <div class="diagram">
    <div class="diagram-root">CAT-APP-RAIZ</div>
    <div class="diagram-children" id="mod-pills"></div>
  </div>

  <div id="tree"></div>

  <footer><code>npm run catalogo:build-preview</code></footer>

  <div id="payload-b64" hidden>${b64}</div>
  <script>
    (function(){
      var b64 = document.getElementById('payload-b64').textContent.trim();
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      window.__payload = JSON.parse(new TextDecoder().decode(bytes));
    })();
    const payload = window.__payload;
    document.getElementById('gen').textContent = payload.generated_at || '';

    const pillRoot = document.getElementById('mod-pills');
    for (const m of payload.modules) {
      const s = document.createElement('span');
      s.textContent = m.stable_code;
      pillRoot.appendChild(s);
    }

    function esc(s) {
      if (s == null) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function groupByScope(widgets) {
      const g = {};
      for (const w of widgets) {
        const k = w.scope || 'Module';
        if (!g[k]) g[k] = [];
        g[k].push(w);
      }
      return g;
    }

    function renderWidgetsTable(parent, widgets) {
      if (!widgets || !widgets.length) return;
      const by = groupByScope(widgets);
      const scopes = Object.keys(by).sort();
      for (const sc of scopes) {
        const det = document.createElement('details');
        det.className = 'scope';
        det.open = scopes.length <= 3;
        const sm = document.createElement('summary');
        sm.innerHTML = '<strong>' + esc(sc) + '</strong> <span style="color:#6b7c90;font-size:0.68rem">(' + by[sc].length + ')</span>';
        det.appendChild(sm);
        const tbl = document.createElement('table');
        tbl.className = 'w';
        for (const w of by[sc]) {
          const tr = document.createElement('tr');
          const code = (w.code || '').replace(/</g, '&lt;');
          const shortCode = (w.short_code || '').replace(/</g, '&lt;');
          const hint = (w.hint || '').replace(/</g, '&lt;');
          tr.innerHTML = '<td><span class="shortz">' + shortCode + '</span> <span class="codez">' + code + '</span></td>' +
            '<td><span class="kind">' + esc(w.kind) + '</span></td>' +
            '<td class="hint">' + esc(hint || '—') + '</td>';
          tbl.appendChild(tr);
        }
        det.appendChild(tbl);
        parent.appendChild(det);
      }
    }

    const host = document.getElementById('tree');
    for (const mod of payload.modules) {
      const det = document.createElement('details');
      det.className = 'mod';
      det.open = false;
      const sum = document.createElement('summary');
      sum.innerHTML = '<span style="color:#5ed4b8">' + esc(mod.stable_code) + '</span> — ' + esc(mod.titulo) +
        ' <span style="color:#6b7c90;font-size:0.68rem">(' + mod.pages.length + ' páginas)</span>';
      det.appendChild(sum);

      for (const pk of mod.pages) {
        const pd = payload.pageDetails[pk];
        const pDet = document.createElement('details');
        pDet.className = 'page';
        pDet.open = (pk === 'Compras' || pk === 'PDV');
        const pSum = document.createElement('summary');
        const stable = pd && pd.pageStable ? pd.pageStable : 'CAT-PG-' + pk;
        pSum.innerHTML = '<span class="codez">' + esc(stable) + '</span> · <strong>' + esc(pk) + '</strong>';
        pDet.appendChild(pSum);

        if (!pd || pd.missing) {
          const em = document.createElement('div');
          em.className = 'parse-err';
          em.textContent = 'Ficheiro da página não encontrado.';
          pDet.appendChild(em);
        } else if (!pd.sections || !pd.sections.length) {
          const em = document.createElement('div');
          em.className = 'parse-err';
          em.textContent = 'Sem dados AST.';
          pDet.appendChild(em);
        } else {
          for (const sec of pd.sections) {
            const sDet = document.createElement('details');
            sDet.className = 'sec';
            sDet.open = sec.type === 'route';
            const lab =
              sec.type === 'route'
                ? 'Rota: ' + esc(sec.label)
                : 'Import: <strong>' + esc(sec.componentName) + '</strong> — ' + esc(sec.label);
            const sSum = document.createElement('summary');
            sSum.innerHTML = lab;
            sDet.appendChild(sSum);
            if (sec.parseError) {
              const er = document.createElement('div');
              er.className = 'parse-err';
              er.textContent = sec.parseError;
              sDet.appendChild(er);
            }
            renderWidgetsTable(sDet, sec.widgets);
            pDet.appendChild(sDet);
          }
        }
        det.appendChild(pDet);
      }
      host.appendChild(det);
    }
  </script>
</body>
</html>`;

  const out = join(root, 'docs', 'migration', 'catalogo_interface_preview.html');
  writeFileSync(out, html, 'utf8');
  console.log('Gerado:', out);
  console.log('Páginas AST:', Object.keys(payload.pageDetails).length);
}

main();
