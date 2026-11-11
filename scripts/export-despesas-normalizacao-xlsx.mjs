#!/usr/bin/env node
/**
 * Exporta despesas (saídas) para planilha enxuta de normalização em massa.
 * Aba visível: 7 colunas (ref + id + descrições + plano + centro + budget).
 *
 * Uso:
 *   node scripts/export-despesas-normalizacao-xlsx.mjs --de=2026-11-06 --ate=2026-11-11
 */
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { requireP38SupabaseAdmin } from './p38-supabase-admin.mjs';

const REPO_ROOT = join(import.meta.dirname, '..');

/** Colunas visíveis na aba Despesas (máx. 7). */
const COLS = [
  { key: 'ref_codigo', header: 'ref (data-hora)', width: 16 },
  { key: 'id_lancamento', header: 'id_lancamento (recepção)', width: 38 },
  { key: 'descricao', header: 'descrição (como está)', width: 36 },
  { key: 'descricao_corrigida', header: 'descrição corrigida', width: 36 },
  { key: 'plano_conta', header: 'plano de conta', width: 28 },
  { key: 'centro_custos', header: 'centro de custos', width: 22 },
  { key: 'budget', header: 'budget (modelo)', width: 28 },
];

const DROPDOWN_COL_KEYS = ['plano_conta', 'centro_custos', 'budget'];

function parseArgs(argv) {
  const get = (prefix) => argv.find((a) => a.startsWith(prefix))?.slice(prefix.length) ?? '';
  const de = get('--de=') || '2026-11-06';
  const ate = get('--ate=') || '2026-11-11';
  const out =
    get('--out=') ||
    join(REPO_ROOT, 'exports', `despesas-normalizacao_${de}_a_${ate}.xlsx`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) {
    console.error('Datas inválidas. Use --de=YYYY-MM-DD --ate=YYYY-MM-DD');
    process.exit(1);
  }
  return { de, ate, out };
}

