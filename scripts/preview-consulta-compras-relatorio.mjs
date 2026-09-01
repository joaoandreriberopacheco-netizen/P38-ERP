#!/usr/bin/env node
/**
 * Preview estático do relatório mobile claro — chips e linhas por status.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = '/opt/cursor/artifacts';
const OUT_HTML = path.join(ARTIFACTS, 'consulta-compras-relatorio-preview.html');
const OUT_PNG = path.join(ARTIFACTS, 'consulta-compras-relatorio-preview.png');

const PREVIEW_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Preview — Consulta compras (claro)</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: #242424;
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 300;
    }
    .wrap { width: 390px; margin: 0 auto; padding: 20px 16px 28px; }
    .meta { font-size: 10px; color: #6b6b6b; margin-bottom: 12px; line-height: 1.4; }
    .card { border-bottom: 1px solid rgba(0,0,0,0.08); padding: 14px 0; }
    .title { font-size: 14px; text-transform: uppercase; letter-spacing: 0.02em; margin: 0 0 6px; font-weight: 300; }
    .subtitle { font-size: 11px; color: #6b6b6b; margin: 0 0 10px; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
    .chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.3;
      white-space: nowrap;
    }
    .chip-rascunho { background: #f1f5f9; color: #334155; }
    .chip-aprovado { background: #ecfccb; color: #3f6212; }
    .meta-line { font-size: 11px; color: #404040; }
    .valor { font-size: 13px; font-weight: 400; white-space: nowrap; }
    .item {
      display: flex;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      border-left: 3px solid transparent;
      padding: 14px 8px 14px 10px;
      margin-left: 12px;
      background: #fff;
    }
    .item-muted { border-left-color: #94a3b8; }
    .item-aprovado { border-left-color: #84cc16; }
    .qtd { width: 60px; border-right: 1px solid rgba(0,0,0,0.08); padding-right: 6px; text-align: right; position: relative; }
    .dot { position: absolute; left: 2px; top: 14px; width: 6px; height: 6px; border-radius: 50%; }
    .dot-muted { background: rgba(107,114,128,0.45); }
    .dot-aprovado { background: #84cc16; }
    .qtd-n { font-size: 12px; }
    .qtd-u { font-size: 10px; color: #6b6b6b; margin-top: 4px; }
    .nome { flex: 1; padding-left: 10px; font-size: 14px; line-height: 1.35; }
    .total { font-size: 13px; padding-left: 8px; white-space: nowrap; }
    .legend { margin-top: 18px; font-size: 10px; color: #6b6b6b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrap" id="consulta-export-capture">
    <p class="meta">Preview — Rascunho (cinza) vs Aprovado (verde lima #84cc16)</p>
    <p class="meta">Gerado em ${new Date().toLocaleString('pt-BR')}</p>

    <section class="card">
      <h2 class="title">PC-2026-0042</h2>
      <p class="subtitle">Distribuidora Norte Ltda</p>
      <div class="row">
        <div>
          <span class="chip chip-rascunho">Rascunho</span>
          <div class="meta-line" style="margin-top:6px">28/08/2026 · ETA 15/09/2026</div>
        </div>
        <div class="valor">R$ 4.820,50</div>
      </div>
      <div class="item item-muted">
        <div class="qtd"><span class="dot dot-muted"></span><div class="qtd-n">120</div><div class="qtd-u">UN</div></div>
        <div class="nome">Arroz tipo 1 pacote 5kg</div>
        <div class="total">R$ 2.820,50</div>
      </div>
      <div class="item item-muted">
        <div class="qtd"><span class="dot dot-muted"></span><div class="qtd-n">80</div><div class="qtd-u">UN</div></div>
        <div class="nome">Feijão carioca 1kg</div>
        <div class="total">R$ 2.000,00</div>
      </div>
    </section>

    <section class="card">
      <h2 class="title">PC-2026-0038</h2>
      <p class="subtitle">Atacado Sul Comércio</p>
      <div class="row">
        <div>
          <span class="chip chip-aprovado">Aprovado</span>
          <div class="meta-line" style="margin-top:6px">25/08/2026 · ETA 10/09/2026</div>
        </div>
        <div class="valor">R$ 12.640,00</div>
      </div>
      <div class="item item-aprovado">
        <div class="qtd"><span class="dot dot-aprovado"></span><div class="qtd-n">240</div><div class="qtd-u">UN</div></div>
        <div class="nome">Óleo de soja 900ml</div>
        <div class="total">R$ 5.760,00</div>
      </div>
      <div class="item item-aprovado">
        <div class="qtd"><span class="dot dot-aprovado"></span><div class="qtd-n">300</div><div class="qtd-u">UN</div></div>
        <div class="nome">Açúcar cristal 1kg</div>
        <div class="total">R$ 6.880,00</div>
      </div>
    </section>

    <p class="legend">Cores alinhadas a <code>comprasEmbarquesPalette.js</code> e <code>p38Accent.aprovado</code> (lime-500 / lime-100).</p>
  </div>
</body>
</html>`;

async function main() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(OUT_HTML, PREVIEW_HTML, 'utf8');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  try {
    await page.goto(`file://${OUT_HTML}`, { waitUntil: 'networkidle' });
    await page.locator('#consulta-export-capture').screenshot({ path: OUT_PNG, type: 'png' });
    console.log('Preview HTML:', OUT_HTML);
    console.log('Preview PNG:', OUT_PNG);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
