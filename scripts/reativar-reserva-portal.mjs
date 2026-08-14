#!/usr/bin/env node
/**
 * Lista e reactiva SKUs marcados como "reserva cerâmica" do portal (piloto homologação).
 *
 * Uso quando testes no portal inactivaram produtos no cadastro real (mesmo Base44).
 *
 *   npm run reserva:listar
 *   npm run reserva:reativar              # dry-run (só lista)
 *   npm run reserva:reativar -- --apply           # tag reserva-ceramica
 *   npm run reserva:reativar -- --apply --all-inativos  # todos ativo:false
 *   npm run reserva:reativar -- --apply --ids=abc,def
 *
 * Credenciais: VITE_BASE44_APP_ID + BASE44_ACCESS_TOKEN ou BASE44_API_KEY
 */
import { requireBase44Client } from './base44-env.mjs';

const PORTAL_RESERVA_TAG = 'reserva-ceramica';
const BATCH_SIZE = 8;

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const allInativos = args.has('--all-inativos');
const idsArg = [...args].find((a) => a.startsWith('--ids='));
const filterIds = idsArg
  ? new Set(idsArg.slice('--ids='.length).split(',').map((s) => s.trim()).filter(Boolean))
  : null;

function normalizeTag(tag) {
  return String(tag || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isProdutoReservaPortal(produto) {
  const tags = Array.isArray(produto?.tags) ? produto.tags : [];
  return tags.some((t) => normalizeTag(t) === PORTAL_RESERVA_TAG);
}

function mergeTags(existing = [], { remove = [] } = {}) {
  const removeSet = new Set(remove.map((t) => normalizeTag(t)).filter(Boolean));
  const out = [];
  const seen = new Set();
  for (const tag of existing) {
    const cleaned = String(tag || '').trim().replace(/^#+/, '').replace(/\s+/g, ' ');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (removeSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function rowsFromBatch(batch) {
  return Array.isArray(batch) ? batch : batch?.data ?? [];
}

async function fetchAllProdutos(base44) {
  const byId = new Map();
  const pageSize = 500;
  let skip = 0;

  for (let page = 0; page < 40; page += 1) {
    const batch = await base44.entities.Produto.list('-created_date', pageSize, skip);
    const rows = rowsFromBatch(batch);
    if (!rows.length) break;

    let novos = 0;
    for (const row of rows) {
      if (!row?.id || byId.has(row.id)) continue;
      byId.set(row.id, row);
      novos += 1;
    }

    if (rows.length < pageSize) break;
    if (novos === 0) break;
    skip += pageSize;
  }

  return [...byId.values()];
}

async function runBatchUpdates(base44, items) {
  let done = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(({ id, patch }) => base44.entities.Produto.update(id, patch)),
    );
    done += batch.length;
    console.log(`  … ${done}/${items.length} actualizados`);
  }
}

const base44 = requireBase44Client();

console.log('[reserva] A carregar catálogo…');
const todos = await fetchAllProdutos(base44);
let reservados = todos.filter(isProdutoReservaPortal);

if (filterIds?.size) {
  reservados = reservados.filter((p) => filterIds.has(p.id));
}

console.log(`[reserva] Total catálogo: ${todos.length}`);
console.log(`[reserva] Com tag "${PORTAL_RESERVA_TAG}": ${reservados.length}`);

const inativos = todos.filter((p) => p.ativo === false);
const isServico = (p) => String(p?.tipo || '').toLowerCase().startsWith('serv');
let alvo = reservados;
if (allInativos) {
  alvo = inativos.filter((p) => !isServico(p));
  console.log(`[reserva] Modo --all-inativos: ${alvo.length} produto(s) inactivo(s)`);
} else if (filterIds?.size) {
  alvo = reservados.filter((p) => filterIds.has(p.id));
} else if (reservados.length === 0 && inativos.length > 0) {
  alvo = inativos.filter((p) => !isServico(p));
  console.log(`[reserva] Sem tag reserva; a reactivar ${alvo.length} inactivo(s) com --apply`);
}

if (alvo.length === 0) {
  console.log('[reserva] Nada a fazer.');
  process.exit(0);
}

const amostra = alvo.slice(0, 25).map((p) => ({
  id: p.id,
  nome: p.nome,
  ativo: p.ativo,
  codigo: p.codigo_interno,
}));
console.log('\nAmostra (até 25):');
console.log(JSON.stringify(amostra, null, 2));

if (!apply) {
  console.log('\n[reserva] Dry-run. Para reactivar: npm run reserva:reativar -- --apply');
  process.exit(0);
}

const items = alvo.map((p) => ({
  id: p.id,
  patch: {
    ativo: true,
    tags: mergeTags(Array.isArray(p.tags) ? p.tags : [], { remove: [PORTAL_RESERVA_TAG] }),
  },
}));

console.log(`\n[reserva] A reactivar ${items.length} SKU(s)…`);
await runBatchUpdates(base44, items);
console.log('[reserva] Concluído. Produtos voltam a aparecer na cotação, PDV e buscas (ativo=true).');
