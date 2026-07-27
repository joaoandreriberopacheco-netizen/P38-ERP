#!/usr/bin/env node
/**
 * Exporta lotes de produtos para correção de hierarquia com o Cursor (planilha).
 *
 * Prioridade: capital em estoque preso + cadastro incompleto (sem campo 2).
 *
 * Uso:
 *   npm run produto:cadastro:export-lote
 *   npm run produto:cadastro:export-lote -- --batch=2 --size=80
 *   npm run produto:cadastro:export-lote -- --out=docs/tmp/lote-1.csv
 *   npm run produto:cadastro:export-lote -- --somente-sem-h2=false
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';

loadDotEnvFiles();

function parseArgs(argv) {
  const batch = Number(argv.find((a) => a.startsWith('--batch='))?.slice(8) || 1);
  const size = Number(argv.find((a) => a.startsWith('--size='))?.slice(7) || 80);
  const out = argv.find((a) => a.startsWith('--out='))?.slice(6)
    || `docs/tmp/cadastro-hierarquia-lote-${String(batch).padStart(2, '0')}.csv`;
  const somenteSemH2 = !argv.includes('--somente-sem-h2=false');
  return { batch: Math.max(1, batch), size: Math.max(10, size), out, somenteSemH2 };
}

function norm(s) {
  return String(s || '').trim();
}

function upper(s) {
  return norm(s).toUpperCase();
}

function extractPresentation(text) {
  const t = norm(text);
  const patterns = [
    /\((\d+[,.]?\d*\s*(?:L|ML|KG|G))\)/i,
    /\b(BD|GL|SC)\s*(\d+[,.]?\d*\s*KG)?/i,
    /\b(\d+[,.]?\d*\s*KG)\b/i,
    /\b(\d+[,.]?\d*\s*(?:ML|L))\b/i,
    /\b(\d+\s*[x×]\s*\d+(?:\s*[x×]\s*\d+)?)\b/i,
    /\b(\d+\s*MM)\b/i,
    /\b(\d+\s*")\b/,
    /\b(\d+\/\d+['"]?)\b/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) return norm(m[1] || m[0]).replace(/\s+/g, ' ');
  }
  return '';
}

function inferProductPrefix(nome) {
  const n = upper(nome);
  const rules = [
    { re: /TINTA\s+ESMALTE|ESMALTE\s+SINT/i, h1: 'TINTA ESMALTE SINTÉTICO' },
    { re: /\bTINTA\s+SPRAY\b/i, h1: 'TINTA SPRAY' },
    { re: /\bVERNIZ\b/i, h1: 'VERNIZ' },
    { re: /\bTHINNER\b/i, h1: 'THINNER' },
    { re: /\bMASSA\s+CORRIDA\b/i, h1: 'MASSA CORRIDA' },
    { re: /\bMASSA\s+ACRIL/i, h1: 'MASSA ACRÍLICA' },
    { re: /\bARGAMASSA\b/i, h1: 'ARGAMASSA' },
    { re: /\bCIMENTO\s+PORTLAND\b|\bPORTLAND\b/i, h1: 'CIMENTO PORTLAND' },
    { re: /\bCIMENTO\s+BRANCO\b/i, h1: 'CIMENTO BRANCO' },
    { re: /\bPORCELANATO\b/i, h1: 'PORCELANATO' },
    { re: /\bPISO\b/i, h1: 'PISO' },
    { re: /\bREVESTIMENTO\b|\bREV\b/i, h1: 'REVESTIMENTO' },
    { re: /\bREJUNTE\b/i, h1: 'REJUNTE' },
    { re: /\bTUBO\b/i, h1: 'TUBO' },
    { re: /\bJOELHO\b/i, h1: 'JOELHO' },
    { re: /\bLUVA\b/i, h1: 'LUVA' },
    { re: /\bTE\b/i, h1: 'TE' },
    { re: /\bREGISTRO\b/i, h1: 'REGISTRO' },
    { re: /\bLAMPADA|LÂMPADA\b/i, h1: 'LÂMPADA' },
    { re: /\bLUMINARIA|LUMINÁRIA\b/i, h1: 'LUMINÁRIA' },
    { re: /\bCHUVEIRO\b/i, h1: 'CHUVEIRO' },
    { re: /\bDISJUNTOR\b/i, h1: 'DISJUNTOR' },
    { re: /\bTOMADA\b/i, h1: 'TOMADA' },
    { re: /\bLIXA\b/i, h1: 'LIXA' },
    { re: /\bDISCO\s+DE\s+CORTE\b/i, h1: 'DISCO DE CORTE' },
    { re: /\bBROCA\b/i, h1: 'BROCA' },
    { re: /\bSERROTE\b/i, h1: 'SERROTE' },
    { re: /\bMARTELO\b/i, h1: 'MARTELO' },
    { re: /\bPREGO\b/i, h1: 'PREGO' },
    { re: /\bVERGALHÃO\b/i, h1: 'VERGALHÃO DE FERRO' },
    { re: /\bPERFIL\s+DE\s+PVC\b|\bPERFIL\s+PVC\b/i, h1: 'PERFIL PVC' },
    { re: /\bTINTA\b/i, h1: 'TINTA' },
  ];
  for (const { re, h1 } of rules) {
    if (re.test(n)) return h1;
  }
  return '';
}

function suggestHierarchy(produto) {
  const nome = norm(produto.nome);
  const curH1 = norm(produto.campo_hierarquico_1);
  const curH2 = norm(produto.campo_hierarquico_2);
  const curH3 = norm(produto.campo_hierarquico_3);
  const curH4 = norm(produto.campo_hierarquico_4);
  const curH5 = norm(produto.campo_hierarquico_5);
  const marca = norm(produto.marca);

  if (curH2) {
    return {
      h1: curH1,
      h2: curH2,
      h3: curH3,
      h4: curH4,
      h5: curH5 || marca,
      confidence: 'ok',
      nota: 'Já tem campo 2 — rever só se estiver errado',
    };
  }

  const inferred = inferProductPrefix(nome);
  const presentation = extractPresentation(nome) || extractPresentation(curH1) || '';

  // TINTA com tipo no nome mas h2 volume invertido no cadastro parcial
  if (upper(curH1) === 'TINTA' && curH3 && !curH2) {
    const tipo = curH3;
    const apres = presentation || curH4;
    return {
      h1: `TINTA ${tipo}`,
      h2: apres || 'AVULSO',
      h3: '',
      h4: curH4,
      h5: marca,
      confidence: 'alta',
      nota: 'Inverter: produto no h1, apresentação no h2',
    };
  }

  if (inferred) {
    return {
      h1: inferred,
      h2: presentation || 'AVULSO',
      h3: curH3,
      h4: curH4,
      h5: curH5 || marca,
      confidence: presentation ? 'alta' : 'media',
      nota: presentation ? 'Produto inferido do nome + apresentação' : 'Produto inferido; confirmar apresentação',
    };
  }

  if (curH1 && upper(curH1) !== upper(nome) && curH1.length < nome.length) {
    return {
      h1: curH1,
      h2: presentation || 'AVULSO',
      h3: curH3,
      h4: curH4,
      h5: curH5 || marca,
      confidence: presentation ? 'media' : 'baixa',
      nota: 'Manter h1; falta apresentação',
    };
  }

  // h1 = nome inteiro — encurtar para primeiras palavras significativas
  const words = nome.split(/\s+/).filter(Boolean);
  const shortH1 = words.slice(0, Math.min(4, words.length)).join(' ');
  return {
    h1: shortH1,
    h2: presentation || 'AVULSO',
    h3: curH3,
    h4: curH4,
    h5: curH5 || marca,
    confidence: 'baixa',
    nota: 'Revisar manualmente — produto avulso ou esquecido',
  };
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não definido');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const whereH2 = args.somenteSemH2 ? `and trim(coalesce(campo_hierarquico_2, '')) = ''` : '';
  const offset = (args.batch - 1) * args.size;

  const { rows: stats } = await pool.query(`
    select count(*)::int as total
    from produto
    where coalesce(ativo, true) = true
      ${whereH2}
  `);

  const { rows } = await pool.query(
    `select id, codigo_interno, nome, marca, abcd,
            coalesce(estoque_atual, 0) as estoque_atual,
            coalesce(venda_media_dia, 0) as venda_media_dia,
            coalesce(preco_custo_calculado, valor_compra, 0) as custo_unit,
            campo_hierarquico_1, campo_hierarquico_2, campo_hierarquico_3,
            campo_hierarquico_4, campo_hierarquico_5, categoria_nome
     from produto
     where coalesce(ativo, true) = true
       ${whereH2}
     order by
       (coalesce(estoque_atual, 0) * coalesce(preco_custo_calculado, valor_compra, 0)) desc,
       coalesce(venda_media_dia, 0) asc,
       nome asc
     limit $1 offset $2`,
    [args.size, offset],
  );
  await pool.end();

  const enriched = rows.map((p) => {
    const capital = (Number(p.estoque_atual) || 0) * (Number(p.custo_unit) || 0);
    const giro = Number(p.venda_media_dia) || 0;
    const sugestao = suggestHierarchy(p);
    return {
      ...p,
      capital: Math.round(capital * 100) / 100,
      segmento: giro <= 0 && capital > 0 ? 'capital_preso' : giro <= 0 ? 'sem_giro' : 'com_giro',
      ...sugestao,
      sugestao_h1: sugestao.h1,
      sugestao_h2: sugestao.h2,
      sugestao_h3: sugestao.h3,
      sugestao_h4: sugestao.h4,
      sugestao_h5: sugestao.h5,
    };
  });

  const header = [
    'id', 'codigo_interno', 'nome', 'segmento', 'capital_reais', 'estoque_atual', 'venda_media_dia', 'abcd',
    'h1_atual', 'h2_atual', 'h3_atual', 'h4_atual', 'h5_atual',
    'sugestao_h1', 'sugestao_h2', 'sugestao_h3', 'sugestao_h4', 'sugestao_h5',
    'confianca', 'nota', 'aplicar', 'marca',
  ];

  const lines = [header.join(';')];
  for (const r of enriched) {
    lines.push([
      r.id, r.codigo_interno, r.nome, r.segmento, r.capital, r.estoque_atual, r.venda_media_dia, r.abcd,
      r.campo_hierarquico_1, r.campo_hierarquico_2, r.campo_hierarquico_3, r.campo_hierarquico_4, r.campo_hierarquico_5,
      r.sugestao_h1, r.sugestao_h2, r.sugestao_h3, r.sugestao_h4, r.sugestao_h5,
      r.confidence, r.nota, r.confidence === 'ok' ? 'NAO' : 'SIM', r.marca,
    ].map(csvEscape).join(';'));
  }

  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `\uFEFF${lines.join('\n')}`, 'utf8');

  const capitalLote = enriched.reduce((s, r) => s + (r.capital || 0), 0);
  const presos = enriched.filter((r) => r.segmento === 'capital_preso').length;

  console.log(JSON.stringify({
    lote: args.batch,
    tamanho: enriched.length,
    total_fila: stats[0]?.total,
    offset,
    capital_no_lote_reais: Math.round(capitalLote * 100) / 100,
    itens_capital_preso: presos,
    arquivo: outPath,
    proximo_comando: `npm run produto:cadastro:export-lote -- --batch=${args.batch + 1}`,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
