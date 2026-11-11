#!/usr/bin/env node
/**
 * Exporta despesas (saídas) para planilha de normalização em massa.
 *
 * Uso:
 *   node scripts/export-despesas-normalizacao-xlsx.mjs --de=2026-11-06 --ate=2026-11-11
 *   node scripts/export-despesas-normalizacao-xlsx.mjs --de=2026-11-06 --ate=2026-11-11 --out=exports/foo.xlsx
 */
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { requireP38SupabaseAdmin } from './p38-supabase-admin.mjs';

const REPO_ROOT = join(import.meta.dirname, '..');

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

function tagsToString(tags) {
  if (tags == null) return '';
  if (Array.isArray(tags)) return tags.filter(Boolean).join(', ');
  if (typeof tags === 'string') return tags;
  try {
    return JSON.stringify(tags);
  } catch {
    return String(tags);
  }
}

const COLS = [
  { key: 'id', header: 'id_lancamento (não alterar)' },
  { key: 'descricao', header: 'descrição (como está)' },
  { key: 'descricao_normalizada', header: 'descrição normalizada (preencher)' },
  { key: 'plano_conta', header: 'plano de conta / categoria (como está)' },
  { key: 'plano_conta_normalizado', header: 'plano de conta normalizado (preencher)' },
  { key: 'conta_movimentacao', header: 'conta bancária / conta movimentação' },
  { key: 'centro_custos', header: 'centro de custos' },
  { key: 'centro_custos_normalizado', header: 'centro de custos normalizado (preencher)' },
  { key: 'valor', header: 'valor' },
  { key: 'valor_liquido', header: 'valor líquido' },
  { key: 'data_referencia', header: 'data (referência fluxo)' },
  { key: 'data_lancamento', header: 'data lançamento' },
  { key: 'data_pagamento', header: 'data pagamento' },
  { key: 'data_vencimento', header: 'data vencimento' },
  { key: 'status', header: 'status' },
  { key: 'forma_pagamento', header: 'forma de pagamento' },
  { key: 'forma_pagamento_tipo', header: 'tipo forma pagamento' },
  { key: 'terceiro_nome', header: 'terceiro (fornecedor/cliente)' },
  { key: 'observacoes', header: 'observações' },
  { key: 'tags', header: 'tags' },
  { key: 'referencia_tipo', header: 'referência tipo' },
  { key: 'referencia_numero', header: 'referência número' },
  { key: 'turno_caixa_id', header: 'turno caixa id' },
  { key: 'codigo_lancamento', header: 'código lançamento' },
  { key: 'categoria_id', header: 'categoria_id' },
  { key: 'conta_financeira_id', header: 'conta_financeira_id' },
  { key: 'centro_custo_id', header: 'centro_custo_id' },
  { key: 'is_custo_mercadoria', header: 'custo mercadoria (CMV)' },
];

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
  const [categorias, contas, centros] = await Promise.all([
    fetchAllRows(supabase, 'categoria_financeira', 'id,nome,tipo,ativa', 'nome'),
    fetchAllRows(supabase, 'contas_financeiras', 'id,nome,ativo,tipo', 'nome'),
    fetchAllRows(supabase, 'folha_centro_custo', 'id,nome,ativo,ordem', 'nome'),
  ]);

  const planosDespesa = categorias
    .filter((c) => String(c.tipo || '').toLowerCase() === 'despesa')
    .map((c) => String(c.nome || '').trim())
    .filter(Boolean);

  const nomesContas = contas.map((c) => String(c.nome || '').trim()).filter(Boolean);
  const nomesCentros = centros.map((c) => String(c.nome || '').trim()).filter(Boolean);

  const planos = uniqueSorted([...planosDespesa, ...rows.map((r) => r.plano_conta)]);
  const contasNomes = uniqueSorted([...nomesContas, ...rows.map((r) => r.conta_movimentacao)]);
  const centrosNomes = uniqueSorted([...nomesCentros, ...rows.map((r) => r.centro_custos)]);

  return {
    planos,
    contas: contasNomes,
    centros: centrosNomes,
    meta: {
      categorias_total: categorias.length,
      categorias_despesa: planosDespesa.length,
      contas_total: contas.length,
      centros_total: centros.length,
    },
  };
}

