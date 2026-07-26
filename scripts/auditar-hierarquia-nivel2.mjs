#!/usr/bin/env node
/**
 * Audita cadastro de produtos para uso do campo_hierarquico_2 como agregador de família.
 *
 * Uso:
 *   node scripts/auditar-hierarquia-nivel2.mjs
 *   node scripts/auditar-hierarquia-nivel2.mjs --json > /tmp/hierarquia-n2.json
 *   node scripts/auditar-hierarquia-nivel2.mjs --csv=/tmp/hierarquia-n2.csv
 */
import fs from 'node:fs';
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';

loadDotEnvFiles();

const GENERIC_H2 = new Set([
  'DIVERSOS', 'DIVERSO', 'GERAL', 'OUTROS', 'OUTRO', 'MISC', 'SEM SUBTIPO', 'NAO INFORMADO',
  'NÃO INFORMADO', 'S/N', 'SN', '-', '.', 'X', 'XX', 'VARIOS', 'VÁRIOS', 'MISTO', 'MIX',
]);

const BRAND_LIKE = /\b(ltda|s\.?a\.?|industria|indústria|marca|original|nacional|importado)\b/i;
const SIZE_LIKE = /^\d+([x×]\d+)?(\s*(cm|mm|m2|m²|pol|"))?$/i;
const MODEL_LIKE = /^[A-Z0-9]{2,}[-/][A-Z0-9-]+$/i;

function norm(s) {
  return String(s || '').trim();
}

function upper(s) {
  return norm(s).toUpperCase();
}

function familiaKey(h1, h2) {
  return `${upper(h1 || '(sem grupo)')}\x00${upper(h2)}`;
}

function parseArgs(argv) {
  const json = argv.includes('--json');
  const csvArg = argv.find((a) => a.startsWith('--csv='));
  const onlyAtivos = !argv.includes('--todos');
  return {
    json,
    csvPath: csvArg ? csvArg.slice(6) : null,
    onlyAtivos,
  };
}

function scoreIssue(severity) {
  const map = { critical: 4, high: 3, medium: 2, low: 1 };
  return map[severity] || 0;
}

function classifyH2Problems(produto, statsByFamilia) {
  const h1 = norm(produto.campo_hierarquico_1);
  const h2 = norm(produto.campo_hierarquico_2);
  const h3 = norm(produto.campo_hierarquico_3);
  const h4 = norm(produto.campo_hierarquico_4);
  const h5 = norm(produto.campo_hierarquico_5);
  const nome = norm(produto.nome);
  const codigo = norm(produto.codigo_interno);
  const issues = [];

  if (!h2) {
    issues.push({
      code: 'missing_h2',
      severity: 'critical',
      message: 'Sem campo 2 (subtipo) — não entra na vista Famílias',
      suggestion: h3
        ? `Mover «${h3}» para campo 2, se for o subtipo de compra`
        : 'Preencher campo 2 com o subtipo de compra (ex.: 45×45, PORTLAND, ROSCA)',
    });
  }

  if (!h1 && h2) {
    issues.push({
      code: 'missing_h1',
      severity: 'high',
      message: 'Tem campo 2 mas falta campo 1 (produto base)',
      suggestion: 'Preencher campo 1 com o grupo (ex.: PISO, CIMENTO, TINTA)',
    });
  }

  if (h2 && GENERIC_H2.has(upper(h2))) {
    issues.push({
      code: 'generic_h2',
      severity: 'high',
      message: `Campo 2 genérico («${h2}») — agrupa produtos diferentes`,
      suggestion: 'Substituir por subtipo real de compra (medida, tipo, linha)',
    });
  }

  if (h2 && h2.length <= 2 && !SIZE_LIKE.test(h2)) {
    issues.push({
      code: 'short_h2',
      severity: 'medium',
      message: `Campo 2 muito curto («${h2}»)`,
      suggestion: 'Usar descrição de subtipo reconhecível na compra',
    });
  }

  if (h2 && (upper(h2) === upper(h5) || upper(h2) === upper(h3))) {
    issues.push({
      code: 'duplicate_level',
      severity: 'medium',
      message: 'Campo 2 repetido noutro nível (3 ou 5)',
      suggestion: 'Campo 2 = subtipo; 3 = espessura/gramatura; 5 = marca/variante',
    });
  }

  if (h2 && MODEL_LIKE.test(h2)) {
    issues.push({
      code: 'model_in_h2',
      severity: 'high',
      message: `Campo 2 parece código/modelo («${h2}»), não subtipo`,
      suggestion: 'Mover modelo para campo 5; campo 2 = família de compra',
    });
  }

  if (h2 && upper(h2) === upper(produto.marca)) {
    issues.push({
      code: 'brand_in_h2',
      severity: 'high',
      message: 'Campo 2 igual à marca — marca deveria estar no campo 5',
      suggestion: `Campo 2 = subtipo; mover «${produto.marca}» para campo 5`,
    });
  }

  if (h2 && BRAND_LIKE.test(h2) && !h5) {
    issues.push({
      code: 'brand_like_h2',
      severity: 'medium',
      message: 'Campo 2 parece marca/fornecedor',
      suggestion: 'Confirmar se não deveria ir para campo 5',
    });
  }

  const famKey = familiaKey(h1, h2);
  const famStats = statsByFamilia.get(famKey);
  if (famStats && famStats.distinct_h3 >= 8 && famStats.count >= 10) {
    issues.push({
      code: 'h2_too_broad',
      severity: 'medium',
      message: `Família «${h1} › ${h2}» muito ampla (${famStats.count} SKUs, ${famStats.distinct_h3} espessuras/tipos)`,
      suggestion: 'Considerar subdividir campo 2 (ex.: por linha ou formato)',
    });
  }

  if (famStats && famStats.count === 1 && h3 && h4) {
    issues.push({
      code: 'singleton_family',
      severity: 'low',
      message: 'Família com 1 só SKU — campo 2 pode estar demasiado específico',
      suggestion: 'Verificar se outros SKUs semelhantes deveriam partilhar este campo 2',
    });
  }

  if (h2 && nome && upper(nome) === upper(`${h1} ${h2}`.trim())) {
    issues.push({
      code: 'name_only_h1_h2',
      severity: 'low',
      message: 'Nome = só campos 1+2 (faltam detalhes nos níveis 3–5)',
      suggestion: 'Completar campos 3–5 para distinguir variantes',
    });
  }

  if (codigo && upper(h2).includes(upper(codigo))) {
    issues.push({
      code: 'code_in_h2',
      severity: 'high',
      message: 'Código interno aparece no campo 2',
      suggestion: 'Remover código do campo 2',
    });
  }

  return issues;
}

function buildFamiliaStats(produtos) {
  const map = new Map();
  for (const p of produtos) {
    const h2 = norm(p.campo_hierarquico_2);
    if (!h2) continue;
    const key = familiaKey(p.campo_hierarquico_1, h2);
    if (!map.has(key)) {
      map.set(key, {
        h1: norm(p.campo_hierarquico_1) || '(sem grupo)',
        h2,
        count: 0,
        h3s: new Set(),
        h4s: new Set(),
        h5s: new Set(),
        produtos: [],
      });
    }
    const row = map.get(key);
    row.count += 1;
    if (norm(p.campo_hierarquico_3)) row.h3s.add(upper(p.campo_hierarquico_3));
    if (norm(p.campo_hierarquico_4)) row.h4s.add(upper(p.campo_hierarquico_4));
    if (norm(p.campo_hierarquico_5)) row.h5s.add(upper(p.campo_hierarquico_5));
    row.produtos.push(p);
  }

  for (const row of map.values()) {
    row.distinct_h3 = row.h3s.size;
    row.distinct_h4 = row.h4s.size;
    row.distinct_h5 = row.h5s.size;
  }
  return map;
}

function detectSplitFamilies(produtos) {
  // Mesmo h1 + h3 + h4 mas h2 diferente → família partida
  const clusters = new Map();
  for (const p of produtos) {
    const h1 = upper(p.campo_hierarquico_1);
    const h3 = upper(p.campo_hierarquico_3);
    const h4 = upper(p.campo_hierarquico_4);
    if (!h1 || !h3) continue;
    const key = `${h1}\x00${h3}\x00${h4}`;
    if (!clusters.has(key)) clusters.set(key, new Set());
    const h2 = upper(p.campo_hierarquico_2);
    if (h2) clusters.get(key).add(h2);
  }

  const splits = [];
  for (const [key, h2set] of clusters) {
    if (h2set.size < 2) continue;
    const [h1, h3, h4] = key.split('\x00');
    splits.push({
      h1,
      h3,
      h4: h4 || '(vazio)',
      h2_values: [...h2set].sort(),
      count_h2: h2set.size,
    });
  }
  return splits.sort((a, b) => b.count_h2 - a.count_h2);
}

function detectHomonymH2(statsByFamilia) {
  // Mesmo h2 label em h1 diferentes é OK; mesmo h2 com conteúdo h3 muito diferente sob mesmo h1
  const byH1H2 = [...statsByFamilia.values()];
  return byH1H2
    .filter((f) => f.distinct_h3 >= 6 && f.distinct_h4 >= 6)
    .sort((a, b) => (b.distinct_h3 * b.distinct_h4) - (a.distinct_h3 * a.distinct_h4))
    .slice(0, 30)
    .map((f) => ({
      familia: `${f.h1} › ${f.h2}`,
      skus: f.count,
      distinct_h3: f.distinct_h3,
      distinct_h4: f.distinct_h4,
      distinct_h5: f.distinct_h5,
      sample_h3: [...f.h3s].slice(0, 5),
      sample_h4: [...f.h4s].slice(0, 5),
    }));
}

function suggestH2FromCluster(produtos) {
  // Para produtos sem h2: sugerir o h3 mais comum no mesmo h1
  const byH1 = new Map();
  for (const p of produtos) {
    const h1 = upper(p.campo_hierarquico_1);
    if (!h1) continue;
    if (!byH1.has(h1)) byH1.set(h1, new Map());
    const h3 = norm(p.campo_hierarquico_3);
    if (!h3) continue;
    const m = byH1.get(h1);
    m.set(h3, (m.get(h3) || 0) + 1);
  }
  return byH1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não definido');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const where = args.onlyAtivos ? 'where coalesce(ativo, true) = true' : '';
  const { rows } = await pool.query(
    `select id, codigo_interno, nome, marca, abcd, estoque_atual, venda_media_dia,
            campo_hierarquico_1, campo_hierarquico_2, campo_hierarquico_3,
            campo_hierarquico_4, campo_hierarquico_5, categoria_nome
     from public.produto
     ${where}
     order by campo_hierarquico_1 nulls last, campo_hierarquico_2 nulls last, nome`,
  );
  await pool.end();

  const produtos = rows || [];
  const statsByFamilia = buildFamiliaStats(produtos);
  const h1Suggestions = suggestH2FromCluster(produtos);

  const productIssues = [];
  for (const p of produtos) {
    const issues = classifyH2Problems(p, statsByFamilia);
    if (!issues.length) continue;
    const top = issues.sort((a, b) => scoreIssue(b.severity) - scoreIssue(a.severity))[0];
    productIssues.push({
      id: p.id,
      codigo: p.codigo_interno,
      nome: p.nome,
      abcd: p.abcd,
      h1: p.campo_hierarquico_1,
      h2: p.campo_hierarquico_2,
      h3: p.campo_hierarquico_3,
      h4: p.campo_hierarquico_4,
      h5: p.campo_hierarquico_5,
      issues,
      top_issue: top.code,
      top_severity: top.severity,
      top_message: top.message,
      top_suggestion: top.suggestion,
      suggested_h2: !norm(p.campo_hierarquico_2) && norm(p.campo_hierarquico_3)
        ? norm(p.campo_hierarquico_3)
        : null,
    });
  }

  productIssues.sort((a, b) => {
    const s = scoreIssue(b.top_severity) - scoreIssue(a.top_severity);
    if (s !== 0) return s;
    return String(a.h1).localeCompare(String(b.h1), 'pt-BR');
  });

  const missingH2 = produtos.filter((p) => !norm(p.campo_hierarquico_2));
  const withH2 = produtos.length - missingH2.length;
  const families = statsByFamilia.size;
  const splits = detectSplitFamilies(produtos);
  const broadFamilies = detectHomonymH2(statsByFamilia);

  const issueCounts = {};
  for (const pi of productIssues) {
    for (const iss of pi.issues) {
      issueCounts[iss.code] = (issueCounts[iss.code] || 0) + 1;
    }
  }

  const topFamilies = [...statsByFamilia.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)
    .map((f) => ({
      familia: `${f.h1} › ${f.h2}`,
      skus: f.count,
      distinct_h3: f.distinct_h3,
      distinct_h4: f.distinct_h4,
      distinct_h5: f.distinct_h5,
    }));

  const report = {
    exportedAt: new Date().toISOString(),
    totals: {
      produtos: produtos.length,
      com_h2: withH2,
      sem_h2: missingH2.length,
      pct_com_h2: produtos.length ? Math.round((withH2 / produtos.length) * 1000) / 10 : 0,
      familias_nivel2: families,
      produtos_com_problema: productIssues.length,
      familias_partidas: splits.length,
    },
    issueCounts,
    topFamilies,
    broadFamilies,
    splitFamilies: splits.slice(0, 40),
    productIssues: productIssues.slice(0, 500),
    missingH2Sample: missingH2.slice(0, 50).map((p) => ({
      codigo: p.codigo_interno,
      nome: p.nome,
      h1: p.campo_hierarquico_1,
      h3: p.campo_hierarquico_3,
      suggested_h2: norm(p.campo_hierarquico_3) || null,
    })),
  };

  if (args.csvPath) {
    const header = [
      'codigo', 'nome', 'abcd', 'h1', 'h2', 'h3', 'h4', 'h5',
      'top_issue', 'top_severity', 'top_message', 'top_suggestion', 'suggested_h2',
    ];
    const lines = [header.join(';')];
    for (const pi of productIssues) {
      const row = [
        pi.codigo, pi.nome, pi.abcd, pi.h1, pi.h2, pi.h3, pi.h4, pi.h5,
        pi.top_issue, pi.top_severity, pi.top_message, pi.top_suggestion, pi.suggested_h2 || '',
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`);
      lines.push(row.join(';'));
    }
    fs.writeFileSync(args.csvPath, `\uFEFF${lines.join('\n')}`, 'utf8');
    console.error(`CSV gravado: ${args.csvPath} (${productIssues.length} linhas)`);
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  P38 — Auditoria hierarquia nível 2 (família compra)');
  console.log('═══════════════════════════════════════════════════\n');
  console.log(`Produtos analisados:     ${report.totals.produtos}`);
  console.log(`Com campo 2 (subtipo):   ${report.totals.com_h2} (${report.totals.pct_com_h2}%)`);
  console.log(`Sem campo 2:             ${report.totals.sem_h2}`);
  console.log(`Famílias nível 2:        ${report.totals.familias_nivel2}`);
  console.log(`Produtos c/ alerta:      ${report.totals.produtos_com_problema}`);
  console.log(`Grupos h1+h3+h4 partidos: ${report.totals.familias_partidas}`);

  console.log('\n── Tipos de problema (ocorrências) ──\n');
  const sortedIssues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]);
  for (const [code, count] of sortedIssues) {
    console.log(`  ${String(count).padStart(5)}  ${code}`);
  }

  console.log('\n── Top famílias (mais SKUs) ──\n');
  for (const f of topFamilies.slice(0, 15)) {
    console.log(`  ${String(f.skus).padStart(4)} SKUs · h3×${f.distinct_h3} h4×${f.distinct_h4} · ${f.familia}`);
  }

  if (broadFamilies.length) {
    console.log('\n── Famílias possivelmente amplas demais ──\n');
    for (const f of broadFamilies.slice(0, 10)) {
      console.log(`  ${f.familia} — ${f.skus} SKUs, ${f.distinct_h3} tipos h3, ${f.distinct_h4} h4`);
      console.log(`    h3: ${f.sample_h3.join(', ')}`);
    }
  }

  if (splits.length) {
    console.log('\n── Mesmo produto-base partido em vários campo 2 ──\n');
    for (const s of splits.slice(0, 12)) {
      console.log(`  ${s.h1} | h3=${s.h3} h4=${s.h4}`);
      console.log(`    h2 diferentes: ${s.h2_values.join(' | ')}`);
    }
  }

  console.log('\n── Amostra: produtos prioritários para corrigir ──\n');
  const critical = productIssues.filter((p) => p.top_severity === 'critical' || p.top_severity === 'high').slice(0, 25);
  for (const p of critical) {
    console.log(`  [${p.top_severity}] ${p.codigo} — ${p.nome}`);
    console.log(`    h1=${p.h1 || '—'} › h2=${p.h2 || '—'} › h3=${p.h3 || '—'}`);
    console.log(`    → ${p.top_suggestion}`);
  }

  console.log('\n── Regra de cadastro recomendada ──\n');
  console.log('  Campo 1 = grupo de compra (PISO, CIMENTO, TINTA, FERRAGEM…)');
  console.log('  Campo 2 = subtipo que agrega SKUs na compra (45×45, PORTLAND, ROSCA 1/2…)');
  console.log('  Campo 3 = espessura / gramatura / linha técnica');
  console.log('  Campo 4 = dimensão / embalagem');
  console.log('  Campo 5 = marca / variante / cor');
  console.log('\n  Dica: node scripts/auditar-hierarquia-nivel2.mjs --csv=/tmp/hierarquia.csv\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
