#!/usr/bin/env node
/**
 * FASE 2 — Varredura pontual pós-match: lê JSON cascata (não altera o sweep).
 * Local de uso (trad. NBR), textura e borda para itens já confirmados no site.
 */
import fs from 'node:fs';
import path from 'node:path';
import { verificarFichaVsErp } from '../lib/pagleveVerificacaoFicha.mjs';

const ART = process.env.PAGLEVE_ARTIFACTS_DIR || '/opt/cursor/artifacts';
const LOTE_INICIO = Number(process.env.PAGLEVE_LOTE_INICIO || 8);
const LOTE_FIM = Number(process.env.PAGLEVE_LOTE_FIM || 17);

function main() {
  const itens = [];
  const divergencias = [];

  for (let n = LOTE_INICIO; n <= LOTE_FIM; n++) {
    const p = path.join(ART, `pagleve-lote${n}-cascata.json`);
    if (!fs.existsSync(p)) continue;
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const item of d.itens || []) {
      if (item.status !== 'confirmado_site') continue;
      const ficha = item.ficha || {};
      const varredura = verificarFichaVsErp({
        descricao_erp: item.descricao_erp,
        ficha,
        fabricante_grupo: item.fabricante_grupo,
      });
      const row = {
        lote: n,
        codigo: item.codigo,
        produto_url: item.produto_url,
        fabricante_grupo: item.fabricante_grupo,
        ...varredura,
      };
      itens.push(row);
      for (const div of varredura.divergencias || []) {
        divergencias.push({ lote: n, codigo: item.codigo, ...div });
      }
    }
  }

  const outJson = path.join(ART, 'pagleve-lotes-8-17-varredura-ficha.json');
  const outMd = path.join(ART, 'pagleve-lotes-8-17-varredura-ficha.md');
  const payload = {
    geradoEm: new Date().toISOString(),
    fase: 2,
    lotes: `${LOTE_INICIO}-${LOTE_FIM}`,
    itens_casados: itens.length,
    divergencias_count: divergencias.length,
    itens,
    divergencias,
  };
  fs.writeFileSync(outJson, JSON.stringify(payload, null, 2));

  let md = `# PagLeve — varredura ficha (pós-match) lotes 8–17\n\n`;
  md += `Itens casados: **${itens.length}** · divergências LU/textura/borda: **${divergencias.length}**\n\n`;
  if (divergencias.length) {
    md += `| Lote | Código | Campo | ERP | Site | Motivo |\n|------|--------|-------|-----|------|--------|\n`;
    for (const r of divergencias) {
      const site =
        r.campo === 'local_uso'
          ? `NBR ${r.site_nbr} (fonte ${r.site_fonte || '—'})`
          : r.site || '—';
      md += `| ${r.lote} | **${r.codigo}** | ${r.campo} | ${r.erp || '—'} | ${site} | ${r.motivo} |\n`;
    }
  }
  fs.writeFileSync(outMd, md);

  console.log(
    JSON.stringify(
      { ok: true, itens: itens.length, divergencias: divergencias.length, outJson, outMd },
      null,
      2,
    ),
  );
}

main();