/** Índice 1-based das colunas com dropdown (só cadastro; normalizados ficam texto livre). */
const DROPDOWN_COL_KEYS = ['plano_conta', 'conta_movimentacao', 'centro_custos'];

function columnIndexByKey(key) {
  const idx = COLS.findIndex((c) => c.key === key);
  return idx >= 0 ? idx + 1 : null;
}

const SELECT_FIELDS = [
  'id',
  'tipo',
  'descricao',
  'categoria',
  'categoria_id',
  'centro_custo',
  'centro_custo_id',
  'conta_financeira_id',
  'conta_financeira_nome',
  'valor',
  'valor_liquido',
  'data_lancamento',
  'data_pagamento',
  'data_vencimento',
  'status',
  'forma_pagamento',
  'forma_pagamento_tipo',
  'terceiro_nome',
  'observacoes',
  'tags',
  'referencia_tipo',
  'referencia_numero',
  'turno_caixa_id',
  'codigo_lancamento',
  'is_custo_mercadoria',
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
      .order('data_lancamento', { ascending: true, nullsFirst: false })
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

function mapRow(l) {
  return {
    id: l.id,
    descricao: l.descricao ?? '',
    descricao_normalizada: '',
    plano_conta: l.categoria ?? '',
    plano_conta_normalizado: '',
    conta_movimentacao: l.conta_financeira_nome ?? '',
    centro_custos: l.centro_custo ?? '',
    centro_custos_normalizado: '',
    valor: l.valor != null ? Number(l.valor) : '',
    valor_liquido: l.valor_liquido != null ? Number(l.valor_liquido) : '',
    data_referencia: dataReferencia(l) ?? '',
    data_lancamento: toDateKey(l.data_lancamento) ?? '',
    data_pagamento: toDateKey(l.data_pagamento) ?? '',
    data_vencimento: toDateKey(l.data_vencimento) ?? '',
    status: l.status ?? '',
    forma_pagamento: l.forma_pagamento ?? '',
    forma_pagamento_tipo: l.forma_pagamento_tipo ?? '',
    terceiro_nome: l.terceiro_nome ?? '',
    observacoes: l.observacoes ?? '',
    tags: tagsToString(l.tags),
    referencia_tipo: l.referencia_tipo ?? '',
    referencia_numero: l.referencia_numero ?? '',
    turno_caixa_id: l.turno_caixa_id ?? '',
    codigo_lancamento: l.codigo_lancamento ?? '',
    categoria_id: l.categoria_id ?? '',
    conta_financeira_id: l.conta_financeira_id ?? '',
    centro_custo_id: l.centro_custo_id ?? '',
    is_custo_mercadoria: l.is_custo_mercadoria === true ? 'sim' : l.is_custo_mercadoria === false ? 'não' : '',
  };
}

function writeListasSheet(wb, lookups) {
  const ws = wb.addWorksheet('Listas', {
    state: 'veryHidden',
  });
  ws.getCell('A1').value = 'Plano de conta (Despesa)';
  ws.getCell('C1').value = 'Conta bancária / movimentação';
  ws.getCell('E1').value = 'Centro de custos';
  [1, 3, 5].forEach((c) => {
    ws.getCell(1, c).font = { bold: true };
  });

  const maxLen = Math.max(lookups.planos.length, lookups.contas.length, lookups.centros.length, 1);
  const pad = 50;
  for (let i = 0; i < maxLen + pad; i++) {
    const r = i + 2;
    if (lookups.planos[i]) ws.getCell(r, 1).value = lookups.planos[i];
    if (lookups.contas[i]) ws.getCell(r, 3).value = lookups.contas[i];
    if (lookups.centros[i]) ws.getCell(r, 5).value = lookups.centros[i];
  }

  const lastPlano = 1 + lookups.planos.length + pad;
  const lastConta = 1 + lookups.contas.length + pad;
  const lastCentro = 1 + lookups.centros.length + pad;

  return {
    planoRef: `'Listas'!$A$2:$A$${lastPlano}`,
    contaRef: `'Listas'!$C$2:$C$${lastConta}`,
    centroRef: `'Listas'!$E$2:$E$${lastCentro}`,
  };
}

function applyDropdownValidations(ws, rows, listRefs) {
  const lastDataRow = Math.max(rows.length + 1, 2);
  const lastRow = Math.max(lastDataRow + 200, 500);
  const refsByKey = {
    plano_conta: listRefs.planoRef,
    conta_movimentacao: listRefs.contaRef,
    centro_custos: listRefs.centroRef,
  };

  for (const key of DROPDOWN_COL_KEYS) {
    const col = columnIndexByKey(key);
    if (!col) continue;
    const letter = colLetter(col);
    const range = `${letter}2:${letter}${lastRow}`;
    ws.dataValidations.add(range, {
      type: 'list',
      allowBlank: true,
      showDropDown: false,
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Escolha um valor da lista (cadastro P38) ou copie um valor existente na coluna.',
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
    width: Math.min(48, Math.max(14, c.header.length + 2)),
  }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F0FE' },
  };

  for (const row of rows) {
    ws.addRow(row);
  }

  applyDropdownValidations(ws, rows, listRefs);

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLS.length },
  };

  const instr = wb.addWorksheet('Instruções');
  instr.getColumn(1).width = 100;
  const lines = [
    `Exportado em: ${meta.exportedAt}`,
    `Período (data referência fluxo): ${meta.de} a ${meta.ate}`,
    `Linhas de despesas: ${rows.length}`,
    '',
    `Listas no sistema: ${lookups.meta.categorias_despesa} planos de conta (despesa), ${lookups.meta.contas_total} contas, ${lookups.meta.centros_total} centros de custo.`,
    '',
    'Como usar:',
    '1. Filtre pela coluna "descrição (como está)" e preencha "descrição normalizada" em massa (texto livre).',
    '2. Plano de conta, conta bancária e centro de custos (como está): só valores da lista (dropdown).',
    '3. Colunas "… normalizado (preencher)": texto livre para o rótulo padronizado desejado.',
    '4. Não altere id_lancamento — serve para aplicar correções de volta no sistema.',
    '',
    'Exemplo de normalização (aba Despesas — linhas só ilustrativas se não houver dados reais):',
    '• "almoço de casa", "almoço", "ALMOCO" → "Alimentação — refeições"',
    '• "combustivel", "gasolina" → "Combustível"',
  ];
  lines.forEach((t, i) => {
    instr.getCell(i + 1, 1).value = t;
  });

  await wb.xlsx.writeFile(outPath);
}

const { de, ate, out } = parseArgs(process.argv.slice(2));
const supabase = requireP38SupabaseAdmin();

console.log(`[export] A buscar despesas ${de} … ${ate} …`);
const lancs = await fetchDespesas(supabase, de, ate);
const rows = lancs.map(mapRow).sort((a, b) => {
  const da = a.data_referencia || '';
  const db = b.data_referencia || '';
  if (da !== db) return da.localeCompare(db);
  return String(a.descricao).localeCompare(String(b.descricao), 'pt-BR');
});

const lookups = await fetchLookupLists(supabase, rows);
console.log(
  `[export] listas: ${lookups.planos.length} planos · ${lookups.contas.length} contas · ${lookups.centros.length} centros`,
);

await writeWorkbook(
  out,
  rows,
  {
    de,
    ate,
    exportedAt: new Date().toISOString(),
  },
  lookups,
);

console.log(`[export] ${rows.length} despesas → ${out}`);
