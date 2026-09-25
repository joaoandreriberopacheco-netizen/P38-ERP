#!/usr/bin/env node
/**
 * Unifica terceiros duplicados (mesmo cliente/fornecedor) e normaliza nomes em MAIÚSCULAS.
 *
 *   node scripts/unificar-terceiros-duplicados.mjs           # dry-run + relatório JSON
 *   node scripts/unificar-terceiros-duplicados.mjs --apply   # aplica na base Supabase P38
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveP38Secrets } from './p38-secrets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'unificar-terceiros-report.json');

const apply = process.argv.includes('--apply');
const secrets = resolveP38Secrets();
const SUPABASE_URL = secrets.viteSupabaseUrl || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || secrets.viteSupabaseAnonKey;

if (!SUPABASE_KEY) {
  console.error('[unificar-terceiros] Sem chave Supabase (SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

/** @typedef {{ id: string, nome: string | null, tipo: string | null, cpf_cnpj?: string | null, telefone?: string | null, created_at?: string | null }} TerceiroRow */

const ID_REF_TABLES = [
  { table: 'pedido_venda', idCol: 'cliente_id', nameCol: 'cliente_nome' },
  { table: 'pedido_compra', idCol: 'fornecedor_id', nameCol: 'fornecedor_nome' },
  { table: 'embarque', idCol: 'fornecedor_id', nameCol: 'fornecedor_nome' },
  { table: 'lancamento_financeiro', idCol: 'terceiro_id', nameCol: 'terceiro_nome' },
  { table: 'conta_recorrente', idCol: 'terceiro_id', nameCol: 'terceiro_nome' },
  { table: 'conta_prevista', idCol: 'terceiro_id', nameCol: 'terceiro_nome' },
  { table: 'agenda_logistica', idCol: 'cliente_id', nameCol: null },
  { table: 'rascunho_pedido_venda', idCol: 'cliente_id', nameCol: 'cliente_nome' },
  { table: 'devolucao_troca', idCol: 'cliente_id', nameCol: 'cliente_nome' },
  { table: 'vale_compra', idCol: 'cliente_id', nameCol: 'cliente_nome' },
];

const NAME_ONLY_TABLES = [
  { table: 'pedido_venda', col: 'cliente_nome' },
  { table: 'pedido_compra', col: 'fornecedor_nome' },
  { table: 'embarque', col: 'fornecedor_nome' },
  { table: 'lancamento_financeiro', col: 'terceiro_nome' },
  { table: 'conta_recorrente', col: 'terceiro_nome' },
  { table: 'conta_prevista', col: 'terceiro_nome' },
  { table: 'rascunho_pedido_venda', col: 'cliente_nome' },
  { table: 'devolucao_troca', col: 'cliente_nome' },
  { table: 'vale_compra', col: 'cliente_nome' },
  { table: 'autorizacao_estorno', col: 'cliente_nome' },
];

const FORNECEDOR_NAME_ALIASES = new Map([
  ['TINTAO TELEVENDAS', 'TINTAO NOVA CIDADE'],
  ['TINTÃO TELEVENDAS', 'TINTAO NOVA CIDADE'],
]);

async function sbFetch(pathSuffix, { method = 'GET', body, prefer } = {}) {
  const h = { ...headers };
  if (prefer) h.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathSuffix}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${pathSuffix} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function fetchAllTerceiros() {
  /** @type {TerceiroRow[]} */
  const all = [];
  let offset = 0;
  while (true) {
    const batch = await sbFetch(
      `terceiro?select=id,nome,tipo,cpf_cnpj,telefone,created_at&order=created_at.asc&limit=1000&offset=${offset}`,
    );
    all.push(...batch);
    if (batch.length < 1000) break;
    offset += 1000;
  }
  return all;
}

