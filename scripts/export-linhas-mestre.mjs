#!/usr/bin/env node
/**
 * Excel: tabela LINHAS mestre para aprovação (antes de SQL).
 * Inclui proposta de tipo + contagem de SKUs por regra automática.
 *
 * Uso: npm run export:linhas-mestre
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';
import { norm } from './lib/planLinhaCompraAnalise.mjs';

const OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-linhas-mestre-aprovacao.xlsx');

/** Lista inicial para validação — editar STATUS na folha antes de criar tabela SQL. */
const LINHAS_MESTRE = [
  { ordem: 10, codigo: 'CIMENTO', nome: 'CIMENTO', tipo: 'solo', notas: 'Pilot — sem grelha; marca/embalagem no SKU' },
  { ordem: 20, codigo: 'ARGAMASSA', nome: 'ARGAMASSA', tipo: 'mix', notas: 'Pilot — classe × embalagem (definir eixos depois)' },
  { ordem: 30, codigo: 'PISO', nome: 'PISO / CERÂMICA DE PISO', tipo: 'portfolio', notas: 'Pilot — formato × modelo; inclui h1=PISO' },
  { ordem: 40, codigo: 'PORCELANATO', nome: 'PORCELANATO', tipo: 'portfolio', notas: 'Pode fundir com PISO mais tarde' },
  { ordem: 50, codigo: 'REVESTIMENTO', nome: 'REVESTIMENTO', tipo: 'portfolio', notas: 'Parede, fachada, etc.' },
  { ordem: 60, codigo: 'SOLDAVEL', nome: 'SOLDÁVEL', tipo: 'mix', notas: 'Pilot — h2=soldável; peça × medida (eixos depois)' },
  { ordem: 70, codigo: 'ESGOTO', nome: 'ESGOTO', tipo: 'mix', notas: 'Tubos e conexões esgoto — h2 ou família' },
  { ordem: 80, codigo: 'ROSCAVEL', nome: 'ROSCÁVEL', tipo: 'mix', notas: 'Conexões roscáveis — h2 ou família' },
  { ordem: 90, codigo: 'TINTA', nome: 'TINTA', tipo: 'portfolio', notas: 'Pilot — apresentação × cor (eixos depois)' },
  { ordem: 100, codigo: 'VERNIZ', nome: 'VERNIZ', tipo: 'portfolio', notas: 'Pode agrupar em TINTA & VERNIZ depois' },
  { ordem: 110, codigo: 'MASSA_CORRIDA', nome: 'MASSA CORRIDA', tipo: 'mix', notas: '' },
  { ordem: 120, codigo: 'MASSA_ACRILICA', nome: 'MASSA ACRÍLICA', tipo: 'mix', notas: '' },
  { ordem: 130, codigo: 'REJUNTE', nome: 'REJUNTE', tipo: 'mix', notas: 'Marca × cor (h3×h4 hoje)' },
  { ordem: 140, codigo: 'PREGO', nome: 'PREGO', tipo: 'solo', notas: 'Pode virar mix se separar medida' },
  { ordem: 150, codigo: 'PARAFUSO', nome: 'PARAFUSO', tipo: 'mix', notas: '' },
  { ordem: 160, codigo: 'TORNEIRA', nome: 'TORNEIRA', tipo: 'portfolio', notas: 'Aplicação × modelo (template futuro)' },
  { ordem: 170, codigo: 'METAIS_SANITARIOS', nome: 'METAIS SANITÁRIOS', tipo: 'portfolio', notas: 'Chuveiro, válvula, registro…' },
  { ordem: 180, codigo: 'TUBO', nome: 'TUBO (geral)', tipo: 'mix', notas: 'Rever: pode ir para SOLDÁVEL/ESGOTO/ROSCÁVEL' },
  { ordem: 190, codigo: 'LIXA', nome: 'LIXA', tipo: 'mix', notas: '' },
  { ordem: 200, codigo: 'ELETRICA', nome: 'MATERIAL ELÉTRICO', tipo: 'mix', notas: 'Disjuntores, cabos, lâmpadas… agrupar depois' },
  { ordem: 210, codigo: 'FERRAGEM', nome: 'FERRAGEM', tipo: 'mix', notas: 'Fechadura, dobradiça, etc.' },
  { ordem: 220, codigo: 'IMPERMEABILIZANTE', nome: 'IMPERMEABILIZANTE', tipo: 'mix', notas: '' },
  { ordem: 230, codigo: 'ADESIVO', nome: 'ADESIVO', tipo: 'mix', notas: '' },
  { ordem: 900, codigo: 'OUTROS', nome: 'OUTROS / A CLASSIFICAR', tipo: 'solo', notas: 'SKUs sem regra clara — IA + massa' },
];

