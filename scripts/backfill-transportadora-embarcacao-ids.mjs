#!/usr/bin/env node
/**
 * Normaliza transportadora_id / embarcacao_template_id em viagens e embarques (Supabase/Postgres).
 *
 * Fonte canónica: tabela `transportadora` (cada embarcação/barco tem ID próprio).
 * Legado: `embarcacao_template_id` = mesmo ID que `transportadora_id`.
 *
 * Uso:
 *   npm run transportadora:embarcacao:backfill            # dry-run
 *   npm run transportadora:embarcacao:aplicar             # aplica updates
 *   npm run transportadora:embarcacao:backfill -- --apply --create-missing
 */
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { loadDotEnvFiles } from './base44-env.mjs';
import {
  buildTransportadoraCatalogIndex,
  buildTransportadoraPersistPayload,
  buildCanonicalTransportadoraNamesFromRecords,
  matchTransportadoraFromCatalog,
  normalizeTransportadoraNome,
  resolveTransportadoraFromRecord,
} from '../src/lib/resolveTransportadora.js';

loadDotEnvFiles();

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const createMissing = args.has('--create-missing');

if (!process.env.DATABASE_URL?.trim()) {
  console.error('[transportadora:embarcacao:backfill] DATABASE_URL em falta (Supabase Postgres).');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function flattenRow(row) {
  if (!row) return row;
  const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
  return { ...dados, ...row, dados };
}

function newId() {
  return randomBytes(12).toString('hex');
}

async function listTransportadoras() {
  const { rows } = await pool.query(`
    select id, nome, ativo, saida_referencia, dados
    from public.transportadora
    order by updated_at desc nulls last, created_at desc
  `);
  return rows.map(flattenRow);
}

async function listEventos() {
  const { rows } = await pool.query(`
    select *
    from public.evento_logistico_sandbox
    order by data_saida_origem desc nulls last, created_at desc
  `);
  return rows.map(flattenRow);
}

async function listEmbarques() {
  const { rows } = await pool.query(`
    select *
    from public.embarque
    order by created_at desc
  `);
  return rows.map(flattenRow);
}

function needsEventoUpdate(evento, payload) {
  return (
    (evento.transportadora_id || '') !== (payload.transportadora_id || '') ||
    (evento.transportadora_nome || '') !== (payload.transportadora_nome || '') ||
    (evento.embarcacao_template_id || '') !== (payload.embarcacao_template_id || '') ||
    (evento.embarcacao_nome || '') !== (payload.embarcacao_nome || '')
  );
}

function needsEmbarqueUpdate(embarque, payload) {
  return (
    (embarque.transportadora_id || '') !== (payload.transportadora_id || '') ||
    (embarque.transportadora_nome || '') !== (payload.transportadora_nome || '')
  );
}

async function createTransportadora(nome) {
  const id = newId();
  await pool.query(
    `insert into public.transportadora (id, nome, ativo, dados, created_at, updated_at)
     values ($1, $2, true, '{}'::jsonb, now(), now())`,
    [id, nome.toUpperCase()],
  );
  return { id, nome: nome.toUpperCase(), ativo: true };
}

async function updateTransportadoraNome(id, nome) {
  await pool.query(
    `update public.transportadora set
      nome = $2,
      updated_at = now(),
      dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('nome', $2::text)
    where id = $1`,
    [id, nome],
  );
}

async function updateEvento(id, payload) {
  await pool.query(
    `update public.evento_logistico_sandbox set
      transportadora_id = $2,
      transportadora_nome = $3,
      embarcacao_template_id = $4,
      embarcacao_nome = $5,
      updated_at = now(),
      dados = coalesce(dados, '{}'::jsonb)
        || jsonb_build_object(
          'transportadora_id', $2::text,
          'transportadora_nome', $3::text,
          'embarcacao_template_id', $4::text,
          'embarcacao_nome', $5::text
        )
    where id = $1`,
    [
      id,
      payload.transportadora_id || null,
      payload.transportadora_nome || null,
      payload.embarcacao_template_id || null,
      payload.embarcacao_nome || null,
    ],
  );
}

async function updateEmbarque(id, payload) {
  await pool.query(
    `update public.embarque set
      transportadora_id = $2,
      transportadora_nome = $3,
      updated_at = now(),
      dados = coalesce(dados, '{}'::jsonb)
        || jsonb_build_object(
          'transportadora_id', $2::text,
          'transportadora_nome', $3::text
        )
    where id = $1`,
    [id, payload.transportadora_id || null, payload.transportadora_nome || null],
  );
}

let transportadoras = await listTransportadoras();
const eventos = await listEventos();
const embarques = await listEmbarques();

const canonicalNames = buildCanonicalTransportadoraNamesFromRecords([...eventos, ...embarques]);
let catalog = buildTransportadoraCatalogIndex(transportadoras, canonicalNames);
const createdTransportadoras = [];
const transportadoraNomeUpdates = [];

for (const t of transportadoras) {
  const nomeCanonico = canonicalNames.get(t.id);
  if (!nomeCanonico || (t.nome || '').trim() === nomeCanonico.trim()) continue;
  transportadoraNomeUpdates.push({
    id: t.id,
    antes: t.nome || '',
    depois: nomeCanonico,
  });
}

if (createMissing) {
  const nomesPendentes = new Set();

  for (const evento of eventos) {
    const resolved = resolveTransportadoraFromRecord(evento);
    const matched = matchTransportadoraFromCatalog(resolved, catalog);
    if (matched.transportadora_id || matched.match_source !== 'unmatched') continue;
    const nome = resolved.embarcacao_nome || resolved.transportadora_nome;
    const norm = normalizeTransportadoraNome(nome);
    if (norm) nomesPendentes.add(nome.trim());
  }

  for (const nome of nomesPendentes) {
    const norm = normalizeTransportadoraNome(nome);
    if (catalog.byNome.has(norm)) continue;
    if (!apply) {
      createdTransportadoras.push({ nome, action: 'would_create' });
      continue;
    }
    const created = await createTransportadora(nome);
    transportadoras.push(created);
    canonicalNames.set(created.id, created.nome);
    createdTransportadoras.push({ id: created.id, nome: created.nome, action: 'created' });
  }

  catalog = buildTransportadoraCatalogIndex(transportadoras, canonicalNames);
}

const eventoById = new Map(eventos.map((e) => [e.id, e]));

const eventoUpdates = [];
for (const evento of eventos) {
  const payload = buildTransportadoraPersistPayload(evento, transportadoras, canonicalNames);
  if (!needsEventoUpdate(evento, payload)) continue;
  eventoUpdates.push({
    id: evento.id,
    codigo: evento.codigo,
    antes: {
      transportadora_id: evento.transportadora_id || '',
      embarcacao_template_id: evento.embarcacao_template_id || '',
      transportadora_nome: evento.transportadora_nome || '',
      embarcacao_nome: evento.embarcacao_nome || '',
    },
    depois: payload,
  });
}

const embarqueUpdates = [];
for (const embarque of embarques) {
  const evento = embarque.evento_logistico_id ? eventoById.get(embarque.evento_logistico_id) : null;
  const source = evento
    ? { ...embarque, ...resolveTransportadoraFromRecord(evento) }
    : embarque;
  const payload = buildTransportadoraPersistPayload(source, transportadoras, canonicalNames);
  if (!payload.transportadora_id && !payload.transportadora_nome) continue;
  if (!needsEmbarqueUpdate(embarque, payload)) continue;
  embarqueUpdates.push({
    id: embarque.id,
    numero: embarque.numero,
    evento_logistico_id: embarque.evento_logistico_id || '',
    antes: {
      transportadora_id: embarque.transportadora_id || '',
      transportadora_nome: embarque.transportadora_nome || '',
    },
    depois: {
      transportadora_id: payload.transportadora_id,
      transportadora_nome: payload.transportadora_nome,
    },
    origem: evento ? 'evento_vinculado' : 'match_direto',
  });
}

console.log(
  JSON.stringify(
    {
      fonte: 'supabase',
      transportadoras_cadastradas: transportadoras.length,
      transportadoras_nome_atualizar: transportadoraNomeUpdates.length,
      transportadoras_criadas: createdTransportadoras.length,
      eventos_analisados: eventos.length,
      eventos_atualizar: eventoUpdates.length,
      embarques_analisados: embarques.length,
      embarques_atualizar: embarqueUpdates.length,
      apply,
      createMissing,
      amostra_transportadoras: transportadoraNomeUpdates.slice(0, 8),
      amostra_eventos: eventoUpdates.slice(0, 8),
      amostra_embarques: embarqueUpdates.slice(0, 8),
      amostra_transportadoras_criadas: createdTransportadoras.slice(0, 8),
    },
    null,
    2,
  ),
);

if (!apply) {
  console.log('\nDry-run concluído. Para aplicar: npm run transportadora:embarcacao:aplicar');
  await pool.end();
  process.exit(0);
}

let done = 0;
for (const item of transportadoraNomeUpdates) {
  await updateTransportadoraNome(item.id, item.depois);
  done += 1;
  if (done % 25 === 0 || done === transportadoraNomeUpdates.length) {
    console.log(`[transportadoras] ${done}/${transportadoraNomeUpdates.length}`);
  }
}

done = 0;
for (const item of eventoUpdates) {
  await updateEvento(item.id, item.depois);
  done += 1;
  if (done % 25 === 0 || done === eventoUpdates.length) {
    console.log(`[eventos] ${done}/${eventoUpdates.length}`);
  }
}

done = 0;
for (const item of embarqueUpdates) {
  await updateEmbarque(item.id, item.depois);
  done += 1;
  if (done % 25 === 0 || done === embarqueUpdates.length) {
    console.log(`[embarques] ${done}/${embarqueUpdates.length}`);
  }
}

await pool.end();
console.log('[transportadora:embarcacao:backfill] Concluído (Supabase).');
