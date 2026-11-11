#!/usr/bin/env node
/**
 * PDF — produtos com estoque_atual < 0, ordem alfabética por nome,
 * quantidades na unidade de vitrine (catálogo/PDV).
 *
 * Uso: node scripts/gerar-pdf-estoque-negativo-restante-vitrine.mjs [--out=/path/file.pdf]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { jsPDF } from 'jspdf';
import { createClient } from '@supabase/supabase-js';
import { loadDotEnvFiles } from './base44-env.mjs';
import { loadP38SecretsBundle } from './load-p38-secrets-bundle.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseOut(argv) {
  const hit = argv.find((a) => a.startsWith('--out='));
  if (hit) return hit.slice('--out='.length);
  const day = new Date().toISOString().slice(0, 10);
  return path.join('/opt/cursor/artifacts', `estoque-negativo-restante-vitrine-${day}.pdf`);
}

function truncate(text, max) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function hydrateProduto(p) {
  const d = p.dados && typeof p.dados === 'object' ? p.dados : {};
  return {
    ...p,
    unidade_vitrine: p.unidade_vitrine ?? d.unidade_vitrine,
    unidade_comercial_id: p.unidade_comercial_id ?? d.unidade_comercial_id,
    unidade_apresentacao_default: p.unidade_apresentacao_default ?? d.unidade_apresentacao_default,
    unidade_show_comercial: p.unidade_show_comercial ?? d.unidade_show_comercial,
    unidade_show_ativa: p.unidade_show_ativa ?? d.unidade_show_ativa,
    unidades: p.unidades ?? d.unidades,
    unidades_alternativas: p.unidades_alternativas ?? d.unidades_alternativas,
  };
}

async function fetchNegativos(supabase) {
  const all = [];
  let from = 0;
  const page = 500;
  while (true) {
    const { data, error } = await supabase
      .from('produto')
      .select('*')
      .lt('estoque_atual', 0)
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data.map(hydrateProduto));
    if (data.length < page) break;
    from += data.length;
  }
  return all;
}

async function main() {
  const outPath = parseOut(process.argv.slice(2));
  loadDotEnvFiles();
  loadP38SecretsBundle();
  const secrets = resolveP38Secrets();
  const url = secrets.supabaseUrl || `https://${secrets.projectRef}.supabase.co`;
  const supabase = createClient(url, secrets.serviceRoleKey, { auth: { persistSession: false } });

  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
  const unitsLib = await server.ssrLoadModule('/src/lib/productUnits.js');
  const { formatEstoqueDisponivelApresentacao, formatCommercialQuantity } = unitsLib;
  const raw = await fetchNegativos(supabase);

  const rows = raw
    .map((p) => {
      const ap = formatEstoqueDisponivelApresentacao(p);
      const unidade = ap?.sigla || p.unidade_principal || 'UN';
      const qtd = ap?.quantidade ?? (Number(p.estoque_atual) || 0);
      return {
        codigo: p.codigo_interno || '—',
        nome: p.nome || '—',
        categoria: (p.categoria_nome || '').trim() || '(Sem categoria)',
        ativo: p.ativo ? 'Sim' : 'Não',
        unidade,
        qtd,
        qtdLabel: formatCommercialQuantity(qtd, unidade),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const marginL = 14;
  const marginR = 14;
  const pageW = 210;
  const contentW = pageW - marginL - marginR;
  let y = 16;

  const title = 'Estoque negativo — itens em falta';
  const subtitle = `${rows.length} produto(s) · unidade de vitrine · ${new Date().toLocaleString('pt-BR')}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, marginL, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(subtitle, marginL, y);
  doc.setTextColor(0, 0, 0);
  y += 8;

  const col = {
    codigo: marginL,
    nome: marginL + 22,
    categoria: marginL + 98,
    qtd: pageW - marginR - 28,
    un: pageW - marginR - 10,
  };

  const headerH = 7;
  doc.setFillColor(240, 240, 240);
  doc.rect(marginL, y - 4, contentW, headerH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Código', col.codigo, y);
  doc.text('Produto (A–Z)', col.nome, y);
  doc.text('Categoria', col.categoria, y);
  doc.text('Qtd vitrine', col.qtd, y, { align: 'right' });
  doc.text('Un.', col.un, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const lineH = 5.2;

  function newPageIfNeeded(extra = lineH) {
    if (y + extra > 287) {
      doc.addPage();
      y = 16;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('(continuação)', marginL, y);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }
  }

  for (const row of rows) {
    newPageIfNeeded();
    doc.text(truncate(row.codigo, 12), col.codigo, y);
    const nomeLines = doc.splitTextToSize(truncate(row.nome, 120), 72);
    doc.text(nomeLines[0], col.nome, y);
    doc.text(truncate(row.categoria, 38), col.categoria, y);
    doc.setTextColor(180, 0, 0);
    doc.text(String(row.qtdLabel), col.qtd, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.text(row.unidade, col.un, y);
    y += lineH;
    if (nomeLines.length > 1) {
      newPageIfNeeded();
      doc.text(nomeLines[1], col.nome, y);
      y += lineH;
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const buf = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outPath, buf);

  console.log(
    JSON.stringify(
      {
        ok: true,
        out: outPath,
        total: rows.length,
        amostra: rows.slice(0, 3).map((r) => ({
          codigo: r.codigo,
          nome: r.nome,
          vitrine: `${r.qtdLabel} ${r.unidade}`,
        })),
      },
      null,
      2,
    ),
  );
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
