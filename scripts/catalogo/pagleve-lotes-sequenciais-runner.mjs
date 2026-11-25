#!/usr/bin/env node
/**
 * Divide os códigos em N lotes e corre pagleve-official-sweep-report.mjs em sequência.
 * Gera selecao JSON, cascata JSON e relatório Ardósia por lote.
 *
 * Env:
 *   PAGLEVE_LOTE_INICIO=8
 *   PAGLEVE_LOTE_FIM=17
 *   PAGLEVE_LOTE_TAMANHOS=21,21,21,21,21,21,21,21,20,20
 *   PAGLEVE_SELECAO_SOURCE=/opt/cursor/artifacts/pagleve-lote-completo-selecao.json
 *   PAGLEVE_ARTIFACTS_DIR=/opt/cursor/artifacts
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const SWEEP = path.join(__dirname, 'pagleve-official-sweep-report.mjs');

const EXCEL = 'docs/ESTOQUE PARA CASA ISRAEL ATE 19112026.XLSX';
const ART = process.env.PAGLEVE_ARTIFACTS_DIR || '/opt/cursor/artifacts';
const SELECAO_SRC =
  process.env.PAGLEVE_SELECAO_SOURCE || path.join(ART, 'pagleve-lote-completo-selecao.json');
const LOTE_INICIO = Number(process.env.PAGLEVE_LOTE_INICIO || 8);
const LOTE_FIM = Number(process.env.PAGLEVE_LOTE_FIM || 17);
const TAMANHOS = (process.env.PAGLEVE_LOTE_TAMANHOS || '21,21,21,21,21,21,21,21,20,20')
  .split(',')
  .map((n) => Number(n.trim()))
  .filter((n) => n > 0);

function googleQuery(medida, desc) {
  const m = String(medida || '')
    .replace(/x/gi, ' por ')
    .replace(/X/g, ' por ');
  return `${m} ${desc || ''}`.trim();
}

function fonteFromMetodo(matchMetodo, url) {
  if (!matchMetodo) return url ? new URL(url).hostname.replace(/^www\./, '') : '—';
  if (matchMetodo.startsWith('formigres')) return 'formigres.com.br';
  if (matchMetodo.startsWith('carmelo') || matchMetodo.includes('carmelo')) return 'carmelofior.com.br';
  if (matchMetodo.startsWith('rocha') || matchMetodo.includes('rocha')) return 'rochaceramica.com.br';
  if (matchMetodo.startsWith('cerbras') || matchMetodo.includes('cerbras')) return 'cerbras.com.br';
  if (matchMetodo.startsWith('lume') || matchMetodo.includes('lume')) return 'lumerevestimentos.com.br';
  if (matchMetodo.startsWith('incopisos') || matchMetodo.includes('incopisos')) return 'incopisos.com.br';
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '—';
    }
  }
  return matchMetodo.split(':')[0] || '—';
}

function writeArdosia(loteNum, selecaoSlice, cascata) {
  const byCode = new Map(selecaoSlice.map((s) => [s.code, s]));
  const confirmados = cascata.confirmados_site ?? 0;
  const total = cascata.total ?? cascata.itens?.length ?? 0;
  const comFoto = cascata.com_foto ?? 0;

  let md = `# PagLeve — lote ${loteNum} (${total} códigos)

Mesmo roteiro: Excel Casa Israel verbatim → query Google sugerida → cascata (\`pagleve-official-sweep-report.mjs\` pipeline v3).

Arquivo Excel: \`${EXCEL}\`  
Seleção: \`${ART}/pagleve-lote${loteNum}-selecao.json\`  
JSON cascata: \`${ART}/pagleve-lote${loteNum}-cascata.json\` (**${confirmados}/${total} confirmados no site**, **${comFoto} com foto**).

---

`;

  for (const item of cascata.itens || []) {
    const ex = byCode.get(String(item.codigo)) || {};
    const medida = ex.medida || item.formato?.toUpperCase().replace(/x/g, 'X') || '';
    const desc = ex.desc || item.descricao_erp || '';
    const query = googleQuery(medida, desc);
    const ok = item.status === 'confirmado_site';
    const fonte = fonteFromMetodo(item.match_metodo, item.produto_url);
    const pathSite = item.produto_url
      ? (() => {
          try {
            return new URL(item.produto_url).pathname;
          } catch {
            return item.produto_url;
          }
        })()
      : '—';

    md += `## ${item.codigo} — ${item.fabricante_grupo || '—'}${item.marca_no_site ? ` / ${item.marca_no_site}` : ''}\n\n`;
    md += `### Excel (verbatim)\n\n`;
    md += `| Código | Medida | Descrição |\n|--------|--------|-----------|\n`;
    md += `| **${item.codigo}** | **${medida}** | **${desc.replace(/\|/g, '\\|')}** |\n\n`;

    md += `### Google\n\n**Query:** \`${query.replace(/`/g, "'")}\`\n\n`;
    md += `*(Consolidado automático — destaques Google não reexecutados neste lote.)*\n\n`;

    md += `### Cascata${ok ? ' (fechou no site)' : ''}\n\n`;
    md += `| Etapa | Fonte | Retorno | Próximo? |\n|-------|--------|---------|----------|\n`;
    if (ok) {
      md += `| 1 | **${fonte}** | **${pathSite}**, score ${item.match_score || '—'}, **${(item.nome_comercial || '').slice(0, 60)}** | **Para aqui** ✅ |\n\n`;
    } else {
      md += `| — | **${fonte}** | ${item.match_metodo || item.status} | **Sem fecho** |\n\n`;
    }

    if (item.produto_url) md += `**URL:** ${item.produto_url}\n`;
    md += `**Fotos:** **${item.imagens_count ?? 0}**\n`;
    if (item.sem_foto_motivo) md += `**Motivo sem foto:** ${item.sem_foto_motivo}\n`;
    const peiErp = (desc.match(/PEI\s*[A-Z]{2}/i) || [])[0];
    const peiSite = item.ficha?.local_uso_nbr || item.ficha?.local_uso_fonte || '';
    if (peiErp && peiSite && !peiErp.toUpperCase().includes(peiSite.toUpperCase())) {
      md += `**Divergências:** ERP ${peiErp} vs ficha site **${peiSite}**.\n`;
    } else if (item.nome_comercial && desc) {
      md += `**Divergências:** conferir grafia ERP vs site (**${item.nome_comercial.slice(0, 80)}**).\n`;
    }
    md += `\n---\n\n`;
  }

  md += `## Resumo executivo\n\n`;
  md += `| Código | Status | Fechou | URL | Fotos |\n|--------|--------|--------|-----|-------|\n`;
  for (const item of cascata.itens || []) {
    const ok = item.status === 'confirmado_site';
    const label = ok
      ? item.fabricante_grupo?.replace('Grupo ', '') || item.marca_no_site || 'site'
      : item.status;
    const url = item.produto_url ? `[link](${item.produto_url})` : '—';
    md += `| **${item.codigo}** | ${item.status} | ${label} | ${url} | ${item.imagens_count ?? 0} |\n`;
  }

  const outMd = path.join(ART, `pagleve-lote${loteNum}-referencia-cascata.md`);
  fs.writeFileSync(outMd, md);
  return outMd;
}

function chunkBalanced(items, sizes) {
  const batches = [];
  let i = 0;
  for (const size of sizes) {
    batches.push(items.slice(i, i + size));
    i += size;
  }
  if (i < items.length) {
    batches[batches.length - 1].push(...items.slice(i));
  }
  return batches;
}

function main() {
  const full = JSON.parse(fs.readFileSync(SELECAO_SRC, 'utf8'));
  const items = full.selecionados || [];
  if (items.length !== TAMANHOS.reduce((a, b) => a + b, 0) && items.length > 0) {
    const nLotes = LOTE_FIM - LOTE_INICIO + 1;
    const base = Math.floor(items.length / nLotes);
    let rest = items.length % nLotes;
    const auto = [];
    for (let k = 0; k < nLotes; k++) {
      auto.push(base + (rest > 0 ? 1 : 0));
      if (rest > 0) rest--;
    }
    while (TAMANHOS.length < nLotes) TAMANHOS.push(base);
    if (TAMANHOS.reduce((a, b) => a + b, 0) !== items.length) {
      TAMANHOS.length = 0;
      TAMANHOS.push(...auto);
    }
  }

  const batches = chunkBalanced(items, TAMANHOS);
  const nLotes = LOTE_FIM - LOTE_INICIO + 1;
  if (batches.length !== nLotes) {
    console.error('Batch count mismatch', batches.length, nLotes);
    process.exit(1);
  }

  const resumoGlobal = {
    geradoEm: new Date().toISOString(),
    excel_total: full.excel_total,
    excluidos: full.excluidos,
    codigos_restantes: items.length,
    divisao: TAMANHOS,
    lotes: [],
    totais: {
      processados: 0,
      confirmados_site: 0,
      sem_match: 0,
      com_foto: 0,
    },
  };

  fs.mkdirSync(ART, { recursive: true });

  for (let idx = 0; idx < batches.length; idx++) {
    const loteNum = LOTE_INICIO + idx;
    const slice = batches[idx];
    const codes = slice.map((s) => s.code);

    const selecaoPath = path.join(ART, `pagleve-lote${loteNum}-selecao.json`);
    const cascataPath = path.join(ART, `pagleve-lote${loteNum}-cascata.json`);

    const selecaoDoc = {
      lote: loteNum,
      geradoEm: new Date().toISOString(),
      excel: EXCEL,
      excluidos_antes: full.excluidos,
      codigos: codes,
      selecionados: slice,
    };
    fs.writeFileSync(selecaoPath, JSON.stringify(selecaoDoc, null, 2));

    console.log(`\n========== Lote ${loteNum} (${codes.length} códigos) ==========`);
    console.log(codes.join(', '));

    const env = {
      ...process.env,
      PAGLEVE_PIPELINE_CODIGOS: codes.join(','),
      PAGLEVE_SWEEP_OUT: cascataPath,
    };
    const run = spawnSync(process.execPath, [SWEEP], {
      cwd: ROOT,
      env,
      stdio: 'inherit',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (run.status !== 0) {
      console.error(`Lote ${loteNum} falhou com exit ${run.status}`);
      process.exit(run.status || 1);
    }

    const cascata = JSON.parse(fs.readFileSync(cascataPath, 'utf8'));
    const confirmados = cascata.confirmados_site ?? 0;
    const total = cascata.total ?? cascata.itens?.length ?? codes.length;
    const sem = total - confirmados;
    const comFoto = cascata.com_foto ?? 0;

    writeArdosia(loteNum, slice, cascata);

    const loteResumo = {
      lote: loteNum,
      codigos: codes,
      total,
      confirmados_site: confirmados,
      sem_match: sem,
      com_foto: comFoto,
      selecao_json: selecaoPath,
      cascata_json: cascataPath,
      relatorio_md: path.join(ART, `pagleve-lote${loteNum}-referencia-cascata.md`),
    };
    resumoGlobal.lotes.push(loteResumo);
    resumoGlobal.totais.processados += total;
    resumoGlobal.totais.confirmados_site += confirmados;
    resumoGlobal.totais.sem_match += sem;
    resumoGlobal.totais.com_foto += comFoto;

    console.log(`Lote ${loteNum} OK: ${confirmados}/${total} confirmados, ${comFoto} com foto`);
  }

  const resumoPath = path.join(ART, 'pagleve-lotes-8-17-resumo.json');
  fs.writeFileSync(resumoPath, JSON.stringify(resumoGlobal, null, 2));
  console.log('\n========== TOTAIS ==========');
  console.log(resumoGlobal.totais);
  console.log('Resumo:', resumoPath);
}

main();