function normKey(nome) {
  return (nome || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normAlnum(nome) {
  return normKey(nome).replace(/[^a-z0-9]/g, '');
}

function toUpperNome(nome) {
  if (!nome || typeof nome !== 'string') return nome;
  return nome.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

function canonicalNomeForCluster(clusterKey, winner) {
  if (clusterKey.includes('::__cocil__')) return 'COCIL';
  if (clusterKey.includes('::__jbmix__')) return 'JBMIX';
  return toUpperNome(winner.nome);
}

/** Agrupa registos que são a mesma pessoa/empresa. */
function clusterKey(row) {
  if (!row.nome) return `__empty__::${row.id}`;
  const tipo = row.tipo || 'Cliente';
  const alnum = normAlnum(row.nome);
  if (tipo === 'Fornecedor' || tipo === 'Ambos') {
    if (alnum === 'cocil' || alnum === 'cocilmatriz') return `${tipo}::__cocil__`;
    if (alnum === 'jbmix') return `${tipo}::__jbmix__`;
    if (alnum.startsWith('fecomercio')) return `${tipo}::__fecomercio__`;
  }
  return `${tipo}::${normKey(row.nome)}`;
}

function scoreRow(row, refCounts) {
  let score = refCounts.get(row.id) || 0;
  if (row.cpf_cnpj && String(row.cpf_cnpj).trim()) score += 5;
  if (row.telefone && String(row.telefone).trim()) score += 2;
  return score;
}

function pickWinner(rows, refCounts) {
  const sorted = [...rows].sort((a, b) => {
    const matrizA = /matriz/i.test(a.nome || '') ? 1 : 0;
    const matrizB = /matriz/i.test(b.nome || '') ? 1 : 0;
    if (matrizA !== matrizB) return matrizA - matrizB;
    const sa = scoreRow(a, refCounts);
    const sb = scoreRow(b, refCounts);
    if (sb !== sa) return sb - sa;
    const lenA = normAlnum(a.nome).length;
    const lenB = normAlnum(b.nome).length;
    if (lenA !== lenB) return lenA - lenB;
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
  return sorted[0];
}

async function countRefsByTerceiroId() {
  const counts = new Map();
  for (const { table, idCol } of ID_REF_TABLES) {
    let offset = 0;
    while (true) {
      const batch = await sbFetch(
        `${table}?select=${idCol}&${idCol}=not.is.null&limit=1000&offset=${offset}`,
      );
      for (const row of batch) {
        const id = row[idCol];
        if (!id) continue;
        counts.set(id, (counts.get(id) || 0) + 1);
      }
      if (batch.length < 1000) break;
      offset += 1000;
    }
  }
  return counts;
}

function buildMergePlan(terceiros, refCounts) {
  /** @type {Map<string, TerceiroRow[]>} */
  const clusters = new Map();
  for (const row of terceiros) {
    const key = clusterKey(row);
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(row);
  }

  /** @type {{ winnerId: string, loserId: string, winnerNome: string, clusterKey: string }[]} */
  const merges = [];
  const emptyIds = terceiros.filter((r) => !r.nome || !r.tipo).map((r) => r.id);

  for (const [key, rows] of clusters) {
    if (key.startsWith('__empty__')) continue;
    if (rows.length <= 1) continue;
    const winner = pickWinner(rows, refCounts);
    const winnerNome = canonicalNomeForCluster(key, winner);
    for (const row of rows) {
      if (row.id === winner.id) continue;
      merges.push({
        winnerId: winner.id,
        loserId: row.id,
        winnerNome,
        clusterKey: key,
        loserNome: row.nome,
      });
    }
  }

  return { merges, emptyIds };
}

async function repointReferences(merge, applyMode) {
  const { winnerId, loserId, winnerNome } = merge;
  for (const { table, idCol, nameCol } of ID_REF_TABLES) {
    const body = { [idCol]: winnerId };
    if (nameCol) body[nameCol] = winnerNome;
    const path = `${table}?${idCol}=eq.${encodeURIComponent(loserId)}`;
    if (applyMode) {
      await sbFetch(path, { method: 'PATCH', body, prefer: 'return=minimal' });
    }
  }
}

async function deleteTerceiro(id, applyMode) {
  if (!applyMode) return;
  await sbFetch(`terceiro?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
}

async function uppercaseTerceiros(terceiros, applyMode) {
  let updated = 0;
  for (const row of terceiros) {
    if (!row.nome) continue;
    const upper = toUpperNome(row.nome);
    if (upper === row.nome) continue;
    updated += 1;
    if (applyMode) {
      await sbFetch(`terceiro?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        body: { nome: upper },
        prefer: 'return=minimal',
      });
    }
  }
  return updated;
}

async function syncLinkedDisplayNames(terceiroById, applyMode) {
  let touched = 0;
  for (const { table, idCol, nameCol } of ID_REF_TABLES) {
    if (!nameCol) continue;
    let offset = 0;
    while (true) {
      const batch = await sbFetch(
        `${table}?select=id,${idCol},${nameCol}&${idCol}=not.is.null&limit=500&offset=${offset}`,
      );
      for (const row of batch) {
        const t = terceiroById.get(row[idCol]);
        const target = t?.nome ? toUpperNome(t.nome) : row[nameCol] ? toUpperNome(row[nameCol]) : null;
        if (!target || target === row[nameCol]) continue;
        touched += 1;
        if (applyMode) {
          await sbFetch(`${table}?id=eq.${encodeURIComponent(row.id)}`, {
            method: 'PATCH',
            body: { [nameCol]: target },
            prefer: 'return=minimal',
          });
        }
      }
      if (batch.length < 500) break;
      offset += 500;
    }
  }
  return touched;
}

async function uppercaseOrphanDisplayNames(applyMode) {
  let touched = 0;
  for (const { table, col } of NAME_ONLY_TABLES) {
    let offset = 0;
    while (true) {
      const batch = await sbFetch(`${table}?select=id,${col}&limit=500&offset=${offset}`);
      for (const row of batch) {
        const raw = row[col];
        if (!raw || typeof raw !== 'string') continue;
        let target = toUpperNome(raw);
        for (const [from, to] of FORNECEDOR_NAME_ALIASES) {
          if (target === toUpperNome(from)) target = to;
        }
        if (target === raw) continue;
        touched += 1;
        if (applyMode) {
          await sbFetch(`${table}?id=eq.${encodeURIComponent(row.id)}`, {
            method: 'PATCH',
            body: { [col]: target },
            prefer: 'return=minimal',
          });
        }
      }
      if (batch.length < 500) break;
      offset += 500;
    }
  }
  return touched;
}

async function main() {
  console.log(`[unificar-terceiros] Modo: ${apply ? 'APPLY' : 'dry-run'}`);
  const terceiros = await fetchAllTerceiros();
  const refCounts = await countRefsByTerceiroId();
  const { merges, emptyIds } = buildMergePlan(terceiros, refCounts);

  const report = {
    generated_at: new Date().toISOString(),
    apply,
    terceiros_total: terceiros.length,
    merges_planned: merges.length,
    empty_rows_delete: emptyIds.length,
    merges: merges.map((m) => ({
      cluster: m.clusterKey,
      keep: m.winnerId,
      remove: m.loserId,
      nome: m.winnerNome,
      removed_nome: m.loserNome,
    })),
    empty_ids: emptyIds,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log('[unificar-terceiros] Relatório:', REPORT_PATH);
  console.log(`  Fusões: ${merges.length} | Linhas vazias: ${emptyIds.length}`);

  if (!apply) {
    console.log('\nDry-run. Para aplicar: node scripts/unificar-terceiros-duplicados.mjs --apply');
    return;
  }

  for (const merge of merges) {
    await repointReferences(merge, true);
    await deleteTerceiro(merge.loserId, true);
    console.log(`[merge] ${merge.loserNome} → ${merge.winnerNome}`);
  }

  for (const id of emptyIds) {
    await deleteTerceiro(id, true);
  }
  if (emptyIds.length) console.log(`[delete] ${emptyIds.length} terceiro(s) vazio(s)`);

  const remaining = await fetchAllTerceiros();
  const upperCount = await uppercaseTerceiros(remaining, true);
  console.log(`[uppercase] terceiro.nome: ${upperCount} linha(s)`);

  const afterUpper = await fetchAllTerceiros();
  const byId = new Map(afterUpper.map((r) => [r.id, { ...r, nome: toUpperNome(r.nome) }]));
  const linked = await syncLinkedDisplayNames(byId, true);
  console.log(`[uppercase] nomes ligados por ID: ${linked} linha(s)`);

  const orphan = await uppercaseOrphanDisplayNames(true);
  console.log(`[uppercase] nomes em documentos (incl. avulso / alias): ${orphan} linha(s)`);

  console.log('\n[unificar-terceiros] Concluído.');
}

main().catch((err) => {
  console.error('[unificar-terceiros]', err);
  process.exit(1);
});