function isSoldavel(p) {
  const h2 = norm(p.campo_hierarquico_2);
  return h2 === 'SOLDÁVEL' || h2 === 'SOLDAVEL';
}

function h1(p) {
  return norm(p.campo_hierarquico_1);
}

function h2(p) {
  return norm(p.campo_hierarquico_2);
}

function h1includes(p, txt) {
  return h1(p).includes(norm(txt));
}

/** Regra automática (proposta IA / script) — só para contagem no Excel. */
export function inferirLinhaCodigo(produto) {
  if (isSoldavel(produto)) return 'SOLDAVEL';
  const n1 = h1(produto);
  const n2 = h2(produto);

  if (n1.includes('CIMENTO')) return 'CIMENTO';
  if (n1 === 'ARGAMASSA') return 'ARGAMASSA';
  if (n1 === 'PISO') return 'PISO';
  if (n1 === 'PORCELANATO' || n1 === 'PORCELENATO') return 'PORCELANATO';
  if (n1 === 'REVESTIMENTO') return 'REVESTIMENTO';
  if (n1 === 'TINTA' || n1 === 'TINTA SPRAY') return 'TINTA';
  if (n1 === 'VERNIZ') return 'VERNIZ';
  if (n1.includes('MASSA CORRIDA')) return 'MASSA_CORRIDA';
  if (n1.includes('MASSA ACR')) return 'MASSA_ACRILICA';
  if (n1 === 'REJUNTE' || n1.includes('REJUNTE')) return 'REJUNTE';
  if (n1 === 'PREGO') return 'PREGO';
  if (n1.includes('PARAFUSO')) return 'PARAFUSO';
  if (n2.includes('ESGOTO') || n1.includes('ESGOTO')) return 'ESGOTO';
  if (n2.includes('ROSC') || n1.includes('ROSC')) return 'ROSCAVEL';
  if (n1.includes('TORNEIRA')) return 'TORNEIRA';
  if (['CHUVEIRO', 'REGISTRO', 'REGISTRO ESFERA', 'VALVULA', 'VALVULA DE DESCARGA', 'CAIXA DE DESCARGA', 'ASSENTO SANITÁRIO', 'MONOCOMANDO'].some((k) => n1.includes(k))) {
    return 'METAIS_SANITARIOS';
  }
  if (n1 === 'TUBO' || n1.includes('TUBO')) return 'TUBO';
  if (n1 === 'LIXA') return 'LIXA';
  if (['DISJUNTOR', 'CABO', 'LAMPADA', 'LUMINÁRIA', 'TOMADA', 'INTERRUPTOR'].some((k) => n1.includes(k))) return 'ELETRICA';
  if (['FECHADURA', 'DOBRADIÇA', 'PUXADOR', 'TRINCO'].some((k) => n1.includes(k))) return 'FERRAGEM';
  if (n1.includes('IMPERMEAB')) return 'IMPERMEABILIZANTE';
  if (n1.includes('ADESIVO') || n1.includes('COLA ')) return 'ADESIVO';

  return 'OUTROS';
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5240' } };
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const { rows: produtos } = await client.query(`
    select id, nome, categoria_nome,
           campo_hierarquico_1, campo_hierarquico_2, campo_hierarquico_3
    from produto where ativo = true
  `);
  await client.end();

  const counts = new Map(LINHAS_MESTRE.map((l) => [l.codigo, 0]));
  const h1map = new Map();
  for (const p of produtos) {
    const cod = inferirLinhaCodigo(p);
    counts.set(cod, (counts.get(cod) || 0) + 1);
    const key = `${norm(p.campo_hierarquico_1)}||${norm(p.campo_hierarquico_2)}`;
    const cur = h1map.get(key) || {
      h1: p.campo_hierarquico_1 || '',
      h2: p.campo_hierarquico_2 || '',
      linha_codigo: cod,
      skus: 0,
      exemplo: p.nome,
    };
    cur.skus += 1;
    h1map.set(key, cur);
  }

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const leiame = wb.addWorksheet('LEIA-ME');
  [
    ['P38 — LINHAS mestre (aprovação antes da base de dados)'],
    [''],
    ['1. Edite a aba LINHAS mestre: coluna STATUS (SIM / NÃO / AJUSTAR) e OBSERVAÇÕES.'],
    ['2. tipo = solo | mix | portfolio — template de comportamento (não engessa o SKU).'],
    ['3. Eixos A/B ficam vazios — você preenche manualmente depois.'],
    ['4. Qtd SKUs (proposta) = contagem automática por regras (não é IA ainda).'],
    ['5. Abas Mapa h1→LINHA e Amostra SKUs ajudam a validar.'],
    [''],
    ['Fluxo acordado: aprovar LINHAS → SQL → IA atribui linha+tipo → massa → eixos manual.'],
    [`Gerado: ${new Date().toLocaleString('pt-BR')} · ${produtos.length} SKUs ativos`],
  ].forEach((line, i) => {
    leiame.getCell(i + 1, 1).value = line[0];
    if (i === 0) leiame.getCell(i + 1, 1).font = { bold: true, size: 12 };
  });
  leiame.getColumn(1).width = 95;

  const ws = wb.addWorksheet('LINHAS mestre', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Ordem', key: 'ordem', width: 8 },
    { header: 'Código', key: 'codigo', width: 18 },
    { header: 'Nome da LINHA', key: 'nome', width: 28 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Rótulo eixo A (depois)', key: 'eixo_a', width: 22 },
    { header: 'Rótulo eixo B (depois)', key: 'eixo_b', width: 22 },
    { header: 'Notas', key: 'notas', width: 36 },
    { header: 'Qtd SKUs (proposta)', key: 'skus', width: 16 },
    { header: 'STATUS', key: 'status', width: 12 },
    { header: 'OBSERVAÇÕES João', key: 'obs', width: 28 },
  ];
  styleHeader(ws.getRow(1));

  const tipoHelp = {
    solo: 'Lista simples — pouca ou nenhuma grelha',
    mix: 'Grelha A × B',
    portfolio: 'Família com variantes (modelos, cores…)',
  };

  for (const l of LINHAS_MESTRE) {
    ws.addRow({
      ordem: l.ordem,
      codigo: l.codigo,
      nome: l.nome,
      tipo: l.tipo,
      eixo_a: '',
      eixo_b: '',
      notas: l.notas ? `${l.notas} | ${tipoHelp[l.tipo]}` : tipoHelp[l.tipo],
      skus: counts.get(l.codigo) || 0,
      status: '',
      obs: '',
    });
  }
  ws.autoFilter = { from: 'A1', to: `J${LINHAS_MESTRE.length + 1}` };

  const mapa = [...h1map.values()]
    .sort((a, b) => b.skus - a.skus || a.h1.localeCompare(b.h1, 'pt-BR'))
    .map((r) => {
      const linha = LINHAS_MESTRE.find((l) => l.codigo === r.linha_codigo);
      return {
        h1: r.h1,
        h2: r.h2,
        linha_codigo: r.linha_codigo,
        linha_nome: linha?.nome || r.linha_codigo,
        tipo: linha?.tipo || '',
        skus: r.skus,
        exemplo_sku: r.exemplo,
      };
    });

  const wsMapa = wb.addWorksheet('Mapa h1→LINHA', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsMapa.columns = [
    { header: 'h1 cadastro', key: 'h1', width: 28 },
    { header: 'h2 cadastro', key: 'h2', width: 18 },
    { header: 'Cód. LINHA proposta', key: 'linha_codigo', width: 18 },
    { header: 'Nome LINHA', key: 'linha_nome', width: 24 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'SKUs', key: 'skus', width: 8 },
    { header: 'Exemplo SKU', key: 'exemplo_sku', width: 42 },
  ];
  styleHeader(wsMapa.getRow(1));
  mapa.forEach((r) => wsMapa.addRow(r));

  const amostra = produtos
    .map((p) => {
      const cod = inferirLinhaCodigo(p);
      const linha = LINHAS_MESTRE.find((l) => l.codigo === cod);
      return {
        linha_nome: linha?.nome || cod,
        tipo: linha?.tipo || '',
        nome: p.nome,
        h1: p.campo_hierarquico_1,
        h2: p.campo_hierarquico_2,
        categoria: p.categoria_nome || '',
      };
    })
    .sort((a, b) => a.linha_nome.localeCompare(b.linha_nome, 'pt-BR'));

  const wsA = wb.addWorksheet('Amostra SKUs', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsA.columns = [
    { header: 'LINHA proposta', key: 'linha_nome', width: 24 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Nome SKU', key: 'nome', width: 44 },
    { header: 'h1', key: 'h1', width: 20 },
    { header: 'h2', key: 'h2', width: 14 },
    { header: 'Categoria', key: 'categoria', width: 24 },
  ];
  styleHeader(wsA.getRow(1));
  amostra.slice(0, 500).forEach((r) => wsA.addRow(r));
  if (amostra.length > 500) {
    wsA.addRow({ linha_nome: `… +${amostra.length - 500} SKUs (ver Mapa h1→LINHA)` });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);

  try {
    fs.copyFileSync(OUT, '/opt/cursor/artifacts/P38-linhas-mestre-aprovacao.xlsx');
  } catch { /* ok */ }

  console.log(`[export-linhas-mestre] ${LINHAS_MESTRE.length} linhas → ${OUT}`);
  console.log('Contagem:', [...counts.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
