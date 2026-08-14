#!/usr/bin/env node
/**
 * Lista e limpa reserva cerâmica do portal (tabela auxiliar portal_catalog).
 *
 *   npm run reserva:listar
 *   npm run reserva:reativar              # dry-run
 *   npm run reserva:reativar -- --apply     # reserva_portal=false em portal_catalog
 *   npm run reserva:reativar -- --apply --codigos=ABC,DEF
 *   npm run reserva:reativar -- --apply --legacy-base44  # remove tag antiga no Base44 (opcional)
 *
 * Requer DATABASE_URL (migração 067 aplicada).
 * --legacy-base44 também requer VITE_BASE44_APP_ID + BASE44_ACCESS_TOKEN ou BASE44_API_KEY.
 */
import pg from 'pg';
import { requireBase44Client } from './base44-env.mjs';

const PORTAL_RESERVA_TAG = 'reserva-ceramica';
const BATCH_SIZE = 8;

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const legacyBase44 = args.has('--legacy-base44');
const codigosArg = [...args].find((a) => a.startsWith('--codigos='));
const filterCodigos = codigosArg
  ? new Set(codigosArg.slice('--codigos='.length).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))
  : null;

function normalizeTag(tag) {
  return String(tag || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
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

async function listPortalReserva(client) {
  const { rows } = await client.query(`
    select codigo_interno, novo_sku, linha_nome, produto_compra_nome, produto_id, reserva_portal
    from public.portal_catalog
    where ativo = true and reserva_portal = true
    order by linha_ordem, novo_sku
  `);
  return rows;
}

async function clearPortalReserva(client, codigos = null) {
  if (codigos?.length) {
    const { rowCount } = await client.query(
      `update public.portal_catalog
       set reserva_portal = false, updated_at = now()
       where ativo = true and reserva_portal = true
         and upper(codigo_interno) = any($1::text[])`,
      [codigos.map((c) => String(c).trim().toUpperCase())],
    );
    return rowCount;
  }
  const { rowCount } = await client.query(`
    update public.portal_catalog
    set reserva_portal = false, updated_at = now()
    where ativo = true and reserva_portal = true
  `);
  return rowCount;
}

async function fetchLegacyBase44Reserva(base44) {
  const byId = new Map();
  const pageSize = 500;
  let skip = 0;

  for (let page = 0; page < 40; page += 1) {
    const batch = await base44.entities.Produto.list('-created_date', pageSize, skip);
    const rows = Array.isArray(batch) ? batch : batch?.data ?? [];
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

  return [...byId.values()].filter((p) => {
    const tags = Array.isArray(p?.tags) ? p.tags : [];
    return tags.some((t) => normalizeTag(t) === PORTAL_RESERVA_TAG) || p.ativo === false;
  });
}

async function runBatchUpdates(base44, items) {
  let done = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(({ id, patch }) => base44.entities.Produto.update(id, patch)),
    );
    done += batch.length;
    console.log(`  … ${done}/${items.length} actualizados no Base44`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[reserva] DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    let reservados = await listPortalReserva(client);
    if (filterCodigos?.size) {
      reservados = reservados.filter((r) => filterCodigos.has(String(r.codigo_interno).toUpperCase()));
    }

    console.log(`[reserva] portal_catalog.reserva_portal=true: ${reservados.length}`);
    if (reservados.length) {
      console.log('\nAmostra (até 25):');
      console.log(JSON.stringify(reservados.slice(0, 25), null, 2));
    }

    if (!apply) {
      console.log('\n[reserva] Dry-run. Para limpar: npm run reserva:reativar -- --apply');
      if (legacyBase44) {
        console.log('[reserva] Com --legacy-base44 também remove tag antiga no cadastro Base44.');
      }
      return;
    }

    const codigos = filterCodigos?.size
      ? [...filterCodigos]
      : reservados.map((r) => r.codigo_interno);
    const n = await clearPortalReserva(client, codigos.length ? codigos : null);
    console.log(`\n[reserva] ${n} linha(s) actualizada(s) em portal_catalog (reserva_portal=false).`);

    if (legacyBase44) {
      const base44 = requireBase44Client();
      const legado = await fetchLegacyBase44Reserva(base44);
      console.log(`[reserva] Legado Base44 (tag/inactivo): ${legado.length}`);
      if (legado.length) {
        const items = legado.map((p) => ({
          id: p.id,
          patch: {
            ativo: true,
            tags: mergeTags(Array.isArray(p.tags) ? p.tags : [], { remove: [PORTAL_RESERVA_TAG] }),
          },
        }));
        await runBatchUpdates(base44, items);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[reserva]', e);
  process.exit(1);
});
