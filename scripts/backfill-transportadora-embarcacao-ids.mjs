#!/usr/bin/env node
/**
 * Normaliza transportadora_id / embarcacao_template_id em viagens e embarques legados.
 *
 * A tabela Transportadora é a fonte canónica de embarcações (barcos).
 * Histórico: embarcacao_template_id = transportadora_id (overload de nomenclatura).
 *
 * Uso:
 *   npm run transportadora:embarcacao:backfill            # dry-run
 *   npm run transportadora:embarcacao:backfill -- --apply   # aplica updates
 *   npm run transportadora:embarcacao:aplicar             # atalho para aplicar
 *   npm run transportadora:embarcacao:backfill -- --apply --create-missing
 */
import { requireBase44Client } from './base44-env.mjs';
import {
  buildTransportadoraCatalogIndex,
  buildTransportadoraPersistPayload,
  matchTransportadoraFromCatalog,
  normalizeTransportadoraNome,
  resolveTransportadoraFromRecord,
} from '../src/lib/resolveTransportadora.js';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const createMissing = args.has('--create-missing');
const base44 = requireBase44Client();
const PAGE_SIZE = 200;

async function listAll(entity, sort = '-created_date') {
  const all = [];
  let offset = 0;
  while (true) {
    const chunk = await entity.list(sort, PAGE_SIZE, offset);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    all.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
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

const transportadoras = await listAll(base44.entities.Transportadora, '-updated_date');
let catalog = buildTransportadoraCatalogIndex(transportadoras);
const createdTransportadoras = [];

if (createMissing) {
  const eventosPreview = await listAll(base44.entities.EventoLogisticoSandbox, '-data_saida_origem');
  const nomesPendentes = new Set();

  for (const evento of eventosPreview) {
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
    const created = await base44.entities.Transportadora.create({
      nome: nome.toUpperCase(),
      ativo: true,
    });
    transportadoras.push(created);
    createdTransportadoras.push({ id: created.id, nome: created.nome, action: 'created' });
  }

  catalog = buildTransportadoraCatalogIndex(transportadoras);
}

const eventos = await listAll(base44.entities.EventoLogisticoSandbox, '-data_saida_origem');
const embarques = await listAll(base44.entities.Embarque, '-created_date');
const eventoById = new Map(eventos.map((e) => [e.id, e]));

const eventoUpdates = [];
for (const evento of eventos) {
  const payload = buildTransportadoraPersistPayload(evento, transportadoras);
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
  const source = evento || embarque;
  const payload = buildTransportadoraPersistPayload(source, transportadoras);
  if (!payload.transportadora_id && !payload.transportadora_nome) continue;
  if (!needsEmbarqueUpdate(embarque, payload)) continue;
  embarqueUpdates.push({
    id: embarque.id,
    codigo_exibicao: embarque.codigo_exibicao,
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
      transportadoras_cadastradas: transportadoras.length,
      transportadoras_criadas: createdTransportadoras.length,
      eventos_analisados: eventos.length,
      eventos_atualizar: eventoUpdates.length,
      embarques_analisados: embarques.length,
      embarques_atualizar: embarqueUpdates.length,
      apply,
      createMissing,
      amostra_eventos: eventoUpdates.slice(0, 8),
      amostra_embarques: embarqueUpdates.slice(0, 8),
      amostra_transportadoras_criadas: createdTransportadoras.slice(0, 8),
    },
    null,
    2,
  ),
);

if (!apply) {
  console.log('\nDry-run concluído. Para aplicar: npm run transportadora:embarcacao:backfill -- --apply');
  console.log('Atalho: npm run transportadora:embarcacao:aplicar');
  process.exit(0);
}

let done = 0;
for (const item of eventoUpdates) {
  await base44.entities.EventoLogisticoSandbox.update(item.id, item.depois);
  done += 1;
  if (done % 25 === 0 || done === eventoUpdates.length) {
    console.log(`[eventos] ${done}/${eventoUpdates.length}`);
  }
}

done = 0;
for (const item of embarqueUpdates) {
  await base44.entities.Embarque.update(item.id, item.depois);
  done += 1;
  if (done % 25 === 0 || done === embarqueUpdates.length) {
    console.log(`[embarques] ${done}/${embarqueUpdates.length}`);
  }
}

console.log('[transportadora:embarcacao:backfill] Concluído.');