function toDateKey(val) {
  if (val == null || val === '') return null;
  const s = String(val);
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function dataReferencia(l) {
  return (
    toDateKey(l.data_lancamento) ||
    toDateKey(l.data_pagamento) ||
    toDateKey(l.data_vencimento)
  );
}

/**
 * Referência legível a partir de codigo_lancamento AAAAMMDDHHMMSS.
 * Formato: AAAAMMDD-HHMMSS (fácil de ordenar e localizar no fluxo).
 */
function refCodigoDataHora(lanc, seq = 0) {
  const c = String(lanc?.codigo_lancamento || '').trim();
  if (/^\d{14}$/.test(c)) {
    return `${c.slice(0, 8)}-${c.slice(8, 14)}`;
  }
  const instant =
    lanc?.data_lancamento ||
    (lanc?.data_pagamento ? `${lanc.data_pagamento}T12:00:00` : null) ||
    (lanc?.data_vencimento ? `${lanc.data_vencimento}T00:00:00` : null);
  if (instant) {
    const d = new Date(instant);
    if (!Number.isNaN(d.getTime())) {
      const p = (n, len = 2) => String(n).padStart(len, '0');
      const y = p(d.getFullYear(), 4);
      const mo = p(d.getMonth() + 1);
      const da = p(d.getDate());
      const h = p(d.getHours());
      const mi = p(d.getMinutes());
      const s = p(d.getSeconds());
      return `${y}${mo}${da}-${h}${mi}${s}`;
    }
  }
  return `SEM-COD-${String(seq).padStart(4, '0')}`;
}

function colLetter(colIndex1Based) {
  let n = colIndex1Based;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function uniqueSorted(names) {
  const set = new Set();
  for (const raw of names) {
    const t = String(raw ?? '').trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

async function fetchAllRows(supabase, table, select, orderBy) {
  const pageSize = 1000;
  let offset = 0;
  const all = [];
  for (;;) {
    let q = supabase.from(table).select(select);
    if (orderBy) q = q.order(orderBy, { ascending: true });
    const { data, error } = await q.range(offset, offset + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function fetchLookupLists(supabase, rows) {
  const [categorias, centros, budgets] = await Promise.all([
    fetchAllRows(supabase, 'categoria_financeira', 'id,nome,tipo,ativa', 'nome'),
    fetchAllRows(supabase, 'folha_centro_custo', 'id,nome,ativo,ordem', 'nome'),
    fetchAllRows(supabase, 'budget_modelo', 'id,nome,ativo,categoria_nome,centro_custo', 'nome'),
  ]);

  const planosDespesa = categorias
    .filter((c) => String(c.tipo || '').toLowerCase() === 'despesa')
    .map((c) => String(c.nome || '').trim())
    .filter(Boolean);

  const nomesCentros = centros.map((c) => String(c.nome || '').trim()).filter(Boolean);
  const nomesBudget = budgets
    .filter((b) => b.ativo !== false)
    .map((b) => String(b.nome || '').trim())
    .filter(Boolean);

  const planos = uniqueSorted([...planosDespesa, ...rows.map((r) => r.plano_conta)]);
  const centrosNomes = uniqueSorted([...nomesCentros, ...rows.map((r) => r.centro_custos)]);
  const budgetsNomes = uniqueSorted([...nomesBudget, ...rows.map((r) => r.budget)]);

  return {
    planos,
    centros: centrosNomes,
    budgets: budgetsNomes,
    meta: {
      categorias_despesa: planosDespesa.length,
      centros_total: centros.length,
      budgets_total: budgets.length,
    },
  };
}

function columnIndexByKey(key) {
  const idx = COLS.findIndex((c) => c.key === key);
  return idx >= 0 ? idx + 1 : null;
}

const SELECT_FIELDS = [
  'id',
  'tipo',
  'descricao',
  'categoria',
  'centro_custo',
  'codigo_lancamento',
  'data_lancamento',
  'data_pagamento',
  'data_vencimento',
].join(',');

async function fetchDespesas(supabase, de, ate) {
  const pageSize = 1000;
  let offset = 0;
  const all = [];

  for (;;) {
    const { data, error } = await supabase
      .from('lancamento_financeiro')
      .select(SELECT_FIELDS)
      .eq('tipo', 'Despesa')
      .neq('status', 'Cancelado')
      .order('codigo_lancamento', { ascending: true, nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Supabase: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all.filter((l) => {
    const d = dataReferencia(l);
    return d && d >= de && d <= ate;
  });
}

function inferBudgetNome(lanc, modelosByCatCentro) {
  const cat = String(lanc.categoria || '').trim();
  const cc = String(lanc.centro_custo || '').trim();
  if (!cat && !cc) return '';
  const key = `${cat}||${cc}`;
  return modelosByCatCentro.get(key) || '';
}

async function loadBudgetHints(supabase) {
  const modelos = await fetchAllRows(
    supabase,
    'budget_modelo',
    'nome,categoria_nome,centro_custo,ativo',
    'nome',
  );
  const map = new Map();
  for (const m of modelos) {
    if (m.ativo === false) continue;
    const k = `${String(m.categoria_nome || '').trim()}||${String(m.centro_custo || '').trim()}`;
    if (!map.has(k) && m.nome) map.set(k, String(m.nome).trim());
  }
  return map;
}

function mapRow(lanc, seq, budgetHints) {
  return {
    ref_codigo: refCodigoDataHora(lanc, seq),
    id_lancamento: lanc.id,
    descricao: lanc.descricao ?? '',
    descricao_corrigida: '',
    plano_conta: lanc.categoria ?? '',
    centro_custos: lanc.centro_custo ?? '',
    budget: inferBudgetNome(lanc, budgetHints),
  };
}

function writeListasSheet(wb, lookups) {
  const ws = wb.addWorksheet('Listas', { state: 'veryHidden' });
  ws.getCell('A1').value = 'Plano de conta (Despesa)';
  ws.getCell('C1').value = 'Centro de custos';
  ws.getCell('E1').value = 'Budget (modelo)';
  [1, 3, 5].forEach((c) => {
    ws.getCell(1, c).font = { bold: true };
  });

  const maxLen = Math.max(
    lookups.planos.length,
    lookups.centros.length,
    lookups.budgets.length,
    1,
  );
  const pad = 30;
  for (let i = 0; i < maxLen + pad; i++) {
    const r = i + 2;
    if (lookups.planos[i]) ws.getCell(r, 1).value = lookups.planos[i];
    if (lookups.centros[i]) ws.getCell(r, 3).value = lookups.centros[i];
    if (lookups.budgets[i]) ws.getCell(r, 5).value = lookups.budgets[i];
  }

  const lastPlano = 1 + lookups.planos.length + pad;
  const lastCentro = 1 + lookups.centros.length + pad;
  const lastBudget = 1 + lookups.budgets.length + pad;

  return {
    planoRef: `'Listas'!$A$2:$A$${lastPlano}`,
    centroRef: `'Listas'!$C$2:$C$${lastCentro}`,
    budgetRef: `'Listas'!$E$2:$E$${lastBudget}`,
  };
}

function applyDropdownValidations(ws, rows, listRefs) {
  const lastRow = Math.max(rows.length + 1 + 200, 500);
  const refsByKey = {
    plano_conta: listRefs.planoRef,
    centro_custos: listRefs.centroRef,
    budget: listRefs.budgetRef,
  };

  for (const key of DROPDOWN_COL_KEYS) {
    const col = columnIndexByKey(key);
    if (!col) continue;
    const letter = colLetter(col);
    ws.dataValidations.add(`${letter}2:${letter}${lastRow}`, {
      type: 'list',
      allowBlank: true,
      showDropDown: false,
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Use um valor do cadastro P38 (lista suspensa).',
      formulae: [refsByKey[key]],
    });
  }
}

async function writeWorkbook(outPath, rows, meta, lookups) {
  mkdirSync(dirname(outPath), { recursive: true });
  const wb = new ExcelJS.Workbook();
  wb.creator = 'P38-ERP export-despesas-normalizacao';
  wb.created = new Date();

  const listRefs = writeListasSheet(wb, lookups);

  const ws = wb.addWorksheet('Despesas', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.columns = COLS.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F0FE' },
  };

  for (const row of rows) {
    const r = ws.addRow(row);
    r.getCell('id_lancamento').font = { color: { argb: 'FF6B7280' }, size: 9 };
  }

  applyDropdownValidations(ws, rows, listRefs);

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLS.length },
  };

  const instr = wb.addWorksheet('Instruções');
  instr.getColumn(1).width = 96;
  const lines = [
    `Exportado em: ${meta.exportedAt}`,
    `Período (data referência fluxo): ${meta.de} a ${meta.ate}`,
    `Linhas: ${rows.length}`,
    '',
    '7 colunas na aba Despesas:',
    '• ref (data-hora): AAAAMMDD-HHMMSS do lançamento — só consulta.',
    '• id_lancamento: chave para devolver correções ao P38 — não alterar.',
    '• descrição (como está): referência; descrição corrigida: texto livre (deixe vazio se não mudar).',
    '• plano de conta, centro de custos, budget: lista do cadastro (dropdown).',
    '',
    `Listas: ${lookups.meta.categorias_despesa} planos · ${lookups.meta.centros_total} centros · ${lookups.meta.budgets_total} budgets no sistema.`,
    'Budget na exportação: sugestão quando plano+centro batem com um modelo; pode alterar.',
  ];
  lines.forEach((t, i) => {
    instr.getCell(i + 1, 1).value = t;
  });

  await wb.xlsx.writeFile(outPath);
}

const { de, ate, out } = parseArgs(process.argv.slice(2));
const supabase = requireP38SupabaseAdmin();

console.log(`[export] A buscar despesas ${de} … ${ate} …`);
const [lancs, budgetHints] = await Promise.all([
  fetchDespesas(supabase, de, ate),
  loadBudgetHints(supabase),
]);

const rows = lancs
  .map((l, i) => mapRow(l, i + 1, budgetHints))
  .sort((a, b) => {
    const cmp = a.ref_codigo.localeCompare(b.ref_codigo);
    if (cmp !== 0) return cmp;
    return String(a.descricao).localeCompare(String(b.descricao), 'pt-BR');
  });

const lookups = await fetchLookupLists(supabase, rows);
console.log(
  `[export] listas: ${lookups.planos.length} planos · ${lookups.centros.length} centros · ${lookups.budgets.length} budgets`,
);

await writeWorkbook(out, rows, { de, ate, exportedAt: new Date().toISOString() }, lookups);

console.log(`[export] ${rows.length} despesas · ${COLS.length} colunas → ${out}`);
