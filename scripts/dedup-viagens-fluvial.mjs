#!/usr/bin/env node
/**
 * Remove viagens fluviais duplicadas em `evento_logistico_sandbox`
 * (mesmo transportadora_id + data_saida_origem).
 *
 * Critério para manter 1 por grupo: mais vínculos (embarque / PO em dados),
 * depois código de viagem, ID legado (hex), e registo mais antigo.
 *
 * Uso:
 *   npm run viagens-fluvial:dedup           # dry-run
 *   npm run viagens-fluvial:dedup -- --apply
 */
import { createClient } from '@supabase/supabase-js';
import { loadDotEnvFiles } from './base44-env.mjs';
import { loadP38SecretsBundle } from './load-p38-secrets-bundle.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

loadDotEnvFiles();
loadP38SecretsBundle();
const secrets = resolveP38Secrets();
const url = secrets.supabaseUrl || `https://${secrets.projectRef}.supabase.co`;
const supabase = createClient(url, secrets.serviceRoleKey, { auth: { persistSession: false } });

async function fetchAll(table, select) {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function rowKey(r) {
  const tid = r.transportadora_id || r.dados?.transportadora_id || '';
  const saida = r.data_saida_origem || r.dados?.data_saida_origem || '';
  return `${tid}::${saida}`;
}

const apply = process.argv.includes('--apply');

const eventos = await fetchAll(
  'evento_logistico_sandbox',
  'id, codigo, nome, transportadora_id, transportadora_nome, embarcacao_nome, data_saida_origem, created_at, dados',
);
const embarques = await fetchAll('embarque', 'id, evento_logistico_id, dados');
const pedidos = await fetchAll('pedido_compra', 'id, dados');

const embByEvento = new Map();
for (const e of embarques) {
  const eid = e.evento_logistico_id || e.dados?.evento_logistico_id;
  if (!eid) continue;
  embByEvento.set(eid, (embByEvento.get(eid) || 0) + 1);
}
const poByEvento = new Map();
for (const p of pedidos) {
  const eid = p.dados?.evento_logistico_id;
  if (!eid) continue;
  poByEvento.set(eid, (poByEvento.get(eid) || 0) + 1);
}

function keepRank(r) {
  const links = (embByEvento.get(r.id) || 0) * 10 + (poByEvento.get(r.id) || 0) * 5;
  const codigo = r.codigo || r.dados?.codigo;
  const hexId = !String(r.id).includes('-');
  return { links, hasCodigo: codigo ? 1 : 0, hexId: hexId ? 1 : 0, created: r.created_at || '' };
}

function compareKeep(a, b) {
  const ra = keepRank(a);
  const rb = keepRank(b);
  if (rb.links !== ra.links) return rb.links - ra.links;
  if (rb.hasCodigo !== ra.hasCodigo) return rb.hasCodigo - ra.hasCodigo;
  if (rb.hexId !== ra.hexId) return rb.hexId - ra.hexId;
  return new Date(ra.created || 0) - new Date(rb.created || 0);
}

const groups = new Map();
for (const r of eventos) {
  const k = rowKey(r);
  const [tid, saida] = k.split('::');
  if (!tid || !saida) continue;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

const dups = [...groups.entries()].filter(([, arr]) => arr.length > 1);
dups.sort((a, b) => b[1].length - a[1].length);

console.log('Total eventos:', eventos.length);
console.log('Grupos duplicados (transportadora_id + data_saida_origem):', dups.length);

const toDelete = [];
for (const [k, arr] of dups) {
  const sorted = [...arr].sort(compareKeep);
  const keep = sorted[0];
  const remove = sorted.slice(1);
  const nome = keep.transportadora_nome || keep.embarcacao_nome || keep.dados?.transportadora_nome || '?';
  console.log(`\n${arr.length}x ${nome} | ${k.split('::')[1]}`);
  console.log(
    `  MANTER id=${keep.id} codigo=${keep.codigo} links emb=${embByEvento.get(keep.id) || 0} po=${poByEvento.get(keep.id) || 0}`,
  );
  for (const r of remove) {
    console.log(
      `  APAGAR id=${r.id} codigo=${r.codigo} links emb=${embByEvento.get(r.id) || 0} po=${poByEvento.get(r.id) || 0}`,
    );
    toDelete.push(r.id);
  }
}

console.log(`\nTotal a apagar: ${toDelete.length}`);
if (!apply) {
  console.log('(dry-run — passe --apply para executar deletes)');
  process.exit(0);
}

for (const id of toDelete) {
  const { error } = await supabase.from('evento_logistico_sandbox').delete().eq('id', id);
  if (error) {
    console.error('Erro ao apagar', id, error.message);
    process.exit(1);
  }
}
console.log('Apagados:', toDelete.length);
